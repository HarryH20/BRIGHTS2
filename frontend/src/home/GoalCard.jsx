import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";
import RadarPlot from "../graphs/RadarPlot.jsx";

const LIKERT = {
  1: "Strongly disagree", 2: "Disagree", 3: "Somewhat disagree",
  4: "Neutral", 5: "Somewhat agree", 6: "Agree", 7: "Strongly agree",
};

const SCORE_COLOR = {
  1: "#d73027", 2: "#fc8d59", 3: "#fee090", 4: "#aaaaaa",
  5: "#91bfdb", 6: "#4575b4", 7: "#2166AC",
};

const TP_ORDER  = ["T6", "T5", "T4", "T3", "T2"];
const TP_CHRON  = ["T2", "T3", "T4", "T5", "T6"];
const TP_LABELS = { T2: "Week 2", T3: "Week 3", T4: "Week 4", T5: "Week 5", T6: "Week 6" };

function avgScores(scores) {
  const vals = ["Q39", "Q40", "Q41"].map(q => scores?.[q]).filter(v => v != null);
  return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
}

function GoalSparkline({ weeklyAvgs, idx, trendingUp }) {
  const color = trendingUp ? "var(--shell-teal)" : "var(--shell-text-secondary)";
  const gradientColor = trendingUp ? "#4FD1C5" : "#A8B0BB";

  const validCount = weeklyAvgs.filter(v => v != null).length;
  if (validCount < 2) return <div style={{ width: 80, height: 32 }} />;

  const W = 80, H = 32, PAD = 4;
  const xStep = (W - PAD * 2) / (weeklyAvgs.length - 1);

  const pts = weeklyAvgs.map((v, i) =>
    v != null
      ? { x: PAD + i * xStep, y: H - PAD - ((v - 1) / 6) * (H - PAD * 2) }
      : null
  );

  const lineParts = [];
  let newSeg = true;
  pts.forEach(pt => {
    if (!pt) { newSeg = true; return; }
    lineParts.push(`${newSeg ? "M" : "L"}${pt.x.toFixed(1)},${pt.y.toFixed(1)}`);
    newSeg = false;
  });

  const validPts = pts.filter(Boolean);
  let fillPath = "";
  if (validPts.length >= 2) {
    fillPath = lineParts.join(" ");
    const last = validPts[validPts.length - 1];
    const first = validPts[0];
    fillPath += ` L${last.x.toFixed(1)},${H} L${first.x.toFixed(1)},${H} Z`;
  }

  const gradId = `sparkGrad-${idx}`;

  return (
    <svg
      width={W}
      height={H}
      style={{
        overflow: "visible",
        filter: trendingUp ? "drop-shadow(0 0 3px rgba(79,209,197,0.4))" : "none",
      }}
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={gradientColor} stopOpacity={0.3} />
          <stop offset="100%" stopColor={gradientColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      {fillPath && <path d={fillPath} fill={`url(#${gradId})`} />}
      <path
        d={lineParts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {validPts.map((pt, i) => (
        <circle key={i} cx={pt.x} cy={pt.y} r={2.5} fill={color} />
      ))}
    </svg>
  );
}

function CountUp({ to, shouldAnimate }) {
  const countMotion = useMotionValue(0);
  const springedCount = useSpring(countMotion, { stiffness: 50, damping: 15 });
  const [displayed, setDisplayed] = useState(shouldAnimate ? "0.0" : (to != null ? to.toFixed(1) : "—"));

  useEffect(() => {
    if (to == null) { setDisplayed("—"); return; }
    if (!shouldAnimate) { setDisplayed(to.toFixed(1)); return; }
    const unsub = springedCount.on("change", v => setDisplayed(v.toFixed(1)));
    countMotion.set(to);
    return unsub;
  }, [to, shouldAnimate]); // eslint-disable-line

  return <span>{displayed}</span>;
}

export default function GoalCard({ goal, idx, radarFigure, colSpan = 4 }) {
  const shouldReduceMotion = useReducedMotion();

  // ── Existing data logic (preserved) ──────────────────────────────────────
  const latestTp = TP_ORDER.find(tp =>
    Object.values(goal.timepoints?.[tp] || {}).some(v => v !== null)
  );
  const latestScores = latestTp ? goal.timepoints[latestTp] : null;

  const latestTpIdx = latestTp ? TP_ORDER.indexOf(latestTp) : -1;
  const prevTpKey = latestTpIdx >= 0 && latestTpIdx < TP_ORDER.length - 1
    ? TP_ORDER[latestTpIdx + 1] : null;
  const prevScores = prevTpKey &&
    Object.values(goal.timepoints?.[prevTpKey] || {}).some(v => v !== null)
    ? goal.timepoints[prevTpKey] : null;

  // ── New derived data ──────────────────────────────────────────────────────
  const weeklyAvgs = TP_CHRON.map(tp => avgScores(goal.timepoints?.[tp]));
  const heroScore = latestScores ? avgScores(latestScores) : null;

  // Baseline = T2 avg (or earliest available)
  const baselineAvg = (() => {
    for (const tp of TP_CHRON) {
      const avg = avgScores(goal.timepoints?.[tp]);
      if (avg != null) return { avg, label: TP_LABELS[tp] };
    }
    return null;
  })();

  const heroScoreDelta = heroScore != null && baselineAvg != null && latestTp !== TP_CHRON[0]
    ? heroScore - baselineAvg.avg : null;

  const validAvgs = weeklyAvgs.filter(v => v != null);
  const trendingUp = validAvgs.length >= 2
    ? validAvgs[validAvgs.length - 1] > validAvgs[0]
    : false;

  const deltaLabel = (() => {
    if (heroScoreDelta == null) return null;
    const abs = Math.abs(heroScoreDelta).toFixed(1);
    if (heroScoreDelta > 0.05) return { arrow: "↑", text: `+${abs} since ${baselineAvg.label}`, up: true };
    if (heroScoreDelta < -0.05) return { arrow: "↓", text: `-${abs} since ${baselineAvg.label}`, up: false };
    return { arrow: "→", text: `No change since ${baselineAvg.label}`, up: null };
  })();

  return (
    <motion.section
      className="card-interactive"
      style={{ ...s.card, gridColumn: `span ${colSpan}` }}
      initial={shouldReduceMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.4, delay: idx * 0.08 }}
    >
      {/* ── Card header ── */}
      <div style={s.cardHeader}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <span style={s.goalPill}>Goal {idx + 1}</span>
          <div style={s.goalTitle}>{goal.text}</div>
        </div>
        <Link to={`/goals/${goal.goal_id}`} style={s.openLink}>Open →</Link>
      </div>

      {/* ── Hero score + sparkline row ── */}
      <div style={s.heroRow}>
        <div>
          <div style={s.heroScore}>
            <CountUp to={heroScore} shouldAnimate={!shouldReduceMotion} />
          </div>
          <div style={s.heroLabel}>/ 7.0 avg</div>

          {/* Delta line */}
          {deltaLabel && (
            <div style={{
              ...s.deltaLine,
              color: deltaLabel.up === true
                ? "var(--shell-teal)"
                : deltaLabel.up === false
                ? "var(--shell-text-secondary)"
                : "var(--shell-text-muted)",
            }}>
              {deltaLabel.arrow} {deltaLabel.text}
            </div>
          )}
        </div>

        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
          <GoalSparkline weeklyAvgs={weeklyAvgs} idx={idx} trendingUp={trendingUp} />
        </div>
      </div>

      {/* ── Three metric rows (preserved data logic, updated colors) ── */}
      <div style={s.metricsBox}>
        {latestScores ? (
          <div style={{ display: "grid", gap: 6 }}>
            {[["Q39", "Progress"], ["Q40", "Confidence"], ["Q41", "Importance"]].map(([q, label]) => (
              <div key={q} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13 }}>
                <span style={{ opacity: 0.6, width: 80, flexShrink: 0, fontSize: 12 }}>{label}</span>
                {latestScores[q] != null ? (
                  <>
                    <span style={{
                      display: "inline-block", width: 8, height: 8,
                      borderRadius: "50%", background: SCORE_COLOR[latestScores[q]], flexShrink: 0,
                    }} />
                    <span style={{ color: "var(--shell-text)", fontSize: 13 }}>{LIKERT[latestScores[q]]}</span>
                    {prevScores?.[q] != null && (() => {
                      const d = latestScores[q] - prevScores[q];
                      return (
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          color: d > 0
                            ? "var(--shell-teal)"
                            : d < 0
                            ? "var(--shell-text-secondary)"
                            : "var(--shell-text-muted)",
                        }}>
                          {d > 0 ? "▲" : d < 0 ? "▼" : "→"}
                        </span>
                      );
                    })()}
                  </>
                ) : (
                  <span style={{ opacity: 0.4 }}>—</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ opacity: 0.6, fontSize: 14 }}>No scores yet.</div>
        )}
      </div>

      {/* ── Radar chart (preserved) ── */}
      <div style={s.graphBox}>
        <RadarPlot figure={radarFigure} />
      </div>
    </motion.section>
  );
}

