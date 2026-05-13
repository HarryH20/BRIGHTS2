import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import RosePlot from "../graphs/RosePlot.jsx";
import ParticipantShell from "./ParticipantShell.jsx";
import GoalCard from "./GoalCard.jsx";
import JourneyPath from "./JourneyPath.jsx";
import SurveyHeroCard from "./SurveyHeroCard.jsx";
import OnboardingModal from "./OnboardingModal.jsx";
import SkeletonCard from "../components/SkeletonCard.jsx";
import SkeletonGoalCard from "../components/SkeletonGoalCard.jsx";
import { useSurveyInfo } from "./SurveyContext.jsx";
import { Target, ClipboardList } from "lucide-react";

const ONBOARDED_KEY = "brights2_onboarded";

const TP_ORDER = ["T6", "T5", "T4", "T3", "T2"];

function greeting(name) {
  const h = new Date().getHours();
  const time = h < 12 ? "morning" : h < 17 ? "afternoon" : "evening";
  return `Good ${time}, ${name}!`;
}

function DashboardContent({
  displayName, goals, radarFigures, goalsLoaded, filteredRoseFigure, roseFigure,
  goalFilter, setGoalFilter, weekFilter, setWeekFilter, surveyCompletion, navigate,
  setShowOnboarding, ready, loadingStatus,
}) {
  const surveyInfo = useSurveyInfo();
  const surveyStatus = surveyInfo?.status ?? null;
  const surveyTimepoint = surveyInfo?.timepoint ?? null;

  useEffect(() => {
    if (
      surveyInfo?.status === "due" &&
      surveyInfo?.timepoint === 1 &&
      !localStorage.getItem(ONBOARDED_KEY)
    ) {
      setShowOnboarding(true);
    }
  }, [surveyInfo, setShowOnboarding]);

  const colSpan = goals.length <= 1 ? 12 : goals.length === 2 ? 6 : 4;
  const surveysCompleted = surveyCompletion
    ? surveyCompletion.filter((t) => t.completed).length
    : 0;
  const processInsight = (() => {
    if (!surveyCompletion) return null;
    if (surveysCompleted >= 2) {
      const cohortApprox = Math.max(500, 904 - surveysCompleted * 40);
      return `${surveysCompleted} of 6 surveys complete. ${cohortApprox}+ participants are tracking goals alongside you.`;
    }
    if (surveysCompleted === 1) {
      return "You've set your goals. Check back next week to see how you're tracking.";
    }
    return null;
  })();

  if (surveyStatus === "not_enrolled" || surveyStatus === "round_closed") {
    return (
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "60vh", textAlign: "center", padding: "40px 24px",
      }}>
        <ClipboardList size={48} style={{ opacity: 0.3, color: "var(--shell-text-muted)" }} />
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "var(--shell-text)", marginTop: 16, marginBottom: 8 }}>
          {surveyStatus === "not_enrolled" ? "Not currently enrolled" : "This study round has ended"}
        </h2>
        <p style={{ fontSize: 15, color: "var(--shell-text-secondary)", maxWidth: 400, lineHeight: 1.6, margin: 0 }}>
          {surveyStatus === "not_enrolled"
            ? "You are not enrolled in an active study. If you believe this is an error, contact your study coordinator."
            : "Thank you for your participation. Your data has been saved."}
        </p>
        {surveyStatus === "round_closed" && (
          <Link to="/overview" style={styles.ctaLink}>View your results →</Link>
        )}
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={styles.greeting}>{greeting(displayName)}</div>

      {surveyStatus && (
        <div style={styles.section}>
          <SurveyHeroCard
            status={surveyStatus}
            timepoint={surveyTimepoint}
            nextUnlocksAt={surveyInfo?.next_unlocks_at ?? surveyInfo?.unlocks_at}
            onStartSurvey={() => navigate("/survey")}
            onViewResults={() => navigate("/overview")}
          />
        </div>
      )}

      {surveyCompletion && (
        <div style={styles.section}>
          <div style={styles.sectionLabel}>Your 6-Week Journey</div>
          <JourneyPath surveyCompletion={surveyCompletion} currentTimepoint={surveyTimepoint} />
        </div>
      )}

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Your Goals</div>

        {!goalsLoaded && (
          <div style={{ ...styles.goalsGrid, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={styles.skeletonWrap}><SkeletonGoalCard /></div>
            ))}
          </div>
        )}

        {goalsLoaded && goals.length === 0 && (
          <div style={styles.emptyCard}>
            <Target size={40} style={{ opacity: 0.3, marginBottom: 12, color: "var(--shell-text-muted)" }} />
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8, color: "var(--shell-text)" }}>No goals yet</div>
            <p style={{ fontSize: 14, color: "var(--shell-text-secondary)", margin: 0, maxWidth: 280 }}>
              Complete your Week 1 survey to set up your goals and start tracking your progress.
            </p>
            {surveyStatus === "due" && (
              <Link to="/survey" style={styles.ctaLink}>Take the Week 1 Survey →</Link>
            )}
          </div>
        )}

        {goalsLoaded && goals.length > 0 && (
          <>
            <div style={styles.goalsGrid}>
              {goals.map((g, idx) => (
                <GoalCard key={g.goal_id} goal={g} idx={idx} radarFigure={radarFigures[idx]} colSpan={colSpan} />
              ))}
            </div>
            {!ready && (
              <div style={styles.loadingHint}>{loadingStatus}</div>
            )}
          </>
        )}
      </div>

      <div style={styles.section}>
        <div style={styles.sectionLabel}>Progress Overview</div>
        <div style={styles.chartCard}>
          <div style={styles.filtersRow} className="filtersRowMobile">
            <span style={{ fontSize: 13, color: "var(--shell-text-muted)" }}>Filter:</span>
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
              <option value="2-6">Week 2–6</option>
              <option value="3-6">Week 3–6</option>
              <option value="4-6">Week 4–6</option>
              <option value="5-6">Week 5–6</option>
            </select>
            <Link to="/overview" style={styles.overviewLink}>Open full view →</Link>
          </div>
          <div style={styles.chartBox}>
            {!filteredRoseFigure && !goalsLoaded ? (
              <SkeletonCard height={380} label="Loading overview chart..." />
            ) : (
              <RosePlot figure={filteredRoseFigure || roseFigure} />
            )}
          </div>
        </div>
      </div>

      {processInsight && <p style={styles.insight}>{processInsight}</p>}
    </div>
  );
}

