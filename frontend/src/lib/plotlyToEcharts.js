/**
 * Adapter functions that convert Plotly figure dicts (as returned by the backend)
 * into ECharts option objects. The backend is never modified — only the rendering changes.
 *
 * Both functions return null when the figure has no meaningful data so the caller
 * can render an empty state instead of crashing.
 */
import 'echarts-wordcloud';

const OKABE_ITO = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stripHtml(str) {
  return (str || '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#9650;/g, '▲')
    .replace(/&#9654;/g, '▶')
    .replace(/&#9660;/g, '▼')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .trim();
}

/**
 * rosePlotToEcharts — converts the multi-subplot barpolar figure from roseplot.py.
 *
 * The backend produces a grid of small polar "compass needle" panels, one per
 * (timepoint, question) combination. We re-express this as a single ECharts polar
 * bar chart: angleAxis = weeks, radiusAxis = score (1-7), 3 series (Q39/Q40/Q41).
 *
 * Edge-case handling:
 *   - Summary panels ("Selected weeks: …") are skipped — they're redundant.
 *   - Theta encodes the Likert score as (score-1)*30 degrees, so we invert it.
 *   - Subplot keys are sorted numerically ("polar"→1, "polar2"→2, etc.) to match
 *     the annotation order that Plotly's make_subplots generates.
 */
export function rosePlotToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};

  // Sort subplot keys numerically: polar=1, polar2=2, polar3=3, …
  const subplotKeys = Object.keys(layout)
    .filter(k => k === 'polar' || /^polar\d+$/.test(k))
    .sort((a, b) => {
      const na = a === 'polar' ? 1 : parseInt(a.slice(5), 10);
      const nb = b === 'polar' ? 1 : parseInt(b.slice(5), 10);
      return na - nb;
    });

  // Group traces by subplot
  const bySubplot = {};
  for (const trace of figure.data) {
    if (trace.type !== 'barpolar') continue;
    const sp = trace.subplot || 'polar';
    (bySubplot[sp] = bySubplot[sp] || []).push(trace);
  }

  const annotations = layout.annotations || [];

  const panelData = [];
  for (let i = 0; i < Math.min(subplotKeys.length, annotations.length); i++) {
    const title = stripHtml(annotations[i]?.text || '').toLowerCase();

    // Skip summary panels
    if (title.startsWith('selected weeks')) continue;

    const weekMatch = title.match(/week\s*(\d)/i);
    if (!weekMatch) continue;
    const week = parseInt(weekMatch[1], 10);

    let question = null;
    if (title.includes('progress')) question = 'Progress';
    else if (title.includes('confidence')) question = 'Confidence';
    else if (title.includes('importance')) question = 'Importance';
    if (!question) continue;

    const traces = bySubplot[subplotKeys[i]] || [];
    const trace = traces[0];
    if (!trace?.theta?.length) continue;

    // Decode Likert score from angle: theta = (score-1) * 30
    const score = Math.round(trace.theta[0] / 30) + 1;
    if (score < 1 || score > 7) continue;

    panelData.push({ week, question, score });
  }

  if (!panelData.length) return null;

  const weeks = [...new Set(panelData.map(d => d.week))].sort((a, b) => a - b);
  const questions = ['Progress', 'Confidence', 'Importance'];

  const colors = [
    cssVar('--chart-1') || OKABE_ITO[0],
    cssVar('--chart-2') || OKABE_ITO[1],
    cssVar('--chart-3') || OKABE_ITO[2],
  ];
  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const series = questions.map((q, qi) => ({
    type: 'bar',
    name: q,
    coordinateSystem: 'polar',
    data: weeks.map(w => panelData.find(d => d.week === w && d.question === q)?.score ?? null),
    itemStyle: { color: colors[qi] },
    emphasis: { focus: 'series' },
    barMaxWidth: 40,
  }));

  // Table data for sr-only fallback (returned alongside option via a closure on panelData)
  rosePlotToEcharts._lastTableData = { weeks, questions, panelData };

  return {
    animation: !reducedMotion(),
    animationDuration: 600,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    title: {
      text: 'Goal Progress Overview',
      subtext: 'Weekly progress scores across all goals (1–7 scale)',
      left: 'center',
      top: 8,
      textStyle: { color: textColor, fontSize: 16, fontWeight: 'bold' },
      subtextStyle: { color: dimColor, fontSize: 11 },
    },
    legend: {
      data: questions,
      textStyle: { color: textColor },
      top: 62,
      left: 'center',
    },
    polar: {
      radius: ['12%', '68%'],
      center: ['50%', '60%'],
    },
    angleAxis: {
      type: 'category',
      data: weeks.map(w => `Week ${w}`),
      z: 10,
      axisLabel: { color: textColor, fontSize: 11 },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { lineStyle: { color: gridColor } },
    },
    radiusAxis: {
      min: 1,
      max: 7,
      z: 10,
      axisLabel: { color: textColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine: { lineStyle: { color: gridColor } },
    },
    tooltip: {
      trigger: 'item',
      formatter: p => `${p.name}<br/>${p.seriesName}: <b>Score: ${p.value} / 7</b>`,
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: textColor },
    },
    series,
  };
}

/**
 * radarPlotToEcharts — converts the scatterpolar figure from radarplot.py.
 *
 * The backend emits 2 visible traces (baseline + one comparison timepoint) plus
 * a Plotly slider with restyle steps for each comparison timepoint. We extract
 * all timepoints from the slider steps so ECharts can show them all at once as
 * separate series (no slider needed — the legend handles visibility toggling).
 *
 * Edge-case handling:
 *   - r/theta arrays have N+1 elements (last duplicates first) for Plotly's closed
 *     polygon — we strip the duplicate before building indicator/values.
 *   - null values in r arrays (missing data) are replaced with 0 so ECharts doesn't
 *     crash; they render as a point at the center of the radar.
 *   - If no slider steps exist (only 1 comparison timepoint), we fall back to the
 *     second trace directly.
 */
export function radarPlotToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const traces = figure.data.filter(t => t.type === 'scatterpolar');
  if (!traces.length) return null;

  const rawTheta = traces[0]?.theta || [];
  if (!rawTheta.length) return null;

  // Strip wrap-around duplicate (Plotly closes the polygon by repeating element 0)
  const traitNames = (rawTheta.length > 1 && rawTheta[rawTheta.length - 1] === rawTheta[0])
    ? rawTheta.slice(0, -1)
    : [...rawTheta];
  if (!traitNames.length) return null;

  function stripWrap(arr) {
    if (!Array.isArray(arr)) return [];
    const vals = (arr.length > traitNames.length && arr[arr.length - 1] === arr[0])
      ? arr.slice(0, traitNames.length)
      : arr.slice(0, traitNames.length);
    return vals.map(v => (v === null || v === undefined || isNaN(v)) ? 0 : v);
  }

  const colors = OKABE_ITO.map((fb, i) => cssVar(`--chart-${i + 1}`) || fb);
  const textColor = cssVar('--chart-text') || '#e9eefc';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const indicator = traitNames.map(name => ({ name, max: 7 }));

  const seriesData = [];

  // Baseline trace (T1 for full mode, T2 for simple mode)
  const baseline = traces[0];
  if (baseline?.r) {
    const vals = stripWrap(baseline.r);
    if (vals.some(v => v > 0)) {
      seriesData.push({ name: baseline.name || 'Baseline', value: vals });
    }
  }

  // All comparison timepoints from slider steps
  const steps = figure.layout?.sliders?.[0]?.steps || [];
  for (const step of steps) {
    const rArr = step.args?.[0]?.r?.[0];
    const name = step.label;
    if (!rArr || !name) continue;
    const vals = stripWrap(rArr);
    if (vals.some(v => v > 0)) {
      seriesData.push({ name, value: vals });
    }
  }

  // Fallback: if no slider, use second trace directly
  if (!steps.length && traces.length > 1) {
    const cmp = traces[1];
    if (cmp?.r) {
      const vals = stripWrap(cmp.r);
      if (vals.some(v => v > 0)) {
        seriesData.push({ name: cmp.name || 'Comparison', value: vals });
      }
    }
  }

  if (!seriesData.length) return null;

  // Table data for sr-only fallback
  radarPlotToEcharts._lastTableData = { traitNames, seriesData };

  return {
    animation: !reducedMotion(),
    animationDuration: 600,
    animationEasing: 'cubicOut',
    backgroundColor: 'transparent',
    grid: { containLabel: true },
    legend: {
      data: seriesData.map(d => d.name),
      textStyle: { color: textColor, fontSize: 10 },
      orient: 'horizontal',
      bottom: 0,
      left: 'center',
      itemWidth: 10,
      itemHeight: 10,
      formatter: name => name.length > 8 ? name.slice(0, 7) + '…' : name,
    },
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg,
      borderColor: tooltipBorder,
      textStyle: { color: textColor },
    },
    radar: {
      indicator,
      shape: 'polygon',
      splitNumber: 6,
      center: ['50%', '48%'],
      radius: '55%',
      axisName: {
        color: textColor,
        fontSize: 11,
        padding: [0, 4],
        formatter: name => name.length > 12 ? name.slice(0, 11) + '…' : name,
      },
      splitLine: {
        lineStyle: { color: gridColor, width: 1 },
      },
      splitArea: {
        areaStyle: {
          color: ['rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)'],
        },
      },
      axisLine: { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'radar',
      data: seriesData.map((d, i) => ({
        ...d,
        lineStyle: { color: colors[i % colors.length], width: 2 },
        areaStyle: { color: colors[i % colors.length], opacity: 0.15 },
        itemStyle: { color: colors[i % colors.length] },
        symbol: 'circle',
        symbolSize: 4,
      })),
    }],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Admin chart adapters
// ─────────────────────────────────────────────────────────────────────────────

const LIKERT_COLORS_DIVERGING = {
  'Neutral':           '#d3d3d3',
  'Somewhat Disagree': '#fcbe75',
  'Disagree':          '#f59c3c',
  'Strongly Disagree': '#D55E00',
  'Somewhat Agree':    '#92c0df',
  'Agree':             '#6b9cc3',
  'Strongly Agree':    '#0072B2',
};

const LIKERT_COLORS_7 = ['#d73027','#fc8d59','#fee090','#d9d9d9','#91bfdb','#4575b4','#2166ac'];

/**
 * divergingBarToEcharts — multi-week diverging stacked horizontal bar chart.
 * Converts a Plotly make_subplots figure (N rows, shared x-axis) from
 * admin_divergingstackedbarchart.py into a multi-grid ECharts option.
 */
export function divergingBarToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};

  // Group bar traces by yaxis attribute ('y', 'y2', 'y3', …)
  const barsByAxis = {};
  for (const trace of figure.data) {
    if (trace.type !== 'bar') continue;
    const axis = trace.yaxis || 'y';
    (barsByAxis[axis] = barsByAxis[axis] || []).push(trace);
  }

  const axes = Object.keys(barsByAxis).sort((a, b) => {
    const na = a === 'y' ? 1 : parseInt(a.slice(1), 10);
    const nb = b === 'y' ? 1 : parseInt(b.slice(1), 10);
    return na - nb;
  });
  if (!axes.length) return null;

  const N = axes.length;
  const annotations = layout.annotations || [];
  const weekAnnotations = annotations.filter(a => (a.text || '').includes('Week'));

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const titleLines = stripHtml(layout.title?.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const mainTitle = titleLines[0] || 'Goal Progress';
  const subTitle  = titleLines.slice(1).join(' ').slice(0, 160);

  // Layout constants (px)
  const rowHeight = 190;
  const rowGap    = 56;  // room for per-row week label + spacing
  const topOffset = 92;  // overall title + legend
  const bottomPad = 50;
  const totalHeight = topOffset + N * (rowHeight + rowGap) + bottomPad;

  // Insertion order of traces per row:
  // 0:Neutral(left)  1:SomewhatDisagree  2:Disagree  3:StronglyDisagree
  // 4:Neutral(right) 5:SomewhatAgree     6:Agree     7:StronglyAgree
  const TRACE_ORDER = [
    'Neutral', 'Somewhat Disagree', 'Disagree', 'Strongly Disagree',
    'Neutral', 'Somewhat Agree',    'Agree',    'Strongly Agree',
  ];
  const STACK_SIDE = ['left','left','left','left','right','right','right','right'];

  const grids = [], xAxes = [], yAxes = [], series = [], graphic = [];

  axes.forEach((axis, i) => {
    const barTraces = barsByAxis[axis];
    const yLabels   = barTraces[0]?.y || [];
    const topPx     = topOffset + i * (rowHeight + rowGap);

    grids.push({ top: topPx, height: rowHeight, left: '23%', right: '5%' });

    xAxes.push({
      gridIndex: i,
      type: 'value',
      min: -120, max: 120,
      axisLabel: { formatter: v => Math.abs(v) + '%', color: dimColor, fontSize: 10 },
      splitLine: { lineStyle: { color: gridColor } },
      axisLine:  { lineStyle: { color: gridColor } },
      axisTick:  { show: false },
    });

    yAxes.push({
      gridIndex: i,
      type: 'category',
      data: yLabels,
      axisLabel: { color: textColor, fontSize: 12, width: 200, overflow: 'truncate', tooltip: { show: true } },
      axisLine:  { lineStyle: { color: gridColor } },
      splitLine: { show: false },
    });

    const weekLabel = weekAnnotations[i] ? stripHtml(weekAnnotations[i].text) : `Week ${i + 1}`;
    graphic.push({
      type: 'text', left: '50%', top: topPx - 24,
      style: { text: weekLabel, textAlign: 'center', fill: cssVar('--chart-2') || '#56B4E9', fontSize: 14, fontWeight: 'bold' },
    });

    barTraces.forEach((trace, ti) => {
      const name  = TRACE_ORDER[ti] || trace.name;
      const stack = `${STACK_SIDE[ti]}_${i}`;
      series.push({
        type: 'bar', name,
        xAxisIndex: i, yAxisIndex: i,
        stack,
        data: trace.x,
        itemStyle:      { color: LIKERT_COLORS_DIVERGING[name] || '#999' },
        emphasis:       { focus: 'series' },
        legendHoverLink: true,
      });
    });
  });

  return {
    animation: !reducedMotion(), animationDuration: 400,
    backgroundColor: 'transparent',
    title: {
      text: mainTitle, subtext: subTitle,
      left: 'center', top: 6,
      textStyle:    { color: textColor, fontSize: 16, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 11 },
    },
    legend: {
      data: ['Strongly Disagree','Disagree','Somewhat Disagree','Neutral','Somewhat Agree','Agree','Strongly Agree'],
      top: 44, left: 'center',
      textStyle: { color: textColor, fontSize: 10 },
      itemWidth: 10, itemHeight: 10,
    },
    grid: grids, xAxis: xAxes, yAxis: yAxes, series, graphic,
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'shadow' },
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
      formatter(params) {
        const label = params[0]?.name || '';
        const lines = [`<b>${label}</b>`];
        // deduplicate neutral (appears twice per row)
        const seen = new Set();
        for (const p of params) {
          const key = p.seriesName;
          if (seen.has(key)) continue;
          const val = Math.abs(Number(p.value));
          if (val > 0) { lines.push(`${p.marker}${key}: ${val.toFixed(1)}%`); seen.add(key); }
        }
        return lines.join('<br/>');
      },
    },
    _totalHeight: totalHeight,
  };
}

