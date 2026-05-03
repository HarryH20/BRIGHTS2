import React, { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

const TP_LABELS = { 1: "Week 1", 2: "Week 2", 3: "Week 3", 4: "Week 4", 5: "Week 5", 6: "Week 6" };
const DRAFT_KEY = "brights2_survey_draft_v1";

const LIKERT7_LABELS = {
  1: "Strongly\nDisagree",
  2: "Disagree",
  3: "Somewhat\nDisagree",
  4: "Neutral",
  5: "Somewhat\nAgree",
  6: "Agree",
  7: "Strongly\nAgree",
};

export default function SurveyForm({ user, onLogout, onSurveyComplete }) {
  const navigate = useNavigate();
  const [state, setState] = useState("loading"); // loading | due | locked | complete | submitting | submitted | error
  const [surveyData, setSurveyData] = useState(null);    // { timepoint, form_type, goals, questions }
  const [lockInfo, setLockInfo]     = useState(null);    // { timepoint, next_unlocks_at }
  const [loadError, setLoadError]   = useState(null);

  // Responses keyed by `${goal_index}__${question_id}`
  const [responses, setResponses] = useState({});
  const [draftRestored, setDraftRestored] = useState(false);

  // Which goal tab is active (1-based)
  const [activeGoal, setActiveGoal] = useState(1);
  const [submitError, setSubmitError] = useState(null);

  // Warn on browser tab close / navigate-away when there are unsaved responses
  const hasResponses = Object.keys(responses).length > 0;
  useEffect(() => {
    if (!hasResponses || state !== "due") return;
    const handler = (e) => { e.preventDefault(); e.returnValue = ""; };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasResponses, state]);

  // Persist draft to localStorage whenever responses change
  useEffect(() => {
    if (state !== "due" || !surveyData) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      timepoint: surveyData.timepoint,
      responses,
    }));
  }, [responses, state, surveyData]);

  // Restore draft once surveyData loads
  useEffect(() => {
    if (state !== "due" || !surveyData) return;
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (draft.timepoint === surveyData.timepoint && Object.keys(draft.responses).length > 0) {
        setResponses(draft.responses);
        setDraftRestored(true);
      }
    } catch {
      // Corrupt draft — ignore
    }
  }, [state, surveyData?.timepoint]); // eslint-disable-line

  useEffect(() => {
    fetch("/api/survey/next", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === "due") {
          setSurveyData(data);
          setState("due");
        } else if (data.status === "locked") {
          setLockInfo(data);
          setState("locked");
        } else if (data.status === "complete") {
          setState("complete");
        } else {
          setLoadError(data.error || "Unexpected response from server.");
          setState("error");
        }
      })
      .catch(() => {
        setLoadError("Could not reach the server. Please try again.");
        setState("error");
      });
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function setResponse(goalIndex, questionId, value) {
    setResponses((prev) => ({ ...prev, [`${goalIndex}__${questionId}`]: value }));
  }

  function getResponse(goalIndex, questionId) {
    return responses[`${goalIndex}__${questionId}`] ?? "";
  }

  // Number of goals to show (3 for T1 since user enters them; else based on goals array)
  function numGoals() {
    if (!surveyData) return 1;
    if (surveyData.form_type === "t1") return 3;
    return Math.max(surveyData.goals.length, 1);
  }

  // Goal label — from goals array for T2+, or "Goal N" for T1 (user entering them)
  function goalLabel(goalIndex) {
    if (surveyData.form_type === "t1") return `Goal ${goalIndex}`;
    const text = surveyData.goals[goalIndex - 1];
    return text ? (text.length > 32 ? text.slice(0, 32) + "…" : text) : `Goal ${goalIndex}`;
  }

  // Questions for the active goal — goal_text questions only show for goal matching display_order slot
  function questionsForGoal(goalIndex) {
    if (!surveyData) return [];
    return surveyData.questions.filter((q) => {
      // goal_text questions: each one maps to a specific goal by position
      if (q.scale_type === "goal_text") {
        // display_order -9 → goal 1, -8 → goal 2, -7 → goal 3
        const slot = q.display_order + 10; // -9→1, -8→2, -7→3
        return slot === goalIndex;
      }
      return true;
    });
  }

  // Count answered questions for a goal
  function answeredCount(goalIndex) {
    return questionsForGoal(goalIndex).filter(
      (q) => (getResponse(goalIndex, q.id) ?? "").toString().trim() !== ""
    ).length;
  }

  function totalAnswered() {
    let count = 0;
    for (let g = 1; g <= numGoals(); g++) count += answeredCount(g);
    return count;
  }

  function totalQuestions() {
    if (!surveyData) return 0;
    // goal_text questions appear once (per goal slot), likert questions appear per goal
    const likertCount = surveyData.questions.filter((q) => q.scale_type !== "goal_text").length;
    const goalTextCount = surveyData.questions.filter((q) => q.scale_type === "goal_text").length;
    return goalTextCount + likertCount * numGoals();
  }

  // ── Back navigation with unsaved-data warning ──────────────────────────────

  function handleBack() {
    if (hasResponses) {
      const ok = window.confirm(
        "You have unsaved responses. If you leave now your progress will be lost. Exit anyway?"
      );
      if (!ok) return;
    }
    navigate("/dashboard");
  }

  // ── Submit ─────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setSubmitError(null);
    setState("submitting");

    const payload = [];

    for (let g = 1; g <= numGoals(); g++) {
      for (const q of questionsForGoal(g)) {
        const val = getResponse(g, q.id);
        payload.push({
          question_id: q.id,
          goal_index: g,
          response_value: val !== "" ? String(val) : null,
        });
      }
    }

    try {
      const res = await fetch("/api/survey/submit", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timepoint: surveyData.timepoint, responses: payload }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error || "Submission failed.");
        setState("due");
      } else {
        localStorage.removeItem(DRAFT_KEY);
        onSurveyComplete?.();
        setState("submitted");
      }
    } catch {
      setSubmitError("Network error. Please try again.");
      setState("due");
    }
  }

  // ── Render states ──────────────────────────────────────────────────────────

  if (state === "loading") {
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Weekly Survey">
        <div style={s.center}><div style={s.spinner} /></div>
      </HomeLayout>
    );
  }

  if (state === "error") {
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Weekly Survey">
        <div style={s.card}>
          <p style={{ color: "#f87171" }}>{loadError}</p>
          <Link to="/dashboard" style={s.btn}>← Back to Dashboard</Link>
        </div>
      </HomeLayout>
    );
  }

  if (state === "complete") {
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Weekly Survey">
        <div style={{ ...s.card, textAlign: "center" }}>
          <div style={s.bigIcon}>✓</div>
          <h2 style={{ marginTop: 12 }}>All surveys complete!</h2>
          <p style={s.muted}>You have finished all 6 timepoints. Thank you for participating.</p>
          <Link to="/dashboard" style={s.primaryBtn}>Back to Dashboard</Link>
        </div>
      </HomeLayout>
    );
  }

  if (state === "locked") {
    const unlockDate = lockInfo?.next_unlocks_at
      ? new Date(lockInfo.next_unlocks_at).toLocaleDateString("en-US", {
          weekday: "long", month: "long", day: "numeric",
        })
      : "next week";
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Weekly Survey">
        <div style={{ ...s.card, textAlign: "center" }}>
          <div style={s.bigIcon}>🔒</div>
          <h2 style={{ marginTop: 12 }}>
            {TP_LABELS[lockInfo?.timepoint] ?? "Next survey"} is not yet available
          </h2>
          <p style={s.muted}>
            Your next survey unlocks on <strong>{unlockDate}</strong>.
          </p>
          <Link to="/dashboard" style={s.primaryBtn}>Back to Dashboard</Link>
        </div>
      </HomeLayout>
    );
  }

  if (state === "submitted") {
    const next = surveyData.timepoint < 6
      ? TP_LABELS[surveyData.timepoint + 1]
      : null;
    return (
      <HomeLayout user={user} onLogout={onLogout} title="Weekly Survey">
        <div style={{ ...s.card, textAlign: "center" }}>
          <div style={s.bigIcon}>✓</div>
          <h2 style={{ marginTop: 12 }}>
            {TP_LABELS[surveyData.timepoint]} submitted!
          </h2>
          {next && (
            <p style={s.muted}>
              Your next survey ({next}) will be available in 7 days.
            </p>
          )}
          <Link to="/dashboard" style={s.primaryBtn}>Back to Dashboard</Link>
        </div>
      </HomeLayout>
    );
  }

  // ── Due state: render form ─────────────────────────────────────────────────

  const goals = numGoals();
  const answered = totalAnswered();
  const total = totalQuestions();
  const progress = total > 0 ? Math.round((answered / total) * 100) : 0;
  const currentQuestions = questionsForGoal(activeGoal);
  const isLastGoal = activeGoal === goals;
  const isSubmitting = state === "submitting";

  return (
    <HomeLayout
      user={user}
      onLogout={onLogout}
      title={`${TP_LABELS[surveyData.timepoint]} Survey`}
      rightSlot={
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={s.pill}>{progress}% complete</span>
          <button type="button" onClick={handleBack} style={s.btn}>← Exit</button>
        </div>
      }
    >
      <div style={s.wrapper}>

        {/* Draft restored banner */}
        {draftRestored && (
          <div style={s.draftBanner}>
            <span>We restored your unsaved answers from your last session.</span>
            <button
              type="button"
              style={s.draftDismiss}
              onClick={() => {
                localStorage.removeItem(DRAFT_KEY);
                setResponses({});
                setDraftRestored(false);
              }}
            >
              Clear &amp; start fresh
            </button>
          </div>
        )}

        {/* Progress bar */}
        <div style={s.progressTrack}>
          <div style={{ ...s.progressFill, width: `${progress}%` }} />
        </div>

        {/* Goal tabs */}
        <div style={s.tabs}>
          {Array.from({ length: goals }, (_, i) => i + 1).map((g) => {
            const gAnswered = answeredCount(g);
            const gTotal = questionsForGoal(g).length;
            const done = gAnswered === gTotal && gTotal > 0;
            return (
              <button
                key={g}
                onClick={() => setActiveGoal(g)}
                style={{
                  ...s.tab,
                  ...(activeGoal === g ? s.tabActive : {}),
                  ...(done ? s.tabDone : {}),
                }}
              >
                {done ? "✓ " : ""}{goalLabel(g)}
              </button>
            );
          })}
        </div>

        {/* Question card */}
        <div style={s.card}>
          <h3 style={s.goalHeading}>
            Goal {activeGoal}
            {surveyData.form_type !== "t1" && surveyData.goals[activeGoal - 1] && (
              <span style={s.goalSubtitle}> — {surveyData.goals[activeGoal - 1]}</span>
            )}
          </h3>

          <div style={s.questionList}>
            {currentQuestions.map((q) => (
              <QuestionRow
                key={q.id}
                question={q}
                value={getResponse(activeGoal, q.id)}
                onChange={(val) => setResponse(activeGoal, q.id, val)}
              />
            ))}
          </div>

          {submitError && (
            <div style={{ color: "#f87171", fontSize: 13, marginTop: 8 }}>{submitError}</div>
          )}

          {/* Navigation */}
          <div style={s.navRow}>
            <button
              style={s.btn}
              disabled={activeGoal === 1}
              onClick={() => setActiveGoal((g) => g - 1)}
            >
              ← Previous Goal
            </button>

            {isLastGoal ? (
              <button
                style={{ ...s.primaryBtn, cursor: isSubmitting ? "wait" : "pointer" }}
                disabled={isSubmitting}
                onClick={handleSubmit}
              >
                {isSubmitting ? "Submitting…" : "Submit Survey"}
              </button>
            ) : (
              <button style={s.primaryBtn} onClick={() => setActiveGoal((g) => g + 1)}>
                Next Goal →
              </button>
            )}
          </div>
        </div>

      </div>
    </HomeLayout>
  );
}

