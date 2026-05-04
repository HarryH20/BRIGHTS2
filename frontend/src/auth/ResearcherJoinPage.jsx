import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";

const ROLE_LABELS = {
  pi: "Principal Investigator",
  research_assistant: "Research Assistant",
  data_manager: "Data Manager",
  observer: "Observer",
};

const ROLE_COLORS = {
  pi: "var(--shell-accent)",
  research_assistant: "var(--shell-teal)",
  data_manager: "var(--shell-amber)",
  observer: "var(--shell-text-muted)",
};

export default function ResearcherJoinPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [inviteInfo, setInviteInfo] = useState(null);
  const [inviteError, setInviteError] = useState("");

  const [currentUser, setCurrentUser] = useState(null);
  const [userChecked, setUserChecked] = useState(false);

  const [accepting, setAccepting] = useState(false);
  const [acceptError, setAcceptError] = useState("");
  const [accepted, setAccepted] = useState(false);

  useEffect(() => {
    // Check current session
    fetch("/auth/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (d?.user) setCurrentUser(d.user);
      })
      .catch(() => {})
      .finally(() => setUserChecked(true));

    // Fetch invite info
    fetch(`/auth/researcher/join/${token}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) return r.json().then((d) => Promise.reject(d?.error || "Invalid invitation"));
        return r.json();
      })
      .then((d) => setInviteInfo(d))
      .catch((e) => setInviteError(typeof e === "string" ? e : "Invalid or expired invitation link."))
      .finally(() => setLoading(false));
  }, [token]);

  async function handleAccept() {
    setAcceptError("");
    setAccepting(true);
    try {
      const res = await fetch(`/auth/researcher/join/${token}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setAcceptError(data?.error || "Failed to accept invitation.");
        setAccepting(false);
        return;
      }
      setAccepted(true);
      setTimeout(() => navigate("/admin"), 1500);
    } catch {
      setAcceptError("Network error. Please try again.");
      setAccepting(false);
    }
  }

  if (loading || !userChecked) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.loadingText}>Checking invitation…</div>
        </div>
      </div>
    );
  }

  if (inviteError) {
    return (
      <div style={s.page}>
        <div style={s.card}>
          <div style={s.errorBox}>{inviteError}</div>
          <p style={s.muted}>This link may have expired or already been used.</p>
        </div>
      </div>
    );
  }

  const roleLabel = ROLE_LABELS[inviteInfo?.role] || inviteInfo?.role;
  const roleColor = ROLE_COLORS[inviteInfo?.role] || "var(--shell-text-muted)";

  const expiresLabel = inviteInfo?.expires_at
    ? new Date(inviteInfo.expires_at).toLocaleString()
    : null;

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={{ ...s.eyebrow, color: roleColor }}>Researcher Invitation</div>
        <div style={s.roleBadge}>
          <span style={{ ...s.badgePill, background: roleColor + "22", color: roleColor, border: `1px solid ${roleColor}55` }}>
            {roleLabel}
          </span>
        </div>
        <div style={s.studyName}>{inviteInfo?.study_name || "Research Study"}</div>
        {expiresLabel && (
          <div style={s.expires}>Expires {expiresLabel}</div>
        )}

        {accepted ? (
          <div style={s.successBox}>
            ✓ Role accepted! Redirecting to admin panel…
          </div>
        ) : currentUser ? (
          <>
            <p style={s.loggedInAs}>
              Logged in as <strong>{currentUser.display_name || currentUser.username}</strong>
            </p>
            {acceptError && <div style={s.errorBox}>{acceptError}</div>}
            <button style={s.btn} onClick={handleAccept} disabled={accepting}>
              {accepting ? "Accepting…" : "Accept invitation"}
            </button>
          </>
        ) : (
          <>
            <p style={s.needAccount}>You need an account to accept this invitation.</p>
            <div style={s.btnGroup}>
              <a
                href={`/register?researcher=${token}`}
                style={{ ...s.btn, textDecoration: "none", textAlign: "center" }}
              >
                Create account
              </a>
              <a
                href={`/login?researcher=${token}`}
                style={{ ...s.btnOutline, textDecoration: "none", textAlign: "center" }}
              >
                Log in
              </a>
            </div>
          </>
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
    maxWidth: 440,
    padding: 32,
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
    color: "var(--shell-text)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 12,
    textAlign: "center",
  },
  eyebrow: {
    fontSize: 12,
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
  },
  roleBadge: { marginTop: 4 },
  badgePill: {
    display: "inline-block",
    padding: "4px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 700,
  },
  studyName: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--shell-text)",
    marginTop: 4,
  },
  expires: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
  },
  needAccount: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    margin: "8px 0",
  },
  loggedInAs: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    margin: "8px 0",
  },
  btnGroup: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    width: "100%",
    marginTop: 4,
  },
  btn: {
    width: "100%",
    padding: "11px 16px",
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
    padding: "11px 16px",
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
  },
  muted: {
    fontSize: 13,
    color: "var(--shell-text-muted)",
    margin: "4px 0 0",
  },
};
