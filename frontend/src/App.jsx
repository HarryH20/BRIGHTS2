import { useEffect, useState } from "react";
import { Routes, Route, Navigate, useNavigate } from "react-router-dom";

import Login from "./auth/Login.jsx";
import Register from "./auth/Register.jsx";
import Dashboard from "./home/Dashboard.jsx";
import Profile from "./home/Profile.jsx";
import SurveyResults from "./home/SurveyResults.jsx";
import SurveyAnalysis from "./home/SurveyAnalysis.jsx";
import GoalPage from "./home/GoalPage.jsx";
import GoalsOverviewPage from "./home/GoalsOverviewPage.jsx";
import OverviewPage from "./home/OverviewPage.jsx";
import SurveyForm from "./home/SurveyForm.jsx";
import SurveyWeekPage from "./home/SurveyWeekPage.jsx";
import AppErrorBoundary from "./components/ErrorBoundary.jsx";

import AdminOverviewPage from "./admin/pages/AdminOverviewPage.jsx";
import AdminParticipantsPage from "./admin/pages/AdminParticipantsPage.jsx";
import AdminGoalProgressPage from "./admin/pages/AdminGoalProgressPage.jsx";
import AdminDemographicsPage from "./admin/pages/AdminDemographicsPage.jsx";
import AdminLinguisticsPage from "./admin/pages/AdminLinguisticsPage.jsx";
import AdminAlluvialPage from "./admin/pages/AdminAlluvialPage.jsx";
import AdminQuestionsPage from "./admin/pages/AdminQuestionsPage.jsx";
import AdminStatsPage from "./admin/pages/AdminStatsPage.jsx";
import AdminAuditPage from "./admin/pages/AdminAuditPage.jsx";
import AdminSessionsPage from "./admin/pages/AdminSessionsPage.jsx";
import AdminStudyPage from "./admin/pages/AdminStudyPage.jsx";
import AdminExportPage from "./admin/pages/AdminExportPage.jsx";
import AdminResearchersPage from "./admin/pages/AdminResearchersPage.jsx";
import AdminConditionsPage from "./admin/pages/AdminConditionsPage.jsx";
import AdminQualityPage from "./admin/pages/AdminQualityPage.jsx";
import AdminAccessRestrictedPage from "./admin/pages/AdminAccessRestrictedPage.jsx";
import ResearcherJoinPage from "./auth/ResearcherJoinPage.jsx";
import JoinStudyPage from "./auth/JoinStudyPage.jsx";

function RequireAuth({ user, checking, children }) {
  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin" || user.is_researcher) return <Navigate to="/admin" replace />;
  return children;
}

function RequireAdmin({ user, checking, children }) {
  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role !== "admin" && !user.is_researcher) return <Navigate to="/dashboard" replace />;
  return children;
}

function RoleRequireAdmin({ user, checking, onLogout, children }) {
  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (user.role === "admin") return children;
  if (user.researcher_role === "pi") return children;
  if (user.is_researcher) return (
    <AdminAccessRestrictedPage user={user} onLogout={onLogout} roleName={user.researcher_role} />
  );
  return <Navigate to="/login" replace />;
}

