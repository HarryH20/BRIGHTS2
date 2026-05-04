import React, { useEffect, useState } from "react";
import AdminSidebar from "./AdminSidebar.jsx";
import AdminHeader from "./AdminHeader.jsx";
import AdminCommandPalette from "./AdminCommandPalette.jsx";

export default function AdminShell({ user, onLogout, children, title, subtitle, actions }) {
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    function handleKeyDown(e) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div style={s.shell}>
      <AdminSidebar user={user} onLogout={onLogout} researcherRole={user?.researcher_role ?? null} />

      <div style={s.content}>
        <AdminHeader title={title} subtitle={subtitle} actions={actions} />
        <main style={s.main}>
          {children}
        </main>
      </div>

      <AdminCommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

const s = {
  shell: {
    display: "flex",
    height: "100vh",
    background: "var(--shell-bg)",
    color: "var(--shell-text)",
    fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    overflow: "hidden",
  },
  content: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  main: {
    flex: 1,
    overflowY: "auto",
    padding: 24,
  },
};
