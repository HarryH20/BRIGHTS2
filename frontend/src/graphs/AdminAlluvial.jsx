import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

export default function AdminAlluvial({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [loading, setLoading] = useState(prefetchedFigure === undefined);
  const [error, setError] = useState("");
  const [selectedTransition, setSelectedTransition] = useState("");

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

        const response = await fetch("/api/admin/alluvial", {
          credentials: "include",
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || "Failed to load admin alluvial charts");
        }

        if (!cancelled) {
          setFigure(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || "Failed to load admin alluvial charts");
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

  const transitions = figure?.transitions ?? [];
  const figuresByTransition = figure?.figures ?? {};

  useEffect(() => {
    if (!selectedTransition && transitions.length > 0) {
      setSelectedTransition(transitions[0].key);
    }
  }, [transitions, selectedTransition]);

  const currentFigures = useMemo(() => {
    if (!selectedTransition) {
      return [];
    }
    return figuresByTransition[selectedTransition] ?? [];
  }, [figuresByTransition, selectedTransition]);

  if (loading) {
    return <div style={styles.stateBox}>Loading admin alluvial charts...</div>;
  }

  if (error) {
    return <div style={styles.errorBox}>{error}</div>;
  }

  if (!figure || !transitions.length) {
    return <div style={styles.stateBox}>No admin alluvial chart data available.</div>;
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>Alluvial Chart</h2>
          <p style={styles.subtitle}>
            Compare response flow across transitions.
          </p>
        </div>

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
            font: {
              ...(item.figure?.layout?.font || {}),
              color: "#c8d6f0",
            },
            title: {
              ...(item.figure?.layout?.title || {}),
              font: {
                ...((item.figure?.layout?.title && item.figure.layout.title.font) || {}),
                color: "#e9eefc",
              },
            },
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
                data={item.figure?.data || []}
                layout={chartLayout}
                config={{
                  responsive: true,
                  displayModeBar: true,
                  displaylogo: false,
                  modeBarButtonsToRemove: ["lasso2d", "select2d"],
                }}
                style={{ width: "100%", minHeight: "650px" }}
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
    gap: 20,
    width: "100%",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-end",
    gap: 16,
    flexWrap: "wrap",
    padding: "18px 20px",
    borderRadius: 18,
    border: "1px solid var(--card-border)",
    background: "rgba(255,255,255,0.02)",
  },
  title: {
    margin: 0,
    color: "#e9eefc",
    fontSize: 24,
    fontWeight: 700,
  },
  subtitle: {
    margin: "6px 0 0 0",
    color: "#c8d6f0",
    fontSize: 14,
    opacity: 0.85,
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
    padding: 18,
    borderRadius: 18,
    border: "1px solid var(--card-border)",
    background: "rgba(255,255,255,0.02)",
    overflowX: "auto",
    boxShadow: "0 6px 18px rgba(0,0,0,0.18)",
  },
  cardHeader: {
    marginBottom: 12,
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
  stateBox: {
    padding: 20,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "rgba(255,255,255,0.02)",
    color: "#c8d6f0",
    fontSize: 14,
  },
  errorBox: {
    padding: 20,
    borderRadius: 16,
    border: "1px solid rgba(255,120,120,0.35)",
    background: "rgba(255,120,120,0.08)",
    color: "#ff9b9b",
    fontSize: 14,
    fontWeight: 600,
  },
};