// frontend/src/graphs/SoloDivergingStackedBarChart.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function SoloDivergingStackedBarChart({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If parent prefetched the data, skip the self-fetch
    if (prefetchedFigure !== undefined) return;

    fetch(`/api/visualizations/solodivergingstackedbarchart`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        // Your python may return {"error": "..."} on empty state
        if (payload && payload.error) throw new Error(payload.error);
        setFigure(payload);
      })
      .catch((err) => setError(err.message));
  }, []); // eslint-disable-line

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>Could not load diverging bar chart: {error}</p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading diverging bar chart...</p>
      </div>
    );
  }

  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    // keep tall; clamp so it doesn't explode the page
    height: Math.min(Math.max(figure.layout?.height ?? 1200, 900), 1600),
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: figure.layout?.margin ?? { t: 120, l: 260, r: 260, b: 130 },
  };

  return (
    <Plot
      data={figure.data}
      layout={layout}
      config={{
        responsive: true,
        displayModeBar: true,
        displaylogo: false,
        modeBarButtonsToRemove: ["lasso2d", "select2d"],
      }}
      style={{ width: "100%" }}
      useResizeHandler
    />
  );
}

const styles = {
  fallback: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 240,
    gap: 12,
  },
  spinner: {
    width: 36,
    height: 36,
    border: "3px solid rgba(79,124,255,0.2)",
    borderTop: "3px solid #4f7cff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  loadingText: {
    color: "#c8d6f0",
    fontSize: 14,
    opacity: 0.8,
  },
  errorText: {
    color: "#ff8a8a",
    fontSize: 14,
    fontWeight: 600,
    textAlign: "center",
    maxWidth: 720,
  },
};