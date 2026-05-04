import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";

const Q_LABELS = {
  1: "Centrality (Current)", 2: "Centrality (Ideal)", 3: "Centrality (Ought)",
  4: "Values", 5: "Patience 1", 6: "Patience 2", 7: "Patience 3",
  8: "Patience 4", 9: "Patience 5", 10: "Patience 6",
  11: "Goal Meaning 1", 12: "Goal Meaning 2", 13: "Goal Meaning 3",
  14: "External Motivation", 15: "Introjected Motivation",
  16: "Integrated Motivation", 17: "Intrinsic Motivation",
  18: "Integrative Reg. 1", 19: "Integrative Reg. 2",
  20: "Suppressive Reg. 1", 21: "Suppressive Reg. 2", 22: "Suppressive Reg. 3",
  23: "Goal Identity 1", 24: "Goal Identity 2", 25: "Goal Identity 3",
  26: "Self-Worth Up 1", 27: "Self-Worth Up 2", 28: "Self-Worth Up 3",
  29: "Self-Worth Up 4", 30: "Self-Worth Down 1", 31: "Self-Worth Down 2",
  32: "Self-Worth Down 3", 33: "Self-Worth Down 4",
  34: "Courage 1", 35: "Courage 2", 36: "Courage 3", 37: "Courage 4", 38: "Courage 5",
  39: "Goal Progress 1", 40: "Goal Progress 2", 41: "Goal Progress 3",
  42: "Human Accountability", 43: "Transcendent Accountability",
};

const CONSTRUCT_LABELS = [
  "Centrality", "Values", "Goals-Based Patience", "Goal Meaning",
  "External Motivation", "Introjected Motivation", "Integrated Motivation",
  "Intrinsic Motivation", "Integrative Emotion Reg.", "Suppressive Emotion Reg.",
  "Goal Identity", "Self-Worth (Up)", "Self-Worth (Down)", "Goals-Based Courage",
  "Goal Progress", "Human Accountability", "Transcendent Accountability",
];

const CONSTRUCT_Q_NUMS = [
  [1,2,3], [4], [5,6,7,8,9,10], [11,12,13], [14], [15], [16], [17],
  [18,19], [20,21,22], [23,24,25], [26,27,28,29], [30,31,32,33],
  [34,35,36,37,38], [39,40,41], [42], [43],
];

