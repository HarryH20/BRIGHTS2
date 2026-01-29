from datetime import datetime
from functools import wraps
from flask import Blueprint, request, jsonify, session
from models import db, User

auth_bp = Blueprint("auth", __name__, url_prefix="/auth")


# =============================================================================
# AUTH DECORATOR (for protecting routes)
# =============================================================================
def login_required(f):
    """Decorator to require authentication for a route."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Authentication required"}), 401
        return f(*args, **kwargs)
    return decorated_function


def admin_required(f):
    """Decorator to require admin role."""
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("user_id"):
            return jsonify({"error": "Authentication required"}), 401
        user = db.session.get(User, session["user_id"])
        if not user or user.role != "admin":
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
        return jsonify({"error": "Username already taken"}), 409

    if User.query.filter_by(email=email).first():
        return jsonify({"error": "Email already registered"}), 409

    # Create user
    user = User(username=username, email=email)
    user.set_password(password)

    db.session.add(user)
    db.session.commit()

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
    if username:
        user = User.query.filter_by(username=username).first()
    else:
        user = User.query.filter_by(email=email).first()

    if not user:
        return jsonify({"error": "Invalid credentials"}), 401

    # Check if account is locked
    if user.is_locked():
        return jsonify({
            "error": "Account locked due to too many failed attempts",
            "locked_until": user.locked_until.isoformat()
        }), 423

    # Verify password
    if not user.check_password(password):
        user.record_failed_attempt()
        db.session.commit()

        remaining = 5 - user.failed_attempts
        if user.is_locked():
            return jsonify({
                "error": "Account locked due to too many failed attempts",
                "locked_until": user.locked_until.isoformat()
            }), 423

        return jsonify({
            "error": "Invalid credentials",
            "attempts_remaining": max(0, remaining)
        }), 401

    # Successful login
    user.record_successful_login()
    db.session.commit()

    # Set session
    session.clear()
    session["user_id"] = user.id
    session["username"] = user.username
    session["role"] = user.role
    session.permanent = True

    return jsonify({
        "message": "Login successful",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
            "last_login": user.last_login.isoformat() if user.last_login else None
        }
    }), 200


@auth_bp.route("/logout", methods=["GET", "POST"])
def logout():
    """
    Clear session and log out user.

    GET/POST /auth/logout
    """
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
        session.clear()
        return jsonify({"error": "User not found"}), 404

    return jsonify({
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "role": user.role,
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
        return jsonify({"error": "Current password is incorrect"}), 401

    user.set_password(new_password)
    db.session.commit()

    return jsonify({"message": "Password changed successfully"}), 200
