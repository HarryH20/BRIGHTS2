"""
One-time migration: add participant_id column, clear dev accounts, seed 3 demo accounts.

Run inside the container:
    docker exec brights2-web-1 python3 /app/migrate_add_participant_id.py

Or locally (with DB accessible):
    python3 backend/migrate_add_participant_id.py
"""
import sys
import os

# Allow running from repo root or from backend/
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from models import User, AuditLog, SessionLog

DEMO_ACCOUNTS = [
    ("demo1", "demo1@brights.dev", "18BF3F62EA1E48C99F02957B74EF2626"),
    ("demo2", "demo2@brights.dev", "1B0A3B436BDB444C985971D16F65ECFD"),
    ("demo3", "demo3@brights.dev", "0B82D3E1CCFC4BD6979FF97C94AD7AEE"),
]

DEMO_PASSWORD = "BrightsDemo2026!"
ADMIN_USERNAME = "admin"
ADMIN_EMAIL = "admin@brights.dev"
ADMIN_PASSWORD = "BrightsAdmin2026!"

with app.app_context():
    # Add column if it doesn't exist yet
    with db.engine.connect() as conn:
        conn.execute(db.text(
            "ALTER TABLE users ADD COLUMN IF NOT EXISTS participant_id VARCHAR(32) UNIQUE"
        ))
        conn.commit()
    print("Column participant_id ensured.")

    # Clear dependent tables first (FK constraints)
    sl = SessionLog.query.delete()
    al = AuditLog.query.delete()
    db.session.commit()
    print(f"Cleared {al} audit log row(s) and {sl} session log row(s).")

    # Now clear all existing accounts
    deleted = User.query.delete()
    db.session.commit()
    print(f"Cleared {deleted} existing user(s).")

    # Seed admin account
    admin = User(username=ADMIN_USERNAME, email=ADMIN_EMAIL, role="admin")
    admin.set_password(ADMIN_PASSWORD)
    db.session.add(admin)

    # Seed demo participant accounts
    for username, email, pid in DEMO_ACCOUNTS:
        u = User(username=username, email=email, participant_id=pid)
        u.set_password(DEMO_PASSWORD)
        db.session.add(u)

    db.session.commit()
    print(f"Created admin account:")
    print(f"  {ADMIN_USERNAME} / {ADMIN_PASSWORD}")
    print(f"Created {len(DEMO_ACCOUNTS)} demo participant account(s):")
    for username, email, pid in DEMO_ACCOUNTS:
        print(f"  {username} / {DEMO_PASSWORD}  ->  participant_id={pid}")

    print("Migration complete.")
