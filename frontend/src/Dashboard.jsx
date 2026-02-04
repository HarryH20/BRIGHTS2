export default function Dashboard({ user, onLogout }) {
  return (
    <div style={{ padding: 20 }}>
      <h2>Welcome, {user.username}!</h2>
      <p>Role: {user.role}</p>

      <div style={{ marginTop: 16, display: "grid", gap: 12, maxWidth: 600 }}>
        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Goal Summary</h3>
          <p>Coming soon…</p>
        </div>

        <div style={{ border: "1px solid #ddd", borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Trajectory</h3>
          <p>Coming soon…</p>
        </div>
      </div>

      <button onClick={onLogout} style={{ marginTop: 18 }}>
        Logout
      </button>
    </div>
  );
}
