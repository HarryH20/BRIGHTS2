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
      title="Reflection Word Patterns"
      subtitle="Distinctive words from participant weekly reflections"
      height={420}
    >
      {result?._isImage && (
        <div>
          <div style={{ marginBottom: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)', marginBottom: 2 }}>
                Reflection Word Patterns
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-dim)' }}>
                Words used by high-progress participants (green) vs low-progress participants (red)
              </div>
            </div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', fontSize: 11 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#2ecc71', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-dim)' }}>High progress</span>
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 10, height: 10, borderRadius: 2, background: '#e74c3c', display: 'inline-block' }} />
                <span style={{ color: 'var(--text-dim)' }}>Low progress</span>
              </span>
            </div>
          </div>
          <img
            src={result.imageSource}
            alt="Word cloud comparing high-progress and low-progress reflections"
            style={{ width: '100%', borderRadius: 10, display: 'block' }}
          />
          {result.subtitle && (
            <p style={{ marginTop: 8, fontSize: 11, color: 'var(--text-dim)', textAlign: 'center', fontStyle: 'italic' }}>
              {result.subtitle}
            </p>
          )}
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
