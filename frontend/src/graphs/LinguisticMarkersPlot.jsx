import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function LinguisticMarkersPlot({
  figure: prefetchedFigure,
}) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [loading, setLoading] = useState(prefetchedFigure === undefined);
  const [error, setError] = useState("");

  useEffect(() => {
    if (prefetchedFigure !== undefined) {
      setFigure(prefetchedFigure);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function loadFigure() {
      try {
        setLoading(true);
        setError("");

        const response = await fetch("/api/admin/linguisticmarkersplot", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load linguistic markers plot");
        }

        if (!cancelled) {
          setFigure(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load linguistic markers plot");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadFigure();

    return () => {
      cancelled = true;
    };
  }, [prefetchedFigure]);

  if (loading) {
    return (
      <div style={styles.fallback}>
        <p style={styles.loadingText}>Loading linguistic markers plot...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>
          Could not load linguistic markers plot: {error}
        </p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <p style={styles.loadingText}>No linguistic markers plot data available.</p>
      </div>
    );
  }

  const layout = {
    ...figure.layout,
    autosize: true,
    width: undefined,
    height: figure?.layout?.height ?? 700,
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: figure?.layout?.margin ?? { t: 90, l: 220, r: 80, b: 60 },
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
    minHeight: 220,
    gap: 12,
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