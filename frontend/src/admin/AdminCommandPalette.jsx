import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, User, Target, BarChart3, MessageSquare,
  GitMerge, FileText, TrendingUp, FlaskConical, Shield, Download, Search,
} from "lucide-react";

const ALL_ITEMS = [
  { label: "Overview",      path: "/admin",                 icon: LayoutDashboard, group: "Navigation" },
  { label: "Sessions",      path: "/admin/sessions",        icon: Users,           group: "Participants" },
  { label: "Participants",  path: "/admin/users",           icon: User,            group: "Participants" },
  { label: "Goal Progress", path: "/admin/goals",           icon: Target,          group: "Participants" },
  { label: "Demographics",  path: "/admin/demographics",    icon: BarChart3,       group: "Analysis" },
  { label: "Linguistics",   path: "/admin/linguistics",     icon: MessageSquare,   group: "Analysis" },
  { label: "Alluvial",      path: "/admin/alluvial",        icon: GitMerge,        group: "Analysis" },
  { label: "Questions",     path: "/admin/questions",       icon: FileText,        group: "Analysis" },
  { label: "Stats",         path: "/admin/stats",           icon: TrendingUp,      group: "Analysis" },
  { label: "Study",         path: "/admin/study",           icon: FlaskConical,    group: "Study" },
  { label: "Audit Log",     path: "/admin/audit",           icon: Shield,          group: "Study" },
  { label: "Export",        path: "/admin/export",          icon: Download,        group: "Study" },
  { label: "Search participants", path: "/admin/users",     icon: Search,          group: "Actions" },
];

export default function AdminCommandPalette({ open, onClose }) {
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const filtered = query.trim()
    ? ALL_ITEMS.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase()) ||
        item.group.toLowerCase().includes(query.toLowerCase())
      )
    : ALL_ITEMS;

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  function goTo(item) {
    if (item.label === "Search participants") {
      navigate("/admin/users?search=");
    } else {
      navigate(item.path);
    }
    onClose();
  }

  function handleKeyDown(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[activeIdx]) goTo(filtered[activeIdx]);
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  if (!open) return null;

  return (
    <div style={s.backdrop} onClick={onClose}>
      <div style={s.card} onClick={(e) => e.stopPropagation()}>
        <div style={s.inputRow}>
          <Search size={16} style={{ color: "var(--shell-text-muted)", flexShrink: 0 }} />
          <input
            ref={inputRef}
            style={s.input}
            placeholder="Search pages or actions…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd style={s.kbd}>ESC</kbd>
        </div>

        <div style={s.list}>
          {filtered.length === 0 && (
            <div style={s.empty}>No results for "{query}"</div>
          )}
          {filtered.map((item, i) => {
            const Icon = item.icon;
            return (
              <button
                key={item.path + item.label}
                style={{
                  ...s.item,
                  ...(i === activeIdx ? s.itemActive : {}),
                }}
                onMouseEnter={() => setActiveIdx(i)}
                onClick={() => goTo(item)}
              >
                <Icon size={15} style={{ color: i === activeIdx ? "var(--shell-accent)" : "var(--shell-text-muted)", flexShrink: 0 }} />
                <span style={s.itemLabel}>{item.label}</span>
                <span style={s.itemGroup}>{item.group}</span>
              </button>
            );
          })}
        </div>

        <div style={s.footer}>
          <span style={s.hint}><kbd style={s.kbdSmall}>↑↓</kbd> navigate</span>
          <span style={s.hint}><kbd style={s.kbdSmall}>↵</kbd> open</span>
          <span style={s.hint}><kbd style={s.kbdSmall}>Esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}

const s = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    zIndex: 9000,
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    paddingTop: "15vh",
  },
  card: {
    width: "100%",
    maxWidth: 560,
    background: "var(--shell-bg-elevated)",
    border: "1px solid var(--shell-border-strong)",
    borderRadius: 12,
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    overflow: "hidden",
  },
  inputRow: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "0 16px",
    borderBottom: "1px solid var(--shell-border)",
    height: 52,
  },
  input: {
    flex: 1,
    background: "transparent",
    border: "none",
    outline: "none",
    fontSize: 16,
    color: "var(--shell-text)",
    fontFamily: "inherit",
  },
  kbd: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--shell-text-muted)",
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border)",
    borderRadius: 4,
    padding: "2px 6px",
    fontFamily: "monospace",
    flexShrink: 0,
  },
  list: {
    maxHeight: 340,
    overflowY: "auto",
    padding: "6px 0",
  },
  item: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    width: "100%",
    padding: "0 16px",
    height: 38,
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 13,
    color: "var(--shell-text)",
    textAlign: "left",
    transition: "background 100ms ease",
    fontFamily: "inherit",
  },
  itemActive: {
    background: "var(--sidebar-active-bg)",
  },
  itemLabel: {
    flex: 1,
    fontWeight: 500,
  },
  itemGroup: {
    fontSize: 11,
    color: "var(--shell-text-muted)",
    flexShrink: 0,
  },
  empty: {
    padding: "20px 16px",
    fontSize: 13,
    color: "var(--shell-text-muted)",
    textAlign: "center",
  },
  footer: {
    display: "flex",
    gap: 16,
    padding: "8px 16px",
    borderTop: "1px solid var(--shell-border)",
    background: "var(--shell-surface-1)",
  },
  hint: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    fontSize: 11,
    color: "var(--shell-text-muted)",
  },
  kbdSmall: {
    fontSize: 10,
    fontWeight: 600,
    color: "var(--shell-text-muted)",
    background: "var(--shell-surface-2)",
    border: "1px solid var(--shell-border)",
    borderRadius: 4,
    padding: "1px 4px",
    fontFamily: "monospace",
  },
};
