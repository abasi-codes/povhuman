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
            fontFamily: "var(--f, 'Nunito', sans-serif)",
            color: "var(--text, #1a1714)",
            background: "var(--bg, #f6f4f0)",
          }}
        >
          <div
            style={{
              background: "var(--white, #fff)",
              borderRadius: "16px",
              padding: "2.5rem",
              maxWidth: "480px",
              textAlign: "center",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05), 0 2px 8px rgba(0,0,0,0.04)",
            }}
          >
            <div style={{ fontSize: "48px", marginBottom: "1rem" }}>
              {"\uD83D\uDC41\uFE0F"}
            </div>
            <h2
              style={{
                fontFamily: "var(--fd, 'Fraunces', serif)",
                fontWeight: 700,
                fontSize: "20px",
                marginBottom: "0.5rem",
              }}
            >
              Something went wrong
            </h2>
            <p
              style={{
                color: "var(--text2, #6b635a)",
                fontSize: "14px",
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
                  background: "var(--tint, #f0ede8)",
                  borderRadius: "8px",
                  padding: "12px",
                  fontSize: "12px",
                  textAlign: "left",
                  overflow: "auto",
                  maxHeight: "120px",
                  marginBottom: "1.5rem",
                  color: "var(--red, #dc2626)",
                }}
              >
                {this.state.error.message}
              </pre>
            )}
            <button
              className="btn btn-blue"
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
