import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function Login({ onLogin, onGoToRegister }) {
  const [searchParams] = useSearchParams();
  const researcherToken = searchParams.get("researcher");
  const joinCode = searchParams.get("join") || sessionStorage.getItem("pending_join_code") || null;

  const [identifier, setIdentifier] = useState(""); // username OR email
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [attemptsRemaining, setAttemptsRemaining] = useState(null);
  const [lockedUntil, setLockedUntil] = useState(null);

  const isEmail = useMemo(() => identifier.includes("@"), [identifier]);

  function formatLockedUntil(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString();
    } catch {
      return isoString;
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setAttemptsRemaining(null);
    setLockedUntil(null);

    const trimmed = identifier.trim();
    if (!trimmed) {
      setError("Username or email is required.");
      return;
    }
    if (!password) {
      setError("Password is required.");
      return;
    }

    const body = isEmail
      ? { email: trimmed.toLowerCase(), password }
      : { username: trimmed, password };

    setLoading(true);
    try {
      const res = await fetch("/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // REQUIRED for Flask session cookie
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        // Your API returns error messages in `error`
        const apiError = data?.error || "Login failed.";

        // Handle lockout (423)
        if (res.status === 423) {
          setLockedUntil(data?.locked_until || null);
          setError(apiError);
        } else {
          setAttemptsRemaining(
            typeof data?.attempts_remaining === "number"
              ? data.attempts_remaining
              : null
          );
          setError(apiError);
        }

        setLoading(false);
        return;
      }

      // If a researcher invite token is in the URL, accept it after login
      if (researcherToken) {
        try {
          await fetch(`/auth/researcher/join/${researcherToken}`, {
            method: "POST",
            credentials: "include",
          });
        } catch {}
        onLogin?.(data.user);
        setLoading(false);
        return;
      }

      // If a pending join code exists, attempt enrollment after login
      if (joinCode) {
        try {
          const pendingToken = sessionStorage.getItem("pending_join_token");
          const enrollRes = await fetch(`/auth/join/${joinCode}/enroll`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ token: pendingToken }),
          });
          sessionStorage.removeItem("pending_join_code");
          sessionStorage.removeItem("pending_join_token");
          if (enrollRes.ok) {
            const enrollData = await enrollRes.json().catch(() => ({}));
            onLogin?.(enrollData.user || data.user);
            setLoading(false);
            return;
          }
        } catch {}
      }

      // Success: { message, user }
      onLogin?.(data.user);
      setLoading(false);
    } catch (err) {
      setError("Network error. Is the server running?");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Sign in</h1>
          <p style={styles.subtitle}>Use your username or email to log in.</p>
        </div>

        {joinCode && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(99,179,237,0.12)",
            border: "1px solid rgba(99,179,237,0.35)",
            color: "#bee3f8",
            fontSize: 13,
            marginBottom: 8,
          }}>
            Sign in to complete your study enrollment.
          </div>
        )}

        <label style={styles.label}>
          Username or Email
          <input
            style={styles.input}
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            autoComplete="username"
            placeholder="e.g. user or test@baylor.edu"
            required
          />
        </label>

        <label style={styles.label}>
          Password
          <div style={styles.pwRow}>
            <input
              style={{ ...styles.input, marginBottom: 0 }}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              type={showPw ? "text" : "password"}
              autoComplete="current-password"
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              style={styles.pwToggle}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? "Hide" : "Show"}
            </button>
          </div>
        </label>

        {error && (
          <div style={styles.errorBox} role="alert">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>Login error</div>
            <div>{error}</div>

            {typeof attemptsRemaining === "number" && (
              <div style={styles.meta}>
                Attempts remaining before lockout:{" "}
                <strong>{attemptsRemaining}</strong>
              </div>
            )}

            {lockedUntil && (
              <div style={styles.meta}>
                Locked until: <strong>{formatLockedUntil(lockedUntil)}</strong>
              </div>
            )}
          </div>
        )}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Signing in..." : "Sign in"}
        </button>

        <p style={{
          fontSize: 13,
          color: "var(--shell-text-muted, #8b9cbe)",
          textAlign: "center",
          marginTop: 12,
          marginBottom: 4,
        }}>
          If you are a researcher, use your admin credentials. Participant and
          admin accounts are separate.
        </p>

        <div style={styles.footer}>
          <button type="button" onClick={onGoToRegister} style={styles.linkBtn}>
            Create account
          </button>
        </div>
      </form>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: 16,
    background: "var(--auth-page-bg)",
  },
  card: {
    width: "100%",
    maxWidth: 420,
    padding: 24,
    borderRadius: 14,
    border: "1px solid var(--auth-card-border)",
    background: "var(--auth-card-bg)",
    color: "var(--text-primary)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 26, letterSpacing: 0.2 },
  subtitle: { margin: "6px 0 0", opacity: 0.8, fontSize: 14 },
  label: { display: "grid", gap: 6, marginBottom: 12, fontSize: 14 },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    outline: "none",
    fontSize: 16,
  },
  pwRow: {
    display: "grid",
    gridTemplateColumns: "1fr auto",
    gap: 8,
    alignItems: "center",
  },
  pwToggle: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  errorBox: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255, 80, 80, 0.12)",
    border: "1px solid rgba(255, 80, 80, 0.35)",
    color: "#ffd1d1",
    fontSize: 14,
    lineHeight: 1.35,
  },
  meta: { marginTop: 8, opacity: 0.95, fontSize: 13 },
  button: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    border: "none",
    background: "var(--accent)",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--accent)",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    fontSize: "inherit",
  },
  footer: {
  marginTop: 14,
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
};
