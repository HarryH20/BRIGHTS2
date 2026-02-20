import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";
import RosePlot from "../graphs/RosePlot.jsx";

export default function OverviewPage({ user, onLogout }) {
  const [goal, setGoal] = useState("2");
  const [weeks, setWeeks] = useState("2-6");

  const subtitle = useMemo(() => `Filters: Goal ${goal}, Weeks ${weeks}`, [goal, weeks]);

  return (
    <HomeLayout user={user} onLogout={onLogout} title="Overview" rightSlot={<span style={pill}>{subtitle}</span>}>
      <div style={card}>
        <div style={row}>
          <label style={label}>
            Goal
            <select value={goal} onChange={(e) => setGoal(e.target.value)} style={select}>
              <option value="1">Goal 1</option>
              <option value="2">Goal 2</option>
              <option value="3">Goal 3</option>
            </select>
          </label>

          <label style={label}>
            Weeks
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)} style={select}>
              <option value="1-6">Weeks 1–6</option>
              <option value="2-6">Weeks 2–6</option>
              <option value="3-6">Weeks 3–6</option>
              <option value="3-6">Weeks 4–6</option>
              <option value="3-6">Weeks 5–6</option>
            </select>
          </label>

          <Link to="/dashboard" style={pillBtn}>Back to Dashboard</Link>
        </div>

        <div style={plotWrap}>
          <RosePlot />
        </div>
      </div>
    </HomeLayout>
  );
}

const card = {
  padding: 18,
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
const pillBtn = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)",
  fontWeight: 900,
  textDecoration: "none",
};
const pill = {
  padding: "6px 10px",
  borderRadius: 999,
  fontSize: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.85)",
};
const plotWrap = {
  borderRadius: 12,
  border: "1px solid rgba(155,183,255,0.12)",
  background: "rgba(255,255,255,0.03)",
  padding: 12,
};