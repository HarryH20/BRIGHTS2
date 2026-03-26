// frontend/src/graphs/AdminAlluvial.jsx
import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

export default function AdminAlluvial({
  // Optional: if parent already fetched the payload, pass it in
  figure: prefetchedFigure,
}) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);
  const [selectedTransition, setSelectedTransition] = useState("");

  useEffect(() => {
    // If parent prefetched the data, skip the self-fetch
    if (prefetchedFigure !== undefined) return;

    fetch("/api/visualizations/adminalluvial", {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => setFigure(fig))
      .catch((err) => setError(err.message));
  }, [prefetchedFigure]);

  const transitions = figure?.transitions ?? [];
  const figuresByTransition = figure?.figures ?? {};

  useEffect(() => {
    if (!selectedTransition && transitions.length > 0) {
      setSelectedTransition(transitions[0].key);
    }
  }, [transitions, selectedTransition]);

  const currentFigures = useMemo(() => {
    if (!selectedTransition) return [];
    return figuresByTransition[selectedTransition] ?? [];
  }, [figuresByTransition, selectedTransition]);

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>Could not load admin alluvial charts: {error}</p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading admin alluvial charts...</p>
      </div>
    );
  }

  if (!transitions.length) {
    return (
      <div style={styles.fallback}>
        <p style={styles.loadingText}>No alluvial chart data available.</p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.toolbar}>
        <label htmlFor="transition-select" style={styles.label}>
          Transition
        </label>
        <select
          id="transition-select"
          value={selectedTransition}
          onChange={(e) => setSelectedTransition(e.target.value)}
          style={styles.select}
        >
          {transitions.map((transition) => (
            <option key={transition.key} value={transition.key}>
              {transition.label}
            </option>
          ))}
        </select>
      </div>

      <div style={styles.metaRow}>
        <span style={styles.metaText}>
          Showing {currentFigures.length} chart{currentFigures.length === 1 ? "" : "s"}
        </span>
      </div>

      <div style={styles.grid}>
        {currentFigures.map((item) => {
          const chartLayout = {
            ...item.figure.layout,
            autosize: true,
            width: undefined,
            height: item.figure?.layout?.height ?? 650,
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
          };

          return (
            <div key={`${selectedTransition}-${item.q_num}`} style={styles.card}>
              <div style={styles.cardHeader}>
                <h3 style={styles.cardTitle}>{item.title || `Q${item.q_num}`}</h3>
                {item.construct ? (
                  <p style={styles.cardSubtitle}>{item.construct}</p>
                ) : null}
              </div>

              <Plot
                data={item.figure.data}
                layout={chartLayout}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ["lasso2d", "select2d"],
                }}
                style={{ width: "100%" }}
                useResizeHandler
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 18,
    width: "100%",
  },
  toolbar: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    flexWrap: "wrap",
  },
  label: {
    color: "#c8d6f0",
    fontSize: 14,
    fontWeight: 600,
  },
  select: {
    minWidth: 260,
    padding: "10px 12px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontSize: 14,
    fontWeight: 600,
    outline: "none",
  },
  metaRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metaText: {
    color: "#c8d6f0",
    fontSize: 13,
    opacity: 0.8,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 20,
  },
  card: {
    padding: 16,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "rgba(255,255,255,0.02)",
    overflowX: "auto",
  },
  cardHeader: {
    marginBottom: 10,
  },
  cardTitle: {
    margin: 0,
    color: "#e9eefc",
    fontSize: 18,
    fontWeight: 700,
  },
  cardSubtitle: {
    margin: "6px 0 0 0",
    color: "#c8d6f0",
    fontSize: 13,
    opacity: 0.8,
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