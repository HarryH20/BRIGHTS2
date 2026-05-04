import React, { useCallback, useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";

// ── Constants ──────────────────────────────────────────────────────────────────

const FLAG_TYPE_LABELS = {
  speeding: "Speeding",
  straight_lining: "Straight-lining",
  pattern_response: "Pattern",
  missing_data: "Missing data",
  manual: "Manual",
};

const RESOLUTION_OPTIONS = [
  { value: "excluded_confirmed",  label: "Exclude — confirmed careless" },
  { value: "excluded_borderline", label: "Exclude — borderline, judgment call" },
  { value: "retained_borderline", label: "Retain — borderline but sufficient quality" },
  { value: "retained_confirmed",  label: "Retain — confirmed valid despite flag" },
  { value: "data_error",          label: "Data/technical error — flag is incorrect" },
  { value: "technical_issue",     label: "Technical issue" },
];

const DEFAULT_THRESHOLDS = {
  speeding: {
    seconds_per_item_critical: 1.0,
    seconds_per_item_warning: 2.0,
  },
  straight_lining: {
    longstring_critical: 14,
    longstring_warning: 10,
    irv_critical: 0.3,
    irv_warning: 0.5,
  },
  pattern_response: {
    sign_change_ratio_warning: 0.85,
    cycle_length_max: 4,
  },
  missing_data: {
    pct_missing_critical: 0.30,
    pct_missing_warning: 0.15,
  },
  low_variance: {
    sd_critical: 0.3,
    sd_warning: 0.5,
  },
};

// ── Helper: format flag detail into a short string ────────────────────────────

function flagDetailSummary(flagType, detail) {
  if (!detail) return "—";
  if (flagType === "speeding") {
    if (detail.seconds_per_item != null) return `${detail.seconds_per_item}s/item`;
  }
  if (flagType === "straight_lining") {
    if (detail.longstring != null) return `longstring=${detail.longstring}`;
    if (detail.irv != null) return `IRV=${detail.irv}`;
  }
  if (flagType === "pattern_response") {
    if (detail.sign_change_ratio != null) return `ratio=${detail.sign_change_ratio}`;
    if (detail.cycle_length != null) return `cycle=${detail.cycle_length}`;
  }
  if (flagType === "missing_data") {
    if (detail.pct_missing != null) return `${Math.round(detail.pct_missing * 100)}% missing`;
  }
  return "—";
}

// ── KPI card ──────────────────────────────────────────────────────────────────

function KpiCard({ label, value, accent }) {
  return (
    <div style={{ ...s.kpiCard, borderTop: `2px solid ${accent || "var(--shell-accent)"}` }}>
      <div style={{ fontSize: 28, fontWeight: 800, color: accent || "var(--shell-text)" }}>
        {value ?? "—"}
      </div>
      <div style={s.kpiLabel}>{label}</div>
    </div>
  );
}

// ── Inline resolve form ───────────────────────────────────────────────────────

function ResolveForm({ flagId, onResolved, onCancel }) {
  const [resolution, setResolution] = useState("");
  const [justification, setJustification] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  async function handleSave() {
    if (!resolution) { setError("Select a resolution."); return; }
    if (justification.trim().length < 20) { setError("Justification must be at least 20 characters."); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/quality-flags/${flagId}/resolve`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resolution, justification: justification.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || "Save failed."); setSaving(false); return; }
      onResolved(data);
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div style={s.resolveForm}>
      <div style={s.resolveTitle}>Resolve flag</div>

      <div style={s.resolveOptions}>
        {RESOLUTION_OPTIONS.map((opt) => (
          <label key={opt.value} style={s.resolveOption}>
            <input
              type="radio"
              name={`res-${flagId}`}
              value={opt.value}
              checked={resolution === opt.value}
              onChange={() => setResolution(opt.value)}
              style={{ marginRight: 8, accentColor: "var(--shell-accent)" }}
            />
            {opt.label}
          </label>
        ))}
      </div>

      <textarea
        style={s.resolveTextarea}
        rows={3}
        placeholder="Explain your decision (min 20 characters). This record is permanent."
        value={justification}
        onChange={(e) => setJustification(e.target.value)}
      />
      <div style={{ fontSize: 11, color: justification.length < 20 ? "var(--error-color)" : "var(--shell-text-muted)", marginBottom: 8 }}>
        {justification.length} / 20 min
      </div>

      {error && <div style={s.errorMsg}>{error}</div>}

      <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
        <button style={s.savBtn} onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save resolution"}
        </button>
        <button style={s.cancelLink} onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

// ── Thresholds panel ──────────────────────────────────────────────────────────

function ThresholdsPanel({ roundId, analysisRuns }) {
  const [open, setOpen] = useState(false);
  const [editingType, setEditingType] = useState(null);
  const [editValues, setEditValues] = useState({});
  const [preregistered, setPreregistered] = useState(false);
  const [preregUrl, setPreregUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saved, setSaved] = useState(false);

  function startEdit(flagType) {
    setEditingType(flagType);
    setEditValues({ ...DEFAULT_THRESHOLDS[flagType] });
    setPreregistered(false);
    setPreregUrl("");
    setSaveError(null);
    setSaved(false);
  }

  async function handleSaveThreshold() {
    setSaving(true);
    setSaveError(null);
    try {
      const res = await fetch(`/api/admin/rounds/${roundId}/flag-thresholds`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_type: editingType,
          thresholds: editValues,
          preregistered,
          prereg_url: preregUrl || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error || "Save failed.");
        setSaving(false);
        return;
      }
      setSaved(true);
      setSaving(false);
      setTimeout(() => { setEditingType(null); setSaved(false); }, 1200);
    } catch {
      setSaveError("Network error.");
      setSaving(false);
    }
  }

  return (
    <div style={s.thresholdsPanel}>
      <button style={s.collapseToggle} onClick={() => setOpen((v) => !v)}>
        {open ? "▾" : "▸"} Detection Thresholds
      </button>

      {open && (
        <div style={s.thresholdsGrid}>
          {analysisRuns > 0 && (
            <div style={s.thresholdWarn}>
              Changing thresholds after analysis has run requires preregistration to maintain scientific integrity.
              ({analysisRuns} check run{analysisRuns !== 1 ? "s" : ""} recorded)
            </div>
          )}

          {Object.entries(DEFAULT_THRESHOLDS).map(([flagType, defaults]) => (
            <div key={flagType} style={s.thresholdCard}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{FLAG_TYPE_LABELS[flagType] || flagType}</span>
                {editingType !== flagType && (
                  <button style={s.editBtn} onClick={() => startEdit(flagType)}>Edit thresholds</button>
                )}
              </div>

              {editingType === flagType ? (
                <div>
                  {Object.entries(editValues).map(([k, v]) => (
                    <div key={k} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                      <label style={{ fontSize: 12, color: "var(--shell-text-secondary)", flex: 1 }}>{k}</label>
                      <input
                        type="number"
                        step="0.01"
                        style={s.threshInput}
                        value={v}
                        onChange={(e) => setEditValues((prev) => ({ ...prev, [k]: parseFloat(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                  <label style={s.checkLabel}>
                    <input
                      type="checkbox"
                      checked={preregistered}
                      onChange={(e) => setPreregistered(e.target.checked)}
                      style={{ marginRight: 6 }}
                    />
                    Preregistered
                  </label>
                  {preregistered && (
                    <input
                      type="text"
                      style={{ ...s.threshInput, width: "100%", marginTop: 4 }}
                      placeholder="Preregistration URL"
                      value={preregUrl}
                      onChange={(e) => setPreregUrl(e.target.value)}
                    />
                  )}
                  {saveError && <div style={s.errorMsg}>{saveError}</div>}
                  {saved && <div style={{ color: "var(--success-color)", fontSize: 12, marginTop: 4 }}>Saved.</div>}
                  <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                    <button style={s.savBtn} onClick={handleSaveThreshold} disabled={saving}>
                      {saving ? "Saving…" : "Save"}
                    </button>
                    <button style={s.cancelLink} onClick={() => setEditingType(null)}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px 12px" }}>
                  {Object.entries(defaults).map(([k, v]) => (
                    <span key={k} style={s.threshKV}>
                      <span style={{ opacity: 0.6 }}>{k}:</span> {v}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AdminQualityPage({ user, onLogout }) {
  const [rounds, setRounds] = useState([]);
  const [roundId, setRoundId] = useState(null);
  const [severity, setSeverity] = useState("all");
  const [flagType, setFlagType] = useState("all");
  const [statusFilter, setStatusFilter] = useState("false"); // "false"=unresolved, "true"=resolved, "all"
  const [summary, setSummary] = useState(null);
  const [flags, setFlags] = useState([]);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedFlag, setExpandedFlag] = useState(null);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkResolution, setBulkResolution] = useState("");
  const [bulkJustification, setBulkJustification] = useState("");
  const [bulkError, setBulkError] = useState(null);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [analysisRuns, setAnalysisRuns] = useState(0);

  // Load rounds on mount
  useEffect(() => {
    fetch("/api/admin/rounds", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => {
        const rs = d.rounds || [];
        setRounds(rs);
        if (rs.length > 0) setRoundId(rs[0].id);
      })
      .catch(() => {});
  }, []);

  // Load summary when round changes
  useEffect(() => {
    if (!roundId) return;
    setSummary(null);
    fetch(`/api/admin/quality-flags/summary?round_id=${roundId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSummary(d))
      .catch(() => {});
  }, [roundId]);

  // Load flags when filters change (reset list)
  const loadFlags = useCallback(
    (newOffset = 0, append = false) => {
      if (!roundId) return;
      setLoading(true);
      const params = new URLSearchParams({
        round_id: roundId,
        offset: newOffset,
        is_resolved: statusFilter,
      });
      if (severity !== "all") params.set("severity", severity);
      if (flagType !== "all") params.set("flag_type", flagType);

      fetch(`/api/admin/quality-flags?${params}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => {
          if (append) {
            setFlags((prev) => [...prev, ...(d.flags || [])]);
          } else {
            setFlags(d.flags || []);
          }
          setHasMore(d.has_more || false);
          setOffset(newOffset);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    },
    [roundId, severity, flagType, statusFilter]
  );

  useEffect(() => {
    setSelectedIds(new Set());
    setExpandedFlag(null);
    loadFlags(0, false);
  }, [loadFlags]);

  // Count analysis runs for threshold guard
  useEffect(() => {
    if (!roundId) return;
    fetch(`/api/admin/rounds/${roundId}/flag-thresholds`, { credentials: "include" })
      .then((r) => r.json())
      .catch(() => ({ thresholds: {} }))
      .then(() => {
        fetch(`/api/admin/quality-flags/summary?round_id=${roundId}`, { credentials: "include" })
          .then((r) => r.json())
          .then((d) => setAnalysisRuns(d.total_flags > 0 ? 1 : 0))
          .catch(() => {});
      });
  }, [roundId]);

  function handleFlagResolved(updatedFlag) {
    setFlags((prev) => prev.map((f) => (f.id === updatedFlag.id ? updatedFlag : f)));
    setExpandedFlag(null);
    // Refresh summary
    if (roundId) {
      fetch(`/api/admin/quality-flags/summary?round_id=${roundId}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => setSummary(d))
        .catch(() => {});
    }
  }

  function toggleSelect(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    const unresolvedIds = flags.filter((f) => !f.is_resolved).map((f) => f.id);
    if (selectedIds.size === unresolvedIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(unresolvedIds));
    }
  }

  async function handleBulkResolve() {
    if (!bulkResolution) { setBulkError("Select a resolution."); return; }
    if (bulkJustification.trim().length < 20) { setBulkError("Justification must be at least 20 characters."); return; }
    setBulkSaving(true);
    setBulkError(null);
    try {
      const res = await fetch("/api/admin/quality-flags/bulk-resolve", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          flag_ids: [...selectedIds],
          resolution: bulkResolution,
          justification: bulkJustification.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) { setBulkError(data.error || "Failed."); setBulkSaving(false); return; }
      setSelectedIds(new Set());
      setBulkResolution("");
      setBulkJustification("");
      loadFlags(0, false);
    } catch {
      setBulkError("Network error.");
    }
    setBulkSaving(false);
  }

  const unresolvedFlags = flags.filter((f) => !f.is_resolved);

  return (
    <AdminShell
      user={user}
      onLogout={onLogout}
      title="Data Quality"
      subtitle="Review and resolve automated quality flags"
    >
      <div style={s.page}>
        {/* KPI cards */}
        <div style={s.kpiRow}>
          <KpiCard label="Total flags" value={summary?.total_flags} accent="var(--shell-accent)" />
          <KpiCard label="Unresolved" value={summary?.unresolved} accent="var(--shell-amber)" />
          <KpiCard label="Critical" value={summary?.by_severity?.critical ?? 0} accent="var(--error-color)" />
          <KpiCard label="Flagged participants" value={summary?.flagged_participants} accent="var(--shell-teal)" />
        </div>

        {/* Filter bar */}
        <div style={s.filterBar}>
          <select style={s.select} value={roundId || ""} onChange={(e) => setRoundId(Number(e.target.value) || null)}>
            {rounds.length === 0 && <option value="">No rounds</option>}
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>{r.round_label || `Round ${r.round_number}`}</option>
            ))}
          </select>

          <select style={s.select} value={severity} onChange={(e) => setSeverity(e.target.value)}>
            <option value="all">All severities</option>
            <option value="critical">Critical</option>
            <option value="warning">Warning</option>
          </select>

          <select style={s.select} value={flagType} onChange={(e) => setFlagType(e.target.value)}>
            <option value="all">All types</option>
            <option value="speeding">Speeding</option>
            <option value="straight_lining">Straight-lining</option>
            <option value="pattern_response">Pattern</option>
            <option value="missing_data">Missing data</option>
          </select>

          <select style={s.select} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="false">Unresolved</option>
            <option value="true">Resolved</option>
            <option value="all">All</option>
          </select>

          <button
            style={{ ...s.actionBtn, opacity: !roundId ? 0.4 : 1 }}
            disabled={!roundId}
            onClick={() => fetch(`/api/admin/rounds/${roundId}/recheck`, { method: "POST", credentials: "include" })}
          >
            Re-run checks
          </button>
        </div>

        {/* Flags table */}
        {loading && flags.length === 0 ? (
          <div style={s.empty}>Loading…</div>
        ) : flags.length === 0 ? (
          <div style={s.empty}>No flags match the current filters.</div>
        ) : (
          <div style={s.tableWrap}>
            <table style={s.table}>
              <thead>
                <tr>
                  <th style={s.th}>
                    <input
                      type="checkbox"
                      checked={unresolvedFlags.length > 0 && selectedIds.size === unresolvedFlags.length}
                      onChange={toggleSelectAll}
                    />
                  </th>
                  <th style={s.th}>Participant</th>
                  <th style={s.th}>Week</th>
                  <th style={s.th}>Flag type</th>
                  <th style={s.th}>Severity</th>
                  <th style={s.th}>Detail</th>
                  <th style={s.th}>Status</th>
                  <th style={s.th}></th>
                </tr>
              </thead>
              <tbody>
                {flags.map((flag) => (
                  <React.Fragment key={flag.id}>
                    <tr style={s.tr}>
                      <td style={s.td}>
                        {!flag.is_resolved && (
                          <input
                            type="checkbox"
                            checked={selectedIds.has(flag.id)}
                            onChange={() => toggleSelect(flag.id)}
                          />
                        )}
                      </td>
                      <td style={s.td}>
                        <span style={{ fontWeight: 600 }}>{flag.user?.username}</span>
                        {flag.user?.participant_id && (
                          <span style={s.mono}> {flag.user.participant_id}</span>
                        )}
                      </td>
                      <td style={s.td}>
                        {flag.submission ? `Week ${flag.submission.timepoint}` : "—"}
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.typeBadge, background: flagTypeBg(flag.flag_type) }}>
                          {FLAG_TYPE_LABELS[flag.flag_type] || flag.flag_type}
                        </span>
                      </td>
                      <td style={s.td}>
                        <span style={{ ...s.severityPill, ...severityStyle(flag.severity) }}>
                          {flag.severity}
                        </span>
                      </td>
                      <td style={{ ...s.td, fontSize: 12, color: "var(--shell-text-secondary)" }}>
                        {flagDetailSummary(flag.flag_type, flag.detail)}
                      </td>
                      <td style={s.td}>
                        {flag.is_resolved ? (
                          <span style={s.resolvedPill}>Resolved</span>
                        ) : (
                          <span style={s.unresolvedPill}>Unresolved</span>
                        )}
                      </td>
                      <td style={s.td}>
                        {!flag.is_resolved && (
                          <button
                            style={s.resolveBtn}
                            onClick={() => setExpandedFlag(expandedFlag === flag.id ? null : flag.id)}
                          >
                            {expandedFlag === flag.id ? "Cancel" : "Resolve"}
                          </button>
                        )}
                      </td>
                    </tr>

                    {expandedFlag === flag.id && (
                      <tr>
                        <td colSpan={8} style={{ padding: 0, border: "none" }}>
                          <ResolveForm
                            flagId={flag.id}
                            onResolved={handleFlagResolved}
                            onCancel={() => setExpandedFlag(null)}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>

            {hasMore && (
              <div style={{ textAlign: "center", paddingTop: 12 }}>
                <button
                  style={s.loadMoreBtn}
                  disabled={loading}
                  onClick={() => loadFlags(offset + 50, true)}
                >
                  {loading ? "Loading…" : "Load more"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Bulk resolve floating bar */}
        {selectedIds.size > 0 && (
          <div style={s.bulkBar}>
            <span style={{ fontWeight: 600 }}>{selectedIds.size} flag{selectedIds.size !== 1 ? "s" : ""} selected</span>

            <select
              style={{ ...s.select, background: "var(--shell-surface-3)" }}
              value={bulkResolution}
              onChange={(e) => setBulkResolution(e.target.value)}
            >
              <option value="">Select resolution…</option>
              {RESOLUTION_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>

            <input
              type="text"
              style={{ ...s.threshInput, flex: 1, minWidth: 180 }}
              placeholder="Justification (min 20 chars)"
              value={bulkJustification}
              onChange={(e) => setBulkJustification(e.target.value)}
            />

            {bulkError && <span style={{ color: "var(--error-color)", fontSize: 12 }}>{bulkError}</span>}

            <button style={s.savBtn} onClick={handleBulkResolve} disabled={bulkSaving}>
              {bulkSaving ? "Saving…" : "Resolve selected"}
            </button>
            <button style={s.cancelLink} onClick={() => { setSelectedIds(new Set()); setBulkError(null); }}>
              Cancel
            </button>
          </div>
        )}

        {/* Thresholds panel */}
        {roundId && (
          <ThresholdsPanel roundId={roundId} analysisRuns={analysisRuns} />
        )}
      </div>
    </AdminShell>
  );
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function flagTypeBg(type) {
  const map = {
    speeding: "rgba(242,181,68,0.18)",
    straight_lining: "rgba(248,113,113,0.18)",
    pattern_response: "rgba(110,139,255,0.18)",
    missing_data: "rgba(107,116,128,0.18)",
    manual: "rgba(79,209,197,0.18)",
  };
  return map[type] || "rgba(107,116,128,0.18)";
}

function severityStyle(severity) {
  if (severity === "critical") return { background: "rgba(248,113,113,0.18)", color: "var(--error-color)" };
  if (severity === "warning")  return { background: "rgba(242,181,68,0.18)",  color: "var(--shell-amber)" };
  return { background: "rgba(110,139,255,0.12)", color: "var(--shell-accent)" };
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  page: { display: "flex", flexDirection: "column", gap: 20 },

  kpiRow: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: 12,
  },
  kpiCard: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: "16px 20px",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
  },
  kpiLabel: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    marginTop: 4,
    fontWeight: 500,
    letterSpacing: "0.02em",
  },

  filterBar: {
    display: "flex",
    gap: 8,
    flexWrap: "wrap",
    alignItems: "center",
    padding: "12px 16px",
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
  },
  select: {
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 8,
    color: "var(--shell-text)",
    fontSize: 13,
    padding: "7px 10px",
    cursor: "pointer",
  },
  actionBtn: {
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 8,
    color: "var(--shell-text-secondary)",
    fontSize: 13,
    padding: "7px 12px",
    cursor: "pointer",
    whiteSpace: "nowrap",
  },

  tableWrap: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  table: { width: "100%", borderCollapse: "collapse" },
  th: {
    padding: "10px 12px",
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
    color: "var(--shell-text-muted)",
    borderBottom: "1px solid var(--shell-border)",
    textAlign: "left",
    background: "var(--shell-surface-2)",
  },
  tr: { borderBottom: "1px solid var(--shell-border)" },
  td: { padding: "10px 12px", fontSize: 13, verticalAlign: "middle" },

  typeBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 700,
  },
  severityPill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
  },
  resolvedPill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    background: "rgba(74,222,128,0.1)",
    color: "var(--success-color)",
  },
  unresolvedPill: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    background: "rgba(242,181,68,0.1)",
    color: "var(--shell-amber)",
  },
  resolveBtn: {
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 6,
    color: "var(--shell-text-secondary)",
    fontSize: 12,
    padding: "4px 10px",
    cursor: "pointer",
  },
  mono: {
    fontFamily: "monospace",
    fontSize: 11,
    color: "var(--shell-text-muted)",
    marginLeft: 4,
  },

  resolveForm: {
    background: "var(--shell-surface-2)",
    borderTop: "1px solid var(--shell-border)",
    borderBottom: "1px solid var(--shell-border)",
    padding: 16,
  },
  resolveTitle: {
    fontWeight: 700,
    fontSize: 13,
    marginBottom: 10,
  },
  resolveOptions: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    marginBottom: 12,
  },
  resolveOption: {
    display: "flex",
    alignItems: "center",
    fontSize: 13,
    cursor: "pointer",
    color: "var(--shell-text-secondary)",
  },
  resolveTextarea: {
    width: "100%",
    padding: "8px 10px",
    background: "var(--shell-surface-3)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 8,
    color: "var(--shell-text)",
    fontSize: 13,
    resize: "vertical",
    boxSizing: "border-box",
    marginBottom: 4,
  },

  savBtn: {
    background: "rgba(37,99,235,0.85)",
    border: "1px solid rgba(37,99,235,0.65)",
    borderRadius: 8,
    color: "#fff",
    fontSize: 13,
    fontWeight: 700,
    padding: "7px 14px",
    cursor: "pointer",
  },
  cancelLink: {
    background: "none",
    border: "none",
    color: "var(--shell-text-muted)",
    fontSize: 13,
    cursor: "pointer",
    padding: "4px 8px",
  },
  errorMsg: {
    color: "var(--error-color)",
    fontSize: 12,
    marginBottom: 8,
  },

  loadMoreBtn: {
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 8,
    color: "var(--shell-text-secondary)",
    fontSize: 13,
    padding: "8px 20px",
    cursor: "pointer",
    marginBottom: 12,
  },

  bulkBar: {
    position: "fixed",
    bottom: 24,
    left: "50%",
    transform: "translateX(-50%)",
    display: "flex",
    alignItems: "center",
    gap: 10,
    background: "var(--shell-surface-3)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 12,
    padding: "10px 16px",
    boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    zIndex: 100,
    flexWrap: "wrap",
    maxWidth: 780,
  },

  thresholdsPanel: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    overflow: "hidden",
  },
  collapseToggle: {
    width: "100%",
    background: "none",
    border: "none",
    borderBottom: "1px solid var(--shell-border)",
    color: "var(--shell-text-secondary)",
    fontSize: 13,
    fontWeight: 700,
    padding: "12px 16px",
    cursor: "pointer",
    textAlign: "left",
  },
  thresholdsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 12,
    padding: 16,
  },
  thresholdCard: {
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border)",
    borderRadius: 10,
    padding: "12px 14px",
  },
  thresholdWarn: {
    gridColumn: "1 / -1",
    background: "rgba(242,181,68,0.08)",
    border: "1px solid rgba(242,181,68,0.3)",
    borderRadius: 8,
    padding: "10px 14px",
    fontSize: 12,
    color: "var(--shell-amber)",
  },
  threshKV: { fontSize: 12, color: "var(--shell-text-secondary)" },
  editBtn: {
    background: "none",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 6,
    color: "var(--shell-accent)",
    fontSize: 11,
    padding: "3px 8px",
    cursor: "pointer",
  },
  threshInput: {
    background: "var(--shell-surface-3)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 6,
    color: "var(--shell-text)",
    fontSize: 12,
    padding: "4px 8px",
    width: 80,
  },
  checkLabel: {
    display: "flex",
    alignItems: "center",
    fontSize: 12,
    color: "var(--shell-text-secondary)",
    cursor: "pointer",
    marginTop: 6,
  },

  empty: {
    padding: 40,
    textAlign: "center",
    color: "var(--shell-text-muted)",
    fontSize: 14,
  },
};
