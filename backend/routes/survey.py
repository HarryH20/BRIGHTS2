import logging
import os
from datetime import timedelta

from flask import Blueprint, jsonify, request, session
from models import db, User, SurveyQuestion, SurveySubmission, SurveyResponse
from routes.auth import login_required, admin_required

logger = logging.getLogger(__name__)

survey_bp = Blueprint("survey", __name__, url_prefix="/api/survey")
admin_survey_bp = Blueprint("admin_survey", __name__, url_prefix="/api/admin/survey")

# Map timepoint int → form_type string used in survey_questions
def _form_type(timepoint: int) -> str:
    if timepoint == 1:
        return "t1"
    if timepoint == 2:
        return "t2"
    if timepoint == 6:
        return "t6"
    return "t3t5"  # 3, 4, 5


# ── Participant routes ─────────────────────────────────────────────────────────

@survey_bp.route("/status", methods=["GET"])
@login_required
def get_survey_status():
    """
    Return completion status for all 6 timepoints for the logged-in user.

    Response:
    {
      "timepoints": [
        { "timepoint": 1, "completed": true,  "submitted_at": "2026-01-01T..." },
        { "timepoint": 2, "completed": true,  "submitted_at": "2026-01-08T..." },
        { "timepoint": 3, "completed": false, "submitted_at": null },
        ...
      ],
      "completed_count": 2
    }
    """
    user_id = session["user_id"]
    submissions = SurveySubmission.query.filter_by(user_id=user_id).all()
    completed = {s.timepoint: s for s in submissions}

    timepoints = []
    for t in range(1, 7):
        sub = completed.get(t)
        timepoints.append({
            "timepoint": t,
            "completed": sub is not None,
            "submitted_at": sub.submitted_at.isoformat() if sub else None,
        })

    return jsonify({"timepoints": timepoints, "completed_count": len(completed)})


@survey_bp.route("/next", methods=["GET"])
@login_required
def get_next_survey():
    """
    Return the next due survey for the logged-in user.

    Response shapes:
      { "status": "locked", "next_unlocks_at": <iso>, "timepoint": N }
      { "status": "complete" }   — all 6 timepoints done
      { "status": "due", "timepoint": N, "form_type": "t1"|"t2"|"t3t5"|"t6",
        "goals": [...],          — list of goal texts (from T1 submission or GoalIntervention)
        "questions": [{ id, question_number, question_text, scale_type, display_order }, ...] }
    """
    user_id = session["user_id"]

    # Find completed timepoints for this user, ordered
    submissions = (
        SurveySubmission.query
        .filter_by(user_id=user_id)
        .order_by(SurveySubmission.timepoint)
        .all()
    )
    completed = {s.timepoint for s in submissions}

    # All 6 done
    if len(completed) == 6:
        return jsonify({"status": "complete"})

    # Determine next due timepoint
    next_tp = next(t for t in range(1, 7) if t not in completed)

    # Check if it's locked (previous submission hasn't unlocked it yet)
    if next_tp > 1:
        prev = next(s for s in submissions if s.timepoint == next_tp - 1)
        if prev.next_unlocks_at and _utcnow() < prev.next_unlocks_at:
            return jsonify({
                "status": "locked",
                "timepoint": next_tp,
                "next_unlocks_at": prev.next_unlocks_at.isoformat(),
            })

    form_type = _form_type(next_tp)

    questions = (
        SurveyQuestion.query
        .filter_by(form_type=form_type, status="active")
        .order_by(SurveyQuestion.display_order)
        .all()
    )

    # Goal texts — from T1 open-ended responses if they exist, else GoalIntervention
    goals = _get_goal_texts(user_id, next_tp)

    return jsonify({
        "status": "due",
        "timepoint": next_tp,
        "form_type": form_type,
        "goals": goals,
        "questions": [
            {
                "id": q.id,
                "question_number": q.question_number,
                "question_text": q.question_text,
                "scale_type": q.scale_type,
                "display_order": q.display_order,
            }
            for q in questions
        ],
    })


