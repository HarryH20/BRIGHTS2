import React from "react";
import { useNavigate } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import AdminShell from "../AdminShell.jsx";

export default function AdminAccessRestrictedPage({ user, onLogout, roleName }) {
  const navigate = useNavigate();
  return (
    <AdminShell user={user} onLogout={onLogout} title="Access Restricted">
      <div style={{
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "center", minHeight: "60vh", textAlign: "center", gap: 16, padding: "40px 24px",
      }}>
        <ShieldAlert size={48} style={{ opacity: 0.3, color: "var(--shell-text-muted)" }} />
        <div style={{ fontSize: 20, fontWeight: 800, color: "var(--shell-text)" }}>
          Access Restricted
        </div>
        <p style={{ fontSize: 14, color: "var(--shell-text-secondary)", maxWidth: 380, lineHeight: 1.6, margin: 0 }}>
          Your role ({roleName}) does not have permission to access this section.
          Contact the Principal Investigator if you need access.
        </p>
        <button
          onClick={() => navigate("/admin")}
          style={{
            marginTop: 8, padding: "10px 20px", borderRadius: 10, border: "1px solid var(--shell-border-strong)",
            background: "var(--shell-surface-2)", color: "var(--shell-text)", fontWeight: 600,
            fontSize: 13, cursor: "pointer",
          }}
        >
          ← Go to Overview
        </button>
      </div>
    </AdminShell>
  );
}
