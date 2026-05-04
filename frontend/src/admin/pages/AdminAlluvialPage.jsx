import React from "react";
import AdminShell from "../AdminShell.jsx";
import AdminAlluvial from "../../graphs/AdminAlluvial.jsx";
import { AdminChartSection } from "../adminShared.jsx";

export default function AdminAlluvialPage({ user, onLogout }) {
  return (
    <AdminShell user={user} onLogout={onLogout} title="Alluvial" subtitle="How participants moved between progress groups">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AdminChartSection
          title="Participant Flow Between Progress Groups"
          subtitle="How participants moved between high and low goal progress groups across study weeks"
        >
          <AdminAlluvial />
        </AdminChartSection>
      </div>
    </AdminShell>
  );
}