/**
 * demographicBarToEcharts — grouped bar: full-sample vs selected demographic group.
 * Two-trace Plotly figure from admin_demographic_barchart.py.
 */
export function demographicBarToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};
  const traces  = figure.data.filter(t => t.type === 'bar');
  if (!traces.length) return null;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const titleLines  = stripHtml(layout.title?.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const mainTitle   = titleLines[0] || 'Demographic Chart';
  const subTitle    = titleLines.slice(1).join(' ');
  const xLabels     = traces[0]?.x || [];
  const yAxisLabel  = stripHtml(layout.yaxis?.title?.text || '') || '% of Respondents';

  const mkSeries = (trace, opacity) => ({
    type: 'bar',
    name: trace.name || 'Series',
    data: (trace.y || []).map((v, i) => ({
      value: v,
      itemStyle: {
        color: LIKERT_COLORS_7[i] || '#999',
        opacity,
        borderColor: opacity > 0.5 ? 'white' : 'rgba(255,255,255,0.2)',
        borderWidth: opacity > 0.5 ? 1.5 : 1,
      },
    })),
    label: {
      show: true, position: 'top',
      color: opacity > 0.5 ? textColor : dimColor,
      fontSize: 10,
      formatter: p => Number(p.value).toFixed(1) + '%',
    },
    emphasis: { focus: 'series' },
  });

  const seriesList = [];
  if (traces[0]) seriesList.push(mkSeries(traces[0], 0.4));
  if (traces[1]) seriesList.push(mkSeries(traces[1], 0.95));

  return {
    animation: !reducedMotion(), animationDuration: 500,
    backgroundColor: 'transparent',
    title: {
      text: mainTitle, subtext: subTitle,
      left: 'center', top: 8,
      textStyle:    { color: textColor, fontSize: 14, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 11 },
    },
    legend: { top: 60, left: 'center', textStyle: { color: textColor, fontSize: 11 } },
    grid: { top: 110, bottom: 80, left: 65, right: 20 },
    xAxis: {
      type: 'category', data: xLabels,
      axisLabel:  { color: textColor, fontSize: 11, rotate: 15 },
      axisLine:   { lineStyle: { color: gridColor } },
      splitLine:  { show: false },
    },
    yAxis: {
      type: 'value', name: yAxisLabel,
      nameTextStyle: { color: dimColor },
      axisLabel:  { color: dimColor, formatter: v => v + '%' },
      splitLine:  { lineStyle: { color: gridColor } },
      axisLine:   { lineStyle: { color: gridColor } },
    },
    series: seriesList,
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
      formatter(params) {
        const label = params[0]?.name || '';
        return [`<b>${label}</b>`,
          ...params.map(p => `${p.marker}${p.seriesName}: ${Number(p.value).toFixed(1)}%`),
        ].join('<br/>');
      },
    },
  };
}

