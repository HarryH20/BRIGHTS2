"""
Shared Flask extensions — initialised here, bound to the app in app.py.
Avoids circular imports between app.py and route blueprints.
"""
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Rate limiter — key by real client IP (ProxyFix already unwraps X-Forwarded-For).
# Storage is in-memory per process; with Gunicorn 2 workers each worker enforces
# the limit independently (effective limit is 2x per deployment). Good enough for
# pentest hardening without requiring Redis.
limiter = Limiter(key_func=get_remote_address, default_limits=[])
