import React from "react";
import AdminShell from "../AdminShell.jsx";
import LinguisticMarkersPlot from "../../graphs/LinguisticMarkersPlot.jsx";
import LinguisticMarkersWordCloud from "../../graphs/LinguisticMarkersWordCloud.jsx";
import { AdminChartSection } from "../adminShared.jsx";

export default function AdminLinguisticsPage({ user, onLogout }) {
  return (
    <AdminShell user={user} onLogout={onLogout} title="Linguistics" subtitle="Words associated with high and low goal progress">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AdminChartSection
          title="Words That Predict Goal Progress"
          subtitle="Language patterns from weekly reflections that correlate with higher or lower goal scores"
        >
          <LinguisticMarkersPlot />
        </AdminChartSection>

        <AdminChartSection
          title="How High and Low Progress Groups Write Differently"
          subtitle="Distinctive words from participant reflections — shared common words removed"
        >
          <LinguisticMarkersWordCloud />
        </AdminChartSection>
      </div>
    </AdminShell>
  );
}
