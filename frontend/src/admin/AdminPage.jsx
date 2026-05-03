import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import HomeLayout from "../home/HomeLayout.jsx";
import RosePlot from "../graphs/RosePlot.jsx";
import AdminDivergingPlot from "../graphs/AdminDivergingPlot.jsx";
import AgePlot from "../graphs/AgePlot.jsx";
import LinguisticMarkersPlot from "../graphs/LinguisticMarkersPlot.jsx";
import AdminAlluvial from "../graphs/AdminAlluvial.jsx";
import LinguisticMarkersWordCloud from "../graphs/LinguisticMarkersWordCloud.jsx";
import AdminDemographicBarChart from "../graphs/AdminDemographicBarChart.jsx";
import AdminCountsDemographics from "../graphs/AdminCountsDemographics.jsx";
import AdminAttritionFunnel from "../graphs/AdminAttritionFunnel.jsx";
import AdminUserProfile from "../graphs/AdminUserProfile.jsx";
import SkeletonAdminTab from "../components/SkeletonAdminTab.jsx";

// ─── Constants ────────────────────────────────────────────────────────────────

const TABS = [
  "Overview",
  "User Profile",
  "Goal Progress",
  "Demographics",
  "Linguistics",
  "Alluvial",
  "Questions",
  "Stats",
  "Audit Log",
  "Sessions",
];

