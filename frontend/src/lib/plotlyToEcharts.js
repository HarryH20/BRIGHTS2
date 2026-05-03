/**
 * Adapter functions that convert Plotly figure dicts (as returned by the backend)
 * into ECharts option objects. The backend is never modified — only the rendering changes.
 *
 * Both functions return null when the figure has no meaningful data so the caller
 * can render an empty state instead of crashing.
 */

const OKABE_ITO = ['#E69F00', '#56B4E9', '#009E73', '#F0E442', '#0072B2', '#D55E00', '#CC79A7'];

function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

function reducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function stripHtml(str) {
  return (str || '').replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').trim();
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
    legend: {
      data: seriesData.map(d => d.name),
      textStyle: { color: textColor },
      top: 0,
      left: 'center',
      itemWidth: 12,
      itemHeight: 12,
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
      center: ['50%', '55%'],
      radius: '65%',
      axisName: {
        color: textColor,
        fontSize: 11,
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
