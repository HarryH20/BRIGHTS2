import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

/* ============================
   Constants
============================ */

const LIKERT = {
  1: "Strongly disagree",
  2: "Disagree",
  3: "Somewhat disagree",
  4: "Neutral",
  5: "Somewhat agree",
  6: "Agree",
  7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027",
  2: "#fc8d59",
  3: "#fee090",
  4: "#aaaaaa",
  5: "#91bfdb",
  6: "#4575b4",
  7: "#2166AC",
};

const TP_LABELS = {
  T2: "Week 2",
  T3: "Week 3",
  T4: "Week 4",
  T5: "Week 5",
  T6: "Week 6",
};

/* ============================
   Helper cells
============================ */

function DeltaCell({ from, to }) {
  if (from == null || to == null) return <span style={{ opacity: 0.35 }}>—</span>;
  const d = to - from;
  const arrow = d > 0 ? "↑" : d < 0 ? "↓" : "→";
  const color = d > 0 ? "#4ade80" : d < 0 ? "#f87171" : "#aaaaaa";
  return (
    <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
      <span
        style={{
          width: 9,
          height: 9,
          borderRadius: "50%",
          background: SCORE_COLOR[to],
        }}
      />
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
    <span
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
      }}
    >
      <span
        style={{
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

/* ============================
   CONTENT ONLY
============================ */

function SurveyAnalysisContent({
  surveyId,
  tp,
  tpLabel,
  isT2,
  loading,
  goalFilter,
  setGoalFilter,
  goalOptions,
  filteredGoals,
  cardinalRef,
  partyKey,
}) {
  return (
    <div ref={cardinalRef} style={styles.card} className="partyCard">
      {!loading && !isT2 && (
        <div style={{ marginBottom: 16, fontSize: 13, opacity: 0.7 }}>
          Showing change from Week 2 → {tpLabel}
        </div>
      )}

      <div style={styles.row}>
        <label style={styles.label}>
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            style={styles.select}
            disabled={loading}
          >
            <option value="ALL">All Goals</option>
            {goalOptions.map((opt) => (
              <option key={opt.id} value={opt.id}>{opt.label}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <p style={styles.muted}>Loading…</p>
      ) : !filteredGoals || filteredGoals.length === 0 ? (
        <p style={styles.muted}>No data available for this timepoint.</p>
      ) : (
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Goal</th>
              <th style={styles.th}>Progress</th>
              <th style={styles.th}>Confidence</th>
              <th style={styles.th}>Importance</th>
            </tr>
          </thead>
          <tbody>
            {filteredGoals.map((g) => {
              const current = g.timepoints?.[tp] || {};
              const baseline = g.timepoints?.["T2"] || {};
              return (
                <tr key={g.goal_id}>
                  <td style={styles.td}>{g.text}</td>
                  <td style={styles.td}>
                    {isT2 ? <ScoreCell value={current.Q39} /> : <DeltaCell from={baseline.Q39} to={current.Q39} />}
                  </td>
                  <td style={styles.td}>
                    {isT2 ? <ScoreCell value={current.Q40} /> : <DeltaCell from={baseline.Q40} to={current.Q40} />}
                  </td>
                  <td style={styles.td}>
                    {isT2 ? <ScoreCell value={current.Q41} /> : <DeltaCell from={baseline.Q41} to={current.Q41} />}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}

      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Link to={`/surveys/${surveyId}/results`} style={styles.pillLink}>
          Go to Results →
        </Link>
        <Link to="/dashboard" style={styles.pillLink}>
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}

/* ============================
  PAGE / WRAPPER
============================ */

export default function SurveyAnalysis({
  user,
  onLogout,
  surveyId: propSurveyId,
  noLayout = false,
}) {
  const params = useParams();
  const surveyId = propSurveyId ?? params.surveyId;

  const tp = surveyId.toUpperCase();
  const tpLabel = TP_LABELS[tp] || surveyId;
  const isT2 = tp === "T2";

  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [goalFilter, setGoalFilter] = useState("");

  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setGoals(d.goals || []))
      .finally(() => setLoading(false));
  }, []);

  const goalOptions = useMemo(
    () => goals.map((g) => ({ id: String(g.goal_id), label: `Goal ${g.goal_id}` })),
    [goals]
  );

  useEffect(() => {
    if (!goalFilter && goalOptions.length) setGoalFilter("ALL");
  }, [goalFilter, goalOptions]);

  const filteredGoals =
    goalFilter === "ALL" ? goals : goals.filter((g) => String(g.goal_id) === goalFilter);

  const content = (
    <SurveyAnalysisContent
      surveyId={surveyId}
      tp={tp}
      tpLabel={tpLabel}
      isT2={isT2}
      loading={loading}
      goalFilter={goalFilter}
      setGoalFilter={setGoalFilter}
      goalOptions={goalOptions}
      filteredGoals={filteredGoals}
    />
  );

  if (noLayout) {
    return content;
  }

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`${tpLabel} Survey — Analysis`}>
      {content}
    </HomeLayout>
  );
}

/* ============================
   Styles
============================ */

const styles = {
  card: {
    padding: 22,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },
  row: { display: "flex", gap: 12, marginBottom: 14 },
  label: { display: "grid", gap: 6, fontWeight: 800, fontSize: 13 },
  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
  },
  muted: { opacity: 0.8, fontSize: 14 },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    textAlign: "left",
    padding: "8px 14px",
    borderBottom: "1px solid rgba(155,183,255,0.2)",
    opacity: 0.65,
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  td: { padding: "11px 14px", borderBottom: "1px solid rgba(155,183,255,0.08)" },
  pillLink: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 800,
    textDecoration: "none",
  },
};
