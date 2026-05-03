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

  const transitions      = figure?.transitions ?? [];
  const figuresByKey     = figure?.figures ?? {};

  useEffect(() => {
    if (!selectedTransition && transitions.length > 0) {
      setSelectedTransition(transitions[0].key);
    }
  }, [transitions, selectedTransition]);

  const currentFigures = useMemo(
    () => (selectedTransition ? (figuresByKey[selectedTransition] ?? []) : []),
    [figuresByKey, selectedTransition],
  );

  const filterSlot = transitions.length > 0 && (
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
  );

  const isEmpty = !loading && !error && (!figure || !transitions.length);

  return (
    <div>
      <div style={hdr}>
        <div>
          <h2 style={titleSt}>Alluvial Chart</h2>
          <p style={subtitleSt}>Compare response flow across transitions.</p>
        </div>
        {transitions.length > 0 && (
          <label style={lbl}>
            Transition
            <select value={selectedTransition} onChange={e => setSelectedTransition(e.target.value)} style={sel}>
              {transitions.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
            </select>
          </label>
        )}
      </div>

      <AdminChartWrapper
        loading={loading}
        error={error || undefined}
        onRetry={() => { setError(""); setFigure(null); setLoading(true); }}
        empty={isEmpty}
        height={180}
      >
        {!loading && !error && !isEmpty && (
          <>
            <p style={meta}>
              Showing {currentFigures.length} chart{currentFigures.length === 1 ? "" : "s"}
            </p>
            <div style={grid}>
              {currentFigures.map(item => {
                const option = alluvialToEcharts(item.figure);
                if (!option) return null;
                return (
                  <AppErrorBoundary key={`${selectedTransition}-${item.q_num}`} context="chart">
                    <div style={card}>
                      <ReactECharts
                        option={option}
                        opts={{ renderer: 'svg' }}
                        style={{ height: 650, width: '100%' }}
                        notMerge
                      />
                    </div>
                  </AppErrorBoundary>
                );
              })}
            </div>
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

const hdr = {
  display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap',
  gap: 16, padding: '18px 20px', borderRadius: 18, border: '1px solid var(--card-border)',
  background: 'rgba(255,255,255,0.02)', marginBottom: 20,
};
const titleSt   = { margin: 0, color: 'var(--text-primary)', fontSize: 24, fontWeight: 700 };
const subtitleSt = { margin: '6px 0 0', color: 'var(--text-dim)', fontSize: 14 };
const meta       = { margin: '0 0 16px', color: 'var(--text-dim)', fontSize: 13 };
const grid       = { display: 'grid', gridTemplateColumns: '1fr', gap: 20 };
const card       = { padding: 18, borderRadius: 18, border: '1px solid var(--card-border)', background: 'rgba(255,255,255,0.02)', boxShadow: '0 6px 18px rgba(0,0,0,0.18)' };
const lbl        = { display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 600, color: 'var(--text-dim)' };
const sel        = { minWidth: 260, padding: '10px 12px', borderRadius: 12, border: '1px solid var(--ghost-border)', background: 'var(--ghost-bg)', color: 'var(--ghost-color)', fontSize: 14, fontWeight: 600 };
