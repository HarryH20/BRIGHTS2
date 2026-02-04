import { useState } from "react";

export default function Register({ onRegistered, onGoToLogin }) {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

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

      setSuccess("Account created! You can now sign in.");
      onRegistered?.(data.user);

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
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            required
          />
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
    background: "#0b1220",
  },
  card: {
    width: "100%",
    maxWidth: 460,
    padding: 24,
    borderRadius: 14,
    border: "1px solid #24314a",
    background: "#10192a",
    color: "#e9eefc",
    boxShadow: "0 12px 32px rgba(0,0,0,0.35)",
  },
  header: { marginBottom: 16 },
  title: { margin: 0, fontSize: 26 },
  subtitle: { margin: "6px 0 0", opacity: 0.8, fontSize: 14 },
  label: { display: "grid", gap: 6, marginBottom: 12, fontSize: 14 },
  input: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #2a3a58",
    background: "#0b1220",
    color: "#e9eefc",
    outline: "none",
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
    background: "#4f7cff",
    color: "white",
    fontWeight: 700,
    cursor: "pointer",
  },
  footer: { marginTop: 14, textAlign: "center" },
  linkBtn: {
    border: "none",
    background: "transparent",
    color: "#9bb7ff",
    cursor: "pointer",
    padding: 0,
    textDecoration: "underline",
    fontSize: "inherit",
  },
};
