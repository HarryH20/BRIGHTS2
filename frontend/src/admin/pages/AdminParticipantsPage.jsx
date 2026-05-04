import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import AdminUserProfile from "../../graphs/AdminUserProfile.jsx";
import SkeletonAdminTab from "../../components/SkeletonAdminTab.jsx";
import { UserSearch } from "../adminShared.jsx";
import { adminStyles as s } from "../adminStyles.js";

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
      </div>
    </AdminShell>
  );
}
