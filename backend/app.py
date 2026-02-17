import os
import time
import uuid
import logging

from flask import Flask, g, request, session
from dotenv import load_dotenv

from models import db
from logging_config import setup_logging

load_dotenv()

# =============================================================================
# LOGGING — must initialize before anything else
# =============================================================================
setup_logging()
logger = logging.getLogger(__name__)

# =============================================================================
# APP FACTORY
# =============================================================================
app = Flask(__name__)

app.config.update(
    SECRET_KEY=os.environ.get("FLASK_SECRET_KEY"),
    SESSION_COOKIE_SECURE=os.environ.get("FLASK_ENV") == "production",
    SESSION_COOKIE_HTTPONLY=True,
    SESSION_COOKIE_SAMESITE="Lax",
    PERMANENT_SESSION_LIFETIME=1800,  # 30 minute timeout
)

app.config["SQLALCHEMY_DATABASE_URI"] = os.environ.get("DATABASE_URL")
app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False

db.init_app(app)

# Register blueprints
from routes.auth import auth_bp
from routes.visualizations import viz_bp
from routes.logs import logs_bp
from routes.admin import admin_bp

app.register_blueprint(auth_bp)
app.register_blueprint(viz_bp)
app.register_blueprint(logs_bp)
app.register_blueprint(admin_bp)

# Create tables
with app.app_context():
    db.create_all()
    logger.info("Database tables verified/created")


# =============================================================================
# MIDDLEWARE — Request ID + Timing
# =============================================================================
@app.before_request
def before_request_logging():
    """Assign a unique request ID and start the request timer."""
    g.request_id = str(uuid.uuid4())
    g.request_start = time.time()


@app.after_request
def after_request_logging(response):
    """Log the completed request with timing and status."""
    # Calculate response time
    duration_ms = (time.time() - g.get("request_start", time.time())) * 1000

    # Attach request ID to response for client-side debugging
    response.headers["X-Request-ID"] = g.get("request_id", "-")

    # Skip logging for health checks to reduce noise
    if request.path == "/" and request.method == "GET":
        return response

    user_id = session.get("user_id", None)
    log_msg = (
        "%s %s -> %s (%.1fms) user_agent=%s",
        request.method,
        request.path,
        response.status_code,
        duration_ms,
        request.user_agent.string[:100] if request.user_agent.string else "-",
    )

    if response.status_code >= 500:
        logger.error(*log_msg)
    elif response.status_code >= 400:
        logger.warning(*log_msg)
    elif duration_ms > 500:
        logger.warning(
            "SLOW REQUEST: %s %s -> %s (%.1fms)",
            request.method,
            request.path,
            response.status_code,
            duration_ms,
        )
    else:
        logger.info(*log_msg)

    return response


# =============================================================================
# SECURITY HEADERS
# =============================================================================
@app.after_request
def set_security_headers(response):
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"
    response.headers["Content-Security-Policy"] = (
        "default-src 'self'; "
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; "
        "style-src 'self' 'unsafe-inline'; "
        "img-src 'self' data:; "
        "font-src 'self' data:; "
        "connect-src 'self'"
    )
    if os.environ.get("FLASK_ENV") == "production":
        response.headers["Strict-Transport-Security"] = (
            "max-age=31536000; includeSubDomains"
        )
    return response


# =============================================================================
# ERROR HANDLERS
# =============================================================================
@app.errorhandler(400)
def bad_request(error):
    logger.warning("Bad request: %s %s — %s", request.method, request.path, error)
    return {"error": "Bad request"}, 400


@app.errorhandler(404)
def not_found(error):
    logger.info("Not found: %s %s", request.method, request.path)
    return {"error": "Not found"}, 404


@app.errorhandler(405)
def method_not_allowed(error):
    logger.warning("Method not allowed: %s %s", request.method, request.path)
    return {"error": "Method not allowed"}, 405


@app.errorhandler(500)
def internal_error(error):
    logger.error("Internal server error: %s %s", request.method, request.path, exc_info=True)
    return {"error": "Internal server error"}, 500


@app.errorhandler(Exception)
def unhandled_exception(error):
    logger.error(
        "Unhandled exception on %s %s: %s",
        request.method,
        request.path,
        str(error),
        exc_info=True,
    )
    return {"error": "Internal server error"}, 500


# =============================================================================
# ROUTES
# =============================================================================
@app.route("/")
def health_check():
    """Basic health check — extended with DB status and uptime."""
    health = {
        "status": "healthy",
        "service": "brights-api",
    }
    # Check database connectivity
    try:
        db.session.execute(db.text("SELECT 1"))
        health["database"] = "connected"
    except Exception as e:
        health["status"] = "degraded"
        health["database"] = "disconnected"
        logger.error("Health check: database unreachable — %s", str(e))
    return health


# =============================================================================
# APP ENTRY POINT
# =============================================================================
if __name__ == "__main__":
    is_dev = os.environ.get("FLASK_ENV") != "production"
    logger.info(
        "Starting BRIGHTS2 API | host=0.0.0.0 port=5000 debug=%s env=%s",
        is_dev,
        os.environ.get("FLASK_ENV", "development"),
    )
    app.run(host="0.0.0.0", port=5000, debug=is_dev)
