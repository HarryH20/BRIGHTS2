import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SkeletonGoalCard() {
  const baseColor = getComputedStyle(document.documentElement).getPropertyValue("--surface-subtle").trim() || "rgba(255,255,255,0.03)";
  const highlightColor = getComputedStyle(document.documentElement).getPropertyValue("--ghost-bg").trim() || "rgba(255,255,255,0.06)";

  return (
    <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
      <div style={s.container}>
        {/* Goal title row */}
        <div style={s.titleRow}>
          <Skeleton height={20} width="60%" style={{ borderRadius: 6 }} />
          <Skeleton height={20} width={52} style={{ borderRadius: 6 }} />
        </div>

        {/* Score rows */}
        <div style={s.scoreBox}>
          <Skeleton height={14} style={{ borderRadius: 6, marginBottom: 8 }} />
          <Skeleton height={14} style={{ borderRadius: 6, marginBottom: 8 }} />
          <Skeleton height={14} style={{ borderRadius: 6 }} />
        </div>

        {/* Radar chart area */}
        <div style={s.radarArea}>
          <Skeleton height={200} style={{ borderRadius: 10, display: "block" }} />
        </div>
      </div>
    </SkeletonTheme>
  );
}

const s = {
  container: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },
  titleRow: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 12,
  },
  scoreBox: {
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
    padding: 12,
    marginBottom: 12,
  },
  radarArea: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden",
  },
};
