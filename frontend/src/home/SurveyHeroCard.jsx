import React from "react";
import { motion } from "framer-motion";
import { Lock, CheckCircle2 } from "lucide-react";

function formatDate(isoOrDate) {
  if (!isoOrDate) return "";
  const d = new Date(isoOrDate);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

function relativeTime(isoString) {
  if (!isoString) return "";
  const diff = new Date(isoString) - Date.now();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  if (days <= 0) return "soon";
  if (days === 1) return "in 1 day";
  return `in ${days} days`;
}

function availableUntilDate() {
  const d = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  return d.toLocaleDateString("en-US", { month: "long", day: "numeric" });
}

export default function SurveyHeroCard({ status, timepoint, nextUnlocksAt, onStartSurvey }) {
  if (status === "due") {
    return (
      <div style={s.dueCard}>
        <div style={s.eyebrow}>WEEK {timepoint} SURVEY</div>
        <div style={s.dueHeadline}>How are things tracking for you?</div>
        <div style={s.dueSub}>
          Takes about 5–6 minutes. Available until {availableUntilDate()}.
        </div>
        <motion.button
          type="button"
          onClick={onStartSurvey}
          style={s.ctaBtn}
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
        >
          Start Week {timepoint} Survey →
        </motion.button>
        <div style={s.privacyNote}>🔒 Your responses are private and secure.</div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div style={s.lockedRow}>
        <Lock size={16} color="var(--shell-text-muted)" style={{ flexShrink: 0 }} />
        <span style={s.lockedText}>
          Week {timepoint} unlocks on {formatDate(nextUnlocksAt) || "next week"}
        </span>
        {nextUnlocksAt && (
          <span style={s.lockedRelative}>Check back {relativeTime(nextUnlocksAt)}</span>
        )}
      </div>
    );
  }

  if (status === "complete") {
    return (
      <div style={s.completeCard}>
        <CheckCircle2 size={32} color="var(--shell-teal)" style={{ marginBottom: 10 }} />
        <div style={s.completeHeadline}>You&apos;ve completed all 6 weeks!</div>
        <div style={s.completeSub}>
          Thank you for your participation in this research study.
        </div>
        <button type="button" style={s.downloadBtn}>Download your summary →</button>
      </div>
    );
  }

  return null;
}

const s = {
  dueCard: {
    background: "linear-gradient(135deg, rgba(110,139,255,0.12) 0%, rgba(79,209,197,0.06) 100%)",
    border: "1px solid rgba(110,139,255,0.35)",
    borderRadius: 16,
    padding: 24,
  },
  eyebrow: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "2px",
    color: "var(--shell-accent)",
    textTransform: "uppercase",
    marginBottom: 8,
  },
  dueHeadline: {
    fontSize: 22,
    fontWeight: 800,
    color: "var(--shell-text)",
    marginBottom: 8,
  },
  dueSub: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    marginBottom: 20,
  },
  ctaBtn: {
    width: "100%",
    height: 52,
    background: "var(--shell-accent)",
    border: "none",
    borderRadius: 12,
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  privacyNote: {
    fontSize: 12,
    color: "var(--shell-text-muted)",
    textAlign: "center",
    marginTop: 10,
  },
  lockedRow: {
    background: "var(--shell-surface-1)",
    border: "1px solid var(--shell-border)",
    borderRadius: 12,
    padding: "14px 16px",
    display: "flex",
    alignItems: "center",
    gap: 12,
  },
  lockedText: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    flex: 1,
  },
  lockedRelative: {
    fontSize: 13,
    color: "var(--shell-text-muted)",
    whiteSpace: "nowrap",
  },
  completeCard: {
    background: "linear-gradient(135deg, rgba(79,209,197,0.10) 0%, rgba(110,139,255,0.06) 100%)",
    border: "1px solid rgba(79,209,197,0.3)",
    borderRadius: 16,
    padding: 20,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
  },
  completeHeadline: {
    fontSize: 20,
    fontWeight: 800,
    color: "var(--shell-text)",
    marginBottom: 8,
  },
  completeSub: {
    fontSize: 14,
    color: "var(--shell-text-secondary)",
    marginBottom: 16,
    maxWidth: 320,
  },
  downloadBtn: {
    padding: "10px 20px",
    borderRadius: 10,
    border: "1px solid rgba(79,209,197,0.4)",
    background: "rgba(79,209,197,0.08)",
    color: "var(--shell-teal)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
};
