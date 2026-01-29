from datetime import datetime
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")  # user, admin
    created_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)
    last_login = db.Column(db.DateTime, nullable=True)
    failed_attempts = db.Column(db.Integer, nullable=False, default=0)
    locked_until = db.Column(db.DateTime, nullable=True)

    def set_password(self, password):
        """Hash and store password."""
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        """Verify password against stored hash."""
        return check_password_hash(self.password_hash, password)

    def is_locked(self):
        """Check if account is currently locked."""
        if self.locked_until is None:
            return False
        return datetime.utcnow() < self.locked_until

    def record_failed_attempt(self):
        """Increment failed attempts, lock if threshold reached."""
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            # Lock for 15 minutes
            from datetime import timedelta

            self.locked_until = datetime.utcnow() + timedelta(minutes=15)

    def record_successful_login(self):
        """Reset failed attempts and update last login."""
        self.failed_attempts = 0
        self.locked_until = None
        self.last_login = datetime.utcnow()

    def __repr__(self):
        return f"<User {self.username}>"
