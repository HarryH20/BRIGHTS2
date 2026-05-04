import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import ParticipantShell from "./ParticipantShell.jsx";
import { FileText } from "lucide-react";

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
   CONTENT ONLY
============================ */

function SurveyResultsContent({
  surveyId,
  tp,
  loading,
  goalFilter,
  setGoalFilter,
  goalOptions,
  filteredGoals,
}) {
  return (
    <div style={styles.card}>
      {/* Filter */}
      <div style={styles.row}>
        <label style={styles.label}>
          <select
            value={goalFilter}
            onChange={(e) => setGoalFilter(e.target.value)}
            style={styles.select}
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

      {/* Table */}
      {loading ? (
        <p style={styles.muted}>Loading…</p>
      ) : filteredGoals.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "32px 16px", gap: 10, textAlign: "center" }}>
          <FileText size={36} style={{ opacity: 0.3 }} />
          <div style={{ fontWeight: 700, fontSize: 14 }}>No survey data yet</div>
          <p style={{ ...styles.muted, maxWidth: 260, margin: 0 }}>This survey hasn&apos;t been completed yet.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
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
              const scores = g.timepoints?.[tp] || {};
              return (
                <tr key={g.goal_id}>
                  <td style={styles.td}>{g.text}</td>
                  {["Q39", "Q40", "Q41"].map((q) => (
                    <td key={q} style={styles.td}>
                      {scores[q] != null ? (
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
                              background: SCORE_COLOR[scores[q]],
                              flexShrink: 0,
                            }}
                          />
                          <span>{LIKERT[scores[q]]}</span>
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
        </div>
      )}

      {/* Actions */}
      <div style={{ display: "flex", gap: 12, marginTop: 18 }}>
        <Link to={`/surveys/${surveyId}/analysis`} style={styles.pillLink}>
          Go to Analysis →
        </Link>
      </div>
    </div>
  );
}

/* ============================
   PAGE / WRAPPER
============================ */

export default function SurveyResults({
  user,
  onLogout,
  surveyId: propSurveyId,
  noLayout = false,
}) {
  const params = useParams();
  const surveyId = propSurveyId ?? params.surveyId;

  const tp = surveyId.toUpperCase();
  const tpLabel = TP_LABELS[tp] || surveyId;

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
    () =>
      goals.map((g) => ({
        id: String(g.goal_id),
        label: `Goal ${g.goal_id}`,
      })),
    [goals]
  );

  useEffect(() => {
    if (!goalFilter && goalOptions.length > 0) {
      setGoalFilter("ALL");
    }
  }, [goalFilter, goalOptions]);

  const filteredGoals =
    goalFilter === "ALL"
      ? goals
      : goals.filter((g) => String(g.goal_id) === goalFilter);

  const content = (
    <SurveyResultsContent
      surveyId={surveyId}
      tp={tp}
      loading={loading}
      goalFilter={goalFilter}
      setGoalFilter={setGoalFilter}
      goalOptions={goalOptions}
      filteredGoals={filteredGoals}
    />
  );

  // Embedded (tabs)
  if (noLayout) {
    return content;
  }

  // Standalone page
  return (
    <ParticipantShell
      user={user}
      onLogout={onLogout}
      title={`${tpLabel} Survey — Results`}
    >
      {content}
    </ParticipantShell>
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
  row: {
    display: "flex",
    gap: 12,
    marginBottom: 14,
  },
  label: {
    display: "grid",
    gap: 6,
    fontWeight: 800,
    fontSize: 13,
  },
  select: {
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
  },
  muted: {
    opacity: 0.82,
    fontSize: 14,
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "8px 14px",
    borderBottom: "1px solid rgba(155,183,255,0.2)",
    opacity: 0.65,
    fontWeight: 700,
    fontSize: 12,
    textTransform: "uppercase",
  },
  td: {
    padding: "11px 14px",
    borderBottom: "1px solid rgba(155,183,255,0.08)",
  },
  pillLink: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 800,
    textDecoration: "none",
    display: "inline-flex",
    alignItems: "center",
  },
};