export default function Dashboard({ user, onLogout, chartCache, setChartCache, surveyCompletion: surveyCompletionProp }) {
  const navigate = useNavigate();
  const [goalFilter, setGoalFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("all");
  const [showOnboarding, setShowOnboarding] = useState(false);

  // Initialize from cache — full cache (loaded) skips everything; partial (goalsReady) pre-fills goals+radars
  const [goals, setGoals] = useState(chartCache?.loaded || chartCache?.goalsReady ? chartCache.goals : []);
  const [roseFigure, setRoseFigure] = useState(chartCache?.loaded ? chartCache.roseFigure : null);
  const [filteredRoseFigure, setFilteredRoseFigure] = useState(chartCache?.loaded ? chartCache.roseFigure : null);
  const [radarFigures, setRadarFigures] = useState(chartCache?.loaded || chartCache?.goalsReady ? chartCache.radarFigures : {});
  const [ready, setReady] = useState(chartCache?.loaded ?? false);
  const [goalsLoaded, setGoalsLoaded] = useState(!!(chartCache?.loaded || chartCache?.goalsReady));
  const [loadingStatus, setLoadingStatus] = useState("Loading your goals...");
  const [surveyCompletion, setSurveyCompletion] = useState(surveyCompletionProp ?? null);

  useEffect(() => {
    if (surveyCompletionProp) return;
    fetch("/api/survey/status", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSurveyCompletion(d.timepoints ?? null))
      .catch(() => {});
  }, []); // eslint-disable-line

  useEffect(() => {
    if (chartCache?.loaded) return;

    if (chartCache?.goalsReady) {
      // Goals+radars already cached by GoalsOverviewPage — only need roseplot
      setLoadingStatus("Loading overview chart...");
      fetch("/api/visualizations/roseplot", { credentials: "include" })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((rose) => {
          setRoseFigure(rose);
          setFilteredRoseFigure(rose);
          setChartCache?.((prev) => ({ ...(prev || {}), roseFigure: rose, loaded: true }));
          setReady(true);
        })
        .catch(() => setReady(true));
      return;
    }

    // Full fetch: goals + roseplot in parallel, then radars
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
      setGoalsLoaded(true);

      if (fetchedGoals.length === 0) {
        setChartCache?.({ goals: [], roseFigure: rose, radarFigures: {}, loaded: true });
        setReady(true);
        return;
      }

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

  // Refetch roseplot whenever filters change (debounced, with abort)
  useEffect(() => {
    if (!ready) return;

    // Both at default — reuse the already-fetched figure, no network call
    if (goalFilter === "all" && weekFilter === "all") {
      setFilteredRoseFigure(roseFigure);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    if (goalFilter !== "all") params.set("goal_id", goalFilter);
    if (weekFilter !== "all") params.set("weeks", weekFilter);

    const timer = setTimeout(() => {
      fetch(`/api/visualizations/roseplot?${params.toString()}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((r) => (r.ok ? r.json() : Promise.reject(r)))
        .then((fig) => setFilteredRoseFigure(fig))
        .catch(() => {});
    }, 300);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [goalFilter, weekFilter, ready, roseFigure]); // eslint-disable-line

  const displayName = user?.display_name || user?.username || "there";

  return (
    <>
      {showOnboarding && (
        <OnboardingModal onClose={() => setShowOnboarding(false)} />
      )}
      <ParticipantShell user={user} onLogout={onLogout}>
        <DashboardContent
          displayName={displayName}
          goals={goals}
          radarFigures={radarFigures}
          goalsLoaded={goalsLoaded}
          filteredRoseFigure={filteredRoseFigure}
          roseFigure={roseFigure}
          goalFilter={goalFilter}
          setGoalFilter={setGoalFilter}
          weekFilter={weekFilter}
          setWeekFilter={setWeekFilter}
          surveyCompletion={surveyCompletion}
          navigate={navigate}
          setShowOnboarding={setShowOnboarding}
          ready={ready}
          loadingStatus={loadingStatus}
        />
      </ParticipantShell>
    </>
  );
}

const styles = {
  page: {
    maxWidth: 760,
    margin: "0 auto",
    padding: "24px 16px",
  },
  greeting: {
    fontSize: 14,
    color: "var(--shell-text-muted)",
    marginBottom: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionLabel: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    color: "var(--shell-text-muted)",
    marginBottom: 12,
  },
  goalsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
    gap: 16,
  },
  skeletonWrap: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
  },
  emptyCard: {
    padding: 40,
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
    textAlign: "center",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  ctaLink: {
    marginTop: 16,
    display: "inline-flex",
    textDecoration: "none",
    color: "#fff",
    fontWeight: 700,
    padding: "10px 18px",
    borderRadius: 10,
    background: "var(--shell-accent)",
    fontSize: 14,
  },
  chartCard: {
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
    padding: 20,
  },
  filtersRow: {
    display: "flex",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 10,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  select: {
    padding: "8px 10px",
    borderRadius: 10,
    border: "1px solid var(--shell-border-strong)",
    background: "var(--shell-surface-2)",
    color: "var(--shell-text)",
    fontWeight: 600,
    fontSize: 13,
    outline: "none",
  },
  overviewLink: {
    textDecoration: "none",
    color: "var(--shell-accent)",
    fontWeight: 700,
    fontSize: 13,
    marginLeft: "auto",
  },
  chartBox: {
    borderRadius: 12,
    border: "1px solid var(--shell-border)",
    background: "#0b1220",
    padding: 12,
  },
  loadingHint: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    marginTop: 10,
    textAlign: "center",
    opacity: 0.7,
  },
  insight: {
    fontSize: 13,
    color: "var(--shell-text-muted)",
    fontStyle: "italic",
    textAlign: "center",
    padding: "16px 0 8px",
    margin: 0,
  },
};
