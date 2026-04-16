// frontend/src/graphs/LinguisticMarkersWordCloud.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function LinguisticMarkersWordCloud({
  // Optional: if parent already fetched the figure, pass it in
  figure: prefetchedFigure,
}) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // If parent prefetched the data, skip the self-fetch
    if (prefetchedFigure !== undefined) return;

    fetch("/api/admin/linguisticmarkerswordcloud", {
      credentials: "include",
    })
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
        <p style={styles.errorText}>
          Could not load linguistic markers word cloud: {error}
        </p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>
          Loading linguistic markers word cloud...
        </p>
      </div>
    );
  }

  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    height: figure?.layout?.height ?? 620,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: figure?.layout?.margin ?? { t: 80, l: 0, r: 0, b: 0 },
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
    minHeight: 220,
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