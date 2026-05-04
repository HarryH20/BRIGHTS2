import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

export default function JoinStudyPage() {
  const { code } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [joinError, setJoinError] = useState("");
  const [joinData, setJoinData] = useState(null); // { round, study, consent, pending_token }

  const [currentUser, setCurrentUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  const [consented, setConsented] = useState(false);
  const [enrolling, setEnrolling] = useState(false);
  const [enrollError, setEnrollError] = useState("");
  const [enrolled, setEnrolled] = useState(false);

  useEffect(() => {
    // Persist code for post-auth flows
    sessionStorage.setItem("pending_join_code", code);

    // Check current session
    fetch("/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d?.user) setCurrentUser(d.user); })
      .catch(() => {})
      .finally(() => setUserChecked(true));

    // Fetch join info
    fetch(`/auth/join/${code}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d?.error || "Invalid join link"));
        return r.json();
      })
      .then((d) => {
        setJoinData(d);
        if (d.pending_token) {
          sessionStorage.setItem("pending_join_token", d.pending_token);
        }
      })
      .catch((e) => setJoinError(typeof e === "string" ? e : "This join link is invalid or has expired."))
      .finally(() => setLoading(false));
  }, [code]);

  async function handleJoin() {
    if (!consented) return;
    setEnrollError("");
    setEnrolling(true);
    const token = sessionStorage.getItem("pending_join_token") || joinData?.pending_token;
    try {
      const res = await fetch(`/auth/join/${code}/enroll`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setEnrollError(data?.error || "Enrollment failed. Please try again.");
        setEnrolling(false);
        return;
      }
      sessionStorage.removeItem("pending_join_code");
      sessionStorage.removeItem("pending_join_token");
      setEnrolled(true);
      setTimeout(() => navigate("/dashboard", { replace: true }), 1200);
    } catch {
      setEnrollError("Network error. Please try again.");
      setEnrolling(false);
    }
  }

  if (loading || !userChecked) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.loadingText}>Loading study information…</div>
        </div>
      </div>
    );
  }

  if (joinError) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.eyebrow}>Join Study</div>
          <div style={s.errorBox}>{joinError}</div>
          <p style={s.muted}>This link may have expired, already been used, or may be invalid.</p>
        </div>
      </div>
    );
  }

  const { study, round, consent } = joinData || {};
  const hasConsent = consent && consent.body_markdown;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.eyebrow}>Research Study Enrollment</div>

        <div style={s.studyTitle}>{study?.title || "Research Study"}</div>

        <div style={s.tilesGrid}>
          {[
            { label: "Study Code", value: study?.study_code },
            { label: "Round", value: round?.round_label },
            { label: "Start Date", value: round?.start_date ? new Date(round.start_date).toLocaleDateString() : null },
            { label: "End Date", value: round?.end_date ? new Date(round.end_date).toLocaleDateString() : null },
          ].filter((t) => t.value).map(({ label, value }) => (
            <div key={label} style={s.tile}>
              <div style={s.tileLabel}>{label}</div>
              <div style={s.tileValue}>{value}</div>
            </div>
          ))}
        </div>

        {study?.description && (
          <p style={s.description}>{study.description}</p>
        )}

        {hasConsent && (
          <div style={s.consentSection}>
            <div style={s.consentTitle}>{consent.title || "Informed Consent"}</div>
            {consent.version && (
              <div style={s.consentVersion}>Version {consent.version}</div>
            )}
            <div style={s.consentBody}>{consent.body_markdown}</div>
          </div>
        )}

        <label style={s.checkboxRow}>
          <input
            type="checkbox"
            checked={consented}
            onChange={(e) => setConsented(e.target.checked)}
            style={{ width: 16, height: 16, cursor: "pointer", flexShrink: 0 }}
          />
          <span style={s.checkboxLabel}>
            I have read the information above and agree to participate in this research study.
          </span>
        </label>

        {enrollError && <div style={s.errorBox}>{enrollError}</div>}

        {enrolled ? (
          <div style={s.successBox}>Enrolled! Taking you to your dashboard…</div>
        ) : currentUser ? (
          <button
            style={{ ...s.btn, opacity: consented ? 1 : 0.45, cursor: consented ? "pointer" : "not-allowed" }}
            onClick={handleJoin}
            disabled={!consented || enrolling}
          >
            {enrolling ? "Enrolling…" : "Join Study"}
          </button>
        ) : (
          <div style={s.btnGroup}>
            <a
              href={`/register?join=${code}`}
              style={{ ...s.btn, textDecoration: "none", textAlign: "center", opacity: consented ? 1 : 0.45, pointerEvents: consented ? "auto" : "none" }}
              onClick={(e) => { if (!consented) e.preventDefault(); }}
            >
              Create account to join
            </a>
            <a
              href={`/login?join=${code}`}
              style={{ ...s.btnOutline, textDecoration: "none", textAlign: "center", opacity: consented ? 1 : 0.45, pointerEvents: consented ? "auto" : "none" }}
              onClick={(e) => { if (!consented) e.preventDefault(); }}
            >
              I already have an account
            </a>
          </div>
        )}

        {!currentUser && (
          <p style={s.muted}>
            Check the box above first, then create an account or sign in to complete enrollment.
          </p>
        )}
      </div>
    </div>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "var(--shell-bg)",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    padding: "32px 28px",
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
    color: "var(--shell-text)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    gap: 16,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--shell-accent)",
  },
  studyTitle: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--shell-text)",
    lineHeight: 1.25,
  },
  tilesGrid: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: 8,
  },
  tile: {
    background: "var(--shell-surface-2)",
    borderRadius: 10,
    padding: "10px 12px",
  },
  tileLabel: {
    fontSize: 10,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
    color: "var(--shell-text-muted)",
    marginBottom: 3,
  },
  tileValue: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--shell-text)",
  },
  description: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    lineHeight: 1.6,
    margin: 0,
  },
  consentSection: {
    border: "1px solid var(--shell-border)",
    borderRadius: 10,
    padding: 16,
    background: "var(--shell-surface-2)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  consentTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--shell-text)",
  },
  consentVersion: {
    fontSize: 11,
    color: "var(--shell-text-muted)",
  },
  consentBody: {
    fontSize: 13,
    color: "var(--shell-text-secondary)",
    lineHeight: 1.65,
    whiteSpace: "pre-wrap",
    maxHeight: 220,
    overflowY: "auto",
    marginTop: 4,
    paddingRight: 4,
  },
  checkboxRow: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    cursor: "pointer",
  },
  checkboxLabel: {
    fontSize: 13,
    color: "var(--shell-text-secondary)",
    lineHeight: 1.5,
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
  },
  btn: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "none",
    background: "var(--shell-accent)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 15,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  btnOutline: {
    width: "100%",
    padding: "12px 16px",
    borderRadius: 10,
    border: "1px solid var(--shell-border-strong)",
    background: "transparent",
    color: "var(--shell-text)",
    fontWeight: 600,
    fontSize: 15,
    cursor: "pointer",
    boxSizing: "border-box",
  },
  successBox: {
    width: "100%",
    padding: 14,
    borderRadius: 10,
    background: "rgba(80,255,140,0.10)",
    border: "1px solid rgba(80,255,140,0.35)",
    color: "#c9ffd8",
    fontSize: 14,
    fontWeight: 600,
    boxSizing: "border-box",
  },
  errorBox: {
    width: "100%",
    padding: 12,
    borderRadius: 10,
    background: "rgba(255,80,80,0.12)",
    border: "1px solid rgba(255,80,80,0.35)",
    color: "#ffd1d1",
    fontSize: 14,
    boxSizing: "border-box",
  },
  loadingText: {
    color: "var(--shell-text-muted)",
    fontSize: 14,
    textAlign: "center",
    padding: 12,
  },
  muted: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    margin: 0,
    textAlign: "center",
  },
};
