import importlib
import logging
import time

import sqlalchemy
from flask import Blueprint, jsonify, session
from models import db, User
from routes.auth import login_required

logger = logging.getLogger(__name__)

viz_bp = Blueprint("viz", __name__, url_prefix="/api/visualizations")


@viz_bp.route("/goals")
@login_required
def get_goals():
    """Return per-goal text and T2-T6 scores for the current user."""
    user = db.session.get(User, session["user_id"])
    participant_id = user.participant_id if user else None

    if not participant_id:
        return jsonify({"goals": []})

    try:
        with db.engine.connect() as conn:
            result = conn.execute(
                sqlalchemy.text(
                    """
                    SELECT "GoalID", "GoalT1",
                           "GT2Q39","GT2Q40","GT2Q41",
                           "GT3Q39","GT3Q40","GT3Q41",
                           "GT4Q39","GT4Q40","GT4Q41",
                           "GT5Q39","GT5Q40","GT5Q41",
                           "GT6Q39","GT6Q40","GT6Q41"
                    FROM "GoalIntervention"
                    WHERE "ID" = :pid
                      AND "GoalT1" IS NOT NULL
                      AND TRIM("GoalT1") != ''
                    ORDER BY "GoalID"
                    """
                ),
                {"pid": participant_id},
            )
            rows = result.fetchall()
    except Exception:
        logger.error("Failed to fetch goals for participant_id=%s", participant_id, exc_info=True)
        return jsonify({"error": "Failed to fetch goals"}), 500

    goals_out = []
    for row in rows:
        m = row._mapping
        timepoints = {}
        for t in range(2, 7):
            tp = {}
            for q in ("Q39", "Q40", "Q41"):
                val = m.get(f"GT{t}{q}")
                try:
                    tp[q] = int(val) if val is not None else None
                except (ValueError, TypeError):
                    tp[q] = None
            timepoints[f"T{t}"] = tp

        goals_out.append({
            "goal_id": int(m["GoalID"]),
            "text": str(m["GoalT1"]).strip(),
            "timepoints": timepoints,
        })

    return jsonify({"goals": goals_out})


@viz_bp.route("/<graph_name>")
@login_required
def serve_graph(graph_name):
    """
    Auto-discover and serve any graph from the analysis/ package.
    Adding analysis/<graph_name>.py is all that is needed for a new endpoint.
    """
    try:
        module = importlib.import_module(f"analysis.{graph_name}")
    except ModuleNotFoundError:
        logger.warning("Graph module not found: analysis.%s", graph_name)
        return jsonify({"error": "Graph not found"}), 404

    start = time.time()
    try:
        user = db.session.get(User, session["user_id"])
        participant_id = user.participant_id if user else None

        data = module.fetch_data(participant_id, db.engine)
        fig_dict = module.build_figure(data)

        duration_ms = (time.time() - start) * 1000
        logger.info("Graph '%s' generated in %.1fms", graph_name, duration_ms)
        if duration_ms > 500:
            logger.warning("Slow chart generation: %s took %.1fms", graph_name, duration_ms)

        return jsonify(fig_dict)
    except Exception:
        logger.error("Failed to generate graph '%s'", graph_name, exc_info=True)
        return jsonify({"error": "Failed to generate visualization"}), 500
