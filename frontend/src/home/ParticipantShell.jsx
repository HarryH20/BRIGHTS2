import React, { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  Target,
  TrendingUp,
  User,
  Shield,
  ClipboardList,
} from "lucide-react";
import NotificationBell from "./NotificationBell.jsx";
import { SurveyContext } from "./SurveyContext.jsx";

const NAV = [
  { to: "/dashboard", label: "Home",     icon: LayoutDashboard },
  { to: "/goals",     label: "Goals",    icon: Target          },
  { to: "/overview",  label: "Progress", icon: TrendingUp      },
  { to: "/profile",   label: "Profile",  icon: User            },
];

function isActive(pathname, to) {
  return pathname === to || (to !== "/" && pathname.startsWith(to + "/"));
}

export default function ParticipantShell({ user, onLogout, children, title }) {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [surveyInfo, setSurveyInfo] = useState(null);

  useEffect(() => {
    fetch("/api/survey/next", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setSurveyInfo(d))
      .catch(() => {});
  }, []);

  const displayName = user?.display_name || user?.username || "";
  const truncName = displayName.length > 12 ? displayName.slice(0, 12) + "…" : displayName;
  const surveyDue = surveyInfo?.status === "due";

  return (
    <div style={s.page}>
      {/* ── Top bar ── */}
      <header style={s.header}>
        <div style={s.headerInner}>
          {/* Wordmark */}
          <Link to="/dashboard" style={s.brand}>BRIGHTS2</Link>

          {/* Desktop nav pills */}
          <nav style={s.desktopNav} className="participant-desktop-nav">
            {NAV.map(({ to, label }) => {
              const active = isActive(pathname, to);
              return (
                <Link
                  key={to}
                  to={to}
                  style={{
                    ...s.pill,
                    ...(active ? s.pillActive : {}),
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* Right actions */}
          <div style={s.actions}>
            {user?.role === "admin" && (
              <Link to="/admin" style={s.adminLink}>
                <Shield size={14} />
                <span>Admin Panel</span>
              </Link>
            )}
            <NotificationBell userId={user?.id} />
            {user?.avatar_url ? (
              <img src={user.avatar_url} alt="" style={s.avatar} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {displayName.charAt(0).toUpperCase() || "?"}
              </div>
            )}
            <span style={s.nameLabel} className="participant-name-label">{truncName}</span>
            <button onClick={onLogout} style={s.logoutBtn} type="button">
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* ── Main content ── */}
      <main style={s.main} className="participant-main">
        <SurveyContext.Provider value={surveyInfo}>
          {children}
        </SurveyContext.Provider>
      </main>

      {/* ── Participant ID watermark ── */}
      {user?.participant_id && (
        <div style={s.pid}>ID: {user.participant_id}</div>
      )}

      {/* ── Mobile bottom nav ── */}
      <nav style={s.bottomNav} className="participant-bottom-nav">
        {/* Home */}
        <BottomTab
          to="/dashboard"
          label="Home"
          icon={LayoutDashboard}
          active={isActive(pathname, "/dashboard")}
        />
        {/* Goals */}
        <BottomTab
          to="/goals"
          label="Goals"
          icon={Target}
          active={isActive(pathname, "/goals")}
        />

        {/* FAB (survey due) or Progress tab (survey not due) */}
        {surveyDue ? (
          <motion.button
            type="button"
            onClick={() => navigate("/survey")}
            style={s.fab}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 260, damping: 20, duration: 0.3 }}
            whileTap={{ scale: 0.93 }}
          >
            <ClipboardList size={22} color="#fff" />
          </motion.button>
        ) : (
          <BottomTab
            to="/overview"
            label="Progress"
            icon={TrendingUp}
            active={isActive(pathname, "/overview")}
          />
        )}

        {/* Progress (always shown alongside FAB when survey due) */}
        {surveyDue && (
          <BottomTab
            to="/overview"
            label="Progress"
            icon={TrendingUp}
            active={isActive(pathname, "/overview")}
          />
        )}

        {/* Profile */}
        <BottomTab
          to="/profile"
          label="Profile"
          icon={User}
          active={isActive(pathname, "/profile")}
        />
      </nav>
    </div>
  );
}

function BottomTab({ to, label, icon: Icon, active }) {
  return (
    <Link to={to} style={{ ...s.bottomTab, ...(active ? s.bottomTabActive : {}) }}>
      <Icon size={22} />
      <span style={s.bottomTabLabel}>{label}</span>
    </Link>
  );
}

const s = {
  page: {
    minHeight: "100vh",
    background: "var(--page-bg)",
    color: "var(--shell-text)",
    display: "flex",
    flexDirection: "column",
  },
  header: {
    position: "sticky",
    top: 0,
    zIndex: 100,
    height: 56,
    background: "var(--shell-bg-elevated)",
    borderBottom: "1px solid var(--shell-border)",
    backdropFilter: "blur(12px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  headerInner: {
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
    fontSize: 14,
    letterSpacing: "2px",
    color: "var(--shell-accent)",
    textDecoration: "none",
    flexShrink: 0,
  },
  desktopNav: {
    display: "flex",
    justifyContent: "center",
    gap: 4,
  },
  pill: {
    display: "inline-flex",
    alignItems: "center",
    padding: "6px 14px",
    borderRadius: 20,
    fontSize: 13,
    fontWeight: 600,
    color: "var(--shell-text-muted)",
    background: "transparent",
    border: "1px solid transparent",
    textDecoration: "none",
    transition: "all 150ms ease",
  },
  pillActive: {
    background: "var(--sidebar-active-bg)",
    color: "var(--shell-accent)",
    border: "1px solid rgba(110,139,255,0.3)",
  },
  actions: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    flexShrink: 0,
  },
  adminLink: {
    display: "inline-flex",
    alignItems: "center",
    gap: 5,
    padding: "6px 10px",
    borderRadius: 10,
    border: "1px solid var(--shell-border-strong)",
    background: "var(--shell-surface-2)",
    textDecoration: "none",
    fontWeight: 600,
    fontSize: 12,
    color: "var(--shell-text-secondary)",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    objectFit: "cover",
    border: "1px solid var(--shell-border-strong)",
  },
  avatarPlaceholder: {
    width: 28,
    height: 28,
    borderRadius: "50%",
    background: "var(--sidebar-active-bg)",
    border: "1px solid rgba(110,139,255,0.3)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 12,
    fontWeight: 700,
    color: "var(--shell-accent)",
    flexShrink: 0,
  },
  nameLabel: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--shell-text-secondary)",
  },
  logoutBtn: {
    padding: "6px 12px",
    borderRadius: 10,
    border: "1px solid rgba(242,109,123,0.3)",
    background: "rgba(242,109,123,0.08)",
    color: "#F26D7B",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  main: {
    flex: 1,
    maxWidth: "100%",
  },
  pid: {
    position: "fixed",
    bottom: 72,
    right: 16,
    fontSize: 10,
    opacity: 0.2,
    color: "#c8d6f0",
    fontFamily: "monospace",
    letterSpacing: "0.05em",
    pointerEvents: "none",
    userSelect: "none",
  },
  bottomNav: {
    position: "fixed",
    bottom: 0,
    left: 0,
    right: 0,
    height: 56,
    background: "var(--shell-bg-elevated)",
    borderTop: "1px solid var(--shell-border)",
    backdropFilter: "blur(12px)",
    display: "flex",
    justifyContent: "space-around",
    alignItems: "center",
    paddingBottom: "env(safe-area-inset-bottom)",
    zIndex: 100,
  },
  bottomTab: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 3,
    color: "var(--shell-text-muted)",
    textDecoration: "none",
    padding: "4px 8px",
    minWidth: 44,
    minHeight: 44,
    justifyContent: "center",
  },
  bottomTabActive: {
    color: "var(--shell-accent)",
  },
  bottomTabLabel: {
    fontSize: 10,
    fontWeight: 500,
    lineHeight: 1,
  },
  fab: {
    position: "relative",
    bottom: 10,
    width: 52,
    height: 52,
    borderRadius: "50%",
    background: "var(--shell-accent)",
    boxShadow: "0 4px 16px rgba(110,139,255,0.4)",
    border: "none",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
};
