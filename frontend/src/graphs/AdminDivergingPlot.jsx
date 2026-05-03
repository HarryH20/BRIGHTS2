import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { divergingBarToEcharts } from "../lib/plotlyToEcharts.js";

function AdminDivergingPlotInner({ figure: prefetchedFigure }) {
  const [figure,  setFigure]  = useState(prefetchedFigure ?? null);
  const [loading, setLoading] = useState(prefetchedFigure === undefined);
  const [error,   setError]   = useState(null);

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure ?? null);
      setLoading(false);
      setError(null);
    }
  }, [prefetchedFigure]);

  useEffect(() => {
    if (prefetchedFigure !== undefined) return;
    setLoading(true);
    fetch("/api/admin/divergingstackedbarchart", { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig  => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load goal progress chart."))
      .finally(() => setLoading(false));
  }, [prefetchedFigure]);

  const option = figure ? divergingBarToEcharts(figure) : null;
  const totalH = option?._totalHeight ?? (figure?.layout?.height ?? 600);

  // Strip custom meta before passing to ECharts
  const echartsOption = option ? (({ _totalHeight, ...rest }) => rest)(option) : null;

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !echartsOption}
      height={totalH}
    >
      {echartsOption && (
        <ReactECharts
          option={echartsOption}
          opts={{ renderer: 'svg' }}
          style={{ height: totalH, width: '100%' }}
          notMerge
        />
      )}
    </AdminChartWrapper>
  );
}

export default function AdminDivergingPlot(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminDivergingPlotInner {...props} />
    </AppErrorBoundary>
  );
}
