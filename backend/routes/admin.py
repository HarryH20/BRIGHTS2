import hashlib
import importlib
import logging
import string
import secrets

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request, session
from sqlalchemy import func

import json
import numpy as np

from models import (
    AuditLog, AllocationLog, AllocationSequence, ConditionAssignmentStrategy,
    DataQualityFlag, Enrollment, FlagThresholdConfig,
    Notification, NotificationDeliveryLog, NotificationPreference,
    QualityCheckRun,
    ResearcherInvitation, ResearcherRole,
    SessionLog, Study, StudyCondition, StudyRound, StudyTemplate,
    SurveySubmission, TemplateQuestion, User, db,
    ConsentForm, ConsentFormRevision, ParticipantConsent,
)
from routes.auth import admin_required

logger = logging.getLogger(__name__)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _generate_join_code():
    """Generate an 8-character uppercase alphanumeric join code."""
    alphabet = string.ascii_uppercase + string.digits
    return "".join(secrets.choice(alphabet) for _ in range(8))


def _build_public_url(path):
    """
    Build a public-facing URL.
    Uses APP_PUBLIC_URL env var if set, otherwise reconstructs from
    X-Forwarded-Host header (set by nginx), falling back to request.host_url.
    """
    import os as _os
    base = _os.environ.get("APP_PUBLIC_URL", "").rstrip("/")
    if not base:
        forwarded_host = request.headers.get("X-Forwarded-Host")
        forwarded_proto = request.headers.get("X-Forwarded-Proto", "http")
        if forwarded_host:
            base = f"{forwarded_proto}://{forwarded_host}"
        else:
            base = request.host_url.rstrip("/")
    return f"{base}/{path.lstrip('/')}"

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
# Study metadata
# =============================================================================

@admin_bp.route("/study", methods=["GET"])
@admin_required
def get_study():
    """GET /api/admin/study — brights2 study metadata for admin UI."""
    study = Study.query.filter_by(study_key="brights2").first()
    if not study:
        return jsonify(None), 200
    return jsonify({
        "id": study.id,
        "title": study.study_name,
        "study_code": study.study_key,
        "status": study.status,
        "start_date": None,
        "end_date": None,
        "description": study.description,
    }), 200


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
        join_code=_generate_join_code(),
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


# =============================================================================
# Researcher role management
# =============================================================================

_VALID_RESEARCHER_ROLES = {"pi", "research_assistant", "data_manager", "observer"}


def _brights2_study():
    return Study.query.filter_by(study_key="brights2").first()


@admin_bp.route("/researchers", methods=["GET"])
@admin_required
def get_researchers():
    """GET /api/admin/researchers — all active researcher roles for the brights2 study."""
    study = _brights2_study()
    if not study:
        return jsonify({"researchers": []}), 200

    rows = (
        ResearcherRole.query
        .filter_by(study_id=study.id, revoked_at=None)
        .order_by(ResearcherRole.granted_at.desc())
        .all()
    )
    result = []
    for r in rows:
        user = db.session.get(User, r.user_id)
        result.append({
            "id": r.id,
            "role": r.role,
            "granted_at": r.granted_at.isoformat() if r.granted_at else None,
            "last_access_at": r.last_access_at.isoformat() if r.last_access_at else None,
            "citi_completion_date": r.citi_completion_date.isoformat() if r.citi_completion_date else None,
            "notes": r.notes,
            "user": {
                "id": user.id,
                "username": user.username,
                "email": user.email,
                "display_name": user.display_name,
            } if user else None,
        })
    return jsonify({"researchers": result}), 200


@admin_bp.route("/researchers/invite", methods=["POST"])
@admin_required
def invite_researcher():
    """POST /api/admin/researchers/invite — generate a single-use invite link."""
    data = request.get_json() or {}
    role = data.get("role", "").strip()
    expires_hours = int(data.get("expires_hours", 72))

    if role not in _VALID_RESEARCHER_ROLES:
        return jsonify({"error": f"Invalid role. Must be one of: {sorted(_VALID_RESEARCHER_ROLES)}"}), 400

    study = _brights2_study()
    if not study:
        return jsonify({"error": "Study not found"}), 404

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()

    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=expires_hours)

    try:
        inv = ResearcherInvitation(
            study_id=study.id,
            role=role,
            token_hash=token_hash,
            created_by=session.get("user_id"),
            expires_at=expires_at,
            max_uses=1,
            uses=0,
        )
        db.session.add(inv)
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="RESEARCHER_INVITE_CREATED",
            detail=f"role={role} expires={expires_at.isoformat()}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create researcher invitation", exc_info=True)
        return jsonify({"error": "Failed to create invitation"}), 500

    invite_url = _build_public_url(f"researcher/join/{raw_token}")
    return jsonify({
        "invite_url": invite_url,
        "role": role,
        "expires_at": expires_at.isoformat(),
    }), 201


@admin_bp.route("/researchers/<int:role_id>", methods=["DELETE"])
@admin_required
def revoke_researcher(role_id):
    """DELETE /api/admin/researchers/<id> — soft-revoke a researcher role."""
    role_row = db.session.get(ResearcherRole, role_id)
    if not role_row:
        return jsonify({"error": "Role not found"}), 404

    try:
        now = datetime.now(timezone.utc)
        role_row.revoked_at = now
        role_row.revoked_by = session.get("user_id")
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="RESEARCHER_ROLE_REVOKED",
            detail=f"ResearcherRole {role_id} user={role_row.user_id} role={role_row.role}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to revoke researcher role=%s", role_id, exc_info=True)
        return jsonify({"error": "Failed to revoke role"}), 500

    return jsonify({"success": True}), 200


