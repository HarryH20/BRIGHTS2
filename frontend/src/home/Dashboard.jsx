import React from "react";
import RosePlot from "../graphs/RosePlot.jsx";

export default function Dashboard({ user, onLogout }) {
  const name = user?.username || "kirby";
  const role = user?.role || "user";

  return (
    <div style={styles.page}>
      <header style={styles.header}>
        <div>
          <h1 style={styles.h1}>Welcome, {name}!</h1>
          <div style={styles.roleRow}>
            <span style={styles.rolePill}>{role}</span>
          </div>
        </div>

        <button type="button" onClick={onLogout} style={styles.logoutBtn}>
          Logout
        </button>
      </header>

      <main style={styles.main}>
        <section style={styles.grid}>
          {/* Goal Summary */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>Goal Summary</h2>
              <span style={styles.badge}>Coming soon</span>
            </div>
            <p style={styles.muted}>
              This section will summarize your “beyond-the-self” goals and key metrics.
            </p>
            <div style={styles.list}>
              <div style={styles.skeletonLine} />
              <div style={styles.skeletonLine} />
              <div style={{ ...styles.skeletonLine, width: "65%" }} />
            </div>
          </div>

          {/* Trajectory */}
          <div style={styles.card}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>Trajectory</h2>
              <span style={styles.badge}>Coming soon</span>
            </div>
            <p style={styles.muted}>
              This section will show how your responses change across timepoints.
            </p>
            <div style={styles.list}>
              <div style={styles.skeletonLine} />
              <div style={{ ...styles.skeletonLine, width: "72%" }} />
              <div style={{ ...styles.skeletonLine, width: "58%" }} />
            </div>
          </div>

          {/* Rose Plot Visualization */}
          <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>Goal Progression — Rose Plot</h2>
              <span style={styles.badge}>Sprint 1</span>
            </div>
            <p style={styles.muted}>
              Likert responses (Q39–Q41) across timepoints T2–T6. Bottom row
              shows the distribution summary.
            </p>
            <div style={styles.chartWrap}>
              <RosePlot />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    background: "radial-gradient(1200px 600px at 20% 0%, #172a52 0%, #0b1220 55%, #070b14 100%)",
    color: "#e9eefc",
    padding: 24,
  },
  header: {
    maxWidth: 1100,
    margin: "0 auto 18px",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
    padding: 18,
    borderRadius: 16,
    border: "1px solid rgba(155,183,255,0.18)",
    background: "rgba(16, 25, 42, 0.75)",
    boxShadow: "0 18px 40px rgba(0,0,0,0.35)",
    backdropFilter: "blur(8px)",
  },
  h1: { margin: 0, fontSize: 34, letterSpacing: 0.2 },
  roleRow: { marginTop: 8, display: "flex", gap: 10, alignItems: "center" },
  rolePill: {
    display: "inline-flex",
    padding: "6px 10px",
    borderRadius: 999,
    fontSize: 13,
    border: "1px solid rgba(155,183,255,0.25)",
    background: "rgba(79,124,255,0.15)",
    color: "#cfe0ff",
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
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(12, 1fr)",
    gap: 16,
  },
  card: {
    gridColumn: "span 6",
    padding: 18,
    borderRadius: 16,
    border: "1px solid rgba(155,183,255,0.16)",
    background: "rgba(16, 25, 42, 0.65)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },
  cardHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  h2: { margin: 0, fontSize: 20 },
  badge: {
    fontSize: 12,
    padding: "4px 10px",
    borderRadius: 999,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(233,238,252,0.85)",
  },
  muted: { margin: "8px 0 0", opacity: 0.82, fontSize: 14, lineHeight: 1.45 },
  list: { marginTop: 14, display: "grid", gap: 10 },
  skeletonLine: {
    height: 10,
    width: "85%",
    borderRadius: 999,
    background: "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.12), rgba(255,255,255,0.06))",
  },

  chartWrap: { marginTop: 12 },
};
