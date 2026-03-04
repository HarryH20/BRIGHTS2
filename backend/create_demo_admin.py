"""
One-off script: create (or reset) the demo_admin user.

Usage (from the backend/ directory):
    python create_demo_admin.py

The script is idempotent — running it again just updates the password.
"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app import app
from models import db, User

USERNAME = "demo_admin"
EMAIL = "demo_admin@brights.local"
PASSWORD = "DemoAdmin2026!"

with app.app_context():
    user = User.query.filter_by(username=USERNAME).first()
    if user is None:
        user = User(username=USERNAME, email=EMAIL, role="admin")
        db.session.add(user)
        print(f"Creating new user: {USERNAME}")
    else:
        print(f"User {USERNAME} already exists — updating password and role.")
        user.role = "admin"

    user.set_password(PASSWORD)
    db.session.commit()
    print(f"Done. Login: username={USERNAME}  password={PASSWORD}")
