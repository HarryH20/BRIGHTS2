import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { countsDemographicsToEcharts } from "../lib/plotlyToEcharts.js";

const DEMO_OPTIONS = [
  "Gender", "Age", "Race/Ethnicity", "Marital Status",
  "Education", "Employment Status", "Annual Income",
  "Socioeconomic Status", "Religion", "Political Affiliation",
];

function AdminCountsDemographicsInner({ figure: prefetchedFigure, initialDemoLabel = "Gender" }) {
  const [demoLabel, setDemoLabel] = useState(initialDemoLabel);
  const [figure,    setFigure]    = useState(prefetchedFigure ?? null);
  const [loading,   setLoading]   = useState(prefetchedFigure == null);
  const [error,     setError]     = useState(null);

  useEffect(() => {
    if (prefetchedFigure != null) {
      setFigure(prefetchedFigure);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/admin/counts-demographics?demo_label=${encodeURIComponent(demoLabel)}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig  => { setFigure(fig); setLoading(false); })
      .catch(err => { if (err.name === "AbortError") return; setError(err.message); setLoading(false); });

    return () => controller.abort();
  }, [demoLabel, prefetchedFigure]);

  const option = figure ? countsDemographicsToEcharts(figure) : null;

  const filterSlot = (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' }}>
      Demographic Category:
      <select
        value={demoLabel}
        onChange={e => setDemoLabel(e.target.value)}
        style={sel}
      >
        {DEMO_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
      </select>
    </label>
  );

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !option}
      filterSlot={filterSlot}
      height={380}
    >
      {option && (
        <ReactECharts
          option={option}
          opts={{ renderer: 'svg' }}
          style={{ height: 380, width: '100%' }}
          notMerge
        />
      )}
    </AdminChartWrapper>
  );
}

export default function AdminCountsDemographics(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminCountsDemographicsInner {...props} />
    </AppErrorBoundary>
  );
}

const sel = {
  background: 'var(--input-bg)',
  border: '1px solid var(--input-border)',
  color: 'var(--text-primary)',
  borderRadius: 8,
  padding: '6px 10px',
  fontSize: 13,
};
