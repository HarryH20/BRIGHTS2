import React from "react";
import { Link } from "react-router-dom";

export default function HomeLayout({ user, onLogout, title, rightSlot, children }) {
  const name = user?.username || "user";

  return (
    <div className="home-page" style={styles.page}>
      <header className="home-header" style={styles.header}>
        <div className="home-header-left" style={styles.left}>
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

        <div className="home-header-center" style={styles.center}>
          <h1 style={styles.h1}>{title ?? `Welcome, ${name}!`}</h1>
          {rightSlot ? <div style={{ marginTop: 8 }}>{rightSlot}</div> : null}
        </div>

        <div className="home-header-right" style={styles.right}>
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
    alignItems: "center",
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
    border: "1px solid var(--logout-border)",
    background: "var(--logout-bg)",
    color: "var(--logout-color)",
    cursor: "pointer",
    fontWeight: 700,
  },

  main: { maxWidth: 1100, margin: "0 auto" },
};
