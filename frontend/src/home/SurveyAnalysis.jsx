import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

const LIKERT = {
  1: "Strongly disagree", 2: "Disagree", 3: "Somewhat disagree",
  4: "Neutral", 5: "Somewhat agree", 6: "Agree", 7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027", 2: "#fc8d59", 3: "#fee090", 4: "#aaaaaa",
  5: "#91bfdb", 6: "#4575b4", 7: "#2166AC",
};

const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };

function DeltaCell({ from, to }) {
  if (from == null || to == null) return <span style={{ opacity: 0.35 }}>—</span>;
  const d = to - from;
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  const color = d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#aaaaaa";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      <span style={{
        display: "inline-block", width: 9, height: 9,
        borderRadius: "50%", background: SCORE_COLOR[to], flexShrink: 0,
      }} />
      <span>{LIKERT[to]}</span>
      <span style={{ color, fontWeight: 700, fontSize: 13 }}>
        {arrow}{Math.abs(d) > 0 ? ` ${Math.abs(d)}` : ""}
      </span>
    </span>
  );
}

function ScoreCell({ value }) {
  if (value == null) return <span style={{ opacity: 0.35 }}>—</span>;
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
      <span
        style={{
          display: "inline-block",
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: SCORE_COLOR[value],
          flexShrink: 0,
        }}
      />
      <span>{LIKERT[value]}</span>
    </span>
  );
}

