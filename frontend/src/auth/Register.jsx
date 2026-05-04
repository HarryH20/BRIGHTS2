import { useState } from "react";
import { useSearchParams } from "react-router-dom";

export default function Register({ onRegistered, onGoToLogin }) {
  const [searchParams] = useSearchParams();
  const researcherToken = searchParams.get("researcher");
  const joinCode = searchParams.get("join") || sessionStorage.getItem("pending_join_code") || null;

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setSuccess("");

    const u = username.trim();
    const em = email.trim().toLowerCase();

    if (u.length < 3) {
      setError("Username must be at least 3 characters.");
      return;
    }
    if (!em.includes("@")) {
      setError("Please enter a valid email.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ username: u, email: em, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setError(data?.error || "Registration failed.");
        setLoading(false);
        return;
      }

      // Log in first to get a session (needed for join/researcher flows)
      if (researcherToken || joinCode) {
        try {
          const loginRes = await fetch("/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ username: u, password }),
          });
          if (loginRes.ok) {
            if (researcherToken) {
              await fetch(`/auth/researcher/join/${researcherToken}`, {
                method: "POST",
                credentials: "include",
              });
            }
            if (joinCode) {
              const pendingToken = sessionStorage.getItem("pending_join_token");
              const enrollRes = await fetch(`/auth/join/${joinCode}/enroll`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ token: pendingToken }),
              });
              if (enrollRes.ok) {
                sessionStorage.removeItem("pending_join_code");
                sessionStorage.removeItem("pending_join_token");
                const enrollData = await enrollRes.json().catch(() => ({}));
                setLoading(false);
                onRegistered?.(enrollData.user || data.user, true);
                return;
              }
            }
          }
        } catch {}
      }

      setSuccess("Account created! You can now sign in.");
      onRegistered?.(data.user);

      setPassword("");
      setConfirmPassword("");

      setLoading(false);
    } catch {
      setError("Network error. Is the server running?");
      setLoading(false);
    }
  }

  return (
    <div style={styles.page}>
      <form onSubmit={handleSubmit} style={styles.card}>
        <div style={styles.header}>
          <h1 style={styles.title}>Create account</h1>
          <p style={styles.subtitle}>Register with a username, email, and password.</p>
        </div>

        {joinCode && (
          <div style={{
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(99,179,237,0.12)",
            border: "1px solid rgba(99,179,237,0.35)",
            color: "#bee3f8",
            fontSize: 13,
            marginBottom: 4,
          }}>
            You are enrolling in a research study. After creating your account you will be automatically enrolled.
          </div>
        )}

        <p style={{
          fontSize: 13,
          color: "var(--shell-text-muted, #8b9cbe)",
          textAlign: "center",
          marginTop: 4,
          marginBottom: 16,
        }}>
          This creates a participant account. Researchers and admins use separate
          accounts — contact your study coordinator if you need admin access.
        </p>

        <label style={styles.label}>
          Username
          <input
            style={styles.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
            placeholder="e.g. testuser"
            required
          />
        </label>

        <label style={styles.label}>
          Email
          <input
            style={styles.input}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            autoComplete="email"
            placeholder="e.g. test@example.com"
            required
          />
        </label>

        <label style={styles.label}>
          Password (min 8 characters)
          <input
            style={styles.input}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </label>

        <label style={styles.label}>
          Confirm Password
          <input
            style={styles.input}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
        </label>

        {confirmPassword && password !== confirmPassword && (
          <div style={styles.errorBox} role="alert">
            Passwords do not match.
          </div>
        )}

        <label
            style={{
              fontSize: 13,
              display: "flex",
              gap: 8,
              alignItems: "center",
              marginBottom: 12,
          }}
        >
          <input
            type="checkbox"
            checked={showPassword}
            onChange={() => setShowPassword((v) => !v)}
          />
          Show password
        </label>

        {error && (
          <div style={styles.errorBox} role="alert">
            {error}
          </div>
        )}

        {success && (
          <div style={styles.successBox} role="status">
            {success}
          </div>
        )}

        <button type="submit" style={styles.button} disabled={loading}>
          {loading ? "Creating..." : "Create account"}
        </button>

        <div style={styles.footer}>
          <small style={{ opacity: 0.85 }}>
            Already have an account?{" "}
            <button type="button" onClick={onGoToLogin} style={styles.linkBtn}>
              Sign in
            </button>
          </small>
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
    maxWidth: 460,
    padding: 24,
    borderRadius: 14,
    border: "1px solid var(--auth-card-border)",
    background: "var(--auth-card-bg)",
    color: "var(--text-primary)",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 26 },
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
  errorBox: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(255, 80, 80, 0.12)",
    border: "1px solid rgba(255, 80, 80, 0.35)",
    color: "#ffd1d1",
    fontSize: 14,
  },
  successBox: {
    marginTop: 8,
    marginBottom: 12,
    padding: 12,
    borderRadius: 12,
    background: "rgba(80, 255, 140, 0.12)",
    border: "1px solid rgba(80, 255, 140, 0.35)",
    color: "#c9ffd8",
    fontSize: 14,
  },
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
  footer: { marginTop: 14, textAlign: "center" },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "var(--accent)",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    fontSize: "inherit",
  },
};
