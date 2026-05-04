import importlib
import logging
import time

import sqlalchemy
from flask import Blueprint, jsonify, request, session
from models import db
from routes.auth import login_required
from cache import get_chart_cache, set_chart_cache, make_cache_key

logger = logging.getLogger(__name__)

viz_bp = Blueprint("viz", __name__, url_prefix="/api/visualizations")


@viz_bp.route("/goals")
@login_required
def get_goals():
    """Return per-goal text and T2-T6 scores for the current user from survey_responses."""
    user_id = session["user_id"]

    cache_key = make_cache_key(user_id, "goals")
    cached = get_chart_cache(cache_key)
    if cached is not None:
        logger.info("Chart cache HIT: goals user=%s", user_id)
        return jsonify(cached)

    logger.info("Chart cache MISS: goals user=%s", user_id)

    try:
        with db.engine.connect() as conn:
            # Goal texts from T1 goal_text responses
            text_result = conn.execute(
                sqlalchemy.text(
                    """
                    SELECT sr.goal_index, sr.response_value AS goal_text
                    FROM survey_responses sr
                    JOIN survey_questions sq ON sq.id = sr.question_id
                    WHERE sr.user_id = :uid
                      AND sq.scale_type = 'goal_text'
                    ORDER BY sr.goal_index
                    """
                ),
                {"uid": user_id},
            )
            goal_texts = {row._mapping["goal_index"]: row._mapping["goal_text"]
                          for row in text_result}

            if not goal_texts:
                empty = {"goals": []}
                set_chart_cache(cache_key, empty)
                return jsonify(empty)

            # Q39/Q40/Q41 scores for T2-T6
            score_result = conn.execute(
                sqlalchemy.text(
                    """
                    SELECT sr.goal_index, sr.timepoint, sq.question_number, sr.response_value
                    FROM survey_responses sr
                    JOIN survey_questions sq ON sq.id = sr.question_id
                    WHERE sr.user_id = :uid
                      AND sr.timepoint BETWEEN 2 AND 6
                      AND sq.question_number IN (39, 40, 41)
                    ORDER BY sr.goal_index, sr.timepoint, sq.question_number
                    """
                ),
                {"uid": user_id},
            )
            scores = {}
            for row in score_result:
                m = row._mapping
                gi = m["goal_index"]
                tp_key = f"T{m['timepoint']}"
                q_key = f"Q{m['question_number']}"
                scores.setdefault(gi, {}).setdefault(tp_key, {})[q_key] = (
                    int(m["response_value"]) if m["response_value"] is not None else None
                )

    except Exception:
        logger.error("Failed to fetch goals for user_id=%s", user_id, exc_info=True)
        return jsonify({"error": "Failed to fetch goals"}), 500

    goals_out = []
    for goal_index, goal_text in sorted(goal_texts.items()):
        timepoints = {}
        for t in range(2, 7):
            tp_key = f"T{t}"
            tp_scores = scores.get(goal_index, {}).get(tp_key, {})
            timepoints[tp_key] = {
                "Q39": tp_scores.get("Q39"),
                "Q40": tp_scores.get("Q40"),
                "Q41": tp_scores.get("Q41"),
            }
        goals_out.append({
            "goal_id": goal_index,
            "text": str(goal_text).strip() if goal_text else f"Goal {goal_index}",
            "timepoints": timepoints,
        })

    result = {"goals": goals_out}
    set_chart_cache(cache_key, result)
    return jsonify(result)


_ALLOWED_GRAPHS = {"roseplot", "radarplot"}


@viz_bp.route("/goal_trajectory_available")
@login_required
def goal_trajectory_available():
    """
    GET /api/visualizations/goal_trajectory_available?goal_index=0
    Returns which question numbers have at least one non-null response for
    the current user's specified goal. Used by GoalTrajectorySparklines to
    filter its dropdowns to questions that actually have data.
    """
    goal_index = request.args.get("goal_index", 0, type=int)
    user_id = session["user_id"]

    try:
        module = importlib.import_module("analysis.goal_trajectory_sparklines")
        data = module.fetch_data(user_id, db.engine, goal_index)
        if not data:
            return jsonify({"available_questions": []})
        available = [
            q for q in range(1, 44)
            if any(v is not None for v in data["p_q_traj"][q])
        ]
        return jsonify({"available_questions": available})
    except Exception:
        logger.error("Failed to fetch available trajectory questions", exc_info=True)
        return jsonify({"available_questions": []}), 500


