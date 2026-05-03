import React from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";

// ─── Color helpers ────────────────────────────────────────────────────────────

const OKABE_ITO = ['#E69F00','#56B4E9','#009E73','#F0E442','#0072B2','#D55E00','#CC79A7'];

function cssVar(name) {
  return typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim()
    : '';
}

function normalize(str) { return (str || '').toLowerCase().trim(); }

function normalizeToSet(highlight, figKey) {
  if (!highlight) return new Set();
  const raw = String(highlight);
  if (figKey === 'gender') {
    return new Set(raw.split(', ').map(s => normalize(s)).filter(Boolean));
  }
  if (raw.startsWith('Other,')) return new Set(['other']);
  return new Set([normalize(raw)]);
}

function desaturateHex(hex) {
  // Parse #rrggbb or rgba(...)
  let r = 150, g = 150, b = 150;
  const m = hex.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
  if (m) { r = +m[1]; g = +m[2]; b = +m[3]; }
  else {
    const hx = hex.replace('#', '');
    if (hx.length >= 6) {
      r = parseInt(hx.slice(0,2),16); g = parseInt(hx.slice(2,4),16); b = parseInt(hx.slice(4,6),16);
    }
  }
  // Convert to gray-toned version
  const luma = Math.round(0.299*r + 0.587*g + 0.114*b);
  const gr   = Math.round(luma * 0.5 + r * 0.1);
  const gg   = Math.round(luma * 0.5 + g * 0.1);
  const gb_  = Math.round(luma * 0.5 + b * 0.1);
  return `rgba(${gr},${gg},${gb_},0.55)`;
}

// ─── Sub-chart components ─────────────────────────────────────────────────────

function UserBarChart({ fig, figKey, userId }) {
  const { title, subtitle, labels, values, highlight } = fig;
  if (!labels?.length) return null;

  const textColor  = cssVar('--chart-text')     || '#e9eefc';
  const dimColor   = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const gridColor  = cssVar('--chart-grid')     || 'rgba(255,255,255,0.08)';
  const tooltipBg  = cssVar('--chart-tooltip-bg')     || 'rgba(16,25,42,0.95)';
  const tooltipBrd = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';
  const accent     = cssVar('--accent') || '#4f7cff';
  const baseColor  = OKABE_ITO[Math.abs(figKey.length) % OKABE_ITO.length];

  const isFiltered = userId !== 'all';
  const hasAnswer  = highlight !== null && highlight !== undefined;
  const hSet       = normalizeToSet(highlight, figKey);

  const total = (values || []).reduce((a, b) => a + b, 0) || 1;
  const pcts  = (values || []).map(v => +((v / total) * 100).toFixed(1));

  const barColors = labels.map(l => {
    if (!isFiltered)  return baseColor;
    if (!hasAnswer)   return desaturateHex(baseColor);
    return hSet.has(normalize(l)) ? accent : desaturateHex(baseColor);
  });

  const subtitleText = isFiltered && !hasAnswer ? `User #${userId}: N/A` : subtitle;

  const option = {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: title || figKey,
      subtext: subtitleText || '',
      left: 'center', top: 6,
      textStyle:    { color: textColor, fontSize: 13, fontWeight: 700 },
      subtextStyle: { color: dimColor,  fontSize: 10 },
    },
    grid: { top: 58, bottom: 30, left: 10, right: 55, containLabel: true },
    xAxis: { type: 'value', axisLabel: { show: false }, splitLine: { lineStyle: { color: gridColor } }, axisLine: { show: false } },
    yAxis: {
      type: 'category', data: labels,
      axisLabel: {
        color: textColor, fontSize: 10,
        formatter: l => l.length > 26 ? l.slice(0, 26) + '…' : l,
      },
      axisLine:  { lineStyle: { color: gridColor } },
      splitLine: { show: false },
      inverse: true,
    },
    series: [{
      type: 'bar',
      data: labels.map((l, i) => ({ value: values[i], itemStyle: { color: barColors[i] } })),
      label: {
        show: true, position: 'right', color: textColor, fontSize: 9,
        formatter: p => `${pcts[p.dataIndex]}%`,
      },
      emphasis: { focus: 'self' },
    }],
    tooltip: {
      trigger: 'axis', axisPointer: { type: 'none' },
      backgroundColor: tooltipBg, borderColor: tooltipBrd,
      textStyle: { color: textColor, fontSize: 11 },
      formatter: p => `${p[0]?.name}: <b>${p[0]?.value}</b> (${pcts[p[0]?.dataIndex]}%)`,
    },
  };

  const chartH = Math.max(220, labels.length * 28 + 80);

  return (
    <ReactECharts
      option={option}
      opts={{ renderer: 'svg' }}
      style={{ height: chartH, width: '100%' }}
      notMerge
    />
  );
}

