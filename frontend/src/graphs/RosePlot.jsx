import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function RosePlot({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If parent prefetched the data, skip the self-fetch
    if (prefetchedFigure !== undefined) return;
    fetch("/api/visualizations/roseplot", { credentials: "include" })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => setFigure(fig))
      .catch((err) => setError(err.message));
  }, []); // eslint-disable-line

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
};
