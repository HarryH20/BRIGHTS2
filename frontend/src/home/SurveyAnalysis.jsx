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

  void subtitle;

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`${tpLabel} Survey — Analysis`}>
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