const EMPTY_CHART_CACHE = { goals: [], roseFigure: null, radarFigures: {}, loaded: false };

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [chartCache, setChartCache] = useState(EMPTY_CHART_CACHE);
  const navigate = useNavigate();

  function clearChartCache() {
    setChartCache(EMPTY_CHART_CACHE);
  }

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUser(data.user ?? data);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function handleUserUpdate(updates) {
    setUser((prev) => ({ ...prev, ...updates }));
  }

  async function handleLogout() {
    try {
      await fetch("/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      setUser(null);
      clearChartCache();
      navigate("/login", { replace: true });
    }
  }

  return (
    <AppErrorBoundary context="page">
      <Routes>
        <Route
          path="/login"
          element={
            checking ? (
              <div style={{ padding: 20 }}>Loading...</div>
            ) : user ? (
              <Navigate to={(user.role === "admin" || user.is_researcher) ? "/admin" : "/dashboard"} replace />
            ) : (
              <div style={{ padding: 20 }}>
                <Login
                  onLogin={(u) => {
                    setUser(u);
                    navigate((u.role === "admin" || u.is_researcher) ? "/admin" : "/dashboard", { replace: true });
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

        {/* ── Public researcher join route ────────────────────────────── */}
        <Route path="/researcher/join/:token" element={<ResearcherJoinPage />} />

        {/* ── Public participant join route ────────────────────────────── */}
        <Route path="/join/:code" element={<JoinStudyPage />} />

        {/* ── Participant routes ──────────────────────────────────────────── */}
        <Route
          path="/dashboard/*"
          element={
            <RequireAuth user={user} checking={checking}>
              <Dashboard user={user} onLogout={handleLogout} chartCache={chartCache} setChartCache={setChartCache} />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/*"
          element={
            <RequireAuth user={user} checking={checking}>
              <Profile user={user} onLogout={handleLogout} onUserUpdate={handleUserUpdate} />
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
          path="/goals"
          element={
            <RequireAuth user={user} checking={checking}>
              <GoalsOverviewPage user={user} onLogout={handleLogout} chartCache={chartCache} setChartCache={setChartCache} />
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
        <Route
          path="/survey/*"
          element={
            <RequireAuth user={user} checking={checking}>
              <AppErrorBoundary context="survey">
                <SurveyForm user={user} onLogout={handleLogout} onSurveyComplete={clearChartCache} />
              </AppErrorBoundary>
            </RequireAuth>
          }
        />
        <Route
          path="/survey/week/:week"
          element={
            <RequireAuth user={user} checking={checking}>
              <SurveyWeekPage user={user} onLogout={handleLogout} />
            </RequireAuth>
          }
        />

        {/* ── Admin routes ────────────────────────────────────────────────── */}
        <Route path="/admin" element={<RequireAdmin user={user} checking={checking}><AdminOverviewPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/users" element={<RequireAdmin user={user} checking={checking}><AdminParticipantsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/goals" element={<RequireAdmin user={user} checking={checking}><AdminGoalProgressPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/demographics" element={<RequireAdmin user={user} checking={checking}><AdminDemographicsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/linguistics" element={<RequireAdmin user={user} checking={checking}><AdminLinguisticsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/alluvial" element={<RequireAdmin user={user} checking={checking}><AdminAlluvialPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/questions" element={<RequireAdmin user={user} checking={checking}><AdminQuestionsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/stats" element={<RequireAdmin user={user} checking={checking}><AdminStatsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/audit" element={<RoleRequireAdmin user={user} checking={checking} onLogout={handleLogout}><AdminAuditPage user={user} onLogout={handleLogout} /></RoleRequireAdmin>} />
        <Route path="/admin/sessions" element={<RequireAdmin user={user} checking={checking}><AdminSessionsPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/study" element={<RequireAdmin user={user} checking={checking}><AdminStudyPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/export" element={<RequireAdmin user={user} checking={checking}><AdminExportPage user={user} onLogout={handleLogout} /></RequireAdmin>} />
        <Route path="/admin/researchers" element={<RoleRequireAdmin user={user} checking={checking} onLogout={handleLogout}><AdminResearchersPage user={user} onLogout={handleLogout} /></RoleRequireAdmin>} />
        <Route path="/admin/conditions" element={<RoleRequireAdmin user={user} checking={checking} onLogout={handleLogout}><AdminConditionsPage user={user} onLogout={handleLogout} /></RoleRequireAdmin>} />
        <Route path="/admin/quality" element={<RequireAdmin user={user} checking={checking}><AdminQualityPage user={user} onLogout={handleLogout} /></RequireAdmin>} />

        {/* ── Catch-all ───────────────────────────────────────────────────── */}
        <Route
          path="*"
          element={
            checking ? (
              <div style={{ padding: 20 }}>Loading...</div>
            ) : user ? (
              <Navigate to={(user.role === "admin" || user.is_researcher) ? "/admin" : "/dashboard"} replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />
      </Routes>
    </AppErrorBoundary>
  );
}
