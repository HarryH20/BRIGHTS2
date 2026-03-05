import importlib
import logging
import time

import sqlalchemy
from flask import Blueprint, jsonify, request, session
from models import db
from routes.auth import login_required

logger = logging.getLogger(__name__)

viz_bp = Blueprint("viz", __name__, url_prefix="/api/visualizations")


@viz_bp.route("/goals")
@login_required
def get_goals():
    """Return per-goal text and T2-T6 scores for the current user from survey_responses."""
    user_id = session["user_id"]

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
                return jsonify({"goals": []})

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

    return jsonify({"goals": goals_out})


_ALLOWED_GRAPHS = {"roseplot", "radarplot", "ageplot", "solodivergingstackedbarchart"}


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

    try:
        module = importlib.import_module(f"analysis.{graph_name}")
    except ModuleNotFoundError as e:
        logger.error("Missing dependency in analysis.%s: %s", graph_name, e)
        return jsonify({"error": "Graph failed to load due to missing dependency"}), 500

    start = time.time()
    try:
        data = module.fetch_data(session["user_id"], db.engine, **request.args)
        fig_dict = module.build_figure(data)

        duration_ms = (time.time() - start) * 1000
        logger.info("Graph '%s' generated in %.1fms", graph_name, duration_ms)
        if duration_ms > 500:
            logger.warning("Slow chart generation: %s took %.1fms", graph_name, duration_ms)

        return jsonify(fig_dict)
    except Exception:
        logger.error("Failed to generate graph '%s'", graph_name, exc_info=True)
        return jsonify({"error": "Failed to generate visualization"}), 500
