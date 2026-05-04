import { ErrorBoundary as ReactErrorBoundary } from "react-error-boundary";

const MESSAGES = {
  survey: {
    heading: "Something went wrong.",
    body: "Your data has not been lost. Please refresh the page — your answers are saved on this device.",
  },
  chart: {
    heading: "This chart failed to load.",
    body: "The rest of the dashboard is unaffected. Refreshing the page usually resolves this.",
  },
  admin: {
    heading: "This section failed to load.",
    body: "Please refresh the page. If the problem persists, check the server logs.",
  },
  page: {
    heading: "Something went wrong.",
    body: "Please refresh the page. Your session is still active.",
  },
};

function FallbackUI({ error, resetErrorBoundary, context }) {
  const { heading, body } = MESSAGES[context] ?? MESSAGES.page;

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.icon}>⚠</div>
        <h2 style={styles.heading}>{heading}</h2>
        <p style={styles.body}>{body}</p>
        {error?.message && (
          <pre style={styles.detail}>{error.message}</pre>
        )}
        <button
          style={styles.btn}
          onClick={() => window.location.reload()}
        >
          Refresh page
        </button>
        {resetErrorBoundary && (
          <button
            style={{ ...styles.btn, ...styles.btnSecondary }}
            onClick={resetErrorBoundary}
          >
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

export default function AppErrorBoundary({ children, context = "page" }) {
  return (
    <ReactErrorBoundary
      FallbackComponent={({ error, resetErrorBoundary }) => (
        <FallbackUI
          error={error}
          resetErrorBoundary={resetErrorBoundary}
          context={context}
        />
      )}
      onError={(error, info) => {
        fetch("/api/logs/frontend", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            error: error.message,
            stack: error.stack,
            component: info?.componentStack?.trim()?.slice(0, 500),
            url: window.location.href,
            timestamp: new Date().toISOString(),
          }),
        }).catch(() => {});
      }}
    >
      {children}
    </ReactErrorBoundary>
  );
}

const styles = {
  wrapper: {
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "40px 16px",
  },
  card: {
    maxWidth: 480,
    width: "100%",
    padding: 28,
    borderRadius: 16,
    border: "1px solid var(--error-border)",
    background: "var(--card-bg)",
    boxShadow: "0 12px 30px var(--shadow-card)",
    backdropFilter: "blur(8px)",
    textAlign: "center",
  },
  icon: {
    fontSize: 36,
    marginBottom: 12,
    color: "var(--error-color)",
  },
  heading: {
    margin: "0 0 10px",
    fontSize: 20,
    color: "var(--text-primary)",
  },
  body: {
    margin: "0 0 16px",
    fontSize: 14,
    lineHeight: 1.6,
    opacity: 0.82,
    color: "var(--text-primary)",
  },
  detail: {
    margin: "0 0 16px",
    padding: "8px 12px",
    borderRadius: 8,
    background: "var(--error-bg)",
    border: "1px solid var(--error-border)",
    color: "var(--error-color)",
    fontSize: 12,
    textAlign: "left",
    overflowX: "auto",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  btn: {
    display: "inline-block",
    margin: "0 6px",
    padding: "10px 20px",
    borderRadius: 12,
    border: "1px solid var(--accent-border)",
    background: "var(--accent-hover)",
    color: "var(--ghost-color)",
    fontWeight: 700,
    fontSize: 14,
    cursor: "pointer",
  },
  btnSecondary: {
    background: "var(--ghost-bg)",
    border: "1px solid var(--ghost-border)",
  },
};
