import React from "react";
import Plot from "react-plotly.js";

/* ============================================================
   LABEL HANDLING
============================================================ */
function wrapLabel(str) {
  return str;
}

function normalize(str) {
  return (str || "").toLowerCase().trim();
}

function normalizeToSet(highlight, figKey) {
  if (!highlight) return new Set();

  const raw = String(highlight);

  // ender is the ONLY true multi‑select field
  if (figKey === "gender") {
    return new Set(
      raw
        .split(", ")
        .map(s => normalize(s))
        .filter(Boolean)
    );
  }

  // "Other, <text>" → highlight "Other"
  if (raw.startsWith("Other,")) {
    return new Set(["other"]);
  }

  // All other demographics are single‑select
  return new Set([normalize(raw)]);
}

/* ============================================================
   COLOR PROCESSING
============================================================ */

function desaturate(color) {
  const parts = color.replace("rgba(", "").replace(")", "").split(",");
  const r = parseInt(parts[0], 10);
  const g = parseInt(parts[1], 10);
  const b = parseInt(parts[2], 10);

  const r1 = r / 255, g1 = g / 255, b1 = b / 255;
  const max = Math.max(r1, g1, b1);
  const min = Math.min(r1, g1, b1);
  let h, s, l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r1: h = (g1 - b1) / d + (g1 < b1 ? 6 : 0); break;
      case g1: h = (b1 - r1) / d + 2; break;
      case b1: h = (r1 - g1) / d + 4; break;
    }
    h /= 6;
  }

  // reduce saturation (toward gray) and darken
  s *= 0.20;
  l *= 0.70;

  function hue2rgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  }

  let q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  let p = 2 * l - q;

  const rOut = hue2rgb(p, q, h + 1/3);
  const gOut = hue2rgb(p, q, h);
  const bOut = hue2rgb(p, q, h - 1/3);

  return `rgba(${Math.round(rOut * 255)},${Math.round(gOut * 255)},${Math.round(bOut * 255)},1)`;
}

/* Apply highlight (vivid) vs non-highlight (desaturated) */
function applyColors(baseColor, labels, highlight) {
  return labels.map(lbl =>
    normalize(lbl) === normalize(highlight)
      ? baseColor           // highlight (vivid)
      : desaturate(baseColor) // non-highlight (gray-themed)
  );
}

/* ============================================================
   PERCENT LABELS
============================================================ */
function percentages(values) {
  const total = values.reduce((a, b) => a + b, 0) || 1;
  return values.map(v => ((v / total) * 100).toFixed(1) + "%");
}

/* ============================================================
   COLOR PALETTES
============================================================ */
const SINGLE_COLORS = {
  condition:              "rgba(79,124,255,1)",   // blue
  gender:                 "rgba(79,124,255,1)",   // donut uses different palette
  age:                    "rgba(147,112,219,1)",  // purple
  race_ethnicity:         "rgba(60,179,113,1)",   // green
  marital_status:         "rgba(255,165,0,1)",    // orange
  education:              "rgba(0,206,209,1)",    // turquoise
  employment_status:      "rgba(186,85,211,1)",   // violet
  annual_income:          "rgba(220,20,60,1)",    // red
  socioeconomic_status:   "rgba(218,165,32,1)",   // goldenrod
  religion:               "rgba(138,43,226,1)",   // deep purple
  religiosity:            "rgba(32,178,170,1)",   // light teal
  political_affiliation:  "rgba(178,34,34,1)",    // burgundy
  political_orientation:  "rgba(70,130,180,1)"    // steel blue
};

/* Donut palette (9 colors, index-matched to GENDER_LABELS) */
const DONUT_COLORS = [
  "rgba(79,124,255,1)",
  "rgba(255,121,198,1)",
  "rgba(80,250,123,1)",
  "rgba(241,250,140,1)",
  "rgba(255,184,108,1)",
  "rgba(189,147,249,1)",
  "rgba(255,85,85,1)",
  "rgba(139,233,253,1)",
  "rgba(98,114,164,1)"
];