/**
 * countsDemographicsToEcharts — bar chart of participant counts per demographic category.
 * Extracts the single visible trace from the multi-trace Plotly figure in
 * admin_counts_demographics.py.
 */
export function countsDemographicsToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};
  const trace   = figure.data.find(t => t.type === 'bar' && t.visible === true)
                || figure.data.find(t => t.type === 'bar')
                || null;
  if (!trace) return null;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';
  const colors    = OKABE_ITO.map((fb, i) => cssVar(`--chart-${i + 1}`) || fb);

  const xLabels = trace.x || [];
  const yCounts = trace.y || [];
  const textArr = trace.text || [];

  return {
    animation: !reducedMotion(), animationDuration: 500,
    backgroundColor: 'transparent',
    grid: { top: 50, bottom: 70, left: 60, right: 20 },
    xAxis: {
      type: 'category', data: xLabels,
      axisLabel:  { color: textColor, fontSize: 11, rotate: 20 },
      axisLine:   { lineStyle: { color: gridColor } },
      splitLine:  { show: false },
    },
    yAxis: {
      type: 'value', name: 'Count',
      nameTextStyle: { color: dimColor },
      axisLabel:  { color: dimColor },
      splitLine:  { lineStyle: { color: gridColor } },
      axisLine:   { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'bar',
      data: yCounts.map((v, i) => ({
        value: v,
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: {
        show: true, position: 'top', color: textColor, fontSize: 10,
        formatter(p) {
          const raw = textArr[p.dataIndex] || '';
          const m   = raw.match(/\(([^)]+)\)/);
          return m ? `${p.value}\n${m[1]}` : String(p.value);
        },
      },
      emphasis: { focus: 'self' },
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
    },
  };
}

/**
 * attritionFunnelToEcharts — horizontal bar chart of participant retention across weeks.
 * Plotly go.Funnel trace from admin_attrition_funnel.py (y=labels, x=counts).
 * Displayed as a horizontal bar chart (funnel shape is misleading for retention data).
 */
export function attritionFunnelToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const trace = figure.data.find(t => t.type === 'funnel') || figure.data[0];
  if (!trace) return null;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';
  const colors    = OKABE_ITO.map((fb, i) => cssVar(`--chart-${i + 1}`) || fb);

  const labels = trace.y || [];
  const counts = trace.x || [];
  if (!labels.length) return null;

  const baseline = counts[0] || 1;

  return {
    animation: !reducedMotion(), animationDuration: 500,
    backgroundColor: 'transparent',
    title: {
      text: 'Participant Retention Across the Study',
      subtext: 'Number of participants who completed each weekly survey',
      left: 'center', top: 8,
      textStyle:    { color: textColor, fontSize: 15, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 11 },
    },
    grid: { left: '18%', right: '12%', top: 80, bottom: 40 },
    xAxis: {
      type: 'value',
      name: 'Participants',
      nameTextStyle: { color: dimColor, fontSize: 11 },
      axisLabel:  { color: dimColor },
      splitLine:  { lineStyle: { color: gridColor } },
      axisLine:   { lineStyle: { color: gridColor } },
    },
    yAxis: {
      type: 'category',
      data: labels,
      axisLabel:  { color: textColor, fontSize: 12 },
      axisLine:   { lineStyle: { color: gridColor } },
      splitLine:  { show: false },
    },
    series: [{
      type: 'bar',
      data: counts.map((v, i) => ({
        value: v,
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: {
        show: true, position: 'right', color: textColor,
        formatter: p => String(p.value),
      },
      emphasis: { focus: 'self' },
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: textColor, type: 'dashed', width: 1, opacity: 0.4 },
        data: [{ xAxis: baseline }],
        label: {
          show: true, position: 'insideEndTop',
          formatter: `Started: ${baseline} participants`,
          color: dimColor, fontSize: 10,
        },
      },
    }],
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
      formatter: p => {
        const pct = (p.value / baseline * 100).toFixed(1);
        return `${p.name}: <b>${p.value}</b> participants<br/>${pct}% of Week 1 total`;
      },
    },
  };
}

/**
 * linguisticMarkersToEcharts — scatter dot-plot of logistic regression coefficients.
 * Plotly go.Scatter(mode='markers') from linguisticmarkersplot.py.
 * x=coefficient values, y=feature labels; positive=high-progress, negative=low-progress.
 */
export function linguisticMarkersToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};
  const trace   = figure.data.find(t => t.type === 'scatter');
  if (!trace?.x?.length) return null;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const titleLines = stripHtml(layout.title?.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const mainTitle  = titleLines[0] || 'Linguistic Markers';

  const coefs    = trace.x;
  const features = trace.y;
  const markerColors = trace.marker?.color || [];

  return {
    animation: !reducedMotion(), animationDuration: 500,
    backgroundColor: 'transparent',
    title: {
      text: mainTitle,
      subtext: 'Words most strongly associated with higher or lower weekly goal progress scores (logistic regression)',
      left: 'center', top: 8,
      textStyle:    { color: textColor, fontSize: 15, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 11 },
    },
    grid: { top: 80, bottom: 56, left: '22%', right: '4%' },
    xAxis: {
      type: 'value',
      name: '← Low Progress   |   High Progress →',
      nameLocation: 'center',
      nameGap: 28,
      nameTextStyle: { color: dimColor, fontSize: 11 },
      axisLabel:  { color: dimColor, fontSize: 10 },
      splitLine:  { lineStyle: { color: gridColor } },
      axisLine:   { lineStyle: { color: gridColor } },
      splitNumber: 6,
    },
    yAxis: {
      type: 'category', data: features,
      axisLabel:  { color: textColor, fontSize: 11 },
      axisLine:   { lineStyle: { color: gridColor } },
      splitLine:  { show: false },
    },
    series: [{
      type: 'scatter',
      data: coefs.map((c, i) => ({
        value: [c, features[i]],
        itemStyle: {
          color: Array.isArray(markerColors)
            ? (markerColors[i] || (c >= 0 ? '#2ecc71' : '#e74c3c'))
            : (c >= 0 ? '#2ecc71' : '#e74c3c'),
        },
      })),
      symbolSize: 10,
      markLine: {
        silent: true, symbol: 'none',
        lineStyle: { color: textColor, type: 'dashed', width: 1, opacity: 0.5 },
        data: [{ xAxis: 0 }],
        label: {
          show: true, position: 'insideEndTop',
          formatter: 'Neutral',
          color: dimColor, fontSize: 10,
        },
      },
    }],
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
      formatter: p => {
        const coef = Number(p.value[0]);
        const word = p.value[1];
        const dir  = coef >= 0 ? 'High progress' : 'Low progress';
        return `<b>${word}</b><br/>${dir} indicator<br/>Strength: ${Math.abs(coef).toFixed(3)}`;
      },
    },
  };
}

