import React from "react";
import Skeleton, { SkeletonTheme } from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/**
 * Placeholder shown while an admin tab's initial data load is in flight.
 * Renders N chart-shaped skeletons stacked vertically.
 */
export default function SkeletonAdminTab({ charts = 2, chartHeight = 360 }) {
  const baseColor      = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--surface-subtle').trim() || 'rgba(255,255,255,0.03)'
    : 'rgba(255,255,255,0.03)';
  const highlightColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--ghost-bg').trim() || 'rgba(255,255,255,0.06)'
    : 'rgba(255,255,255,0.06)';

  return (
    <SkeletonTheme baseColor={baseColor} highlightColor={highlightColor}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {Array.from({ length: charts }).map((_, i) => (
          <div key={i} style={card}>
            {/* Filter row placeholder */}
            <div style={filterRow}>
              <Skeleton height={32} width={140} style={{ borderRadius: 8 }} />
              <Skeleton height={32} width={140} style={{ borderRadius: 8 }} />
              <Skeleton height={32} width={100} style={{ borderRadius: 8 }} />
            </div>
            {/* Chart area placeholder */}
            <Skeleton height={chartHeight} style={{ borderRadius: 10, display: 'block' }} />
          </div>
        ))}
      </div>
    </SkeletonTheme>
  );
}

const card = {
  padding: 20,
  borderRadius: 16,
  border: '1px solid var(--card-border)',
  background: 'var(--card-bg)',
  boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
  backdropFilter: 'blur(8px)',
};

const filterRow = {
  display: 'flex',
  gap: 10,
  marginBottom: 16,
};
