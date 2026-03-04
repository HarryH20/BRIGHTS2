import logging
import os
import secrets
from datetime import datetime, timezone
from functools import wraps
from flask import Blueprint, request, jsonify, session, g
import requests as http_req
from models import db, User, AuditLog, SessionLog

logger = logging.getLogger(__name__)
security_logger = logging.getLogger("security")

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# =============================================================================
# HELPERS
# =============================================================================
def _get_ip():
    """Get client IP, respecting X-Forwarded-For behind a proxy."""
    return request.headers.get("X-Forwarded-For", request.remote_addr)


def _get_request_id():
    return getattr(g, "request_id", None)


def _audit(event_type, user_id=None, detail=None):
    """Write an audit log entry to the database."""
    try:
        entry = AuditLog(
            user_id=user_id,
            event_type=event_type,
            detail=detail,
            ip_address=_get_ip(),
            request_id=_get_request_id(),
        )
        db.session.add(entry)
        db.session.commit()
    except Exception:
        logger.error("Failed to write audit log: %s user=%s", event_type, user_id, exc_info=True)
        db.session.rollback()


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
# ROUTES
# =============================================================================
@auth_bp.route("/register", methods=["POST"])
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

    return jsonify({
        "message": "User registered successfully",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role
        }
    }), 201


@auth_bp.route("/login", methods=["POST"])
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
@login_required
def me():
    """
    Get current authenticated user info.

    GET /auth/me
    """
    user = db.session.get(User, session["user_id"])

    if not user:
        logger.warning("Session references non-existent user_id=%s, clearing session", session["user_id"])
        _audit(AuditLog.SESSION_EXPIRED, user_id=session["user_id"], detail="User not found in database")
        session.clear()
        return jsonify({"error": "User not found"}), 404

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
            "last_login": user.last_login.isoformat() if user.last_login else None
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
