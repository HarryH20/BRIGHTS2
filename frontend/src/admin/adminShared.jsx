import React, { useEffect, useRef, useState } from "react";
import { adminStyles as s } from "./adminStyles.js";

export const FORM_TYPES = ["t1", "t2", "t3t5", "t6"];

export const EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "REGISTER",
  "ACCOUNT_LOCKED",
  "UNAUTHORIZED_ACCESS",
];

export function UserSearch({ users, value, onChange }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (value === "all") setQuery("");
  }, [value]);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const filtered = query.trim()
    ? users.filter(
        (u) =>
          u.username.toLowerCase().includes(query.toLowerCase()) ||
          String(u.id).includes(query)
      )
    : users;

  function select(u) {
    setQuery(`${u.username} (#${u.id})`);
    setOpen(false);
    onChange(String(u.id));
  }

  function selectAll() {
    setQuery("");
    setOpen(false);
    onChange("all");
  }

  function clear() {
    setQuery("");
    onChange("all");
  }

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <div style={s.searchInputWrap}>
        <input
          style={s.searchInput}
          type="text"
          placeholder="Search or browse users…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            if (!e.target.value) onChange("all");
          }}
          onFocus={() => setOpen(true)}
        />
        {query ? (
          <button style={s.clearBtn} onClick={clear} title="Clear">
            ×
          </button>
        ) : (
          <span
            style={{
              ...s.clearBtn,
              cursor: "default",
              pointerEvents: "none",
              fontSize: 11,
              opacity: 0.4,
            }}
          >
            ▾
          </span>
        )}
      </div>

      {open && (
        <div style={s.searchDropdown}>
          <div
            style={{
              ...s.searchOption,
              ...(value === "all" ? s.searchOptionActive : {}),
              borderBottom: "1px solid var(--subtle-border)",
            }}
            onMouseDown={selectAll}
          >
            <span style={{ fontWeight: 700 }}>All users</span>
            <span style={{ opacity: 0.45, marginLeft: 6, fontSize: 11 }}>
              {users.length} total
            </span>
          </div>

          {filtered.length === 0 && (
            <div style={{ ...s.searchOption, opacity: 0.45 }}>No matches</div>
          )}

          {filtered.map((u) => (
            <div
              key={u.id}
              style={{
                ...s.searchOption,
                ...(String(u.id) === value ? s.searchOptionActive : {}),
              }}
              onMouseDown={() => select(u)}
            >
              <span style={{ fontWeight: 700 }}>{u.username}</span>
              <span style={{ opacity: 0.55, marginLeft: 6 }}>#{u.id}</span>
              {u.role === "admin" && <span style={s.roleTag}>admin</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div style={s.pagination}>
      <button
        style={s.pageBtn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Prev
      </button>
      <span style={s.pageInfo}>
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        style={s.pageBtn}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}

export function StatCard({ label, value, warn }) {
  return (
    <div style={{ ...s.statCard, ...(warn ? s.statCardWarn : {}) }}>
      <div style={s.statValue}>{value ?? "—"}</div>
      <div style={s.statLabel}>{label}</div>
    </div>
  );
}

export function AdminChartSection({ title, subtitle, children }) {
  return (
    <div style={s.sectionBlock}>
      <div style={s.sectionHeader}>
        <h3 style={s.sectionTitle}>{title}</h3>
        {subtitle ? <p style={s.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      <div style={s.plotWrap}>{children}</div>
    </div>
  );
}
