import { Component } from "react";

/**
 * React Error Boundary — catches render crashes and reports them to the backend.
 * Wraps the entire app in main.jsx.
 */
export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    // Report to backend
    fetch("/api/logs/frontend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        error: error.message,
        stack: error.stack,
        component: errorInfo?.componentStack?.trim()?.slice(0, 500),
        url: window.location.href,
        timestamp: new Date().toISOString(),
      }),
    }).catch(() => {
      // If reporting fails, there's nothing we can do
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: 40,
            textAlign: "center",
            color: "#e0e0e0",
            fontFamily: "monospace",
          }}
        >
          <h2>Something went wrong</h2>
          <p style={{ color: "#ff8080" }}>
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: 16,
              padding: "8px 20px",
              background: "#4575b4",
              color: "#fff",
              border: "none",
              borderRadius: 4,
              cursor: "pointer",
            }}
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
