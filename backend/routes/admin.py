import logging
import importlib

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func
from models import AuditLog, Enrollment, SessionLog, Study, StudyRound, StudyTemplate, TemplateQuestion, User, db
from routes.auth import admin_required

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/roseplot", methods=["GET"])
@admin_required
def admin_roseplot():
    """
    GET /api/admin/roseplot?user_id=all|<id>&goal_id=all|1|2|3&weeks=all|2-6|4-6|...
    Returns the same Plotly figure dict format as /api/visualizations/roseplot,
    but aggregated across all users by default.
    """
    try:
        admin_mod = importlib.import_module("analysis.admin_roseplot")
        rose_mod = importlib.import_module("analysis.roseplot")

        data = admin_mod.fetch_data(
            db.engine,
            user_id=request.args.get("user_id"),
            goal_id=request.args.get("goal_id"),
            weeks=request.args.get("weeks"),
        )
        fig_dict = rose_mod.build_figure(data)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin roseplot", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500

@admin_bp.route("/divergingstackedbarchart", methods=["GET"])
@admin_required
def admin_divergingstackedbarchart():
    """
    GET /api/admin/divergingstackedbarchart?user_id=all|<id>&goals=1,2,3&weeks=2,3,4,5,6
    Returns the Plotly figure dict. Aggregates all users by default.
    """
    try:
        chart_mod = importlib.import_module("analysis.admin_divergingstackedbarchart")

        data = chart_mod.fetch_data(
            engine=db.engine,
            user_id=request.args.get("user_id", "all"),
            goals=request.args.get("goals", "1,2,3"),
            weeks=request.args.get("weeks", "2,3,4,5,6"),
        )
        fig_dict = chart_mod.build_figure(data)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin diverging stacked bar chart", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500


# =============================================================================
# GET /api/admin/stats — Dashboard overview cards
# =============================================================================
@admin_bp.route("/stats", methods=["GET"])
@admin_required
def stats():
    now = datetime.now(timezone.utc)
    since_24h = now - timedelta(hours=24)

    total_users = db.session.query(func.count(User.id)).scalar()
    total_admins = db.session.query(func.count(User.id)).filter(User.role == "admin").scalar()
    active_sessions = db.session.query(func.count(SessionLog.id)).filter(SessionLog.logout_at.is_(None)).scalar()

    failed_logins_24h = (
        db.session.query(func.count(AuditLog.id))
        .filter(AuditLog.event_type == AuditLog.LOGIN_FAILED, AuditLog.timestamp >= since_24h)
        .scalar()
    )
    lockouts_24h = (
        db.session.query(func.count(AuditLog.id))
        .filter(AuditLog.event_type == AuditLog.ACCOUNT_LOCKED, AuditLog.timestamp >= since_24h)
        .scalar()
    )
    unauthorized_24h = (
        db.session.query(func.count(AuditLog.id))
        .filter(AuditLog.event_type == AuditLog.UNAUTHORIZED_ACCESS, AuditLog.timestamp >= since_24h)
        .scalar()
    )
    registrations_24h = (
        db.session.query(func.count(AuditLog.id))
        .filter(AuditLog.event_type == AuditLog.REGISTER, AuditLog.timestamp >= since_24h)
        .scalar()
    )

    avg_duration = db.session.query(func.avg(SessionLog.duration_seconds)).filter(SessionLog.duration_seconds.isnot(None)).scalar()

    return jsonify({
        "total_users": total_users,
        "total_admins": total_admins,
        "active_sessions": active_sessions,
        "failed_logins_24h": failed_logins_24h,
        "lockouts_24h": lockouts_24h,
        "unauthorized_access_24h": unauthorized_24h,
        "registrations_24h": registrations_24h,
        "avg_session_duration_seconds": round(avg_duration, 1) if avg_duration else None,
    }), 200


