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
    active_round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    active_round = db.relationship(
        "StudyRound",
        foreign_keys="[User.active_round_id]",
        backref="active_participants",
    )

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
    round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    enrollment_id = db.Column(
        db.Integer,
        db.ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True,
    )

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
    round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="SET NULL"),
        nullable=True,
    )
    enrollment_id = db.Column(
        db.Integer,
        db.ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True,
    )

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


# =============================================================================
# Round/enrollment models — added to support multi-round study management.
# =============================================================================


class StudyTemplate(db.Model):
    """Reusable study design template defining question sets, schedule, and configuration."""

    __tablename__ = "study_templates"

    id = db.Column(db.Integer, primary_key=True)
    template_key = db.Column(db.Text, unique=True, nullable=False)
    name = db.Column(db.Text, nullable=False)
    description = db.Column(db.Text, nullable=True)
    category = db.Column(db.Text, nullable=True)
    num_weeks = db.Column(db.Integer, nullable=False, default=6)
    week_lock_hours = db.Column(db.Integer, nullable=False, default=168)
    is_preset = db.Column(db.Boolean, nullable=False, default=False)
    is_archived = db.Column(db.Boolean, nullable=False, default=False)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    creator = db.relationship("User", foreign_keys=[created_by])
    questions = db.relationship("TemplateQuestion", backref="template")
    # rounds backref defined on StudyRound.template (backref='rounds' added there)

    def to_dict(self):
        return {
            "id": self.id,
            "template_key": self.template_key,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "num_weeks": self.num_weeks,
            "week_lock_hours": self.week_lock_hours,
            "is_preset": self.is_preset,
            "is_archived": self.is_archived,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<StudyTemplate {self.template_key!r} preset={self.is_preset}>"


class TemplateQuestion(db.Model):
    """A question definition belonging to a study template, scoped to specific timepoints."""

    __tablename__ = "template_questions"
    __table_args__ = (db.UniqueConstraint("template_id", "variable_name"),)

    id = db.Column(db.Integer, primary_key=True)
    template_id = db.Column(
        db.Integer,
        db.ForeignKey("study_templates.id", ondelete="RESTRICT"),
        nullable=False,
    )
    variable_name = db.Column(db.Text, nullable=False)
    question_text = db.Column(db.Text, nullable=False)
    scale_type = db.Column(db.Text, nullable=False, default="likert7")
    timepoints = db.Column(db.ARRAY(db.Integer), nullable=False)
    scope = db.Column(db.Text, nullable=False, default="per_goal")
    display_order = db.Column(db.Integer, nullable=False, default=0)
    is_required = db.Column(db.Boolean, nullable=False, default=True)
    config = db.Column(db.JSON, nullable=True)
    status = db.Column(db.Text, nullable=False, default="active")
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def __repr__(self):
        return f"<TemplateQuestion {self.variable_name!r} template={self.template_id} [{self.status}]>"


class StudyRound(db.Model):
    """A round of data collection within a study, linked to a template and its own enrollment cohort."""

    __tablename__ = "study_rounds"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer, db.ForeignKey("studies.id", ondelete="RESTRICT"), nullable=False
    )
    template_id = db.Column(
        db.Integer,
        db.ForeignKey("study_templates.id", ondelete="RESTRICT"),
        nullable=False,
    )
    round_number = db.Column(db.Integer, nullable=False, default=1)
    round_label = db.Column(db.Text, nullable=True)
    join_code = db.Column(db.Text, nullable=True)
    status = db.Column(
        db.Text, nullable=False, default="draft"
    )  # draft|enrolling|active|closed|archived
    enrollment_opens_at = db.Column(db.DateTime, nullable=True)
    enrollment_closes_at = db.Column(db.DateTime, nullable=True)
    data_collection_ends_at = db.Column(db.DateTime, nullable=True)
    schema_version = db.Column(db.Integer, nullable=False, default=1)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    study = db.relationship("Study", backref="rounds")
    template = db.relationship("StudyTemplate", foreign_keys=[template_id], backref="rounds")
    creator = db.relationship("User", foreign_keys=[created_by])
    enrollments = db.relationship("Enrollment", backref="round")

    def to_dict(self):
        return {
            "id": self.id,
            "study_id": self.study_id,
            "template_id": self.template_id,
            "round_number": self.round_number,
            "round_label": self.round_label,
            "join_code": self.join_code,
            "status": self.status,
            "enrollment_opens_at": self.enrollment_opens_at.isoformat() if self.enrollment_opens_at else None,
            "enrollment_closes_at": self.enrollment_closes_at.isoformat() if self.enrollment_closes_at else None,
            "data_collection_ends_at": self.data_collection_ends_at.isoformat() if self.data_collection_ends_at else None,
            "schema_version": self.schema_version,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<StudyRound study={self.study_id} round={self.round_number} [{self.status}]>"


class Enrollment(db.Model):
    """A participant's active enrollment in a specific study round."""

    __tablename__ = "enrollments"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="RESTRICT"), nullable=False
    )
    status = db.Column(
        db.Text, nullable=False, default="active"
    )  # active|withdrawn|completed|excluded
    enrolled_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    completed_at = db.Column(db.DateTime, nullable=True)
    withdrawn_at = db.Column(db.DateTime, nullable=True)
    withdrawal_reason = db.Column(db.Text, nullable=True)
    consent_version = db.Column(db.Text, nullable=True)
    device_type = db.Column(db.Text, nullable=True)
    user_agent_hash = db.Column(db.Text, nullable=True)
    enrolled_ip_hash = db.Column(db.Text, nullable=True)
    utm_source = db.Column(db.Text, nullable=True)
    utm_medium = db.Column(db.Text, nullable=True)
    utm_campaign = db.Column(db.Text, nullable=True)
    referrer = db.Column(db.Text, nullable=True)
    join_method = db.Column(db.Text, nullable=True)
    condition_label = db.Column(db.Text, nullable=True)
    condition_group = db.Column(db.Text, nullable=True)

    participant = db.relationship("User", foreign_keys=[user_id], backref="enrollments")
    # round backref defined in StudyRound.enrollments relationship — do not redefine here

    def __repr__(self):
        return f"<Enrollment user={self.user_id} round={self.round_id} [{self.status}]>"


