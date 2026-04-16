import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

export default function AdminCountsDemographics({
  figure: prefetchedFigure,
  initialDemoLabel = "Gender",
}) {
  const [demoLabel, setDemoLabel] = useState(initialDemoLabel);
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(prefetchedFigure == null);

  useEffect(() => {
    if (prefetchedFigure != null) {
      setFigure(prefetchedFigure);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const qs = new URLSearchParams({
      demo_label: demoLabel,
    }).toString();

    fetch(`/api/admin/counts-demographics?${qs}`, {
      credentials: "include",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => {
        setFigure(fig);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err.message);
        setLoading(false);
      });

    return () => controller.abort();
  }, [demoLabel, prefetchedFigure]);

  const layout = {
    ...(figure?.layout ?? {}),
    autosize: true,
    width: undefined,
    paper_bgcolor: figure?.layout?.paper_bgcolor ?? "rgba(0,0,0,0)",
    plot_bgcolor: figure?.layout?.plot_bgcolor ?? "rgba(0,0,0,0)",
  };

  return (
    <div style={styles.wrapper}>
      {error ? (
        <div style={styles.fallback}>
          <p style={styles.errorText}>
            Could not load demographic counts chart: {error}
          </p>
        </div>
      ) : loading || !figure ? (
        <div style={styles.fallback}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading demographic counts chart...</p>
        </div>
      ) : (
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
      )}
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
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