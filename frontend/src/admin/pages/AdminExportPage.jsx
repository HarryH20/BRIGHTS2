import React, { useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { adminStyles as s } from "../adminStyles.js";
import { Download } from "lucide-react";

const EXPORT_OPTIONS = [
  { key: "survey_responses", label: "Survey Responses", desc: "All participant survey answers with timestamps", endpoint: "/api/admin/export/survey-responses" },
  { key: "goal_progress",    label: "Goal Progress",    desc: "Goal scores across all timepoints by participant", endpoint: "/api/admin/export/goal-progress" },
  { key: "demographics",     label: "Demographics",     desc: "Anonymized participant demographic data", endpoint: "/api/admin/export/demographics" },
  { key: "audit_log",        label: "Audit Log",        desc: "Full security and access event log", endpoint: "/api/admin/export/audit-log" },
  { key: "sessions",         label: "Sessions",         desc: "All login session records with durations", endpoint: "/api/admin/export/sessions" },
];

export default function AdminExportPage({ user, onLogout }) {
  const [downloading, setDownloading] = useState(null);
  const [error, setError] = useState(null);

  async function handleExport(opt) {
    setDownloading(opt.key);
    setError(null);
    try {
      const res = await fetch(opt.endpoint, { credentials: "include" });
      if (!res.ok) throw new Error(`Export failed: ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${opt.key}_${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      setError(`${opt.label}: ${e.message}`);
    } finally {
      setDownloading(null);
    }
  }

  return (
    <AdminShell user={user} onLogout={onLogout} title="Export" subtitle="Download study data as CSV">
      <div style={{ maxWidth: 640, display: "flex", flexDirection: "column", gap: 12 }}>
        {error && <div style={s.errorText}>{error}</div>}

        {EXPORT_OPTIONS.map((opt) => (
          <div key={opt.key} style={{
            background: "var(--shell-surface-1)",
            border: "1px solid var(--shell-border)",
            borderRadius: 12,
            padding: "16px 20px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: "var(--shell-text)", marginBottom: 3 }}>{opt.label}</div>
              <div style={{ fontSize: 12, color: "var(--shell-text-muted)" }}>{opt.desc}</div>
            </div>
            <button
              style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "8px 14px", borderRadius: 8,
                border: "1px solid var(--shell-border-strong)",
                background: "var(--shell-surface-2)",
                color: downloading === opt.key ? "var(--shell-text-muted)" : "var(--shell-accent)",
                fontSize: 13, fontWeight: 600, cursor: "pointer",
                fontFamily: "inherit",
              }}
              onClick={() => handleExport(opt)}
              disabled={downloading === opt.key}
            >
              <Download size={14} />
              {downloading === opt.key ? "Downloading…" : "Download CSV"}
            </button>
          </div>
        ))}

        <div style={{ fontSize: 12, color: "var(--shell-text-muted)", marginTop: 8, lineHeight: 1.5 }}>
          All exports are in CSV format. Participant data is anonymized per study protocol.
          Export endpoints may return a placeholder response until backend routes are fully implemented.
        </div>
      </div>
    </AdminShell>
  );
}
