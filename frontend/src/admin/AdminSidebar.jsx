import React, { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  LayoutDashboard, Users, User, Target, BarChart3, MessageSquare,
  GitMerge, FileText, TrendingUp, FlaskConical, Shield, Download,
  ChevronLeft, ChevronRight, ArrowLeft, LogOut, UserCheck, ShieldAlert, Shuffle,
} from "lucide-react";

const NAV_GROUPS = [
  {
    label: null,
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, exact: true },
    ],
  },
  {
    label: "PARTICIPANTS",
    items: [
      { to: "/admin/sessions",    label: "Sessions",      icon: Users },
      { to: "/admin/users",       label: "Participants",  icon: User },
      { to: "/admin/goals",       label: "Goal Progress", icon: Target },
      { to: "/admin/conditions",  label: "Conditions",    icon: Shuffle },
    ],
  },
  {
    label: "ANALYSIS",
    items: [
      { to: "/admin/demographics", label: "Demographics", icon: BarChart3 },
      { to: "/admin/linguistics",  label: "Linguistics",  icon: MessageSquare },
      { to: "/admin/alluvial",     label: "Alluvial",     icon: GitMerge },
      { to: "/admin/questions",    label: "Questions",    icon: FileText },
      { to: "/admin/stats",        label: "Stats",        icon: TrendingUp },
      { to: "/admin/quality",      label: "Data Quality", icon: ShieldAlert },
    ],
  },
  {
    label: "STUDY",
    items: [
      { to: "/admin/study",        label: "Study",       icon: FlaskConical },
      { to: "/admin/researchers",  label: "Researchers", icon: UserCheck },
      { to: "/admin/audit",        label: "Audit Log",   icon: Shield },
      { to: "/admin/export",       label: "Export",      icon: Download },
    ],
  },
];

function SidebarTooltip({ label, collapsed, children }) {
  const [show, setShow] = useState(false);
  if (!collapsed) return children;
  return (
    <div
      style={{ position: "relative" }}
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}
      {show && (
        <div style={tt}>
          {label}
        </div>
      )}
    </div>
  );
}

const tt = {
  position: "absolute",
  left: "calc(100% + 8px)",
  top: "50%",
  transform: "translateY(-50%)",
  background: "var(--shell-bg-overlay)",
  border: "1px solid var(--shell-border-strong)",
  color: "var(--shell-text)",
  padding: "5px 10px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 500,
  whiteSpace: "nowrap",
  zIndex: 1000,
  pointerEvents: "none",
  boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
};

