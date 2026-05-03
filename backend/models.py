import secrets
from datetime import datetime, timedelta, timezone
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy.ext.hybrid import hybrid_property
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
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
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
        locked = self.locked_until
        if locked.tzinfo is None:
            locked = locked.replace(tzinfo=timezone.utc)
        return utcnow() < locked

    def record_failed_attempt(self):
        """Increment failed attempts, lock if threshold reached."""
        self.failed_attempts += 1
        if self.failed_attempts >= 5:
            self.locked_until = utcnow() + timedelta(minutes=15)

    def record_successful_login(self):
        """Reset failed attempts and update last login."""
        self.failed_attempts = 0
        self.locked_until = None
        self.last_login = utcnow()

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
    user_agent = db.Column(db.String(300), nullable=True)
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
    user_agent = db.Column(db.String(300), nullable=True)

    def record_logout(self):
        """Set logout time and compute session duration."""
        now = utcnow()
        self.logout_at = now
        if self.login_at:
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
    # likert7, goal_text
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


# =============================================================================
# Study lifecycle models — added to support multi-study platform features.
# =============================================================================


class Study(db.Model):
    """A research study with its own lifecycle, schema version, and participant cohort."""

    __tablename__ = "studies"

    id = db.Column(db.Integer, primary_key=True)
    study_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    study_name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    num_weeks = db.Column(db.Integer, nullable=False, default=6)
    week_lock_hours = db.Column(db.Integer, nullable=False, default=168)
    status = db.Column(
        db.String(20),
        nullable=False,
        default="draft",
        index=True,
    )  # draft | test | enrolling | collecting_only | closed | locked | archived
    schema_version = db.Column(db.Integer, nullable=False, default=1)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)
    closed_at = db.Column(db.DateTime, nullable=True)
    archived_at = db.Column(db.DateTime, nullable=True)

    creator = db.relationship("User", foreign_keys=[created_by], backref="created_studies")

    def to_dict(self):
        return {
            "id": self.id,
            "study_key": self.study_key,
            "study_name": self.study_name,
            "description": self.description,
            "num_weeks": self.num_weeks,
            "week_lock_hours": self.week_lock_hours,
            "status": self.status,
            "schema_version": self.schema_version,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
            "closed_at": self.closed_at.isoformat() if self.closed_at else None,
            "archived_at": self.archived_at.isoformat() if self.archived_at else None,
        }

    def __repr__(self):
        return f"<Study {self.study_key!r} [{self.status}] v{self.schema_version}>"


