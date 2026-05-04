import React, { useEffect, useState } from "react";
import ParticipantShell from "./ParticipantShell.jsx";
import RosePlot from "../graphs/RosePlot.jsx";
import LoadingScreen from "./LoadingScreen.jsx";

export default function OverviewPage({ user, onLogout }) {
  const [goalFilter, setGoalFilter] = useState("all");
  const [weekFilter, setWeekFilter] = useState("2-6");

  const [goals, setGoals] = useState([]);
  const [roseFigure, setRoseFigure] = useState(null);
  const [filteredRoseFigure, setFilteredRoseFigure] = useState(null);
  const [ready, setReady] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState("Loading overview...");

  useEffect(() => {
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
      const rose =
        roseResult.status === "fulfilled" ? roseResult.value : null;

      setGoals(fetchedGoals);
      setRoseFigure(rose);
      setFilteredRoseFigure(rose);
      setReady(true);
    });
  }, []);

  useEffect(() => {
    if (!ready) return;

    const params = new URLSearchParams();
    if (goalFilter !== "all") params.set("goal_id", goalFilter);
    if (weekFilter !== "all") params.set("weeks", weekFilter);

    setLoadingStatus("Updating overview...");

    fetch(`/api/visualizations/roseplot?${params.toString()}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((fig) => setFilteredRoseFigure(fig))
      .catch(() => {});
  }, [goalFilter, weekFilter, ready]);

  if (!ready) return <LoadingScreen status={loadingStatus} />;

  return (
    <ParticipantShell user={user} onLogout={onLogout}>
      <div style={card}>
        <div style={row}>
          <label style={label}>
            Goal
            <select
              value={goalFilter}
              onChange={(e) => setGoalFilter(e.target.value)}
              style={select}
            >
              <option value="all">All Goals</option>
              {goals.map((g) => (
                <option key={g.goal_id} value={String(g.goal_id)}>
                  {g.text.length > 24 ? g.text.slice(0, 24) + "…" : g.text}
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            Weeks
            <select
              value={weekFilter}
              onChange={(e) => setWeekFilter(e.target.value)}
              style={select}
            >
              <option value="all">All Weeks</option>
              <option value="2-6">Weeks 2–6</option>
              <option value="3-6">Weeks 3–6</option>
              <option value="4-6">Weeks 4–6</option>
              <option value="5-6">Weeks 5–6</option>
            </select>
          </label>

        </div>

        <div style={plotWrap}>
          <RosePlot figure={filteredRoseFigure || roseFigure} />
        </div>
      </div>
    </ParticipantShell>
  );
}

const card = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid var(--card-border)",
  background: "var(--card-bg)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  backdropFilter: "blur(8px)",
};

const row = {
  display: "flex",
  gap: 12,
  alignItems: "center",
  flexWrap: "wrap",
  marginBottom: 14,
};

const label = {
  display: "grid",
  gap: 6,
  fontWeight: 800,
  fontSize: 13,
  opacity: 0.92,
};

const select = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid var(--ghost-border)",
  background: "var(--ghost-bg)",
  color: "var(--ghost-color)",
  outline: "none",
};

const plotWrap = {
  borderRadius: 12,
  border: "1px solid var(--subtle-border)",
  background: "#0b1220",
  padding: 12,
};