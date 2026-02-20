import React, { useState } from "react";
import { Link } from "react-router-dom";
import RosePlot from "../graphs/RosePlot.jsx";
import HomeLayout from "./HomeLayout.jsx";

export default function Dashboard({ user, onLogout }) {
  const [goalFilter, setGoalFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("2-6");

  const recent = [
    { id: "latest", name: "Latest Survey" },
    { id: "week1", name: "Week 1 Survey" },
    { id: "week2", name: "Week 2 Survey" },
  ];

  const goals = [
    { id: "1", title: "Goal 1", summary: "Summary coming soon…" },
    { id: "2", title: "Goal 2", summary: "Summary coming soon…" },
    { id: "3", title: "Goal 3", summary: "Summary coming soon…" },
  ];

  return (
    <HomeLayout
      user={user}
      onLogout={onLogout}
      title={`Welcome, ${user?.username || "user"}!`}
    >
      <div style={styles.grid}>
        {/* Latest / Most Recent */}
        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>Latest / Most Recent</h2>
          </div>

          <div style={styles.recentList}>
            {recent.map((s) => (
              <div key={s.id} style={styles.recentRow}>
                <div style={styles.recentName}>{s.name}</div>

                <div style={styles.recentLinks}>
                  <Link style={styles.linkBtn} to={`/surveys/${s.id}/results`}>
                    Responses / Results
                  </Link>
                  <Link style={styles.linkBtn} to={`/surveys/${s.id}/analysis`}>
                    Analysis
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Goals Row */}
        {goals.map((g) => (
          <section key={g.id} style={{ ...styles.card, gridColumn: "span 4" }}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>{g.title}</h2>
              <Link to={`/goals/${g.id}`} style={styles.smallLink}>
                Open →
              </Link>
            </div>

            <div style={styles.summaryBox}>
              <div style={styles.summaryTitle}>Summary</div>
              <div style={styles.muted}>{g.summary}</div>
            </div>

            <div style={styles.graphBox}>
              <div style={styles.muted}>[graph]</div>
            </div>
          </section>
        ))}

        {/* Overview */}
        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>Overview</h2>
            <Link to="/overview" style={styles.smallLink}>
              Open →
            </Link>
          </div>

          {/* ✅ REAL dropdown filters */}
          <div style={styles.filtersRow}>
            <div style={styles.muted}>filter by goals(s), week(s):</div>

            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Goals</option>
              <option value="1">Goal 1</option>
              <option value="2">Goal 2</option>
              <option value="3">Goal 3</option>
            </select>

            <select
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              style={styles.select}
            >
              <option value="all">All Weeks</option>
              <option value="1-1">Week 1</option>
              <option value="2-6">Week 2–6</option>
              <option value="3-6">Week 3–6</option>
              <option value="4-6">Week 4–6</option>
              <option value="5-6">Week 5–6</option>
            </select>
          </div>

          <div style={styles.overviewBox}>
            <div style={{ width: "100%" }}>
              {/* If RosePlot ignores props, this still renders fine. */}
              <RosePlot goal={goalFilter} weeks={weekFilter} />
            </div>
          </div>
        </section>
      </div>
    </HomeLayout>
  );
}

const styles = {
  grid: { display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 16 },
  card: {
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
    marginBottom: 10,
  },
  h2: { margin: 0, fontSize: 20 },
  muted: { opacity: 0.82, fontSize: 14, lineHeight: 1.45 },

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

  smallLink: {
    textDecoration: "none",
    color: "rgba(233,238,252,0.90)",
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
  },

  recentList: { display: "grid", gap: 10 },
  recentRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid rgba(155,183,255,0.12)",
    background: "rgba(255,255,255,0.03)",
  },
  recentName: { fontWeight: 700 },
  recentLinks: { display: "flex", gap: 10 },

  summaryBox: {
    borderRadius: 12,
    border: "1px solid rgba(155,183,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
  },
  summaryTitle: { fontWeight: 800, marginBottom: 6 },

  graphBox: {
    marginTop: 12,
    height: 140,
    borderRadius: 12,
    border: "1px solid rgba(155,183,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    display: "grid",
    placeItems: "center",
  },

  filtersRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },

  select: {
    padding: "8px 10px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(233,238,252,0.92)",
    fontWeight: 800,
    fontSize: 13,
    outline: "none",
  },

  overviewBox: {
    borderRadius: 12,
    border: "1px solid rgba(155,183,255,0.12)",
    background: "rgba(255,255,255,0.03)",
    padding: 12,
  },
};