@admin_bp.route("/researchers/invitations", methods=["GET"])
@admin_required
def get_researcher_invitations():
    """GET /api/admin/researchers/invitations — active (non-expired, non-revoked) invitations."""
    study = _brights2_study()
    if not study:
        return jsonify({"invitations": []}), 200

    now = datetime.now(timezone.utc)
    rows = ResearcherInvitation.query.filter_by(study_id=study.id, revoked_at=None).all()
    active = []
    for inv in rows:
        exp = inv.expires_at
        if exp.tzinfo is None:
            exp = exp.replace(tzinfo=timezone.utc)
        if exp > now and inv.uses < inv.max_uses:
            active.append({
                "id": inv.id,
                "role": inv.role,
                "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
                "uses": inv.uses,
                "max_uses": inv.max_uses,
                "created_at": inv.created_at.isoformat() if inv.created_at else None,
            })
    return jsonify({"invitations": active}), 200


@admin_bp.route("/researchers/invitations/<int:inv_id>", methods=["DELETE"])
@admin_required
def revoke_researcher_invitation(inv_id):
    """DELETE /api/admin/researchers/invitations/<id> — revoke a pending invitation."""
    inv = db.session.get(ResearcherInvitation, inv_id)
    if not inv:
        return jsonify({"error": "Invitation not found"}), 404

    try:
        inv.revoked_at = datetime.now(timezone.utc)
        inv.revoked_by = session.get("user_id")
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="RESEARCHER_INVITE_REVOKED",
            detail=f"ResearcherInvitation {inv_id} role={inv.role}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to revoke researcher invitation=%s", inv_id, exc_info=True)
        return jsonify({"error": "Failed to revoke invitation"}), 500

    return jsonify({"success": True}), 200


# =============================================================================
# Consent management admin routes
# =============================================================================

@admin_bp.route("/consent/forms", methods=["GET"])
@admin_required
def get_consent_forms():
    """GET /api/admin/consent/forms — all consent forms for the brights2 study."""
    study_key = request.args.get("study_key", "brights2")
    study = Study.query.filter_by(study_key=study_key).first()
    if not study:
        return jsonify({"forms": []}), 200

    forms = ConsentForm.query.filter_by(study_id=study.id).order_by(ConsentForm.created_at.desc()).all()
    result = []
    for f in forms:
        latest = (
            ConsentFormRevision.query
            .filter_by(consent_form_id=f.id)
            .order_by(ConsentFormRevision.created_at.desc())
            .first()
        )
        revision_count = ConsentFormRevision.query.filter_by(consent_form_id=f.id).count()
        d = f.to_dict()
        d["version"] = latest.version if latest else None
        d["revision_count"] = revision_count
        result.append(d)
    return jsonify({"forms": result}), 200


@admin_bp.route("/consent/forms/<int:form_id>/revisions", methods=["GET"])
@admin_required
def get_consent_revisions(form_id):
    """GET /api/admin/consent/forms/<id>/revisions — all revisions for a form."""
    form = db.session.get(ConsentForm, form_id)
    if not form:
        return jsonify({"error": "Form not found"}), 404

    revisions = (
        ConsentFormRevision.query
        .filter_by(consent_form_id=form_id)
        .order_by(ConsentFormRevision.created_at.desc())
        .all()
    )
    return jsonify({"revisions": [r.to_dict() for r in revisions]}), 200


@admin_bp.route("/consent/forms", methods=["POST"])
@admin_required
def create_consent_form():
    """POST /api/admin/consent/forms — create a new consent form with its first revision."""
    data = request.get_json() or {}
    study_key = data.get("study_key", "brights2")
    study = Study.query.filter_by(study_key=study_key).first()
    if not study:
        return jsonify({"error": "Study not found"}), 404

    title = (data.get("title") or "").strip()
    body_markdown = (data.get("body_markdown") or "").strip()
    version = (data.get("version") or "1.0").strip()
    if not title or not body_markdown:
        return jsonify({"error": "title and body_markdown are required"}), 400

    body_hash = hashlib.sha256(body_markdown.encode()).hexdigest()

    try:
        form = ConsentForm(study_id=study.id, title=title, is_active=False)
        db.session.add(form)
        db.session.flush()

        revision = ConsentFormRevision(
            consent_form_id=form.id,
            version=version,
            body_markdown=body_markdown,
            body_hash=body_hash,
            irb_approval_number=data.get("irb_approval_number"),
            created_by=session.get("user_id"),
            change_summary=data.get("change_summary"),
            is_material_change=bool(data.get("is_material_change", False)),
        )
        db.session.add(revision)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create consent form", exc_info=True)
        return jsonify({"error": "Failed to create consent form"}), 500

    result = form.to_dict()
    result["revision"] = revision.to_dict()
    return jsonify(result), 201


