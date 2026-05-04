import hashlib
import json
import logging
import os
import queue as queue_module
import secrets
from datetime import datetime, timedelta, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, session, g, Response, stream_with_context
from itsdangerous import URLSafeTimedSerializer
import requests as http_req
from werkzeug.security import check_password_hash, generate_password_hash
from models import (
    db, User, AuditLog, SessionLog, StudyRound, ResearcherRole, ResearcherInvitation,
    ConsentForm, ConsentFormRevision, ParticipantConsent,
    Enrollment, PendingEnrollment, WithdrawalRequest,
    Notification, NotificationDeliveryLog, NotificationPreference,
)
from extensions import limiter

# Used to equalise login timing when a username/email is not found,
# preventing enumeration via response-time differences.
_DUMMY_HASH = generate_password_hash("__timing_dummy__")

# Magic byte signatures for allowed image types
_MAGIC_BYTES = {
    "jpg":  b"\xff\xd8\xff",
    "jpeg": b"\xff\xd8\xff",
    "png":  b"\x89PNG",
    "gif":  b"GIF8",
    "webp": b"RIFF",
}

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("security")

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")
notif_bp = Blueprint("notif", __name__, url_prefix="/api")

# In-process SSE subscriber queues keyed by user_id
_sse_subscribers: dict[int, list[queue_module.Queue]] = {}


# =============================================================================
# HELPERS
# =============================================================================
def _get_ip():
    """Get client IP. ProxyFix middleware already unwraps X-Forwarded-For into remote_addr."""
    return request.remote_addr


def _get_request_id():
    return getattr(g, "request_id", None)


def _get_ua():
    """Get User-Agent header, truncated to 300 chars."""
    ua = request.headers.get("User-Agent", "")
    return ua[:300] if ua else None


def _audit(event_type, user_id=None, detail=None):
    """Write an audit log entry to the database."""
    try:
        entry = AuditLog(
            user_id=user_id,
            event_type=event_type,
            detail=detail,
            ip_address=_get_ip(),
            user_agent=_get_ua(),
            request_id=_get_request_id(),
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        logger.error("Failed to write audit log: %s user=%s", event_type, user_id, exc_info=True)
        db.session.rollback()


# Signer for pending enrollment tokens (48-hour expiry)
_signer = URLSafeTimedSerializer(
    os.environ.get("FLASK_SECRET_KEY", "dev"), salt="pending-enroll"
)


def _issue_pending_token(round_id, join_code, req):
    """Create a PendingEnrollment row and return the signed token."""
    raw = secrets.token_urlsafe(32)
    token = _signer.dumps({"round_id": round_id, "nonce": raw[:8]})
    ip_hash = hashlib.sha256(
        (_get_ip() + datetime.now(timezone.utc).strftime("%Y%m%d")).encode()
    ).hexdigest()[:16]
    pe = PendingEnrollment(
        token=token,
        round_id=round_id,
        join_code=join_code,
        issued_ip_hash=ip_hash,
        issued_ua=req.headers.get("User-Agent", "")[:200],
        utm_source=req.args.get("utm_source"),
        utm_medium=req.args.get("utm_medium"),
        utm_campaign=req.args.get("utm_campaign"),
        referrer=req.referrer,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=48),
    )
    db.session.add(pe)
    db.session.commit()
    return token