@viz_bp.route("/goal_trajectory_sparklines")
@login_required
def goal_trajectory_sparklines():
    """
    GET /api/visualizations/goal_trajectory_sparklines
        ?goal_index=0&use_constructs=false&item_index=0

    Returns structured trajectory data for ECharts rendering:
      { goal_text, label, min_t, traj, q25, q50, q75, t_labels }
    or { empty: true } when no survey data exists yet.
    """
    goal_index    = request.args.get("goal_index", 0, type=int)
    use_constructs = request.args.get("use_constructs", "false").lower() == "true"
    item_index    = request.args.get("item_index", 0, type=int)
    user_id = session["user_id"]

    try:
        module = importlib.import_module("analysis.goal_trajectory_sparklines")
        data = module.fetch_data(user_id, db.engine, goal_index)
        if not data:
            return jsonify({"empty": True})

        if use_constructs:
            constructs = [(lbl, min_t) for lbl, _, min_t in module.CONSTRUCTS]
            idx        = min(item_index, len(constructs) - 1)
            lbl, min_t = constructs[idx]
            traj       = data["p_c_traj"][lbl]
            band       = data["c_bands"][lbl]
            label      = lbl
        else:
            q     = min(item_index + 1, 43)
            min_t = module.Q_MIN_T[q]
            traj  = data["p_q_traj"][q]
            band  = data["q_bands"][q]
            label = module.Q_LABELS[q]

        return jsonify({
            "goal_text": data["goal_text"],
            "label":     label,
            "min_t":     min_t,
            "traj":      traj,
            "q25":       band["q25"],
            "q50":       band["q50"],
            "q75":       band["q75"],
            "t_labels":  module.T_LABELS,
        })
    except Exception:
        logger.error("Failed to generate goal trajectory sparklines", exc_info=True)
        return jsonify({"error": "Failed to generate visualization"}), 500


@viz_bp.route("/<graph_name>")
@login_required
def serve_graph(graph_name):
    """
    Serve a graph from the analysis/ package.
    Only modules listed in _ALLOWED_GRAPHS are accessible.
    """
    if graph_name not in _ALLOWED_GRAPHS:
        logger.warning("Graph module not in allowlist: %s", graph_name)
        return jsonify({"error": "Graph not found"}), 404

    user_id = session["user_id"]
    params = {**dict(request.args), "goal_id": str(request.args.get("goal_id", ""))}
    cache_key = make_cache_key(user_id, graph_name, params)
    cached = get_chart_cache(cache_key)
    if cached is not None:
        logger.info("Chart cache HIT: %s user=%s", graph_name, user_id)
        return jsonify(cached)

    logger.info("Chart cache MISS: %s user=%s", graph_name, user_id)

    try:
        module = importlib.import_module(f"analysis.{graph_name}")
    except ModuleNotFoundError as e:
        logger.error("Missing dependency in analysis.%s: %s", graph_name, e)
        return jsonify({"error": "Graph failed to load due to missing dependency"}), 500

    start = time.time()
    try:
        data = module.fetch_data(user_id, db.engine, **request.args)
        fig_dict = module.build_figure(data)

        duration_ms = (time.time() - start) * 1000
        logger.info("Graph '%s' generated in %.1fms", graph_name, duration_ms)
        if duration_ms > 500:
            logger.warning("Slow chart generation: %s took %.1fms", graph_name, duration_ms)

        set_chart_cache(cache_key, fig_dict)
        return jsonify(fig_dict)
    except Exception:
        logger.error("Failed to generate graph '%s'", graph_name, exc_info=True)
        return jsonify({"error": "Failed to generate visualization"}), 500
