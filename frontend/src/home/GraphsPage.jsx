import React from "react";
import { Link } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

export default function GraphsPage({ user, onLogout }) {
  return (
    <HomeLayout user={user} onLogout={onLogout} title="Survey Graphs">
      <div style={styles.card}>
        <div style={styles.header}>
          <h2 style={styles.h2}>Survey Graphs</h2>
          <Link to="/dashboard" style={styles.backBtn}>
            ← Back to Dashboard
          </Link>
        </div>

        <p style={styles.muted}>
          Graphs are available on the dashboard. Admin-only graphs are not shown here.
        </p>
      </div>
    </HomeLayout>
  );
}

const styles = {
  card: {
    padding: 22,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  h2: {
    margin: 0,
    fontSize: 20,
  },
  muted: {
    opacity: 0.7,
    fontSize: 14,
    marginBottom: 20,
  },
  backBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },
};