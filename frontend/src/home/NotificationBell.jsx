import React, { useEffect, useRef, useState, useCallback } from "react";
import { Bell } from "lucide-react";

export default function NotificationBell({ userId }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef(null);
  const esRef = useRef(null);
  const pollRef = useRef(null);

  const fetchNotifications = useCallback(() => {
    fetch("/api/notifications", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => {
        if (!d) return;
        setNotifications(d.notifications || []);
        setUnreadCount(d.unread_count ?? 0);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    fetchNotifications();

    // SSE stream
    let es;
    try {
      es = new EventSource("/api/notifications/stream", { withCredentials: true });
      esRef.current = es;
      es.onmessage = (e) => {
        if (!e.data || e.data === "{}") return;
        try {
          const n = JSON.parse(e.data);
          if (n && n.id) {
            setNotifications((prev) => [n, ...prev.filter((x) => x.id !== n.id)]);
            setUnreadCount((c) => c + 1);
          }
        } catch (_) {}
      };
      es.onerror = () => {
        es.close();
        pollRef.current = setInterval(fetchNotifications, 30000);
      };
    } catch (_) {
      pollRef.current = setInterval(fetchNotifications, 30000);
    }

    return () => {
      esRef.current?.close();
      clearInterval(pollRef.current);
    };
  }, [userId, fetchNotifications]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function markRead(id) {
    fetch(`/api/notifications/${id}/read`, { method: "POST", credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((n) => {
        if (!n) return;
        setNotifications((prev) => prev.map((x) => (x.id === id ? n : x)));
        setUnreadCount((c) => Math.max(0, c - 1));
      })
      .catch(() => {});
  }

  function markAllRead() {
    fetch("/api/notifications/read-all", { method: "POST", credentials: "include" })
      .then(() => {
        setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
        setUnreadCount(0);
      })
      .catch(() => {});
  }

  const hasUnread = unreadCount > 0;

  return (
    <div ref={dropdownRef} style={styles.wrap}>
      <button
        style={styles.bellBtn}
        aria-label="Notifications"
        onClick={() => setOpen((v) => !v)}
      >
        <Bell size={20} style={{ display: "block" }} />
        {hasUnread && (
          <span style={styles.badge}>{unreadCount > 9 ? "9+" : unreadCount}</span>
        )}
      </button>

      {open && (
        <div style={styles.dropdown}>
          <div style={styles.header}>
            <span style={styles.headerTitle}>Notifications</span>
            {hasUnread && (
              <button style={styles.markAllBtn} onClick={markAllRead}>
                Mark all read
              </button>
            )}
          </div>
          <div style={styles.list}>
            {notifications.length === 0 ? (
              <p style={styles.empty}>No notifications</p>
            ) : (
              notifications.map((n) => (
                <button
                  key={n.id}
                  style={{ ...styles.item, ...(n.is_read ? styles.itemRead : styles.itemUnread) }}
                  onClick={() => {
                    if (!n.is_read) markRead(n.id);
                    if (n.action_url) window.location.href = n.action_url;
                    else setOpen(false);
                  }}
                >
                  {!n.is_read && <span style={styles.dot} />}
                  <div style={styles.itemBody}>
                    <div style={styles.itemTitle}>{n.title}</div>
                    {n.body && <div style={styles.itemText}>{n.body}</div>}
                    <div style={styles.itemTime}>{formatRelative(n.created_at)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function formatRelative(iso) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = {
  wrap: { position: "relative" },
  bellBtn: {
    position: "relative",
    background: "none",
    border: "none",
    cursor: "pointer",
    color: "var(--shell-text-secondary)",
    padding: "6px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    transition: "background 0.15s",
  },
  badge: {
    position: "absolute",
    top: 2,
    right: 2,
    background: "#ef4444",
    color: "#fff",
    fontSize: 10,
    fontWeight: 800,
    borderRadius: 99,
    minWidth: 16,
    height: 16,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "0 3px",
    lineHeight: 1,
    pointerEvents: "none",
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 8px)",
    right: 0,
    width: 320,
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 14,
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
    zIndex: 1000,
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "12px 16px",
    borderBottom: "1px solid var(--shell-border)",
  },
  headerTitle: {
    fontSize: 14,
    fontWeight: 700,
    color: "var(--shell-text)",
  },
  markAllBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 12,
    color: "var(--shell-accent)",
    fontWeight: 600,
    padding: 0,
  },
  list: {
    maxHeight: 360,
    overflowY: "auto",
  },
  empty: {
    padding: "24px 16px",
    textAlign: "center",
    fontSize: 13,
    color: "var(--shell-text-muted)",
    margin: 0,
  },
  item: {
    display: "flex",
    alignItems: "flex-start",
    gap: 10,
    width: "100%",
    padding: "12px 16px",
    background: "none",
    border: "none",
    borderBottom: "1px solid var(--shell-border)",
    cursor: "pointer",
    textAlign: "left",
    transition: "background 0.1s",
  },
  itemUnread: {
    background: "rgba(99,102,241,0.06)",
  },
  itemRead: {
    opacity: 0.7,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--shell-accent)",
    flexShrink: 0,
    marginTop: 5,
  },
  itemBody: { flex: 1, minWidth: 0 },
  itemTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--shell-text)",
    marginBottom: 2,
  },
  itemText: {
    fontSize: 12,
    color: "var(--shell-text-secondary)",
    marginBottom: 4,
    whiteSpace: "pre-line",
  },
  itemTime: {
    fontSize: 11,
    color: "var(--shell-text-muted)",
  },
};
