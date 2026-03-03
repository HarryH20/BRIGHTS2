import React, { useEffect, useMemo, useRef, useState } from "react";

/**
 * Pass an array of goals with a stable id + a numeric score.
 * Example: goals=[{ id:"goal1", score: 4.2 }, { id:"goal2", score: 3.8 }]
 */
export default function ProgressCelebration({ goals, durationMs = 2500 }) {
  const prevScoresRef = useRef(new Map());
  const [show, setShow] = useState(false);
  const [burstKey, setBurstKey] = useState(0);

  const currentScores = useMemo(() => {
    const m = new Map();
    (goals || []).forEach((g) => {
      const id = String(g.id ?? g.goal_id ?? g.name ?? "");
      const score = Number(g.score ?? g.value ?? g.avg ?? 0);
      if (id) m.set(id, score);
    });
    return m;
  }, [goals]);

  useEffect(() => {
    // first load: just store baseline, don't celebrate
    if (prevScoresRef.current.size === 0) {
      prevScoresRef.current = currentScores;
      return;
    }

    // trigger if ANY goal improved vs previous scores
    let improved = false;
    for (const [id, score] of currentScores.entries()) {
      const prev = prevScoresRef.current.get(id);
      if (typeof prev === "number" && score > prev) {
        improved = true;
        break;
      }
    }

    prevScoresRef.current = currentScores;

    if (improved) {
      setBurstKey((k) => k + 1);
      setShow(true);
      const t = setTimeout(() => setShow(false), durationMs);
      return () => clearTimeout(t);
    }
  }, [currentScores, durationMs]);

  if (!show) return null;

  return (
    <div style={wrap} aria-live="polite">
      {/* Confetti */}
      <ConfettiBurst key={burstKey} />

      {/* Popup */}
      <div style={toast}>
        <div style={toastTitle}>Congrats!</div>
        <div style={toastBody}>You've made progress on your goals!</div>
      </div>
    </div>
  );
}

function ConfettiBurst() {
  // 60 pieces is plenty without killing perf
  const pieces = Array.from({ length: 60 }, (_, i) => i);

  return (
    <>
      <style>{css}</style>
      <div className="confetti-layer" aria-hidden="true">
        {pieces.map((i) => (
          <span
            key={i}
            className="confetti"
            style={{
              left: `${Math.random() * 100}%`,
              animationDelay: `${Math.random() * 0.25}s`,
              transform: `rotate(${Math.random() * 360}deg)`,
            }}
          />
        ))}
      </div>
    </>
  );
}

const wrap = {
  position: "fixed",
  inset: 0,
  pointerEvents: "none",
  zIndex: 9999,
};

const toast = {
  position: "fixed",
  top: 18,
  left: "50%",
  transform: "translateX(-50%)",
  background: "rgba(16, 25, 42, 0.92)",
  border: "1px solid rgba(155,183,255,0.20)",
  boxShadow: "0 14px 40px rgba(0,0,0,0.45)",
  backdropFilter: "blur(10px)",
  color: "white",
  borderRadius: 16,
  padding: "12px 14px",
  width: "min(520px, calc(100vw - 24px))",
};

const toastTitle = { fontSize: 16, fontWeight: 800, marginBottom: 2 };
const toastBody = { fontSize: 14, opacity: 0.92 };

const css = `
.confetti-layer{
  position: fixed;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}
.confetti{
  position: absolute;
  top: -12px;
  width: 10px;
  height: 14px;
  border-radius: 2px;
  background: hsl(calc(360 * var(--h, 0)), 85%, 60%);
  animation: confetti-fall 1.9s ease-out forwards;
  will-change: transform, top, opacity;
}
.confetti:nth-child(6n+1){ --h: 0.05; }
.confetti:nth-child(6n+2){ --h: 0.18; }
.confetti:nth-child(6n+3){ --h: 0.33; }
.confetti:nth-child(6n+4){ --h: 0.55; }
.confetti:nth-child(6n+5){ --h: 0.72; }
.confetti:nth-child(6n+6){ --h: 0.88; }

/* tiny trick: CSS has no random(), so we simulate sideways drift using alternating keyframes */
.confetti:nth-child(odd){ animation-name: confetti-fall-left; }
.confetti:nth-child(even){ animation-name: confetti-fall-right; }

@keyframes confetti-fall-left{
  0%   { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(-120px, 105vh, 0) rotate(720deg); opacity: 0; }
}
@keyframes confetti-fall-right{
  0%   { transform: translate3d(0,0,0) rotate(0deg); opacity: 1; }
  100% { transform: translate3d(120px, 105vh, 0) rotate(720deg); opacity: 0; }
}
`;