class EnrollmentInvitation(db.Model):
    """Invitation for a participant to join a study round."""

    __tablename__ = "enrollment_invitations"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
    )
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="CASCADE"), nullable=False
    )
    invited_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    status = db.Column(
        db.Text, nullable=False, default="pending"
    )  # pending|accepted|declined|expired
    message = db.Column(db.Text, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    accepted_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    participant = db.relationship("User", foreign_keys=[user_id])
    inviter = db.relationship("User", foreign_keys=[invited_by])
    round = db.relationship("StudyRound", foreign_keys=[round_id])

    def __repr__(self):
        return f"<EnrollmentInvitation user={self.user_id} round={self.round_id} [{self.status}]>"


class RoundComparison(db.Model):
    """Saved comparison configuration between two study rounds for research analysis."""

    __tablename__ = "round_comparisons"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer, db.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False
    )
    name = db.Column(db.Text, nullable=False)
    round_a_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="RESTRICT"), nullable=False
    )
    round_b_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="RESTRICT"), nullable=False
    )
    notes = db.Column(db.Text, nullable=True)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study = db.relationship("Study", backref="comparisons")
    round_a = db.relationship("StudyRound", foreign_keys=[round_a_id])
    round_b = db.relationship("StudyRound", foreign_keys=[round_b_id])
    creator = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<RoundComparison study={self.study_id} {self.round_a_id}v{self.round_b_id}>"


# =============================================================================
# Researcher roles and invitations — added for multi-researcher RBAC (migration 005).
# =============================================================================


class ResearcherRole(db.Model):
    """Study-scoped role assignment for a researcher user."""

    __tablename__ = "researcher_roles"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer, db.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = db.Column(db.Text, nullable=False)
    granted_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    granted_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )

    # Added in migration 005
    revoked_at = db.Column(db.DateTime, nullable=True)
    revoked_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    last_access_at = db.Column(db.DateTime, nullable=True)
    citi_completion_date = db.Column(db.Date, nullable=True)
    notes = db.Column(db.Text, nullable=True)

    study = db.relationship("Study", foreign_keys=[study_id], backref="researcher_roles")
    researcher = db.relationship("User", foreign_keys=[user_id], backref="researcher_roles")
    granter = db.relationship("User", foreign_keys=[granted_by])
    revoker = db.relationship("User", foreign_keys=[revoked_by])

    def __repr__(self):
        return f"<ResearcherRole user={self.user_id} study={self.study_id} role={self.role!r}>"


