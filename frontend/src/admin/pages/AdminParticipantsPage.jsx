import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import AdminUserProfile from "../../graphs/AdminUserProfile.jsx";
import SkeletonAdminTab from "../../components/SkeletonAdminTab.jsx";
import { UserSearch } from "../adminShared.jsx";
import { adminStyles as s } from "../adminStyles.js";

function ConditionPanel({ userId }) {
  const [enrollment, setEnrollment] = useState(null);
  const [conditions, setConditions] = useState([]);
  const [newLabel, setNewLabel] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!userId || userId === "all") { setEnrollment(null); return; }
    fetch(`/api/admin/users/${userId}/enrollment`, { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d || !d.enrollment) { setEnrollment(null); return; }
        setEnrollment(d.enrollment);
        const roundId = d.enrollment.round_id;
        if (roundId) {
          fetch(`/api/admin/rounds/${roundId}/conditions`, { credentials: "include" })
            .then((r) => r.ok ? r.json() : null)
            .then((cd) => setConditions(cd?.conditions || []))
            .catch(() => {});
        }
      })
      .catch(() => setEnrollment(null));
  }, [userId]);

  if (!enrollment) return null;

  async function handleReassign(e) {
    e.preventDefault();
    if (!newLabel) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await fetch(`/api/admin/enrollments/${enrollment.id}/condition`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ condition_label: newLabel, reason: reason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg({ ok: false, text: data.error || "Reassign failed" });
      } else {
        setEnrollment((prev) => ({ ...prev, condition_label: newLabel }));
        setMsg({ ok: true, text: `Condition updated to "${newLabel}"` });
        setNewLabel("");
        setReason("");
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--subtle-border)", background: "var(--surface-subtle)", padding: 20, marginTop: 16 }}>
      <div style={s.sectionHeading}>Condition Assignment</div>
      <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12 }}>
        Round: <strong style={{ color: "var(--text-primary)" }}>{enrollment.round_id}</strong>
        {" · "}
        Current condition: <strong style={{ color: "var(--text-primary)" }}>{enrollment.condition_label || "unassigned"}</strong>
      </div>
      {conditions.length > 0 && (
        <form onSubmit={handleReassign} style={{ display: "flex", gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-dim)" }}>
            New Condition
            <select
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={s.select}
              required
            >
              <option value="">Select…</option>
              {conditions.map((c) => (
                <option key={c.label} value={c.label}>{c.label}</option>
              ))}
            </select>
          </label>
          <label style={{ display: "flex", flexDirection: "column", gap: 4, fontSize: 12, color: "var(--text-dim)", flex: 1 }}>
            Reason (required for audit)
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. data entry correction"
              style={{ ...s.select, minWidth: 180 }}
              required
            />
          </label>
          <button type="submit" disabled={saving || !newLabel} style={s.btnPrimary}>
            {saving ? "Saving…" : "Reassign"}
          </button>
        </form>
      )}
      {msg && (
        <div style={{ marginTop: 10, fontSize: 13, color: msg.ok ? "#6ee7b7" : "#fca5a5", fontWeight: 600 }}>
          {msg.text}
        </div>
      )}
    </div>
  );
}

const FLAG_TYPE_LABELS = {
  speeding: "Speeding",
  straight_lining: "Straight-lining",
  pattern_response: "Pattern Response",
  missing_data: "Missing Data",
  low_variance: "Low Variance",
};

const SEVERITY_STYLE = {
  critical: { background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.3)" },
  warning:  { background: "rgba(234,179,8,0.12)",  color: "#ca8a04", border: "1px solid rgba(234,179,8,0.3)" },
};

function QualitySection({ userId }) {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId || userId === "all") { setFlags([]); return; }
    setLoading(true);
    setError(null);
    fetch(`/api/admin/quality-flags?user_id=${userId}&offset=0`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
      .then((d) => setFlags(d.flags ?? []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [userId]);

  if (!userId || userId === "all") return null;

  return (
    <div style={{ borderRadius: 12, border: "1px solid var(--subtle-border)", background: "var(--surface-subtle)", padding: 20, marginTop: 16 }}>
      <div style={s.sectionHeading}>Data Quality Flags</div>

      {loading && <div style={{ fontSize: 13, color: "var(--text-dim)" }}>Loading…</div>}
      {error && <div style={{ fontSize: 13, color: "#fca5a5" }}>Error: {error}</div>}

      {!loading && !error && flags.length === 0 && (
        <div style={{ fontSize: 13, color: "var(--text-dim)" }}>No quality flags for this participant.</div>
      )}

      {!loading && !error && flags.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {flags.map((f) => (
            <div key={f.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 12px", borderRadius: 8, background: "var(--surface-overlay, var(--shell-bg-overlay))", border: "1px solid var(--shell-border)" }}>
              <span style={{ ...SEVERITY_STYLE[f.severity], padding: "2px 7px", borderRadius: 4, fontSize: 11, fontWeight: 700, flexShrink: 0 }}>
                {f.severity}
              </span>
              <span style={{ fontSize: 13, fontWeight: 500, color: "var(--text-primary)", flex: 1 }}>
                {FLAG_TYPE_LABELS[f.flag_type] ?? f.flag_type}
              </span>
              {f.round && (
                <span style={{ fontSize: 12, color: "var(--text-dim)" }}>
                  {f.round.name ?? `Round ${f.round_id}`}
                </span>
              )}
              <span style={{ fontSize: 12, color: "var(--text-dim)", flexShrink: 0 }}>
                {new Date(f.created_at).toLocaleDateString()}
              </span>
              {f.is_resolved && (
                <span style={{ fontSize: 11, color: "#6ee7b7", fontWeight: 600, flexShrink: 0 }}>Resolved</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AdminParticipantsPage({ user, onLogout }) {
  const [users, setUsers] = useState([]);
  const [userId, setUserId] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setUsers(d.users ?? []))
      .catch(() => {});
  }, []);

  function normalizeUserId(v) {
    if (!v) return "all";
    if (v === "all") return "all";
    const m = v.match(/#(\d+)/);
    if (m) return m[1];
    if (/^\d+$/.test(v)) return v;
    return "all";
  }

  useEffect(() => {
    setError(null);
    setData(null);
    const qs = new URLSearchParams({ user_id: userId }).toString();
    fetch(`/api/admin/demographics?${qs}`, { credentials: "include" })
      .then((r) => { if (!r.ok) throw new Error(`Fetch failed: ${r.status}`); return r.json(); })
      .then((fig) => setData(fig))
      .catch((e) => setError(e.message));
  }, [userId]);

  return (
    <AdminShell user={user} onLogout={onLogout} title="Participants" subtitle="User profiles and individual data">
      <div style={s.tabContent}>
        <div style={s.filterRow}>
          <label style={s.filterLabel}>
            User
            <UserSearch users={users} value={userId} onChange={(v) => setUserId(normalizeUserId(v))} />
          </label>
        </div>

        <div style={{ borderRadius: 12, border: "1px solid var(--subtle-border)", background: "var(--surface-subtle)", padding: 20 }}>
          {error && <div style={s.errorText}>{error}</div>}
          {!error && !data && <SkeletonAdminTab charts={2} chartHeight={320} />}
          {data && <AdminUserProfile userId={userId} prefetchedData={data} />}
        </div>

        {userId !== "all" && <ConditionPanel userId={userId} />}
        {userId !== "all" && <QualitySection userId={userId} />}
      </div>
    </AdminShell>
  );
}