@admin_bp.route("/consent/forms/<int:form_id>/revisions", methods=["POST"])
@admin_required
def create_consent_revision(form_id):
    """POST /api/admin/consent/forms/<id>/revisions — add a new revision."""
    form = db.session.get(ConsentForm, form_id)
    if not form:
        return jsonify({"error": "Form not found"}), 404

    data = request.get_json() or {}
    body_markdown = (data.get("body_markdown") or "").strip()
    version = (data.get("version") or "").strip()
    if not body_markdown or not version:
        return jsonify({"error": "body_markdown and version are required"}), 400

    prev = (
        ConsentFormRevision.query
        .filter_by(consent_form_id=form_id)
        .order_by(ConsentFormRevision.created_at.desc())
        .first()
    )
    body_hash = hashlib.sha256(body_markdown.encode()).hexdigest()

    try:
        revision = ConsentFormRevision(
            consent_form_id=form_id,
            version=version,
            body_markdown=body_markdown,
            body_hash=body_hash,
            prev_revision_hash=prev.body_hash if prev else None,
            irb_approval_number=data.get("irb_approval_number"),
            created_by=session.get("user_id"),
            change_summary=data.get("change_summary"),
            is_material_change=bool(data.get("is_material_change", False)),
        )
        db.session.add(revision)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create consent revision form=%s", form_id, exc_info=True)
        return jsonify({"error": "Failed to create revision"}), 500

    return jsonify(revision.to_dict()), 201


@admin_bp.route("/consent/forms/<int:form_id>/activate", methods=["PATCH"])
@admin_required
def activate_consent_form(form_id):
    """PATCH /api/admin/consent/forms/<id>/activate — set this form as active."""
    form = db.session.get(ConsentForm, form_id)
    if not form:
        return jsonify({"error": "Form not found"}), 404

    try:
        ConsentForm.query.filter_by(study_id=form.study_id).update({"is_active": False})
        form.is_active = True
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to activate consent form=%s", form_id, exc_info=True)
        return jsonify({"error": "Failed to activate form"}), 500

    return jsonify(form.to_dict()), 200


@admin_bp.route("/consent/dashboard", methods=["GET"])
@admin_required
def consent_dashboard():
    """GET /api/admin/consent/dashboard — summary stats for consent tracking."""
    study = Study.query.filter_by(study_key="brights2").first()
    if not study:
        return jsonify({"total_enrolled": 0, "consented": 0, "pending_consent": 0, "withdrawn": 0, "by_version": {}}), 200

    round_ids = [r.id for r in StudyRound.query.filter_by(study_id=study.id).all()]

    total_enrolled = Enrollment.query.filter(
        Enrollment.round_id.in_(round_ids),
        Enrollment.status.in_(["active", "completed"]),
    ).count() if round_ids else 0

    consented = ParticipantConsent.query.filter(
        ParticipantConsent.round_id.in_(round_ids)
    ).count() if round_ids else 0

    withdrawn = Enrollment.query.filter(
        Enrollment.round_id.in_(round_ids),
        Enrollment.status == "withdrawn",
    ).count() if round_ids else 0

    pending_consent = max(0, total_enrolled - consented)

    by_version_rows = (
        db.session.query(
            ConsentFormRevision.version,
            func.count(ParticipantConsent.id),
        )
        .join(ParticipantConsent, ParticipantConsent.consent_form_revision_id == ConsentFormRevision.id)
        .group_by(ConsentFormRevision.version)
        .all()
    )
    by_version = {row[0]: row[1] for row in by_version_rows}

    return jsonify({
        "total_enrolled": total_enrolled,
        "consented": consented,
        "pending_consent": pending_consent,
        "withdrawn": withdrawn,
        "by_version": by_version,
    }), 200


# =============================================================================
# Approved notification copy templates (neutral, operational, research-valid)
# =============================================================================

NOTIFICATION_TEMPLATES = {
    'survey_available': {
        'title': 'Week {week} survey is now available',
        'body': ('Your Week {week} survey is open. '
                 'It takes about 6 minutes to complete. '
                 'Available until {closes}.'),
    },
    'survey_reminder': {
        'title': 'Reminder: Week {week} survey closes soon',
        'body': ('Your Week {week} survey closes on {closes}. '
                 'Complete it to keep your study record up to date.'),
    },
    'round_closing': {
        'title': 'Study round closing soon',
        'body': ('The {study_name} study round closes on {date}. '
                 'Make sure you have completed all available surveys.'),
    },
    'study_complete': {
        'title': 'Study complete — thank you',
        'body': ('You have completed all {weeks} weeks of '
                 '{study_name}. Thank you for your participation.'),
    },
    'welcome': {
        'title': 'Welcome to {study_name}',
        'body': ('You are now enrolled in {study_name}. '
                 'Your first survey will be available shortly.'),
    },
    'study_update': {
        'title': 'Study update',
        'body': 'There is an update regarding your study participation.',
    },
    'general': {
        'title': '{title}',
        'body': '{body}',
    },
}


def _create_notification(user_id, notif_type, title, body, round_id=None,
                         action_url=None, expires_at=None):
    """
    Create a Notification row and delivery log entry within the current session.
    Only survey_reminder type is gated by reminders_enabled.
    Caller must db.session.commit() after this returns.
    """
    if notif_type == 'survey_reminder':
        pref = db.session.get(NotificationPreference, user_id)
        if pref and not pref.reminders_enabled:
            return None

    n = Notification(
        user_id=user_id,
        round_id=round_id,
        type=notif_type,
        title=title,
        body=body,
        action_url=action_url,
        is_read=False,
        expires_at=expires_at,
    )
    db.session.add(n)
    db.session.flush()  # assign n.id before commit

    enrollment = None
    if round_id:
        enrollment = Enrollment.query.filter_by(
            user_id=user_id, round_id=round_id, status='active'
        ).first()

    log = NotificationDeliveryLog(
        notification_id=n.id,
        user_id=user_id,
        round_id=round_id,
        condition_label=enrollment.condition_label if enrollment else None,
        notification_type=notif_type,
        delivered_at=datetime.now(timezone.utc),
    )
    db.session.add(log)

    try:
        from routes.auth import _push_notification, _notif_dict
        _push_notification(n.user_id, _notif_dict(n))
    except Exception:
        pass

    return n


