import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Login from "./auth/Login.jsx";
import Register from "./auth/Register.jsx";
import Dashboard from "./home/Dashboard.jsx";
import Profile from "./home/Profile.jsx";
import SurveyResults from "./home/SurveyResults.jsx";
import SurveyAnalysis from "./home/SurveyAnalysis.jsx";
import GoalPage from "./home/GoalPage.jsx";
import OverviewPage from "./home/OverviewPage.jsx";

function RequireAuth({ user, checking, children }) {
  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/auth/me", {
            credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUser(data.user ?? data);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function handleLogout() {
    try {
      await fetch("/auth/logout", {
          method: "POST",
          credentials: "include",
      });
    } finally {
      setUser(null);
      navigate("/login", { replace: true });
    }
  }

  return (
    <Routes>
      <Route
        path="/login"
        element={
          checking ? (
            <div style={{ padding: 20 }}>Loading...</div>
          ) : user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <div style={{ padding: 20 }}>
              <Login
                onLogin={(u) => {
                  setUser(u);
                  navigate("/dashboard", { replace: true });
                }}
                onGoToRegister={() => navigate("/register")}
              />
            </div>
          )
        }
      />

      <Route
        path="/register"
        element={
          checking ? (
            <div style={{ padding: 20 }}>Loading...</div>
          ) : user ? (
            <Navigate to="/dashboard" replace />
          ) : (
            <div style={{ padding: 20 }}>
              <Register
                onRegistered={() => navigate("/login")}
                onGoToLogin={() => navigate("/login")}
              />
            </div>
          )
        }
      />

      <Route
        path="/dashboard/*"
        element={
          <RequireAuth user={user} checking={checking}>
            <Dashboard user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      {/* New “tabs/pages” under home/ */}
      <Route
        path="/profile/*"
        element={
          <RequireAuth user={user} checking={checking}>
            <Profile user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/surveys/:surveyId/results"
        element={
          <RequireAuth user={user} checking={checking}>
            <SurveyResults user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/surveys/:surveyId/analysis"
        element={
          <RequireAuth user={user} checking={checking}>
            <SurveyAnalysis user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/goals/:goalId"
        element={
          <RequireAuth user={user} checking={checking}>
            <GoalPage user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route
        path="/overview"
        element={
          <RequireAuth user={user} checking={checking}>
            <OverviewPage user={user} onLogout={handleLogout} />
          </RequireAuth>
        }
      />

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}