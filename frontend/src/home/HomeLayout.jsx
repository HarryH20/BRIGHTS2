import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../ThemeContext.jsx";

export default function HomeLayout({ user, onLogout, title, rightSlot, children }) {
  const name = user?.username || "user";
  const { theme, toggleTheme } = useTheme();

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.left}>
          <Link to="/profile" style={styles.linkBtn}>
            {user?.avatar_url ? (
              <img
                src={user.avatar_url}
                alt="avatar"
                style={{ width: 24, height: 24, borderRadius: "50%", objectFit: "cover", marginRight: 8, flexShrink: 0 }}
              />
            ) : null}
            Profile / Settings
          </Link>
        </div>

        <div style={styles.center}>
          <h1 style={styles.h1}>{title ?? `Welcome, ${name}!`}</h1>
          {rightSlot ? <div style={{ marginTop: 8 }}>{rightSlot}</div> : null}
        </div>

        <div style={styles.right}>
          <button type="button" onClick={toggleTheme} style={styles.themeBtn} aria-label="Toggle theme">
            {theme === "dark" ? "☀ Light" : "🌙 Dark"}
          </button>
          <button type="button" onClick={onLogout} style={styles.logoutBtn}>
            Logout
          </button>
        </div>
      </header>
      <main style={styles.main}>{children}</main>

      {user?.participant_id && (
        <div style={{
          position: 'fixed',
          bottom: '12px',
          right: '16px',
          fontSize: '10px',
          opacity: 0.25,
          color: '#c8d6f0',
          fontFamily: 'monospace',
          letterSpacing: '0.05em',
          pointerEvents: 'none',
          userSelect: 'none',
        }}>
          ID: {user.participant_id}
        </div>
      )}
    </div>
  );
}

export const styles = {
  page: {
    minHeight: "100vh",
    background: "var(--page-bg)",
    color: "var(--text-primary)",
    padding: 24,
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 18px",
    display: "grid",
    gridTemplateColumns: "1fr auto 1fr",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--header-border)",
    background: "var(--header-bg)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
  },
  left: { display: "flex", justifyContent: "flex-start" },
  center: { textAlign: "center" },
  right: { display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 },
  h1: { margin: 0, fontSize: 28, letterSpacing: 0.2 },

  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    textDecoration: "none",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
  },

  themeBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    whiteSpace: "nowrap",
  },

  adminBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    textDecoration: "none",
    fontWeight: 700,
    fontSize: 13,
  },

  logoutBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255, 80, 80, 0.10)",
    color: "#ffd1d1",
    cursor: "pointer",
    fontWeight: 700,
  },

  main: { maxWidth: 1100, margin: "0 auto" },
};
