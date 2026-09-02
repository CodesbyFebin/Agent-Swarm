import React from "react";

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    // eslint-disable-next-line no-console
    console.error("Swarm Orchestrator render error", error, info);
  }

  reset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          style={{
            minHeight: "100vh", display: "flex", alignItems: "center",
            justifyContent: "center", padding: 32,
            background: "var(--bg-0)", color: "var(--text-1)",
          }}
        >
          <div
            style={{
              maxWidth: 480, background: "var(--bg-2)",
              border: "1px solid var(--border-1)",
              borderRadius: "var(--radius-lg)", padding: 24,
            }}
          >
            <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
            <p style={{ color: "var(--text-2)" }}>
              The UI hit an unexpected error. The pipeline state is intact —
              you can try again, or reload.
            </p>
            <pre
              style={{
                background: "rgba(0,0,0,0.4)", padding: 12, borderRadius: 8,
                fontSize: 12, color: "#fca5a5", overflow: "auto", maxHeight: 200,
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </pre>
            <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
              <button
                type="button"
                onClick={this.reset}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--blue)",
                  background: "rgba(59,130,246,0.1)", color: "var(--blue)", fontWeight: 600,
                }}
              >
                Try again
              </button>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  padding: "8px 14px", borderRadius: 8,
                  border: "1px solid var(--border-2)",
                  background: "transparent", color: "var(--text-2)",
                }}
              >
                Reload
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
