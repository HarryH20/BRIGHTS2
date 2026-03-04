import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function RosePlot({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);

  // ✅ If parent passes a new figure (filters changed), update the plot
  useEffect(() => {
    setFigure(prefetchedFigure ?? null);
    setError(null);
  }, [prefetchedFigure]);

  // ✅ Only self-fetch when parent did NOT provide a figure prop at all
  useEffect(() => {
    if (prefetchedFigure !== undefined) return;

    fetch("/api/visualizations/roseplot", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => setFigure(fig))
      .catch((err) => setError(err.message));
  }, [prefetchedFigure]);

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>Could not load rose plot: {error}</p>
        <p style={styles.hint}>Make sure the Flask backend is running on port 5000.</p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading rose plot...</p>
      </div>
    );
  }

  // No data — show a clean prompt instead of a blank Plotly grid
  if (!figure.data || figure.data.length === 0) {
    return (
      <div style={styles.fallback}>
        <p style={styles.noDataTitle}>No survey data yet</p>
        <p style={styles.noDataHint}>
          Complete your Week 2 survey to start seeing your goal progression here.
        </p>
      </div>
    );
  }

  // Override layout to fit our dark theme container
  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    height: 2000,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { t: 100, l: 40, r: 40, b: 40 },
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
      style={{ width: "100%", minHeight: 800 }}
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
    minHeight: 300,
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
  },
  hint: {
    color: "#c8d6f0",
    fontSize: 13,
    opacity: 0.7,
  },
  noDataTitle: {
    color: "#c8d6f0",
    fontSize: 16,
    fontWeight: 700,
    margin: 0,
  },
  noDataHint: {
    color: "#c8d6f0",
    fontSize: 13,
    opacity: 0.6,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 1.5,
    margin: 0,
  },
};