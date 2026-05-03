import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { linguisticMarkersToEcharts } from "../lib/plotlyToEcharts.js";

function LinguisticMarkersPlotInner({ figure: prefetchedFigure }) {
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
    fetch("/api/admin/linguisticmarkersplot", { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig  => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load linguistic markers chart."))
      .finally(() => setLoading(false));
  }, [prefetchedFigure]);

  const option = figure ? linguisticMarkersToEcharts(figure) : null;

  const trace  = figure?.data?.[0];
  const srRows = trace?.x
    ? (trace.x || []).map((coef, i) => ({ feature: trace.y?.[i] ?? i, coef }))
    : [];

  const chartH = Math.max(400, (srRows.length || 10) * 22 + 120);

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !option}
      title="Words Associated with Goal Progress"
      subtitle="Linguistic markers from participant weekly reflections"
      height={chartH}
    >
      {option && (
        <>
          <ReactECharts
            option={option}
            opts={{ renderer: 'svg' }}
            style={{ height: chartH, width: '100%' }}
            notMerge
          />
          <table className="sr-only">
            <caption>Linguistic Markers — Logistic Regression Coefficients</caption>
            <thead><tr><th>Feature</th><th>Coefficient</th></tr></thead>
            <tbody>
              {srRows.map((r, i) => (
                <tr key={i}><td>{r.feature}</td><td>{Number(r.coef).toFixed(4)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminChartWrapper>
  );
}

export default function LinguisticMarkersPlot(props) {
  return (
    <AppErrorBoundary context="chart">
      <LinguisticMarkersPlotInner {...props} />
    </AppErrorBoundary>
  );
}
