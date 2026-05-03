// frontend/src/graphs/AdminDemographicBarChart.jsx
import React, { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";

const DEMOGRAPHIC_OPTIONS = [
  { label: "Gender", value: "Gender" },
  { label: "Race / Ethnicity", value: "Race / Ethnicity" },
  { label: "Religion", value: "Religion" },
  { label: "Education", value: "Education" },
  { label: "Marital Status", value: "Marital Status" },
  { label: "Income", value: "Income" },
  { label: "Socioeconomic Status", value: "Socioeconomic Status" },
  { label: "Political Orientation", value: "Political Orientation" },
  { label: "Political Affiliation", value: "Political Affiliation" },
];

const GROUP_OPTIONS = {
  Gender: [
    "Male",
    "Female",
    "Non-binary",
    "Prefer not to say",
    "Other",
    "Transgender",
    "Cisgender",
    "Genderqueer",
    "Agender",
  ],
  "Race / Ethnicity": [
    "African American / Black",
    "Asian American / Asian",
    "Hispanic, Latino/a, or Spanish origin",
    "Middle Eastern / North African",
    "Native American",
    "Native Hawaiian / Pacific Islander",
    "White / Caucasian",
    "Prefer not to say",
    "Other",
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
    "Other religion",
  ],
  Education: [
    "Some high school",
    "High school graduate",
    "Some college / vocational school",
    "College / vocational school graduate",
    "Some graduate school",
    "Graduate school graduate",
  ],
  "Marital Status": [
    "Currently married",
    "Widowed",
    "Divorced",
    "Separated",
    "Never married",
  ],
  Income: [
    "Less than $25,000",
    "$25,000 – $49,999",
    "$50,000 – $74,999",
    "$75,000 – $99,999",
    "$100,000 – $149,999",
    "$150,000 or more",
    "Prefer not to say",
  ],
  "Socioeconomic Status": [
    "Upper class",
    "Upper-middle class",
    "Middle class",
    "Lower-middle class",
    "Lower class",
  ],
  "Political Orientation": [
    "Very conservative",
    "Conservative",
    "Slightly conservative",
    "Moderate",
    "Slightly liberal",
    "Liberal",
    "Very liberal",
  ],
  "Political Affiliation": [
    "Republican",
    "Democrat",
    "Independent",
    "Other",
    "No preference",
  ],
};

const TIMEPOINT_OPTIONS = [
  { label: "Week 1", value: 1 },
  { label: "Week 2", value: 2 },
  { label: "Week 3", value: 3 },
  { label: "Week 4", value: 4 },
  { label: "Week 5", value: 5 },
  { label: "Week 6", value: 6 },
];

const QUESTION_OPTIONS = Array.from({ length: 43 }, (_, i) => {
  const q = i + 1;
  return { label: `Q${q}`, value: `Q${q}` };
});

export default function AdminDemographicBarChart({
  figure: prefetchedFigure,
  initialDemoLabel = "Gender",
  initialGroupVal = "Female",
  initialTimepoint = 1,
  initialQuestionKey = "Q1",
}) {
  const [demoLabel, setDemoLabel] = useState(initialDemoLabel);
  const [groupVal, setGroupVal] = useState(initialGroupVal);
  const [timepoint, setTimepoint] = useState(initialTimepoint);
  const [questionKey, setQuestionKey] = useState(initialQuestionKey);

  const [figure, setFigure] = useState(prefetchedFigure ?? null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(prefetchedFigure == null);

  const groupOptions = useMemo(() => {
    return GROUP_OPTIONS[demoLabel] ?? [];
  }, [demoLabel]);

  useEffect(() => {
    if (!groupOptions.includes(groupVal)) {
      setGroupVal(groupOptions[0] ?? "");
    }
  }, [demoLabel, groupOptions, groupVal]);

  useEffect(() => {
    if (prefetchedFigure != null) {
      setFigure(prefetchedFigure);
      setLoading(false);
      return;
    }

    if (!groupVal) return;

    const controller = new AbortController();
    setLoading(true);
    setError(null);

    const timer = setTimeout(() => {
      const qs = new URLSearchParams({
        demo_label: demoLabel,
        group_val: groupVal,
        timepoint: String(timepoint),
        question_key: questionKey,
      }).toString();

      fetch(`/api/admin/demographic-barchart?${qs}`, {
        credentials: "include",
        signal: controller.signal,
      })
        .then((res) => {
          if (!res.ok) throw new Error(`Server error: ${res.status}`);
          return res.json();
        })
        .then((fig) => {
          setFigure(fig);
          setLoading(false);
        })
        .catch((err) => {
          if (err.name === "AbortError") return;
          setError(err.message);
          setLoading(false);
        });
    }, 400);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [demoLabel, groupVal, timepoint, questionKey, prefetchedFigure]);

  const layout = {
    ...(figure?.layout ?? {}),
    autosize: true,
    width: undefined,
    paper_bgcolor: figure?.layout?.paper_bgcolor ?? "rgba(0,0,0,0)",
    plot_bgcolor: figure?.layout?.plot_bgcolor ?? "rgba(0,0,0,0)",
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.controls}>
        <label style={styles.label}>
          Demographic
          <select
            value={demoLabel}
            onChange={(e) => setDemoLabel(e.target.value)}
            style={styles.select}
          >
            {DEMOGRAPHIC_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Group
          <select
            value={groupVal}
            onChange={(e) => setGroupVal(e.target.value)}
            style={styles.select}
          >
            {groupOptions.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Week
          <select
            value={timepoint}
            onChange={(e) => setTimepoint(Number(e.target.value))}
            style={styles.select}
          >
            {TIMEPOINT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        <label style={styles.label}>
          Question
          <select
            value={questionKey}
            onChange={(e) => setQuestionKey(e.target.value)}
            style={styles.select}
          >
            {QUESTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div style={styles.fallback}>
          <p style={styles.errorText}>
            Could not load demographic bar chart: {error}
          </p>
        </div>
      ) : loading || !figure ? (
        <div style={styles.fallback}>
          <div style={styles.spinner} />
          <p style={styles.loadingText}>Loading demographic bar chart...</p>
        </div>
      ) : (
        <Plot
          data={figure.data}
          layout={layout}
          config={{
            responsive: true,
            displayModeBar: true,
            displaylogo: false,
            modeBarButtonsToRemove: ["lasso2d", "select2d"],
          }}
          style={{ width: "100%" }}
          useResizeHandler
        />
      )}
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
    minWidth: 180,
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