/* ============================================================
   BAR CHART COMPONENT
============================================================ */
function BarChart({ fig, figKey, userId }) {
  const { labels, values, highlight, title, subtitle } = fig;
  console.log(
    `[${figKey}]`,
    "highlight =", highlight,
    "| typeof =", typeof highlight,
    "| subtitle =", subtitle
  );

  // Base color for this chart
  const baseColor = SINGLE_COLORS[figKey];

  // Color logic
  const isFilteredUser = userId !== "all";
  const hasAnswer = highlight !== null;

  const highlightSet = normalizeToSet(highlight, figKey);

  const colors = labels.map(lbl => {
    const normLabel = normalize(lbl);

    // All users → vivid
    if (!isFilteredUser) {
      return baseColor;
    }

    // Filtered user but NO answer → fully desaturated
    if (!hasAnswer) {
      return desaturate(baseColor);
    }

    // Filtered user with answer (single or multi)
    // Highlight if label matches ANY selected value
    return highlightSet.has(normLabel)
      ? baseColor
      : desaturate(baseColor);
  });

  // Percent labels
  const perc = percentages(values);

  // Short vs full labels
  const fullLabels = labels;
  const shortLabels = labels.map(l =>
    l.length > 28 ? l.slice(0, 28) + "..." : l
  );

  const subtitleText =
    isFilteredUser && !hasAnswer
      ? `User #${userId}: N/A`
      : subtitle;

  return (
    <Plot
      data={[
        {
          type: "bar",
          orientation: "h",
          y: shortLabels,
          x: values,
          customdata: fullLabels,
          marker: { color: colors },
          text: perc,
          textposition: "outside",
          cliponaxis: false,
          textfont: { color: "#ffffff" },
          hoverlabel: {
            bgcolor: "#1e1e2f",
            font: { color: "#ffffff" }
          },
          hovertemplate:
            "<b>%{customdata}</b><br>" +
            "Count: %{x}<br>" +
            "Percent: %{text}<extra></extra>"
        }
      ]}
      layout={{
        title: {
          text: subtitleText
            ? `${title}<br><span style="font-size:12px;color:#c8d6f0">${subtitleText}</span>`
            : title,
          font: { color: "#ffffff", size: 20 }
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",

        // UNIVERSAL DYNAMIC MARGIN HANDLING
        margin: { t: 70, b: 40, l: 20, r: 48 },

        xaxis: {
          automargin: true,
          title: "Number of Users",
          gridcolor: "rgba(255,255,255,0.1)",
          color: "#ffffff"
        },
        yaxis: {
          automargin: true,
          autorange: "reversed",
          color: "#ffffff",
          gridcolor: "rgba(255,255,255,0.1)"
        }
      }}
      config={{ responsive: true, displaylogo: false }}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 420
      }}
      useResizeHandler
    />
  );
}

/* ============================================================
   DONUT CHART COMPONENT
============================================================ */
function DonutChart({ fig, figKey, userId }) {
  const { labels, values, highlight, title, subtitle } = fig;

  // Color logic
  const isFilteredUser = userId !== "all";
  const hasAnswer = highlight !== null;

  const highlightSet = normalizeToSet(highlight, figKey);

  const colors = labels.map((lbl, i) => {
    const normLabel = normalize(lbl);

    // All users
    if (!isFilteredUser) {
      return DONUT_COLORS[i];
    }

    // Filtered user but NO answer
    if (!hasAnswer) {
      return desaturate(DONUT_COLORS[i]);
    }

    // Filtered user with answer (multi‑select supported)
    return highlightSet.has(normLabel)
      ? DONUT_COLORS[i]
      : desaturate(DONUT_COLORS[i]);
  });

  const subtitleText =
    isFilteredUser && !hasAnswer
      ? `User #${userId}: N/A`
      : subtitle;

  return (
    <Plot
      data={[
        {
          type: "pie",
          labels,
          values,
          hole: 0.55,
          marker: { colors },
          textinfo: "label+percent",
          textfont: { color: "#ffffff" },
          hoverlabel: {
            bgcolor: "#1e1e2f",
            font: { color: "#ffffff" }
          },
          hovertemplate:
            "<b>%{label}</b><br>" +
            "Count: %{value}<br>" +
            "Percent: %{percent}<extra></extra>",
          sort: false
        }
      ]}
      layout={{
        title: {
          text: subtitleText
            ? `${title}<br><span style="font-size:12px;color:#c8d6f0">${subtitleText}</span>`
            : title,
          font: { color: "#ffffff", size: 20 }
        },
        paper_bgcolor: "rgba(0,0,0,0)",
        plot_bgcolor: "rgba(0,0,0,0)",

        margin: { t: 60, b: 120, l: 20, r: 20 },

        automargin: true,

        legend: { font: { color: "#ffffff" } }
      }}
      config={{ responsive: true, displaylogo: false }}
      style={{
        width: "100%",
        height: "100%",
        minHeight: 450
      }}
      useResizeHandler
    />
  );
}

