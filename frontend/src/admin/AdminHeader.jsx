import React from "react";

export default function AdminHeader({ title, subtitle, actions }) {
  return (
    <header style={s.header}>
      <div style={s.left}>
        {title && <div style={s.title}>{title}</div>}
        {subtitle && <div style={s.subtitle}>{subtitle}</div>}
      </div>
      {actions && <div style={s.actions}>{actions}</div>}
    </header>
  );
}

const s = {
  header: {
    height: 56,
    borderBottom: "1px solid var(--shell-border)",
    background: "var(--shell-bg)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0 24px",
    position: "sticky",
    top: 0,
    zIndex: 10,
    flexShrink: 0,
  },
  left: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  title: {
    fontSize: 16,
    fontWeight: 700,
    color: "var(--shell-text)",
    lineHeight: 1.2,
  },
  subtitle: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    lineHeight: 1.2,
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
};