class ResearcherInvitation(db.Model):
    """Single-use signed invitation for a user to join a study as a researcher."""

    __tablename__ = "researcher_invitations"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer, db.ForeignKey("studies.id", ondelete="CASCADE"), nullable=False, index=True
    )
    role = db.Column(db.Text, nullable=False)
    token_hash = db.Column(db.Text, nullable=False, unique=True)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    redeemed_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    redeemed_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    max_uses = db.Column(db.Integer, nullable=False, default=1)
    uses = db.Column(db.Integer, nullable=False, default=0)
    revoked_at = db.Column(db.DateTime, nullable=True)
    revoked_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study = db.relationship("Study", foreign_keys=[study_id], backref="researcher_invitations")
    creator = db.relationship("User", foreign_keys=[created_by])
    redeemer = db.relationship("User", foreign_keys=[redeemed_by])

    def __repr__(self):
        return f"<ResearcherInvitation study={self.study_id} role={self.role!r} uses={self.uses}/{self.max_uses}>"


# =============================================================================
# Data quality flag models — added in migration 007.
# =============================================================================


class DataQualityFlag(db.Model):
    """Per-submission quality flag raised by automated detection or manually by a researcher.
    Flags are ADVISORY ONLY — data is never deleted or excluded automatically."""

    __tablename__ = "data_quality_flags"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="RESTRICT"),
        nullable=False,
        index=True,
    )
    round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    submission_id = db.Column(
        db.Integer,
        db.ForeignKey("survey_submissions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    flag_type = db.Column(db.Text, nullable=False)
    severity = db.Column(db.Text, nullable=False)  # critical | warning | info
    detail = db.Column(db.JSON, nullable=True)
    auto_generated = db.Column(db.Boolean, nullable=False, default=True)
    is_resolved = db.Column(db.Boolean, nullable=False, default=False)
    resolved_at = db.Column(db.DateTime, nullable=True)
    justification = db.Column(db.Text, nullable=False, default="")
    resolved_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    participant = db.relationship("User", foreign_keys=[user_id], backref="quality_flags")
    resolver = db.relationship("User", foreign_keys=[resolved_by_user_id])
    submission = db.relationship("SurveySubmission", foreign_keys=[submission_id], backref="quality_flags")
    round = db.relationship("StudyRound", foreign_keys=[round_id], backref="quality_flags")

    def __repr__(self):
        return f"<DataQualityFlag user={self.user_id} type={self.flag_type!r} severity={self.severity!r} resolved={self.is_resolved}>"


class QualityCheckRun(db.Model):
    """Audit record for each automated or manual quality check run."""

    __tablename__ = "quality_check_runs"

    id = db.Column(db.Integer, primary_key=True)
    submission_id = db.Column(
        db.Integer,
        db.ForeignKey("survey_submissions.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    triggered_by = db.Column(db.Text, nullable=False)
    triggered_by_user_id = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    config_snapshot = db.Column(db.JSON, nullable=False)
    code_version = db.Column(db.Text, nullable=False, default="unknown")
    flags_created = db.Column(db.Integer, nullable=False, default=0)
    duration_ms = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    def __repr__(self):
        return f"<QualityCheckRun submission={self.submission_id} triggered_by={self.triggered_by!r} flags={self.flags_created}>"


class FlagThresholdConfig(db.Model):
    """Researcher-configured detection thresholds per round and flag type.
    New rows are appended (effective_from versioning); prior rows are never modified."""

    __tablename__ = "flag_threshold_configs"

    id = db.Column(db.Integer, primary_key=True)
    round_id = db.Column(
        db.Integer,
        db.ForeignKey("study_rounds.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    flag_type = db.Column(db.Text, nullable=False)
    thresholds = db.Column(db.JSON, nullable=False)
    preregistered = db.Column(db.Boolean, nullable=False, default=False)
    prereg_url = db.Column(db.Text, nullable=True)
    effective_from = db.Column(db.DateTime, nullable=False, default=utcnow)
    created_by = db.Column(
        db.Integer,
        db.ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )

    round = db.relationship("StudyRound", foreign_keys=[round_id], backref="flag_threshold_configs")
    creator = db.relationship("User", foreign_keys=[created_by])

    def __repr__(self):
        return f"<FlagThresholdConfig round={self.round_id} type={self.flag_type!r} preregistered={self.preregistered}>"

# =============================================================================
# Consent management models — added for self-enrollment and consent features.
# =============================================================================


class ConsentForm(db.Model):
    """Versioned consent form for a study. Only one form is active at a time."""

    __tablename__ = "consent_forms"

    id = db.Column(db.Integer, primary_key=True)
    study_id = db.Column(
        db.Integer, db.ForeignKey("studies.id", ondelete="RESTRICT"), nullable=False
    )
    title = db.Column(db.Text, nullable=False)
    is_active = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow, onupdate=utcnow)

    study = db.relationship("Study", backref="consent_forms")
    revisions = db.relationship(
        "ConsentFormRevision",
        backref="form",
        foreign_keys="[ConsentFormRevision.consent_form_id]",
        order_by="ConsentFormRevision.created_at.desc()",
    )

    def to_dict(self):
        return {
            "id": self.id,
            "study_id": self.study_id,
            "title": self.title,
            "is_active": self.is_active,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self):
        return f"<ConsentForm study={self.study_id} title={self.title!r} active={self.is_active}>"


class ConsentFormRevision(db.Model):
    """Immutable versioned body of a consent form. Hash-chained for tamper evidence."""

    __tablename__ = "consent_form_revisions"
    __table_args__ = (db.UniqueConstraint("consent_form_id", "version"),)

    id = db.Column(db.Integer, primary_key=True)
    consent_form_id = db.Column(
        db.Integer, db.ForeignKey("consent_forms.id", ondelete="RESTRICT"), nullable=False
    )
    version = db.Column(db.Text, nullable=False)
    body_markdown = db.Column(db.Text, nullable=False)
    body_hash = db.Column(db.Text, nullable=False)
    prev_revision_hash = db.Column(db.Text, nullable=True)
    irb_approval_number = db.Column(db.Text, nullable=True)
    irb_approval_date = db.Column(db.Date, nullable=True)
    created_by = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    change_summary = db.Column(db.Text, nullable=True)
    is_material_change = db.Column(db.Boolean, nullable=False, default=False)

    creator = db.relationship("User", foreign_keys=[created_by])

    def to_dict(self):
        return {
            "id": self.id,
            "consent_form_id": self.consent_form_id,
            "version": self.version,
            "body_markdown": self.body_markdown,
            "body_hash": self.body_hash,
            "prev_revision_hash": self.prev_revision_hash,
            "irb_approval_number": self.irb_approval_number,
            "irb_approval_date": self.irb_approval_date.isoformat() if self.irb_approval_date else None,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "change_summary": self.change_summary,
            "is_material_change": self.is_material_change,
        }

    def __repr__(self):
        return f"<ConsentFormRevision form={self.consent_form_id} v={self.version!r}>"


class ParticipantConsent(db.Model):
    """Records a participant's consent to a specific study round."""

    __tablename__ = "participant_consents"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    consent_form_id = db.Column(
        db.Integer, db.ForeignKey("consent_forms.id"), nullable=True
    )
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="SET NULL"), nullable=True
    )
    consented_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    ip_address = db.Column(db.String(50), nullable=True)
    user_agent = db.Column(db.String(300), nullable=True)
    consent_form_revision_id = db.Column(
        db.Integer,
        db.ForeignKey("consent_form_revisions.id", ondelete="SET NULL"),
        nullable=True,
    )
    signature_method = db.Column(db.Text, nullable=True)
    signature_payload = db.Column(db.JSON, nullable=True)
    signature_meaning = db.Column(db.Text, nullable=True, default="I consent to participate")
    pdf_storage_url = db.Column(db.Text, nullable=True)
    pdf_sha256 = db.Column(db.Text, nullable=True)
    record_hash = db.Column(db.Text, nullable=True)

    participant = db.relationship("User", foreign_keys=[user_id], backref="consents")
    consent_form = db.relationship("ConsentForm", foreign_keys=[consent_form_id])
    revision = db.relationship("ConsentFormRevision", foreign_keys=[consent_form_revision_id])

    def __repr__(self):
        return f"<ParticipantConsent user={self.user_id} form={self.consent_form_id}>"


class ConsentAcknowledgment(db.Model):
    """Per-section acknowledgment record for granular consent tracking."""

    __tablename__ = "consent_acknowledgments"

    id = db.Column(db.Integer, primary_key=True)
    participant_consent_id = db.Column(
        db.Integer,
        db.ForeignKey("participant_consents.id", ondelete="RESTRICT"),
        nullable=False,
    )
    section_key = db.Column(db.Text, nullable=False)
    scrolled_to_end_at = db.Column(db.DateTime, nullable=True)
    dwell_seconds = db.Column(db.Integer, nullable=True)
    comprehension_quiz = db.Column(db.JSON, nullable=True)
    acknowledged_at = db.Column(db.DateTime, nullable=True)

    consent = db.relationship(
        "ParticipantConsent",
        foreign_keys=[participant_consent_id],
        backref="acknowledgments",
    )

    def __repr__(self):
        return f"<ConsentAcknowledgment consent={self.participant_consent_id} section={self.section_key!r}>"


class PendingEnrollment(db.Model):
    """Short-lived token linking a join-link visit to a subsequent register/login."""

    __tablename__ = "pending_enrollments"

    token = db.Column(db.Text, primary_key=True)
    round_id = db.Column(db.Integer, db.ForeignKey("study_rounds.id"), nullable=False)
    join_code = db.Column(db.Text, nullable=False)
    issued_ip_hash = db.Column(db.Text, nullable=True)
    issued_ua = db.Column(db.Text, nullable=True)
    utm_source = db.Column(db.Text, nullable=True)
    utm_medium = db.Column(db.Text, nullable=True)
    utm_campaign = db.Column(db.Text, nullable=True)
    referrer = db.Column(db.Text, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=False)
    consumed_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    study_round = db.relationship("StudyRound", foreign_keys=[round_id])

    def __repr__(self):
        return f"<PendingEnrollment round={self.round_id} consumed={self.consumed_at is not None}>"


class WithdrawalRequest(db.Model):
    """Records a participant's request to withdraw from a study."""

    __tablename__ = "withdrawal_requests"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="RESTRICT"), nullable=False
    )
    study_id = db.Column(db.Integer, db.ForeignKey("studies.id"), nullable=True)
    round_id = db.Column(db.Integer, db.ForeignKey("study_rounds.id"), nullable=True)
    scope = db.Column(db.Text, nullable=False, default="full")
    reason_optional = db.Column(db.Text, nullable=True)
    requested_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    effective_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    data_deletion_requested = db.Column(db.Boolean, nullable=False, default=False)
    data_deletion_resolution = db.Column(db.Text, nullable=True)
    processed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    ip_address = db.Column(db.Text, nullable=True)
    user_agent = db.Column(db.Text, nullable=True)

    participant = db.relationship(
        "User", foreign_keys=[user_id], backref="withdrawal_requests"
    )
    processor = db.relationship("User", foreign_keys=[processed_by])

    def __repr__(self):
        return f"<WithdrawalRequest user={self.user_id} scope={self.scope!r}>"


# =============================================================================
# Conditions, allocation, and notification models — Migration 006.
# =============================================================================


class StudyCondition(db.Model):
    """A named arm/condition for a study round (e.g. Control, Intervention)."""

    __tablename__ = "study_conditions"
    __table_args__ = (db.UniqueConstraint("round_id", "label"),)

    id = db.Column(db.Integer, primary_key=True)
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="CASCADE"), nullable=False
    )
    label = db.Column(db.Text, nullable=False)
    group_name = db.Column(db.Text, nullable=True)
    description = db.Column(db.Text, nullable=True)
    color = db.Column(db.String(20), nullable=True)
    max_capacity = db.Column(db.Integer, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    round = db.relationship("StudyRound", backref="conditions")

    def __repr__(self):
        return f"<StudyCondition round={self.round_id} label={self.label!r}>"


class Notification(db.Model):
    """In-app notification delivered to a participant."""

    __tablename__ = "notifications"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="SET NULL"), nullable=True
    )
    type = db.Column(db.Text, nullable=False)
    title = db.Column(db.Text, nullable=False)
    body = db.Column(db.Text, nullable=True)
    action_url = db.Column(db.Text, nullable=True)
    is_read = db.Column(db.Boolean, nullable=False, default=False)
    read_at = db.Column(db.DateTime, nullable=True)
    expires_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    recipient = db.relationship("User", foreign_keys=[user_id], backref="notifications")

    def __repr__(self):
        return f"<Notification user={self.user_id} type={self.type!r} read={self.is_read}>"