@survey_bp.route("/submit", methods=["POST"])
@login_required
def submit_survey():
    """
    Save survey responses and record the submission.

    Body:
    {
      "timepoint": 1,
      "responses": [
        { "question_id": 1, "goal_index": 1, "response_value": "6" },
        ...
      ]
    }
    """
    user_id = session["user_id"]
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    timepoint = data.get("timepoint")
    responses = data.get("responses", [])

    if not isinstance(timepoint, int) or not (1 <= timepoint <= 6):
        return jsonify({"error": "timepoint must be an integer 1–6"}), 400

    if not responses:
        return jsonify({"error": "responses cannot be empty"}), 400

    # Guard: don't allow re-submission of a completed timepoint
    existing = SurveySubmission.query.filter_by(user_id=user_id, timepoint=timepoint).first()
    if existing:
        return jsonify({"error": f"Timepoint {timepoint} already submitted"}), 409

    # Build allowed question ID set for this form type to reject spoofed IDs
    form_type = _form_type(timepoint)
    allowed_qids = {
        q.id for q in SurveyQuestion.query.filter_by(form_type=form_type, status="active").all()
    }

    try:
        # Save individual responses
        for r in responses:
            qid = r.get("question_id")
            goal_index = r.get("goal_index", 1)
            value = r.get("response_value")

            # Reject unknown question IDs or bad goal_index
            if not qid or qid not in allowed_qids:
                continue
            if not isinstance(goal_index, int) or not (1 <= goal_index <= 3):
                continue

            # Numeric responses: validate Likert range 1–7; goal_text: allow strings up to 2000 chars
            sanitized_value = None
            if value is not None:
                try:
                    int_val = int(value)
                    sanitized_value = str(int_val) if 1 <= int_val <= 7 else None
                except (ValueError, TypeError):
                    sanitized_value = str(value)[:2000]

            db.session.add(SurveyResponse(
                user_id=user_id,
                goal_index=goal_index,
                timepoint=timepoint,
                question_id=qid,
                response_value=sanitized_value,
            ))

        # Record submission + set next unlock date (7 days), NULL for T6
        next_unlocks = _utcnow() + timedelta(days=7) if timepoint < 6 else None
        db.session.add(SurveySubmission(
            user_id=user_id,
            timepoint=timepoint,
            next_unlocks_at=next_unlocks,
        ))

        db.session.commit()
        logger.info("Survey T%s submitted: user=%s responses=%s", timepoint, user_id, len(responses))

    except Exception:
        db.session.rollback()
        logger.error("Survey submit failed: user=%s T%s", user_id, timepoint, exc_info=True)
        return jsonify({"error": "Failed to save survey"}), 500

    return jsonify({
        "message": f"Timepoint {timepoint} submitted successfully.",
        "next_unlocks_at": next_unlocks.isoformat() if next_unlocks else None,
    }), 201


# ── Dev-only routes ────────────────────────────────────────────────────────────

@survey_bp.route("/dev/unlock-all", methods=["POST"])
@login_required
def dev_unlock_all():
    """
    DEV ONLY — immediately unlock the next survey for the current user
    by setting next_unlocks_at to now on all their submissions.
    Only available when FLASK_ENV=development.
    """
    if os.environ.get("FLASK_ENV") != "development":
        return jsonify({"error": "Not available in production"}), 403

    user_id = session["user_id"]
    now = _utcnow()
    SurveySubmission.query.filter_by(user_id=user_id).update({"next_unlocks_at": now})
    db.session.commit()
    logger.info("DEV: unlocked all surveys for user=%s", user_id)
    return jsonify({"message": "All surveys unlocked for testing."})


@survey_bp.route("/dev/reset", methods=["POST"])
@login_required
def dev_reset():
    """
    DEV ONLY — delete all survey submissions and responses for the current user
    so they can start the form flow from scratch.
    Only available when FLASK_ENV=development.
    """
    if os.environ.get("FLASK_ENV") != "development":
        return jsonify({"error": "Not available in production"}), 403

    user_id = session["user_id"]
    SurveyResponse.query.filter_by(user_id=user_id).delete()
    SurveySubmission.query.filter_by(user_id=user_id).delete()
    db.session.commit()
    logger.info("DEV: reset all survey data for user=%s", user_id)
    return jsonify({"message": "Survey data reset. You can now start from T1."})


# ── Admin routes ───────────────────────────────────────────────────────────────

@admin_survey_bp.route("/questions", methods=["GET"])
@admin_required
def list_questions():
    """List active questions for a form type. ?form_type=t1|t2|t3t5|t6"""
    form_type = request.args.get("form_type")
    if not form_type:
        return jsonify({"error": "form_type query param required"}), 400

    questions = (
        SurveyQuestion.query
        .filter_by(form_type=form_type, status="active")
        .order_by(SurveyQuestion.display_order)
        .all()
    )
    return jsonify({"questions": [_q_dict(q) for q in questions]})


@admin_survey_bp.route("/questions/history", methods=["GET"])
@admin_required
def list_questions_history():
    """List all questions (active and inactive) for a form type."""
    form_type = request.args.get("form_type")
    if not form_type:
        return jsonify({"error": "form_type query param required"}), 400

    questions = (
        SurveyQuestion.query
        .filter_by(form_type=form_type)
        .order_by(SurveyQuestion.status.desc(), SurveyQuestion.display_order)
        .all()
    )
    return jsonify({"questions": [_q_dict(q) for q in questions]})


@admin_survey_bp.route("/questions/<int:qid>", methods=["PUT"])
@admin_required
def edit_question(qid):
    """Edit question wording in-place (minor fixes only)."""
    q = db.session.get(SurveyQuestion, qid)
    if not q:
        return jsonify({"error": "Question not found"}), 404

    data = request.get_json() or {}
    new_text = data.get("question_text", "").strip()

    if not new_text:
        return jsonify({"error": "question_text required"}), 400

    try:
        q.question_text = new_text
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Update failed"}), 500

    return jsonify({"question": _q_dict(q)})


