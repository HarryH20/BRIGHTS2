import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { adminStyles as s } from "../adminStyles.js";

// ── helpers ────────────────────────────────────────────────────────────────

function copyToClipboard(text) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function JoinLinkDisplay({ code }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/join/${code}`;

  function handleCopy() {
    copyToClipboard(link);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <code style={{
        fontSize: 12,
        background: "var(--shell-surface-2)",
        border: "1px solid var(--shell-border)",
        borderRadius: 6,
        padding: "4px 8px",
        color: "var(--shell-text-secondary)",
        wordBreak: "break-all",
        flex: 1,
      }}>
        {link}
      </code>
      <button
        onClick={handleCopy}
        style={{
          padding: "4px 10px",
          borderRadius: 6,
          border: "1px solid var(--shell-border)",
          background: copied ? "rgba(80,255,140,0.12)" : "var(--shell-surface-2)",
          color: copied ? "#c9ffd8" : "var(--shell-text-muted)",
          fontSize: 12,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        {copied ? "Copied!" : "Copy link"}
      </button>
    </div>
  );
}

// ── sub-components ─────────────────────────────────────────────────────────

function RoundsSection({ studyId }) {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formError, setFormError] = useState("");

  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  useEffect(() => {
    if (!studyId) return;
    fetch(`/api/admin/rounds?study_id=${studyId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => setRounds(Array.isArray(d) ? d : d.rounds || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studyId]);

  async function handleCreate(e) {
    e.preventDefault();
    setFormError("");
    setCreating(true);
    try {
      const res = await fetch("/api/admin/rounds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          study_id: studyId,
          round_label: newLabel,
          start_date: newStart || null,
          end_date: newEnd || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.error || "Failed to create round.");
        setCreating(false);
        return;
      }
      setRounds((prev) => [...prev, data.round || data]);
      setShowForm(false);
      setNewLabel("");
      setNewStart("");
      setNewEnd("");
    } catch {
      setFormError("Network error.");
    } finally {
      setCreating(false);
    }
  }

  async function handleTransition(roundId, newStatus) {
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        setRounds((prev) => prev.map((r) => r.id === roundId ? { ...r, ...(data.round || { status: newStatus }) } : r));
      }
    } catch {}
  }

  const STATUS_COLORS = {
    draft: "var(--shell-text-muted)",
    enrolling: "var(--shell-teal)",
    active: "var(--shell-accent)",
    closed: "var(--shell-amber)",
    archived: "var(--shell-text-muted)",
  };

  return (
    <div style={card}>
      <div style={sectionHeader}>
        <div>
          <div style={sectionTitle}>Study Rounds</div>
          <div style={sectionSub}>Manage enrollment rounds and join links</div>
        </div>
        <button
          onClick={() => setShowForm((v) => !v)}
          style={actionBtn}
        >
          {showForm ? "Cancel" : "+ New Round"}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} style={formBox}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <label style={fieldLabel}>
              Round Label
              <input
                style={fieldInput}
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="e.g. Spring 2025"
                required
              />
            </label>
            <label style={fieldLabel}>
              Start Date
              <input
                type="date"
                style={fieldInput}
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
            </label>
            <label style={fieldLabel}>
              End Date
              <input
                type="date"
                style={fieldInput}
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </label>
          </div>
          {formError && <div style={errorBox}>{formError}</div>}
          <button type="submit" style={submitBtn} disabled={creating}>
            {creating ? "Creating…" : "Create Round"}
          </button>
        </form>
      )}

      {loading && <div style={{ color: "var(--shell-text-muted)", fontSize: 13 }}>Loading rounds…</div>}

      {!loading && rounds.length === 0 && (
        <div style={emptyState}>No rounds yet. Create one to start enrolling participants.</div>
      )}

      {rounds.map((round) => (
        <div key={round.id} style={roundCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--shell-text)" }}>{round.round_label}</div>
              <div style={{ fontSize: 12, color: "var(--shell-text-muted)", marginTop: 3 }}>
                {round.start_date || "—"} → {round.end_date || "—"}
              </div>
            </div>
            <span style={{
              display: "inline-block",
              padding: "3px 10px",
              borderRadius: 20,
              fontSize: 11,
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              background: (STATUS_COLORS[round.status] || "var(--shell-text-muted)") + "22",
              color: STATUS_COLORS[round.status] || "var(--shell-text-muted)",
              border: `1px solid ${(STATUS_COLORS[round.status] || "var(--shell-text-muted)")}44`,
            }}>
              {round.status || "draft"}
            </span>
          </div>

          {round.join_code && (
            <div style={{ marginTop: 10 }}>
              <div style={{ fontSize: 11, color: "var(--shell-text-muted)", marginBottom: 4 }}>Join Link</div>
              <JoinLinkDisplay code={round.join_code} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {round.status === "draft" && (
              <button onClick={() => handleTransition(round.id, "enrolling")} style={pillBtn}>Open Enrollment</button>
            )}
            {round.status === "enrolling" && (
              <button onClick={() => handleTransition(round.id, "active")} style={pillBtn}>Start Round</button>
            )}
            {round.status === "active" && (
              <button onClick={() => handleTransition(round.id, "closed")} style={{ ...pillBtn, background: "rgba(245,158,11,0.15)", color: "var(--shell-amber)", border: "1px solid rgba(245,158,11,0.35)" }}>Close Round</button>
            )}
            {(round.status === "closed") && (
              <button onClick={() => handleTransition(round.id, "archived")} style={{ ...pillBtn, opacity: 0.7 }}>Archive</button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

function ConsentSection({ studyId }) {
  const [forms, setForms] = useState([]);
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showNewForm, setShowNewForm] = useState(false);
  const [showRevisionFor, setShowRevisionFor] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // New form fields
  const [newTitle, setNewTitle] = useState("");
  const [newVersion, setNewVersion] = useState("1.0");
  const [newBody, setNewBody] = useState("");
  const [newIrb, setNewIrb] = useState("");
  const [newIrbDate, setNewIrbDate] = useState("");

  // New revision fields
  const [revVersion, setRevVersion] = useState("");
  const [revBody, setRevBody] = useState("");
  const [revIrb, setRevIrb] = useState("");
  const [revSummary, setRevSummary] = useState("");
  const [revMaterial, setRevMaterial] = useState(false);

  useEffect(() => {
    if (!studyId) return;
    Promise.all([
      fetch("/api/admin/consent/forms", { credentials: "include" }).then((r) => r.ok ? r.json() : []),
      fetch("/api/admin/consent/dashboard", { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ])
      .then(([formsData, dashData]) => {
        setForms(Array.isArray(formsData) ? formsData : formsData.forms || []);
        setDashboard(dashData);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studyId]);

  async function handleCreateForm(e) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/consent/forms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          study_id: studyId,
          title: newTitle,
          version: newVersion,
          body_markdown: newBody,
          irb_approval_number: newIrb || null,
          irb_approval_date: newIrbDate || null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.error || "Failed to create consent form.");
        setSubmitting(false);
        return;
      }
      setForms((prev) => [...prev, data.form || data]);
      setShowNewForm(false);
      setNewTitle("");
      setNewVersion("1.0");
      setNewBody("");
      setNewIrb("");
      setNewIrbDate("");
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleActivate(formId) {
    try {
      const res = await fetch(`/api/admin/consent/forms/${formId}/activate`, {
        method: "PATCH",
        credentials: "include",
      });
      if (res.ok) {
        setForms((prev) => prev.map((f) => ({ ...f, is_active: f.id === formId })));
      }
    } catch {}
  }

  async function handleAddRevision(e) {
    e.preventDefault();
    setFormError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/consent/forms/${showRevisionFor}/revisions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          version: revVersion,
          body_markdown: revBody,
          irb_approval_number: revIrb || null,
          change_summary: revSummary || null,
          is_material_change: revMaterial,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setFormError(data?.error || "Failed to add revision.");
        setSubmitting(false);
        return;
      }
      // Update revision_count on the form
      setForms((prev) => prev.map((f) =>
        f.id === showRevisionFor
          ? { ...f, revision_count: (f.revision_count || 0) + 1, latest_version: revVersion }
          : f
      ));
      setShowRevisionFor(null);
      setRevVersion("");
      setRevBody("");
      setRevIrb("");
      setRevSummary("");
      setRevMaterial(false);
    } catch {
      setFormError("Network error.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={card}>
      <div style={sectionHeader}>
        <div>
          <div style={sectionTitle}>Consent Management</div>
          <div style={sectionSub}>Versioned informed consent forms</div>
        </div>
        <button onClick={() => setShowNewForm((v) => !v)} style={actionBtn}>
          {showNewForm ? "Cancel" : "+ New Form"}
        </button>
      </div>

      {/* Dashboard stats */}
      {dashboard && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 }}>
          {[
            { label: "Enrolled", value: dashboard.total_enrolled },
            { label: "Consented", value: dashboard.consented },
            { label: "Pending", value: dashboard.pending_consent },
            { label: "Withdrawn", value: dashboard.withdrawn },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: "var(--shell-surface-2)", borderRadius: 8, padding: "10px 12px", textAlign: "center" }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: "var(--shell-text)" }}>{value ?? "—"}</div>
              <div style={{ fontSize: 11, color: "var(--shell-text-muted)", marginTop: 2 }}>{label}</div>
            </div>
          ))}
        </div>
      )}

      {showNewForm && (
        <form onSubmit={handleCreateForm} style={formBox}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
            <label style={fieldLabel}>
              Form Title
              <input style={fieldInput} value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="e.g. BRIGHTS Study Consent" required />
            </label>
            <label style={fieldLabel}>
              Version
              <input style={{ ...fieldInput, width: 80 }} value={newVersion} onChange={(e) => setNewVersion(e.target.value)} placeholder="1.0" required />
            </label>
          </div>
          <label style={fieldLabel}>
            Consent Body (Markdown)
            <textarea
              style={{ ...fieldInput, minHeight: 140, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
              value={newBody}
              onChange={(e) => setNewBody(e.target.value)}
              placeholder="Enter the full consent form text…"
              required
            />
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <label style={fieldLabel}>
              IRB Approval Number
              <input style={fieldInput} value={newIrb} onChange={(e) => setNewIrb(e.target.value)} placeholder="Optional" />
            </label>
            <label style={fieldLabel}>
              IRB Approval Date
              <input type="date" style={fieldInput} value={newIrbDate} onChange={(e) => setNewIrbDate(e.target.value)} />
            </label>
          </div>
          {formError && <div style={errorBox}>{formError}</div>}
          <button type="submit" style={submitBtn} disabled={submitting}>
            {submitting ? "Creating…" : "Create Consent Form"}
          </button>
        </form>
      )}

      {loading && <div style={{ color: "var(--shell-text-muted)", fontSize: 13 }}>Loading consent forms…</div>}

      {!loading && forms.length === 0 && (
        <div style={emptyState}>No consent forms yet. Create one to attach to a study.</div>
      )}

      {forms.map((form) => (
        <div key={form.id} style={roundCard}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "var(--shell-text)" }}>{form.title}</div>
              <div style={{ fontSize: 12, color: "var(--shell-text-muted)", marginTop: 2 }}>
                {form.revision_count || 0} revision{form.revision_count !== 1 ? "s" : ""}
                {form.latest_version ? ` · v${form.latest_version}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {form.is_active ? (
                <span style={{ padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 700, background: "rgba(80,255,140,0.12)", color: "#c9ffd8", border: "1px solid rgba(80,255,140,0.35)" }}>
                  Active
                </span>
              ) : (
                <button onClick={() => handleActivate(form.id)} style={pillBtn}>Set Active</button>
              )}
              <button
                onClick={() => setShowRevisionFor(showRevisionFor === form.id ? null : form.id)}
                style={{ ...pillBtn, background: "transparent" }}
              >
                {showRevisionFor === form.id ? "Cancel" : "+ Revision"}
              </button>
            </div>
          </div>

          {showRevisionFor === form.id && (
            <form onSubmit={handleAddRevision} style={{ ...formBox, marginTop: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 10 }}>
                <label style={fieldLabel}>
                  New Version
                  <input style={fieldInput} value={revVersion} onChange={(e) => setRevVersion(e.target.value)} placeholder="e.g. 1.1" required />
                </label>
                <label style={fieldLabel}>
                  IRB Number
                  <input style={{ ...fieldInput, width: 120 }} value={revIrb} onChange={(e) => setRevIrb(e.target.value)} placeholder="Optional" />
                </label>
              </div>
              <label style={fieldLabel}>
                Consent Body
                <textarea
                  style={{ ...fieldInput, minHeight: 120, resize: "vertical", fontFamily: "monospace", fontSize: 13 }}
                  value={revBody}
                  onChange={(e) => setRevBody(e.target.value)}
                  required
                />
              </label>
              <label style={fieldLabel}>
                Change Summary
                <input style={fieldInput} value={revSummary} onChange={(e) => setRevSummary(e.target.value)} placeholder="Optional description of changes" />
              </label>
              <label style={{ ...fieldLabel, flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={revMaterial} onChange={(e) => setRevMaterial(e.target.checked)} />
                Material change (requires re-consent)
              </label>
              {formError && <div style={errorBox}>{formError}</div>}
              <button type="submit" style={submitBtn} disabled={submitting}>
                {submitting ? "Saving…" : "Add Revision"}
              </button>
            </form>
          )}
        </div>
      ))}
    </div>
  );
}

// ── notify section ─────────────────────────────────────────────────────────

const NOTIF_TYPES = [
  { value: "survey_available", label: "Survey Available" },
  { value: "survey_reminder", label: "Survey Reminder" },
  { value: "round_closing", label: "Round Closing Soon" },
  { value: "welcome", label: "Welcome" },
  { value: "study_update", label: "Study Update" },
];

function NotifySection({ studyId }) {
  const [rounds, setRounds] = useState([]);
  const [selectedRound, setSelectedRound] = useState("");
  const [notifType, setNotifType] = useState("survey_reminder");
  const [bodyOverride, setBodyOverride] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!studyId) return;
    fetch(`/api/admin/rounds?study_id=${studyId}`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : [])
      .then((d) => {
        const list = Array.isArray(d) ? d : d.rounds || [];
        setRounds(list);
        const active = list.find((r) => r.status === "active") || list[0];
        if (active) setSelectedRound(String(active.id));
      })
      .catch(() => {});
  }, [studyId]);

  async function handleSend(e) {
    e.preventDefault();
    if (!selectedRound) return;
    if (!window.confirm(`Send "${notifType}" notification to all enrolled participants in this round?`)) return;
    setSending(true);
    setResult(null);
    try {
      const body = { type: notifType };
      if (bodyOverride.trim()) body.body_override = bodyOverride.trim();
      const res = await fetch(`/api/admin/rounds/${selectedRound}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setResult({ ok: false, text: data.error || "Send failed." });
      } else {
        setResult({ ok: true, text: `Sent to ${data.sent ?? "?"} participant(s).` });
        setBodyOverride("");
      }
    } catch {
      setResult({ ok: false, text: "Network error." });
    } finally {
      setSending(false);
    }
  }

  return (
    <div style={card}>
      <div style={sectionHeader}>
        <div>
          <div style={sectionTitle}>Send Notification</div>
          <div style={sectionSub}>Batch-send a message to enrolled participants</div>
        </div>
      </div>
      <form onSubmit={handleSend} style={formBox}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <label style={fieldLabel}>
            Round
            <select
              value={selectedRound}
              onChange={(e) => setSelectedRound(e.target.value)}
              style={fieldInput}
              required
            >
              {rounds.map((r) => (
                <option key={r.id} value={String(r.id)}>
                  {r.round_label || `Round ${r.round_number}`} ({r.status})
                </option>
              ))}
            </select>
          </label>
          <label style={fieldLabel}>
            Notification Type
            <select
              value={notifType}
              onChange={(e) => setNotifType(e.target.value)}
              style={fieldInput}
            >
              {NOTIF_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </label>
        </div>
        <label style={fieldLabel}>
          Body Override (optional — leave blank to use approved template copy)
          <textarea
            value={bodyOverride}
            onChange={(e) => setBodyOverride(e.target.value)}
            placeholder="Custom message body…"
            style={{ ...fieldInput, minHeight: 72, resize: "vertical" }}
            maxLength={500}
          />
        </label>
        {result && (
          <div style={{ fontSize: 13, color: result.ok ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>
            {result.text}
          </div>
        )}
        <button type="submit" disabled={sending || !selectedRound} style={submitBtn}>
          {sending ? "Sending…" : "Send Notification"}
        </button>
      </form>
    </div>
  );
}

// ── page ───────────────────────────────────────────────────────────────────

export default function AdminStudyPage({ user, onLogout }) {
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/study", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStudy(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell user={user} onLogout={onLogout} title="Study" subtitle="Study configuration and protocol">
      <div style={{ maxWidth: 800, display: "flex", flexDirection: "column", gap: 24 }}>
        {loading && <div style={s.loading}>Loading study info…</div>}

        {!loading && !study && (
          <div style={{
            background: "var(--shell-surface-1)",
            border: "1px solid var(--shell-border)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: "var(--shell-text-muted)",
            fontSize: 14,
          }}>
            No study configuration found. Study management features will appear here.
          </div>
        )}

        {study && (
          <>
            <div style={{ background: "var(--shell-surface-1)", border: "1px solid var(--shell-border)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--shell-text-muted)", marginBottom: 4 }}>Study Title</div>
                <div style={{ fontSize: 18, fontWeight: 700, color: "var(--shell-text)" }}>{study.title ?? "—"}</div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                {[
                  { label: "Status",      value: study.status },
                  { label: "Study Code",  value: study.study_code },
                  { label: "Start Date",  value: study.start_date },
                  { label: "End Date",    value: study.end_date },
                ].map(({ label, value }) => (
                  <div key={label} style={{ background: "var(--shell-surface-2)", borderRadius: 8, padding: "10px 14px" }}>
                    <div style={{ fontSize: 11, color: "var(--shell-text-muted)", marginBottom: 3 }}>{label}</div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--shell-text)" }}>{value ?? "—"}</div>
                  </div>
                ))}
              </div>

              {study.description && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--shell-text-muted)", marginBottom: 6 }}>Description</div>
                  <div style={{ fontSize: 13, color: "var(--shell-text-secondary)", lineHeight: 1.6 }}>{study.description}</div>
                </div>
              )}
            </div>

            <RoundsSection studyId={study.id} />
            <ConsentSection studyId={study.id} />
            <NotifySection studyId={study.id} />
          </>
        )}
      </div>
    </AdminShell>
  );
}

// ── shared local styles ────────────────────────────────────────────────────

const card = {
  background: "var(--shell-surface-1)",
  border: "1px solid var(--shell-border)",
  borderRadius: 12,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 16,
};

const sectionHeader = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  flexWrap: "wrap",
};

const sectionTitle = {
  fontSize: 16,
  fontWeight: 700,
  color: "var(--shell-text)",
};

const sectionSub = {
  fontSize: 12,
  color: "var(--shell-text-muted)",
  marginTop: 2,
};

const actionBtn = {
  padding: "7px 14px",
  borderRadius: 8,
  border: "1px solid var(--shell-border-strong)",
  background: "transparent",
  color: "var(--shell-text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
  whiteSpace: "nowrap",
};

const formBox = {
  background: "var(--shell-surface-2)",
  border: "1px solid var(--shell-border)",
  borderRadius: 10,
  padding: 16,
  display: "flex",
  flexDirection: "column",
  gap: 10,
};

const fieldLabel = {
  display: "flex",
  flexDirection: "column",
  gap: 4,
  fontSize: 12,
  color: "var(--shell-text-muted)",
};

const fieldInput = {
  padding: "8px 10px",
  borderRadius: 8,
  border: "1px solid var(--shell-border)",
  background: "var(--shell-surface-1)",
  color: "var(--shell-text)",
  fontSize: 13,
  outline: "none",
};

const submitBtn = {
  alignSelf: "flex-start",
  padding: "8px 16px",
  borderRadius: 8,
  border: "none",
  background: "var(--shell-accent)",
  color: "#fff",
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const roundCard = {
  background: "var(--shell-surface-2)",
  border: "1px solid var(--shell-border)",
  borderRadius: 10,
  padding: 16,
};

const pillBtn = {
  padding: "4px 12px",
  borderRadius: 20,
  border: "1px solid var(--shell-border-strong)",
  background: "transparent",
  color: "var(--shell-text-secondary)",
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
};

const emptyState = {
  padding: 20,
  textAlign: "center",
  color: "var(--shell-text-muted)",
  fontSize: 13,
  border: "1px dashed var(--shell-border)",
  borderRadius: 8,
};

const errorBox = {
  padding: 10,
  borderRadius: 8,
  background: "rgba(255,80,80,0.12)",
  border: "1px solid rgba(255,80,80,0.35)",
  color: "#ffd1d1",
  fontSize: 13,
};
