import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import { BarChart2 } from "lucide-react";
import { rosePlotToEcharts } from "../lib/plotlyToEcharts.js";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";

export default function RosePlot({ figure: prefetchedFigure }) {
  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);
  const [tooltipVisible, setTooltipVisible] = useState(false);

  useEffect(() => {
    setFigure(prefetchedFigure ?? null);
    setError(null);
  }, [prefetchedFigure]);

  useEffect(() => {
    if (prefetchedFigure !== undefined) return;
    fetch("/api/visualizations/roseplot", { credentials: "include" })
      .then(res => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then(fig => { setFigure(fig); setError(null); })
      .catch(err => setError(err.message || "Failed to load rose plot."));
  }, [prefetchedFigure]);

  const option = figure ? rosePlotToEcharts(figure) : null;
  const tableData = rosePlotToEcharts._lastTableData;

  if (error) {
    return (
      <div style={s.container}>
        <p style={s.errorText}>Could not load chart: {error}</p>
      </div>
    );
  }

  return (
    <AppErrorBoundary context="chart">
      <div style={s.container}>
        {/* Chart header */}
        <div style={s.header}>
          <div>
            <div style={s.title}>Weekly Goal Progress</div>
            <div style={s.subtitle}>Each petal = one goal × one week. Longer petals = higher scores (scale 1–7). Colors distinguish your three goals.</div>
          </div>
          <div style={s.infoWrap}>
            <button
              type="button"
              style={s.infoBtn}
              aria-label="Chart information"
              onMouseEnter={() => setTooltipVisible(true)}
              onMouseLeave={() => setTooltipVisible(false)}
              onFocus={() => setTooltipVisible(true)}
              onBlur={() => setTooltipVisible(false)}
            >
              ⓘ
            </button>
            {tooltipVisible && (
              <div style={s.tooltip} role="tooltip">
                Scores reflect how much progress, confidence, and importance you felt toward each goal that week. All three measures are averaged into one score.
              </div>
            )}
          </div>
        </div>

        {!option ? (
          <div style={s.emptyState}>
            <BarChart2 size={36} style={{ opacity: 0.3, marginBottom: 12 }} />
            <div style={s.emptyTitle}>No chart data yet</div>
            <p style={s.emptyHint}>
              Complete your weekly surveys to see your progress visualized here.
            </p>
          </div>
        ) : (
          <>
            <ReactECharts
              option={option}
              style={{ width: "100%", height: "380px" }}
              opts={{ renderer: "svg" }}
            />

            {/* Screen-reader data table fallback */}
            {tableData && (
              <table className="sr-only" aria-label="Goal progress data table">
                <thead>
                  <tr>
                    <th scope="col">Week</th>
                    {tableData.questions.map(q => (
                      <th key={q} scope="col">{q}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {tableData.weeks.map(w => (
                    <tr key={w}>
                      <th scope="row">Week {w}</th>
                      {tableData.questions.map(q => {
                        const cell = tableData.panelData.find(d => d.week === w && d.question === q);
                        return <td key={q}>{cell ? `${cell.score} / 7` : "—"}</td>;
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </>
        )}
      </div>
    </AppErrorBoundary>
  );
}

const s = {
  container: {
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    padding: 16,
  },
  header: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 4,
  },
  title: {
    fontWeight: 800,
    fontSize: 15,
    color: "var(--text-primary)",
    marginBottom: 2,
  },
  subtitle: {
    fontSize: 12,
    color: "var(--text-dim)",
    lineHeight: 1.4,
  },
  infoWrap: {
    position: "relative",
    flexShrink: 0,
  },
  infoBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--text-dim)",
    fontSize: 16,
    padding: "2px 4px",
    lineHeight: 1,
  },
  tooltip: {
    position: "absolute",
    top: "calc(100% + 6px)",
    right: 0,
    width: 240,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    backdropFilter: "blur(8px)",
    color: "var(--text-primary)",
    fontSize: 12,
    lineHeight: 1.5,
    zIndex: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
  },
  emptyState: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 260,
    color: "var(--text-dim)",
    textAlign: "center",
    padding: 24,
  },
  emptyTitle: {
    fontWeight: 700,
    fontSize: 15,
    marginBottom: 8,
    color: "var(--text-primary)",
  },
  emptyHint: {
    fontSize: 13,
    lineHeight: 1.55,
    maxWidth: 280,
    margin: 0,
    opacity: 0.65,
  },
  errorText: {
    color: "var(--error-color)",
    fontSize: 14,
    margin: 0,
  },
};
