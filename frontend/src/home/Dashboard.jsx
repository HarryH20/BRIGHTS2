import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import RosePlot from "../graphs/RosePlot.jsx";
import RadarPlot from "../graphs/RadarPlot.jsx";
import LoadingScreen from "./LoadingScreen.jsx";
import HomeLayout from "./HomeLayout.jsx";

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

const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };
const TP_ORDER = ["T6", "T5", "T4", "T3", "T2"];
const TP_WEEK  = { 1: "Week 1", 2: "Week 2", 3: "Week 3", 4: "Week 4", 5: "Week 5", 6: "Week 6" };

export default function Dashboard({ user, onLogout, chartCache, setChartCache }) {
  const [goalFilter, setGoalFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("2-6");

  // Initialize from cache if available — avoids re-fetching on navigation
  const [goals, setGoals] = useState(chartCache?.loaded ? chartCache.goals : []);
  const [roseFigure, setRoseFigure] = useState(chartCache?.loaded ? chartCache.roseFigure : null);
  const [filteredRoseFigure, setFilteredRoseFigure] = useState(chartCache?.loaded ? chartCache.roseFigure : null);
  const [radarFigures, setRadarFigures] = useState(chartCache?.loaded ? chartCache.radarFigures : {});
  const [ready, setReady] = useState(chartCache?.loaded ?? false);
  const [loadingStatus, setLoadingStatus] = useState("Loading your goals...");
  const [surveyStatus, setSurveyStatus] = useState(null);   // "due" | "locked" | "complete" | null
  const [surveyTimepoint, setSurveyTimepoint] = useState(null);
  const [surveyCompletion, setSurveyCompletion] = useState(null); // array of 6 timepoint statuses

  useEffect(() => {
    fetch("/api/survey/next", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        setSurveyStatus(d.status);
        setSurveyTimepoint(d.timepoint ?? null);
      })
      .catch(() => {});

    fetch("/api/survey/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSurveyCompletion(d.timepoints ?? null))
      .catch(() => {});
  }, []);

  useEffect(() => {
    // Skip fetch if data is already cached
    if (chartCache?.loaded) return;

    // Step 1: fetch goals + roseplot in parallel
    Promise.allSettled([
      fetch("/api/visualizations/goals", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
      fetch("/api/visualizations/roseplot", { credentials: "include" }).then((r) =>
        r.ok ? r.json() : Promise.reject(r)
      ),
    ]).then(([goalsResult, roseResult]) => {
      const fetchedGoals =
        goalsResult.status === "fulfilled" ? goalsResult.value.goals || [] : [];
      const rose = roseResult.status === "fulfilled" ? roseResult.value : null;

      setGoals(fetchedGoals);
      setRoseFigure(rose);
      setFilteredRoseFigure(rose);

      if (fetchedGoals.length === 0) {
        setChartCache?.({ goals: [], roseFigure: rose, radarFigures: {}, loaded: true });
        setReady(true);
        return;
      }

      // Step 2: fetch a radarplot for each goal
      setLoadingStatus("Preparing your charts...");
      Promise.allSettled(
        fetchedGoals.map((_, idx) =>
          fetch(`/api/visualizations/radarplot?goal_index=${idx}`, { credentials: "include" })
            .then((r) => (r.ok ? r.json() : Promise.reject(r)))
            .then((fig) => ({ idx, fig }))
        )
      ).then((radarResults) => {
        const radars = {};
        radarResults.forEach((r) => {
          if (r.status === "fulfilled") radars[r.value.idx] = r.value.fig;
        });

        setRadarFigures(radars);
        setChartCache?.({ goals: fetchedGoals, roseFigure: rose, radarFigures: radars, loaded: true });
        setReady(true);
      });
    });
  }, []); // eslint-disable-line

  // Refetch roseplot whenever filters change (after initial load)
  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (goalFilter !== "all") params.set("goal_id", goalFilter);
    if (weekFilter !== "all") params.set("weeks", weekFilter);

    fetch(`/api/visualizations/roseplot?${params.toString()}`, { credentials: "include" })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((fig) => setFilteredRoseFigure(fig))
      .catch(() => {});
  }, [goalFilter, weekFilter, ready]); // eslint-disable-line

  // Timepoints that have at least one non-null score across any goal
  const activeTimepoints = TP_ORDER.filter((tp) =>
    goals.some((g) => Object.values(g.timepoints?.[tp] || {}).some((v) => v !== null))
  );

  const colSpan = goals.length <= 1 ? 12 : goals.length === 2 ? 6 : 4;

  if (!ready) return <LoadingScreen status={loadingStatus} />;

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`Welcome, ${user?.display_name || user?.username || "user"}!`}>
      <div style={styles.grid} className="grid12">
        {/* Survey prompt */}
        {surveyStatus === "due" && (
          <section style={{ ...styles.card, gridColumn: "1 / -1", ...styles.surveyBanner }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: 16, marginBottom: 4 }}>
                {TP_WEEK[surveyTimepoint] ?? "Weekly"} survey is ready
              </div>
              <div style={styles.muted}>Complete this week's survey to keep your data up to date.</div>
            </div>
            <Link to="/survey" style={styles.primaryBtn}>Start Survey →</Link>
          </section>
        )}

        {surveyStatus === "locked" && surveyTimepoint && (
          <section style={{ ...styles.card, gridColumn: "1 / -1", opacity: 0.7 }}>
            <div style={{ fontWeight: 700, fontSize: 14 }}>
              🔒 {TP_WEEK[surveyTimepoint]} survey not yet available — unlocks next week.
            </div>
          </section>
        )}

        {/* Timepoint completion tracker */}
        {surveyCompletion && (
          <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
            <div style={styles.cardHeader}>
              <h2 style={styles.h2}>Survey Progress</h2>
              <span style={{ fontSize: 13, opacity: 0.6 }}>
                {surveyCompletion.filter((t) => t.completed).length} / 6 completed
              </span>
            </div>
            <div style={styles.trackerRow} className="trackerRowMobile">
              {surveyCompletion.map((t) => (
                <div key={t.timepoint} style={{
                  ...styles.trackerCell,
                  ...(t.completed ? styles.trackerDone : styles.trackerMissing),
                }}>
                  <span style={styles.trackerWeek}>Week {t.timepoint}</span>
                  <span style={styles.trackerIcon}>{t.completed ? "✓" : "✗"}</span>
                  {t.submitted_at && (
                    <span style={styles.trackerDate}>
                      {new Date(t.submitted_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Latest / Most Recent */}
        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>Latest / Most Recent</h2>

            <Link to="/graphs" style={styles.primaryBtn}>
              View Survey Graphs
            </Link>
          </div>

          <div style={styles.recentList}>
            {activeTimepoints.length === 0 ? (
              <div style={styles.muted}>No survey data available.</div>
            ) : (
              activeTimepoints.map((tp, i) => (
                <div key={tp} style={styles.recentRow} className="recentRowMobile">
                  <div style={styles.recentName}>
                    {i === 0 ? `Latest Survey (${TP_LABELS[tp]})` : `${TP_LABELS[tp]} Survey`}
                  </div>
                  <div style={styles.recentLinks} className={"recentLinksMobile"}>
                    <Link style={styles.linkBtn} to={`/surveys/${tp.toLowerCase()}/results`}>
                      Responses / Results
                    </Link>
                    <Link style={styles.linkBtn} to={`/surveys/${tp.toLowerCase()}/analysis`}>
                      Analysis
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* Goal Cards */}
        {goals.map((g, idx) => {
          const latestTp = TP_ORDER.find((tp) =>
            Object.values(g.timepoints?.[tp] || {}).some((v) => v !== null)
          );
          const latestScores = latestTp ? g.timepoints[latestTp] : null;
          const shortTitle = g.text.length > 28 ? g.text.slice(0, 28) + "…" : g.text;

          return (
            <section
              key={g.goal_id}
              className="card-interactive"
              style={{ ...styles.card, gridColumn: `span ${colSpan}` }}
            >
              <div style={styles.cardHeader}>
                <h2 style={styles.h2} title={g.text}>
                  Goal {idx + 1}: {shortTitle}
                </h2>
                <Link to={`/goals/${g.goal_id}`} style={styles.smallLink}>
                  Open →
                </Link>
              </div>

              <div style={styles.summaryBox}>
                <div style={styles.summaryTitle}>
                  {latestTp ? `${TP_LABELS[latestTp]} Scores` : "Scores"}
                </div>

                {latestScores ? (
                  <div style={{ display: "grid", gap: 6, marginTop: 6 }}>
                    {[["Q39", "Progress"], ["Q40", "Confidence"], ["Q41", "Importance"]].map(
                      ([q, label]) => (
                        <div
                          key={q}
                          style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}
                        >
                          <span style={{ opacity: 0.6, width: 80, flexShrink: 0 }}>{label}</span>
                          {latestScores[q] != null ? (
                            <>
                              <span
                                style={{
                                  display: "inline-block",
                                  width: 10,
                                  height: 10,
                                  borderRadius: "50%",
                                  background: SCORE_COLOR[latestScores[q]],
                                  flexShrink: 0,
                                }}
                              />
                              <span>{LIKERT[latestScores[q]]}</span>
                            </>
                          ) : (
                            <span style={{ opacity: 0.4 }}>—</span>
                          )}
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div style={styles.muted}>No scores available.</div>
                )}
              </div>

              <div style={styles.graphBox}>
                <RadarPlot figure={radarFigures[idx]} />
              </div>
            </section>
          );
        })}

        {/* Overview */}
        <section style={{ ...styles.card, gridColumn: "1 / -1" }}>
          <div style={styles.cardHeader}>
            <h2 style={styles.h2}>Overview</h2>
            <Link to="/overview" style={styles.smallLink}>
              Open →
            </Link>
          </div>

          <div style={styles.filtersRow} className="filtersRowMobile">
            <div style={styles.muted}>filter by goal(s), week(s):</div>

            <select value={goalFilter} onChange={(e) => setGoalFilter(e.target.value)} style={styles.select}>
              <option value="all">All Goals</option>
              {goals.map((g) => (
                <option key={g.goal_id} value={String(g.goal_id)}>
                  {g.text.length > 24 ? g.text.slice(0, 24) + "…" : g.text}
                </option>
              ))}
            </select>

            <select value={weekFilter} onChange={(e) => setWeekFilter(e.target.value)} style={styles.select}>
              <option value="all">All Weeks</option>
              {/* Week 1 not supported by GT2..GT6 dataset; leaving it causes blanks */}
              <option value="2-6">Week 2–6</option>
              <option value="3-6">Week 3–6</option>
              <option value="4-6">Week 4–6</option>
              <option value="5-6">Week 5–6</option>
            </select>
          </div>

          <div style={styles.overviewBox}>
            <div style={{ width: "100%" }}>
              <RosePlot figure={filteredRoseFigure || roseFigure} />
            </div>
          </div>
        </section>
      </div>
    </HomeLayout>
  );
}

const styles = {
  grid: { display: "grid", gap: 16 },
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

  linkBtn: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    textDecoration: "none",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
  },
  smallLink: {
    textDecoration: "none",
    color: "var(--ghost-color)",
    fontWeight: 700,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
  },
  primaryBtn: {
    textDecoration: "none",
    color: "white",
    fontWeight: 800,
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid rgba(37,99,235,0.65)",
    background: "rgba(37,99,235,0.85)",
    boxShadow: "0 10px 22px rgba(37,99,235,0.18)",
  },

  surveyBanner: {
    display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 16,
    border: "1px solid rgba(79,124,255,0.4)",
    background: "rgba(79,124,255,0.08)",
  },

  recentList: { display: "grid", gap: 10 },
  recentRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
  },
  recentName: { fontWeight: 700 },
  recentLinks: { display: "flex", gap: 10 },

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
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 800,
    fontSize: 13,
    outline: "none",
  },
  overviewBox: {
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "#0b1220",
    padding: 12,
  },

  trackerRow: {
    display: "grid",
    gridTemplateColumns: "repeat(6, 1fr)",
    gap: 10,
  },
  trackerCell: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    padding: "12px 8px",
    borderRadius: 12,
    border: "1px solid",
    textAlign: "center",
  },
  trackerDone: {
    borderColor: "rgba(74,222,128,0.35)",
    background: "rgba(74,222,128,0.07)",
  },
  trackerMissing: {
    borderColor: "rgba(248,113,113,0.25)",
    background: "rgba(248,113,113,0.05)",
  },
  trackerWeek: { fontSize: 11, fontWeight: 700, opacity: 0.6, textTransform: "uppercase", letterSpacing: "0.05em" },
  trackerIcon: { fontSize: 20, lineHeight: 1 },
  trackerDate: { fontSize: 11, opacity: 0.5 },
};