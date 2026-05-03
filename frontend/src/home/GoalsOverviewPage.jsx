import React, { useEffect, useState } from "react";
import { Target } from "lucide-react";
import HomeLayout from "./HomeLayout.jsx";
import GoalCard from "./GoalCard.jsx";
import SkeletonGoalCard from "../components/SkeletonGoalCard.jsx";

const TP_ORDER = ["T6", "T5", "T4", "T3", "T2"];

export default function GoalsOverviewPage({ user, onLogout }) {
  const [goals, setGoals] = useState([]);
  const [radarFigures, setRadarFigures] = useState({});
  const [goalsLoaded, setGoalsLoaded] = useState(false);

  useEffect(() => {
    fetch("/api/visualizations/goals", { credentials: "include" })
      .then(r => r.ok ? r.json() : Promise.reject(r))
      .then(d => {
        const fetchedGoals = d.goals || [];
        setGoals(fetchedGoals);
        setGoalsLoaded(true);

        if (!fetchedGoals.length) return;

        Promise.allSettled(
          fetchedGoals.map((_, idx) =>
            fetch(`/api/visualizations/radarplot?goal_index=${idx}`, { credentials: "include" })
              .then(r => r.ok ? r.json() : Promise.reject(r))
              .then(fig => ({ idx, fig }))
          )
        ).then(results => {
          const radars = {};
          results.forEach(r => {
            if (r.status === "fulfilled") radars[r.value.idx] = r.value.fig;
          });
          setRadarFigures(radars);
        });
      })
      .catch(() => setGoalsLoaded(true));
  }, []);

  const colSpan = goals.length <= 1 ? 12 : goals.length === 2 ? 6 : 4;

  return (
    <HomeLayout user={user} onLogout={onLogout}>
      <div style={s.grid} className="grid12">
        {!goalsLoaded && [0, 1, 2].map(i => (
          <section key={i} style={{ ...s.card, gridColumn: "span 4" }}>
            <SkeletonGoalCard />
          </section>
        ))}

        {goalsLoaded && goals.length === 0 && (
          <section style={{ ...s.card, gridColumn: "1 / -1", textAlign: "center", padding: 40 }}>
            <Target size={40} style={{ opacity: 0.3, marginBottom: 12, color: "var(--text-dim)" }} />
            <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 8 }}>No goals yet</div>
            <p style={s.muted}>
              Complete your Week 1 survey to set up your goals and start tracking your progress.
            </p>
          </section>
        )}

        {goalsLoaded && goals.map((goal, idx) => (
          <GoalCard
            key={goal.goal_id}
            goal={goal}
            idx={idx}
            radarFigure={radarFigures[idx]}
            colSpan={colSpan}
          />
        ))}
      </div>
    </HomeLayout>
  );
}

const s = {
  grid: { display: "grid", gap: 16 },
  card: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },
  muted: { opacity: 0.82, fontSize: 14, lineHeight: 1.45, margin: 0 },
};
