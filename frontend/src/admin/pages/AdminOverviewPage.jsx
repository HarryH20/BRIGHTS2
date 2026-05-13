import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import ReactECharts from "echarts-for-react";
import { BarChart3, MessageSquare, GitMerge, Target, TrendingUp, FileText, AlertTriangle, CheckCircle } from "lucide-react";
import AdminShell from "../AdminShell.jsx";
import RosePlot from "../../graphs/RosePlot.jsx";
import { UserSearch } from "../adminShared.jsx";

function useCountUp(target, duration = 800) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target == null) return;
    const prefersReduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced || target === 0) { setCount(target); return; }
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const progress = Math.min((ts - start) / duration, 1);
      setCount(Math.round(target * progress));
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }, [target, duration]);
  return count;
}

function KpiCard({ label, value, note, warn }) {
  const animated = useCountUp(typeof value === "number" ? value : null);
  return (
    <div style={{ ...kpi.card, ...(warn ? kpi.cardWarn : {}) }}>
      <div className="tabular-nums" style={kpi.value}>
        {typeof value === "number" ? animated : (value ?? "—")}
      </div>
      <div style={kpi.label}>{label}</div>
      {note && <div style={kpi.note}>{note}</div>}
    </div>
  );
}

const kpi = {
  card: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: "16px 20px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  cardWarn: {
    borderColor: "rgba(242,181,68,0.35)",
    background: "rgba(242,181,68,0.05)",
  },
  value: {
    fontSize: 32,
    fontWeight: 700,
    color: "var(--shell-text)",
    lineHeight: 1.1,
  },
  label: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
  },
  note: {
    fontSize: 11,
    color: "var(--shell-text-muted)",
    marginTop: 2,
  },
};

const PREVIEW_CARDS = [
  { label: "Demographics",  path: "/admin/demographics", icon: BarChart3,     desc: "Participant breakdown by age, gender, race, and more" },
  { label: "Linguistics",   path: "/admin/linguistics",  icon: MessageSquare, desc: "Words associated with high and low goal progress" },
  { label: "Alluvial",      path: "/admin/alluvial",     icon: GitMerge,      desc: "How participants moved between progress groups" },
  { label: "Goal Progress", path: "/admin/goals",        icon: Target,        desc: "Score changes by week and participant" },
  { label: "Stats",         path: "/admin/stats",        icon: TrendingUp,    desc: "Session activity, security flags, and usage" },
  { label: "Questions",     path: "/admin/questions",    icon: FileText,      desc: "Edit and manage survey question bank" },
];