# =============================================================================
# Condition definitions
# =============================================================================

@admin_bp.route("/rounds/<int:round_id>/conditions", methods=["GET"])
@admin_required
def get_conditions(round_id):
    """GET /api/admin/rounds/<id>/conditions — list conditions with assignment counts."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    conditions = StudyCondition.query.filter_by(round_id=round_id).all()
    result = []
    for c in conditions:
        assigned = Enrollment.query.filter_by(
            round_id=round_id, condition_label=c.label, status='active'
        ).count()
        result.append({
            "id": c.id,
            "label": c.label,
            "group_name": c.group_name,
            "description": c.description,
            "color": c.color,
            "max_capacity": c.max_capacity,
            "assigned_count": assigned,
        })
    return jsonify({"conditions": result}), 200


@admin_bp.route("/rounds/<int:round_id>/conditions", methods=["POST"])
@admin_required
def create_condition(round_id):
    """POST /api/admin/rounds/<id>/conditions — add a condition to a round."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    strategy = ConditionAssignmentStrategy.query.filter_by(round_id=round_id).first()
    if strategy and strategy.is_locked:
        return jsonify({"error": "Cannot add conditions after randomization has begun"}), 409

    data = request.get_json() or {}
    label = (data.get("label") or "").strip()
    if not label:
        return jsonify({"error": "label is required"}), 400

    cond = StudyCondition(
        round_id=round_id,
        label=label,
        group_name=data.get("group_name"),
        description=data.get("description"),
        color=data.get("color"),
        max_capacity=data.get("max_capacity"),
    )
    try:
        db.session.add(cond)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create condition", exc_info=True)
        return jsonify({"error": "Failed to create condition"}), 500

    return jsonify({
        "id": cond.id, "label": cond.label, "group_name": cond.group_name,
        "description": cond.description, "color": cond.color,
        "max_capacity": cond.max_capacity, "assigned_count": 0,
    }), 201


@admin_bp.route("/rounds/<int:round_id>/conditions/<int:cid>", methods=["DELETE"])
@admin_required
def delete_condition(round_id, cid):
    """DELETE /api/admin/rounds/<id>/conditions/<cid> — remove an unassigned condition."""
    cond = db.session.get(StudyCondition, cid)
    if not cond or cond.round_id != round_id:
        return jsonify({"error": "Condition not found"}), 404

    enrolled = Enrollment.query.filter_by(
        round_id=round_id, condition_label=cond.label
    ).count()
    if enrolled > 0:
        return jsonify({"error": "Cannot delete condition with enrolled participants"}), 409

    try:
        db.session.delete(cond)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to delete condition"}), 500

    return jsonify({"success": True}), 200


# =============================================================================
# Assignment strategy
# =============================================================================

@admin_bp.route("/rounds/<int:round_id>/strategy", methods=["GET"])
@admin_required
def get_strategy(round_id):
    """GET /api/admin/rounds/<id>/strategy — current strategy or defaults."""
    strategy = ConditionAssignmentStrategy.query.filter_by(round_id=round_id).first()
    if not strategy:
        return jsonify({
            "algorithm": "permuted_block",
            "block_sizes": [4, 6, 8],
            "stratify_by": None,
            "rng_seed": None,
            "is_locked": False,
            "locked_at": None,
        }), 200
    return jsonify({
        "id": strategy.id,
        "algorithm": strategy.algorithm,
        "block_sizes": strategy.block_sizes,
        "stratify_by": strategy.stratify_by,
        "rng_seed": strategy.rng_seed,
        "is_locked": strategy.is_locked,
        "locked_at": strategy.locked_at.isoformat() if strategy.locked_at else None,
    }), 200


