import React from "react";
import LinguisticMarkersPlot from "../graphs/LinguisticMarkersPlot";
import AgePlot from "../graphs/AgePlot";
import AdminAlluvial from "../graphs/AdminAlluvial";

export default function GraphsPage() {
  return (
    <div style={styles.wrapper}>

      <div style={styles.section}>
        <h2 style={styles.title}>Linguistic Markers</h2>
        <LinguisticMarkersPlot />
      </div>

      <div style={styles.section}>
        <h2 style={styles.title}>Age Distribution</h2>
        <AgePlot />
      </div>

      <div style={styles.section}>
        <h2 style={styles.title}>Alluvial Chart</h2>
        <AdminAlluvial />
      </div>

    </div>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    flexDirection: "column",
    gap: 32,
    width: "100%",
  },
  section: {
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  title: {
    color: "#e9eefc",
    fontSize: 22,
    fontWeight: 700,
    margin: 0,
  },
};