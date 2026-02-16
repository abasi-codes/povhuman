import React from "react";

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            minHeight: "100vh",
            padding: "2rem",
            fontFamily: "var(--fm, 'IBM Plex Mono', monospace)",
            color: "#e8eaed",
            background: "#0a0c0f",
          }}
        >
          <div
            style={{
              background: "#12151a",
              borderRadius: "6px",
              padding: "2.5rem",
              maxWidth: "480px",
              textAlign: "center",
              border: "1px solid #2a2f38",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--fd, 'Oxanium', sans-serif)",
                fontWeight: 700,
                fontSize: "18px",
                marginBottom: "0.5rem",
                letterSpacing: "0.06em",
                textTransform: "uppercase",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: "#9ca3af",
                fontSize: "13px",
                marginBottom: "1.5rem",
                lineHeight: 1.5,
              }}
            >
              The dashboard encountered an unexpected error. Try refreshing the
              page.
            </p>
            {this.state.error && (
              <pre
                style={{
                  background: "#181c22",
                  borderRadius: "4px",
                  padding: "12px",
                  fontSize: "11px",
                  textAlign: "left",
                  overflow: "auto",
                  maxHeight: "120px",
                  marginBottom: "1.5rem",
                  color: "#ef4444",
                  border: "1px solid #2a2f38",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              className="btn btn-amber"
              onClick={() => window.location.reload()}
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
