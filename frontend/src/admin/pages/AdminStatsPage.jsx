import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import ApaTable from "../components/ApaTable.jsx";
import { adminStyles as s } from "../adminStyles.js";
import { fmtDuration } from "../adminUtils.js";

const STATS_COLUMNS = [
  { key: "metric", label: "Metric", align: "left" },
  { key: "value",  label: "Value",  align: "right" },
  { key: "note",   label: "Note",   align: "left" },
];

const ACTIVITY_COLUMNS = [
  { key: "date",          label: "Date",          align: "left" },
  { key: "logins",        label: "Logins",        align: "right" },
  { key: "failures",      label: "Failures",      align: "right" },
  { key: "registrations", label: "Registrations", align: "right" },
  { key: "logouts",       label: "Logouts",       align: "right" },
];

export default function AdminStatsPage({ user, onLogout }) {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/stats/activity?days=7", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([st, a]) => {
        if (cancelled) return;
        setStats(st);
        setActivity(a.activity ?? []);
      })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, []);

  if (error) return (
    <AdminShell user={user} onLogout={onLogout} title="Stats" subtitle="Session activity, security flags, and usage">
      <div style={s.errorText}>{error}</div>
    </AdminShell>
  );

  if (!stats) return (
    <AdminShell user={user} onLogout={onLogout} title="Stats" subtitle="Session activity, security flags, and usage">
      <div style={s.loading}>Loading stats…</div>
    </AdminShell>
  );

  const avgFmt = stats.avg_session_duration_seconds != null
    ? fmtDuration(stats.avg_session_duration_seconds)
    : "—";

  const statsRows = [
    { metric: "Total users",          value: stats.total_users,            note: "" },
    { metric: "Admins",               value: stats.total_admins,           note: "" },
    { metric: "Active sessions",      value: stats.active_sessions,        note: "" },
    { metric: "Avg session duration", value: avgFmt,                       note: "" },
    { metric: "Failed logins (24h)",  value: stats.failed_logins_24h,      note: stats.failed_logins_24h > 0 ? "⚠ Review" : "" },
    { metric: "Lockouts (24h)",       value: stats.lockouts_24h,           note: stats.lockouts_24h > 0 ? "⚠ Review" : "" },
    { metric: "Unauthorized (24h)",   value: stats.unauthorized_access_24h, note: stats.unauthorized_access_24h > 0 ? "⚠ Review" : "" },
    { metric: "Registrations (24h)",  value: stats.registrations_24h,      note: "" },
  ];

  return (
    <AdminShell user={user} onLogout={onLogout} title="Stats" subtitle="Session activity, security flags, and usage">
      <div style={{ display: "flex", flexDirection: "column", gap: 32 }}>
        <div style={{ background: "var(--shell-surface-1)", border: "1px solid var(--shell-border)", borderRadius: 12, padding: 24 }}>
          <ApaTable
            columns={STATS_COLUMNS}
            rows={statsRows}
            caption="Platform usage statistics"
            footnote="Values reflect current session data. Counts marked ⚠ warrant security review."
          />
        </div>

        {activity && activity.length > 0 && (
          <div style={{ background: "var(--shell-surface-1)", border: "1px solid var(--shell-border)", borderRadius: 12, padding: 24 }}>
            <ApaTable
              columns={ACTIVITY_COLUMNS}
              rows={activity}
              caption="Login activity (last 7 days)"
            />
          </div>
        )}
      </div>
    </AdminShell>
  );
}
