import React from "react";
import { Link, useLocation } from "react-router-dom";
import { LayoutDashboard, Target, TrendingUp, User, Shield } from "lucide-react";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/goals",     label: "My Goals",  icon: Target          },
  { to: "/overview",  label: "Progress",  icon: TrendingUp      },
  { to: "/profile",   label: "Profile",   icon: User            },
];

export default function HomeLayout({ user, onLogout, children }) {
  const { pathname } = useLocation();

  return (
    <div className="home-page" style={s.page}>
      <header className="home-header" style={s.header}>
        <div style={s.navInner}>
          {/* Brand */}
          <Link to="/dashboard" style={s.brand}>
            <span className="brand-full">BRIGHTS2</span>
            <span className="brand-short">B2</span>
          </Link>

          {/* Nav links */}
          <nav style={s.nav} className="home-nav">
            {NAV.map(({ to, label, icon: Icon }) => {
              const active =
                pathname === to ||
                (to !== "/" && pathname.startsWith(to + "/"));
              return (
                <Link
                  key={to}
                  to={to}
                  className="nav-item"
                  style={{ ...s.navLink, ...(active ? s.navActive : {}) }}
                >
                  <Icon size={15} />
                  <span className="nav-label">{label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Actions */}
          <div style={s.actions}>
            {user?.role === "admin" && (
              <Link to="/admin" className="nav-item" style={s.actionLink}>
                <Shield size={14} />
                <span className="nav-label">Admin</span>
              </Link>
            )}
            <button type="button" onClick={onLogout} style={s.logoutBtn}>
              Logout
            </button>
          </div>
        </div>
      </header>

      <main className="home-main" style={s.main}>{children}</main>

      {user?.participant_id && (
        <div style={s.pid}>ID: {user.participant_id}</div>
      )}
    </div>
  );
}

export const styles = {};

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--page-bg)",
    color: "var(--text-primary)",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    background: "var(--header-bg)",
    borderBottom: "1px solid var(--header-border)",
    backdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    height: 56,
    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
  },
  navInner: {
    width: "100%",
    maxWidth: 1100,
    padding: "0 24px",
    display: "grid",
    gridTemplateColumns: "auto 1fr auto",
    gap: 16,
    alignItems: "center",
  },
  brand: {
    fontWeight: 900,
    fontSize: 18,
    letterSpacing: "0.06em",
    color: "var(--text-primary)",
    textDecoration: "none",
    flexShrink: 0,
  },
  nav: {
    display: "flex",
    justifyContent: "center",
    gap: 4,
  },
  navLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 10,
    border: "1px solid transparent",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 13,
    color: "var(--text-dim)",
  },
  navActive: {
    color: "var(--text-primary)",
    background: "rgba(79,124,255,0.14)",
    border: "1px solid rgba(79,124,255,0.22)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  actionLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    padding: "7px 12px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 13,
    color: "var(--text-dim)",
  },
  logoutBtn: {
    padding: "7px 14px",
    borderRadius: 10,
    border: "1px solid rgba(248,113,113,0.3)",
    background: "rgba(248,113,113,0.08)",
    color: "#f87171",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  main: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: 24,
  },
  pid: {
    position: "fixed",
    bottom: 12,
    right: 16,
    fontSize: 10,
    opacity: 0.25,
    color: "#c8d6f0",
    fontFamily: "monospace",
    letterSpacing: "0.05em",
    pointerEvents: "none",
    userSelect: "none",
  },
};
