import React from "react";
import AdminShell from "../AdminShell.jsx";
import AdminDemographicBarChart from "../../graphs/AdminDemographicBarChart.jsx";
import AdminCountsDemographics from "../../graphs/AdminCountsDemographics.jsx";
import AdminAttritionFunnel from "../../graphs/AdminAttritionFunnel.jsx";
import { AdminChartSection } from "../adminShared.jsx";

export default function AdminDemographicsPage({ user, onLogout }) {
  return (
    <AdminShell user={user} onLogout={onLogout} title="Demographics" subtitle="Participant breakdown by age, gender, race, and more">
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        <AdminChartSection
          title="Survey Response Distribution by Demographic"
          subtitle="How a selected subgroup responded compared to the full sample across Likert scale questions"
        >
          <AdminDemographicBarChart />
        </AdminChartSection>

        <AdminChartSection
          title="Who Is in the Study"
          subtitle="Number of participants in each demographic category"
        >
          <AdminCountsDemographics />
        </AdminChartSection>

        <AdminChartSection
          title="Who Stayed and Who Left"
          subtitle="Participation rate across all six survey weeks, broken down by demographic group"
        >
          <AdminAttritionFunnel />
        </AdminChartSection>
      </div>
    </AdminShell>
  );
}