@admin_bp.route("/rounds/<int:round_id>/strategy", methods=["POST"])
@admin_required
def save_strategy(round_id):
    """POST /api/admin/rounds/<id>/strategy — create or update randomization strategy."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    strategy = ConditionAssignmentStrategy.query.filter_by(round_id=round_id).first()
    if strategy and strategy.is_locked:
        return jsonify({"error": "Strategy is locked — randomization has begun"}), 409

    data = request.get_json() or {}
    if not strategy:
        strategy = ConditionAssignmentStrategy(round_id=round_id)
        db.session.add(strategy)

    strategy.algorithm = data.get("algorithm", strategy.algorithm)
    raw_bs = data.get("block_sizes")
    if raw_bs is not None:
        strategy.block_sizes = [int(x) for x in raw_bs]
    strategy.stratify_by = data.get("stratify_by", strategy.stratify_by)
    strategy.rng_seed = data.get("rng_seed", strategy.rng_seed)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to save strategy"}), 500

    return jsonify({
        "id": strategy.id,
        "algorithm": strategy.algorithm,
        "block_sizes": strategy.block_sizes,
        "stratify_by": strategy.stratify_by,
        "is_locked": strategy.is_locked,
    }), 200


# =============================================================================
# Randomization
# =============================================================================

def _generate_block_sequence(rng, arms, n_total, block_sizes=(4, 6, 8)):
    sequence = []
    while len(sequence) < n_total:
        bs = int(rng.choice(block_sizes))
        block = []
        for arm in arms:
            block.extend([arm] * (bs // len(arms)))
        rng.shuffle(block)
        sequence.extend(block)
    return sequence[:n_total]


@admin_bp.route("/rounds/<int:round_id>/randomize", methods=["POST"])
@admin_required
def randomize_round(round_id):
    """POST /api/admin/rounds/<id>/randomize — atomic permuted-block assignment."""
    data = request.get_json() or {}
    if not data.get("confirm"):
        return jsonify({"error": "confirm: true required"}), 400

    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    strategy = ConditionAssignmentStrategy.query.filter_by(round_id=round_id).first()
    if strategy and strategy.is_locked:
        return jsonify({"error": "Strategy is locked — randomization has begun"}), 409

    conditions = StudyCondition.query.filter_by(round_id=round_id).all()
    if len(conditions) < 2:
        return jsonify({"error": "At least 2 conditions required"}), 400

    enrollments = Enrollment.query.filter_by(
        round_id=round_id, status='active'
    ).filter(Enrollment.condition_label.is_(None)).all()

    if not enrollments:
        return jsonify({"randomized": 0, "message": "All participants already assigned"}), 200

    if not strategy:
        strategy = ConditionAssignmentStrategy(round_id=round_id)
        db.session.add(strategy)

    seed_str = f"{round_id}:{strategy.rng_seed or 'default'}"
    seed_int = int(hashlib.sha256(seed_str.encode()).hexdigest()[:16], 16)
    rng = np.random.default_rng(seed_int)
    arms = [c.label for c in conditions]
    block_sizes = strategy.block_sizes or [4, 6, 8]
    sequence = _generate_block_sequence(rng, arms, len(enrollments), block_sizes)

    condition_map = {c.label: c for c in conditions}
    now = datetime.now(timezone.utc)
    admin_user_id = session.get("user_id")

    try:
        for i, enrollment in enumerate(enrollments):
            label = sequence[i]
            cond = condition_map[label]
            enrollment.condition_label = label
            enrollment.condition_group = cond.group_name

            log = AllocationLog(
                enrollment_id=enrollment.id,
                round_id=round_id,
                user_id=enrollment.user_id,
                condition_label=label,
                condition_group=cond.group_name,
                strategy=strategy.algorithm,
                sequence_index=i,
                assigned_by=admin_user_id,
                assigned_at=now,
            )
            db.session.add(log)

            slot = AllocationSequence(
                round_id=round_id,
                sequence_index=i,
                condition_label=label,
                consumed_by_enrollment_id=enrollment.id,
                consumed_at=now,
            )
            db.session.add(slot)

        strategy.is_locked = True
        strategy.locked_at = now
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Randomization failed for round=%s", round_id, exc_info=True)
        return jsonify({"error": "Randomization failed"}), 500

    balance = {}
    for arm in arms:
        balance[arm] = Enrollment.query.filter_by(
            round_id=round_id, condition_label=arm, status='active'
        ).count()

    return jsonify({
        "randomized": len(enrollments),
        "balance": balance,
        "algorithm": strategy.algorithm,
    }), 200


# =============================================================================
# Manual condition assignment
# =============================================================================

@admin_bp.route("/enrollments/<int:enrollment_id>/condition", methods=["PATCH"])
@admin_required
def reassign_condition(enrollment_id):
    """PATCH /api/admin/enrollments/<id>/condition — manually reassign a participant's condition."""
    data = request.get_json() or {}
    new_label = (data.get("condition_label") or "").strip()
    reason = (data.get("reason") or "").strip()

    if not new_label:
        return jsonify({"error": "condition_label required"}), 400
    if not reason:
        return jsonify({"error": "reason required"}), 400

    enrollment = db.session.get(Enrollment, enrollment_id)
    if not enrollment:
        return jsonify({"error": "Enrollment not found"}), 404

    cond = StudyCondition.query.filter_by(
        round_id=enrollment.round_id, label=new_label
    ).first()
    prior = enrollment.condition_label

    try:
        enrollment.condition_label = new_label
        enrollment.condition_group = cond.group_name if cond else None

        log = AllocationLog(
            enrollment_id=enrollment.id,
            round_id=enrollment.round_id,
            user_id=enrollment.user_id,
            condition_label=new_label,
            condition_group=cond.group_name if cond else None,
            prior_condition_label=prior,
            strategy='manual',
            assigned_by=session.get("user_id"),
            reason=reason,
        )
        db.session.add(log)
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to reassign condition"}), 500

    return jsonify({
        "id": enrollment.id,
        "condition_label": enrollment.condition_label,
        "condition_group": enrollment.condition_group,
        "status": enrollment.status,
        "user_id": enrollment.user_id,
        "round_id": enrollment.round_id,
    }), 200


# =============================================================================
# Balance view
# =============================================================================

