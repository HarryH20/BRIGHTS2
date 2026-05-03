import React, { useEffect, useState } from "react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { wordCloudToEcharts } from "../lib/plotlyToEcharts.js";

function LinguisticMarkersWordCloudInner({ figure: prefetchedFigure }) {
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
    fetch("/api/admin/linguisticmarkerswordcloud", { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(fig  => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load word cloud."))
      .finally(() => setLoading(false));
  }, [prefetchedFigure]);

  const result = figure ? wordCloudToEcharts(figure) : null;

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !result}
      height={420}
    >
      {result?._isImage && (
        <div>
          {result.subtitle && (
            <p style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--text-dim)', textAlign: 'center' }}>
              {result.subtitle}
            </p>
          )}
          <img
            src={result.imageSource}
            alt="Word cloud comparing high-progress and low-progress reflections"
            style={{ width: '100%', borderRadius: 10, display: 'block' }}
          />
        </div>
      )}
    </AdminChartWrapper>
  );
}

export default function LinguisticMarkersWordCloud(props) {
  return (
    <AppErrorBoundary context="chart">
      <LinguisticMarkersWordCloudInner {...props} />
    </AppErrorBoundary>
  );
}