/**
 * wordCloudToEcharts — extracts the matplotlib-generated base64 PNG image from the
 * Plotly layout image. The backend embeds a rendered PNG; no ECharts rendering is needed.
 * Returns { _isImage, imageSource, subtitle } — component renders an <img> tag.
 */
export function wordCloudToEcharts(figure) {
  if (!figure) return null;
  const images = figure.layout?.images;
  if (images?.length) {
    const src = images[0]?.source;
    if (src) {
      return {
        _isImage: true,
        imageSource: src,
        subtitle: stripHtml(figure.layout?.title?.text || ''),
      };
    }
  }
  return null;
}

function cleanSankeyLabel(raw) {
  if (!raw) return raw;
  return raw
    .replace(/\bT(\d)\b/g, (_, n) => `Week ${n}`)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase())
    .replace(/\s+\d+$/, '')
    .trim();
}

/**
 * alluvialToEcharts — converts a single Plotly Sankey figure dict to ECharts sankey.
 * Called once per question figure (caller iterates over the response structure).
 */
export function alluvialToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const trace = figure.data.find(t => t.type === 'sankey');
  if (!trace) return null;

  const layout = figure.layout || {};
  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const mainTitle = 'Participant Flow Between Groups';
  const subTitle  = 'How participants moved between high and low progress groups across the study weeks';

  const rawLabels  = trace.node?.label  || [];
  const nodeColors = trace.node?.color  || [];
  const srcArr     = trace.link?.source || [];
  const tgtArr     = trace.link?.target || [];
  const valArr     = trace.link?.value  || [];
  const colArr     = trace.link?.color  || [];

  if (!srcArr.length) return null;

  const cleanLabels = rawLabels.map(cleanSankeyLabel);

  const nodes = cleanLabels.map((name, i) => ({
    name,
    itemStyle: { color: nodeColors[i] || '#999' },
    label: { color: textColor, fontSize: 10 },
  }));

  const links = srcArr.map((s, i) => ({
    source:    cleanLabels[s],
    target:    cleanLabels[tgtArr[i]],
    value:     valArr[i],
    lineStyle: { color: colArr[i] || 'rgba(150,150,150,0.3)' },
  }));

  return {
    animation: !reducedMotion(), animationDuration: 600,
    backgroundColor: 'transparent',
    title: {
      text: mainTitle, subtext: subTitle,
      left: 'center', top: 6,
      textStyle:    { color: textColor, fontSize: 13, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 10 },
    },
    series: [{
      type: 'sankey',
      layout: 'none',
      left: '5%', right: '5%', top: 60, bottom: 20,
      data: nodes, links,
      emphasis: { focus: 'adjacency' },
      lineStyle: { curveness: 0.5 },
      nodeWidth: 20, nodeGap: 15,
      label: { color: textColor, fontSize: 11 },
    }],
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
    },
  };
}

