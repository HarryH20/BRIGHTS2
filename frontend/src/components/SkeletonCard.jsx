import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

export default function SkeletonCard({ height = 380, label = "Loading chart..." }) {
  const baseColor = getComputedStyle(document.documentElement).getPropertyValue("--surface-subtle").trim() || "rgba(255,255,255,0.03)";
  const highlightColor = getComputedStyle(document.documentElement).getPropertyValue("--ghost-bg").trim() || "rgba(255,255,255,0.06)";

  return (
    <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
      <div style={s.container}>
        <Skeleton style={{ borderRadius: 10, display: "block" }} height={height} />
        {label && <div style={s.label}>{label}</div>}
      </div>
    </SkeletonTheme>
  );
}

const s = {
  container: {
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    padding: 16,
    overflow: "hidden",
  },
  label: {
    marginTop: 10,
    fontSize: 12,
    color: "var(--text-dim)",
    textAlign: "center",
    opacity: 0.6,
  },
};
