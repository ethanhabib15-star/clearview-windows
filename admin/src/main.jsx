import { Component, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "./index.css";

function renderFatal(message) {
  const rootEl = document.getElementById("root");
  if (!rootEl) return;
  rootEl.innerHTML = `
    <div style="min-height:100vh;display:grid;place-items:center;padding:1.5rem;background:#090b10;color:#f5f5f5;font-family:Inter,system-ui,sans-serif">
      <div style="width:min(720px,100%);border-radius:12px;border:1px solid rgba(255,255,255,0.14);background:#111;padding:1rem">
        <h1 style="margin:0 0 0.5rem;font-size:1.05rem">Admin startup failed</h1>
        <p style="margin:0 0 0.65rem;color:#a1a1a1">
          The app hit an error before React finished mounting.
        </p>
        <pre style="margin:0;padding:0.75rem;border-radius:8px;background:#0b0b0b;border:1px solid rgba(255,255,255,0.1);overflow-x:auto;white-space:pre-wrap;word-break:break-word">${String(message || "Unknown startup error.")}</pre>
      </div>
    </div>
  `;
}

class AdminErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: "100vh",
            display: "grid",
            placeItems: "center",
            padding: "1.5rem",
            background: "#090b10",
            color: "#f5f5f5",
            fontFamily: "Inter, system-ui, sans-serif",
          }}
        >
          <div
            style={{
              width: "min(640px, 100%)",
              borderRadius: "12px",
              border: "1px solid rgba(255,255,255,0.14)",
              background: "#111",
              padding: "1rem",
            }}
          >
            <h1 style={{ margin: "0 0 0.5rem", fontSize: "1.05rem" }}>
              Admin app failed to render
            </h1>
            <p style={{ margin: "0 0 0.65rem", color: "#a1a1a1" }}>
              Refresh the page after restarting the dev server. If this keeps
              happening, share the error below.
            </p>
            <pre
              style={{
                margin: 0,
                padding: "0.75rem",
                borderRadius: "8px",
                background: "#0b0b0b",
                border: "1px solid rgba(255,255,255,0.1)",
                overflowX: "auto",
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
              }}
            >
              {String(this.state.error?.message || this.state.error)}
            </pre>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

window.addEventListener("error", (event) => {
  const msg = event?.error?.message || event?.message || "Unknown runtime error.";
  renderFatal(msg);
});

window.addEventListener("unhandledrejection", (event) => {
  const reason = event?.reason;
  const msg =
    typeof reason === "string"
      ? reason
      : reason?.message || "Unhandled promise rejection.";
  renderFatal(msg);
});

try {
  const rootEl = document.getElementById("root");
  if (!rootEl) {
    throw new Error("Missing #root mount element in admin HTML.");
  }
  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <AdminErrorBoundary>
        <App />
      </AdminErrorBoundary>
    </StrictMode>
  );
} catch (error) {
  renderFatal(error?.message || String(error));
}
