import { useEffect, useState } from "react";
import Login from "./Login";
import Register from "./Register";

export default function App() {
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [page, setPage] = useState("login"); // "login" | "register"

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/auth/me", { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) setUser(data.user);
      } finally {
        setChecking(false);
      }
    })();
  }, []);

  async function logout() {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
    setPage("login");
  }

  if (checking) return <div style={{ padding: 20 }}>Loading...</div>;

  if (!user) {
    if (page === "register") {
      return (
        <Register
          onRegistered={() => setPage("login")}
          onGoToLogin={() => setPage("login")}
        />
      );
    }
    return (
      <Login
        onLogin={(u) => setUser(u)}
        onGoToRegister={() => setPage("register")}
      />
    );
  }

  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {user.username}!</h2>
      <p>Role: {user.role}</p>
      <button onClick={logout}>Logout</button>
    </div>
  );
}