class ConditionAssignmentStrategy(db.Model):
    """Per-round randomization strategy. Locked once first assignment is made."""

    __tablename__ = "condition_assignment_strategies"

    id = db.Column(db.Integer, primary_key=True)
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="CASCADE"),
        nullable=False, unique=True
    )
    algorithm = db.Column(db.Text, nullable=False, default="permuted_block")
    block_sizes = db.Column(db.ARRAY(db.Integer), nullable=False, default=[4, 6, 8])
    stratify_by = db.Column(db.ARRAY(db.Text), nullable=True)
    rng_seed = db.Column(db.Text, nullable=True)
    is_locked = db.Column(db.Boolean, nullable=False, default=False)
    locked_at = db.Column(db.DateTime, nullable=True)
    created_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    round = db.relationship("StudyRound", backref="condition_strategy")

    def __repr__(self):
        return f"<ConditionAssignmentStrategy round={self.round_id} algo={self.algorithm!r} locked={self.is_locked}>"


class AllocationSequence(db.Model):
    """Pre-generated per-participant allocation slot. Consumed atomically on enrollment."""

    __tablename__ = "allocation_sequence"
    __table_args__ = (db.UniqueConstraint("round_id", "sequence_index"),)

    id = db.Column(db.Integer, primary_key=True)
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id", ondelete="CASCADE"), nullable=False
    )
    sequence_index = db.Column(db.Integer, nullable=False)
    condition_label = db.Column(db.Text, nullable=False)
    strata_key = db.Column(db.Text, nullable=True)
    consumed_by_enrollment_id = db.Column(
        db.Integer, db.ForeignKey("enrollments.id", ondelete="SET NULL"),
        nullable=True, unique=True
    )
    consumed_at = db.Column(db.DateTime, nullable=True)

    round = db.relationship("StudyRound", backref="allocation_sequence")
    enrollment = db.relationship("Enrollment", foreign_keys=[consumed_by_enrollment_id], backref="allocation_slot")

    def __repr__(self):
        return f"<AllocationSequence round={self.round_id} idx={self.sequence_index} label={self.condition_label!r}>"