@admin_bp.route("/rounds/<int:round_id>/balance", methods=["GET"])
@admin_required
def get_balance(round_id):
    """GET /api/admin/rounds/<id>/balance — condition assignment balance."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    conditions = StudyCondition.query.filter_by(round_id=round_id).all()
    total_enrolled = Enrollment.query.filter_by(round_id=round_id, status='active').count()
    total_assigned = Enrollment.query.filter(
        Enrollment.round_id == round_id,
        Enrollment.status == 'active',
        Enrollment.condition_label.isnot(None),
    ).count()

    result = []
    for c in conditions:
        assigned = Enrollment.query.filter_by(
            round_id=round_id, condition_label=c.label, status='active'
        ).count()
        pct = round(assigned / total_enrolled, 4) if total_enrolled > 0 else 0.0
        result.append({
            "label": c.label,
            "group": c.group_name,
            "assigned_count": assigned,
            "max_capacity": c.max_capacity,
            "pct": pct,
        })

    return jsonify({
        "balance": result,
        "total_enrolled": total_enrolled,
        "total_assigned": total_assigned,
        "unassigned": total_enrolled - total_assigned,
    }), 200


# =============================================================================
# User enrollment lookup
# =============================================================================

@admin_bp.route("/users/<int:user_id>/enrollment", methods=["GET"])
@admin_required
def get_user_enrollment(user_id):
    """GET /api/admin/users/<id>/enrollment — user's active enrollment with condition."""
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({"error": "User not found"}), 404

    enrollment = Enrollment.query.filter_by(user_id=user_id, status='active').first()
    if not enrollment:
        return jsonify({"enrollment": None}), 200

    round_ = db.session.get(StudyRound, enrollment.round_id)
    return jsonify({
        "enrollment": {
            "id": enrollment.id,
            "round_id": enrollment.round_id,
            "round_label": round_.round_label if round_ else None,
            "status": enrollment.status,
            "condition_label": enrollment.condition_label,
            "condition_group": enrollment.condition_group,
            "enrolled_at": enrollment.enrolled_at.isoformat() if enrollment.enrolled_at else None,
        }
    }), 200


# =============================================================================
# Admin batch notification
# =============================================================================

@admin_bp.route("/rounds/<int:round_id>/notify", methods=["POST"])
@admin_required
def send_notifications(round_id):
    """POST /api/admin/rounds/<id>/notify — batch-send notification to all active participants."""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    data = request.get_json() or {}
    # Accept both 'type' (frontend) and 'notif_type' (legacy) keys
    notif_type = data.get("type") or data.get("notif_type", "general")
    week = data.get("week", 1)
    closes_at = data.get("closes_at", "")
    body_override = data.get("body_override", "")

    if notif_type not in NOTIFICATION_TEMPLATES:
        return jsonify({"error": f"Invalid type. Must be one of: {sorted(NOTIFICATION_TEMPLATES)}"}), 400

    tmpl = NOTIFICATION_TEMPLATES[notif_type]
    study_name = round_.study.study_name if round_.study else "the study"
    num_weeks = round_.template.num_weeks if round_.template else 6

    fmt = {
        "week": week, "closes": closes_at, "date": closes_at,
        "study_name": study_name, "weeks": num_weeks,
        "title": body_override, "body": body_override,
    }
    title = tmpl["title"].format(**fmt)
    body = body_override.strip() if body_override.strip() else tmpl["body"].format(**fmt)
    action_url = "/survey" if "survey" in notif_type else "/dashboard"
    now = datetime.now(timezone.utc)

    enrollments = Enrollment.query.filter_by(round_id=round_id, status='active').all()
    if not enrollments:
        return jsonify({"sent": 0, "skipped": 0}), 200

    # Bulk-fetch reminder preferences to avoid N queries
    user_ids = [e.user_id for e in enrollments]
    disabled_reminder_users = set()
    if notif_type == 'survey_reminder':
        prefs = NotificationPreference.query.filter(
            NotificationPreference.user_id.in_(user_ids),
            NotificationPreference.reminders_enabled == False,  # noqa: E712
        ).all()
        disabled_reminder_users = {p.user_id for p in prefs}

    # Build enrollment condition lookup (already fetched — no extra query)
    condition_by_user = {e.user_id: e.condition_label for e in enrollments}

    # Build all Notification objects (no session.add in loop)
    notifications_list = []
    skipped = 0
    for enrollment in enrollments:
        if enrollment.user_id in disabled_reminder_users:
            skipped += 1
            continue
        notifications_list.append(Notification(
            user_id=enrollment.user_id,
            round_id=round_id,
            type=notif_type,
            title=title,
            body=body,
            action_url=action_url,
            is_read=False,
            created_at=now,
        ))

    if not notifications_list:
        return jsonify({"sent": 0, "skipped": skipped}), 200

    try:
        # add_all + flush assigns IDs in a single batch roundtrip
        db.session.add_all(notifications_list)
        db.session.flush()

        # Build delivery logs with the now-available IDs
        delivery_logs = [
            NotificationDeliveryLog(
                notification_id=n.id,
                user_id=n.user_id,
                round_id=round_id,
                condition_label=condition_by_user.get(n.user_id),
                notification_type=notif_type,
                delivered_at=now,
            )
            for n in notifications_list
        ]
        db.session.add_all(delivery_logs)
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to send notifications for round=%s", round_id, exc_info=True)
        return jsonify({"error": "Failed to send notifications"}), 500

    # Push SSE only to users who have an active stream connection
    try:
        from routes.auth import _sse_subscribers, _push_notification, _notif_dict
        for n in notifications_list:
            if n.user_id in _sse_subscribers:
                _push_notification(n.user_id, _notif_dict(n))
    except Exception:
        pass

    return jsonify({"sent": len(notifications_list), "skipped": skipped}), 200


