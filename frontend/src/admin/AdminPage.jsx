import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import HomeLayout from "../home/HomeLayout.jsx";
import RosePlot from "../graphs/RosePlot.jsx";

export default function AdminPage({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("all");
  const [goal, setGoal] = useState("all");
  const [weeks, setWeeks] = useState("2-6");

  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  const subtitle = useMemo(
    () => `Filters: User ${userId}, Goal ${goal}, Weeks ${weeks}`,
    [userId, goal, weeks]
  );

  // Load users for the dropdown
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/users", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Users fetch failed: ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        setUsers(data.users ?? []);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Fetch aggregated rose plot (admin)
  useEffect(() => {
    let cancelled = false;
    setError(null);
    setFigure(null);

    const qs = new URLSearchParams({
      user_id: userId,
      goal_id: goal,
      weeks,
    }).toString();

    fetch(`/api/admin/roseplot?${qs}`, { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Roseplot fetch failed: ${res.status}`);
        return res.json();
      })
      .then((fig) => {
        if (cancelled) return;
        setFigure(fig);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, goal, weeks]);

  // Optional: basic client-side guard (backend already enforces admin_required)
  if (user?.role && user.role !== "admin") {
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Admin" rightSlot={<span style={pill}>Admin only</span>}>
        <div style={card}>
          <p style={{ opacity: 0.85, margin: 0 }}>
            You don’t have access to this page.
          </p>
          <div style={{ marginTop: 14 }}>
            <Link to="/dashboard" style={pillBtn}>← Back to Dashboard</Link>
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout user={user} onLogout={onLogout} title="Admin Overview" rightSlot={<span style={pill}>{subtitle}</span>}>
      <div style={card}>
        <div style={row}>
          <label style={label}>
            User
            <select value={userId} onChange={(e) => setUserId(e.target.value)} style={select}>
              <option value="all">All users</option>
              {users.map((u) => (
                <option key={u.id} value={String(u.id)}>
                  {u.username} (#{u.id})
                </option>
              ))}
            </select>
          </label>

          <label style={label}>
            Goal
            <select value={goal} onChange={(e) => setGoal(e.target.value)} style={select}>
              <option value="all">All goals</option>
              <option value="1">Goal 1</option>
              <option value="2">Goal 2</option>
              <option value="3">Goal 3</option>
            </select>
          </label>

          <label style={label}>
            Weeks
            <select value={weeks} onChange={(e) => setWeeks(e.target.value)} style={select}>
              <option value="all">Weeks 2–6 (All)</option>
              <option value="2-6">Weeks 2–6</option>
              <option value="3-6">Weeks 3–6</option>
              <option value="4-6">Weeks 4–6</option>
              <option value="5-6">Weeks 5–6</option>
              <option value="2">Week 2 only</option>
              <option value="3">Week 3 only</option>
              <option value="4">Week 4 only</option>
              <option value="5">Week 5 only</option>
              <option value="6">Week 6 only</option>
            </select>
          </label>

          <Link to="/dashboard" style={pillBtn}>← Back to Dashboard</Link>
        </div>

        <div style={plotWrap}>
          {error ? (
            <div style={{ padding: 12, color: "#ffb4b4", fontWeight: 700 }}>
              {error}
            </div>
          ) : (
            <RosePlot figure={figure} />
          )}
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