import React, { useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const ONBOARDED_KEY = "brights2_onboarded";

const PANELS = [
  {
    id: "welcome",
    title: "Welcome to the BRIGHTS Study",
    body: "This is your personal research portal. Over the next 6 weeks, you'll check in once a week to track how you're progressing toward three goals that matter to you.",
    icon: "🎓",
  },
  {
    id: "how",
    title: "How it works",
    icon: "📋",
    items: [
      { icon: "🎯", text: "Set your goals in Week 1 — tell us three things you're working toward" },
      { icon: "📅", text: "Check in weekly — each survey takes about 6 minutes" },
      { icon: "📊", text: "Watch your progress — see your scores visualized over time" },
    ],
  },
  {
    id: "ready",
    title: "You're all set",
    body: "Your Week 1 survey is ready now. It takes about 8 minutes and sets up your goals for the rest of the study.",
    icon: "✅",
  },
];

export default function OnboardingModal({ onClose }) {
  const [panel, setPanel] = useState(0);
  const navigate = useNavigate();

  const isLast = panel === PANELS.length - 1;
  const current = PANELS[panel];

  function handleStart() {
    localStorage.setItem(ONBOARDED_KEY, "true");
    navigate("/survey");
  }

  function handleSkip() {
    onClose();
  }

  return createPortal(
    <div style={styles.backdrop} onClick={(e) => e.target === e.currentTarget && handleSkip()}>
      <div style={styles.modal} role="dialog" aria-modal="true" aria-label="Welcome to the BRIGHTS Study">

        {/* Panel icon + title */}
        <div style={styles.iconWrap}>{current.icon}</div>
        <h2 style={styles.title}>{current.title}</h2>

        {/* Panel content */}
        {current.body && (
          <p style={styles.body}>{current.body}</p>
        )}
        {current.items && (
          <ul style={styles.list}>
            {current.items.map((item) => (
              <li key={item.icon} style={styles.listItem}>
                <span style={styles.listIcon}>{item.icon}</span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        )}

        {/* Dot indicator */}
        <div style={styles.dots}>
          {PANELS.map((_, i) => (
            <div
              key={i}
              style={{ ...styles.dot, ...(i === panel ? styles.dotActive : {}) }}
            />
          ))}
        </div>

        {/* Navigation */}
        {isLast ? (
          <div style={styles.actions}>
            <button style={styles.primaryBtn} onClick={handleStart}>
              Start Week 1 Survey →
            </button>
            <button style={styles.skipBtn} onClick={handleSkip}>
              Skip for now
            </button>
          </div>
        ) : (
          <div style={styles.actions}>
            {panel > 0 && (
              <button style={styles.secondaryBtn} onClick={() => setPanel((p) => p - 1)}>
                ← Back
              </button>
            )}
            <button style={styles.primaryBtn} onClick={() => setPanel((p) => p + 1)}>
              Next →
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

const styles = {
  backdrop: {
    position: "fixed",
    inset: 0,
    background: "rgba(0, 0, 0, 0.6)",
    backdropFilter: "blur(4px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    zIndex: 1000,
  },
  modal: {
    width: "100%",
    maxWidth: 480,
    padding: 32,
    borderRadius: 20,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
    boxShadow: "0 24px 60px rgba(0,0,0,0.5)",
    backdropFilter: "blur(12px)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 16,
    textAlign: "center",
  },
  iconWrap: {
    fontSize: 52,
    lineHeight: 1,
  },
  title: {
    margin: 0,
    fontSize: 22,
    fontWeight: 800,
    color: "var(--text-primary)",
  },
  body: {
    margin: 0,
    fontSize: 15,
    lineHeight: 1.65,
    opacity: 0.85,
    color: "var(--text-primary)",
  },
  list: {
    margin: 0,
    padding: 0,
    listStyle: "none",
    display: "flex",
    flexDirection: "column",
    gap: 14,
    width: "100%",
    textAlign: "left",
  },
  listItem: {
    display: "flex",
    alignItems: "flex-start",
    gap: 12,
    fontSize: 14,
    lineHeight: 1.55,
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--subtle-border)",
    background: "var(--surface-subtle)",
    color: "var(--text-primary)",
  },
  listIcon: {
    fontSize: 20,
    flexShrink: 0,
    marginTop: 1,
  },
  dots: {
    display: "flex",
    gap: 8,
    justifyContent: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: "50%",
    background: "var(--ghost-border)",
    transition: "background 0.2s",
  },
  dotActive: {
    background: "var(--accent)",
  },
  actions: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 10,
    width: "100%",
  },
  primaryBtn: {
    width: "100%",
    padding: "12px 20px",
    borderRadius: 14,
    border: "1px solid var(--primary-btn-border)",
    background: "var(--primary-btn-bg)",
    color: "#fff",
    fontWeight: 800,
    fontSize: 15,
    cursor: "pointer",
    boxShadow: "0 8px 20px var(--primary-btn-shadow)",
  },
  secondaryBtn: {
    padding: "10px 16px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
    width: "100%",
  },
  skipBtn: {
    background: "none",
    border: "none",
    color: "var(--text-dim)",
    fontSize: 13,
    cursor: "pointer",
    textDecoration: "underline",
    padding: 0,
  },
};
