import React from "react";
import { Link } from "react-router-dom";
import RadarPlot from "../graphs/RadarPlot.jsx";

const LIKERT = {
  1: "Strongly disagree", 2: "Disagree", 3: "Somewhat disagree",
  4: "Neutral", 5: "Somewhat agree", 6: "Agree", 7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027", 2: "#fc8d59", 3: "#fee090", 4: "#aaaaaa",
  5: "#91bfdb", 6: "#4575b4", 7: "#2166AC",
};

const TP_ORDER  = ["T6", "T5", "T4", "T3", "T2"];
const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };

export default function GoalCard({ goal, idx, radarFigure, colSpan = 4 }) {
  const latestTp = TP_ORDER.find(tp =>
    Object.values(goal.timepoints?.[tp] || {}).some(v => v !== null)
  );
  const latestScores = latestTp ? goal.timepoints[latestTp] : null;

  const latestTpIdx = latestTp ? TP_ORDER.indexOf(latestTp) : -1;
  const prevTpKey   = latestTpIdx >= 0 && latestTpIdx < TP_ORDER.length - 1
    ? TP_ORDER[latestTpIdx + 1] : null;
  const prevScores  = prevTpKey &&
    Object.values(goal.timepoints?.[prevTpKey] || {}).some(v => v !== null)
    ? goal.timepoints[prevTpKey] : null;

  const shortTitle = goal.text.length > 28 ? goal.text.slice(0, 28) + "…" : goal.text;

  return (
    <section
      className="card-interactive"
      style={{ ...s.card, gridColumn: `span ${colSpan}` }}
    >
      <div style={s.cardHeader}>
        <div className="goal-name-wrapper">
          <h2 style={s.h2}>Goal {idx + 1}: {shortTitle}</h2>
          <span className="goal-tooltip">{goal.text}</span>
        </div>
        <Link to={`/goals/${goal.goal_id}`} style={s.smallLink}>Open →</Link>
      </div>

      <div style={s.summaryBox}>
        <div style={s.summaryTitle}>
          {latestTp ? `${TP_LABELS[latestTp]} Scores` : "Scores"}
        </div>

        {latestScores ? (
          <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
            {[["Q39", "Progress"], ["Q40", "Confidence"], ["Q41", "Importance"]].map(([q, label]) => (
              <div key={q} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ opacity: 0.6, width: 80, flexShrink: 0 }}>{label}</span>
                {latestScores[q] != null ? (
                  <>
                    <span style={{
                      display: "inline-block", width: 10, height: 10,
                      borderRadius: "50%", background: SCORE_COLOR[latestScores[q]], flexShrink: 0,
                    }} />
                    <span>{LIKERT[latestScores[q]]}</span>
                    {prevScores?.[q] != null && (() => {
                      const d = latestScores[q] - prevScores[q];
                      return (
                        <span style={{ color: d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#aaaaaa", fontWeight: 700, fontSize: 12 }}>
                          {d > 0 ? "▲" : d < 0 ? "▼" : "→"}
                        </span>
                      );
                    })()}
                  </>
                ) : (
                  <span style={{ opacity: 0.4 }}>—</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={s.muted}>No scores available.</div>
        )}
      </div>

      <div style={s.graphBox}>
        <RadarPlot figure={radarFigure} />
      </div>
    </section>
  );
}

const s = {
  card: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
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
  smallLink: {
    textDecoration: "none",
    color: "var(--ghost-color)",
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    whiteSpace: "nowrap",
  },
  summaryBox: {
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
    padding: 12,
  },
  summaryTitle: { fontWeight: 800, marginBottom: 6 },
  graphBox: {
    marginTop: 12,
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "#0b1220",
    paddingBottom: 8,
  },
};