function UserDonutChart({ fig, figKey, userId }) {
  const { title, subtitle, labels, values, highlight } = fig;
  if (!labels?.length) return null;

  const textColor  = cssVar('--chart-text')     || '#e9eefc';
  const dimColor   = cssVar('--chart-text-dim') || 'rgba(233,238,252,0.7)';
  const tooltipBg  = cssVar('--chart-tooltip-bg')     || 'rgba(16,25,42,0.95)';
  const tooltipBrd = cssVar('--chart-tooltip-border') || 'rgba(155,183,255,0.16)';

  const isFiltered = userId !== 'all';
  const hasAnswer  = highlight !== null && highlight !== undefined;
  const hSet       = normalizeToSet(highlight, figKey);

  const subtitleText = isFiltered && !hasAnswer ? `User #${userId}: N/A` : subtitle;

  const total = (values || []).reduce((a, b) => a + b, 0) || 1;
  const pcts  = (values || []).map(v => +((v / total) * 100).toFixed(1));

  const pieData = labels.map((name, i) => {
    const base  = OKABE_ITO[i % OKABE_ITO.length];
    const color = (!isFiltered || !hasAnswer)
      ? (isFiltered ? desaturateHex(base) : base)
      : (hSet.has(normalize(name)) ? base : desaturateHex(base));
    return { name, value: values[i], itemStyle: { color } };
  });

  const option = {
    animation: false,
    backgroundColor: 'transparent',
    title: {
      text: title || figKey,
      subtext: subtitleText || '',
      left: 'center', top: 6,
      textStyle:    { color: textColor, fontSize: 13, fontWeight: 700 },
      subtextStyle: { color: dimColor,  fontSize: 10 },
    },
    legend: {
      orient: 'vertical', right: 4, top: 'middle',
      textStyle: { color: textColor, fontSize: 9 },
      itemWidth: 8, itemHeight: 8,
      formatter: name => name.length > 18 ? name.slice(0, 18) + '…' : name,
    },
    series: [{
      type: 'pie',
      radius: ['38%', '66%'],
      center: ['38%', '55%'],
      data: pieData,
      label: { show: false },
      emphasis: {
        label: { show: true, fontSize: 10, color: textColor,
          formatter: p => `${p.name}\n${pcts[p.dataIndex]}%` },
      },
    }],
    tooltip: {
      trigger: 'item',
      backgroundColor: tooltipBg, borderColor: tooltipBrd,
      textStyle: { color: textColor, fontSize: 11 },
      formatter: p => `${p.marker}${p.name}: <b>${p.value}</b> (${pcts[p.dataIndex]}%)`,
    },
  };

  return (
    <ReactECharts
      option={option}
      opts={{ renderer: 'svg' }}
      style={{ height: 320, width: '100%' }}
      notMerge
    />
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

const GRID1_KEYS = ['condition','gender','age','race_ethnicity','marital_status','education'];
const GRID2_KEYS = ['annual_income','socioeconomic_status','religion','religiosity','political_affiliation','political_orientation'];

function AdminDemographics({ prefetchedData, userId }) {
  if (!prefetchedData) {
    return <div style={{ padding: 20, color: 'var(--text-dim)' }}>Loading…</div>;
  }

  const renderChart = (key) => {
    const fig = prefetchedData[key];
    if (!fig) return null;
    return (
      <AppErrorBoundary key={key} context="chart">
        <div style={chartCard}>
          {fig.type === 'bar'
            ? <UserBarChart   fig={fig} figKey={key} userId={userId} />
            : <UserDonutChart fig={fig} figKey={key} userId={userId} />
          }
        </div>
      </AppErrorBoundary>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
      {/* Profile context tile */}
      <div style={profileTile}>
        <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, color: 'var(--text-primary)' }}>
          Profile
        </h2>
        {userId === 'all' ? (
          <p style={{ margin: '6px 0 0', fontSize: 18, color: 'var(--text-dim)' }}>All Users</p>
        ) : (
          <>
            <p style={{ margin: '6px 0 0', fontSize: 18, color: 'var(--text-dim)' }}>User #{userId}</p>
            {prefetchedData?.condition?.highlight && (
              <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--text-dim)', opacity: 0.75 }}>
                Condition: {prefetchedData.condition.highlight}
              </p>
            )}
          </>
        )}
      </div>

      {/* First grid */}
      <div style={chartGrid}>
        {GRID1_KEYS.map(renderChart)}
      </div>

      {/* Employment status — full width */}
      {prefetchedData.employment_status && (
        <AppErrorBoundary context="chart">
          <div style={{ ...chartCard, maxWidth: '100%' }}>
            <UserBarChart fig={prefetchedData.employment_status} figKey="employment_status" userId={userId} />
          </div>
        </AppErrorBoundary>
      )}

      {/* Second grid */}
      <div style={chartGrid}>
        {GRID2_KEYS.map(renderChart)}
      </div>
    </div>
  );
}

export default function AdminUserProfile(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminDemographics {...props} />
    </AppErrorBoundary>
  );
}

const chartCard = {
  background: 'var(--graph-bg)',
  padding: 16,
  borderRadius: 12,
  border: '1px solid var(--card-border)',
  maxWidth: 500,
  width: '100%',
  margin: '0 auto',
};

const chartGrid = {
  display: 'grid',
  gap: 32,
  gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
};

const profileTile = {
  background: 'var(--surface-dark)',
  padding: '16px 22px',
  borderRadius: 12,
  textAlign: 'center',
  border: '1px solid var(--subtle-border)',
};