function ProgressCelebration({ show, durationMs = 2400 }) {
  const [visible, setVisible] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  useEffect(() => {
    if (!show) return;
    setBurstKey((k) => k + 1);
    setVisible(true);
    const t = setTimeout(() => setVisible(false), durationMs);
    return () => clearTimeout(t);
  }, [show, durationMs]);

  if (!visible) return null;

  return (
    <div style={celeWrap} aria-live="polite">
      <ConfettiBurst key={burstKey} />
      <div style={celeToast}>
        <div style={celeTitle}>Congrats!</div>
        <div style={celeBody}>You've made progress on your goals!</div>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  const pieces = Array.from({ length: 70 }, (_, i) => i);

  return (
    <>
      <style>{confettiCss}</style>
      <div className="confetti-layer" aria-hidden="true">
        {pieces.map((i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.2}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>
    </>
  );
}


export default function SurveyAnalysis({ user, onLogout }) {
  const { surveyId } = useParams();
  const tp = surveyId.toUpperCase();
  const tpLabel = TP_LABELS[tp] || surveyId;
  const isT2 = tp === "T2";

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  const [goalFilter, setGoalFilter] = useState("2");
  const subtitle = useMemo(() => `Filters: Goal ${goalFilter}`, [goalFilter]);
  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setGoals(d.goals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const anyImproved = useMemo(() => {
    if (loading) return false;
    if (isT2) return false; // no baseline comparison on T2 page

    return goals.some((g) => {
      const current = g.timepoints?.[tp] || {};
      const baseline = g.timepoints?.["T2"] || {};
      const improvedProgress = (current.Q39 ?? null) != null && (baseline.Q39 ?? null) != null && current.Q39 > baseline.Q39;
      const improvedConfidence = (current.Q40 ?? null) != null && (baseline.Q40 ?? null) != null && current.Q40 > baseline.Q40;
      const improvedImportance = (current.Q41 ?? null) != null && (baseline.Q41 ?? null) != null && current.Q41 > baseline.Q41;
      return improvedProgress || improvedConfidence || improvedImportance;
    });
  }, [goals, tp, loading, isT2]);

  // Fire only on transitions: false -> true (prevents repeating every rerender)
  const prevAnyImprovedRef = React.useRef(false);
  const [celebrateNow, setCelebrateNow] = useState(false);

  useEffect(() => {
    const prev = prevAnyImprovedRef.current;
    prevAnyImprovedRef.current = anyImproved;

    if (!prev && anyImproved) {
      setCelebrateNow(true);
      const t = setTimeout(() => setCelebrateNow(false), 50); // just a pulse to trigger overlay
      return () => clearTimeout(t);
    }
  }, [anyImproved]);

  void subtitle;

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`${tpLabel} Survey — Analysis`}>
      <ProgressCelebration show={celebrateNow} />
      <div style={card}>
        {/* Filter bar: Goal only */}
        <div style={row} className="filtersRowMobile">
          <label style={label}>
            Goal
            <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)} style={select}>
              <option value="1">Goal 1</option>
              <option value="2">Goal 2</option>
              <option value="3">Goal 3</option>
            </select>
          </label>
        </div>

        {!loading && !isT2 && (
          <div style={{ marginBottom: 16, fontSize: 13, opacity: 0.7 }}>
            Showing change from Week 2 (baseline) → {tpLabel}.
            Arrows show direction and magnitude of change.
          </div>
        )}

        {loading ? (
          <p style={muted}>Loading…</p>
        ) : goals.length === 0 ? (
          <p style={muted}>No data available for this survey (with current goal filter).</p>
        ) : (
          <table style={table} className="analysisTable">
            <thead>
              <tr>
                <th style={th}>Goal</th>
                <th style={th}>Progress</th>
                <th style={th}>Confidence</th>
                <th style={th}>Importance</th>
              </tr>
            </thead>
            <tbody>
              {goals.map((g) => {
                const current = g.timepoints[tp] || {};
                const baseline = g.timepoints["T2"] || {};
                return (
                  <tr key={g.goal_id}>
                    <td style={{ ...td, fontWeight: 800 }} data-label="Goal">
                      {g.text}
                    </td>

                    <td style={td} data-label="Progress">
                      {isT2 ? <ScoreCell value={current.Q39} /> : <DeltaCell from={baseline.Q39} to={current.Q39} />}
                    </td>

                    <td style={td} data-label="Confidence">
                      {isT2 ? <ScoreCell value={current.Q40} /> : <DeltaCell from={baseline.Q40} to={current.Q40} />}
                    </td>

                    <td style={td} data-label="Importance">
                      {isT2 ? <ScoreCell value={current.Q41} /> : <DeltaCell from={baseline.Q41} to={current.Q41} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <div style={{ display: "flex", gap: 12, marginTop: 18, flexWrap: "wrap" }}>
          <Link to={`/surveys/${surveyId}/results`} style={pillLink} className="tapTarget">
            Go to Results →
          </Link>
          <Link to="/dashboard" style={pillLink} className="tapTarget">
            Back to Dashboard
          </Link>
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

const muted = { opacity: 0.82, fontSize: 14, lineHeight: 1.45 };
const table = { width: "100%", borderCollapse: "collapse", fontSize: 14 };
const th = {
  textAlign: "left", padding: "8px 14px",
  borderBottom: "1px solid rgba(155,183,255,0.2)",
  opacity: 0.65, fontWeight: 700, fontSize: 12,
  textTransform: "uppercase", letterSpacing: "0.06em",
};
const td = { padding: "11px 14px", borderBottom: "1px solid rgba(155,183,255,0.08)" };

const pillLink = {
  padding: "10px 14px", borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)", fontWeight: 800,
  textDecoration: "none", display: "inline-flex",
  alignItems: "center",
};

const celeWrap = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
};

const celeToast = {
  position: "fixed",
  top: 18,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(16, 25, 42, 0.92)",
  border: "1px solid rgba(155,183,255,0.20)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
  color: "white",
  borderRadius: 16,
  padding: "12px 14px",
  width: "min(520px, calc(100vw - 24px))",
};

const celeTitle = { fontSize: 16, fontWeight: 900, marginBottom: 2 };
const celeBody = { fontSize: 14, opacity: 0.92 };

const confettiCss = `
.confetti-layer{
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.confetti{
  position: absolute;
  top: -14px;
  width: 10px;
  height: 14px;
  border-radius: 2px;
  background: hsl(calc(360 * var(--h, 0)), 85%, 60%);
  animation: confetti-fall 1.9s ease-out forwards;
  will-change: transform, top, opacity;
}
.confetti:nth-child(6n+1){ --h: 0.05; }
.confetti:nth-child(6n+2){ --h: 0.18; }
.confetti:nth-child(6n+3){ --h: 0.33; }
.confetti:nth-child(6n+4){ --h: 0.55; }
.confetti:nth-child(6n+5){ --h: 0.72; }
.confetti:nth-child(6n+6){ --h: 0.88; }

.confetti:nth-child(odd){ animation-name: confetti-fall-left; }
.confetti:nth-child(even){ animation-name: confetti-fall-right; }

@keyframes confetti-fall-left{
  0%   { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(-140px, 105vh, 0) rotate(720deg); opacity: 0; }
}
@keyframes confetti-fall-right{
  0%   { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(140px, 105vh, 0) rotate(720deg); opacity: 0; }
}
`;