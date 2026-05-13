workers = 2
threads = 2
bind = "0.0.0.0:5000"
timeout = 120

# Replace the default "gunicorn" Server header to reduce version fingerprinting
server_software = "server"


def on_starting(server):
    """Create DB tables once in the master process before workers fork.
    Avoids the race condition where two workers simultaneously try to CREATE TABLE
    on a fresh database, causing a UniqueViolation on pg_type."""
    import sys, os
    sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
    from app import app, db
    with app.app_context():
        db.create_all()