# =============================================================================
# Data quality flag routes
# =============================================================================

_VALID_FLAG_TYPES = {
    "speeding", "straight_lining", "pattern_response", "missing_data", "low_variance",
}

_VALID_RESOLUTIONS = {
    "excluded_confirmed", "excluded_borderline", "retained_borderline",
    "retained_confirmed", "data_error", "technical_issue",
}


def _flag_to_dict(flag):
    user = db.session.get(User, flag.user_id)
    sub = db.session.get(SurveySubmission, flag.submission_id) if flag.submission_id else None
    round_ = db.session.get(StudyRound, flag.round_id) if flag.round_id else None
    return {
        "id": flag.id,
        "flag_type": flag.flag_type,
        "severity": flag.severity,
        "detail": flag.detail,
        "is_resolved": flag.is_resolved,
        "justification": flag.justification,
        "created_at": flag.created_at.isoformat() if flag.created_at else None,
        "resolved_at": flag.resolved_at.isoformat() if flag.resolved_at else None,
        "user": {
            "id": user.id,
            "username": user.username,
            "participant_id": user.participant_id,
        } if user else None,
        "submission": {
            "id": sub.id,
            "timepoint": sub.timepoint,
            "submitted_at": sub.submitted_at.isoformat() if sub.submitted_at else None,
        } if sub else None,
        "round": {
            "id": round_.id,
            "round_label": round_.round_label or f"Round {round_.round_number}",
        } if round_ else None,
    }


@admin_bp.route("/quality-flags/summary", methods=["GET"])
@admin_required
def quality_flags_summary():
    """GET /api/admin/quality-flags/summary?round_id=<id>"""
    round_id = request.args.get("round_id", type=int)
    if not round_id:
        return jsonify({"error": "round_id is required"}), 400

    q = DataQualityFlag.query.filter_by(round_id=round_id)
    all_flags = q.all()

    total = len(all_flags)
    unresolved = sum(1 for f in all_flags if not f.is_resolved)
    by_severity = {}
    by_type = {}
    for f in all_flags:
        by_severity[f.severity] = by_severity.get(f.severity, 0) + 1
        by_type[f.flag_type] = by_type.get(f.flag_type, 0) + 1

    flagged_participants = len({f.user_id for f in all_flags})

    total_submissions = SurveySubmission.query.filter_by(round_id=round_id).count()
    flagged_submissions = len({f.submission_id for f in all_flags if f.submission_id})
    pct = round(flagged_submissions / total_submissions, 4) if total_submissions > 0 else 0.0

    return jsonify({
        "total_flags": total,
        "unresolved": unresolved,
        "by_severity": by_severity,
        "by_type": by_type,
        "flagged_participants": flagged_participants,
        "pct_submissions_flagged": pct,
    }), 200


@admin_bp.route("/quality-flags", methods=["GET"])
@admin_required
def get_quality_flags():
    """GET /api/admin/quality-flags?round_id=<id>&severity=&flag_type=&is_resolved=false&user_id=&offset=0"""
    round_id = request.args.get("round_id", type=int)
    user_id = request.args.get("user_id", type=int)

    if not round_id and not user_id:
        return jsonify({"error": "round_id or user_id is required"}), 400

    q = DataQualityFlag.query
    if round_id:
        q = q.filter(DataQualityFlag.round_id == round_id)
    if user_id:
        q = q.filter(DataQualityFlag.user_id == user_id)

    severity = request.args.get("severity")
    if severity and severity != "all":
        q = q.filter(DataQualityFlag.severity == severity)

    flag_type = request.args.get("flag_type")
    if flag_type and flag_type != "all":
        q = q.filter(DataQualityFlag.flag_type == flag_type)

    is_resolved_param = request.args.get("is_resolved", "false").lower()
    if is_resolved_param == "true":
        q = q.filter(DataQualityFlag.is_resolved == True)  # noqa: E712
    elif is_resolved_param == "false":
        q = q.filter(DataQualityFlag.is_resolved == False)  # noqa: E712
    # "all" → no filter

    offset = request.args.get("offset", 0, type=int)
    limit = 50

    flags = q.order_by(DataQualityFlag.created_at.desc()).offset(offset).limit(limit + 1).all()
    has_more = len(flags) > limit
    flags = flags[:limit]

    return jsonify({
        "flags": [_flag_to_dict(f) for f in flags],
        "has_more": has_more,
        "offset": offset,
    }), 200