export default function AdminOverviewPage({ user, onLogout }) {
  const navigate = useNavigate();

  // ── Study status ──
  const [study, setStudy] = useState(null);

  // ── KPI stats ──
  const [stats, setStats] = useState(null);

  // ── Activity chart ──
  const [activity, setActivity] = useState(null);

  // ── Rose plot ──
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("all");
  const [goal, setGoal] = useState("all");
  const [weeks, setWeeks] = useState("2-6");
  const [figure, setFigure] = useState(null);
  const [roseError, setRoseError] = useState(null);

  // ── Now ──
  const now = new Date().toLocaleString("en-US", {
    year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });

  useEffect(() => {
    fetch("/api/admin/study", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStudy(d))
      .catch(() => {});

    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/stats/activity?days=30", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/users", { credentials: "include" }).then((r) => r.json()),
    ]).then(([s, a, u]) => {
      setStats(s);
      setActivity(a.activity ?? []);
      setUsers(u.users ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    setRoseError(null);
    const controller = new AbortController();
    const qs = new URLSearchParams({ user_id: userId, goal_id: goal, weeks }).toString();
    const timer = setTimeout(() => {
      fetch(`/api/admin/roseplot?${qs}`, { credentials: "include", signal: controller.signal })
        .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
        .then((fig) => setFigure(fig))
        .catch((e) => { if (e.name !== "AbortError") setRoseError(e.message); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [userId, goal, weeks]);

  // ── Status pill ──
  function statusStyle(st) {
    if (!st) return { background: "rgba(107,116,128,0.15)", color: "#6B7480" };
    if (st === "enrolling") return { background: "rgba(79,209,197,0.15)", color: "#4FD1C5" };
    if (st === "closed")    return { background: "rgba(242,181,68,0.15)", color: "#F2B544" };
    if (st === "locked")    return { background: "rgba(242,109,123,0.15)", color: "#F26D7B" };
    return { background: "rgba(107,116,128,0.15)", color: "#A8B0BB" };
  }

  // ── Activity ECharts option ──
  function activityOption() {
    if (!activity || activity.length === 0) return null;
    return {
      backgroundColor: "transparent",
      grid: { top: 16, right: 12, bottom: 32, left: 40 },
      xAxis: {
        type: "category",
        data: activity.map((r) => r.date),
        axisLine: { lineStyle: { color: "var(--shell-border)" } },
        axisLabel: { color: "var(--shell-text-muted)", fontSize: 10, interval: Math.floor(activity.length / 5) },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        minInterval: 1,
        axisLabel: { color: "var(--shell-text-muted)", fontSize: 10 },
        splitLine: { lineStyle: { color: "var(--shell-border)", type: "dashed" } },
      },
      series: [{
        type: "line",
        data: activity.map((r) => r.logins ?? 0),
        smooth: true,
        symbol: "circle",
        symbolSize: 4,
        lineStyle: { color: "#6E8BFF", width: 2 },
        itemStyle: { color: "#6E8BFF" },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(110,139,255,0.18)" }, { offset: 1, color: "rgba(110,139,255,0)" }] } },
      }],
      tooltip: {
        trigger: "axis",
        backgroundColor: "var(--shell-bg-elevated)",
        borderColor: "var(--shell-border-strong)",
        textStyle: { color: "var(--shell-text)", fontSize: 12 },
      },
    };
  }

  const hasFlags = stats && (stats.failed_logins_24h > 10 || stats.lockouts_24h > 0);

  return (
    <AdminShell
      user={user}
      onLogout={onLogout}
      title="Overview"
      subtitle="BRIGHTS2 — Beyond-the-Self Goal Study"
    >
      {/* ── Row 1: Header strip ── */}
      <div style={row1.strip}>
        <div style={row1.left}>
          {study?.status && (
            <span style={{ ...row1.statusPill, ...statusStyle(study.status) }}>
              {study.status}
            </span>
          )}
          <span style={row1.ts}>Last updated: {now}</span>
        </div>
        <span style={row1.hint}>Use Cmd+K to search</span>
      </div>

      {/* ── Row 2: KPI strip ── */}
      <div style={row2.grid}>
        <KpiCard
          label="Participants enrolled"
          value={stats?.total_users ?? null}
        />
        <KpiCard
          label="Sessions active now"
          value={stats?.active_sessions ?? null}
        />
        <KpiCard
          label="New completions (24h)"
          value={stats?.registrations_24h ?? null}
        />
        <div style={{ ...kpi.card, ...(hasFlags ? kpi.cardWarn : {}) }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            {hasFlags
              ? <AlertTriangle size={18} style={{ color: "#F2B544" }} />
              : <CheckCircle size={18} style={{ color: "#4FD1C5" }} />}
            <span style={{ fontSize: 13, fontWeight: 600, color: hasFlags ? "#F2B544" : "#4FD1C5" }}>
              {hasFlags ? "Review flags" : "No flags"}
            </span>
          </div>
          <div style={kpi.label}>Security & quality</div>
        </div>
      </div>

      {/* ── Row 3: Featured charts ── */}
      <div style={row3.wrap}>
        {/* Rose plot — left 60% */}
        <div style={row3.left}>
          <div style={row3.chartCard}>
            <div style={row3.chartTitle}>Progress Rose Plot</div>
            <div style={row3.filterRow}>
              <label style={row3.filterLabel}>
                User
                <UserSearch users={users} value={userId} onChange={setUserId} />
              </label>
              <label style={row3.filterLabel}>
                Goal
                <select value={goal} onChange={(e) => setGoal(e.target.value)} style={row3.select}>
                  <option value="all">All goals</option>
                  <option value="1">Goal 1</option>
                  <option value="2">Goal 2</option>
                  <option value="3">Goal 3</option>
                </select>
              </label>
              <label style={row3.filterLabel}>
                Weeks
                <select value={weeks} onChange={(e) => setWeeks(e.target.value)} style={row3.select}>
                  <option value="all">All weeks</option>
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
            </div>
            <div style={row3.plotArea}>
              {roseError ? (
                <div style={{ padding: 16, color: "#ffb4b4", fontSize: 13 }}>{roseError}</div>
              ) : (
                <RosePlot figure={figure} />
              )}
            </div>
          </div>
        </div>

        {/* Activity chart — right 40% */}
        <div style={row3.right}>
          <div style={row3.chartCard}>
            <div style={row3.chartTitle}>Activity (30 days)</div>
            <div style={row3.plotArea}>
              {activity === null && (
                <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>Loading…</div>
              )}
              {activity !== null && activity.length === 0 && (
                <div style={{ padding: 16, opacity: 0.5, fontSize: 13 }}>No activity data.</div>
              )}
              {activity !== null && activity.length > 0 && (
                <ReactECharts
                  option={activityOption()}
                  style={{ height: 300, width: "100%" }}
                  opts={{ renderer: "canvas" }}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Row 4: Analysis preview grid ── */}
      <div style={row4.grid}>
        {PREVIEW_CARDS.map(({ label, path, icon: Icon, desc }) => (
          <button
            key={path}
            style={row4.card}
            onClick={() => navigate(path)}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = "var(--shell-accent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = "var(--shell-border)";
            }}
          >
            <Icon size={20} style={{ color: "var(--shell-accent)", marginBottom: 8 }} />
            <div style={row4.cardLabel}>{label}</div>
            <div style={row4.cardDesc}>{desc}</div>
            <div style={row4.cardLink}>Open →</div>
          </button>
        ))}
      </div>
    </AdminShell>
  );
}

const row1 = {
  strip: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 20,
    flexWrap: "wrap",
    gap: 8,
  },
  left: {
    display: "flex",
    alignItems: "center",
    gap: 10,
  },
  statusPill: {
    fontSize: 11,
    fontWeight: 700,
    padding: "3px 10px",
    borderRadius: 999,
    textTransform: "capitalize",
    letterSpacing: "0.04em",
  },
  ts: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
  },
  hint: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
  },
};

const row2 = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
    marginBottom: 24,
  },
};

