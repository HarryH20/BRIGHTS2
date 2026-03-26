// frontend/src/graphs/AgePlot.jsx
import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function AgePlot({
  participantId = null,
  goalId = null,
  binSize = 5,
  minAge = 0,
  maxAge = 100,
  figure: prefetchedFigure,
}) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure);
      return;
    }

    let cancelled = false;

    async function loadFigure() {
      try {
        setError(null);

        const params = new URLSearchParams();
        params.set("bin_size", String(binSize));
        params.set("min_age", String(minAge));
        params.set("max_age", String(maxAge));

        if (participantId) params.set("participant_id", participantId);
        if (goalId) params.set("goal_id", goalId);

        const res = await fetch(`/api/admin/ageplot?${params.toString()}`, {
          credentials: "include",
        });

        const fig = await res.json();

        if (!res.ok) {
          throw new Error(fig.error || `Server error: ${res.status}`);
        }

        if (!cancelled) {
          setFigure(fig);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load age distribution");
        }
      }
    }

    loadFigure();

    return () => {
      cancelled = true;
    };
  }, [participantId, goalId, binSize, minAge, maxAge, prefetchedFigure]);

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>Could not load age distribution: {error}</p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading age distribution...</p>
      </div>
    );
  }

  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    height: 450,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { t: 80, l: 80, r: 80, b: 100 },
  };

  return (
    <Plot
      data={figure.data || []}
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