function buildEChartsOption({ traj, q25, q50, q75, label, t_labels }) {
  const T = t_labels || ["Week 1","Week 2","Week 3","Week 4","Week 5","Week 6"];
  const T_SHORT = T.map(l => l.replace("Week ", "W"));

  const textColor  = "#e9eefc";
  const dimColor   = "rgba(200,214,240,0.55)";
  const gridColor  = "rgba(255,255,255,0.05)";
  const bandColor  = "rgba(200,214,240,0.12)";
  const medColor   = "rgba(200,214,240,0.45)";
  const lineColor  = "#7b9ef9";
  const tooltipBg  = "rgba(16,25,42,0.95)";
  const tooltipBdr = "rgba(155,183,255,0.16)";

  // IQR band via stacking: floor (transparent) + height (visible)
  const q25Safe    = q25.map(v => v ?? null);
  const bandHeight = q75.map((v, i) =>
    v !== null && q25[i] !== null ? +(v - q25[i]).toFixed(4) : null
  );

  return {
    animation: false,
    backgroundColor: "transparent",
    grid: { top: 50, bottom: 56, left: 50, right: 20 },
    xAxis: {
      type: "category",
      data: T_SHORT,
      axisLabel: { color: dimColor, fontSize: 11 },
      axisLine:  { lineStyle: { color: gridColor } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      min: 1, max: 7, interval: 1,
      axisLabel: { color: dimColor, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine:  { lineStyle: { color: gridColor } },
    },
    legend: {
      data: ["Peer IQR", "Peer Median", "You"],
      bottom: 4, left: "center",
      textStyle: { color: textColor, fontSize: 10 },
      itemWidth: 14, itemHeight: 8,
    },
    series: [
      // Band floor — invisible, establishes the stack baseline
      {
        type: "line", name: "_iqr_floor",
        data: q25Safe,
        stack: "iqr",
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { opacity: 0 },
        connectNulls: false,
        legendHoverLink: false,
        showInLegend: false,
        silent: true,
      },
      // Band fill (q75 - q25 stacked on top of q25)
      {
        type: "line", name: "Peer IQR",
        data: bandHeight,
        stack: "iqr",
        symbol: "none",
        lineStyle: { opacity: 0 },
        areaStyle: { color: bandColor, opacity: 1 },
        connectNulls: false,
        emphasis: { disabled: true },
      },
      // Peer median dotted line
      {
        type: "line", name: "Peer Median",
        data: q50,
        symbol: "none",
        lineStyle: { color: medColor, width: 1.5, type: "dashed" },
        connectNulls: true,
        emphasis: { disabled: true },
      },
      // User trajectory
      {
        type: "line", name: "You",
        data: traj,
        lineStyle:  { color: lineColor, width: 2.5 },
        itemStyle:  { color: lineColor },
        symbolSize: 6,
        connectNulls: false,
      },
    ],
    tooltip: {
      trigger: "axis",
      backgroundColor: tooltipBg,
      borderColor: tooltipBdr,
      textStyle: { color: textColor },
      formatter(params) {
        const weekLabel = params[0]?.axisValueLabel || "";
        const lines = [`<b>${weekLabel}</b>`];
        for (const p of params) {
          if (p.seriesName.startsWith("_") || p.value === null || p.value === undefined) continue;
          lines.push(`${p.marker}${p.seriesName}: <b>${Number(p.value).toFixed(2)}</b>`);
        }
        return lines.join("<br/>");
      },
    },
  };
}

function GoalTrajectorySparklinesInner({ goals = [] }) {
  const [data,               setData]               = useState(null);
  const [error,              setError]              = useState(null);
  const [loading,            setLoading]            = useState(true);
  const [useConstructs,      setUseConstructs]      = useState(false);
  const [goalIndex,          setGoalIndex]          = useState(0);
  const [itemIndex,          setItemIndex]          = useState(0);
  const [availableQuestions, setAvailableQuestions] = useState([]);

  // Fetch available questions when goal changes
  useEffect(() => {
    fetch(
      `/api/visualizations/goal_trajectory_available?goal_index=${goalIndex}`,
      { credentials: "include" }
    )
      .then(r => r.json())
      .then(d => {
        setAvailableQuestions(d.available_questions ?? []);
        setItemIndex(0);
      })
      .catch(() => setAvailableQuestions([]));
  }, [goalIndex]);

  // Fetch trajectory data when params change
  useEffect(() => {
    setData(null); setError(null); setLoading(true);
    fetch(
      `/api/visualizations/goal_trajectory_sparklines?goal_index=${goalIndex}&use_constructs=${useConstructs}&item_index=${itemIndex}`,
      { credentials: "include" }
    )
      .then(r => { if (!r.ok) throw new Error(`Server error: ${r.status}`); return r.json(); })
      .then(d => { setData(d); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, [goalIndex, useConstructs, itemIndex]);

  // Filter dropdown options to questions/constructs that have data
  const itemOptions = useConstructs
    ? CONSTRUCT_LABELS
        .map((lbl, i) => ({ label: lbl, value: i }))
        .filter(opt => CONSTRUCT_Q_NUMS[opt.value].some(q => availableQuestions.includes(q)))
    : Object.entries(Q_LABELS)
        .map(([q, lbl]) => ({ label: `Q${q}: ${lbl}`, value: Number(q) - 1 }))
        .filter(opt => availableQuestions.includes(opt.value + 1));

  // Auto-select first available item when options change
  useEffect(() => {
    if (itemOptions.length > 0 && !itemOptions.find(o => o.value === itemIndex)) {
      setItemIndex(itemOptions[0].value);
    }
  }, [itemOptions]); // eslint-disable-line

  if (error) {
    return (
      <div style={s.fallback}>
        <p style={s.errorText}>Could not load goal trajectories: {error}</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={s.fallback}>
        <div style={s.spinner} />
        <p style={s.dimText}>Loading goal trajectories…</p>
      </div>
    );
  }

  if (!data || data.empty || !data.traj) {
    return (
      <div style={s.fallback}>
        <p style={s.dimText}>
          No trajectory data yet — complete your first survey to see your progress here.
        </p>
      </div>
    );
  }

  const option = buildEChartsOption(data);

  return (
    <div style={s.wrapper}>
      {/* Toolbar */}
      <div style={s.toolbar}>
        {goals.length > 1 && (
          <label style={s.lbl}>
            Goal
            <select
              value={goalIndex}
              onChange={e => { setGoalIndex(Number(e.target.value)); setItemIndex(0); }}
              style={s.sel}
            >
              {goals.map((g, idx) => (
                <option key={idx} value={idx}>
                  Goal {idx + 1}: {g.text.length > 40 ? g.text.slice(0, 40) + "…" : g.text}
                </option>
              ))}
            </select>
          </label>
        )}

        <label style={s.lbl}>
          View
          <select
            value={useConstructs ? "constructs" : "questions"}
            onChange={e => { setUseConstructs(e.target.value === "constructs"); setItemIndex(0); }}
            style={s.sel}
          >
            <option value="questions">Individual Questions</option>
            <option value="constructs">Constructs</option>
          </select>
        </label>

        <label style={s.lbl}>
          {useConstructs ? "Construct" : "Question"}
          <select
            value={itemIndex}
            onChange={e => setItemIndex(Number(e.target.value))}
            style={{ ...s.sel, minWidth: 260 }}
          >
            {itemOptions.length > 0
              ? itemOptions.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))
              : <option value={0}>No data available</option>
            }
          </select>
        </label>
      </div>

      {/* Chart */}
      <ReactECharts
        option={option}
        opts={{ renderer: "svg" }}
        style={{ width: "100%", height: 320 }}
        notMerge
      />
    </div>
  );
}

export default function GoalTrajectorySparklines(props) {
  return (
    <AppErrorBoundary context="chart">
      <GoalTrajectorySparklinesInner {...props} />
    </AppErrorBoundary>
  );
}

const s = {
  wrapper: { display: "flex", flexDirection: "column", gap: 10, width: "100%" },
  toolbar: { display: "flex", alignItems: "flex-end", gap: 12, flexWrap: "wrap" },
  lbl: {
    display: "flex", flexDirection: "column", gap: 5,
    fontSize: 12, fontWeight: 700, color: "var(--text-dim)",
  },
  sel: {
    minWidth: 160, padding: "9px 11px", borderRadius: 10,
    border: "1px solid var(--ghost-border)", background: "var(--ghost-bg)",
    color: "var(--ghost-color)", fontSize: 13, fontWeight: 600, outline: "none",
  },
  fallback: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    minHeight: 180, gap: 12, padding: 16,
  },
  spinner: {
    width: 32, height: 32,
    border: "3px solid rgba(79,124,255,0.2)",
    borderTop: "3px solid #4f7cff",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
  },
  dimText:   { color: "var(--text-dim)", fontSize: 13, textAlign: "center", maxWidth: 320, lineHeight: 1.5, margin: 0 },
  errorText: { color: "var(--error-color)", fontSize: 13, fontWeight: 600, margin: 0 },
};
