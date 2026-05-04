import React from "react";
import Skeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";

/**
 * Shared loading/error/empty wrapper for admin chart components.
 * Accepts:
 *   loading     — show skeleton
 *   error       — show error message with optional retry
 *   onRetry     — callback for retry button
 *   empty       — show "no data" message
 *   title       — card title (optional, shown above filterSlot)
 *   filterSlot  — JSX rendered above the chart (filters, selects)
 *   height      — chart area height in px (default 400)
 *   children    — the actual chart element
 */
export default function AdminChartWrapper({
  loading,
  error,
  onRetry,
  empty,
  title,
  subtitle,
  filterSlot,
  height = 400,
  children,
}) {
  const baseColor      = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--surface-subtle').trim() || 'rgba(255,255,255,0.03)'
    : 'rgba(255,255,255,0.03)';
  const highlightColor = typeof window !== 'undefined'
    ? getComputedStyle(document.documentElement).getPropertyValue('--ghost-bg').trim() || 'rgba(255,255,255,0.06)'
    : 'rgba(255,255,255,0.06)';

  return (
    <div style={s.card}>
      {title && <h3 style={s.title}>{title}</h3>}
      {subtitle && <p style={s.subtitle}>{subtitle}</p>}

      {filterSlot && <div style={s.filters}>{filterSlot}</div>}

      <div style={{ ...s.chartArea, minHeight: height }}>
        {loading && (
          <Skeleton
            height={height}
            baseColor={baseColor}
            highlightColor={highlightColor}
            style={{ borderRadius: 10, display: 'block' }}
          />
        )}

        {!loading && error && (
          <div style={s.stateBox}>
            <div style={s.errorIcon}>⚠</div>
            <p style={s.stateText}>{error}</p>
            {onRetry && (
              <button style={s.retryBtn} onClick={onRetry}>
                Retry
              </button>
            )}
          </div>
        )}

        {!loading && !error && empty && (
          <div style={s.stateBox}>
            <p style={s.stateText}>No data available for the current selection.</p>
          </div>
        )}

        {!loading && !error && !empty && children}
      </div>
    </div>
  );
}

const s = {
  card: {
    borderRadius: 16,
    border: '1px solid var(--card-border)',
    background: 'var(--card-bg)',
    boxShadow: '0 12px 30px rgba(0,0,0,0.32)',
    backdropFilter: 'blur(8px)',
    padding: 20,
    marginBottom: 24,
  },
  title: {
    margin: '0 0 4px',
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text-primary)',
  },
  subtitle: {
    margin: '0 0 12px',
    fontSize: 12,
    color: 'var(--text-dim)',
    lineHeight: 1.45,
  },
  filters: {
    marginBottom: 14,
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  chartArea: {
    width: '100%',
    position: 'relative',
  },
  stateBox: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    minHeight: 180,
    gap: 12,
    color: 'var(--text-dim)',
    textAlign: 'center',
  },
  errorIcon: {
    fontSize: 32,
    color: 'var(--error-color)',
  },
  stateText: {
    margin: 0,
    fontSize: 14,
    lineHeight: 1.5,
    color: 'var(--text-dim)',
  },
  retryBtn: {
    padding: '8px 20px',
    borderRadius: 10,
    border: '1px solid var(--accent-border)',
    background: 'var(--accent-hover)',
    color: 'var(--ghost-color)',
    fontWeight: 600,
    fontSize: 13,
    cursor: 'pointer',
  },
};
