import React from "react";

const KEYFRAMES = `
  @keyframes radar-spin {
    from { transform: rotate(-90deg); }
    to   { transform: rotate(270deg); }
  }
  @keyframes ring-pulse {
    0%, 100% { opacity: 0.12; transform: translate(-50%, -50%) scale(1);   }
    50%       { opacity: 0.40; transform: translate(-50%, -50%) scale(1.06); }
  }
  @keyframes dot-bounce {
    0%, 80%, 100% { opacity: 0.25; transform: scale(0.75); }
    40%           { opacity: 1;    transform: scale(1);    }
  }
  @keyframes screen-fade-in {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
`;

export default function LoadingScreen({ status = "Loading..." }) {
  return (
    <>
      <style>{KEYFRAMES}</style>
      <div style={styles.page}>
        <div style={styles.content}>

          {/* Radar sweep animation */}
          <div style={styles.radarContainer}>
            <div style={{ ...styles.ring, width: 190, height: 190, animationDelay: "0s"    }} />
            <div style={{ ...styles.ring, width: 126, height: 126, animationDelay: "0.35s" }} />
            <div style={{ ...styles.ring, width: 62,  height: 62,  animationDelay: "0.7s"  }} />
            <div style={styles.sweepWrapper}>
              <div style={styles.sweep} />
            </div>
            <div style={styles.centerDot} />
          </div>

          {/* Branding */}
          <h1 style={styles.title}>BRIGHTS</h1>

          {/* Status line */}
          <p style={styles.status}>{status}</p>

          {/* Pulsing dots */}
          <div style={styles.dotsRow}>
            <div style={{ ...styles.dot, animationDelay: "0s"    }} />
            <div style={{ ...styles.dot, animationDelay: "0.2s"  }} />
            <div style={{ ...styles.dot, animationDelay: "0.4s"  }} />
          </div>

        </div>
      </div>
    </>
  );
}

const styles = {
  page: {
    position: "fixed",
    inset: 0,
    background:
      "radial-gradient(1200px 600px at 20% 0%, #172a52 0%, #0b1220 55%, #070b14 100%)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    animation: "screen-fade-in 0.4s ease",
    zIndex: 1000,
  },
  content: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 28,
  },

  // ── Radar ──────────────────────────────────────────────────
  radarContainer: {
    position: "relative",
    width: 190,
    height: 190,
  },
  ring: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    borderRadius: "50%",
    border: "1px solid rgba(79, 124, 255, 0.35)",
    animation: "ring-pulse 2.2s ease-in-out infinite",
  },
  sweepWrapper: {
    position: "absolute",
    inset: 0,
    animation: "radar-spin 2.2s linear infinite",
  },
  sweep: {
    position: "absolute",
    top: "50%",
    left: "50%",
    width: "50%",
    height: 2,
    transformOrigin: "left center",
    background: "linear-gradient(to right, rgba(79,124,255,0.95), transparent)",
    borderRadius: 2,
  },
  centerDot: {
    position: "absolute",
    top: "50%",
    left: "50%",
    transform: "translate(-50%, -50%)",
    width: 10,
    height: 10,
    borderRadius: "50%",
    background: "#4f7cff",
    boxShadow: "0 0 12px rgba(79, 124, 255, 0.9)",
  },

  // ── Text ───────────────────────────────────────────────────
  title: {
    margin: 0,
    fontSize: 34,
    fontWeight: 900,
    color: "#e9eefc",
    letterSpacing: 5,
  },
  status: {
    margin: 0,
    fontSize: 14,
    color: "rgba(200, 214, 240, 0.65)",
    letterSpacing: 0.5,
  },

  // ── Dots ───────────────────────────────────────────────────
  dotsRow: {
    display: "flex",
    gap: 8,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "#4f7cff",
    animation: "dot-bounce 1.2s ease-in-out infinite",
  },
};
