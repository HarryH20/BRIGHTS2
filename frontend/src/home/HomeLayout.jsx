import React from "react";
import { Link } from "react-router-dom";

export default function HomeLayout({ user, onLogout, title, rightSlot, children }) {
  const name = user?.username || "user";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div style={styles.left}>
          <Link to="/profile" style={styles.linkBtn}>
            Profile / Settings
          </Link>
        </div>

        <div style={styles.center}>
          <h1 style={styles.h1}>{title ?? `Welcome, ${name}!`}</h1>
          {rightSlot ? <div style={{ marginTop: 8 }}>{rightSlot}</div> : null}
        </div>

        <div style={styles.right}>
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
    background:
      "radial-gradient(1200px 600px at 20% 0%, #172a52 0%, #0b1220 55%, #070b14 100%)",
    color: "#e9eefc",
    padding: 24,
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 18px",
    display: "grid",
    alignItems: "center",
    gap: 16,
    padding: 18,
    borderRadius: 16,
    border: "1px solid rgba(155,183,255,0.18)",
    background: "rgba(16, 25, 42, 0.75)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
  },
  left: { display: "flex", justifyContent: "flex-start" },
  center: { textAlign: "center" },
  right: { display: "flex", justifyContent: "flex-end" },
  h1: { margin: 0, fontSize: 28, letterSpacing: 0.2 },

  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(233,238,252,0.92)",
    textDecoration: "none",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
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