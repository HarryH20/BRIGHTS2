"""
Fix consent_forms table: make orphaned NOT NULL columns nullable.

The consent_forms table was created when the model had version/body_markdown
directly on ConsentForm. Those fields were later moved to ConsentFormRevision,
but the DB columns remain with NOT NULL constraints, blocking all inserts.

Run with:
    docker exec brights2-web-1 python3 migrate_fix_consent_forms.py
"""
import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from app import app, db
from sqlalchemy import text, inspect

with app.app_context():
    inspector = inspect(db.engine)
    cols = {c["name"]: c for c in inspector.get_columns("consent_forms")}

    orphaned = ["version", "body_markdown", "requires_recon"]
    to_fix = [col for col in orphaned if col in cols and not cols[col]["nullable"]]

    if not to_fix:
        print("consent_forms schema is already correct — nothing to do.")
        sys.exit(0)

    print(f"Fixing NOT NULL on: {to_fix}")

    parts = ", ".join(f"ALTER COLUMN {col} DROP NOT NULL" for col in to_fix)
    sql = f"ALTER TABLE consent_forms {parts}"

    with db.engine.begin() as conn:
        conn.execute(text(sql))

    print("Done. consent_forms columns are now nullable:")
    for c in inspector.get_columns("consent_forms"):
        print(f"  {c['name']}: nullable={c['nullable']}")
