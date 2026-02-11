import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

logs_bp = Blueprint("logs", __name__, url_prefix="/api/logs")


@logs_bp.route("/frontend", methods=["POST"])
def frontend_error():
    """
    Receive error reports from the frontend.

    POST /api/logs/frontend
    Body: {"error": "...", "stack": "...", "component": "...", "url": "...", "timestamp": "..."}

    This endpoint is intentionally unauthenticated so it can capture
    errors that occur before or during login.
    """
    data = request.get_json(silent=True)
    if not data:
        return jsonify({"error": "Request body required"}), 400

    error_msg = data.get("error", "Unknown error")
    stack = data.get("stack", "")
    component = data.get("component", "")
    url = data.get("url", "")
    client_timestamp = data.get("timestamp", "")

    # Truncate to prevent log flooding
    logger.error(
        "FRONTEND ERROR: %s | url=%s component=%s timestamp=%s\n%s",
        error_msg[:200],
        url[:200],
        component[:200],
        client_timestamp,
        stack[:1000],
    )

    return jsonify({"status": "logged"}), 200
