import React from "react";
import HomeLayout from "./HomeLayout.jsx";

export default function GraphsPage({ user, onLogout }) {
  return (
    <HomeLayout user={user} onLogout={onLogout} title="Survey Graphs">
      <div style={{ padding: 18 }}>
        <h2 style={{ marginTop: 0 }}>Survey Graphs</h2>
        <p>Graphs will go here.</p>
      </div>
    </HomeLayout>
  );
}