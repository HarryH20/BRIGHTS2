import React, { useEffect, useState } from "react";
import Plot from "react-plotly.js";

const GROUP_OPTIONS = {
  Overall: ["All Participants"],
  Condition: [
    "Purpose Outcome Obstacle Plan",
    "Goal Outcome Obstacle Plan",
    "Control",
  ],
  Gender: [
    "Male",
    "Female",
    "Non-binary",
    "Other",
    "Prefer not to say",
  ],
  Age: ["18–24", "25–34", "35–44", "45–54", "55–64", "65+"],
  Race: [
    "African American/Black",
    "Asian American/Asian",
    "Hispanic/Latino/Spanish",
    "Middle Eastern/N. African",
    "Native American",
    "Pacific Islander",
    "White/Caucasian",
    "Prefer not to say",
    "Other",
  ],
  Education: [
    "Some high school",
    "HS graduate",
    "Some college",
    "College graduate",
    "Some grad school",
    "Graduate degree",
  ],
  Religion: [
    "Protestant (Christian)",
    "Catholic",
    "Buddhist",
    "Hindu",
    "Jewish",
    "Muslim",
    "None",
    "Atheist",
    "Agnostic",
    "Other",
  ],
};

const DEMO_OPTIONS = Object.keys(GROUP_OPTIONS);

export default function AdminAttritionFunnel() {
  const [demoKey, setDemoKey] = useState("Overall");
  const [groupName, setGroupName] = useState("All Participants");
  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  const groups = GROUP_OPTIONS[demoKey] ?? [];

  useEffect(() => {
    if (!groups.includes(groupName)) {
      setGroupName(groups[0] ?? "");
    }
  }, [demoKey, groupName, groups]);

  useEffect(() => {
    if (!groupName) return;

    const qs = new URLSearchParams({
      demo_key: demoKey,
      grp_name: groupName,
    }).toString();

    fetch(`/api/admin/attrition-funnel?${qs}`, {
      credentials: "include",
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Server error: ${res.status}`);
        return res.json();
      })
      .then((fig) => {
        setFigure(fig);
        setError(null);
      })
      .catch((err) => setError(err.message));
  }, [demoKey, groupName]);

  if (error) {
    return (
      <div style={styles.fallback}>
        <p style={styles.errorText}>
          Could not load attrition funnel: {error}
        </p>
      </div>
    );
  }

  if (!figure) {
    return (
      <div style={styles.fallback}>
        <div style={styles.spinner} />
        <p style={styles.loadingText}>Loading attrition funnel...</p>
      </div>
    );
  }

  return (
    <div style={styles.wrapper}>
      <div style={styles.controls}>
        <label style={styles.label}>
          Demographic
          <select
            value={demoKey}
            onChange={(e) => setDemoKey(e.target.value)}
            style={styles.select}
          >
            {DEMO_OPTIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Group
          <select
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            style={styles.select}
          >
            {groups.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </label>
      </div>

      <Plot
        data={figure.data}
        layout={{
          ...figure.layout,
          autosize: true,
          width: undefined,
        }}
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
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  controls: {
    display: "flex",
    flexWrap: "wrap",
    gap: 12,
    alignItems: "flex-end",
  },
  label: {
    display: "flex",
    flexDirection: "column",
    gap: 6,
    fontSize: 12,
    fontWeight: 800,
    color: "var(--text-dim, #aab6d3)",
  },
  select: {
    minWidth: 220,
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border, rgba(255,255,255,0.12))",
    background: "var(--ghost-bg, rgba(255,255,255,0.04))",
    color: "var(--ghost-color, #e9eefc)",
    outline: "none",
    fontSize: 13,
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