@admin_survey_bp.route("/questions", methods=["POST"])
@admin_required
def add_question():
    """Add a new question to a form type."""
    data = request.get_json() or {}

    form_type = data.get("form_type", "").strip()
    question_text = data.get("question_text", "").strip()
    scale_type = data.get("scale_type", "likert7").strip()
    question_number = data.get("question_number")

    if not form_type or not question_text:
        return jsonify({"error": "form_type and question_text required"}), 400

    if form_type not in ("t1", "t2", "t3t5", "t6"):
        return jsonify({"error": "form_type must be t1, t2, t3t5, or t6"}), 400

    # Place at end of current active list
    max_order = db.session.query(db.func.max(SurveyQuestion.display_order)).filter_by(
        form_type=form_type, status="active"
    ).scalar() or 0

    q = SurveyQuestion(
        form_type=form_type,
        question_number=question_number or (max_order + 1),
        question_text=question_text,
        scale_type=scale_type,
        status="active",
        display_order=max_order + 1,
    )

    try:
        db.session.add(q)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to add question"}), 500

    return jsonify({"question": _q_dict(q)}), 201


@admin_survey_bp.route("/questions/<int:qid>/deactivate", methods=["POST"])
@admin_required
def deactivate_question(qid):
    """Soft-remove a question (status → inactive). Kept in history."""
    q = db.session.get(SurveyQuestion, qid)
    if not q:
        return jsonify({"error": "Question not found"}), 404

    try:
        q.status = "inactive"
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to deactivate question"}), 500

    return jsonify({"message": f"Question {qid} deactivated.", "question": _q_dict(q)})


@admin_survey_bp.route("/questions/<int:qid>/replace", methods=["POST"])
@admin_required
def replace_question(qid):
    """
    Replace an active question with another.

    Body option A — activate an existing inactive question:
      { "activate_question_id": 42 }

    Body option B — create a brand new question as the replacement:
      { "question_text": "...", "scale_type": "likert7" }
    """
    old_q = db.session.get(SurveyQuestion, qid)
    if not old_q:
        return jsonify({"error": "Question not found"}), 404

    data = request.get_json() or {}
    activate_id = data.get("activate_question_id")

    try:
        # Deactivate the old question
        old_q.status = "inactive"

        if activate_id:
            # Reactivate an existing question from history
            new_q = db.session.get(SurveyQuestion, activate_id)
            if not new_q:
                return jsonify({"error": "Replacement question not found"}), 404
            new_q.status = "active"
            new_q.display_order = old_q.display_order
        else:
            # Create a brand new question in its place
            question_text = data.get("question_text", "").strip()
            if not question_text:
                return jsonify({"error": "activate_question_id or question_text required"}), 400
            new_q = SurveyQuestion(
                form_type=old_q.form_type,
                question_number=old_q.question_number,
                question_text=question_text,
                scale_type=data.get("scale_type", old_q.scale_type),
                status="active",
                display_order=old_q.display_order,
            )
            db.session.add(new_q)

        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Replace failed"}), 500

    return jsonify({
        "message": f"Question {qid} replaced.",
        "deactivated": _q_dict(old_q),
        "activated": _q_dict(new_q),
    })


# ── Helpers ────────────────────────────────────────────────────────────────────

def _q_dict(q):
    return {
        "id": q.id,
        "form_type": q.form_type,
        "question_number": q.question_number,
        "question_text": q.question_text,
        "scale_type": q.scale_type,
        "status": q.status,
        "display_order": q.display_order,
        "created_at": q.created_at.isoformat(),
    }


def _utcnow():
    from datetime import datetime, timezone
    return datetime.now(timezone.utc)


def _get_goal_texts(user_id, timepoint):
    """
    Return goal texts for the user.
    For T1: no prior goals — return empty list (user enters them in the form).
    For T2+: pull from T1 open-ended responses, fall back to GoalIntervention.
    """
    if timepoint == 1:
        return []

    # Try survey_responses for goal text (question_number == 0 reserved for goal text)
    # Fall back to GoalIntervention via participant_id
    user = db.session.get(User, user_id)
    if not user or not user.participant_id:
        return []

    try:
        import sqlalchemy
        with db.engine.connect() as conn:
            result = conn.execute(
                sqlalchemy.text(
                    'SELECT "GoalT1" FROM "GoalIntervention" '
                    'WHERE "ID" = :pid AND "GoalT1" IS NOT NULL AND TRIM("GoalT1") != \'\' '
                    'ORDER BY "GoalID"'
                ),
                {"pid": user.participant_id},
            )
            return [row[0].strip() for row in result.fetchall()]
    except Exception:
        logger.warning("Could not fetch goal texts for user=%s", user_id, exc_info=True)
        return []
