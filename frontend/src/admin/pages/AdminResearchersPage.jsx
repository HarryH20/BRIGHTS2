import React, { useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";

const ROLE_LABELS = {
  pi: "Principal Investigator",
  research_assistant: "Research Assistant",
  data_manager: "Data Manager",
  observer: "Observer",
};

const ROLE_DESCRIPTIONS = {
  pi: "Full access — can edit study config and grant roles",
  research_assistant: "Can view participant data and add notes",
  data_manager: "Can export de-identified data only",
  observer: "Read-only access to aggregate results",
};

const ROLE_COLORS = {
  pi: "var(--shell-accent)",
  research_assistant: "var(--shell-teal)",
  data_manager: "var(--shell-amber)",
  observer: "var(--shell-text-muted)",
};

const EXPIRY_OPTIONS = [
  { label: "48 hours", value: 48 },
  { label: "7 days",   value: 168 },
  { label: "30 days",  value: 720 },
];

const PERMISSION_MATRIX = [
  { capability: "View participant data (PII)",  pi: true,  ra: true,  dm: false, ob: false },
  { capability: "Export de-identified data",    pi: true,  ra: false, dm: true,  ob: false },
  { capability: "Export with PII",              pi: true,  ra: false, dm: false, ob: false },
  { capability: "Edit study config",            pi: true,  ra: false, dm: false, ob: false },
  { capability: "Edit consent text",            pi: true,  ra: false, dm: false, ob: false },
  { capability: "Add researcher notes",         pi: true,  ra: true,  dm: false, ob: false },
  { capability: "Grant / revoke roles",         pi: true,  ra: false, dm: false, ob: false },
  { capability: "View audit log",               pi: true,  ra: false, dm: false, ob: false },
  { capability: "Run randomization",            pi: true,  ra: false, dm: false, ob: false },
  { capability: "Resolve quality flags",        pi: true,  ra: true,  dm: true,  ob: false },
  { capability: "Edit / delete records",        pi: true,  ra: false, dm: false, ob: false },
  { capability: "View analysis",                pi: true,  ra: true,  dm: true,  ob: true  },
  { capability: "Manage rounds",                pi: true,  ra: false, dm: false, ob: false },
  { capability: "Manage enrollments",           pi: true,  ra: false, dm: false, ob: false },
];

function RoleBadge({ role }) {
  const color = ROLE_COLORS[role] || "var(--shell-text-muted)";
  return (
    <span style={{
      display: "inline-block",
      padding: "3px 10px",
      borderRadius: 20,
      fontSize: 12,
      fontWeight: 700,
      background: color + "22",
      color,
      border: `1px solid ${color}55`,
    }}>
      {ROLE_LABELS[role] || role}
    </span>
  );
}

function formatRelative(isoString) {
  if (!isoString) return "—";
  const d = new Date(isoString);
  const diff = Date.now() - d.getTime();
  if (diff < 0) {
    const abs = -diff;
    if (abs < 60000) return "in a moment";
    if (abs < 3600000) return `in ${Math.round(abs / 60000)}m`;
    if (abs < 86400000) return `in ${Math.round(abs / 3600000)}h`;
    return `in ${Math.round(abs / 86400000)}d`;
  }
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}

export default function AdminResearchersPage({ user, onLogout }) {
  const [researchers, setResearchers] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [loadingTeam, setLoadingTeam] = useState(true);

  // Invite form state
  const [selectedRole, setSelectedRole] = useState("pi");
  const [expiresHours, setExpiresHours] = useState(72);
  const [generating, setGenerating] = useState(false);
  const [generatedUrl, setGeneratedUrl] = useState("");
  const [generateError, setGenerateError] = useState("");
  const [copied, setCopied] = useState(false);

  // Revoke confirm state
  const [revokingId, setRevokingId] = useState(null);

  // Permission matrix collapsed state
  const [matrixOpen, setMatrixOpen] = useState(false);

  function loadData() {
    setLoadingTeam(true);
    Promise.all([
      fetch("/api/admin/researchers", { credentials: "include" }).then(r => r.ok ? r.json() : { researchers: [] }),
      fetch("/api/admin/researchers/invitations", { credentials: "include" }).then(r => r.ok ? r.json() : { invitations: [] }),
    ]).then(([teamData, invData]) => {
      setResearchers(teamData.researchers || []);
      setInvitations(invData.invitations || []);
    }).catch(() => {}).finally(() => setLoadingTeam(false));
  }

  useEffect(() => { loadData(); }, []);

  async function handleGenerate() {
    setGenerateError("");
    setGeneratedUrl("");
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/researchers/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ role: selectedRole, expires_hours: expiresHours }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setGenerateError(data?.error || "Failed to generate invite link.");
        setGenerating(false);
        return;
      }
      setGeneratedUrl(data.invite_url);
      loadData(); // refresh invitations list
    } catch {
      setGenerateError("Network error. Please try again.");
    }
    setGenerating(false);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(generatedUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select the input
    }
  }

  async function handleRevoke(roleId) {
    const res = await fetch(`/api/admin/researchers/${roleId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) {
      setRevokingId(null);
      loadData();
    }
  }

  async function handleRevokeInvitation(invId) {
    const res = await fetch(`/api/admin/researchers/invitations/${invId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (res.ok) loadData();
  }

  return (
    <AdminShell user={user} onLogout={onLogout} title="Research Team" subtitle="Manage researcher access and invitations">
      <div style={{ maxWidth: 760, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* ── Current team ── */}
        <section>
          <div style={s.sectionLabel}>Current Team</div>
          {loadingTeam ? (
            <div style={s.empty}>Loading…</div>
          ) : researchers.length === 0 ? (
            <div style={s.empty}>No researchers added yet. Generate an invite link below.</div>
          ) : (
            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr>
                    {["Name", "Email", "Role", "Last Active", "CITI Training", ""].map(h => (
                      <th key={h} style={s.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {researchers.map((r) => (
                    <tr key={r.id} style={s.tr}>
                      <td style={s.td}>{r.user?.display_name || r.user?.username || "—"}</td>
                      <td style={{ ...s.td, color: "var(--shell-text-secondary)", fontSize: 12 }}>{r.user?.email || "—"}</td>
                      <td style={s.td}><RoleBadge role={r.role} /></td>
                      <td style={{ ...s.td, color: "var(--shell-text-muted)", fontSize: 12 }}>{formatRelative(r.last_access_at)}</td>
                      <td style={{ ...s.td, color: "var(--shell-text-muted)", fontSize: 12 }}>
                        {r.citi_completion_date
                          ? new Date(r.citi_completion_date).toLocaleDateString()
                          : "Not recorded"}
                      </td>
                      <td style={{ ...s.td, textAlign: "right" }}>
                        {revokingId === r.id ? (
                          <span style={{ display: "inline-flex", gap: 6 }}>
                            <button style={s.btnDanger} onClick={() => handleRevoke(r.id)}>Confirm</button>
                            <button style={s.btnGhost} onClick={() => setRevokingId(null)}>Cancel</button>
                          </span>
                        ) : (
                          <button style={s.btnGhost} onClick={() => setRevokingId(r.id)}>Revoke</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* ── Invite section ── */}
        <section>
          <div style={s.sectionLabel}>Invite a Researcher</div>
          <div style={s.card}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Role selector */}
              <div>
                <div style={s.fieldLabel}>Role</div>
                <div style={s.roleGrid}>
                  {Object.entries(ROLE_LABELS).map(([key, label]) => {
                    const active = selectedRole === key;
                    const color = ROLE_COLORS[key];
                    return (
                      <button
                        key={key}
                        style={{
                          ...s.roleOption,
                          border: active ? `2px solid ${color}` : "1px solid var(--shell-border-strong)",
                          background: active ? color + "11" : "var(--shell-surface-2)",
                        }}
                        onClick={() => setSelectedRole(key)}
                      >
                        <span style={{ fontWeight: 700, fontSize: 13, color: active ? color : "var(--shell-text)" }}>
                          {label}
                        </span>
                        <span style={{ fontSize: 11, color: "var(--shell-text-muted)", lineHeight: 1.4, marginTop: 2 }}>
                          {ROLE_DESCRIPTIONS[key]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Expiry selector */}
              <div>
                <div style={s.fieldLabel}>Link expiry</div>
                <div style={{ display: "flex", gap: 8 }}>
                  {EXPIRY_OPTIONS.map(opt => (
                    <button
                      key={opt.value}
                      style={{
                        ...s.expiryBtn,
                        background: expiresHours === opt.value ? "var(--shell-accent)" : "var(--shell-surface-2)",
                        color: expiresHours === opt.value ? "#fff" : "var(--shell-text-secondary)",
                        border: expiresHours === opt.value ? "1px solid var(--shell-accent)" : "1px solid var(--shell-border-strong)",
                      }}
                      onClick={() => setExpiresHours(opt.value)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <button style={s.btnPrimary} onClick={handleGenerate} disabled={generating}>
                {generating ? "Generating…" : "Generate invite link"}
              </button>

              {generateError && (
                <div style={s.errorBox}>{generateError}</div>
              )}

              {generatedUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  <div style={{ display: "flex", gap: 8 }}>
                    <input
                      readOnly
                      value={generatedUrl}
                      style={s.urlInput}
                      onFocus={(e) => e.target.select()}
                    />
                    <button style={s.copyBtn} onClick={handleCopy}>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p style={s.warning}>
                    ⚠ This link can only be used once. Share it securely — do not post publicly.
                  </p>
                </div>
              )}
            </div>
          </div>
        </section>

        {/* ── Active invitations ── */}
        <section>
          <div style={s.sectionLabel}>Pending Invitations</div>
          {loadingTeam ? null : invitations.length === 0 ? (
            <div style={s.empty}>No pending invitations.</div>
          ) : (
            <div style={s.card}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {invitations.map(inv => (
                  <div key={inv.id} style={s.invRow}>
                    <RoleBadge role={inv.role} />
                    <span style={{ fontSize: 12, color: "var(--shell-text-muted)", flex: 1 }}>
                      Expires {formatRelative(inv.expires_at)}
                    </span>
                    <button style={s.btnGhost} onClick={() => handleRevokeInvitation(inv.id)}>
                      Revoke
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── Permission matrix ── */}
        <section>
          <button
            style={s.matrixToggle}
            onClick={() => setMatrixOpen(v => !v)}
          >
            {matrixOpen ? "▾" : "▸"} What can each role do?
          </button>
          {matrixOpen && (
            <div style={s.tableCard}>
              <table style={s.table}>
                <thead>
                  <tr>
                    <th style={{ ...s.th, textAlign: "left" }}>Capability</th>
                    {["PI", "RA", "Data Mgr", "Observer"].map(h => (
                      <th key={h} style={{ ...s.th, textAlign: "center" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {PERMISSION_MATRIX.map(row => (
                    <tr key={row.capability} style={s.tr}>
                      <td style={{ ...s.td, color: "var(--shell-text-secondary)", fontSize: 12 }}>{row.capability}</td>
                      {[row.pi, row.ra, row.dm, row.ob].map((has, i) => (
                        <td key={i} style={{ ...s.td, textAlign: "center", fontSize: 14 }}>
                          {has
                            ? <span style={{ color: "var(--shell-teal)" }}>✓</span>
                            : <span style={{ color: "var(--shell-text-muted)", opacity: 0.4 }}>—</span>}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </AdminShell>
  );
}

const s = {
  sectionLabel: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--shell-text-muted)",
    marginBottom: 10,
  },
  card: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: 20,
  },
  tableCard: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "10px 14px",
    fontSize: 11,
    fontWeight: 700,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    color: "var(--shell-text-muted)",
    borderBottom: "1px solid var(--shell-border)",
    whiteSpace: "nowrap",
    textAlign: "left",
  },
  tr: {
    borderBottom: "1px solid var(--shell-border)",
  },
  td: {
    padding: "10px 14px",
    color: "var(--shell-text)",
    verticalAlign: "middle",
  },
  empty: {
    padding: "20px 16px",
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    color: "var(--shell-text-muted)",
    fontSize: 13,
    textAlign: "center",
  },
  fieldLabel: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--shell-text-secondary)",
    marginBottom: 8,
  },
  roleGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 10,
  },
  roleOption: {
    display: "flex",
    flexDirection: "column",
    padding: "10px 14px",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "left",
    gap: 2,
  },
  expiryBtn: {
    padding: "6px 14px",
    borderRadius: 8,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  btnPrimary: {
    padding: "10px 18px",
    borderRadius: 10,
    border: "none",
    background: "var(--shell-accent)",
    color: "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  urlInput: {
    flex: 1,
    padding: "9px 12px",
    borderRadius: 8,
    border: "1px solid var(--shell-border-strong)",
    background: "var(--shell-surface-2)",
    color: "var(--shell-text)",
    fontSize: 12,
    fontFamily: "monospace",
    outline: "none",
    minWidth: 0,
  },
  copyBtn: {
    padding: "9px 16px",
    borderRadius: 8,
    border: "1px solid var(--shell-border-strong)",
    background: "var(--shell-surface-2)",
    color: "var(--shell-text)",
    fontWeight: 600,
    fontSize: 13,
    cursor: "pointer",
    whiteSpace: "nowrap",
  },
  warning: {
    fontSize: 12,
    color: "var(--shell-amber)",
    margin: 0,
    lineHeight: 1.5,
  },
  invRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    padding: "8px 4px",
    borderBottom: "1px solid var(--shell-border)",
  },
  btnGhost: {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid var(--shell-border-strong)",
    background: "transparent",
    color: "var(--shell-text-secondary)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnDanger: {
    padding: "5px 12px",
    borderRadius: 7,
    border: "1px solid rgba(255,80,80,0.35)",
    background: "rgba(255,80,80,0.10)",
    color: "#ffd1d1",
    fontSize: 12,
    fontWeight: 700,
    cursor: "pointer",
  },
  errorBox: {
    padding: 10,
    borderRadius: 8,
    background: "rgba(255,80,80,0.12)",
    border: "1px solid rgba(255,80,80,0.35)",
    color: "#ffd1d1",
    fontSize: 13,
  },
  matrixToggle: {
    background: "none",
    border: "none",
    color: "var(--shell-accent)",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    padding: "4px 0",
    marginBottom: 10,
  },
};
