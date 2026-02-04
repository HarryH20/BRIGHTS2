import { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";
import Dashboard from "./Dashboard";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("login");

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
      setPage("login");
    }
  }

  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;

  if (user) {
    return <Dashboard user={user} onLogout={handleLogout} />;
  }

  return (
    <div style={{ padding: 20 }}>
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
