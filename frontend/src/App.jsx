import { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";

const DEV_MODE = true; // <-- set false later when backend works

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("login");

  useEffect(() => {
    // If dev mode, skip backend check and just show login UI quickly
    if (DEV_MODE) {
      setChecking(false);
      return;
    }

    (async () => {
      try {
        const res = await fetch("http://localhost:5000/api/auth/me", {
          credentials: "include",
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUser(data.user ?? data);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  function devAdminLogin() {
    setUser({
      id: 2,
      username: "admin_user",
      email: "admin@example.com",
      role: "admin",
    });
  }

  function devLogout() {
    setUser(null);
    setPage("login");
  }

  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;

  // Show dashboard if "logged in" (real or fake)
  if (user) {
    return <Dashboard user={user} onLogout={DEV_MODE ? devLogout : undefined} />;
  }

  // Not logged in: show auth pages + dev buttons
  return (
    <div style={{ padding: 20 }}>
      {DEV_MODE && (
        <div style={{ marginBottom: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={devAdminLogin}>Dev Login (Admin)</button>
        </div>
      )}

      {page === "register" ? (
        <Register
          onRegistered={() => setPage("login")}
          onGoToLogin={() => setPage("login")}
        />
      ) : (
        <Login
          onLogin={(u) => setUser(u)}
          onGoToRegister={() => setPage("register")}
        />
      )}
    </div>
  );
}