/* ============================================================
   MAIN COMPONENT
============================================================ */

export default function AdminDemographics({ prefetchedData, userId }) {
  if (!prefetchedData) {
    return <div style={{ padding: 20, color: "#c8d6f0" }}>Loading…</div>;
  }

  const ORDER = [
    "condition",
    "gender",
    "age",
    "race_ethnicity",
    "marital_status",
    "education",
    "employment_status",
    "annual_income",
    "socioeconomic_status",
    "religion",
    "religiosity",
    "political_affiliation",
    "political_orientation"
  ];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 40 }}>
      
      {/* ============================================================
          DEMOGRAPHICS CONTEXT TILE
      ============================================================ */}
      <div
        style={{
          background: "#0b1220",
          padding: "18px 24px",
          borderRadius: 10,
          textAlign: "center",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: 28,
            fontWeight: 700,
            color: "#ffffff",
          }}
        >
          Profile
        </h2>

        {userId === "all" ? (
          <p
            style={{
              marginTop: 8,
              fontSize: 20,
              color: "#c8d6f0",
              opacity: 0.85,
            }}
          >
            All Users
          </p>
        ) : (
          <>
            <p
              style={{
                marginTop: 8,
                fontSize: 20,
                color: "#c8d6f0",
                opacity: 0.9,
              }}
            >
              User #{userId}
            </p>

            {prefetchedData?.condition?.highlight && (
              <p
                style={{
                  marginTop: 4,
                  fontSize: 16,
                  color: "#c8d6f0",
                  opacity: 0.75,
                }}
              >
                Condition: {prefetchedData.condition.highlight}
              </p>
            )}
          </>
        )}
      </div>

      {/* -----------------------------------------------------------
          FIRST GRID
        ----------------------------------------------------------- */}
      <div
        style={{
          display: "grid",
          gap: 40,
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))"
        }}
      >
        {[
          "condition",
          "gender",
          "age",
          "race_ethnicity",
          "marital_status",
          "education"
        ].map((key) => {
          const fig = prefetchedData[key];
          if (!fig) return null;
          return (
            <div
              key={key}
              style={{
                background: "#0b1220",
                padding: 20,
                borderRadius: 10,

                maxWidth: "500px",
                width: "100%",
                margin: "0 auto"
              }}
            >
              {fig.type === "bar" && (
                <BarChart fig={fig} figKey={key} userId={userId} />
              )}
              {fig.type === "donut" && (
                <DonutChart fig={fig} figKey={key} userId={userId} />
              )}
            </div>
          );
        })}
      </div>

      {/* -----------------------------------------------------------
          EMPLOYMENT STATUS
        ----------------------------------------------------------- */}
      <div
        style={{
          background: "#0b1220",
          padding: 20,
          borderRadius: 10,
          width: "100%"
        }}
      >
        <BarChart
          fig={prefetchedData["employment_status"]}
          figKey="employment_status"
          userId={userId}
        />
      </div>

      {/* -----------------------------------------------------------
          SECOND GRID
        ----------------------------------------------------------- */}
      <div
        style={{
          display: "grid",
          gap: 40,
          gridTemplateColumns: "repeat(auto-fit, minmax(350px, 1fr))"
        }}
      >
        {[
          "annual_income",
          "socioeconomic_status",
          "religion",
          "religiosity",
          "political_affiliation",
          "political_orientation"
        ].map((key) => {
          const fig = prefetchedData[key];
          if (!fig) return null;
          return (
            <div
              key={key}
              style={{
                background: "#0b1220",
                padding: 20,
                borderRadius: 10,

                maxWidth: "500px",
                width: "100%",
                margin: "0 auto"
              }}
            >
              {fig.type === "bar" && (
                <BarChart fig={fig} figKey={key} userId={userId} />
              )}
              {fig.type === "donut" && (
                <DonutChart fig={fig} figKey={key} userId={userId} />
              )}
            </div>
          );
        })}
      </div>

    </div>
  );
}
