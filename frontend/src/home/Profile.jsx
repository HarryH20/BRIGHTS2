import React, { useEffect, useRef, useState } from "react";
import ParticipantShell from "./ParticipantShell.jsx";

export default function Profile({ user, onLogout, onUserUpdate }) {
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
        credentials: "include",
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

  // ---------- display name ----------
  const [displayName, setDisplayName] = useState(user?.display_name || "");
  const [displayNameMsg, setDisplayNameMsg] = useState(null); // { ok: bool, text: string }

  async function handleDisplayNameSubmit(e) {
    e.preventDefault();
    setDisplayNameMsg(null);

    if (!displayName.trim()) {
      setDisplayNameMsg({ ok: false, text: "Display name cannot be empty." });
      return;
    }

    try {
      const res = await fetch("/auth/display-name", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ display_name: displayName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setDisplayNameMsg({ ok: false, text: data.error || "Update failed." });
      } else {
        setDisplayNameMsg({ ok: true, text: "Display name updated." });
        setDisplayName(data.display_name);
        onUserUpdate?.({ display_name: data.display_name });
      }
    } catch {
      setDisplayNameMsg({ ok: false, text: "Network error. Please try again." });
    }
  }

  // ---------- notification preferences ----------
  const [notifPrefs, setNotifPrefs] = useState(null);
  const [notifMsg, setNotifMsg] = useState(null);
  const [notifSaving, setNotifSaving] = useState(false);

  useEffect(() => {
    fetch("/api/notifications/preferences", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((d) => { if (d) setNotifPrefs(d); })
      .catch(() => {});
  }, []);

  async function handleNotifPrefsSubmit(e) {
    e.preventDefault();
    setNotifSaving(true);
    setNotifMsg(null);
    try {
      const res = await fetch("/api/notifications/preferences", {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notifPrefs),
      });
      const data = await res.json();
      if (!res.ok) {
        setNotifMsg({ ok: false, text: data.error || "Failed to save" });
      } else {
        setNotifPrefs(data);
        setNotifMsg({ ok: true, text: "Preferences saved." });
        setTimeout(() => setNotifMsg(null), 2500);
      }
    } catch {
      setNotifMsg({ ok: false, text: "Network error." });
    } finally {
      setNotifSaving(false);
    }
  }

  // ---------- withdrawal ----------
  const [withdrawConfirm, setWithdrawConfirm] = useState(false);
  const [withdrawScope, setWithdrawScope] = useState("full");
  const [withdrawReason, setWithdrawReason] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);
  const [withdrawMsg, setWithdrawMsg] = useState(null);

  async function handleWithdraw(e) {
    e.preventDefault();
    setWithdrawing(true);
    setWithdrawMsg(null);
    try {
      const res = await fetch("/auth/withdraw", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ scope: withdrawScope, reason: withdrawReason || null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setWithdrawMsg({ ok: false, text: data.error || "Withdrawal request failed." });
      } else {
        setWithdrawMsg({ ok: true, text: "Withdrawal request submitted. Your study coordinator will follow up." });
        setWithdrawConfirm(false);
      }
    } catch {
      setWithdrawMsg({ ok: false, text: "Network error. Please try again." });
    } finally {
      setWithdrawing(false);
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
      const res = await fetch("/auth/avatar", { method: "POST", credentials: "include", body: form });
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
    <ParticipantShell user={user} onLogout={onLogout} title="Profile / Settings">
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

        {/* Display Name */}
        <section style={styles.section}>
          <h2 style={styles.h2}>Display Name</h2>

          <form onSubmit={handleDisplayNameSubmit}>
            <div style={styles.field}>
              <input
                type="text"
                placeholder="Add the name displayed on your dashboard"
                style={styles.input}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                maxLength={100}
              />
            </div>

            {displayNameMsg && (
              <div style={{ ...styles.msg, color: displayNameMsg.ok ? "#4ade80" : "#f87171", marginBottom: 10 }}>
                {displayNameMsg.text}
              </div>
            )}

            <button type="submit" style={{ ...styles.button, cursor: "pointer" }}>
              Save Display Name
            </button>
          </form>
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

        {/* Notification Preferences */}
        {notifPrefs && (
          <section style={styles.section}>
            <h2 style={styles.h2}>Notification Preferences</h2>
            <form onSubmit={handleNotifPrefsSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 12, fontSize: 14, color: "var(--text-primary)" }}>
                <input
                  type="checkbox"
                  checked={notifPrefs.reminders_enabled}
                  onChange={(e) => setNotifPrefs((p) => ({ ...p, reminders_enabled: e.target.checked }))}
                  style={{ width: 18, height: 18, cursor: "pointer" }}
                />
                Enable study reminders
              </label>
              {notifMsg && (
                <div style={{ ...styles.msg, color: notifMsg.ok ? "#4ade80" : "#f87171" }}>{notifMsg.text}</div>
              )}
              <button type="submit" disabled={notifSaving} style={{ ...styles.button, cursor: notifSaving ? "wait" : "pointer", alignSelf: "flex-start" }}>
                {notifSaving ? "Saving…" : "Save Preferences"}
              </button>
            </form>
          </section>
        )}

        {/* Withdraw from Study — only show when enrolled */}
        {user?.active_enrollment && (
          <section style={styles.section}>
            <h2 style={{ ...styles.h2, color: "#f87171" }}>Withdraw from Study</h2>
            <p style={{ fontSize: 13, color: "var(--text-muted, #8b9cbe)", marginBottom: 12, lineHeight: 1.55 }}>
              You may withdraw from the study at any time. Your participation is voluntary.
              Withdrawing will not affect any services you receive.
            </p>

            {withdrawMsg && (
              <div style={{ ...styles.msg, color: withdrawMsg.ok ? "#4ade80" : "#f87171", marginBottom: 12 }}>
                {withdrawMsg.text}
              </div>
            )}

            {!withdrawConfirm ? (
              <button
                style={{ ...styles.button, background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.35)", color: "#f87171", cursor: "pointer" }}
                onClick={() => setWithdrawConfirm(true)}
              >
                Request Withdrawal
              </button>
            ) : (
              <form onSubmit={handleWithdraw} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                  Withdrawal Scope
                  <select
                    value={withdrawScope}
                    onChange={(e) => setWithdrawScope(e.target.value)}
                    style={{ ...styles.input, cursor: "pointer" }}
                  >
                    <option value="full">Full withdrawal — stop participation and remove from future contact</option>
                    <option value="future_only">Future only — stop new data collection, keep existing data</option>
                    <option value="data_only">Data deletion request — also request deletion of collected data</option>
                  </select>
                </label>
                <label style={{ fontSize: 13, display: "flex", flexDirection: "column", gap: 4 }}>
                  Reason (optional)
                  <textarea
                    value={withdrawReason}
                    onChange={(e) => setWithdrawReason(e.target.value)}
                    placeholder="You don't need to provide a reason, but it helps us improve."
                    style={{ ...styles.input, minHeight: 72, resize: "vertical" }}
                    maxLength={500}
                  />
                </label>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="submit"
                    disabled={withdrawing}
                    style={{ ...styles.button, background: "rgba(248,113,113,0.15)", border: "1px solid rgba(248,113,113,0.4)", color: "#f87171", cursor: withdrawing ? "wait" : "pointer" }}
                  >
                    {withdrawing ? "Submitting…" : "Confirm Withdrawal"}
                  </button>
                  <button
                    type="button"
                    onClick={() => { setWithdrawConfirm(false); setWithdrawMsg(null); }}
                    style={{ ...styles.button, cursor: "pointer" }}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

      </div>
    </ParticipantShell>
  );
}

const styles = {
  card: {
    padding: 24,
    borderRadius: 16,
    border: "1px solid var(--card-border)",
    background: "var(--card-bg)",
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
    background: "var(--input-bg-glass)",
    border: "1px solid var(--input-border-glass)",
  },

  input: {
    width: "100%",
    padding: "10px 12px",
    borderRadius: 10,
    background: "var(--input-bg-glass)",
    border: "1px solid var(--input-border-glass)",
    color: "var(--text-primary)",
    marginBottom: 10,
    fontSize: 16,
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
    background: "var(--ghost-bg)",
    border: "1px solid var(--ghost-border)",
    display: "grid",
    placeItems: "center",
    fontSize: 12,
  },

  button: {
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid var(--ghost-border)",
    background: "var(--ghost-bg)",
    color: "var(--ghost-color)",
    fontWeight: 700,
  },

  msg: {
    fontSize: 13,
  },
};