/**
 * userProfileToEcharts — converts one demographic category object to an ECharts option.
 * Input: { type: 'bar'|'donut', title, labels, values, highlight, subtitle }
 * This does NOT receive a Plotly figure — the endpoint returns structured JSON directly.
 */
export function userProfileToEcharts(categoryData) {
  if (!categoryData?.labels?.length) return null;

  const { type, labels, values, highlight } = categoryData;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';
  const colors    = OKABE_ITO.map((fb, i) => cssVar(`--chart-${i + 1}`) || fb);
  const accent    = cssVar('--accent') || '#4f7cff';

  if (type === 'bar') {
    return {
      animation: !reducedMotion(),
      backgroundColor: 'transparent',
      grid: { top: 30, bottom: 55, left: 45, right: 10 },
      xAxis: {
        type: 'category', data: labels,
        axisLabel: { color: textColor, fontSize: 9, rotate: 25, overflow: 'truncate', width: 55 },
        axisLine:  { lineStyle: { color: gridColor } },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value', name: '%',
        nameTextStyle: { color: dimColor, fontSize: 9 },
        axisLabel:  { color: dimColor, fontSize: 9 },
        splitLine:  { lineStyle: { color: gridColor } },
        axisLine:   { lineStyle: { color: gridColor } },
      },
      series: [{
        type: 'bar',
        data: labels.map((l, i) => ({
          value: values[i],
          itemStyle: {
            color: l === highlight ? accent : colors[i % colors.length],
            opacity: l === highlight ? 1 : 0.78,
          },
        })),
        label: {
          show: true, position: 'top', color: textColor, fontSize: 8,
          formatter: p => Number(p.value).toFixed(1) + '%',
        },
        emphasis: { focus: 'self' },
      }],
      tooltip: {
        trigger: 'axis',
        backgroundColor: tooltipBg, borderColor: tooltipBorder,
        textStyle: { color: textColor, fontSize: 11 },
        formatter: p => `${p[0]?.name}: <b>${Number(p[0]?.value).toFixed(1)}%</b>`,
      },
    };
  }

  // type === 'donut'
  return {
    animation: !reducedMotion(),
    backgroundColor: 'transparent',
    legend: {
      orient: 'vertical', right: 0, top: 'middle',
      textStyle: { color: textColor, fontSize: 9 },
      itemWidth: 8, itemHeight: 8,
    },
    series: [{
      type: 'pie',
      radius: ['38%', '68%'],
      center: ['40%', '50%'],
      data: labels.map((name, i) => ({
        name, value: values[i],
        itemStyle: { color: colors[i % colors.length] },
      })),
      label: { show: false },
      emphasis: { label: { show: true, fontSize: 11, color: textColor } },
    }],
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor, fontSize: 11 },
      formatter: p => `${p.marker}${p.name}: <b>${Number(p.value).toFixed(1)}%</b>`,
    },
  };
}

