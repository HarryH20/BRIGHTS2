import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { alluvialToEcharts } from "../lib/plotlyToEcharts.js";

function AdminAlluvialInner({ figure: prefetchedFigure }) {
  const [figure,             setFigure]             = useState(prefetchedFigure ?? null);
  const [loading,            setLoading]            = useState(prefetchedFigure === undefined);
  const [error,              setError]              = useState("");
  const [selectedTransition, setSelectedTransition] = useState("");
  const [selectedCondition,  setSelectedCondition]  = useState(0);
  const [selectedQuestion,   setSelectedQuestion]   = useState(null);

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError("");

    fetch("/api/admin/alluvial", { credentials: "include" })
      .then(res => res.json().then(d => ({ ok: res.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || "Failed to load alluvial charts");
        if (!cancelled) { setFigure(d); setError(""); }
      })
      .catch(err => { if (!cancelled) setError(err.message || "Failed to load alluvial charts"); })
      .finally(() => { if (!cancelled) setLoading(false); });

    return () => { cancelled = true; };
  }, [prefetchedFigure]);

  const transitions  = figure?.transitions ?? [];
  const conditions   = figure?.conditions  ?? [{ label: "All Conditions", value: 0 }];
  const figuresByKey = figure?.figures     ?? {};

  useEffect(() => {
    if (!selectedTransition && transitions.length > 0) {
      setSelectedTransition(transitions[0].key);
    }
  }, [transitions, selectedTransition]);

  const currentFigures = useMemo(() => {
    if (!selectedTransition) return [];
    const key = `${selectedTransition}_C${selectedCondition}`;
    return figuresByKey[key] ?? [];
  }, [figuresByKey, selectedTransition, selectedCondition]);

  // Reset question to first available when transition or condition changes
  useEffect(() => {
    if (currentFigures.length > 0) {
      setSelectedQuestion(currentFigures[0].q_num);
    }
  }, [selectedTransition, selectedCondition]);

  const currentItem = useMemo(() => {
    if (!selectedQuestion) return currentFigures[0] ?? null;
    return currentFigures.find(f => f.q_num === selectedQuestion) ?? currentFigures[0] ?? null;
  }, [currentFigures, selectedQuestion]);

  const rawOption = currentItem ? alluvialToEcharts(currentItem.figure) : null;
  // Suppress the chart's internal generic title — card header + stats row provide context
  const option = rawOption ? { ...rawOption, title: { show: false } } : null;

  const filterSlot = transitions.length > 0 && (
    <>
      <label style={lbl}>
        Transition
        <select
          value={selectedTransition}
          onChange={e => setSelectedTransition(e.target.value)}
          style={sel}
        >
          {transitions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
        </select>
      </label>

      <label style={lbl}>
        Condition
        <select
          value={selectedCondition}
          onChange={e => setSelectedCondition(Number(e.target.value))}
          style={sel}
        >
          {conditions.map(c => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </label>

      {currentFigures.length > 0 && (
        <label style={lbl}>
          Question
          <select
            value={selectedQuestion ?? ""}
            onChange={e => setSelectedQuestion(Number(e.target.value))}
            style={{ ...sel, minWidth: 280 }}
          >
            {currentFigures.map(f => (
              <option key={f.q_num} value={f.q_num}>{f.title}</option>
            ))}
          </select>
        </label>
      )}
    </>
  );

  const isEmpty = !loading && !error && (!figure || !transitions.length);

  return (
    <div>
      <AdminChartWrapper
        loading={loading}
        error={error || undefined}
        onRetry={() => { setError(""); setFigure(null); setLoading(true); }}
        empty={isEmpty}
        title="Participant Flow Between Groups"
        subtitle="How participants moved between Likert score groups across the study weeks"
        filterSlot={filterSlot}
        height={680}
      >
        {!loading && !error && !isEmpty && option && (
          <>
            {/* Per-question stats row */}
            {currentItem?.stats && (
              <div style={statsRow}>
                {currentItem.construct && (
                  <span style={constructTag}>{currentItem.construct}</span>
                )}
                <span style={statImproved}>
                  ▲ Improved: {currentItem.stats.improved} ({currentItem.stats.improved_pct}%)
                </span>
                <span style={statSame}>
                  ▶ Same: {currentItem.stats.same} ({currentItem.stats.same_pct}%)
                </span>
                <span style={statDeclined}>
                  ▼ Declined: {currentItem.stats.declined} ({currentItem.stats.declined_pct}%)
                </span>
                <span style={statTotal}>N={currentItem.stats.total}</span>
              </div>
            )}

            <AppErrorBoundary key={`${selectedTransition}-${selectedCondition}-${currentItem?.q_num}`} context="chart">
              <ReactECharts
                option={option}
                opts={{ renderer: "svg" }}
                style={{ height: 650, width: "100%" }}
                notMerge
              />
            </AppErrorBoundary>
          </>
        )}
      </AdminChartWrapper>
    </div>
  );
}

export default function AdminAlluvial(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminAlluvialInner {...props} />
    </AppErrorBoundary>
  );
}

const lbl = {
  display: "flex", flexDirection: "column", gap: 6,
  fontSize: 13, fontWeight: 600, color: "var(--text-dim)",
};
const sel = {
  minWidth: 180, padding: "10px 12px", borderRadius: 12,
  border: "1px solid var(--ghost-border)", background: "var(--ghost-bg)",
  color: "var(--ghost-color)", fontSize: 14, fontWeight: 600, outline: "none",
};
const statsRow = {
  display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap",
  marginBottom: 12, padding: "10px 14px",
  borderRadius: 10, background: "rgba(255,255,255,0.02)",
  border: "1px solid var(--card-border)",
};
const constructTag = {
  color: "var(--text-dim)", fontSize: 12, fontWeight: 600,
  opacity: 0.75, marginRight: 4,
};
const statImproved = { color: "rgba(26,150,65,0.9)",  fontSize: 13, fontWeight: 600 };
const statSame     = { color: "rgba(253,174,97,0.9)",  fontSize: 13, fontWeight: 600 };
const statDeclined = { color: "rgba(215,48,39,0.9)",   fontSize: 13, fontWeight: 600 };
const statTotal    = { color: "var(--text-dim)", fontSize: 12, opacity: 0.6, marginLeft: "auto" };