# =============================================================================
# GET /api/admin/audit-log — Paginated event feed
# =============================================================================
@admin_bp.route("/audit-log", methods=["GET"])
@admin_required
def audit_log():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)

    query = AuditLog.query

    event_type = request.args.get("event_type")
    if event_type:
        query = query.filter(AuditLog.event_type == event_type)

    user_id = request.args.get("user_id", type=int)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)

    ip = request.args.get("ip")
    if ip:
        query = query.filter(AuditLog.ip_address == ip)

    total = query.count()
    entries = query.order_by(AuditLog.timestamp.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "entries": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "event_type": e.event_type,
                "detail": e.detail,
                "ip_address": e.ip_address,
                "user_agent": e.user_agent,
                "request_id": e.request_id,
                "timestamp": e.timestamp.isoformat() if e.timestamp else None,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200


# =============================================================================
# GET /api/admin/sessions — Session history
# =============================================================================
@admin_bp.route("/sessions", methods=["GET"])
@admin_required
def sessions():
    page = request.args.get("page", 1, type=int)
    per_page = request.args.get("per_page", 50, type=int)
    per_page = min(per_page, 100)

    query = SessionLog.query

    user_id = request.args.get("user_id", type=int)
    if user_id:
        query = query.filter(SessionLog.user_id == user_id)

    active = request.args.get("active")
    if active and active.lower() == "true":
        query = query.filter(SessionLog.logout_at.is_(None))

    total = query.count()
    entries = query.order_by(SessionLog.login_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return jsonify({
        "entries": [
            {
                "id": e.id,
                "user_id": e.user_id,
                "login_at": e.login_at.isoformat() if e.login_at else None,
                "logout_at": e.logout_at.isoformat() if e.logout_at else None,
                "duration_seconds": e.duration_seconds,
                "ip_address": e.ip_address,
                "user_agent": e.user_agent,
            }
            for e in entries
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }), 200


# =============================================================================
# GET /api/admin/users — User list with status
# =============================================================================
@admin_bp.route("/users", methods=["GET"])
@admin_required
def users():
    all_users = User.query.order_by(User.id).all()

    return jsonify({
        "users": [
            {
                "id": u.id,
                "username": u.username,
                "email": u.email,
                "role": u.role,
                "created_at": u.created_at.isoformat() if u.created_at else None,
                "last_login": u.last_login.isoformat() if u.last_login else None,
                "failed_attempts": u.failed_attempts,
                "locked_until": u.locked_until.isoformat() if u.locked_until else None,
            }
            for u in all_users
        ],
    }), 200


# =============================================================================
# GET /api/admin/stats/activity — Time-series data for charts
# =============================================================================
@admin_bp.route("/stats/activity", methods=["GET"])
@admin_required
def stats_activity():
    days = request.args.get("days", 7, type=int)
    days = min(days, 90)

    now = datetime.now(timezone.utc)
    start = now - timedelta(days=days)

    # Query audit log entries in the window
    entries = (
        AuditLog.query
        .filter(AuditLog.timestamp >= start)
        .all()
    )

    # Build daily buckets
    daily = {}
    for i in range(days):
        day = (start + timedelta(days=i)).strftime("%Y-%m-%d")
        daily[day] = {"date": day, "logins": 0, "failures": 0, "registrations": 0, "logouts": 0}

    for e in entries:
        day = e.timestamp.strftime("%Y-%m-%d")
        if day not in daily:
            continue
        if e.event_type == AuditLog.LOGIN_SUCCESS:
            daily[day]["logins"] += 1
        elif e.event_type == AuditLog.LOGIN_FAILED:
            daily[day]["failures"] += 1
        elif e.event_type == AuditLog.REGISTER:
            daily[day]["registrations"] += 1
        elif e.event_type == AuditLog.LOGOUT:
            daily[day]["logouts"] += 1

    # Return sorted by date
    activity = sorted(daily.values(), key=lambda d: d["date"])

    return jsonify({"days": days, "activity": activity}), 200


@admin_bp.route("/ageplot", methods=["GET"])
@admin_required
def admin_ageplot():
    """
    GET /api/admin/ageplot
    Returns the Plotly figure dict for the admin-only age distribution chart.
    """
    try:
        age_mod = importlib.import_module("analysis.ageplot")

        data = age_mod.fetch_data(db.engine, **request.args)
        fig_dict = age_mod.build_figure(data)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin ageplot", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500


@admin_bp.route("/alluvial", methods=["GET"])
@admin_required
def admin_alluvial():
    """
    GET /api/admin/alluvial
    Returns the Plotly/Sankey payload for the admin-only alluvial chart.
    """
    try:
        alluvial_mod = importlib.import_module("analysis.adminalluvial")

        fig_dict = alluvial_mod.build_figure(db.engine)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin alluvial chart", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500


@admin_bp.route("/linguisticmarkersplot", methods=["GET"])
@admin_required
def admin_linguisticmarkersplot():
    """
    GET /api/admin/linguisticmarkersplot
    Returns the Plotly figure dict for the admin-only linguistic markers plot.
    """
    try:
        linguistic_mod = importlib.import_module("analysis.linguisticmarkersplot")

        fig_dict = linguistic_mod.build_figure(db.engine)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin linguistic markers plot", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500


@admin_bp.route("/linguisticmarkerswordcloud", methods=["GET"])
@admin_required
def admin_linguisticmarkerswordcloud():
    """
    GET /api/admin/linguisticmarkerswordcloud
    Returns the Plotly figure dict for the admin-only linguistic markers word cloud.
    """
    try:
        wc_mod = importlib.import_module("analysis.linguisticmarkerswordcloud")

        fig_dict = wc_mod.build_figure(db.engine)
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin linguistic markers word cloud", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500

# =============================================================================
# GET /api/admin/demographics — User Profile (per-user demographics)
# =============================================================================
@admin_bp.route("/demographics", methods=["GET"])
@admin_required
def admin_userprofile():
    try:
        profile_mod = importlib.import_module("analysis.admin_userprofile")
        data = profile_mod.fetch_data(db.engine, user_id=request.args.get("user_id", "all"))
        fig = profile_mod.build_figure(data["all_rows"], data.get("single_row"), data.get("user_id"))
        return jsonify(fig), 200
    except ValueError as e:
        return jsonify({"error": str(e)}), 404
    except Exception as e:
        logger.error("USER PROFILE ERROR", exc_info=True)
        return jsonify({"error": str(e)}), 500

@admin_bp.route("/demographic-barchart", methods=["GET"])
@admin_required
def admin_demographic_barchart():
    """
    GET /api/admin/demographic-barchart?demo_label=Gender&group_val=Female&timepoint=1&question_key=Q1
    Returns the Plotly figure dict for the admin demographic bar chart.
    """
    try:
        demo_mod = importlib.import_module("analysis.admin_demographic_barchart")

        data = demo_mod.fetch_data(db.engine)
        fig_dict = demo_mod.build_figure(
            data,
            demo_label=request.args.get("demo_label", "Gender"),
            group_val=request.args.get("group_val", "Female"),
            timepoint=request.args.get("timepoint", 1),
            question_key=request.args.get("question_key", "Q1"),
        )
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin demographic bar chart", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500

@admin_bp.route("/counts-demographics", methods=["GET"])
@admin_required
def admin_counts_demographics():
    """
    GET /api/admin/counts-demographics?demo_label=Gender
    Returns the Plotly figure dict for participant counts by demographic group.
    """
    try:
        demo_mod = importlib.import_module("analysis.admin_counts_demographics")

        data = demo_mod.fetch_data(db.engine)
        fig_dict = demo_mod.build_figure(
            data,
            demo_label=request.args.get("demo_label", "Gender"),
        )
        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate admin counts demographics chart", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500

@admin_bp.route("/attrition-funnel", methods=["GET"])
@admin_required
def admin_attrition_funnel():
    """
    GET /api/admin/attrition-funnel?demo_key=Gender&grp_name=Female
    Returns the Plotly figure dict for participant attrition funnel.
    """
    try:
        mod = importlib.import_module("analysis.admin_attrition_funnel")

        fig_dict = mod.build_figure(
            db.engine,
            demo_key=request.args.get("demo_key", "Overall"),
            grp_name=request.args.get("grp_name", "All Participants"),
        )

        return jsonify(fig_dict), 200
    except Exception:
        logger.error("Failed to generate attrition funnel", exc_info=True)
        return jsonify({"error": "Failed to generate admin visualization"}), 500


# =============================================================================
# Rounds management
# =============================================================================

_VALID_ROUND_TRANSITIONS = {
    "draft": "enrolling",
    "enrolling": "active",
    "active": "closed",
    "closed": "archived",
}


@admin_bp.route("/rounds", methods=["GET"])
@admin_required
def get_rounds():
    """GET /api/admin/rounds — all rounds for the brights2 study, newest first."""
    study = Study.query.filter_by(study_key="brights2").first()
    if not study:
        return jsonify({"rounds": []}), 200

    rounds = (
        StudyRound.query
        .filter_by(study_id=study.id)
        .order_by(StudyRound.round_number.desc())
        .all()
    )
    result = []
    for r in rounds:
        participant_count = Enrollment.query.filter_by(round_id=r.id, status="active").count()
        completion_count = Enrollment.query.filter_by(round_id=r.id, status="completed").count()
        result.append({
            **r.to_dict(),
            "template": {
                "id": r.template.id,
                "name": r.template.name,
                "template_key": r.template.template_key,
            } if r.template else None,
            "participant_count": participant_count,
            "completion_count": completion_count,
        })
    return jsonify({"rounds": result}), 200


@admin_bp.route("/rounds", methods=["POST"])
@admin_required
def create_round():
    """POST /api/admin/rounds — create a new draft round for the brights2 study."""
    data = request.get_json() or {}
    study = Study.query.filter_by(study_key="brights2").first()
    if not study:
        return jsonify({"error": "Study not found"}), 404

    max_num = (
        db.session.query(func.max(StudyRound.round_number))
        .filter_by(study_id=study.id)
        .scalar() or 0
    )

    round_ = StudyRound(
        study_id=study.id,
        template_id=data.get("template_id"),
        round_number=max_num + 1,
        round_label=data.get("round_label"),
        enrollment_opens_at=data.get("enrollment_opens_at"),
        data_collection_ends_at=data.get("data_collection_ends_at"),
        status="draft",
    )
    try:
        db.session.add(round_)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create round", exc_info=True)
        return jsonify({"error": "Failed to create round"}), 500

    return jsonify(round_.to_dict()), 201


@admin_bp.route("/rounds/<int:round_id>/status", methods=["PATCH"])
@admin_required
def update_round_status(round_id):
    """PATCH /api/admin/rounds/<id>/status — advance round through lifecycle."""
    data = request.get_json() or {}
    new_status = data.get("status", "").strip()

    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    allowed_next = _VALID_ROUND_TRANSITIONS.get(round_.status)
    if new_status != allowed_next:
        return jsonify({
            "error": f"Invalid transition: {round_.status} → {new_status}. Expected: {allowed_next}"
        }), 400

    try:
        old_status = round_.status
        round_.status = new_status
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="ROUND_STATUS_CHANGE",
            detail=f"Round {round_id}: {old_status} → {new_status}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to update round status round=%s", round_id, exc_info=True)
        return jsonify({"error": "Failed to update status"}), 500

    return jsonify(round_.to_dict()), 200


# =============================================================================
# Enrollment management
# =============================================================================


@admin_bp.route("/rounds/<int:round_id>/enrollments", methods=["GET"])
@admin_required
def get_enrollments(round_id):
    """GET /api/admin/rounds/<id>/enrollments — list enrollments with user details."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    status_filter = request.args.get("status", "all")
    query = Enrollment.query.filter_by(round_id=round_id)
    if status_filter != "all":
        query = query.filter(Enrollment.status == status_filter)

    enrollments = query.all()
    result = []
    for e in enrollments:
        user = db.session.get(User, e.user_id)
        result.append({
            "id": e.id,
            "status": e.status,
            "enrolled_at": e.enrolled_at.isoformat() if e.enrolled_at else None,
            "completed_at": e.completed_at.isoformat() if e.completed_at else None,
            "user": {
                "id": user.id,
                "username": user.username,
                "display_name": user.display_name,
                "email": user.email,
                "participant_id": user.participant_id,
            } if user else None,
        })
    return jsonify({"enrollments": result}), 200


@admin_bp.route("/rounds/<int:round_id>/enrollments", methods=["POST"])
@admin_required
def create_enrollment(round_id):
    """POST /api/admin/rounds/<id>/enrollments — enroll one or many users."""
    data = request.get_json() or {}
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    user_ids = data.get("user_ids") or (
        [data["user_id"]] if data.get("user_id") else []
    )
    if not user_ids:
        return jsonify({"error": "user_id or user_ids required"}), 400

    enrolled, skipped, errors = [], [], []

    for uid in user_ids:
        existing = Enrollment.query.filter_by(user_id=uid, status="active").first()
        if existing:
            current = db.session.get(StudyRound, existing.round_id)
            errors.append({
                "user_id": uid,
                "reason": "User already has an active enrollment",
                "current_round": (
                    current.round_label or f"Round {current.round_number}"
                ) if current else None,
            })
            skipped.append(uid)
            continue

        try:
            enrollment = Enrollment(user_id=uid, round_id=round_id, status="active")
            db.session.add(enrollment)
            user = db.session.get(User, uid)
            if user:
                user.active_round_id = round_id
            db.session.commit()
            enrolled.append(uid)
        except Exception:
            db.session.rollback()
            logger.error("Failed to enroll user=%s in round=%s", uid, round_id, exc_info=True)
            errors.append({"user_id": uid, "reason": "Database error"})

    return jsonify({"enrolled": enrolled, "skipped": skipped, "errors": errors}), 201


@admin_bp.route("/rounds/<int:round_id>/enrollments/<int:enrollment_id>", methods=["DELETE"])
@admin_required
def withdraw_enrollment(round_id, enrollment_id):
    """DELETE /api/admin/rounds/<id>/enrollments/<id> — soft-withdraw a participant."""
    enrollment = db.session.get(Enrollment, enrollment_id)
    if not enrollment or enrollment.round_id != round_id:
        return jsonify({"error": "Enrollment not found"}), 404

    try:
        now = datetime.now(timezone.utc)
        enrollment.status = "withdrawn"
        enrollment.withdrawn_at = now
        user = db.session.get(User, enrollment.user_id)
        if user and user.active_round_id == round_id:
            user.active_round_id = None
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="ENROLLMENT_WITHDRAWN",
            detail=f"Enrollment {enrollment_id} withdrawn from round {round_id} for user {enrollment.user_id}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to withdraw enrollment=%s", enrollment_id, exc_info=True)
        return jsonify({"error": "Failed to withdraw enrollment"}), 500

    return jsonify({"success": True}), 200


@admin_bp.route(
    "/rounds/<int:round_id>/enrollments/<int:enrollment_id>/complete",
    methods=["POST"],
)
@admin_required
def complete_enrollment(round_id, enrollment_id):
    """POST /api/admin/rounds/<id>/enrollments/<id>/complete — researcher-initiated completion."""
    enrollment = db.session.get(Enrollment, enrollment_id)
    if not enrollment or enrollment.round_id != round_id:
        return jsonify({"error": "Enrollment not found"}), 404

    try:
        now = datetime.now(timezone.utc)
        enrollment.status = "completed"
        enrollment.completed_at = now
        user = db.session.get(User, enrollment.user_id)
        if user and user.active_round_id == round_id:
            user.active_round_id = None
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to complete enrollment=%s", enrollment_id, exc_info=True)
        return jsonify({"error": "Failed to complete enrollment"}), 500

    return jsonify({
        "id": enrollment.id,
        "status": enrollment.status,
        "completed_at": enrollment.completed_at.isoformat() if enrollment.completed_at else None,
        "user_id": enrollment.user_id,
        "round_id": enrollment.round_id,
    }), 200


# =============================================================================
# Template management
# =============================================================================


@admin_bp.route("/templates", methods=["GET"])
@admin_required
def get_templates():
    """GET /api/admin/templates — all study templates, presets first."""
    templates = (
        StudyTemplate.query
        .order_by(StudyTemplate.is_preset.desc(), StudyTemplate.created_at.desc())
        .all()
    )
    result = []
    for t in templates:
        question_count = TemplateQuestion.query.filter_by(
            template_id=t.id, status="active"
        ).count()
        d = t.to_dict()
        d["question_count"] = question_count
        result.append(d)
    return jsonify({"templates": result}), 200


@admin_bp.route("/templates/<int:template_id>/questions", methods=["GET"])
@admin_required
def get_template_questions(template_id):
    """GET /api/admin/templates/<id>/questions — all questions for a template."""
    template = db.session.get(StudyTemplate, template_id)
    if not template:
        return jsonify({"error": "Template not found"}), 404

    questions = (
        TemplateQuestion.query
        .filter_by(template_id=template_id)
        .order_by(TemplateQuestion.display_order)
        .all()
    )
    return jsonify({
        "questions": [
            {
                "id": q.id,
                "variable_name": q.variable_name,
                "question_text": q.question_text,
                "scale_type": q.scale_type,
                "timepoints": q.timepoints,
                "scope": q.scope,
                "display_order": q.display_order,
                "is_required": q.is_required,
                "config": q.config,
                "status": q.status,
            }
            for q in questions
        ]
    }), 200
