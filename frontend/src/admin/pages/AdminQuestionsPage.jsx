import React, { useCallback, useEffect, useState } from "react";
import AdminShell from "../AdminShell.jsx";
import { adminStyles as s } from "../adminStyles.js";
import { FORM_TYPES } from "../adminShared.jsx";

export default function AdminQuestionsPage({ user, onLogout }) {
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
      .then((data) => { if (!cancelled) setQuestions(data.questions ?? []); })
      .catch((e) => { if (!cancelled) setError(e.message); });
    return () => { cancelled = true; };
  }, [formType, showHistory]);

  useEffect(() => {
    setEditingId(null);
    setEditText("");
    const cancel = loadQuestions();
    return cancel;
  }, [loadQuestions]);

  function startEdit(q) { setEditingId(q.id); setEditText(q.question_text); }
  function cancelEdit() { setEditingId(null); setEditText(""); }

  async function saveEdit(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}`, {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question_text: editText }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Save failed");
      setQuestions((prev) => prev.map((x) => (x.id === q.id ? data.question : x)));
      setEditingId(null);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function deactivate(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}/deactivate`, { method: "POST", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Deactivate failed");
      loadQuestions();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function reactivate(q) {
    setSaving(true);
    try {
      const r = await fetch(`/api/admin/survey/questions/${q.id}/reactivate`, { method: "POST", credentials: "include" });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Reactivate failed");
      loadQuestions();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  async function addQuestion(e) {
    e.preventDefault();
    if (!newText.trim()) return;
    setSaving(true);
    try {
      const r = await fetch("/api/admin/survey/questions", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ form_type: formType, question_text: newText.trim() }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.error ?? "Add failed");
      setNewText(""); loadQuestions();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  }

  return (
    <AdminShell user={user} onLogout={onLogout} title="Questions" subtitle="Edit and manage survey question bank">
      <div style={s.tabContent}>
        <div style={s.subTabBar}>
          {FORM_TYPES.map((ft) => (
            <button key={ft} onClick={() => setFormType(ft)}
              style={{ ...s.subTabBtn, ...(formType === ft ? s.subTabBtnActive : {}) }}>
              {ft.toUpperCase()}
            </button>
          ))}
          <label style={{ ...s.filterLabel, flexDirection: "row", alignItems: "center", gap: 6, marginLeft: "auto", fontSize: 13 }}>
            <input type="checkbox" checked={showHistory} onChange={(e) => setShowHistory(e.target.checked)} />
            Show inactive
          </label>
        </div>

        {error && <div style={s.errorText}>{error}</div>}

        <div style={s.questionList}>
          {questions.length === 0 && (
            <div style={{ padding: 16, opacity: 0.5 }}>No questions for {formType.toUpperCase()}.</div>
          )}
          {questions.map((q, idx) => (
            <div key={q.id} style={{ ...s.questionRow, ...(q.status === "inactive" ? s.questionRowInactive : {}) }}>
              <div style={s.questionMeta}>
                <span style={s.questionNum}>Q{q.question_number ?? idx + 1}</span>
                {q.status === "inactive" && <span style={s.inactiveTag}>inactive</span>}
              </div>
              {editingId === q.id ? (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
                  <textarea style={s.editTextarea} value={editText} onChange={(e) => setEditText(e.target.value)} rows={3} />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button style={s.btnPrimary} onClick={() => saveEdit(q)} disabled={saving}>Save</button>
                    <button style={s.btnGhost} onClick={cancelEdit} disabled={saving}>Cancel</button>
                  </div>
                </div>
              ) : (
                <div style={s.questionText}>{q.question_text}</div>
              )}
              {editingId !== q.id && (
                <div style={s.questionActions}>
                  {q.status !== "inactive" && (
                    <>
                      <button style={s.btnGhost} onClick={() => startEdit(q)}>Edit</button>
                      <button style={{ ...s.btnGhost, color: "#ffb4b4", borderColor: "#ffb4b4" }}
                        onClick={() => { if (window.confirm(`Deactivate Q${q.question_number}?`)) deactivate(q); }}>
                        Deactivate
                      </button>
                    </>
                  )}
                  {q.status === "inactive" && (
                    <button style={{ ...s.btnGhost, color: "#7ecb8f", borderColor: "#7ecb8f" }}
                      onClick={() => reactivate(q)} disabled={saving}>
                      Reactivate
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        <form onSubmit={addQuestion} style={s.addForm}>
          <h3 style={{ ...s.sectionHeading, marginTop: 0 }}>Add question to {formType.toUpperCase()}</h3>
          <textarea style={s.editTextarea} placeholder="Question text…" value={newText}
            onChange={(e) => setNewText(e.target.value)} rows={2} />
          <button type="submit" style={s.btnPrimary} disabled={saving || !newText.trim()}>Add question</button>
        </form>
      </div>
    </AdminShell>
  );
}