class AllocationLog(db.Model):
    """Immutable audit record of every condition assignment. Never UPDATE or DELETE."""

    __tablename__ = "allocation_log"

    id = db.Column(db.Integer, primary_key=True)
    enrollment_id = db.Column(
        db.Integer, db.ForeignKey("enrollments.id", ondelete="RESTRICT"), nullable=False
    )
    round_id = db.Column(
        db.Integer, db.ForeignKey("study_rounds.id"), nullable=False
    )
    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id"), nullable=False
    )
    condition_label = db.Column(db.Text, nullable=False)
    condition_group = db.Column(db.Text, nullable=True)
    prior_condition_label = db.Column(db.Text, nullable=True)
    strategy = db.Column(db.Text, nullable=False)
    strata_key = db.Column(db.Text, nullable=True)
    sequence_index = db.Column(db.Integer, nullable=True)
    assigned_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    reason = db.Column(db.Text, nullable=True)
    assigned_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    enrollment = db.relationship("Enrollment", foreign_keys=[enrollment_id], backref="allocation_logs")
    assigner = db.relationship("User", foreign_keys=[assigned_by])

    def __repr__(self):
        return f"<AllocationLog enrollment={self.enrollment_id} label={self.condition_label!r}>"


class NotificationPreference(db.Model):
    """Per-user notification delivery preferences."""

    __tablename__ = "notification_preferences"

    user_id = db.Column(
        db.Integer, db.ForeignKey("users.id", ondelete="CASCADE"), primary_key=True
    )
    reminders_enabled = db.Column(db.Boolean, nullable=False, default=True)
    quiet_hours_start = db.Column(db.Integer, default=9)
    quiet_hours_end = db.Column(db.Integer, default=21)
    timezone = db.Column(db.Text, default="America/Chicago")
    updated_at = db.Column(db.DateTime, nullable=False, default=utcnow)

    user = db.relationship("User", backref="notification_prefs")

    def __repr__(self):
        return f"<NotificationPreference user={self.user_id} reminders={self.reminders_enabled}>"


class NotificationDeliveryLog(db.Model):
    """Delivery record for each notification, with condition for parity analysis."""

    __tablename__ = "notification_delivery_log"

    id = db.Column(db.Integer, primary_key=True)
    notification_id = db.Column(
        db.Integer, db.ForeignKey("notifications.id", ondelete="CASCADE"), nullable=False
    )
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    round_id = db.Column(db.Integer, db.ForeignKey("study_rounds.id"), nullable=True)
    condition_label = db.Column(db.Text, nullable=True)
    notification_type = db.Column(db.Text, nullable=False)
    delivered_at = db.Column(db.DateTime, nullable=False, default=utcnow)
    opened_at = db.Column(db.DateTime, nullable=True)
    action_taken_at = db.Column(db.DateTime, nullable=True)

    def __repr__(self):
        return f"<NotificationDeliveryLog notif={self.notification_id} user={self.user_id}>"
