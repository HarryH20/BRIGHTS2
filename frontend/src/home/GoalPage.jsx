import React, { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import ParticipantShell from "./ParticipantShell.jsx";
import JourneyPath from "./JourneyPath.jsx";
import RadarPlot from "../graphs/RadarPlot.jsx";
import GoalTrajectorySparklines from "../graphs/GoalTrajectorySparklines.jsx";
import { AlertCircle } from "lucide-react";

const LIKERT = {
  1: "Strongly disagree", 2: "Disagree", 3: "Somewhat disagree",
  4: "Neutral", 5: "Somewhat agree", 6: "Agree", 7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027", 2: "#fc8d59", 3: "#fee090", 4: "#aaaaaa",
  5: "#91bfdb", 6: "#4575b4", 7: "#2166AC",
};

const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };
const ALL_TPS   = ["T2", "T3", "T4", "T5", "T6"];

const QUESTIONS = [
  { key: "Q39", label: "Progress",    color: "var(--chart-2, #56B4E9)" },
  { key: "Q40", label: "Confidence",  color: "var(--chart-3, #E69F00)" },
  { key: "Q41", label: "Importance",  color: "var(--chart-4, #009E73)" },
];

function tpsForWeeks(weeks) {
  const [startStr, endStr] = String(weeks || "2-6").split("-");
  const start = Number(startStr), end = Number(endStr);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return ALL_TPS;
  return ALL_TPS.filter(tp => {
    const w = Number(tp.replace("T", ""));
    return w >= start && w <= end;
  });
}

function scoreTint(score) {
  if (score == null) return {};
  if (score <= 2) return { background: "rgba(215,48,39,0.10)"   };
  if (score === 3) return { background: "rgba(252,141,89,0.10)" };
  if (score === 4) return {};
  if (score === 5) return { background: "rgba(145,191,219,0.10)"};
  return              { background: "rgba(69,117,180,0.10)"  };
}