export default function AdminSidebar({ user, onLogout }) {
  const { pathname } = useLocation();
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem("admin_sidebar_collapsed") === "true";
    } catch {
      return false;
    }
  });

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    try { localStorage.setItem("admin_sidebar_collapsed", String(next)); } catch {}
  }

  function isActive(item) {
    if (item.exact) return pathname === item.to;
    return pathname === item.to || pathname.startsWith(item.to + "/");
  }

  const w = collapsed ? "var(--sidebar-width-icon)" : "var(--sidebar-width)";

  return (
    <aside
      style={{
        ...s.sidebar,
        width: w,
        minWidth: w,
        transition: "width 200ms ease, min-width 200ms ease",
      }}
    >
      {/* Brand */}
      <div style={s.brand}>
        <div style={s.brandInner}>
          {collapsed ? (
            <span style={s.brandMonogram}>B2</span>
          ) : (
            <div style={s.brandFull}>
              <span style={s.brandName}>BRIGHTS2</span>
              <span style={s.brandSub}>Research Platform</span>
            </div>
          )}
        </div>
        <button style={s.collapseBtn} onClick={toggleCollapsed} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}
        </button>
      </div>

      {/* Nav */}
      <nav style={s.nav}>
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi} style={s.group}>
            {group.label && !collapsed && (
              <div style={s.groupLabel}>{group.label}</div>
            )}
            {group.items.map((item) => {
              const active = isActive(item);
              const Icon = item.icon;
              return (
                <SidebarTooltip key={item.to} label={item.label} collapsed={collapsed}>
                  <Link
                    to={item.to}
                    style={{
                      ...s.navItem,
                      ...(active ? s.navItemActive : {}),
                      justifyContent: collapsed ? "center" : "flex-start",
                      padding: collapsed ? "0 8px" : "0 12px",
                    }}
                    title={collapsed ? item.label : undefined}
                  >
                    <Icon size={16} style={{ flexShrink: 0, color: active ? "var(--shell-accent)" : undefined }} />
                    {!collapsed && <span style={s.navLabel}>{item.label}</span>}
                  </Link>
                </SidebarTooltip>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={s.footer}>
        <SidebarTooltip label="View as Participant" collapsed={collapsed}>
          <Link to="/dashboard" style={{ ...s.footerLink, justifyContent: collapsed ? "center" : "flex-start" }}>
            <ArrowLeft size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>View as Participant</span>}
          </Link>
        </SidebarTooltip>

        <div style={{ ...s.userRow, justifyContent: collapsed ? "center" : "flex-start" }}>
          <div style={s.avatar}>
            {(user?.display_name || user?.username || "A")[0].toUpperCase()}
          </div>
          {!collapsed && (
            <span style={s.userName}>
              {user?.display_name || user?.username || "Admin"}
            </span>
          )}
        </div>

        <SidebarTooltip label="Log out" collapsed={collapsed}>
          <button
            style={{ ...s.logoutBtn, justifyContent: collapsed ? "center" : "flex-start" }}
            onClick={onLogout}
          >
            <LogOut size={14} style={{ flexShrink: 0 }} />
            {!collapsed && <span>Log out</span>}
          </button>
        </SidebarTooltip>
      </div>
    </aside>
  );
}

const s = {
  sidebar: {
    display: "flex",
    flexDirection: "column",
    height: "100vh",
    background: "var(--sidebar-bg)",
    borderRight: "1px solid var(--sidebar-border)",
    flexShrink: 0,
    overflow: "hidden",
  },
  brand: {
    height: 56,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottom: "1px solid var(--sidebar-border)",
    padding: "0 12px",
    flexShrink: 0,
  },
  brandInner: {
    flex: 1,
    overflow: "hidden",
  },
  brandFull: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
  },
  brandName: {
    fontWeight: 900,
    fontSize: 14,
    letterSpacing: "2px",
    color: "var(--shell-accent)",
    whiteSpace: "nowrap",
  },
  brandSub: {
    fontSize: 10,
    color: "var(--shell-text-muted)",
    whiteSpace: "nowrap",
  },
  brandMonogram: {
    fontWeight: 900,
    fontSize: 16,
    color: "var(--shell-accent)",
    display: "block",
    textAlign: "center",
  },
  collapseBtn: {
    width: 24,
    height: 24,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "none",
    border: "none",
    color: "var(--sidebar-text)",
    cursor: "pointer",
    borderRadius: 6,
    flexShrink: 0,
    padding: 0,
  },
  nav: {
    flex: 1,
    overflowY: "auto",
    overflowX: "hidden",
    padding: "8px 0",
  },
  group: {
    marginBottom: 4,
  },
  groupLabel: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "1.5px",
    textTransform: "uppercase",
    color: "var(--sidebar-group-label)",
    padding: "16px 20px 4px",
    whiteSpace: "nowrap",
  },
  navItem: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    height: 36,
    margin: "1px 8px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 500,
    color: "var(--sidebar-text)",
    transition: "background 150ms ease, color 150ms ease",
    cursor: "pointer",
    overflow: "hidden",
  },
  navItemActive: {
    background: "var(--sidebar-active-bg)",
    color: "var(--sidebar-text-active)",
    fontWeight: 600,
  },
  navLabel: {
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  footer: {
    borderTop: "1px solid var(--sidebar-border)",
    padding: "8px 0",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flexShrink: 0,
  },
  footerLink: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 34,
    margin: "1px 8px",
    padding: "0 12px",
    borderRadius: 8,
    textDecoration: "none",
    fontSize: 13,
    color: "var(--shell-text-muted)",
    transition: "color 150ms ease",
    overflow: "hidden",
    whiteSpace: "nowrap",
  },
  userRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    padding: "0 20px",
    height: 34,
    overflow: "hidden",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--sidebar-active-bg)",
    border: "1px solid var(--shell-border-strong)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--shell-accent)",
    flexShrink: 0,
  },
  userName: {
    fontSize: 13,
    color: "var(--shell-text-secondary)",
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  logoutBtn: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    height: 34,
    margin: "1px 8px",
    padding: "0 12px",
    borderRadius: 8,
    background: "none",
    border: "none",
    fontSize: 13,
    color: "var(--shell-text-muted)",
    cursor: "pointer",
    transition: "color 150ms ease, background 150ms ease",
    overflow: "hidden",
    whiteSpace: "nowrap",
    width: "calc(100% - 16px)",
    textAlign: "left",
  },
};