# =============================================================================
# AUTH DECORATORS
# =============================================================================
def login_required(f):
    """Decorator to require authentication for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            security_logger.warning(
                "Unauthorized access attempt: %s %s ip=%s",
                request.method,
                request.path,
                _get_ip(),
            )
            _audit(AuditLog.UNAUTHORIZED_ACCESS, detail=f"{request.method} {request.path}")
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            security_logger.warning(
                "Unauthorized access attempt (admin route): %s %s ip=%s",
                request.method,
                request.path,
                _get_ip(),
            )
            _audit(AuditLog.UNAUTHORIZED_ACCESS, detail=f"Admin route: {request.method} {request.path}")
            return jsonify({"error": "Authentication required"}), 401
        user = db.session.get(User, session["user_id"])
        if not user or user.role != "admin":
            security_logger.warning(
                "Forbidden: non-admin user=%s attempted %s %s",
                session["user_id"],
                request.method,
                request.path,
            )
            return jsonify({"error": "Admin access required"}), 403
        return f(*args, **kwargs)
    return decorated_function


# =============================================================================
# RESEARCHER RBAC
# =============================================================================

PERMISSIONS = {
    "pi": {
        "view_pii", "export_pii", "export_deid",
        "edit_config", "edit_consent", "add_notes",
        "grant_roles", "view_audit", "run_randomization",
        "resolve_flags", "edit_records", "view_analysis",
        "manage_rounds", "manage_enrollments",
    },
    "research_assistant": {
        "view_pii", "add_notes", "resolve_flags", "view_analysis",
    },
    "data_manager": {
        "export_deid", "resolve_flags", "view_analysis",
    },
    "observer": {
        "view_analysis",
    },
}


def _get_default_study_id():
    """Returns id of the brights2 study."""
    from models import Study
    s = Study.query.filter_by(study_key="brights2").first()
    return s.id if s else None


def _get_user_study_role(user_id, study_id):
    """Returns role string or None for a non-revoked researcher role."""
    role_row = ResearcherRole.query.filter_by(
        user_id=user_id,
        study_id=study_id,
        revoked_at=None,
    ).first()
    return role_row.role if role_row else None


def require_permission(permission):
    """
    Decorator for study-scoped permission checking.
    Users with role='admin' in the users table bypass all checks.
    For researcher-role users, checks the PERMISSIONS map.
    study_id is resolved from: g.study_id → URL kwarg → default brights2 study.
    """
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not session.get("user_id"):
                return jsonify({"error": "Auth required"}), 401
            user = db.session.get(User, session["user_id"])
            if not user:
                return jsonify({"error": "User not found"}), 401

            # Existing admin users bypass all permission checks
            if user.role == "admin":
                return fn(*args, **kwargs)

            # Resolve study_id
            study_id = (
                g.get("study_id")
                or kwargs.get("study_id")
                or _get_default_study_id()
            )
            if not study_id:
                return jsonify({"error": "Study context required"}), 400

            researcher_role = _get_user_study_role(user.id, study_id)
            if not researcher_role:
                return jsonify({"error": "Not authorized for this study"}), 403
            if permission not in PERMISSIONS.get(researcher_role, set()):
                return jsonify(
                    {"error": f"Role {researcher_role} cannot {permission}"}
                ), 403

            # Touch last_access_at
            role_row = ResearcherRole.query.filter_by(
                user_id=user.id, study_id=study_id, revoked_at=None
            ).first()
            if role_row:
                role_row.last_access_at = datetime.now(timezone.utc)
                db.session.commit()

            return fn(*args, **kwargs)
        return wrapper
    return decorator


# =============================================================================
# ROUTES
# =============================================================================
@auth_bp.route("/register", methods=["POST"])
@limiter.limit("5 per minute")
def register():
    """
    Register a new user.

    POST /auth/register
    Body: {"username": "...", "email": "...", "password": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    # Validation
    if not username or not email or not password:
        return jsonify({"error": "Username, email, and password are required"}), 400

    if len(username) < 3:
        return jsonify({"error": "Username must be at least 3 characters"}), 400

    if len(password) < 8:
        return jsonify({"error": "Password must be at least 8 characters"}), 400

    if "@" not in email:
        return jsonify({"error": "Invalid email format"}), 400

    # Check if user exists
    if User.query.filter_by(username=username).first():
        logger.info("Registration rejected: username '%s' already taken ip=%s", username, _get_ip())
        return jsonify({"error": "Username already taken"}), 409

    if User.query.filter_by(email=email).first():
        logger.info("Registration rejected: email already registered ip=%s", _get_ip())
        return jsonify({"error": "Email already registered"}), 409

    # Create user
    try:
        user = User(username=username, email=email, participant_id=secrets.token_hex(16))
        user.set_password(password)
        db.session.add(user)
        db.session.commit()
    except Exception:
        logger.error("Registration failed for username='%s'", username, exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Registration failed"}), 500

    logger.info("User registered: id=%s username='%s'", user.id, user.username)
    _audit(AuditLog.REGISTER, user_id=user.id, detail=f"username={user.username}")

    # Optional join_code handling — enroll user if a valid join code was provided
    join_code = data.get("join_code", "").strip().upper()
    join_result = None
    if join_code:
        round_ = StudyRound.query.filter(
            db.func.upper(StudyRound.join_code) == join_code
        ).first()
        if round_ and round_.status in ("enrolling", "active"):
            try:
                enrollment = Enrollment(
                    user_id=user.id,
                    round_id=round_.id,
                    status="active",
                    join_method="register_link",
                )
                db.session.add(enrollment)
                user.active_round_id = round_.id
                db.session.commit()
                join_result = {
                    "round_id": round_.id,
                    "study_name": round_.study.study_name,
                    "round_label": round_.round_label,
                }
            except Exception:
                db.session.rollback()

    return jsonify({
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
        },
        "active_enrollment": join_result,
    }), 201


@auth_bp.route("/login", methods=["POST"])
@limiter.limit("10 per minute")
def login():
    """
    Authenticate user and create session.

    POST /auth/login
    Body: {"username": "...", "password": "..."} or {"email": "...", "password": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    username = data.get("username", "").strip()
    email = data.get("email", "").strip().lower()
    password = data.get("password", "")

    if not password:
        return jsonify({"error": "Password is required"}), 400

    if not username and not email:
        return jsonify({"error": "Username or email is required"}), 400

    # Find user
    identifier = username or email
    if username:
        user = User.query.filter_by(username=username).first()
    else:
        user = User.query.filter_by(email=email).first()

    if not user:
        # Run a dummy hash check to equalise response time with a real wrong-password
        # attempt — prevents username enumeration via timing differences.
        check_password_hash(_DUMMY_HASH, password)
        security_logger.warning("Login failed: user not found identifier='%s' ip=%s", identifier, _get_ip())
        _audit(AuditLog.LOGIN_FAILED, detail=f"User not found: {identifier}")
        return jsonify({"error": "Invalid credentials"}), 401

    # Check if account is locked
    if user.is_locked():
        security_logger.warning(
            "Login blocked: account locked user=%s ip=%s locked_until=%s",
            user.id,
            _get_ip(),
            user.locked_until.isoformat(),
        )
        return jsonify({
            "error": "Account locked due to too many failed attempts",
            "locked_until": user.locked_until.isoformat()
        }), 423

    # Verify password
    if not user.check_password(password):
        user.record_failed_attempt()
        db.session.commit()

        remaining = 5 - user.failed_attempts
        security_logger.warning(
            "Login failed: wrong password user=%s attempts=%s/5 ip=%s",
            user.id,
            user.failed_attempts,
            _get_ip(),
        )
        _audit(AuditLog.LOGIN_FAILED, user_id=user.id, detail=f"Wrong password, attempt {user.failed_attempts}/5")

        if user.is_locked():
            security_logger.warning(
                "Account locked: user=%s ip=%s locked_until=%s",
                user.id,
                _get_ip(),
                user.locked_until.isoformat(),
            )
            _audit(AuditLog.ACCOUNT_LOCKED, user_id=user.id, detail=f"Locked until {user.locked_until.isoformat()}")
            return jsonify({
                "error": "Account locked due to too many failed attempts",
                "locked_until": user.locked_until.isoformat()
            }), 423

        return jsonify({
            "error": "Invalid credentials",
            "attempts_remaining": max(0, remaining)
        }), 401

    # Check if account was previously locked and is now unlocked
    was_locked = user.locked_until is not None
    if was_locked:
        logger.info("Account unlocked: user=%s (lockout expired)", user.id)
        _audit(AuditLog.ACCOUNT_UNLOCKED, user_id=user.id, detail="Lockout expired, successful login")

    # Successful login
    user.record_successful_login()
    db.session.commit()

    # Set session
    session.clear()
    session["user_id"] = user.id
    session["username"] = user.username
    session["role"] = user.role
    session["login_at"] = datetime.now(timezone.utc).isoformat()
    session.permanent = True

    logger.info("User login successful: id=%s username='%s'", user.id, user.username)
    security_logger.info("LOGIN_SUCCESS user=%s ip=%s", user.id, _get_ip())
    _audit(AuditLog.LOGIN_SUCCESS, user_id=user.id)

    # Create session log entry
    try:
        session_entry = SessionLog(
            user_id=user.id,
            login_at=datetime.now(timezone.utc),
            ip_address=_get_ip(),
            user_agent=_get_ua(),
        )
        db.session.add(session_entry)
        db.session.commit()
        session["session_log_id"] = session_entry.id
    except Exception:
        logger.error("Failed to create session log for user=%s", user.id, exc_info=True)
        db.session.rollback()

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "participant_id": user.participant_id,
            "avatar_url": user.avatar_url,
            "display_name": user.display_name,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
    }), 200


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    """
    Clear session and log out user.

    GET/POST /auth/logout
    """
    user_id = session.get("user_id")
    username = session.get("username")
    session_log_id = session.get("session_log_id")
    login_at_str = session.get("login_at")

    # Calculate session duration
    duration_str = "unknown"
    if login_at_str:
        try:
            login_at = datetime.fromisoformat(login_at_str)
            duration_seconds = int((datetime.now(timezone.utc) - login_at).total_seconds())
            duration_str = f"{duration_seconds}s"
        except (ValueError, TypeError):
            duration_seconds = None
    else:
        duration_seconds = None

    # Close the session log entry
    if session_log_id:
        try:
            session_entry = db.session.get(SessionLog, session_log_id)
            if session_entry:
                session_entry.record_logout()
                db.session.commit()
        except Exception:
            logger.error("Failed to close session log id=%s", session_log_id, exc_info=True)
            db.session.rollback()

    if user_id:
        logger.info("User logout: id=%s username='%s' duration=%s", user_id, username, duration_str)
        _audit(AuditLog.LOGOUT, user_id=user_id, detail=f"Session duration: {duration_str}")

    session.clear()
    return jsonify({"message": "Logged out successfully"}), 200


@auth_bp.route("/me", methods=["GET"])
def me():
    """
    Get current authenticated user info.

    GET /auth/me — returns 401 silently if not logged in (used as session check on app load).
    """
    if not session.get("user_id"):
        return jsonify({"error": "Not authenticated"}), 401

    user = db.session.get(User, session["user_id"])

    if not user:
        logger.warning("Session references non-existent user_id=%s, clearing session", session["user_id"])
        _audit(AuditLog.SESSION_EXPIRED, user_id=session["user_id"], detail="User not found in database")
        session.clear()
        return jsonify({"error": "User not found"}), 404

    active_enrollment = None
    if user.active_round_id:
        round_ = db.session.get(StudyRound, user.active_round_id)
        if round_:
            active_enrollment = {
                "round_id": round_.id,
                "round_number": round_.round_number,
                "round_label": round_.round_label,
                "study_name": round_.study.study_name if round_.study else None,
                "template_name": round_.template.name if round_.template else None,
                "round_status": round_.status,
            }

    return jsonify({
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "participant_id": user.participant_id,
            "avatar_url": user.avatar_url,
            "display_name": user.display_name,
            "created_at": user.created_at.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "active_enrollment": active_enrollment,
        }
    }), 200


@auth_bp.route("/change-password", methods=["POST"])
@login_required
def change_password():
    """
    Change password for authenticated user.

    POST /auth/change-password
    Body: {"current_password": "...", "new_password": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    current_password = data.get("current_password", "")
    new_password = data.get("new_password", "")

    if not current_password or not new_password:
        return jsonify({"error": "Current and new password required"}), 400

    if len(new_password) < 8:
        return jsonify({"error": "New password must be at least 8 characters"}), 400

    user = db.session.get(User, session["user_id"])

    if not user.check_password(current_password):
        security_logger.warning("Password change failed: wrong current password user=%s ip=%s", user.id, _get_ip())
        return jsonify({"error": "Current password is incorrect"}), 401

    try:
        user.set_password(new_password)
        db.session.commit()
    except Exception:
        logger.error("Password change failed for user=%s", user.id, exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Password change failed"}), 500

    logger.info("Password changed: user=%s", user.id)
    security_logger.info("PASSWORD_CHANGE user=%s ip=%s", user.id, _get_ip())
    _audit(AuditLog.PASSWORD_CHANGE, user_id=user.id)

    return jsonify({"message": "Password changed successfully"}), 200


@auth_bp.route("/display-name", methods=["POST"])
@login_required
def update_display_name():
    """
    Set or update the display name for the authenticated user.

    POST /auth/display-name
    Body: {"display_name": "..."}
    """
    data = request.get_json()

    if not data:
        return jsonify({"error": "Request body required"}), 400

    display_name = data.get("display_name", "").strip()

    if not display_name:
        return jsonify({"error": "Display name cannot be empty"}), 400

    if len(display_name) > 100:
        return jsonify({"error": "Display name must be 100 characters or fewer"}), 400

    user = db.session.get(User, session["user_id"])

    try:
        user.display_name = display_name
        db.session.commit()
    except Exception:
        logger.error("Display name update failed for user=%s", user.id, exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to update display name"}), 500

    logger.info("Display name updated: user=%s", user.id)

    return jsonify({"display_name": user.display_name}), 200


ALLOWED_AVATAR_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}
MAX_AVATAR_BYTES = 2 * 1024 * 1024  # 2 MB


@auth_bp.route("/avatar", methods=["POST"])
@login_required
def upload_avatar():
    """
    Upload a profile picture to Supabase Storage.

    POST /auth/avatar
    Body: multipart/form-data with field "file"
    """
    if "file" not in request.files:
        return jsonify({"error": "No file provided"}), 400

    f = request.files["file"]
    ext = f.filename.rsplit(".", 1)[-1].lower() if "." in f.filename else ""
    if ext not in ALLOWED_AVATAR_EXTS:
        return jsonify({"error": "File type not allowed"}), 400

    data = f.read()
    if len(data) > MAX_AVATAR_BYTES:
        return jsonify({"error": "File too large (max 2MB)"}), 400

    # Validate magic bytes — reject files that lie about their extension
    expected_magic = _MAGIC_BYTES.get(ext, b"")
    if not data[:len(expected_magic)] == expected_magic:
        return jsonify({"error": "File content does not match declared type"}), 400

    supabase_url = os.environ.get("SUPABASE_URL", "").rstrip("/")
    service_key = os.environ.get("SUPABASE_SERVICE_KEY", "")
    if not supabase_url or not service_key:
        logger.error("SUPABASE_URL or SUPABASE_SERVICE_KEY not configured")
        return jsonify({"error": "Storage not configured"}), 500

    user = db.session.get(User, session["user_id"])
    object_path = f"avatars/{user.id}.{ext}"

    resp = http_req.put(
        f"{supabase_url}/storage/v1/object/{object_path}",
        headers={
            "Authorization": f"Bearer {service_key}",
            "Content-Type": f.content_type,
            "x-upsert": "true",
        },
        data=data,
    )
    if resp.status_code not in (200, 201):
        logger.error("Supabase Storage upload failed: %s", resp.text)
        return jsonify({"error": "Upload failed"}), 500

    public_url = f"{supabase_url}/storage/v1/object/public/{object_path}"
    user.avatar_url = public_url
    db.session.commit()
    logger.info("Avatar updated: user=%s", user.id)
    return jsonify({"avatar_url": public_url}), 200


# =============================================================================
# RESEARCHER JOIN ROUTES
# =============================================================================

def _lookup_invitation(token):
    """Hash token and return a valid ResearcherInvitation or None."""
    token_hash = hashlib.sha256(token.encode()).hexdigest()
    inv = ResearcherInvitation.query.filter_by(token_hash=token_hash).first()
    if not inv:
        return None
    now = datetime.now(timezone.utc)
    exp = inv.expires_at
    if exp.tzinfo is None:
        exp = exp.replace(tzinfo=timezone.utc)
    if inv.revoked_at or exp < now or inv.uses >= inv.max_uses:
        return None
    return inv


@auth_bp.route("/researcher/join/<token>", methods=["GET"])
def researcher_join_info(token):
    """
    Public route — returns invitation metadata so the join page can render.
    GET /auth/researcher/join/<token>
    """
    inv = _lookup_invitation(token)
    if not inv:
        return jsonify({"error": "Invalid or expired invitation"}), 404

    study_name = inv.study.study_name if inv.study else None
    return jsonify({
        "role": inv.role,
        "study_name": study_name,
        "expires_at": inv.expires_at.isoformat() if inv.expires_at else None,
    }), 200


@auth_bp.route("/researcher/join/<token>", methods=["POST"])
@login_required
def researcher_join_accept(token):
    """
    Authenticated route — accepts the invitation and creates a ResearcherRole.
    POST /auth/researcher/join/<token>
    """
    inv = _lookup_invitation(token)
    if not inv:
        return jsonify({"error": "Invalid or expired invitation"}), 404

    user_id = session["user_id"]

    existing = ResearcherRole.query.filter_by(
        user_id=user_id,
        study_id=inv.study_id,
        revoked_at=None,
    ).first()
    if existing:
        return jsonify({"error": "Already has role", "role": existing.role}), 409

    try:
        role_row = ResearcherRole(
            study_id=inv.study_id,
            user_id=user_id,
            role=inv.role,
            granted_by=inv.created_by,
        )
        db.session.add(role_row)

        inv.uses += 1
        inv.redeemed_by = user_id
        inv.redeemed_at = datetime.now(timezone.utc)
        if inv.uses >= inv.max_uses:
            inv.revoked_at = datetime.now(timezone.utc)

        _audit("RESEARCHER_ROLE_GRANTED", user_id=user_id, detail=f"role={inv.role} study={inv.study_id}")
        db.session.commit()
    except Exception:
        logger.error("Failed to accept researcher invite user=%s", user_id, exc_info=True)
        db.session.rollback()
        return jsonify({"error": "Failed to accept invitation"}), 500

    study_name = inv.study.study_name if inv.study else None
    return jsonify({"role": inv.role, "study_name": study_name}), 200


# =============================================================================
# JOIN LINK ROUTES
# =============================================================================

@auth_bp.route("/join/<code>", methods=["GET"])
@limiter.limit("20 per minute")
def join_landing(code):
    """
    GET /auth/join/<code> — Public route. Returns study info + pending token.
    Rate-limited to 20/min per IP.
    """
    round_ = StudyRound.query.filter(
        db.func.upper(StudyRound.join_code) == code.upper()
    ).first()

    if not round_:
        return jsonify({"error": "Invalid or expired join link"}), 404

    if round_.status not in ("enrolling", "active"):
        return jsonify({
            "error": "This study is not currently accepting participants",
            "status": round_.status,
        }), 409

    try:
        token = _issue_pending_token(round_.id, code, request)
    except Exception as e:
        logger.error("Failed to issue pending token for round=%s: %s", round_.id, str(e))
        return jsonify({"error": "Failed to generate join token. Please try again."}), 500

    consent_data = None
    try:
        consent = ConsentForm.query.filter_by(
            study_id=round_.study_id, is_active=True
        ).first()
        if consent:
            revision = (
                ConsentFormRevision.query
                .filter_by(consent_form_id=consent.id)
                .order_by(ConsentFormRevision.created_at.desc())
                .first()
            )
            if revision:
                consent_data = {
                    "form_id": consent.id,
                    "version": revision.version,
                    "title": consent.title,
                    "body_markdown": revision.body_markdown,
                    "irb_number": revision.irb_approval_number,
                }
    except Exception as e:
        logger.warning("Could not load consent form for join route: %s", str(e))
        consent_data = None
        # Continue without consent — do not 500

    return jsonify({
        "round_id": round_.id,
        "join_code": round_.join_code,
        "round_label": round_.round_label,
        "round_number": round_.round_number,
        "study_name": round_.study.study_name if round_.study else None,
        "study_description": round_.study.description if round_.study else None,
        "template_name": round_.template.name if round_.template else None,
        "num_weeks": round_.template.num_weeks if round_.template else None,
        "status": round_.status,
        "pending_token": token,
        "consent": consent_data,
    }), 200


@auth_bp.route("/join/<code>/enroll", methods=["POST"])
@login_required
def join_enroll(code):
    """
    POST /auth/join/<code>/enroll — Authenticated. Consumes pending token and creates enrollment.
    Body: { pending_token, consented: true, signature_meaning }
    """
    body = request.get_json() or {}
    user_id = session["user_id"]

    # Validate token via itsdangerous (48-hour max age)
    try:
        _signer.loads(body.get("pending_token", ""), max_age=48 * 3600)
    except Exception:
        return jsonify({
            "error": "Join link expired or invalid. Please request a fresh link."
        }), 400

    pe = PendingEnrollment.query.get(body.get("pending_token", ""))
    if not pe or pe.consumed_at:
        return jsonify({"error": "This join link has already been used."}), 400

    round_ = db.session.get(StudyRound, pe.round_id)
    if not round_ or round_.status not in ("enrolling", "active"):
        return jsonify({"error": "Round is no longer accepting participants"}), 409

    user = db.session.get(User, user_id)

    existing = Enrollment.query.filter_by(user_id=user.id, status="active").first()
    if existing:
        if existing.round_id == round_.id:
            return jsonify({
                "status": "already_enrolled",
                "message": "You are already enrolled.",
            }), 200
        current_round = db.session.get(StudyRound, existing.round_id)
        return jsonify({
            "error": "You are enrolled in another active study.",
            "current_round": current_round.round_label if current_round else None,
        }), 409

    prev = Enrollment.query.filter_by(
        user_id=user.id, round_id=round_.id, status="completed"
    ).first()
    if prev:
        return jsonify({"error": "You have already completed this study round."}), 409

    if not body.get("consented"):
        return jsonify({"error": "You must consent to participate before enrolling."}), 400

    now = datetime.now(timezone.utc)
    consent = ConsentForm.query.filter_by(
        study_id=round_.study_id, is_active=True
    ).first()
    revision = None
    if consent:
        revision = (
            ConsentFormRevision.query
            .filter_by(consent_form_id=consent.id)
            .order_by(ConsentFormRevision.created_at.desc())
            .first()
        )
        pc = ParticipantConsent(
            user_id=user.id,
            consent_form_id=consent.id,
            round_id=round_.id,
            consented_at=now,
            ip_address=_get_ip()[:50],
            user_agent=request.headers.get("User-Agent", "")[:200],
            consent_form_revision_id=revision.id if revision else None,
            signature_method="checkbox",
            signature_meaning=body.get(
                "signature_meaning", "I consent to participate in this research study"
            ),
        )
        db.session.add(pc)

    ip_hash = hashlib.sha256(
        (_get_ip() + now.strftime("%Y%m%d")).encode()
    ).hexdigest()[:16]
    ua_hash = hashlib.sha256(
        request.headers.get("User-Agent", "").encode()
    ).hexdigest()[:16]

    enrollment = Enrollment(
        user_id=user.id,
        round_id=round_.id,
        status="active",
        enrolled_ip_hash=ip_hash,
        user_agent_hash=ua_hash,
        utm_source=pe.utm_source,
        utm_medium=pe.utm_medium,
        utm_campaign=pe.utm_campaign,
        referrer=pe.referrer,
        join_method="join_link",
        consent_version=revision.version if (consent and revision) else None,
    )
    db.session.add(enrollment)
    user.active_round_id = round_.id
    pe.consumed_at = now

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Failed to create enrollment for user=%s round=%s", user.id, round_.id, exc_info=True)
        return jsonify({"error": "Enrollment failed. Please try again."}), 500

    _audit("ENROLLMENT_CREATED", user_id=user.id,
           detail=f"round={round_.id} method=join_link")

    return jsonify({
        "status": "enrolled",
        "message": "You have been enrolled successfully.",
        "round_id": round_.id,
        "round_label": round_.round_label,
        "study_name": round_.study.study_name if round_.study else None,
    }), 200


@auth_bp.route("/withdraw", methods=["POST"])
@login_required
def withdraw():
    """
    POST /auth/withdraw — Withdraw from active enrollment.
    Body: { scope, reason_optional, data_deletion_requested }
    """
    body = request.get_json() or {}
    user_id = session["user_id"]
    user = db.session.get(User, user_id)

    enrollment = Enrollment.query.filter_by(user_id=user_id, status="active").first()
    scope = body.get("scope", "full")
    if scope not in ("full", "data_only", "future_only"):
        scope = "full"

    now = datetime.now(timezone.utc)
    study_id = None
    round_id = None
    if enrollment:
        round_obj = db.session.get(StudyRound, enrollment.round_id)
        round_id = enrollment.round_id
        study_id = round_obj.study_id if round_obj else None

    withdrawal = WithdrawalRequest(
        user_id=user_id,
        study_id=study_id,
        round_id=round_id,
        scope=scope,
        reason_optional=body.get("reason_optional"),
        requested_at=now,
        effective_at=now,
        data_deletion_requested=bool(body.get("data_deletion_requested", False)),
        ip_address=_get_ip()[:50],
        user_agent=request.headers.get("User-Agent", "")[:200],
    )
    db.session.add(withdrawal)

    if enrollment and scope in ("full", "future_only"):
        enrollment.status = "withdrawn"
        enrollment.withdrawn_at = now
        user.active_round_id = None

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        logger.error("Withdrawal failed for user=%s", user_id, exc_info=True)
        return jsonify({"error": "Withdrawal failed. Please try again."}), 500

    _audit("ENROLLMENT_WITHDRAWN", user_id=user_id,
           detail=f"scope={scope} round={round_id}")

    return jsonify({
        "status": "withdrawn",
        "effective_at": withdrawal.effective_at.isoformat(),
    }), 200


# =============================================================================
# NOTIFICATION HELPERS
# =============================================================================

def _notif_dict(n: Notification) -> dict:
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "body": n.body,
        "action_url": n.action_url,
        "is_read": n.is_read,
        "read_at": n.read_at.isoformat() if n.read_at else None,
        "expires_at": n.expires_at.isoformat() if n.expires_at else None,
        "created_at": n.created_at.isoformat(),
    }


def _push_notification(user_id: int, notif_dict: dict) -> None:
    """Push a notification dict to all active SSE subscribers for user_id."""
    for q in _sse_subscribers.get(user_id, []):
        try:
            q.put_nowait(notif_dict)
        except queue_module.Full:
            pass


# =============================================================================
# NOTIFICATION ROUTES  (notif_bp — prefix /api)
# =============================================================================

@notif_bp.route("/notifications", methods=["GET"])
@login_required
def list_notifications():
    user_id = session["user_id"]
    unread_only = request.args.get("unread") == "1"
    limit = min(int(request.args.get("limit", 50)), 100)

    q = Notification.query.filter_by(user_id=user_id)
    if unread_only:
        q = q.filter_by(is_read=False)
    now = datetime.now(timezone.utc)
    q = q.filter(
        db.or_(Notification.expires_at == None, Notification.expires_at > now)  # noqa: E711
    )
    notifications = q.order_by(Notification.created_at.desc()).limit(limit).all()
    unread_count = Notification.query.filter_by(user_id=user_id, is_read=False).filter(
        db.or_(Notification.expires_at == None, Notification.expires_at > now)  # noqa: E711
    ).count()

    return jsonify({
        "notifications": [_notif_dict(n) for n in notifications],
        "unread_count": unread_count,
    }), 200


@notif_bp.route("/notifications/<int:notif_id>/read", methods=["POST"])
@login_required
def mark_notification_read(notif_id):
    user_id = session["user_id"]
    n = Notification.query.filter_by(id=notif_id, user_id=user_id).first()
    if not n:
        return jsonify({"error": "Not found"}), 404
    if not n.is_read:
        n.is_read = True
        n.read_at = datetime.now(timezone.utc)
        # Update delivery log opened_at
        log = NotificationDeliveryLog.query.filter_by(
            notification_id=n.id, user_id=user_id
        ).order_by(NotificationDeliveryLog.delivered_at.desc()).first()
        if log and not log.opened_at:
            log.opened_at = n.read_at
        db.session.commit()
    return jsonify(_notif_dict(n)), 200


@notif_bp.route("/notifications/read-all", methods=["POST"])
@login_required
def mark_all_read():
    user_id = session["user_id"]
    now = datetime.now(timezone.utc)
    Notification.query.filter_by(user_id=user_id, is_read=False).update(
        {"is_read": True, "read_at": now}, synchronize_session=False
    )
    db.session.commit()
    return jsonify({"ok": True}), 200


@notif_bp.route("/notifications/stream", methods=["GET"])
@login_required
def notification_stream():
    """Server-Sent Events stream for real-time notifications."""
    user_id = session["user_id"]
    q: queue_module.Queue = queue_module.Queue(maxsize=50)

    if user_id not in _sse_subscribers:
        _sse_subscribers[user_id] = []
    _sse_subscribers[user_id].append(q)

    def generate():
        try:
            yield "data: {}\n\n"  # heartbeat on connect
            while True:
                try:
                    msg = q.get(timeout=25)
                    yield f"data: {json.dumps(msg)}\n\n"
                except queue_module.Empty:
                    yield ": keep-alive\n\n"
        finally:
            try:
                _sse_subscribers[user_id].remove(q)
            except (KeyError, ValueError):
                pass

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@notif_bp.route("/notifications/preferences", methods=["GET"])
@login_required
def get_notification_preferences():
    user_id = session["user_id"]
    pref = NotificationPreference.query.filter_by(user_id=user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=user_id)
        db.session.add(pref)
        db.session.commit()
    return jsonify({
        "reminders_enabled": pref.reminders_enabled,
        "quiet_hours_start": pref.quiet_hours_start,
        "quiet_hours_end": pref.quiet_hours_end,
        "timezone": pref.timezone,
    }), 200


@notif_bp.route("/notifications/preferences", methods=["PATCH"])
@login_required
def update_notification_preferences():
    user_id = session["user_id"]
    data = request.get_json() or {}

    pref = NotificationPreference.query.filter_by(user_id=user_id).first()
    if not pref:
        pref = NotificationPreference(user_id=user_id)
        db.session.add(pref)

    if "reminders_enabled" in data:
        pref.reminders_enabled = bool(data["reminders_enabled"])
    if "quiet_hours_start" in data:
        h = int(data["quiet_hours_start"])
        if 0 <= h <= 23:
            pref.quiet_hours_start = h
    if "quiet_hours_end" in data:
        h = int(data["quiet_hours_end"])
        if 0 <= h <= 23:
            pref.quiet_hours_end = h
    if "timezone" in data and isinstance(data["timezone"], str):
        pref.timezone = data["timezone"][:64]
    pref.updated_at = datetime.now(timezone.utc)

    try:
        db.session.commit()
    except Exception:
        db.session.rollback()
        return jsonify({"error": "Failed to save preferences"}), 500

    return jsonify({
        "reminders_enabled": pref.reminders_enabled,
        "quiet_hours_start": pref.quiet_hours_start,
        "quiet_hours_end": pref.quiet_hours_end,
        "timezone": pref.timezone,
    }), 200
