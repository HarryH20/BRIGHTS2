import React, { useCallback, useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { Pagination } from "../adminShared.jsx";
import { adminStyles as s } from "../adminStyles.js";
import { EVENT_TYPES } from "../adminShared.jsx";
import { fmtTs, parseDevice } from "../adminUtils.js";

const PER_PAGE = 50;

export default function AdminAuditPage({ user, onLogout }) {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);
    const qs = new URLSearchParams({ page, per_page: PER_PAGE });
    if (eventType) qs.set("event_type", eventType);
    fetch(`/api/admin/audit-log?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch((e) => { if (!cancelled) { setError(e.message); setLoading(false); } });
    return () => { cancelled = true; };
  }, [page, eventType]);

  useEffect(() => { const cancel = load(); return cancel; }, [load]);

  function handleEventType(e) { setEventType(e.target.value); setPage(1); }

  if (error) return (
    <AdminShell user={user} onLogout={onLogout} title="Audit Log" subtitle="Security events and access log">
      <div style={s.errorText}>{error}</div>
    </AdminShell>
  );

  return (
    <AdminShell user={user} onLogout={onLogout} title="Audit Log" subtitle="Security events and access log">
      <div style={s.tabContent}>
        <div style={s.filterRow}>
          <label style={s.filterLabel}>
            Event type
            <select value={eventType} onChange={handleEventType} style={s.select}>
              <option value="">All events</option>
              {EVENT_TYPES.map((et) => <option key={et} value={et}>{et}</option>)}
            </select>
          </label>
          {loading && <span style={{ opacity: 0.5, fontSize: 13 }}>Loading…</span>}
        </div>

        <div style={s.tableWrap}>
          <table style={s.table}>
            <thead>
              <tr>
                {["Timestamp", "Event", "User ID", "Detail", "IP", "Device"].map((h) => (
                  <th key={h} style={s.th}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {entries.map((e) => (
                <tr key={e.id} style={s.tr}>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }}>{fmtTs(e.timestamp)}</td>
                  <td style={s.td}>
                    <span style={{
                      ...s.eventBadge,
                      ...(e.event_type?.includes("FAIL") || e.event_type?.includes("LOCKED") || e.event_type?.includes("UNAUTHORIZED")
                        ? s.eventBadgeWarn : {}),
                    }}>
                      {e.event_type}
                    </span>
                  </td>
                  <td style={s.td}>{e.user_id ?? "—"}</td>
                  <td style={{ ...s.td, maxWidth: 220, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {e.detail ?? "—"}
                  </td>
                  <td style={{ ...s.td, fontFamily: "monospace", fontSize: 12 }}>{e.ip_address ?? "—"}</td>
                  <td style={{ ...s.td, whiteSpace: "nowrap" }} title={e.user_agent ?? ""}>{parseDevice(e.user_agent)}</td>
                </tr>
              ))}
              {entries.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} style={{ ...s.td, textAlign: "center", opacity: 0.5 }}>No entries</td>
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
