import React from "react";

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

          {/* Charts placeholder: big chart */}
          <div style={{ ...styles.card, gridColumn: "1 / -1" }}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>Data Visualizations</h2>
              <span style={styles.badge}>Charts</span>
            </div>

            <div style={styles.chartWrap}>
              <div style={styles.chartPlaceholder}>
                <div style={styles.chartTopRow}>
                  <div style={styles.chartTitle}>Goal Trajectory (placeholder)</div>
                  <div style={styles.chartHint}>Line chart • Timepoints</div>
                </div>

                <div style={styles.chartArea}>
                  {/* Fake chart grid */}
                  <div style={styles.chartGrid} />
                  <div style={styles.chartGrid} />
                  <div style={styles.chartGrid} />
                  <div style={styles.chartGrid} />
                  <div style={styles.chartGrid} />
                </div>

                <div style={styles.chartFooter}>
                  <div style={styles.skeletonChip} />
                  <div style={styles.skeletonChip} />
                  <div style={styles.skeletonChip} />
                </div>
              </div>

              {/* Two small chart cards */}
              <div style={styles.chartRow}>
                <div style={styles.smallChart}>
                  <div style={styles.smallChartTitle}>Agency Score (placeholder)</div>
                  <div style={styles.smallChartBox} />
                </div>
                <div style={styles.smallChart}>
                  <div style={styles.smallChartTitle}>Goal Categories (placeholder)</div>
                  <div style={styles.smallChartBox} />
                </div>
              </div>
            </div>

            <p style={{ ...styles.muted, marginTop: 12 }}>
              Charts will appear here once survey data is connected (e.g., Plotly/Recharts).
            </p>
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

  chartWrap: { marginTop: 12, display: "grid", gap: 14 },
  chartPlaceholder: {
    borderRadius: 16,
    border: "1px dashed rgba(155,183,255,0.35)",
    background: "rgba(11,18,32,0.65)",
    padding: 14,
  },
  chartTopRow: { display: "flex", justifyContent: "space-between", gap: 12, alignItems: "baseline" },
  chartTitle: { fontWeight: 800, fontSize: 14 },
  chartHint: { opacity: 0.7, fontSize: 12 },
  chartArea: {
    marginTop: 12,
    height: 220,
    borderRadius: 14,
    border: "1px solid rgba(155,183,255,0.14)",
    background:
      "repeating-linear-gradient(0deg, rgba(255,255,255,0.05), rgba(255,255,255,0.05) 1px, transparent 1px, transparent 32px)",
    display: "grid",
    alignItems: "end",
    padding: 12,
    gap: 10,
  },
  chartGrid: {
    height: "100%",
    borderRadius: 10,
    background:
      "linear-gradient(180deg, rgba(79,124,255,0.14), rgba(79,124,255,0.02))",
  },
  chartFooter: { marginTop: 12, display: "flex", gap: 10 },
  skeletonChip: {
    height: 22,
    width: 90,
    borderRadius: 999,
    background: "rgba(255,255,255,0.08)",
    border: "1px solid rgba(255,255,255,0.10)",
  },

  chartRow: {
    display: "grid",
    gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
    gap: 14,
  },
  smallChart: {
    borderRadius: 16,
    border: "1px dashed rgba(155,183,255,0.28)",
    background: "rgba(11,18,32,0.65)",
    padding: 14,
  },
  smallChartTitle: { fontWeight: 800, fontSize: 14, marginBottom: 10 },
  smallChartBox: {
    height: 140,
    borderRadius: 14,
    border: "1px solid rgba(155,183,255,0.14)",
    background:
      "linear-gradient(90deg, rgba(255,255,255,0.06), rgba(255,255,255,0.10), rgba(255,255,255,0.06))",
  },
};
