import React, { useEffect, useState } from "react";
import ReactECharts from "echarts-for-react";
import AppErrorBoundary from "../components/ErrorBoundary.jsx";
import AdminChartWrapper from "../components/AdminChartWrapper.jsx";
import { attritionFunnelToEcharts } from "../lib/plotlyToEcharts.js";

const DEMO_OPTIONS = ["Overall", "Condition", "Gender", "Age", "Race", "Education", "Religion"];

const DEFAULT_GROUPS = {
  Overall:   ["All Participants"],
  Condition: ["Purpose Outcome Obstacle Plan", "Goal Outcome Obstacle Plan", "Control"],
  Gender:    ["Male", "Female", "Non-binary", "Transgender", "Cisgender", "Genderqueer", "Agender", "Other", "Prefer not to say"],
  Age:       ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  Race:      ["African American/Black", "Asian American/Asian", "Hispanic/Latino/Spanish", "Middle Eastern/N. African", "Native American", "Pacific Islander", "White/Caucasian", "Prefer not to say", "Other"],
  Education: ["Some high school", "HS graduate", "Some college", "College graduate", "Some grad school", "Graduate degree"],
  Religion:  ["Protestant (Christian)", "Catholic", "Buddhist", "Hindu", "Jewish", "Muslim", "None", "Atheist", "Agnostic", "Other"],
};

function AdminAttritionFunnelInner() {
  const [demoKey,         setDemoKey]         = useState("Overall");
  const [groupName,       setGroupName]       = useState("All Participants");
  const [figure,          setFigure]          = useState(null);
  const [loading,         setLoading]         = useState(true);
  const [error,           setError]           = useState(null);
  const [availableGroups, setAvailableGroups] = useState(DEFAULT_GROUPS);

  const groups = availableGroups[demoKey] ?? DEFAULT_GROUPS[demoKey] ?? [];

  useEffect(() => {
    if (!groups.includes(groupName)) setGroupName(groups[0] ?? "");
  }, [demoKey]);

  useEffect(() => {
    if (!groupName) return;
    setLoading(true);
    setError(null);
    const qs = new URLSearchParams({ demo_key: demoKey, grp_name: groupName }).toString();
    fetch(`/api/admin/attrition-funnel?${qs}`, { credentials: "include" })
      .then(res => { if (!res.ok) throw new Error(`Server error ${res.status}`); return res.json(); })
      .then(data => {
        if (data.demo_order) setAvailableGroups(data.demo_order);
        setFigure(data);
        setError(null);
      })
      .catch(err => setError(err.message || "Failed to load attrition funnel."))
      .finally(() => setLoading(false));
  }, [demoKey, groupName]);

  const option = figure ? attritionFunnelToEcharts(figure) : null;

  const filterSlot = (
    <>
      <label style={lbl}>
        Demographic
        <select value={demoKey} onChange={e => setDemoKey(e.target.value)} style={sel}>
          {DEMO_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
        </select>
      </label>
      <label style={lbl}>
        Group
        <select value={groupName} onChange={e => setGroupName(e.target.value)} style={sel}>
          {groups.map(g => <option key={g} value={g}>{g}</option>)}
        </select>
      </label>
    </>
  );

  return (
    <AdminChartWrapper
      loading={loading}
      error={error}
      onRetry={() => { setError(null); setFigure(null); setLoading(true); }}
      empty={!loading && !error && !option}
      title="Participant Retention by Week"
      subtitle="Drop-off from Week 1 through Week 6"
      filterSlot={filterSlot}
      height={440}
    >
      {option && (
        <ReactECharts
          option={option}
          opts={{ renderer: "svg" }}
          style={{ height: 440, width: "100%" }}
          notMerge
        />
      )}
    </AdminChartWrapper>
  );
}

export default function AdminAttritionFunnel(props) {
  return (
    <AppErrorBoundary context="chart">
      <AdminAttritionFunnelInner {...props} />
    </AppErrorBoundary>
  );
}

const sel = {
  minWidth: 200, padding: "7px 10px", borderRadius: 10,
  border: "1px solid var(--ghost-border)",
  background: "var(--ghost-bg)", color: "var(--ghost-color)", fontSize: 13, outline: "none",
};
const lbl = {
  display: "flex", flexDirection: "column", gap: 5,
  fontSize: 12, fontWeight: 700, color: "var(--text-dim)",
};