const s = {
  card: {
    padding: 20,
    borderRadius: 16,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
    boxShadow: "inset 0 1px 0 rgba(255,255,255,0.04)",
    transition: "border-color 200ms ease, box-shadow 200ms ease",
  },
  cardHeader: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 14,
  },
  goalPill: {
    display: "inline-block",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1px",
    textTransform: "uppercase",
    background: "rgba(110,139,255,0.12)",
    color: "var(--shell-accent)",
    borderRadius: 20,
    padding: "2px 8px",
    marginBottom: 6,
  },
  goalTitle: {
    fontSize: 15,
    fontWeight: 600,
    color: "var(--shell-text)",
    lineHeight: 1.4,
  },
  openLink: {
    textDecoration: "none",
    color: "var(--shell-accent)",
    fontWeight: 700,
    fontSize: 12,
    whiteSpace: "nowrap",
    flexShrink: 0,
    marginTop: 2,
  },
  heroRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    gap: 12,
  },
  heroScore: {
    fontSize: 48,
    fontWeight: 300,
    color: "var(--shell-text)",
    lineHeight: 1,
    fontVariantNumeric: "tabular-nums",
  },
  heroLabel: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    marginTop: 2,
  },
  deltaLine: {
    fontSize: 12,
    fontWeight: 600,
    marginTop: 6,
  },
  metricsBox: {
    borderRadius: 10,
    border: "1px solid var(--shell-border)",
    background: "var(--shell-surface-2)",
    padding: "10px 12px",
    marginBottom: 12,
  },
  graphBox: {
    marginTop: 4,
    borderRadius: 12,
    border: "1px solid var(--shell-border)",
    background: "#0b1220",
    paddingBottom: 8,
  },
};
