import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function RadarPlot({ goalIndex = 0 }) {
  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch(`/api/visualizations/radarplot?goal_index=${goalIndex}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => setFigure(fig))
      .catch((err) => setError(err.message));
  }, [goalIndex]);

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>Could not load radar plot: {error}</p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading radar plot...</p>
      </div>
    );
  }

  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    height: 500,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { t: 80, l: 40, r: 40, b: 60 },
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
    minHeight: 200,
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
};
