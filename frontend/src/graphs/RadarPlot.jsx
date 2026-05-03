import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { radarPlotToEcharts } from "../lib/plotlyToEcharts.js";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";

export default function RadarPlot({ goalIndex = 0, figure: prefetchedFigure, showHelper = false }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);
  const [helperVisible, setHelperVisible] = useState(false);

  useEffect(() => {
    // If parent prefetched the data, skip the self-fetch
    if (prefetchedFigure !== undefined) return;
    fetch(`/api/visualizations/radarplot?goal_index=${goalIndex}`, {
      credentials: "include",
    })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(fig => setFigure(fig))
      .catch(err => setError(err.message));
  }, [goalIndex]); // eslint-disable-line

  const option = figure ? radarPlotToEcharts(figure) : null;
  const tableData = radarPlotToEcharts._lastTableData;

  if (error) {
    return (
      <div style={s.fallback}>
        <p style={s.errorText}>Could not load radar plot: {error}</p>
      </div>
    );
  }

  if (!option) {
    return (
      <div style={s.fallback}>
        <p style={s.emptyText}>Survey data will appear here after Week 2.</p>
      </div>
    );
  }

  return (
    <AppErrorBoundary context="chart">
      {showHelper && (
        <div style={{ position: "relative", display: "flex", justifyContent: "flex-end", padding: "6px 8px 0" }}>
          <button
            type="button"
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-dim)", fontSize: 16, padding: "2px 4px", lineHeight: 1 }}
            aria-label="Chart information"
            onMouseEnter={() => setHelperVisible(true)}
            onMouseLeave={() => setHelperVisible(false)}
            onFocus={() => setHelperVisible(true)}
            onBlur={() => setHelperVisible(false)}
          >
            ⓘ
          </button>
          {helperVisible && (
            <div style={{ position: "absolute", top: "calc(100% + 6px)", right: 0, width: 220, padding: "10px 12px", borderRadius: 10, border: "1px solid var(--card-border)", background: "var(--card-bg)", backdropFilter: "blur(8px)", color: "var(--text-primary)", fontSize: 12, lineHeight: 1.5, zIndex: 10, boxShadow: "0 8px 24px rgba(0,0,0,0.35)" }}>
              This radar chart shows your goal profile across three dimensions (Progress, Confidence, Importance). Larger filled area = stronger overall engagement over time.
            </div>
          )}
        </div>
      )}
      <ReactECharts
        option={option}
        style={{ width: "100%", height: "260px" }}
        opts={{ renderer: "svg" }}
      />

      {/* Screen-reader data table fallback */}
      {tableData && (
        <table className="sr-only" aria-label="Radar chart data table">
          <thead>
            <tr>
              <th scope="col">Timepoint</th>
              {tableData.traitNames.map(t => (
                <th key={t} scope="col">{t}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {tableData.seriesData.map(row => (
              <tr key={row.name}>
                <th scope="row">{row.name}</th>
                {row.value.map((v, i) => (
                  <td key={i}>{v > 0 ? v.toFixed(2) : "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AppErrorBoundary>
  );
}

const s = {
  fallback: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 160,
    gap: 8,
    padding: 16,
  },
  emptyText: {
    color: "var(--text-dim)",
    fontSize: 13,
    textAlign: "center",
    maxWidth: 220,
    lineHeight: 1.5,
    margin: 0,
    opacity: 0.7,
  },
  errorText: {
    color: "var(--error-color)",
    fontSize: 13,
    fontWeight: 600,
    margin: 0,
  },
};