function Sparkline({ scores, color }) {
  const valid = scores.filter(v => v != null);
  if (valid.length < 2) return <div style={{ width: 80, height: 32 }} />;

  const W = 80, H = 32, PAD = 4;
  const xStep = (W - PAD * 2) / (scores.length - 1);

  const pts = scores.map((v, i) => v != null
    ? { x: PAD + i * xStep, y: H - PAD - ((v - 1) / 6) * (H - PAD * 2) }
    : null
  );

  const segs = [];
  let newSeg = true;
  pts.forEach(pt => {
    if (!pt) { newSeg = true; return; }
    segs.push(`${newSeg ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
    newSeg = false;
  });

  return (
    <svg width={W} height={H} style={{ overflow: "visible" }}>
      <path d={segs.join(" ")} fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" />
      {pts.filter(Boolean).map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={2} fill={color} />
      ))}
    </svg>
  );
}

export default function GoalPage({ user, onLogout }) {
  const { goalId } = useParams();
  const [goal,             setGoal]             = useState(null);
  const [goalIndex,        setGoalIndex]        = useState(null);
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState(null);
  const [weeks,            setWeeks]            = useState("2-6");
  const [surveyCompletion, setSurveyCompletion] = useState(null);
  const [surveyTimepoint,  setSurveyTimepoint]  = useState(null);

  const shownTPs = useMemo(() => tpsForWeeks(weeks), [weeks]);

  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then(r => r.json())
      .then(d => {
        const goals = d.goals || [];
        const idx = goals.findIndex(g => String(g.goal_id) === String(goalId));
        if (idx !== -1) { setGoal(goals[idx]); setGoalIndex(idx); }
        else setError("Goal not found.");
      })
      .catch(() => setError("Failed to load goal data."))
      .finally(() => setLoading(false));

    fetch("/api/survey/status", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSurveyCompletion(d.timepoints ?? null))
      .catch(() => {});

    fetch("/api/survey/next", { credentials: "include" })
      .then(r => r.json())
      .then(d => setSurveyTimepoint(d.timepoint ?? null))
      .catch(() => {});
  }, [goalId]);

  // --- derived data for summary cards and best week ---
  const summaryCards = useMemo(() => {
    if (!goal) return null;
    return QUESTIONS.map(({ key, label, color }) => {
      const sparkScores = ALL_TPS.map(tp => goal.timepoints?.[tp]?.[key] ?? null);
      const validScores = sparkScores.filter(v => v != null);
      const currentScore = validScores.length ? validScores[validScores.length - 1] : null;
      const firstScore   = validScores.length ? validScores[0] : null;
      const delta        = currentScore != null && firstScore != null ? currentScore - firstScore : null;
      return { key, label, color, sparkScores, currentScore, delta };
    });
  }, [goal]);

  const bestWeek = useMemo(() => {
    if (!goal) return null;
    const avgs = ALL_TPS.map(tp => {
      const vals = ["Q39", "Q40", "Q41"].map(q => goal.timepoints?.[tp]?.[q]).filter(v => v != null);
      return vals.length ? { tp, avg: vals.reduce((a, b) => a + b, 0) / vals.length } : null;
    }).filter(Boolean);
    if (!avgs.length) return null;
    return avgs.reduce((best, curr) => curr.avg > best.avg ? curr : best);
  }, [goal]);

  return (
    <ParticipantShell user={user} onLogout={onLogout}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "24px 16px" }}>

      {/* Compact journey path */}
      {surveyCompletion && (
        <div style={{ marginBottom: 20 }}>
          <JourneyPath
            surveyCompletion={surveyCompletion}
            currentTimepoint={surveyTimepoint}
            compact
          />
        </div>
      )}

      <div style={s.card}>
        {/* Filter bar */}
        <div style={s.row}>
          <label style={s.label}>
            Weeks
            <select value={weeks} onChange={e => setWeeks(e.target.value)} style={s.select}>
              <option value="1-6">Weeks 1–6</option>
              <option value="2-6">Weeks 2–6</option>
              <option value="3-6">Weeks 3–6</option>
              <option value="4-6">Weeks 4–6</option>
              <option value="5-6">Weeks 5–6</option>
            </select>
          </label>
        </div>

        {loading && <div style={s.muted}>Loading…</div>}

        {error && (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "40px 24px", gap: 12, textAlign: "center" }}>
            <AlertCircle size={40} style={{ opacity: 0.4, color: "var(--error-color)" }} />
            <div style={{ fontWeight: 700, color: "var(--error-color)", fontSize: 15 }}>Could not load goal</div>
            <div style={{ ...s.muted, maxWidth: 280 }}>{error}</div>
          </div>
        )}

        {goal && (
          <>
            {/* Goal title */}
            <div style={{ marginBottom: 20 }}>
              <div style={s.labelMuted}>Goal</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>{goal.text}</div>
            </div>

            {/* Summary sparkline cards */}
            {summaryCards && (
              <div style={s.sparkRow} className="sparkRowMobile">
                {summaryCards.map(({ key, label, color, sparkScores, currentScore, delta }) => (
                  <div key={key} style={s.sparkCard}>
                    <div style={s.sparkLabel}>{label}</div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                      {currentScore != null ? (
                        <>
                          <span style={{
                            width: 10, height: 10, borderRadius: "50%",
                            background: SCORE_COLOR[currentScore], display: "inline-block", flexShrink: 0,
                          }} />
                          <span style={{ fontWeight: 800, fontSize: 15 }}>{currentScore}/7</span>
                          <span style={{ fontSize: 11, opacity: 0.65 }}>{LIKERT[currentScore]}</span>
                        </>
                      ) : <span style={{ opacity: 0.4, fontSize: 14 }}>—</span>}
                    </div>
                    <Sparkline scores={sparkScores} color={color} />
                    {delta != null && (
                      <div style={{
                        fontSize: 12, marginTop: 6,
                        color: delta > 0 ? "#4ade80" : delta < 0 ? "#f87171" : "#aaaaaa",
                        fontWeight: 700,
                      }}>
                        {delta > 0 ? "▲" : delta < 0 ? "▼" : "→"} {Math.abs(delta)} overall
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Score table */}
            <div style={{ overflowX: "auto" }}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={s.th}>Week</th>
                    <th style={s.th}>Progress</th>
                    <th style={s.th}>Confidence</th>
                    <th style={s.th}>Importance</th>
                    <th style={{ ...s.th, opacity: 0.5 }}>Change</th>
                  </tr>
                </thead>
                <tbody>
                  {shownTPs.map(tp => {
                    const scores  = goal.timepoints?.[tp] || {};
                    const prevIdx = ALL_TPS.indexOf(tp) - 1;
                    const prevScores = prevIdx >= 0 ? (goal.timepoints?.[ALL_TPS[prevIdx]] || {}) : {};

                    const deltas = ["Q39", "Q40", "Q41"]
                      .map(q => scores[q] != null && prevScores[q] != null ? scores[q] - prevScores[q] : null)
                      .filter(v => v != null);
                    const avgDelta = deltas.length ? deltas.reduce((a, b) => a + b, 0) / deltas.length : null;

                    return (
                      <tr key={tp}>
                        <td style={{ ...s.td, fontWeight: 700 }}>{TP_LABELS[tp]}</td>
                        {["Q39", "Q40", "Q41"].map(q => (
                          <td key={q} style={{ ...s.td, ...scoreTint(scores[q]) }}>
                            {scores[q] != null ? (
                              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                                <span style={{
                                  width: 9, height: 9, borderRadius: "50%",
                                  background: SCORE_COLOR[scores[q]], flexShrink: 0,
                                }} />
                                {LIKERT[scores[q]]}
                              </span>
                            ) : <span style={{ opacity: 0.35 }}>—</span>}
                          </td>
                        ))}
                        <td style={s.td}>
                          {avgDelta != null ? (
                            <span style={{
                              color: avgDelta > 0.1 ? "#4ade80" : avgDelta < -0.1 ? "#f87171" : "#aaaaaa",
                              fontWeight: 700, fontSize: 13,
                            }}>
                              {avgDelta > 0.1 ? "▲" : avgDelta < -0.1 ? "▼" : "→"} {Math.abs(avgDelta).toFixed(1)}
                            </span>
                          ) : <span style={{ opacity: 0.35 }}>—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Best week footer */}
            {bestWeek && (
              <div style={s.bestWeek}>
                Best week overall: <strong>{TP_LABELS[bestWeek.tp]}</strong> — average score {bestWeek.avg.toFixed(1)}/7
              </div>
            )}

            {/* Radar */}
            {goalIndex !== null && (
              <div style={{ marginTop: 22 }}>
                <div style={s.labelMuted}>Goal Traits Radar</div>
                <div style={{ borderRadius: 12, border: "1px solid var(--subtle-border)", background: "#0b1220" }}>
                  <RadarPlot goalIndex={goalIndex} showHelper />
                </div>
              </div>
            )}

            {/* Goal trajectory sparklines */}
            {goalIndex !== null && goal && (
              <div style={{ marginTop: 22 }}>
                <div style={s.labelMuted}>Goal Trajectory</div>
                <div style={{ borderRadius: 12, border: "1px solid var(--subtle-border)", background: "#0b1220", padding: "14px 16px" }}>
                  <GoalTrajectorySparklines goals={[goal]} />
                </div>
              </div>
            )}
          </>
        )}
      </div>
      </div>
    </ParticipantShell>
  );
}

const s = {
  card: {
    padding: 22,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },
  row:    { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 },
  label:  { display: "grid", gap: 6, fontWeight: 800, fontSize: 13, opacity: 0.92 },
  select: {
    padding: "10px 12px", borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)", color: "var(--ghost-color)", outline: "none",
  },
  muted:     { opacity: 0.82, fontSize: 14, lineHeight: 1.45 },
  labelMuted: {
    fontSize: 12, opacity: 0.55, marginBottom: 4,
    textTransform: "uppercase", letterSpacing: "0.08em",
  },
  sparkRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr 1fr",
    gap: 12,
    marginBottom: 20,
  },
  sparkCard: {
    padding: "12px 14px",
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
  },
  sparkLabel: { fontSize: 12, fontWeight: 700, opacity: 0.65, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 14 },
  th: {
    textAlign: "left", padding: "8px 14px",
    borderBottom: "1px solid rgba(155,183,255,0.2)",
    opacity: 0.65, fontWeight: 700, fontSize: 12,
    textTransform: "uppercase", letterSpacing: "0.06em",
  },
  td: { padding: "11px 14px", borderBottom: "1px solid rgba(155,183,255,0.08)" },
  bestWeek: {
    marginTop: 14, fontSize: 13, opacity: 0.8,
    padding: "8px 12px", borderRadius: 8,
    background: "rgba(69,117,180,0.08)",
    border: "1px solid rgba(69,117,180,0.18)",
  },
};
