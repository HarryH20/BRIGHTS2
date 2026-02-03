import { useState } from 'react'
import Login from './Login'

export default function App() {
  const [user, setUser] = useState(null)

  if (!user) {
    return <Login onLogin={setUser} />
  }

  return (
    <div style={styles.container}>
      <h1>Welcome, {user.username}!</h1>
      <p>Role: {user.role}</p>
      <p>Email: {user.email}</p>
      <button
        style={styles.button}
        onClick={async () => {
          await fetch('/auth/logout', { credentials: 'include' })
          setUser(null)
        }}
      >
        Logout
      </button>
    </div>
  )
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'grid',
    placeItems: 'center',
    padding: 16,
    background: '#0b1220',
    color: '#e9eefc',
    textAlign: 'center',
  },
  button: {
    marginTop: 20,
    padding: '10px 24px',
    borderRadius: 10,
    border: 'none',
    background: '#4f7cff',
    color: 'white',
    fontWeight: 700,
    cursor: 'pointer',
  },
}