const row3 = {
  wrap: {
    display: "flex",
    gap: 16,
    marginBottom: 24,
    alignItems: "flex-start",
  },
  left: {
    flex: "0 0 60%",
  },
  right: {
    flex: "0 0 calc(40% - 16px)",
  },
  chartCard: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: "16px 16px 8px",
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--shell-text-secondary)",
    marginBottom: 12,
  },
  filterRow: {
    display: "flex",
    gap: 10,
    alignItems: "flex-end",
    flexWrap: "wrap",
    marginBottom: 12,
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
    fontSize: 11,
    fontWeight: 700,
    color: "var(--shell-text-muted)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  select: {
    padding: "7px 10px",
    borderRadius: 8,
    border: "1px solid var(--shell-border-strong)",
    background: "var(--shell-surface-2)",
    color: "var(--shell-text)",
    outline: "none",
    fontSize: 12,
  },
  plotArea: {
    borderRadius: 8,
    background: "#0b1220",
    overflow: "hidden",
  },
};

const row4 = {
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: 12,
  },
  card: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: 16,
    cursor: "pointer",
    textAlign: "left",
    transition: "border-color 200ms ease",
    display: "flex",
    flexDirection: "column",
    fontFamily: "inherit",
  },
  cardLabel: {
    fontSize: 14,
    fontWeight: 600,
    color: "var(--shell-text)",
    marginBottom: 6,
  },
  cardDesc: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    lineHeight: 1.45,
    flex: 1,
  },
  cardLink: {
    fontSize: 12,
    color: "var(--shell-accent)",
    marginTop: 12,
    fontWeight: 600,
    alignSelf: "flex-end",
  },
};
