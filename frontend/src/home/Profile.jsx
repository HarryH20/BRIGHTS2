import React, { useRef, useState } from "react";
import { Link } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

export default function Profile({ user, onLogout }) {
  // ---------- change password ----------
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwMsg, setPwMsg] = useState(null); // { ok: bool, text: string }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwMsg(null);

    if (newPw !== confirmPw) {
      setPwMsg({ ok: false, text: "New passwords do not match." });
      return;
    }
    if (newPw.length < 8) {
      setPwMsg({ ok: false, text: "New password must be at least 8 characters." });
      return;
    }

    try {
      const res = await fetch("/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = await res.json();
      if (!res.ok) {
        setPwMsg({ ok: false, text: data.error || "Password change failed." });
      } else {
        setPwMsg({ ok: true, text: "Password updated successfully." });
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      }
    } catch {
      setPwMsg({ ok: false, text: "Network error. Please try again." });
    }
  }

  // ---------- avatar ----------
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError] = useState(null);
  const fileInputRef = useRef(null);

  async function handleFileChange(e) {
    const file = e.target.files[0];
    if (!file) return;
    setAvatarError(null);
    setAvatarUploading(true);

    const form = new FormData();
    form.append("file", file);

    try {
      const res = await fetch("/auth/avatar", { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok) {
        setAvatarError(data.error || "Upload failed.");
      } else {
        setAvatarUrl(data.avatar_url);
      }
    } catch {
      setAvatarError("Network error. Please try again.");
    } finally {
      setAvatarUploading(false);
      e.target.value = "";
    }
  }

  return (
    <HomeLayout user={user} onLogout={onLogout} title="Profile / Settings">
      <div style={styles.card}>
        {/* Basic Info */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Account Information</h2>

          <div style={styles.field}>
            <label style={styles.label}>Username</label>
            <div style={styles.value}>{user?.username || "—"}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Email</label>
            <div style={styles.value}>{user?.email || "—"}</div>
          </div>
        </section>

        {/* Profile Picture */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Profile Picture</h2>

          <div style={styles.pictureRow}>
            <div
              style={{
                ...styles.avatarPlaceholder,
                opacity: avatarUploading ? 0.45 : 1,
                overflow: "hidden",
                cursor: "pointer",
              }}
              onClick={() => !avatarUploading && fileInputRef.current?.click()}
              title="Click to change picture"
            >
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              ) : (
                <span style={{ fontSize: 12, opacity: 0.7 }}>
                  {avatarUploading ? "…" : "No Image"}
                </span>
              )}
            </div>

            <div>
              <button
                style={{ ...styles.button, cursor: avatarUploading ? "wait" : "pointer" }}
                disabled={avatarUploading}
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? "Uploading…" : "Upload New Picture"}
              </button>
              {avatarError && (
                <div style={{ ...styles.msg, color: "#f87171", marginTop: 6 }}>{avatarError}</div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>
        </section>

        {/* Phone Number Placeholder */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Phone Number</h2>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <input
              type="text"
              placeholder="Add phone number (coming soon)"
              style={styles.input}
              disabled
            />
          </div>
        </section>

        {/* Change Password */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Change Password</h2>

          <form onSubmit={handlePasswordSubmit}>
            <div style={styles.passwordGrid}>
              <input
                type="password"
                placeholder="Current password"
                style={styles.input}
                value={currentPw}
                onChange={(e) => setCurrentPw(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="New password"
                style={styles.input}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                required
              />
              <input
                type="password"
                placeholder="Confirm new password"
                style={styles.input}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                required
              />
            </div>

            {pwMsg && (
              <div
                style={{
                  ...styles.msg,
                  color: pwMsg.ok ? "#4ade80" : "#f87171",
                  marginBottom: 10,
                }}
              >
                {pwMsg.text}
              </div>
            )}

            <button type="submit" style={{ ...styles.button, cursor: "pointer" }}>
              Update Password
            </button>
          </form>
        </section>

        <div style={{ marginTop: 20 }}>
          <Link to="/dashboard" style={styles.backLink}>
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </HomeLayout>
  );
}

const styles = {
  card: {
    padding: 24,
    borderRadius: 16,
    border: "1px solid rgba(155,183,255,0.16)",
    background: "rgba(16, 25, 42, 0.65)",
    boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
    backdropFilter: "blur(8px)",
    maxWidth: 800,
    margin: "0 auto",
  },

  section: {
    marginBottom: 28,
  },

  h2: {
    marginBottom: 12,
    fontSize: 18,
  },

  field: {
    marginBottom: 14,
  },

  label: {
    fontSize: 12,
    opacity: 0.7,
    display: "block",
    marginBottom: 4,
  },

  value: {
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.08)",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    background: "rgba(255,255,255,0.05)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "#e9eefc",
    marginBottom: 10,
  },

  passwordGrid: {
    display: "grid",
    gap: 10,
    marginBottom: 12,
  },

  pictureRow: {
    display: "flex",
    alignItems: "center",
    gap: 16,
  },

  avatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.14)",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
  },

  button: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid rgba(255,255,255,0.14)",
    background: "rgba(255,255,255,0.06)",
    color: "rgba(233,238,252,0.9)",
    fontWeight: 700,
  },

  msg: {
    fontSize: 13,
  },

  backLink: {
    color: "rgba(233,238,252,0.92)",
    fontWeight: 800,
    textDecoration: "none",
  },
};
