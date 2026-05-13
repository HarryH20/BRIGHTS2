import logging
import os
from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, session

from models import (
    db, User, SurveyQuestion, SurveySubmission, SurveyResponse,
    TemplateQuestion, Enrollment, DataQualityFlag, QualityCheckRun,
    FlagThresholdConfig, ConsentForm, ConsentFormRevision, ParticipantConsent,
)
from routes.auth import login_required, admin_required
from cache import invalidate_user_chart_cache
from analysis.data_quality import run_quality_checks, DEFAULT_THRESHOLDS

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
      { "status": "not_enrolled" }  — no active round assigned
      { "status": "round_closed", "round_label": "...", "message": "..." }
      { "status": "locked", "next_unlocks_at": <iso>, "timepoint": N }
      { "status": "complete" }   — all timepoints done
      { "status": "due", "timepoint": N, "form_type": "...",
        "goals": [...], "questions": [...] }
    """
    user_id = session["user_id"]
    user = db.session.get(User, user_id)

    # Step 1 — Check active_round_id
    active_round = user.active_round if user else None

    if active_round is None:
        return jsonify({
            "status": "not_enrolled",
            "message": "You are not currently enrolled in an active study. Contact your researcher if you believe this is an error.",
        })

    if active_round.status not in ("enrolling", "active"):
        return jsonify({
            "status": "round_closed",
            "round_label": active_round.round_label or f"Round {active_round.round_number}",
            "message": "This study round has ended. Your data has been saved.",
        })

    # Step 2 — Determine question source
    tq_count = TemplateQuestion.query.filter_by(
        template_id=active_round.template_id, status="active"
    ).count()
    use_template_questions = tq_count > 0

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

    # Step 3 — Serve from template_questions
    if use_template_questions:
        # Filter timepoints in Python — avoids dialect-specific ARRAY operators
        questions = [
            q for q in (
                TemplateQuestion.query
                .filter(
                    TemplateQuestion.template_id == active_round.template_id,
                    TemplateQuestion.status == "active",
                )
                .order_by(TemplateQuestion.display_order)
                .all()
            )
            if next_tp in (q.timepoints or [])
        ]

        goals = _get_goal_texts(user_id, next_tp)

        return jsonify({
            "status": "due",
            "timepoint": next_tp,
            "form_type": form_type,
            "goals": goals,
            "round_id": active_round.id,
            "round_label": active_round.round_label or f"Round {active_round.round_number}",
            "template_name": active_round.template.name if active_round.template else None,
            "questions": [
                {
                    "id": q.id,
                    "question_number": q.display_order,
                    "question_text": q.question_text,
                    "scale_type": q.scale_type,
                    "display_order": q.display_order,
                }
                for q in questions
            ],
        })

    # Step 4 — Fallback: existing survey_questions logic (backward compatible)
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
    user = db.session.get(User, user_id)

    if not data:
        return jsonify({"error": "Request body required"}), 400

    timepoint = data.get("timepoint")
    responses = data.get("responses", [])
    started_at = data.get("started_at")

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

    # Find active enrollment for round tracking
    enrollment = None
    if user and user.active_round_id:
        enrollment = Enrollment.query.filter_by(
            user_id=user_id,
            round_id=user.active_round_id,
            status="active",
        ).first()

    next_unlocks = None
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
                round_id=user.active_round_id if user else None,
                enrollment_id=enrollment.id if enrollment else None,
            ))

        # Record submission + set next unlock date (7 days), NULL for T6
        next_unlocks = _utcnow() + timedelta(days=7) if timepoint < 6 else None
        submission = SurveySubmission(
            user_id=user_id,
            timepoint=timepoint,
            next_unlocks_at=next_unlocks,
            round_id=user.active_round_id if user else None,
            enrollment_id=enrollment.id if enrollment else None,
        )
        db.session.add(submission)

        db.session.commit()
        logger.info("Survey T%s submitted: user=%s responses=%s", timepoint, user_id, len(responses))
        invalidate_user_chart_cache(user_id)
        invalidate_user_chart_cache("admin")

    except Exception:
        db.session.rollback()
        logger.error("Survey submit failed: user=%s T%s", user_id, timepoint, exc_info=True)
        return jsonify({"error": "Failed to save survey"}), 500

    # ── Post-submit quality checks (advisory only — never blocks or alters submission) ──
    try:
        quality_responses = []
        for r in responses:
            qid = r.get("question_id")
            if not qid:
                continue
            q = db.session.get(SurveyQuestion, qid)
            if not q:
                q = db.session.get(TemplateQuestion, qid)
            if not q:
                continue
            quality_responses.append({
                "question_id": qid,
                "scale_type": q.scale_type,
                "response_value": r.get("response_value"),
            })

        completion_seconds = None
        if started_at:
            try:
                started = datetime.fromisoformat(started_at.replace("Z", "+00:00"))
                now_utc = _utcnow()
                if started.tzinfo is not None:
                    from datetime import timezone
                    now_utc = datetime.now(timezone.utc)
                completion_seconds = (now_utc - started).total_seconds()
                if completion_seconds < 0:
                    completion_seconds = None
            except (ValueError, TypeError):
                pass

        active_thresholds = DEFAULT_THRESHOLDS
        if user and user.active_round_id:
            config_rows = (
                FlagThresholdConfig.query
                .filter_by(round_id=user.active_round_id)
                .order_by(FlagThresholdConfig.effective_from.asc())
                .all()
            )
            if config_rows:
                merged = {}
                for row in config_rows:
                    merged[row.flag_type] = row.thresholds
                active_thresholds = merged

        qc_result = run_quality_checks(
            submission_id=submission.id,
            responses=quality_responses,
            completion_seconds=completion_seconds,
            thresholds=active_thresholds,
        )

        for flag in qc_result["flags"]:
            db.session.add(DataQualityFlag(
                user_id=user_id,
                round_id=user.active_round_id if user else None,
                submission_id=submission.id,
                flag_type=flag["flag_type"],
                severity=flag["severity"],
                detail=flag["detail"],
                auto_generated=True,
                is_resolved=False,
                justification="",
            ))

        db.session.add(QualityCheckRun(
            submission_id=submission.id,
            round_id=user.active_round_id if user else None,
            triggered_by="auto_post_submit",
            config_snapshot=active_thresholds,
            code_version="1.0",
            flags_created=len(qc_result["flags"]),
            duration_ms=qc_result["duration_ms"],
        ))
        db.session.commit()

    except Exception as e:
        logger.error("Quality check failed for submission %s: %s", submission.id, str(e))

    # After successful commit, check if all timepoints are complete and update enrollment
    if enrollment and user and user.active_round_id:
        completed_count = SurveySubmission.query.filter_by(user_id=user_id).count()
        active_round = user.active_round
        max_weeks = 6
        if active_round and active_round.template:
            max_weeks = active_round.template.num_weeks
        if completed_count >= max_weeks:
            try:
                enrollment.status = "completed"
                enrollment.completed_at = _utcnow()
                user.active_round_id = None
                db.session.commit()
            except Exception:
                db.session.rollback()
                logger.error("Failed to complete enrollment for user=%s", user_id, exc_info=True)

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


@admin_survey_bp.route("/questions/<int:qid>/reactivate", methods=["POST"])
@admin_required
def reactivate_question(qid):
    """
    Reactivate an inactive question, placing it at the end of the active list
    for its form_type.
    """
    q = db.session.get(SurveyQuestion, qid)
    if not q:
        return jsonify({"error": "Question not found"}), 404

    if q.status == "active":
        return jsonify({"error": "Question is already active"}), 400

    max_order = (
        db.session.query(db.func.max(SurveyQuestion.display_order))
        .filter_by(form_type=q.form_type, status="active")
        .scalar() or 0
    )

    try:
        q.status = "active"
        q.display_order = max_order + 1
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Reactivate failed"}), 500

    return jsonify({"question": _q_dict(q)})


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
    return datetime.now(timezone.utc)


# ── Participant consent routes ─────────────────────────────────────────────────

@survey_bp.route("/consent/pending", methods=["GET"])
@login_required
def get_pending_consent():
    """
    Return the active consent form if the logged-in user hasn't accepted it yet.
    Returns { "consent": null } if no action is needed.
    """
    user_id = session["user_id"]
    user = db.session.get(User, user_id)

    if not user or not user.active_round_id:
        return jsonify({"consent": None})

    active_round = user.active_round
    if not active_round or active_round.status not in ("enrolling", "active"):
        return jsonify({"consent": None})

    consent = ConsentForm.query.filter_by(
        study_id=active_round.study_id, is_active=True
    ).first()
    if not consent:
        return jsonify({"consent": None})

    already = ParticipantConsent.query.filter_by(
        user_id=user_id, consent_form_id=consent.id
    ).first()
    if already:
        return jsonify({"consent": None})

    revision = (
        ConsentFormRevision.query
        .filter_by(consent_form_id=consent.id)
        .order_by(ConsentFormRevision.created_at.desc())
        .first()
    )
    if not revision:
        return jsonify({"consent": None})

    return jsonify({
        "consent": {
            "form_id": consent.id,
            "revision_id": revision.id,
            "title": consent.title,
            "version": revision.version,
            "body_markdown": revision.body_markdown,
        }
    })


@survey_bp.route("/consent/accept", methods=["POST"])
@login_required
def accept_consent():
    """
    POST /api/survey/consent/accept — Record participant's consent.
    Body: { form_id, revision_id }
    """
    user_id = session["user_id"]
    user = db.session.get(User, user_id)
    data = request.get_json() or {}

    form_id = data.get("form_id")
    revision_id = data.get("revision_id")

    if not form_id:
        return jsonify({"error": "form_id required"}), 400

    consent_form = db.session.get(ConsentForm, form_id)
    if not consent_form or not consent_form.is_active:
        return jsonify({"error": "Consent form not found or inactive"}), 404

    existing = ParticipantConsent.query.filter_by(
        user_id=user_id, consent_form_id=form_id
    ).first()
    if existing:
        return jsonify({"status": "already_accepted"}), 200

    now = datetime.now(timezone.utc)
    pc = ParticipantConsent(
        user_id=user_id,
        consent_form_id=form_id,
        round_id=user.active_round_id if user else None,
        consented_at=now,
        ip_address=(request.remote_addr or "")[:50],
        user_agent=request.headers.get("User-Agent", "")[:200],
        consent_form_revision_id=revision_id,
        signature_method="checkbox",
        signature_meaning=data.get("signature_meaning", "I consent to participate in this research study"),
    )

    try:
        db.session.add(pc)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to record consent: user=%s form=%s", user_id, form_id, exc_info=True)
        return jsonify({"error": "Failed to record consent"}), 500

    logger.info("Consent accepted: user=%s form=%s revision=%s", user_id, form_id, revision_id)
    return jsonify({"status": "accepted"}), 201


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