/**
 * ageDistributionToEcharts — simple bar chart of participant age distribution.
 * Plotly go.Bar from ageplot.py (x=age-range labels, y=counts).
 */
export function ageDistributionToEcharts(figure) {
  if (!figure?.data?.length) return null;

  const layout = figure.layout || {};
  const trace   = figure.data.find(t => t.type === 'bar');
  if (!trace?.x?.length) return null;

  const textColor = cssVar('--chart-text') || '#e9eefc';
  const dimColor  = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor = cssVar('--chart-grid') || 'rgba(255,255,255,0.08)';
  const tooltipBg = cssVar('--chart-tooltip-bg') || 'rgba(16,25,42,0.95)';
  const tooltipBorder = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';
  const color     = cssVar('--chart-2') || OKABE_ITO[1];

  const titleLines = stripHtml(layout.title?.text || '').split('\n').map(s => s.trim()).filter(Boolean);
  const mainTitle  = titleLines[0] || 'Age Distribution';
  const subTitle   = titleLines.slice(1).join(' ');

  return {
    animation: !reducedMotion(), animationDuration: 500,
    backgroundColor: 'transparent',
    title: {
      text: mainTitle, subtext: subTitle,
      left: 'center', top: 8,
      textStyle:    { color: textColor, fontSize: 15, fontWeight: 'bold' },
      subtextStyle: { color: dimColor,  fontSize: 11 },
    },
    grid: { top: 70, bottom: 60, left: 60, right: 20 },
    xAxis: {
      type: 'category', data: trace.x,
      name: 'Age Range', nameTextStyle: { color: dimColor },
      axisLabel:  { color: textColor, fontSize: 11, rotate: 30 },
      axisLine:   { lineStyle: { color: gridColor } },
      splitLine:  { show: false },
    },
    yAxis: {
      type: 'value', name: 'Count',
      nameTextStyle: { color: dimColor },
      axisLabel:  { color: dimColor },
      splitLine:  { lineStyle: { color: gridColor } },
      axisLine:   { lineStyle: { color: gridColor } },
    },
    series: [{
      type: 'bar',
      data: (trace.y || []).map(v => ({ value: v, itemStyle: { color } })),
      label: { show: true, position: 'top', color: textColor, fontSize: 10 },
      emphasis: { focus: 'self' },
    }],
    tooltip: {
      trigger: 'axis',
      backgroundColor: tooltipBg, borderColor: tooltipBorder,
      textStyle: { color: textColor },
      formatter: p => `Age ${p[0]?.name}: <b>${p[0]?.value}</b>`,
    },
  };
}
