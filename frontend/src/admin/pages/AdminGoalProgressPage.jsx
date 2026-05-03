import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import AdminDivergingPlot from "../../graphs/AdminDivergingPlot.jsx";
import { UserSearch } from "../adminShared.jsx";
import { adminStyles as s } from "../adminStyles.js";

export default function AdminGoalProgressPage({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("all");
  const [goals, setGoals] = useState("1,2,3");
  const [weeks, setWeeks] = useState("2,3,4,5,6");
  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setFigure(null);
    const qs = new URLSearchParams({ user_id: userId, goals, weeks }).toString();
    fetch(`/api/admin/divergingstackedbarchart?${qs}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(`Chart fetch failed: ${r.status}`); return r.json(); })
      .then((fig) => { if (!cancelled) setFigure(fig); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [userId, goals, weeks]);

  return (
    <AdminShell user={user} onLogout={onLogout} title="Goal Progress" subtitle="Score changes by week and participant">
      <div style={s.tabContent}>
        <div style={s.filterRow}>
          <label style={s.filterLabel}>
            User
            <UserSearch users={users} value={userId} onChange={setUserId} />
          </label>
          <label style={s.filterLabel}>
            Goal
            <select value={goals} onChange={(e) => setGoals(e.target.value)} style={s.select}>
              <option value="1,2,3">All goals</option>
              <option value="1">Goal 1</option>
              <option value="2">Goal 2</option>
              <option value="3">Goal 3</option>
            </select>
          </label>
          <label style={s.filterLabel}>
            Weeks
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)} style={s.select}>
              <option value="2,3,4,5,6">Weeks 2–6</option>
              <option value="3,4,5,6">Weeks 3–6</option>
              <option value="4,5,6">Weeks 4–6</option>
              <option value="5,6">Weeks 5–6</option>
              <option value="2">Week 2 only</option>
              <option value="3">Week 3 only</option>
              <option value="4">Week 4 only</option>
              <option value="5">Week 5 only</option>
              <option value="6">Week 6 only</option>
            </select>
          </label>
        </div>
        <div style={s.plotWrap}>
          {error ? <div style={s.errorText}>{error}</div> : <AdminDivergingPlot figure={figure} />}
        </div>
      </div>
    </AdminShell>
  );
}