@admin_bp.route("/quality-flags/bulk-resolve", methods=["POST"])
@admin_required
def bulk_resolve_quality_flags():
    """POST /api/admin/quality-flags/bulk-resolve"""
    data = request.get_json() or {}
    flag_ids = data.get("flag_ids", [])
    resolution = data.get("resolution", "").strip()
    justification = data.get("justification", "").strip()

    if not flag_ids:
        return jsonify({"error": "flag_ids required"}), 400
    if resolution not in _VALID_RESOLUTIONS:
        return jsonify({"error": f"resolution must be one of: {sorted(_VALID_RESOLUTIONS)}"}), 400
    if len(justification) < 20:
        return jsonify({"error": "justification must be at least 20 characters"}), 400

    now = datetime.now(timezone.utc)
    resolver_id = session.get("user_id")
    resolved = 0

    for flag_id in flag_ids:
        flag = db.session.get(DataQualityFlag, flag_id)
        if not flag or flag.is_resolved:
            continue
        flag.is_resolved = True
        flag.resolved_at = now
        flag.resolved_by_user_id = resolver_id
        flag.justification = justification
        flag.detail = {**(flag.detail or {}), "resolution_note": f"{resolution}: {justification}"}
        resolved += 1

    try:
        db.session.add(AuditLog(
            user_id=resolver_id,
            event_type="QUALITY_FLAGS_BULK_RESOLVED",
            detail=f"Resolved {resolved} flags: resolution={resolution}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Bulk resolve quality flags failed", exc_info=True)
        return jsonify({"error": "Failed to resolve flags"}), 500

    return jsonify({"resolved": resolved}), 200


@admin_bp.route("/quality-flags/<int:flag_id>/resolve", methods=["POST"])
@admin_required
def resolve_quality_flag(flag_id):
    """POST /api/admin/quality-flags/<flag_id>/resolve"""
    flag = db.session.get(DataQualityFlag, flag_id)
    if not flag:
        return jsonify({"error": "Flag not found"}), 404

    data = request.get_json() or {}
    resolution = data.get("resolution", "").strip()
    justification = data.get("justification", "").strip()

    if resolution not in _VALID_RESOLUTIONS:
        return jsonify({"error": f"resolution must be one of: {sorted(_VALID_RESOLUTIONS)}"}), 400
    if len(justification) < 20:
        return jsonify({"error": "justification must be at least 20 characters"}), 400

    now = datetime.now(timezone.utc)
    flag.is_resolved = True
    flag.resolved_at = now
    flag.resolved_by_user_id = session.get("user_id")
    flag.justification = justification
    flag.detail = {**(flag.detail or {}), "resolution_note": f"{resolution}: {justification}"}

    try:
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="QUALITY_FLAG_RESOLVED",
            detail=f"Flag {flag_id}: resolution={resolution}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Resolve quality flag failed flag=%s", flag_id, exc_info=True)
        return jsonify({"error": "Failed to resolve flag"}), 500

    return jsonify(_flag_to_dict(flag)), 200


@admin_bp.route("/rounds/<int:round_id>/flag-thresholds", methods=["GET"])
@admin_required
def get_flag_thresholds(round_id):
    """GET /api/admin/rounds/<round_id>/flag-thresholds"""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    rows = (
        FlagThresholdConfig.query
        .filter_by(round_id=round_id)
        .order_by(FlagThresholdConfig.flag_type, FlagThresholdConfig.effective_from.desc())
        .all()
    )

    grouped = {}
    for row in rows:
        grouped.setdefault(row.flag_type, []).append({
            "id": row.id,
            "flag_type": row.flag_type,
            "thresholds": row.thresholds,
            "preregistered": row.preregistered,
            "prereg_url": row.prereg_url,
            "effective_from": row.effective_from.isoformat() if row.effective_from else None,
            "created_by": row.created_by,
        })

    return jsonify({"thresholds": grouped}), 200


@admin_bp.route("/rounds/<int:round_id>/flag-thresholds", methods=["POST"])
@admin_required
def create_flag_threshold(round_id):
    """POST /api/admin/rounds/<round_id>/flag-thresholds"""
    round_ = db.session.get(StudyRound, round_id)
    if not round_:
        return jsonify({"error": "Round not found"}), 404

    data = request.get_json() or {}
    flag_type = data.get("flag_type", "").strip()
    thresholds = data.get("thresholds")
    preregistered = bool(data.get("preregistered", False))
    prereg_url = data.get("prereg_url")

    if flag_type not in _VALID_FLAG_TYPES:
        return jsonify({"error": f"flag_type must be one of: {sorted(_VALID_FLAG_TYPES)}"}), 400
    if not thresholds or not isinstance(thresholds, dict):
        return jsonify({"error": "thresholds must be a non-empty object"}), 400

    runs = QualityCheckRun.query.filter_by(round_id=round_id).count()
    if runs > 0 and not preregistered:
        return jsonify({
            "error": "Cannot change thresholds after analysis has run. Preregistered thresholds only.",
            "analysis_runs": runs,
        }), 409

    try:
        config = FlagThresholdConfig(
            round_id=round_id,
            flag_type=flag_type,
            thresholds=thresholds,
            preregistered=preregistered,
            prereg_url=prereg_url,
            created_by=session.get("user_id"),
        )
        db.session.add(config)
        db.session.add(AuditLog(
            user_id=session.get("user_id"),
            event_type="FLAG_THRESHOLD_CREATED",
            detail=f"round={round_id} flag_type={flag_type} preregistered={preregistered}",
        ))
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create flag threshold round=%s", round_id, exc_info=True)
        return jsonify({"error": "Failed to create threshold config"}), 500

    return jsonify({
        "id": config.id,
        "round_id": config.round_id,
        "flag_type": config.flag_type,
        "thresholds": config.thresholds,
        "preregistered": config.preregistered,
        "prereg_url": config.prereg_url,
        "effective_from": config.effective_from.isoformat() if config.effective_from else None,
    }), 201


@admin_bp.route("/rounds/<int:round_id>/recheck", methods=["POST"])
@admin_required
def recheck_quality_flags(round_id):
    """POST /api/admin/rounds/<round_id>/recheck — placeholder."""
    return jsonify({"error": "Not implemented"}), 501
