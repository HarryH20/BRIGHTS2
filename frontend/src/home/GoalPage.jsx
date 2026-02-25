import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";
import RadarPlot from "../graphs/RadarPlot.jsx";

const LIKERT = {
  1: "Strongly disagree", 2: "Disagree", 3: "Somewhat disagree",
  4: "Neutral", 5: "Somewhat agree", 6: "Agree", 7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027", 2: "#fc8d59", 3: "#fee090", 4: "#aaaaaa",
  5: "#91bfdb", 6: "#4575b4", 7: "#2166AC",
};

const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };
const ALL_TPS = ["T2", "T3", "T4", "T5", "T6"];

function tpsForWeeks(weeks) {
  const [startStr, endStr] = String(weeks || "2-6").split("-");
  const start = Number(startStr);
  const end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return ALL_TPS;

  return ALL_TPS.filter((tp) => {
    const w = Number(tp.replace("T", ""));
    return w >= start && w <= end;
  });
}

export default function GoalPage({ user, onLogout }) {
  const { goalId } = useParams();
  const [goal, setGoal] = useState(null);
  const [goalIndex, setGoalIndex] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [weeks, setWeeks] = useState("2-6");
  const subtitle = useMemo(() => `Filters: Weeks ${weeks}`, [weeks]);
  const shownTPs = useMemo(() => tpsForWeeks(weeks), [weeks]);

  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const goals = d.goals || [];
        const idx = goals.findIndex((g) => String(g.goal_id) === String(goalId));
        if (idx !== -1) {
          setGoal(goals[idx]);
          setGoalIndex(idx);
        } else {
          setError("Goal not found.");
        }
      })
      .catch(() => setError("Failed to load goal data."))
      .finally(() => setLoading(false));
  }, [goalId]);

  return (
    <HomeLayout
      user={user}
      onLogout={onLogout}
      title={goal ? goal.text : `Goal ${goalId}`}
      rightSlot={<span style={pill}>{subtitle}</span>}
    >
      <div style={card}>
        {/* Filter bar: Weeks only */}
        <div style={row}>
          <label style={label}>
            Weeks
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)} style={select}>
              <option value="1-6">Weeks 1–6</option>
              <option value="2-6">Weeks 2–6</option>
              <option value="3-6">Weeks 3–6</option>
              <option value="4-6">Weeks 4–6</option>
              <option value="5-6">Weeks 5–6</option>
            </select>
          </label>
        </div>

        {loading && <div style={muted}>Loading…</div>}
        {error && <div style={{ ...muted, color: "#f87171" }}>{error}</div>}

        {goal && (
          <>
            <div style={{ marginBottom: 22 }}>
              <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.08em" }}>Goal</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{goal.text}</div>
            </div>

            <table style={table}>
              <thead>
                <tr>
                  <th style={th}>Timepoint</th>
                  <th style={th}>Progress</th>
                  <th style={th}>Confidence</th>
                  <th style={th}>Importance</th>
                </tr>
              </thead>
              <tbody>
                {shownTPs.map((tp) => {
                  const scores = goal.timepoints?.[tp] || {};
                  return (
                    <tr key={tp}>
                      <td style={{ ...td, fontWeight: 700 }}>{TP_LABELS[tp]}</td>
                      {["Q39", "Q40", "Q41"].map((q) => (
                        <td key={q} style={td}>
                          {scores[q] != null ? (
                            <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                              <span style={{
                                display: "inline-block", width: 9, height: 9,
                                borderRadius: "50%", background: SCORE_COLOR[scores[q]], flexShrink: 0,
                              }} />
                              {LIKERT[scores[q]]}
                            </span>
                          ) : (
                            <span style={{ opacity: 0.35 }}>—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        )}

        {goalIndex !== null && (
          <div style={{ marginTop: 22 }}>
            <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.08em" }}>
              Goal Traits Radar
            </div>
            <div style={{ borderRadius: 12, border: "1px solid rgba(155,183,255,0.12)", background: "rgba(255,255,255,0.03)" }}>
              <RadarPlot goalIndex={goalIndex} />
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 22 }}>
          <Link to="/dashboard" style={pillLink}>← Back to Dashboard</Link>
        </div>
      </div>
    </HomeLayout>
  );
}

const card = {
  padding: 22,
  borderRadius: 16,
  border: "1px solid rgba(155,183,255,0.16)",
  background: "rgba(16, 25, 42, 0.65)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  backdropFilter: "blur(8px)",
};

const row = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 };
const label = { display: "grid", gap: 6, fontWeight: 800, fontSize: 13, opacity: 0.92 };
const select = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)",
  outline: "none",
};
const pillBtn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)",
  fontWeight: 900,
  textDecoration: "none",
};
const pill = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.85)",
};
const pillLink = {
  padding: "10px 14px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)", fontWeight: 800,
  textDecoration: "none", display: "inline-flex",
};

const muted = { opacity: 0.82, fontSize: 14, lineHeight: 1.45 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", padding: "8px 14px",
  borderBottom: "1px solid rgba(155,183,255,0.2)",
  opacity: 0.65, fontWeight: 700, fontSize: 12,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
const td = { padding: "11px 14px", borderBottom: "1px solid rgba(155,183,255,0.08)" };