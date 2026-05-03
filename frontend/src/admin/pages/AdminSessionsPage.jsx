import React, { useCallback, useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { Pagination } from "../adminShared.jsx";
import { adminStyles as s } from "../adminStyles.js";
import { fmtTs, fmtDuration, parseDevice } from "../adminUtils.js";

const PER_PAGE = 50;

export default function AdminSessionsPage({ user, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ page, per_page: PER_PAGE });
    if (activeOnly) qs.set("active", "true");
    fetch(`/api/admin/sessions?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, activeOnly]);

  useEffect(() => { const cancel = load(); return cancel; }, [load]);

  function handleActiveOnly(e) { setActiveOnly(e.target.checked); setPage(1); }

  if (error) return (
    <AdminShell user={user} onLogout={onLogout} title="Sessions" subtitle="Login sessions and duration">
      <div style={s.errorText}>{error}</div>
    </AdminShell>
  );

  return (
    <AdminShell user={user} onLogout={onLogout} title="Sessions" subtitle="Login sessions and duration">
      <div style={s.tabContent}>
        <div style={s.filterRow}>
          <label style={{ ...s.filterLabel, flexDirection: "row", alignItems: "center", gap: 8 }}>
            <input type="checkbox" checked={activeOnly} onChange={handleActiveOnly} />
            Active sessions only
          </label>
          {loading && <span style={{ opacity: 0.5, fontSize: 13 }}>Loading…</span>}
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["User ID", "Login At", "Logout At", "Duration", "IP", "Device"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={s.tr}>
                  <td style={s.td}>{e.user_id}</td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }}>{fmtTs(e.login_at)}</td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }}>{fmtTs(e.logout_at)}</td>
                  <td style={{ ...s.td, color: e.logout_at == null ? "#7ecb8f" : "inherit" }}>
                    {fmtDuration(e.duration_seconds)}
                  </td>
                  <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{e.ip_address ?? "—"}</td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }} title={e.user_agent ?? ""}>{parseDevice(e.user_agent)}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: "center", opacity: 0.5 }}>No sessions</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
      </div>
    </AdminShell>
  );
}