class ClientConfig(db.Model):
    """Per-client branding and theme configuration applied before React mounts."""

    __tablename__ = "client_configs"

    id = db.Column(db.Integer, primary_key=True)
    client_key = db.Column(db.String(64), unique=True, nullable=False, index=True)
    study_id = db.Column(db.Integer, db.ForeignKey("studies.id"), nullable=True)
    institution_name = db.Column(db.Text, nullable=False)
    contact_email = db.Column(db.String(120), nullable=True)
    primary_color = db.Column(db.String(20), nullable=False, default="#2563eb")
    secondary_color = db.Column(db.String(20), nullable=False, default="#1e40af")
    accent_color = db.Column(db.String(20), nullable=False, default="#4f7cff")
    logo_url = db.Column(db.Text, nullable=True)
    logo_url_dark = db.Column(db.Text, nullable=True)
    favicon_url = db.Column(db.Text, nullable=True)
    color_mode = db.Column(db.String(10), nullable=False, default="dark")
    border_radius = db.Column(db.String(20), nullable=False, default="12px")
    font_family = db.Column(db.Text, nullable=True)
    chart_palette = db.Column(db.ARRAY(db.Text), nullable=True)
    support_email = db.Column(db.String(120), nullable=True)
    support_url = db.Column(db.Text, nullable=True)
    irb_number = db.Column(db.String(64), nullable=True)
    consent_version = db.Column(db.String(32), nullable=True)
    custom_domain = db.Column(db.String(255), unique=True, nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    study = db.relationship("Study", backref="client_configs")

    def to_dict(self):
        return {
            "id": self.id,
            "client_key": self.client_key,
            "study_id": self.study_id,
            "institution_name": self.institution_name,
            "contact_email": self.contact_email,
            "primary_color": self.primary_color,
            "secondary_color": self.secondary_color,
            "accent_color": self.accent_color,
            "logo_url": self.logo_url,
            "logo_url_dark": self.logo_url_dark,
            "favicon_url": self.favicon_url,
            "color_mode": self.color_mode,
            "border_radius": self.border_radius,
            "font_family": self.font_family,
            "chart_palette": self.chart_palette,
            "support_email": self.support_email,
            "support_url": self.support_url,
            "irb_number": self.irb_number,
            "consent_version": self.consent_version,
            "custom_domain": self.custom_domain,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<ClientConfig {self.client_key!r} active={self.is_active}>"


class StudyImport(db.Model):
    """Tracks each CSV import attempt — validation results, diff preview, and confirmation state."""

    __tablename__ = "study_imports"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(db.Integer, db.ForeignKey("studies.id"), nullable=True)
    imported_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    import_type = db.Column(db.String(20), nullable=False, default="full")
    status = db.Column(db.String(20), nullable=False, default="pending")
    original_filename = db.Column(db.Text, nullable=True)
    questions_count = db.Column(db.Integer, nullable=True)
    warnings_count = db.Column(db.Integer, nullable=False, default=0)
    errors_count = db.Column(db.Integer, nullable=False, default=0)
    validation_errors = db.Column(db.JSON, nullable=True)
    preview_diff = db.Column(db.JSON, nullable=True)
    schema_version_from = db.Column(db.Integer, nullable=True)
    schema_version_to = db.Column(db.Integer, nullable=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    rolled_back_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study = db.relationship("Study", backref="imports")
    importer = db.relationship("User", foreign_keys=[imported_by], backref="study_imports")

    def __repr__(self):
        return f"<StudyImport study={self.study_id} status={self.status!r} errors={self.errors_count}>"


class StudyReset(db.Model):
    """Audit record for a study reset operation — requires pre-flight export before confirmation."""

    __tablename__ = "study_resets"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer,
        db.ForeignKey("studies.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    initiated_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    status = db.Column(db.String(20), nullable=False, default="pending")
    participants_affected = db.Column(db.Integer, nullable=True)
    responses_archived = db.Column(db.Integer, nullable=True)
    export_url = db.Column(db.Text, nullable=True)
    export_completed_at = db.Column(db.DateTime, nullable=True)
    confirmed_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)
    failed_at = db.Column(db.DateTime, nullable=True)
    failure_reason = db.Column(db.Text, nullable=True)
    notes = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study = db.relationship("Study", backref="resets")
    initiator = db.relationship("User", foreign_keys=[initiated_by], backref="initiated_resets")

    def __repr__(self):
        return f"<StudyReset study={self.study_id} status={self.status!r}>"


class ExportJob(db.Model):
    """Async job record for PDF, Excel, or ZIP data exports — expires 7 days after queuing."""

    __tablename__ = "export_jobs"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(db.Integer, db.ForeignKey("studies.id"), nullable=True)
    requested_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    export_type = db.Column(db.String(30), nullable=False)
    # pdf_report | excel_raw | excel_summary | excel_wide | zip_all
    status = db.Column(db.String(20), nullable=False, default="queued")
    file_url = db.Column(db.Text, nullable=True)
    file_size_bytes = db.Column(db.Integer, nullable=True)
    error_message = db.Column(db.Text, nullable=True)
    params = db.Column(db.JSON, nullable=True)
    queued_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    started_at = db.Column(db.DateTime, nullable=True)
    completed_at = db.Column(db.DateTime, nullable=True)

    study = db.relationship("Study", backref="export_jobs")
    requester = db.relationship("User", foreign_keys=[requested_by], backref="export_jobs")

    @hybrid_property
    def expires_at(self):
        """Computed as queued_at + 7 days; not stored as a generated DB column."""
        if self.queued_at is None:
            return None
        queued = self.queued_at
        if queued.tzinfo is None:
            queued = queued.replace(tzinfo=timezone.utc)
        return queued + timedelta(days=7)

    def __repr__(self):
        return f"<ExportJob study={self.study_id} type={self.export_type!r} status={self.status!r}>"


class ParticipantNote(db.Model):
    """Admin-authored note attached to a specific participant, optionally flagged for follow-up."""

    __tablename__ = "participant_notes"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    study_id = db.Column(db.Integer, db.ForeignKey("studies.id"), nullable=True)
    author_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    note_type = db.Column(db.String(30), nullable=False, default="general")
    body = db.Column(db.Text, nullable=False)
    is_flagged = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    participant = db.relationship(
        "User",
        foreign_keys=[user_id],
        backref="notes_about",
    )
    author = db.relationship(
        "User",
        foreign_keys=[author_id],
        backref="notes_authored",
    )
    study = db.relationship("Study", backref="participant_notes")

    def __repr__(self):
        return f"<ParticipantNote participant={self.user_id} author={self.author_id} flagged={self.is_flagged}>"
