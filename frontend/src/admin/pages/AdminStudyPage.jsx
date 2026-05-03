import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { adminStyles as s } from "../adminStyles.js";

export default function AdminStudyPage({ user, onLogout }) {
  const [study, setStudy] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/admin/study", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => setStudy(d))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <AdminShell user={user} onLogout={onLogout} title="Study" subtitle="Study configuration and protocol">
      <div style={{ maxWidth: 720 }}>
        {loading && <div style={s.loading}>Loading study info…</div>}

        {!loading && !study && (
          <div style={{
            background: "var(--shell-surface-1)",
            border: "1px solid var(--shell-border)",
            borderRadius: 12,
            padding: 32,
            textAlign: "center",
            color: "var(--shell-text-muted)",
            fontSize: 14,
          }}>
            No study configuration found. Study management features will appear here.
          </div>
        )}

        {study && (
          <div style={{ background: "var(--shell-surface-1)", border: "1px solid var(--shell-border)", borderRadius: 12, padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--shell-text-muted)", marginBottom: 4 }}>Study Title</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--shell-text)" }}>{study.title ?? "—"}</div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
              {[
                { label: "Status",      value: study.status },
                { label: "Study Code",  value: study.study_code },
                { label: "Start Date",  value: study.start_date },
                { label: "End Date",    value: study.end_date },
              ].map(({ label, value }) => (
                <div key={label} style={{ background: "var(--shell-surface-2)", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontSize: 11, color: "var(--shell-text-muted)", marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: "var(--shell-text)" }}>{value ?? "—"}</div>
                </div>
              ))}
            </div>

            {study.description && (
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--shell-text-muted)", marginBottom: 6 }}>Description</div>
                <div style={{ fontSize: 13, color: "var(--shell-text-secondary)", lineHeight: 1.6 }}>{study.description}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </AdminShell>
  );
}
