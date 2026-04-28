import React, { useState } from "react";
import { useParams } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";
import SurveyResults from "./SurveyResults.jsx";
import SurveyAnalysis from "./SurveyAnalysis.jsx";

export default function SurveyWeekPage({ user, onLogout }) {
  const { week } = useParams();         // "5"
  const surveyId = `t${week}`;          // "t5"
  const [activeTab, setActiveTab] = useState("results");

  return (
    <HomeLayout
      user={user}
      onLogout={onLogout}
      title={`Week ${week} Survey`}
    >
      <div style={styles.tabBar}>
        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "results" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("results")}
        >
          Responses / Results
        </button>

        <button
          style={{
            ...styles.tabBtn,
            ...(activeTab === "analysis" ? styles.tabBtnActive : {}),
          }}
          onClick={() => setActiveTab("analysis")}
        >
          Analysis
        </button>
      </div>

      <div style={styles.content}>
        {activeTab === "results" && (
          <SurveyResults
            user={user}
            onLogout={onLogout}
            surveyId={surveyId}
            noLayout
          />
        )}

        {activeTab === "analysis" && (
          <SurveyAnalysis
            user={user}
            onLogout={onLogout}
            surveyId={surveyId}
            noLayout
          />
        )}
      </div>
    </HomeLayout>
  );
}

const styles = {
  tabBar: {
    display: "flex",
    gap: 2,
    borderBottom: "1px solid var(--subtle-border)",
    marginBottom: 18,
    flexWrap: "wrap",
  },
  tabBtn: {
    padding: "9px 16px",
    background: "none",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "var(--text-dim)",
    cursor: "pointer",
    fontWeight: 700,
    fontSize: 13,
    marginBottom: -1,
  },
  tabBtnActive: {
    color: "var(--text-primary)",
    borderBottom: "2px solid #7b9eff",
  },
  content: {
    marginTop: 10,
  },
};