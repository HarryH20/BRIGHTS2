import React from "react";
import { Link } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

export default function Profile({ user, onLogout }) {
  return (
    <HomeLayout user={user} onLogout={onLogout} title="Profile / Settings">
      <div style={styles.card}>
        {/* Basic Info */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Account Information</h2>

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <div style={styles.value}>{user?.username || "—"}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <div style={styles.value}>{user?.email || "—"}</div>
          </div>
        </section>

        {/* Profile Picture Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Profile Picture</h2>

          <div style={styles.pictureRow}>
            <div style={styles.avatarPlaceholder}>No Image</div>
            <button style={styles.button} disabled>
              Upload New Picture (coming soon)
            </button>
          </div>
        </section>

        {/* Phone Number Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Phone Number</h2>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              type="text"
              placeholder="Add phone number (coming soon)"
              style={styles.input}
              disabled
            />
          </div>
        </section>

        {/* Password Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Change Password</h2>

          <div style={styles.passwordGrid}>
            <input
              type="password"
              placeholder="Current password"
              style={styles.input}
              disabled
            />
            <input
              type="password"
              placeholder="New password"
              style={styles.input}
              disabled
            />
            <input
              type="password"
              placeholder="Confirm new password"
              style={styles.input}
              disabled
            />
          </div>

          <button style={styles.button} disabled>
            Update Password (coming soon)
          </button>
        </section>

        <div style={{ marginTop: 20 }}>
          <Link to="/dashboard" style={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </HomeLayout>
  );
}

const styles = {
  card: {
    padding: 24,
    borderRadius: 16,
    border: "1px solid rgba(155,183,255,0.16)",
    background: "rgba(16, 25, 42, 0.65)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
    maxWidth: 800,
    margin: "0 auto",
  },

  section: {
    marginBottom: 28,
  },

  h2: {
    marginBottom: 12,
    fontSize: 18,
  },

  field: {
    marginBottom: 14,
  },

  label: {
    fontSize: 12,
    opacity: 0.7,
    display: "block",
    marginBottom: 4,
  },

  value: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e9eefc",
    marginBottom: 10,
  },

  passwordGrid: {
    display: "grid",
    gap: 10,
    marginBottom: 12,
  },

  pictureRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
    opacity: 0.7,
  },

  button: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(233,238,252,0.9)",
    fontWeight: 700,
    cursor: "not-allowed",
  },

  backLink: {
    color: "rgba(233,238,252,0.92)",
    fontWeight: 800,
    textDecoration: "none",
  },
};