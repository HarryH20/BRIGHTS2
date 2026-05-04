import React, { useEffect, useState, useCallback } from "react";
import { Shuffle, Plus, Trash2, Lock } from "lucide-react";
import AdminShell from "../AdminShell.jsx";
import { adminStyles as s } from "../adminStyles.js";

const ALGORITHMS = [
  { value: "permuted_block", label: "Permuted Block" },
  { value: "simple_random", label: "Simple Random" },
  { value: "stratified_block", label: "Stratified Block" },
  { value: "manual", label: "Manual" },
];

export default function AdminConditionsPage({ user, onLogout }) {
  const [rounds, setRounds] = useState([]);
  const [selectedRoundId, setSelectedRoundId] = useState("");
  const [conditions, setConditions] = useState([]);
  const [balance, setBalance] = useState([]);
  const [strategy, setStrategy] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Add condition form
  const [addLabel, setAddLabel] = useState("");
  const [addDesc, setAddDesc] = useState("");
  const [addColor, setAddColor] = useState("");
  const [addCap, setAddCap] = useState("");
  const [addError, setAddError] = useState("");
  const [addSaving, setAddSaving] = useState(false);

  // Strategy form
  const [stratAlgorithm, setStratAlgorithm] = useState("permuted_block");
  const [stratBlockSizes, setStratBlockSizes] = useState("4,6,8");
  const [stratSeed, setStratSeed] = useState("");
  const [stratSaving, setStratSaving] = useState(false);

  // Randomize
  const [showConfirm, setShowConfirm] = useState(false);
  const [randomizing, setRandomizing] = useState(false);

  // Fetch rounds list on mount
  useEffect(() => {
    fetch("/api/admin/rounds", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        const list = d.rounds || d;
        setRounds(Array.isArray(list) ? list : []);
        if (Array.isArray(list) && list.length > 0) {
          setSelectedRoundId(String(list[0].id));
        }
      })
      .catch(() => {});
  }, []);

  const loadRoundData = useCallback((roundId) => {
    if (!roundId) return;
    setLoading(true);
    setError("");
    Promise.all([
      fetch(`/api/admin/rounds/${roundId}/conditions`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/admin/rounds/${roundId}/balance`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
      fetch(`/api/admin/rounds/${roundId}/strategy`, { credentials: "include" }).then((r) => r.ok ? r.json() : null),
    ]).then(([cond, bal, strat]) => {
      setConditions(cond?.conditions || []);
      setBalance(bal?.balance || []);
      if (strat) {
        setStrategy(strat);
        setStratAlgorithm(strat.algorithm || "permuted_block");
        setStratBlockSizes((strat.block_sizes || [4, 6, 8]).join(","));
        setStratSeed(strat.rng_seed || "");
      } else {
        setStrategy(null);
        setStratAlgorithm("permuted_block");
        setStratBlockSizes("4,6,8");
        setStratSeed("");
      }
    }).catch(() => setError("Failed to load round data"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (selectedRoundId) loadRoundData(selectedRoundId);
  }, [selectedRoundId, loadRoundData]);

  function handleAddCondition(e) {
    e.preventDefault();
    if (!addLabel.trim()) { setAddError("Label is required"); return; }
    setAddError("");
    setAddSaving(true);
    fetch(`/api/admin/rounds/${selectedRoundId}/conditions`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        label: addLabel.trim(),
        description: addDesc.trim() || null,
        color: addColor.trim() || null,
        max_capacity: addCap ? parseInt(addCap) : null,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setAddError(d.error || "Failed to add"); return; }
        setAddLabel(""); setAddDesc(""); setAddColor(""); setAddCap("");
        loadRoundData(selectedRoundId);
        setSuccess("Condition added");
        setTimeout(() => setSuccess(""), 2500);
      })
      .catch(() => setAddError("Network error"))
      .finally(() => setAddSaving(false));
  }

  function handleDeleteCondition(cid) {
    if (!window.confirm("Delete this condition? Only allowed if no participants are assigned.")) return;
    fetch(`/api/admin/rounds/${selectedRoundId}/conditions/${cid}`, {
      method: "DELETE",
      credentials: "include",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error || "Failed to delete"); return; }
        loadRoundData(selectedRoundId);
      })
      .catch(() => setError("Network error"));
  }

  function handleSaveStrategy(e) {
    e.preventDefault();
    setStratSaving(true);
    const sizes = stratBlockSizes.split(",").map((x) => parseInt(x.trim())).filter((n) => !isNaN(n) && n > 0);
    fetch(`/api/admin/rounds/${selectedRoundId}/strategy`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        algorithm: stratAlgorithm,
        block_sizes: sizes,
        rng_seed: stratSeed.trim() || null,
      }),
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error || "Failed to save strategy"); return; }
        loadRoundData(selectedRoundId);
        setSuccess("Strategy saved");
        setTimeout(() => setSuccess(""), 2500);
      })
      .catch(() => setError("Network error"))
      .finally(() => setStratSaving(false));
  }

  function handleRandomize() {
    setRandomizing(true);
    setShowConfirm(false);
    fetch(`/api/admin/rounds/${selectedRoundId}/randomize`, {
      method: "POST",
      credentials: "include",
    })
      .then((r) => r.json().then((d) => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) { setError(d.error || "Randomization failed"); return; }
        setSuccess(`Sequence generated: ${d.sequence_length} slots (strategy locked)`);
        setTimeout(() => setSuccess(""), 4000);
        loadRoundData(selectedRoundId);
      })
      .catch(() => setError("Network error"))
      .finally(() => setRandomizing(false));
  }

  const strategyLocked = strategy?.is_locked;
  const totalEnrolled = balance.reduce((sum, b) => sum + (b.assigned_count || 0), 0);

  return (
    <AdminShell user={user} onLogout={onLogout} title="Conditions" subtitle="Randomization and condition assignment">
      <div style={{ maxWidth: 820, display: "flex", flexDirection: "column", gap: 24 }}>

        {/* Round selector */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 12, fontWeight: 700, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Round
          </label>
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            style={s.select}
          >
            {rounds.map((r) => (
              <option key={r.id} value={String(r.id)}>
                {r.round_label || `Round ${r.round_number}`} ({r.status})
              </option>
            ))}
          </select>
        </div>

        {error && <div style={s.errorText}>{error}</div>}
        {success && <div style={{ padding: "10px 12px", color: "#6ee7b7", fontWeight: 700, fontSize: 13 }}>{success}</div>}
        {loading && <div style={s.loading}>Loading…</div>}

        {!loading && selectedRoundId && (
          <>
            {/* Balance overview */}
            {balance.length > 0 && (
              <section>
                <div style={s.sectionHeading}>Allocation Balance</div>
                <div style={s.statGrid}>
                  {balance.map((b) => (
                    <div key={b.label} style={s.statCard}>
                      <div style={s.statValue}>{b.assigned_count}</div>
                      <div style={s.statLabel}>{b.label}</div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)" }}>
                        {b.pct != null ? `${b.pct}%` : "—"}
                        {b.max_capacity ? ` / cap ${b.max_capacity}` : ""}
                      </div>
                    </div>
                  ))}
                  <div style={{ ...s.statCard, borderColor: "var(--subtle-border)" }}>
                    <div style={s.statValue}>{totalEnrolled}</div>
                    <div style={s.statLabel}>Total Assigned</div>
                  </div>
                </div>
              </section>
            )}

            {/* Conditions table */}
            <section>
              <div style={s.sectionHeading}>Conditions</div>
              {conditions.length === 0 ? (
                <div style={{ fontSize: 13, color: "var(--text-dim)", padding: "12px 0" }}>
                  No conditions defined for this round.
                </div>
              ) : (
                <div style={s.tableWrap}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {["Label", "Description", "Color", "Max Cap", "Assigned", ""].map((h) => (
                          <th key={h} style={s.th}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {conditions.map((c) => (
                        <tr key={c.id} style={s.tr}>
                          <td style={{ ...s.td, fontWeight: 700 }}>{c.label}</td>
                          <td style={s.td}>{c.description || "—"}</td>
                          <td style={s.td}>
                            {c.color ? (
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                <span style={{ width: 12, height: 12, borderRadius: "50%", background: c.color, display: "inline-block" }} />
                                {c.color}
                              </span>
                            ) : "—"}
                          </td>
                          <td style={s.td}>{c.max_capacity ?? "—"}</td>
                          <td style={s.td}>{c.assigned_count ?? 0}</td>
                          <td style={s.td}>
                            {!strategyLocked && (
                              <button
                                style={{ ...s.btnGhost, color: "#ffb4b4", borderColor: "#ffb4b444" }}
                                onClick={() => handleDeleteCondition(c.id)}
                              >
                                <Trash2 size={13} />
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Add condition form */}
              {!strategyLocked && (
                <form onSubmit={handleAddCondition} style={{ ...s.addForm, marginTop: 12 }}>
                  <div style={{ fontWeight: 800, fontSize: 12, color: "var(--text-dim)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Add Condition
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr auto auto", gap: 8, alignItems: "end" }}>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Label *</div>
                      <input
                        value={addLabel}
                        onChange={(e) => setAddLabel(e.target.value)}
                        placeholder="e.g. control"
                        style={{ ...s.select, width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Description</div>
                      <input
                        value={addDesc}
                        onChange={(e) => setAddDesc(e.target.value)}
                        placeholder="Optional"
                        style={{ ...s.select, width: "100%", boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Color</div>
                      <input
                        value={addColor}
                        onChange={(e) => setAddColor(e.target.value)}
                        placeholder="#aabbcc"
                        style={{ ...s.select, width: 90, boxSizing: "border-box" }}
                      />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Max cap</div>
                      <input
                        type="number"
                        min="1"
                        value={addCap}
                        onChange={(e) => setAddCap(e.target.value)}
                        placeholder="—"
                        style={{ ...s.select, width: 70, boxSizing: "border-box" }}
                      />
                    </div>
                  </div>
                  {addError && <div style={{ color: "#ffb4b4", fontSize: 12 }}>{addError}</div>}
                  <button type="submit" disabled={addSaving} style={s.btnPrimary}>
                    <Plus size={13} style={{ marginRight: 5 }} />
                    {addSaving ? "Adding…" : "Add Condition"}
                  </button>
                </form>
              )}
            </section>

            {/* Strategy */}
            <section>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                <div style={s.sectionHeading}>Allocation Strategy</div>
                {strategyLocked && (
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#fbbf24", fontWeight: 700 }}>
                    <Lock size={11} /> Locked
                  </span>
                )}
              </div>
              <form onSubmit={handleSaveStrategy} style={s.addForm}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Algorithm</div>
                    <select
                      value={stratAlgorithm}
                      onChange={(e) => setStratAlgorithm(e.target.value)}
                      disabled={strategyLocked}
                      style={{ ...s.select, width: "100%" }}
                    >
                      {ALGORITHMS.map((a) => (
                        <option key={a.value} value={a.value}>{a.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>Block sizes (comma-separated)</div>
                    <input
                      value={stratBlockSizes}
                      onChange={(e) => setStratBlockSizes(e.target.value)}
                      disabled={strategyLocked}
                      placeholder="4,6,8"
                      style={{ ...s.select, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                  <div>
                    <div style={{ fontSize: 11, color: "var(--text-dim)", marginBottom: 4 }}>RNG seed (optional)</div>
                    <input
                      value={stratSeed}
                      onChange={(e) => setStratSeed(e.target.value)}
                      disabled={strategyLocked}
                      placeholder="leave blank for random"
                      style={{ ...s.select, width: "100%", boxSizing: "border-box" }}
                    />
                  </div>
                </div>
                {!strategyLocked && (
                  <button type="submit" disabled={stratSaving} style={s.btnPrimary}>
                    {stratSaving ? "Saving…" : "Save Strategy"}
                  </button>
                )}
              </form>
            </section>

            {/* Randomize */}
            <section>
              <div style={s.sectionHeading}>Generate Allocation Sequence</div>
              <div style={{ fontSize: 13, color: "var(--text-dim)", marginBottom: 12, maxWidth: 560 }}>
                Generates a permuted-block sequence for this round using the saved strategy.
                This will lock the strategy — conditions cannot be added or removed afterward.
                Existing participants are not re-assigned.
              </div>
              {strategyLocked ? (
                <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "#fbbf24" }}>
                  <Lock size={14} /> Strategy is locked — sequence already generated.
                </div>
              ) : (
                <>
                  {showConfirm ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>
                        Confirm: generate allocation sequence and lock strategy?
                      </span>
                      <button
                        style={{ ...s.btnPrimary, background: "#ef4444" }}
                        onClick={handleRandomize}
                        disabled={randomizing}
                      >
                        {randomizing ? "Generating…" : "Yes, randomize"}
                      </button>
                      <button style={s.btnGhost} onClick={() => setShowConfirm(false)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button
                      style={s.btnPrimary}
                      onClick={() => {
                        if (conditions.length < 2) {
                          setError("Add at least 2 conditions before randomizing.");
                          return;
                        }
                        setError("");
                        setShowConfirm(true);
                      }}
                      disabled={randomizing}
                    >
                      <Shuffle size={14} style={{ marginRight: 6 }} />
                      Generate Sequence
                    </button>
                  )}
                </>
              )}
            </section>
          </>
        )}
      </div>
    </AdminShell>
  );
}
