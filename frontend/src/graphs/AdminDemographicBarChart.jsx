import React, { useEffect, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { demographicBarToEcharts } from "../lib/plotlyToEcharts.js";

const DEMOGRAPHIC_OPTIONS = [
  { label: "Gender",               value: "Gender" },
  { label: "Race / Ethnicity",     value: "Race / Ethnicity" },
  { label: "Religion",             value: "Religion" },
  { label: "Education",            value: "Education" },
  { label: "Marital Status",       value: "Marital Status" },
  { label: "Income",               value: "Income" },
  { label: "Socioeconomic Status", value: "Socioeconomic Status" },
  { label: "Political Orientation", value: "Political Orientation" },
  { label: "Political Affiliation", value: "Political Affiliation" },
];

const GROUP_OPTIONS = {
  Gender: ["Male","Female","Non-binary","Prefer not to say","Other","Transgender","Cisgender","Genderqueer","Agender"],
  "Race / Ethnicity": [
    "African American / Black","Asian American / Asian","Hispanic, Latino/a, or Spanish origin",
    "Middle Eastern / North African","Native American","Native Hawaiian / Pacific Islander",
    "White / Caucasian","Prefer not to say","Other",
  ],
  Religion: ["Protestant (Christian)","Catholic","Buddhist","Hindu","Jewish","Muslim","None","Atheist","Agnostic","Other religion"],
  Education: ["Some high school","High school graduate","Some college / vocational school","College / vocational school graduate","Some graduate school","Graduate school graduate"],
  "Marital Status": ["Currently married","Widowed","Divorced","Separated","Never married"],
  Income: ["Less than $25,000","$25,000 – $49,999","$50,000 – $74,999","$75,000 – $99,999","$100,000 – $149,999","$150,000 or more","Prefer not to say"],
  "Socioeconomic Status": ["Upper class","Upper-middle class","Middle class","Lower-middle class","Lower class"],
  "Political Orientation": ["Very conservative","Conservative","Slightly conservative","Moderate","Slightly liberal","Liberal","Very liberal"],
  "Political Affiliation": ["Republican","Democrat","Independent","Other","No preference"],
};

const TIMEPOINT_OPTIONS = [1,2,3,4,5,6].map(v => ({ label: `Week ${v}`, value: v }));
const QUESTION_OPTIONS  = Array.from({ length: 43 }, (_, i) => ({ label: `Q${i+1}`, value: `Q${i+1}` }));

function AdminDemographicBarChartInner({
  figure: prefetchedFigure,
  initialDemoLabel   = "Gender",
  initialGroupVal    = "Female",
  initialTimepoint   = 1,
  initialQuestionKey = "Q1",
}) {
  const [demoLabel,   setDemoLabel]   = useState(initialDemoLabel);
  const [groupVal,    setGroupVal]    = useState(initialGroupVal);
  const [timepoint,   setTimepoint]   = useState(initialTimepoint);
  const [questionKey, setQuestionKey] = useState(initialQuestionKey);
  const [figure,      setFigure]      = useState(prefetchedFigure ?? null);
  const [loading,     setLoading]     = useState(prefetchedFigure == null);
  const [error,       setError]       = useState(null);

  const groupOptions = useMemo(() => GROUP_OPTIONS[demoLabel] ?? [], [demoLabel]);

  useEffect(() => {
    if (!groupOptions.includes(groupVal)) setGroupVal(groupOptions[0] ?? "");
  }, [demoLabel, groupOptions]);

  useEffect(() => {
    if (prefetchedFigure != null) { setFigure(prefetchedFigure); setLoading(false); return; }
    if (!groupVal) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      const qs = new URLSearchParams({
        demo_label:   demoLabel,
        group_val:    groupVal,
        timepoint:    String(timepoint),
        question_key: questionKey,
      }).toString();

      fetch(`/api/admin/demographic-barchart?${qs}`, { credentials: "include", signal: controller.signal })
        .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
        .then(fig  => { setFigure(fig); setLoading(false); })
        .catch(err => { if (err.name === "AbortError") return; setError(err.message); setLoading(false); });
    }, 400);

    return () => { clearTimeout(timer); controller.abort(); };
  }, [demoLabel, groupVal, timepoint, questionKey, prefetchedFigure]);

  const option = figure ? demographicBarToEcharts(figure) : null;

  const filterSlot = (
    <div style={row}>
      <label style={lbl}>
        Demographic
        <select value={demoLabel} onChange={e => setDemoLabel(e.target.value)} style={sel}>
          {DEMOGRAPHIC_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label style={lbl}>
        Group
        <select value={groupVal} onChange={e => setGroupVal(e.target.value)} style={sel}>
          {groupOptions.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
      <label style={lbl}>
        Week
        <select value={timepoint} onChange={e => setTimepoint(Number(e.target.value))} style={sel}>
          {TIMEPOINT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
      <label style={lbl}>
        Question
        <select value={questionKey} onChange={e => setQuestionKey(e.target.value)} style={sel}>
          {QUESTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      </label>
    </div>
  );

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !option}
      filterSlot={filterSlot}
      height={480}
    >
      {option && (
        <ReactECharts
          option={option}
          opts={{ renderer: 'svg' }}
          style={{ height: 480, width: '100%' }}
          notMerge
        />
      )}
    </AdminChartWrapper>
  );
}

export default function AdminDemographicBarChart(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminDemographicBarChartInner {...props} />
    </AppErrorBoundary>
  );
}

const row = { display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'flex-end' };
const lbl = { display: 'flex', flexDirection: 'column', gap: 5, fontSize: 12, fontWeight: 700, color: 'var(--text-dim)' };
const sel = { minWidth: 160, padding: '7px 10px', borderRadius: 10, border: '1px solid var(--ghost-border)', background: 'var(--ghost-bg)', color: 'var(--ghost-color)', fontSize: 13 };
