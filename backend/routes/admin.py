import logging
import importlib

from datetime import datetime, timedelta, timezone

from flask import Blueprint, jsonify, request
from sqlalchemy import func

from models import AuditLog, SessionLog, User, db
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
