import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { ageDistributionToEcharts } from "../lib/plotlyToEcharts.js";

function AgePlotInner({ figure: prefetchedFigure }) {
  const [figure,  setFigure]  = useState(prefetchedFigure ?? null);
  const [loading, setLoading] = useState(prefetchedFigure === undefined);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure);
      setLoading(false);
      setError(null);
    }
  }, [prefetchedFigure]);

  useEffect(() => {
    if (prefetchedFigure !== undefined) return;
    setLoading(true);
    fetch("/api/admin/ageplot", { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig  => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load age distribution chart."))
      .finally(() => setLoading(false));
  }, [prefetchedFigure]);

  const option = figure ? ageDistributionToEcharts(figure) : null;

  const srRows = figure?.data?.[0]
    ? (figure.data[0].x || []).map((label, i) => ({ label, value: figure.data[0].y?.[i] ?? 0 }))
    : [];

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !option}
      height={380}
    >
      {option && (
        <>
          <ReactECharts
            option={option}
            opts={{ renderer: 'svg' }}
            style={{ height: 380, width: '100%' }}
            notMerge
          />
          <table className="sr-only">
            <caption>Age Distribution</caption>
            <thead><tr><th>Age Range</th><th>Count</th></tr></thead>
            <tbody>
              {srRows.map(r => (
                <tr key={r.label}><td>{r.label}</td><td>{r.value}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminChartWrapper>
  );
}

export default function AgePlot(props) {
  return (
    <AppErrorBoundary context="chart">
      <AgePlotInner {...props} />
    </AppErrorBoundary>
  );
}