const FORM_TYPES = ["t1", "t2", "t3t5", "t6"];
const EVENT_TYPES = [
  "LOGIN_SUCCESS",
  "LOGIN_FAILED",
  "LOGOUT",
  "REGISTER",
  "ACCOUNT_LOCKED",
  "UNAUTHORIZED_ACCESS",
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function parseDevice(ua) {
  if (!ua) return "—";
  const s = ua.toLowerCase();

  let os = "Unknown";
  if (s.includes("iphone")) os = "iPhone";
  else if (s.includes("ipad")) os = "iPad";
  else if (s.includes("android")) os = "Android";
  else if (s.includes("windows nt")) os = "Windows";
  else if (s.includes("mac os x")) os = "macOS";
  else if (s.includes("linux")) os = "Linux";

  let browser = "";
  if (s.includes("edg/")) browser = "Edge";
  else if (s.includes("opr/") || s.includes("opera")) browser = "Opera";
  else if (s.includes("chrome/")) browser = "Chrome";
  else if (s.includes("firefox/")) browser = "Firefox";
  else if (s.includes("safari/")) browser = "Safari";

  return browser ? `${os} · ${browser}` : os;
}

function fmtTs(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString();
}

function fmtDuration(seconds) {
  if (seconds == null) return "active";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s}s`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function TabBar({ active, onChange }) {
  return (
    <div style={styles.tabBar}>
      {TABS.map((tab) => (
        <button
          key={tab}
          onClick={() => onChange(tab)}
          style={{
            ...styles.tabBtn,
            ...(active === tab ? styles.tabBtnActive : {}),
          }}
        >
          {tab}
        </button>
      ))}
    </div>
  );
}

function StatCard({ label, value, warn }) {
  return (
    <div style={{ ...styles.statCard, ...(warn ? styles.statCardWarn : {}) }}>
      <div style={styles.statValue}>{value ?? "—"}</div>
      <div style={styles.statLabel}>{label}</div>
    </div>
  );
}

function Pagination({ page, total, perPage, onChange }) {
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  return (
    <div style={styles.pagination}>
      <button
        style={styles.pageBtn}
        disabled={page <= 1}
        onClick={() => onChange(page - 1)}
      >
        ‹ Prev
      </button>
      <span style={styles.pageInfo}>
        Page {page} of {totalPages} ({total} total)
      </span>
      <button
        style={styles.pageBtn}
        disabled={page >= totalPages}
        onClick={() => onChange(page + 1)}
      >
        Next ›
      </button>
    </div>
  );
}

// ─── User search component ────────────────────────────────────────────────────

function UserSearch({ users, value, onChange }) {
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
      <div style={styles.searchInputWrap}>
        <input
          style={styles.searchInput}
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
          <button style={styles.clearBtn} onClick={clear} title="Clear">
            ×
          </button>
        ) : (
          <span
            style={{
              ...styles.clearBtn,
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
        <div style={styles.searchDropdown}>
          <div
            style={{
              ...styles.searchOption,
              ...(value === "all" ? styles.searchOptionActive : {}),
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
            <div style={{ ...styles.searchOption, opacity: 0.45 }}>
              No matches
            </div>
          )}

          {filtered.map((u) => (
            <div
              key={u.id}
              style={{
                ...styles.searchOption,
                ...(String(u.id) === value ? styles.searchOptionActive : {}),
              }}
              onMouseDown={() => select(u)}
            >
              <span style={{ fontWeight: 700 }}>{u.username}</span>
              <span style={{ opacity: 0.55, marginLeft: 6 }}>#{u.id}</span>
              {u.role === "admin" && <span style={styles.roleTag}>admin</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Reusable chart section ───────────────────────────────────────────────────

function AdminChartSection({ title, subtitle, children }) {
  return (
    <div style={styles.sectionBlock}>
      <div style={styles.sectionHeader}>
        <h3 style={styles.sectionTitle}>{title}</h3>
        {subtitle ? <p style={styles.sectionSubtitle}>{subtitle}</p> : null}
      </div>
      <div style={styles.plotWrap}>{children}</div>
    </div>
  );
}

// ─── Tab: Overview ────────────────────────────────────────────────────────────

function OverviewTab({ users }) {
  const [userId, setUserId] = useState("all");
  const [goal, setGoal] = useState("all");
  const [weeks, setWeeks] = useState("2-6");
  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setFigure(null);

    const qs = new URLSearchParams({
      user_id: userId,
      goal_id: goal,
      weeks,
    }).toString();

    fetch(`/api/admin/roseplot?${qs}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Roseplot fetch failed: ${r.status}`);
        return r.json();
      })
      .then((fig) => {
        if (!cancelled) setFigure(fig);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, goal, weeks]);

  return (
    <div style={styles.tabContent}>
      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>
          User
          <UserSearch users={users} value={userId} onChange={setUserId} />
        </label>

        <label style={styles.filterLabel}>
          Goal
          <select
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            style={styles.select}
          >
            <option value="all">All goals</option>
            <option value="1">Goal 1</option>
            <option value="2">Goal 2</option>
            <option value="3">Goal 3</option>
          </select>
        </label>

        <label style={styles.filterLabel}>
          Weeks
          <select
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            style={styles.select}
          >
            <option value="all">All weeks</option>
            <option value="2-6">Weeks 2–6</option>
            <option value="3-6">Weeks 3–6</option>
            <option value="4-6">Weeks 4–6</option>
            <option value="5-6">Weeks 5–6</option>
            <option value="2">Week 2 only</option>
            <option value="3">Week 3 only</option>
            <option value="4">Week 4 only</option>
            <option value="5">Week 5 only</option>
            <option value="6">Week 6 only</option>
          </select>
        </label>
      </div>

      <div style={styles.plotWrap}>
        {error ? <div style={styles.errorText}>{error}</div> : <RosePlot figure={figure} />}
      </div>
    </div>
  );
}

// ─── Tab: User Profile ─────────────────────────────────────────────────────────

function UserTab({ users }) {
  const [userId, setUserId] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  function normalizeUserId(v) {
    if (!v) return "all";
    if (v === "all") return "all";
    const m = v.match(/#(\d+)/);
    if (m) return m[1];
    if (/^\d+$/.test(v)) return v;
    return "all";
  }

  useEffect(() => {
    setError(null);
    setData(null);

    const qs = new URLSearchParams({ user_id: userId }).toString();

    fetch(`/api/admin/demographics?${qs}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Fetch failed: ${r.status}`);
        return r.json();
      })
      .then((fig) => setData(fig))
      .catch((e) => setError(e.message));
  }, [userId]);

  return (
    <div style={styles.tabContent}>
      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>
          User
          <UserSearch
            users={users}
            value={userId}
            onChange={(v) => setUserId(normalizeUserId(v))}
          />
        </label>
      </div>

      <div
        style={{
          borderRadius: 12,
          border: "1px solid var(--subtle-border)",
          background: "var(--surface-subtle)",
          padding: 20,
        }}
      >
        {error && <div style={styles.errorText}>{error}</div>}

        {!error && !data && <SkeletonAdminTab charts={2} chartHeight={320} />}

        {data && (
          <AdminUserProfile userId={userId} prefetchedData={data} />
        )}
      </div>
    </div>
  );
}

// ─── Tab: Goal Progress ───────────────────────────────────────────────────────

function GoalProgressTab({ users }) {
  const [userId, setUserId] = useState("all");
  const [goals, setGoals] = useState("1,2,3");
  const [weeks, setWeeks] = useState("2,3,4,5,6");
  const [figure, setFigure] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setError(null);
    setFigure(null);

    const qs = new URLSearchParams({ user_id: userId, goals, weeks }).toString();

    fetch(`/api/admin/divergingstackedbarchart?${qs}`, { credentials: "include" })
      .then((r) => {
        if (!r.ok) throw new Error(`Chart fetch failed: ${r.status}`);
        return r.json();
      })
      .then((fig) => {
        if (!cancelled) setFigure(fig);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, goals, weeks]);

  return (
    <div style={styles.tabContent}>
      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>
          User
          <UserSearch users={users} value={userId} onChange={setUserId} />
        </label>

        <label style={styles.filterLabel}>
          Goal
          <select
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            style={styles.select}
          >
            <option value="1,2,3">All goals</option>
            <option value="1">Goal 1</option>
            <option value="2">Goal 2</option>
            <option value="3">Goal 3</option>
          </select>
        </label>

        <label style={styles.filterLabel}>
          Weeks
          <select
            value={weeks}
            onChange={(e) => setWeeks(e.target.value)}
            style={styles.select}
          >
            <option value="2,3,4,5,6">Weeks 2–6</option>
            <option value="3,4,5,6">Weeks 3–6</option>
            <option value="4,5,6">Weeks 4–6</option>
            <option value="5,6">Weeks 5–6</option>
            <option value="2">Week 2 only</option>
            <option value="3">Week 3 only</option>
            <option value="4">Week 4 only</option>
            <option value="5">Week 5 only</option>
            <option value="6">Week 6 only</option>
          </select>
        </label>
      </div>

      <div style={styles.plotWrap}>
        {error ? (
          <div style={styles.errorText}>{error}</div>
        ) : (
          <AdminDivergingPlot figure={figure} />
        )}
      </div>
    </div>
  );
}

// ─── Tab: Demographics ────────────────────────────────────────────────────────

function DemographicsTab() {
  return (
    <div style={styles.tabContent}>
      <AdminChartSection
        title="Survey Response Distribution by Demographic"
        subtitle="How a selected subgroup responded compared to the full sample across Likert scale questions"
      >
        <AdminDemographicBarChart />
      </AdminChartSection>

      <AdminChartSection
        title="Who Is in the Study"
        subtitle="Number of participants in each demographic category"
      >
        <AdminCountsDemographics />
      </AdminChartSection>

      <AdminChartSection
        title="Who Stayed and Who Left"
        subtitle="Participation rate across all six survey weeks, broken down by demographic group"
      >
        <AdminAttritionFunnel />
      </AdminChartSection>
    </div>
  );
}

// ─── Tab: Linguistics ─────────────────────────────────────────────────────────

function LinguisticsTab() {
  return (
    <div style={styles.tabContent}>
      <AdminChartSection
        title="Words That Predict Goal Progress"
        subtitle="Language patterns from weekly reflections that correlate with higher or lower goal scores"
      >
        <LinguisticMarkersPlot />
      </AdminChartSection>

      <AdminChartSection
        title="How High and Low Progress Groups Write Differently"
        subtitle="Distinctive words from participant reflections — shared common words removed"
      >
        <LinguisticMarkersWordCloud />
      </AdminChartSection>
    </div>
  );
}

// ─── Tab: Alluvial ────────────────────────────────────────────────────────────

function AlluvialTab() {
  return (
    <div style={styles.tabContent}>
      <AdminChartSection
        title="Participant Flow Between Progress Groups"
        subtitle="How participants moved between high and low goal progress groups across study weeks"
      >
        <AdminAlluvial />
      </AdminChartSection>
    </div>
  );
}

// ─── Tab: Questions ───────────────────────────────────────────────────────────

function QuestionsTab() {
  const [formType, setFormType] = useState("t1");
  const [questions, setQuestions] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [newText, setNewText] = useState("");
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const loadQuestions = useCallback(() => {
    let cancelled = false;
    setError(null);

    const endpoint = showHistory
      ? `/api/admin/survey/questions/history?form_type=${formType}`
      : `/api/admin/survey/questions?form_type=${formType}`;

    fetch(endpoint, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setQuestions(data.questions ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, [formType, showHistory]);

  useEffect(() => {
    setEditingId(null);
    setEditText("");
    const cancel = loadQuestions();
    return cancel;
  }, [loadQuestions]);

  function startEdit(q) {
    setEditingId(q.id);
    setEditText(q.question_text);
  }

  function cancelEdit() {
    setEditingId(null);
    setEditText("");
  }

  async function saveEdit(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_text: editText }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Save failed");
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? data.question : x)));
      setEditingId(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function deactivate(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}/deactivate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Deactivate failed");
      loadQuestions();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function reactivate(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}/reactivate`, {
        method: "POST",
        credentials: "include",
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Reactivate failed");
      loadQuestions();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  async function addQuestion(e) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/survey/questions", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          form_type: formType,
          question_text: newText.trim(),
        }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Add failed");
      setNewText("");
      loadQuestions();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div style={styles.tabContent}>
      <div style={styles.subTabBar}>
        {FORM_TYPES.map((ft) => (
          <button
            key={ft}
            onClick={() => setFormType(ft)}
            style={{
              ...styles.subTabBtn,
              ...(formType === ft ? styles.subTabBtnActive : {}),
            }}
          >
            {ft.toUpperCase()}
          </button>
        ))}

        <label
          style={{
            ...styles.filterLabel,
            flexDirection: "row",
            alignItems: "center",
            gap: 6,
            marginLeft: "auto",
            fontSize: 13,
          }}
        >
          <input
            type="checkbox"
            checked={showHistory}
            onChange={(e) => setShowHistory(e.target.checked)}
          />
          Show inactive
        </label>
      </div>

      {error && <div style={styles.errorText}>{error}</div>}

      <div style={styles.questionList}>
        {questions.length === 0 && (
          <div style={{ padding: 16, opacity: 0.5 }}>
            No questions for {formType.toUpperCase()}.
          </div>
        )}

        {questions.map((q, idx) => (
          <div
            key={q.id}
            style={{
              ...styles.questionRow,
              ...(q.status === "inactive" ? styles.questionRowInactive : {}),
            }}
          >
            <div style={styles.questionMeta}>
              <span style={styles.questionNum}>Q{q.question_number ?? idx + 1}</span>
              {q.status === "inactive" && <span style={styles.inactiveTag}>inactive</span>}
            </div>

            {editingId === q.id ? (
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                <textarea
                  style={styles.editTextarea}
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  rows={3}
                />
                <div style={{ display: "flex", gap: 8 }}>
                  <button style={styles.btnPrimary} onClick={() => saveEdit(q)} disabled={saving}>
                    Save
                  </button>
                  <button style={styles.btnGhost} onClick={cancelEdit} disabled={saving}>
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div style={styles.questionText}>{q.question_text}</div>
            )}

            {editingId !== q.id && (
              <div style={styles.questionActions}>
                {q.status !== "inactive" && (
                  <>
                    <button style={styles.btnGhost} onClick={() => startEdit(q)}>
                      Edit
                    </button>
                    <button
                      style={{
                        ...styles.btnGhost,
                        color: "#ffb4b4",
                        borderColor: "#ffb4b4",
                      }}
                      onClick={() => {
                        if (window.confirm(`Deactivate Q${q.question_number}?`)) {
                          deactivate(q);
                        }
                      }}
                    >
                      Deactivate
                    </button>
                  </>
                )}
                {q.status === "inactive" && (
                  <button
                    style={{
                      ...styles.btnGhost,
                      color: "#7ecb8f",
                      borderColor: "#7ecb8f",
                    }}
                    onClick={() => reactivate(q)}
                    disabled={saving}
                  >
                    Reactivate
                  </button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      <form onSubmit={addQuestion} style={styles.addForm}>
        <h3 style={{ ...styles.sectionHeading, marginTop: 0 }}>
          Add question to {formType.toUpperCase()}
        </h3>
        <textarea
          style={styles.editTextarea}
          placeholder="Question text…"
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          rows={2}
        />
        <button
          type="submit"
          style={styles.btnPrimary}
          disabled={saving || !newText.trim()}
        >
          Add question
        </button>
      </form>
    </div>
  );
}

// ─── Tab: Stats ───────────────────────────────────────────────────────────────

function StatsTab() {
  const [stats, setStats] = useState(null);
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    Promise.all([
      fetch("/api/admin/stats", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/admin/stats/activity?days=7", { credentials: "include" }).then((r) =>
        r.json()
      ),
    ])
      .then(([s, a]) => {
        if (cancelled) return;
        setStats(s);
        setActivity(a.activity ?? []);
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div style={styles.errorText}>{error}</div>;
  if (!stats) return <div style={styles.loading}>Loading stats…</div>;

  const avgSec = stats.avg_session_duration_seconds;
  const avgFmt = avgSec != null ? fmtDuration(avgSec) : "—";

  return (
    <div style={styles.tabContent}>
      <div style={styles.statGrid}>
        <StatCard label="Total Users" value={stats.total_users} />
        <StatCard label="Admins" value={stats.total_admins} />
        <StatCard label="Active Sessions" value={stats.active_sessions} />
        <StatCard label="Avg Session Duration" value={avgFmt} />
        <StatCard
          label="Failed Logins (24h)"
          value={stats.failed_logins_24h}
          warn={stats.failed_logins_24h > 0}
        />
        <StatCard
          label="Lockouts (24h)"
          value={stats.lockouts_24h}
          warn={stats.lockouts_24h > 0}
        />
        <StatCard
          label="Unauthorized (24h)"
          value={stats.unauthorized_access_24h}
          warn={stats.unauthorized_access_24h > 0}
        />
        <StatCard label="Registrations (24h)" value={stats.registrations_24h} />
      </div>

      {activity && activity.length > 0 && (
        <>
          <h3 style={styles.sectionHeading}>Activity (last 7 days)</h3>
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr>
                  {["Date", "Logins", "Failures", "Registrations", "Logouts"].map((h) => (
                    <th key={h} style={styles.th}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {activity.map((row) => (
                  <tr key={row.date} style={styles.tr}>
                    <td style={styles.td}>{row.date}</td>
                    <td style={styles.td}>{row.logins}</td>
                    <td
                      style={{
                        ...styles.td,
                        color: row.failures > 0 ? "#ffb4b4" : "inherit",
                      }}
                    >
                      {row.failures}
                    </td>
                    <td style={styles.td}>{row.registrations}</td>
                    <td style={styles.td}>{row.logouts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Tab: Audit Log ───────────────────────────────────────────────────────────

function AuditLogTab() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [eventType, setEventType] = useState("");
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const PER_PAGE = 50;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);

    const qs = new URLSearchParams({ page, per_page: PER_PAGE });
    if (eventType) qs.set("event_type", eventType);

    fetch(`/api/admin/audit-log?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, eventType]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  function handleEventType(e) {
    setEventType(e.target.value);
    setPage(1);
  }

  if (error) return <div style={styles.errorText}>{error}</div>;

  return (
    <div style={styles.tabContent}>
      <div style={styles.filterRow}>
        <label style={styles.filterLabel}>
          Event type
          <select value={eventType} onChange={handleEventType} style={styles.select}>
            <option value="">All events</option>
            {EVENT_TYPES.map((et) => (
              <option key={et} value={et}>
                {et}
              </option>
            ))}
          </select>
        </label>
        {loading && <span style={{ opacity: 0.5, fontSize: 13 }}>Loading…</span>}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["Timestamp", "Event", "User ID", "Detail", "IP", "Device"].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={styles.tr}>
                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>{fmtTs(e.timestamp)}</td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.eventBadge,
                      ...(e.event_type?.includes("FAIL") ||
                      e.event_type?.includes("LOCKED") ||
                      e.event_type?.includes("UNAUTHORIZED")
                        ? styles.eventBadgeWarn
                        : {}),
                    }}
                  >
                    {e.event_type}
                  </span>
                </td>
                <td style={styles.td}>{e.user_id ?? "—"}</td>
                <td
                  style={{
                    ...styles.td,
                    maxWidth: 220,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {e.detail ?? "—"}
                </td>
                <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>
                  {e.ip_address ?? "—"}
                </td>
                <td
                  style={{ ...styles.td, whiteSpace: "nowrap" }}
                  title={e.user_agent ?? ""}
                >
                  {parseDevice(e.user_agent)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: "center", opacity: 0.5 }}>
                  No entries
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}

// ─── Tab: Sessions ────────────────────────────────────────────────────────────

function SessionsTab() {
  const [entries, setEntries] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [activeOnly, setActiveOnly] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const PER_PAGE = 50;

  const load = useCallback(() => {
    let cancelled = false;
    setLoading(true);

    const qs = new URLSearchParams({ page, per_page: PER_PAGE });
    if (activeOnly) qs.set("active", "true");

    fetch(`/api/admin/sessions?${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (cancelled) return;
        setEntries(data.entries ?? []);
        setTotal(data.total ?? 0);
        setLoading(false);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message);
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [page, activeOnly]);

  useEffect(() => {
    const cancel = load();
    return cancel;
  }, [load]);

  function handleActiveOnly(e) {
    setActiveOnly(e.target.checked);
    setPage(1);
  }

  if (error) return <div style={styles.errorText}>{error}</div>;

  return (
    <div style={styles.tabContent}>
      <div style={styles.filterRow}>
        <label
          style={{
            ...styles.filterLabel,
            flexDirection: "row",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input type="checkbox" checked={activeOnly} onChange={handleActiveOnly} />
          Active sessions only
        </label>
        {loading && <span style={{ opacity: 0.5, fontSize: 13 }}>Loading…</span>}
      </div>

      <div style={styles.tableWrap}>
        <table style={styles.table}>
          <thead>
            <tr>
              {["User ID", "Login At", "Logout At", "Duration", "IP", "Device"].map((h) => (
                <th key={h} style={styles.th}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} style={styles.tr}>
                <td style={styles.td}>{e.user_id}</td>
                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>{fmtTs(e.login_at)}</td>
                <td style={{ ...styles.td, whiteSpace: "nowrap" }}>{fmtTs(e.logout_at)}</td>
                <td style={{ ...styles.td, color: e.logout_at == null ? "#7ecb8f" : "inherit" }}>
                  {fmtDuration(e.duration_seconds)}
                </td>
                <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>
                  {e.ip_address ?? "—"}
                </td>
                <td
                  style={{ ...styles.td, whiteSpace: "nowrap" }}
                  title={e.user_agent ?? ""}
                >
                  {parseDevice(e.user_agent)}
                </td>
              </tr>
            ))}
            {entries.length === 0 && !loading && (
              <tr>
                <td colSpan={6} style={{ ...styles.td, textAlign: "center", opacity: 0.5 }}>
                  No sessions
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <Pagination page={page} total={total} perPage={PER_PAGE} onChange={setPage} />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function AdminPage({ user, onLogout }) {
  const [activeTab, setActiveTab] = useState("Overview");
  const [users, setUsers] = useState([]);

  useEffect(() => {
    fetch("/api/admin/users", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setUsers(data.users ?? []))
      .catch(() => {});
  }, []);

  if (user?.role && user.role !== "admin") {
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Admin">
        <div style={styles.card}>
          <p style={{ opacity: 0.85, margin: 0 }}>You don't have access to this page.</p>
          <div style={{ marginTop: 14 }}>
            <Link to="/dashboard" style={styles.pillBtn}>
              ← Back to Dashboard
            </Link>
          </div>
        </div>
      </HomeLayout>
    );
  }

  return (
    <HomeLayout
      user={user}
      onLogout={onLogout}
      title="Admin"
      rightSlot={
        <Link to="/dashboard" style={styles.pillBtn}>
          View as User →
        </Link>
      }
    >
      <div style={styles.card}>
        <TabBar active={activeTab} onChange={setActiveTab} />

        {activeTab === "Overview" && <OverviewTab users={users} />}
        {activeTab === "User Profile" && <UserTab users={users} />}
        {activeTab === "Goal Progress" && <GoalProgressTab users={users} />}
        {activeTab === "Demographics" && <DemographicsTab />}
        {activeTab === "Linguistics" && <LinguisticsTab />}
        {activeTab === "Alluvial" && <AlluvialTab />}
        {activeTab === "Questions" && <QuestionsTab />}
        {activeTab === "Stats" && <StatsTab />}
        {activeTab === "Audit Log" && <AuditLogTab />}
        {activeTab === "Sessions" && <SessionsTab />}
      </div>
    </HomeLayout>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = {
  card: {
    padding: 18,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.18)",
    backdropFilter: "blur(8px)",
  },

  tabBar: {
    display: "flex",
    gap: 2,
    borderBottom: "1px solid var(--subtle-border)",
    marginBottom: 18,
    flexWrap: "wrap",
  },
  tabBtn: {
    padding: "9px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    transition: "color 0.15s, border-color 0.15s",
    marginBottom: -1,
  },
  tabBtnActive: {
    color: "var(--text-primary)",
    borderBottom: "2px solid #7b9eff",
  },

  tabContent: {
    display: "flex",
    flexDirection: "column",
    gap: 14,
  },

  subTabBar: {
    display: "flex",
    gap: 6,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 4,
  },
  subTabBtn: {
    padding: "6px 14px",
    borderRadius: 999,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 12,
  },
  subTabBtnActive: {
    background: "#7b9eff22",
    border: "1px solid #7b9eff",
    color: "var(--text-primary)",
  },

  filterRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-end",
    flexWrap: "wrap",
  },
  filterLabel: {
    display: "flex",
    flexDirection: "column",
    gap: 5,
    fontWeight: 800,
    fontSize: 12,
    color: "var(--text-dim)",
  },

  select: {
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    outline: "none",
    fontSize: 13,
  },

  searchInputWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
  },
  searchInput: {
    padding: "9px 32px 9px 11px",
    borderRadius: 10,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    outline: "none",
    fontSize: 13,
    width: 200,
  },
  clearBtn: {
    position: "absolute",
    right: 8,
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: 0,
  },
  searchDropdown: {
    position: "absolute",
    top: "100%",
    left: 0,
    right: 0,
    zIndex: 100,
    background: "var(--card-bg)",
    border: "1px solid var(--card-border)",
    borderRadius: 10,
    boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
    overflow: "hidden",
    overflowY: "auto",
    maxHeight: 280,
    marginTop: 2,
  },
  searchOption: {
    padding: "9px 12px",
    cursor: "pointer",
    fontSize: 13,
    display: "flex",
    alignItems: "center",
    color: "var(--text-primary)",
    transition: "background 0.1s",
  },
  searchOptionActive: {
    background: "#7b9eff18",
    color: "var(--text-primary)",
  },
  roleTag: {
    marginLeft: "auto",
    fontSize: 10,
    fontWeight: 700,
    padding: "2px 7px",
    borderRadius: 999,
    background: "#7b9eff22",
    border: "1px solid #7b9eff44",
    color: "#7b9eff",
  },

  sectionBlock: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  sectionHeader: {
    display: "flex",
    flexDirection: "column",
    gap: 4,
  },
  sectionTitle: {
    margin: 0,
    fontSize: 18,
    fontWeight: 800,
    color: "var(--text-primary)",
  },
  sectionSubtitle: {
    margin: 0,
    fontSize: 13,
    color: "var(--text-dim)",
  },

  plotWrap: {
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
    padding: 12,
  },

  statGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: 12,
  },
  statCard: {
    padding: "16px 14px",
    borderRadius: 12,
    border: "1px solid var(--card-border)",
    background: "var(--surface-subtle)",
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  statCardWarn: {
    border: "1px solid #ffb4b455",
    background: "#ffb4b408",
  },
  statValue: {
    fontSize: 26,
    fontWeight: 900,
    color: "var(--text-primary)",
    lineHeight: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: 700,
    color: "var(--text-dim)",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },

  sectionHeading: {
    fontWeight: 800,
    fontSize: 14,
    color: "var(--text-dim)",
    margin: "8px 0 4px",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },

  tableWrap: {
    overflowX: "auto",
    borderRadius: 10,
    border: "1px solid var(--subtle-border)",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
    fontSize: 13,
  },
  th: {
    padding: "9px 12px",
    textAlign: "left",
    fontWeight: 800,
    fontSize: 11,
    textTransform: "uppercase",
    letterSpacing: "0.04em",
    color: "var(--text-dim)",
    background: "var(--surface-subtle)",
    borderBottom: "1px solid var(--subtle-border)",
    whiteSpace: "nowrap",
  },
  tr: {
    borderBottom: "1px solid var(--subtle-border)",
  },
  td: {
    padding: "9px 12px",
    color: "var(--text-primary)",
    verticalAlign: "top",
  },

  eventBadge: {
    display: "inline-block",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    background: "var(--surface-subtle)",
    border: "1px solid var(--subtle-border)",
    color: "var(--text-primary)",
    whiteSpace: "nowrap",
  },
  eventBadgeWarn: {
    background: "#ffb4b415",
    border: "1px solid #ffb4b455",
    color: "#ffb4b4",
  },

  pagination: {
    display: "flex",
    gap: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingTop: 8,
  },
  pageBtn: {
    padding: "7px 14px",
    borderRadius: 8,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
  },
  pageInfo: {
    fontSize: 13,
    color: "var(--text-dim)",
  },

  questionList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  questionRow: {
    display: "flex",
    gap: 12,
    alignItems: "flex-start",
    padding: "12px 14px",
    borderRadius: 10,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
  },
  questionRowInactive: {
    opacity: 0.45,
  },
  questionMeta: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 4,
    minWidth: 36,
    paddingTop: 2,
  },
  questionNum: {
    fontWeight: 900,
    fontSize: 12,
    color: "var(--text-dim)",
  },
  inactiveTag: {
    fontSize: 9,
    fontWeight: 700,
    padding: "1px 5px",
    borderRadius: 999,
    background: "#ffb4b420",
    color: "#ffb4b4",
    border: "1px solid #ffb4b440",
    whiteSpace: "nowrap",
  },
  questionText: {
    flex: 1,
    fontSize: 13,
    color: "var(--text-primary)",
    lineHeight: 1.5,
  },
  questionActions: {
    display: "flex",
    gap: 6,
    flexShrink: 0,
    flexWrap: "wrap",
  },

  editTextarea: {
    width: "100%",
    padding: "9px 11px",
    borderRadius: 10,
    border: "1px solid var(--input-border)",
    background: "var(--input-bg)",
    color: "var(--text-primary)",
    fontSize: 13,
    lineHeight: 1.5,
    resize: "vertical",
    outline: "none",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },

  addForm: {
    display: "flex",
    flexDirection: "column",
    gap: 10,
    padding: "16px 14px",
    borderRadius: 10,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
    marginTop: 8,
  },

  btnPrimary: {
    padding: "9px 18px",
    borderRadius: 10,
    border: "none",
    background: "#7b9eff",
    color: "#fff",
    fontWeight: 800,
    fontSize: 13,
    cursor: "pointer",
    alignSelf: "flex-start",
  },
  btnGhost: {
    padding: "7px 12px",
    borderRadius: 8,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 700,
    fontSize: 12,
    cursor: "pointer",
  },

  pillBtn: {
    padding: "8px 12px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 900,
    textDecoration: "none",
    fontSize: 13,
  },

  errorText: {
    padding: "10px 12px",
    color: "#ffb4b4",
    fontWeight: 700,
    fontSize: 13,
  },

  loading: {
    padding: 16,
    opacity: 0.55,
    fontSize: 13,
  },
};