// ── QuestionRow ────────────────────────────────────────────────────────────────

function QuestionRow({ question, value, onChange }) {
  if (question.scale_type === "goal_text") {
    return (
      <div style={s.qRow}>
        <label style={s.qLabel}>{question.question_text}</label>
        <textarea
          style={s.textarea}
          rows={3}
          placeholder="Describe your goal…"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    );
  }

  // Default: 7-point Likert
  return (
    <div style={s.qRow}>
      <label style={s.qLabel}>
        <span style={s.qNum}>Q{question.question_number}</span>
        {question.question_text}
      </label>
      <div style={s.likertRow}>
        <span style={s.likertEndLabel}>Strongly<br />Disagree</span>
        <div style={s.likertButtons}>
          {[1, 2, 3, 4, 5, 6, 7].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onChange(n)}
              style={{
                ...s.likertBtn,
                ...(Number(value) === n ? s.likertBtnSelected : {}),
              }}
            >
              {n}
            </button>
          ))}
        </div>
        <span style={s.likertEndLabel}>Strongly<br />Agree</span>
      </div>
    </div>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = {
  wrapper: { display: "flex", flexDirection: "column", gap: 14, maxWidth: 820, margin: "0 auto" },

  progressTrack: {
    height: 6, borderRadius: 99,
    background: "rgba(255,255,255,0.08)",
    overflow: "hidden",
  },
  progressFill: {
    height: "100%", borderRadius: 99,
    background: "linear-gradient(90deg, #4f7cff, #7c5cff)",
    transition: "width 0.3s ease",
  },

  tabs: { display: "flex", gap: 8, flexWrap: "wrap" },
  tab: {
    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 700,
    border: "1px solid var(--ghost-border)",
    background: "var(--input-bg-glass)",
    color: "var(--text-dim)",
    cursor: "pointer",
  },
  tabActive: {
    border: "1px solid rgba(79,124,255,0.6)",
    background: "rgba(79,124,255,0.18)",
    color: "var(--text-primary)",
  },
  tabDone: {
    border: "1px solid rgba(74,222,128,0.4)",
    background: "rgba(74,222,128,0.08)",
    color: "#4ade80",
  },

  card: {
    padding: 24, borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
  },

  goalHeading: { margin: "0 0 20px", fontSize: 18, fontWeight: 800 },
  goalSubtitle: { fontWeight: 400, opacity: 0.65, fontSize: 15 },

  questionList: { display: "flex", flexDirection: "column", gap: 24 },

  qRow: { display: "flex", flexDirection: "column", gap: 10 },
  qLabel: { fontSize: 14, lineHeight: 1.5, opacity: 0.92 },
  qNum: {
    display: "inline-block", marginRight: 8,
    fontSize: 11, fontWeight: 800, opacity: 0.45,
    textTransform: "uppercase", letterSpacing: "0.06em",
  },

  likertRow: { display: "flex", alignItems: "center", gap: 10 },
  likertButtons: { display: "flex", gap: 6, flex: 1, justifyContent: "center" },
  likertBtn: {
    width: 38, height: 38, borderRadius: 8, fontSize: 13, fontWeight: 700,
    border: "1px solid var(--ghost-border)",
    background: "var(--input-bg-glass)",
    color: "var(--ghost-color)",
    cursor: "pointer",
    transition: "background 0.15s, border-color 0.15s, color 0.15s",
  },
  likertBtnSelected: {
    background: "rgba(79,124,255,0.85)",
    border: "1px solid rgba(79,124,255,0.9)",
    color: "#fff",
  },
  likertEndLabel: {
    fontSize: 10, opacity: 0.5, textAlign: "center",
    lineHeight: 1.3, whiteSpace: "pre-line", minWidth: 44,
  },

  textarea: {
    width: "100%", padding: "10px 12px", borderRadius: 10,
    background: "var(--input-bg-glass)",
    border: "1px solid var(--input-border-glass)",
    color: "var(--text-primary)", fontSize: 14, lineHeight: 1.5,
    resize: "vertical", boxSizing: "border-box",
  },

  navRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    marginTop: 28, paddingTop: 20,
    borderTop: "1px solid rgba(155,183,255,0.1)",
  },

  btn: {
    padding: "10px 16px", borderRadius: 12, fontWeight: 700, fontSize: 14,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
  primaryBtn: {
    padding: "10px 20px", borderRadius: 12, fontWeight: 800, fontSize: 14,
    border: "1px solid rgba(37,99,235,0.65)",
    background: "rgba(37,99,235,0.85)",
    boxShadow: "0 8px 20px rgba(37,99,235,0.25)",
    color: "#fff", cursor: "pointer",
    textDecoration: "none", display: "inline-flex", alignItems: "center",
  },
  pill: {
    padding: "5px 10px", borderRadius: 999, fontSize: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
  },

  draftBanner: {
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    padding: "10px 16px", borderRadius: 12, fontSize: 13,
    border: "1px solid var(--survey-banner-border)",
    background: "var(--survey-banner-bg)",
    color: "var(--ghost-color)",
  },
  draftDismiss: {
    padding: "6px 10px", borderRadius: 8, fontSize: 12, fontWeight: 700,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    cursor: "pointer", whiteSpace: "nowrap",
  },

  center: { display: "flex", justifyContent: "center", padding: 60 },
  spinner: {
    width: 36, height: 36, borderRadius: "50%",
    border: "3px solid rgba(79,124,255,0.2)",
    borderTop: "3px solid #4f7cff",
    animation: "spin 0.8s linear infinite",
  },
  muted: { opacity: 0.7, fontSize: 14, lineHeight: 1.6, marginBottom: 20 },
  bigIcon: { fontSize: 48, lineHeight: 1 },
};
