import React, { useState } from "react";
import { FileText, CheckSquare, Square, AlertTriangle } from "lucide-react";

export default function ConsentModal({ consent, onAccepted, onDecline }) {
  const [checked, setChecked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  async function handleAccept() {
    if (!checked) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/survey/consent/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          form_id: consent.form_id,
          revision_id: consent.revision_id,
        }),
      });
      if (res.ok) {
        onAccepted();
      } else {
        const d = await res.json().catch(() => ({}));
        setError(d.error || "Failed to record consent. Please try again.");
      }
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={s.overlay}>
      <div style={s.modal}>
        <div style={s.header}>
          <FileText size={20} style={{ color: "var(--shell-accent)", flexShrink: 0 }} />
          <div>
            <div style={s.title}>{consent.title}</div>
            <div style={s.version}>Version {consent.version}</div>
          </div>
        </div>

        <div style={s.body}>
          <pre style={s.bodyText}>{consent.body_markdown}</pre>
        </div>

        <div style={s.footer}>
          <button
            type="button"
            style={s.checkRow}
            onClick={() => setChecked((v) => !v)}
          >
            {checked
              ? <CheckSquare size={20} style={{ color: "var(--shell-accent)", flexShrink: 0 }} />
              : <Square size={20} style={{ opacity: 0.5, flexShrink: 0 }} />}
            <span style={s.checkLabel}>
              I have read the above and agree to participate in this research study.
            </span>
          </button>

          {error && (
            <div style={s.errorBox}>
              <AlertTriangle size={14} />
              <span>{error}</span>
            </div>
          )}

          <div style={s.btnRow}>
            <button
              type="button"
              style={s.declineBtn}
              onClick={onDecline}
              disabled={submitting}
            >
              Decline &amp; Log Out
            </button>
            <button
              type="button"
              style={{ ...s.acceptBtn, opacity: checked ? 1 : 0.45 }}
              onClick={handleAccept}
              disabled={!checked || submitting}
            >
              {submitting ? "Saving…" : "Accept & Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const s = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.7)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
    padding: 16,
  },
  modal: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 16,
    width: "100%",
    maxWidth: 640,
    maxHeight: "90vh",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    padding: "20px 24px 16px",
    borderBottom: "1px solid var(--shell-border)",
    flexShrink: 0,
  },
  title: {
    fontWeight: 800,
    fontSize: 17,
    color: "var(--shell-text)",
    lineHeight: 1.3,
  },
  version: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    marginTop: 2,
  },
  body: {
    flex: 1,
    overflow: "auto",
    padding: "16px 24px",
  },
  bodyText: {
    fontFamily: "inherit",
    fontSize: 14,
    lineHeight: 1.7,
    color: "var(--shell-text-secondary)",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
    margin: 0,
  },
  footer: {
    padding: "16px 24px 20px",
    borderTop: "1px solid var(--shell-border)",
    flexShrink: 0,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  checkRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: 0,
    textAlign: "left",
  },
  checkLabel: {
    fontSize: 14,
    color: "var(--shell-text)",
    lineHeight: 1.5,
  },
  errorBox: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    fontSize: 13,
    color: "var(--error-color, #f87171)",
    background: "rgba(248,113,113,0.08)",
    border: "1px solid rgba(248,113,113,0.25)",
    borderRadius: 8,
    padding: "8px 12px",
  },
  btnRow: {
    display: "flex",
    gap: 10,
    justifyContent: "flex-end",
  },
  declineBtn: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid var(--shell-border-strong)",
    background: "transparent",
    color: "var(--shell-text-muted)",
    fontWeight: 600,
    fontSize: 14,
    cursor: "pointer",
  },
  acceptBtn: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: "var(--shell-accent)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    transition: "opacity 0.15s",
  },
};
