"""
Centralized logging configuration for BRIGHTS2.

Usage in any module:
    import logging
    logger = logging.getLogger(__name__)
    logger.info("Something happened")

The request_id, user_id, and ip fields are injected automatically
by the RequestContextFilter when running inside a Flask request.
"""

import logging
import logging.handlers
import json
import os
from datetime import datetime, timezone


class RequestContextFilter(logging.Filter):
    """Inject Flask request context (request_id, user_id, ip) into every log record."""

    def filter(self, record):
        try:
            from flask import g, session, request, has_request_context

            if has_request_context():
                record.request_id = getattr(g, "request_id", "-")
                record.user_id = session.get("user_id", None)
                record.ip = request.remote_addr
            else:
                record.request_id = "-"
                record.user_id = None
                record.ip = None
        except Exception:
            record.request_id = "-"
            record.user_id = None
            record.ip = None
        return True


class JSONFormatter(logging.Formatter):
    """Structured JSON log formatter for production."""

    def format(self, record):
        log_entry = {
            "timestamp": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z",
            "level": record.levelname,
            "module": record.name,
            "request_id": getattr(record, "request_id", "-"),
            "user_id": getattr(record, "user_id", None),
            "ip": getattr(record, "ip", None),
            "message": record.getMessage(),
        }
        if record.exc_info and record.exc_info[0] is not None:
            log_entry["exception"] = self.formatException(record.exc_info)
        return json.dumps(log_entry)


class DevFormatter(logging.Formatter):
    """Human-readable log formatter for development."""

    def format(self, record):
        request_id = getattr(record, "request_id", "-")
        user_id = getattr(record, "user_id", None)
        ip = getattr(record, "ip", None)

        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        ctx = f"req={request_id}"
        if user_id is not None:
            ctx += f" user={user_id}"
        if ip is not None:
            ctx += f" ip={ip}"

        msg = f"{timestamp} [{record.levelname:<8}] {record.name} | {ctx} | {record.getMessage()}"
        if record.exc_info and record.exc_info[0] is not None:
            msg += "\n" + self.formatException(record.exc_info)
        return msg


def setup_logging(app=None):
    """
    Configure logging for the application.

    Call once at startup from app.py. Sets up:
    - Console handler (stdout) — always active
    - Rotating file handler — writes to /app/logs/ (inside Docker) or ./logs/ (local)
    - JSON format in production, human-readable in development
    """
    is_production = os.environ.get("FLASK_ENV") == "production"
    log_level = logging.INFO if is_production else logging.DEBUG

    # Create the root logger configuration
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Clear any existing handlers to avoid duplicates on reload
    root_logger.handlers.clear()

    # Pick formatter based on environment
    if is_production:
        formatter = JSONFormatter()
    else:
        formatter = DevFormatter()

    # --- Console handler (stdout) ---
    console_handler = logging.StreamHandler()
    console_handler.setLevel(log_level)
    console_handler.setFormatter(formatter)
    console_handler.addFilter(RequestContextFilter())
    root_logger.addHandler(console_handler)

    # --- Rotating file handler ---
    log_dir = os.environ.get("LOG_DIR", "logs")
    os.makedirs(log_dir, exist_ok=True)

    file_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(log_dir, "brights.log"),
        maxBytes=10 * 1024 * 1024,  # 10 MB
        backupCount=5,
        encoding="utf-8",
    )
    file_handler.setLevel(log_level)
    file_handler.setFormatter(formatter)
    file_handler.addFilter(RequestContextFilter())
    root_logger.addHandler(file_handler)

    # --- Security-specific log file ---
    security_handler = logging.handlers.RotatingFileHandler(
        filename=os.path.join(log_dir, "security.log"),
        maxBytes=10 * 1024 * 1024,
        backupCount=5,
        encoding="utf-8",
    )
    security_handler.setLevel(logging.INFO)
    security_handler.setFormatter(formatter)
    security_handler.addFilter(RequestContextFilter())

    security_logger = logging.getLogger("security")
    security_logger.addHandler(security_handler)

    # Quiet down noisy third-party loggers
    logging.getLogger("werkzeug").setLevel(logging.WARNING)
    logging.getLogger("sqlalchemy.engine").setLevel(
        logging.INFO if os.environ.get("SQL_DEBUG") else logging.WARNING
    )

    logger = logging.getLogger(__name__)
    logger.info(
        "Logging initialized | level=%s env=%s log_dir=%s",
        logging.getLevelName(log_level),
        "production" if is_production else "development",
        log_dir,
    )

    return root_logger
