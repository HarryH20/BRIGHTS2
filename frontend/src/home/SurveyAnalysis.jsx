import React, { useEffect, useMemo, useRef, useState } from "react";
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

function ConfettiBurst({ seed }) {
  // Re-mounting this component (changing key) replays the burst
  const pieces = useMemo(() => {
    const n = 26;
    const rand = (a, b) => a + Math.random() * (b - a);
    return Array.from({ length: n }, (_, i) => ({
      id: `${seed}-${i}`,
      left: rand(20, 80),     // %
      size: rand(6, 12),      // px
      dx: rand(-180, 180),    // px
      dy: rand(120, 260),     // px
      rot: rand(-540, 540),   // deg
      dur: rand(520, 820),    // ms
      delay: rand(0, 40),     // ms
      color: `hsl(${Math.floor(rand(0, 360))} 90% 60%)`,
    }));
  }, [seed]);

  return (
    <div style={confettiWrap} aria-hidden>
      {pieces.map((p) => (
        <span
          key={p.id}
          style={{
            position: "absolute",
            left: `${p.left}%`,
            top: "0%",
            width: p.size,
            height: p.size * 0.6,
            borderRadius: 3,
            background: p.color,
            transform: "translate(-50%, 0)",
            animation: `confetti-fly ${p.dur}ms ease-out ${p.delay}ms forwards`,
            ["--dx"]: `${p.dx}px`,
            ["--dy"]: `${p.dy}px`,
            ["--rot"]: `${p.rot}deg`,
          }}
        />
      ))}
    </div>
  );
}

export default function SurveyAnalysis({ user, onLogout }) {
  const { surveyId } = useParams();
  const tp = surveyId.toUpperCase();
  const tpLabel = TP_LABELS[tp] || surveyId;
  const isT2 = tp === "T2";

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);

  // ✅ add "ALL"
  const [goalFilter, setGoalFilter] = useState(""); // "" means not set yet
  const [partyKey, setPartyKey] = useState(0);
  const cardRef = useRef(null);

  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setGoals(d.goals || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const goalOptions = useMemo(() => {
    return (goals || []).map((g) => ({
      id: String(g.goal_id),
      label: `Goal ${g.goal_id}`,
      text: g.text,
    }));
  }, [goals]);

  useEffect(() => {
    if (!goalFilter && goalOptions.length > 0) {
      // default to ALL once we have data
      setGoalFilter("ALL");
    }
  }, [goalFilter, goalOptions]);

  const filteredGoals = useMemo(() => {
    if (!goalFilter) return [];
    if (goalFilter === "ALL") return goals || [];
    return (goals || []).filter((g) => String(g.goal_id) === String(goalFilter));
  }, [goals, goalFilter]);

  const onChangeGoal = (e) => {
    setGoalFilter(e.target.value);

    // playful, non-hostile animation
    const el = cardRef.current;
    if (el) {
      el.classList.remove("party-wiggle");
      // force reflow so animation restarts
      void el.offsetWidth;
      el.classList.add("party-wiggle");
    }
    setPartyKey((k) => k + 1);
  };

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`${tpLabel} Survey — Analysis`}>
      <style>{css}</style>

      <div ref={cardRef} style={card} className="partyCard">
        {/* confetti burst */}
        <ConfettiBurst key={partyKey} seed={partyKey} />

        <div style={row} className="filtersRowMobile">
          <label style={label}>
            Goal
            <select
              value={goalFilter}
              onChange={onChangeGoal}
              style={select}
              disabled={loading || goalOptions.length === 0}
            >
              <option value="ALL">All Goals</option>
              {goalOptions.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {!loading && !isT2 && (
          <div style={{ marginBottom: 16, fontSize: 13, opacity: 0.7 }}>
            Showing change from Week 2 (baseline) → {tpLabel}. Arrows show direction and magnitude of change.
          </div>
        )}

        {loading ? (
          <p style={muted}>Loading…</p>
        ) : filteredGoals.length === 0 ? (
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
              {filteredGoals.map((g) => {
                const current = g.timepoints?.[tp] || {};
                const baseline = g.timepoints?.["T2"] || {};
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
  position: "relative",
  padding: 22,
  borderRadius: 16,
  border: "1px solid var(--card-border)",
  background: "var(--card-bg)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  backdropFilter: "blur(8px)",
  overflow: "hidden",
};

const row = { display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap", marginBottom: 14 };
const label = { display: "grid", gap: 6, fontWeight: 800, fontSize: 13, opacity: 0.92 };
const select = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--ghost-border)",
  background: "var(--ghost-bg)",
  color: "var(--ghost-color)",
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
  border: "1px solid var(--ghost-border)",
  background: "var(--ghost-bg)",
  color: "var(--ghost-color)", fontWeight: 800,
  textDecoration: "none", display: "inline-flex",
  alignItems: "center",
};

const confettiWrap = {
  position: "absolute",
  inset: 0,
  pointerEvents: "none",
  overflow: "hidden",
};

const css = `
.partyCard.party-wiggle {
  animation: party-wiggle 560ms ease-in-out;
  transform-origin: 50% 10%;
}

@keyframes party-wiggle {
  0%   { transform: translate3d(0,0,0) rotate(0deg); }
  15%  { transform: translate3d(-6px,-2px,0) rotate(-2deg); }
  30%  { transform: translate3d(7px,2px,0) rotate(2.6deg); }
  45%  { transform: translate3d(-9px,1px,0) rotate(-3.2deg); }
  60%  { transform: translate3d(8px,-1px,0) rotate(2.2deg); }
  75%  { transform: translate3d(-4px,1px,0) rotate(-1.2deg); }
  100% { transform: translate3d(0,0,0) rotate(0deg); }
}

@keyframes confetti-fly {
  0%   { opacity: 1; transform: translate(-50%, 0) rotate(0deg); }
  100% { opacity: 0; transform: translate(calc(-50% + var(--dx)), var(--dy)) rotate(var(--rot)); }
}
`;