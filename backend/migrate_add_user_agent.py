"""
One-time migration: add user_agent column to audit_log and session_log tables.

Run inside the container:
    docker exec brights2-web-1 python3 /app/migrate_add_user_agent.py

Or locally (with DB accessible):
    python3 backend/migrate_add_user_agent.py
"""
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db

with app.app_context():
    with db.engine.connect() as conn:
        conn.execute(db.text(
            "ALTER TABLE audit_log ADD COLUMN IF NOT EXISTS user_agent VARCHAR(300)"
        ))
        conn.execute(db.text(
            "ALTER TABLE session_log ADD COLUMN IF NOT EXISTS user_agent VARCHAR(300)"
        ))
        conn.commit()
    print("Added user_agent column to audit_log and session_log.")
    print("Migration complete.")
