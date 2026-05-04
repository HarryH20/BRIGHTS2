import React from "react";
import { useNavigate } from "react-router-dom";
import { motion, useReducedMotion } from "framer-motion";
import { Check } from "lucide-react";

function formatDate(isoString) {
  if (!isoString) return "";
  const d = new Date(isoString);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function nodeState(t, currentTimepoint) {
  if (t.completed) return "completed";
  if (currentTimepoint != null && t.timepoint === currentTimepoint) return "current";
  if (currentTimepoint != null && t.timepoint < currentTimepoint) return "missed";
  return "upcoming";
}

function segmentStyle(leftState, rightState) {
  if (leftState === "completed" && rightState === "completed") {
    return { background: "var(--shell-teal)" };
  }
  if (leftState === "completed" && rightState === "current") {
    return { background: "linear-gradient(to right, var(--shell-teal), var(--shell-accent))" };
  }
  return { background: "var(--shell-border)" };
}

function nodeSize(state, compact) {
  if (state === "current") return compact ? 32 : 44;
  return compact ? 28 : 40;
}

export default function JourneyPath({ surveyCompletion, currentTimepoint, compact = false }) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();

  if (!surveyCompletion || surveyCompletion.length === 0) return null;

  const timepoints = [...surveyCompletion].sort((a, b) => a.timepoint - b.timepoint);

  return (
    <div style={{ display: "flex", alignItems: "center", padding: compact ? "8px 0" : "16px 0", gap: 0 }}>
      {timepoints.map((t, i) => {
        const state = nodeState(t, currentTimepoint);
        const size = nodeSize(state, compact);
        const isLast = i === timepoints.length - 1;

        return (
          <React.Fragment key={t.timepoint}>
            {/* Node */}
            <motion.div
              initial={shouldReduceMotion ? {} : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={shouldReduceMotion ? {} : { duration: 0.3, delay: i * 0.06 }}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}
            >
              {/* Glow ring for current node */}
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {state === "current" && !shouldReduceMotion && (
                  <motion.div
                    style={{
                      position: "absolute",
                      width: size + 8,
                      height: size + 8,
                      borderRadius: "50%",
                      border: "2px solid var(--shell-accent)",
                    }}
                    animate={{
                      opacity: [0.6, 0.15, 0.6],
                      scale: [1, 1.08, 1],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                )}
                {state === "current" && shouldReduceMotion && (
                  <div
                    style={{
                      position: "absolute",
                      width: size + 8,
                      height: size + 8,
                      borderRadius: "50%",
                      border: "2px solid rgba(110,139,255,0.3)",
                    }}
                  />
                )}

                {/* Node circle */}
                <div
                  role={t.completed ? "button" : undefined}
                  tabIndex={t.completed ? 0 : undefined}
                  onClick={t.completed ? () => navigate(`/survey/week/${t.timepoint}`) : undefined}
                  onKeyDown={t.completed ? (e) => e.key === "Enter" && navigate(`/survey/week/${t.timepoint}`) : undefined}
                  title={
                    state === "completed" && t.submitted_at
                      ? `Week ${t.timepoint} — completed ${formatDate(t.submitted_at)}`
                      : state === "missed"
                      ? `Week ${t.timepoint} — window closed`
                      : `Week ${t.timepoint}`
                  }
                  style={{
                    width: size,
                    height: size,
                    borderRadius: "50%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: t.completed ? "pointer" : "default",
                    transition: "transform 150ms ease",
                    flexShrink: 0,
                    position: "relative",
                    zIndex: 1,
                    ...(state === "completed" && {
                      background: "var(--shell-teal)",
                      border: "2px solid var(--shell-teal)",
                    }),
                    ...(state === "current" && {
                      background: "rgba(110,139,255,0.15)",
                      border: "2px solid var(--shell-accent)",
                    }),
                    ...(state === "upcoming" && {
                      background: "transparent",
                      border: "2px solid var(--shell-border-strong)",
                      opacity: 0.5,
                    }),
                    ...(state === "missed" && {
                      background: "var(--shell-surface-2)",
                      border: "2px dashed var(--shell-border-strong)",
                    }),
                  }}
                >
                  {state === "completed" ? (
                    <Check size={compact ? 12 : 16} color="#fff" strokeWidth={3} />
                  ) : (
                    <span style={{
                      fontSize: compact ? 11 : 13,
                      fontWeight: state === "current" ? 800 : 600,
                      color: state === "current" ? "var(--shell-accent)" : "var(--shell-text-muted)",
                      lineHeight: 1,
                    }}>
                      {t.timepoint}
                    </span>
                  )}
                </div>
              </div>

              {/* Date label (full size only) */}
              {!compact && (
                <span style={{
                  marginTop: 6,
                  fontSize: 10,
                  color: "var(--shell-text-muted)",
                  minHeight: 14,
                  textAlign: "center",
                  whiteSpace: "nowrap",
                }}>
                  {state === "completed" && t.submitted_at ? formatDate(t.submitted_at) : ""}
                  {state === "current" ? (
                    <span style={{ color: "var(--shell-accent)", fontWeight: 600 }}>This week</span>
                  ) : null}
                </span>
              )}
            </motion.div>

            {/* Connecting line (not after last node) */}
            {!isLast && (() => {
              const nextT = timepoints[i + 1];
              const nextState = nodeState(nextT, currentTimepoint);
              return (
                <div style={{
                  flex: 1,
                  height: 2,
                  minWidth: compact ? 8 : 12,
                  marginBottom: compact ? 0 : 14,
                  ...segmentStyle(state, nextState),
                }} />
              );
            })()}
          </React.Fragment>
        );
      })}
    </div>
  );
}
