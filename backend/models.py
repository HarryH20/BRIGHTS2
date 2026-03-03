import secrets
from datetime import datetime, timezone
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash

db = SQLAlchemy()


def utcnow():
    """Timezone-aware UTC timestamp."""
    return datetime.now(timezone.utc)


class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False, index=True)
    email = db.Column(db.String(120), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)
    role = db.Column(db.String(20), nullable=False, default="user")  # user, admin
    participant_id = db.Column(db.String(32), unique=True, nullable=True, index=True)
    avatar_url = db.Column(db.Text, nullable=True)
    display_name = db.Column(db.String(100), nullable=True)
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


class AuditLog(db.Model):
    """Immutable record of security and user activity events."""

    __tablename__ = "audit_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True, index=True)
    event_type = db.Column(db.String(50), nullable=False, index=True)
    detail = db.Column(db.Text, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)  # IPv6 max length
    request_id = db.Column(db.String(36), nullable=True)
    timestamp = db.Column(db.DateTime, nullable=False, default=utcnow)

    # Event type constants
    LOGIN_SUCCESS = "LOGIN_SUCCESS"
    LOGIN_FAILED = "LOGIN_FAILED"
    LOGOUT = "LOGOUT"
    REGISTER = "REGISTER"
    PASSWORD_CHANGE = "PASSWORD_CHANGE"
    ACCOUNT_LOCKED = "ACCOUNT_LOCKED"
    ACCOUNT_UNLOCKED = "ACCOUNT_UNLOCKED"
    UNAUTHORIZED_ACCESS = "UNAUTHORIZED_ACCESS"
    SESSION_EXPIRED = "SESSION_EXPIRED"

    def __repr__(self):
        return f"<AuditLog {self.event_type} user={self.user_id} @ {self.timestamp}>"


class SessionLog(db.Model):
    """Tracks login/logout pairs with session duration."""

    __tablename__ = "session_log"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    login_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    logout_at = db.Column(db.DateTime, nullable=True)
    duration_seconds = db.Column(db.Integer, nullable=True)
    ip_address = db.Column(db.String(45), nullable=True)

    def record_logout(self):
        """Set logout time and compute session duration."""
        now = utcnow()
        self.logout_at = now
        if self.login_at:
            # Normalize both to aware or both to naive for safe subtraction
            login = self.login_at
            if login.tzinfo is None:
                login = login.replace(tzinfo=timezone.utc)
            delta = now - login
            self.duration_seconds = int(delta.total_seconds())

    def __repr__(self):
        return f"<SessionLog user={self.user_id} login={self.login_at}>"


class SurveyQuestion(db.Model):
    """Admin-editable question bank. Questions are never deleted — only deactivated."""

    __tablename__ = "survey_questions"

    id = db.Column(db.Integer, primary_key=True)
    # t1, t2, t3t5, t6  (t3-t5 share the same question set)
    form_type = db.Column(db.String(10), nullable=False, index=True)
    question_number = db.Column(db.Integer, nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    # likert7, likert5, open_text, slider100
    scale_type = db.Column(db.String(20), nullable=False, default="likert7")
    status = db.Column(db.String(10), nullable=False, default="active", index=True)  # active | inactive
    display_order = db.Column(db.Integer, nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def __repr__(self):
        return f"<SurveyQuestion {self.form_type} Q{self.question_number} [{self.status}]>"


class SurveySubmission(db.Model):
    """Tracks which timepoints a user has completed and when the next one unlocks."""

    __tablename__ = "survey_submissions"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    timepoint = db.Column(db.Integer, nullable=False)  # 1–6
    submitted_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    next_unlocks_at = db.Column(db.DateTime, nullable=True)  # submitted_at + 7 days; NULL for T6

    def __repr__(self):
        return f"<SurveySubmission user={self.user_id} T{self.timepoint}>"


class SurveyResponse(db.Model):
    """Normalized per-question responses from form submissions."""

    __tablename__ = "survey_responses"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    goal_index = db.Column(db.Integer, nullable=False)  # 1, 2, or 3
    timepoint = db.Column(db.Integer, nullable=False, index=True)  # 1–6
    question_id = db.Column(db.Integer, db.ForeignKey("survey_questions.id"), nullable=False)
    response_value = db.Column(db.Text, nullable=True)  # stored as text; cast on read
    submitted_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def __repr__(self):
        return f"<SurveyResponse user={self.user_id} T{self.timepoint} G{self.goal_index} Q{self.question_id}>"
