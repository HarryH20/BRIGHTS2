import React from "react";
import { Link, useParams } from "react-router-dom";
import HomeLayout from "./HomeLayout.jsx";

export default function SurveyResults({ user, onLogout }) {
  const { surveyId } = useParams();

  return (
    <HomeLayout user={user} onLogout={onLogout} title={`Survey Results — ${surveyId}`}>
      <div style={card}>
        <p style={muted}>Placeholder for responses/results view.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <Link to={`/surveys/${surveyId}/analysis`} style={pill}>Go to Analysis →</Link>
          <Link to="/dashboard" style={pill}>Back to Dashboard</Link>
        </div>
      </div>
    </HomeLayout>
  );
}

const card = {
  padding: 18,
  borderRadius: 16,
  border: "1px solid rgba(155,183,255,0.16)",
  background: "rgba(16, 25, 42, 0.65)",
  boxShadow: "0 12px 30px rgba(0,0,0,0.32)",
  backdropFilter: "blur(8px)",
};
const muted = { opacity: 0.82, fontSize: 14, lineHeight: 1.45 };
const pill = {
  padding: "10px 12px",
  borderRadius: 12,
  border: "1px solid rgba(255,255,255,0.14)",
  background: "rgba(255,255,255,0.06)",
  color: "rgba(233,238,252,0.92)",
  fontWeight: 800,
  textDecoration: "none",
  display: "inline-flex",
};