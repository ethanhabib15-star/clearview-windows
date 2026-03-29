import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { IconWindow } from "../components/Icons.jsx";
import {
  ADMIN_STORAGE_KEY,
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
  setStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";

export default function AdminLayout() {
  const [keyInput, setKeyInput] = useState("");
  const [authenticated, setAuthenticated] = useState(() =>
    Boolean(
      typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(ADMIN_STORAGE_KEY)
    )
  );
  const [loginError, setLoginError] = useState("");
  const [checking, setChecking] = useState(false);
  const validateKey = useCallback(async (k) => {
    const key = String(k ?? "").trim();
    if (!key) return false;
    try {
      const r = await fetch("/api/admin/ping", {
        headers: adminAuthHeaders(key),
      });
      return r.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAdminKey();
    if (!stored) return;
    let cancelled = false;
    setChecking(true);
    validateKey(stored).then((ok) => {
      if (cancelled) return;
      if (ok) setAuthenticated(true);
      else clearStoredAdminKey();
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [validateKey]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const k = keyInput.trim();
    if (!k) {
      setLoginError("Enter your admin key.");
      return;
    }
    setChecking(true);
    const ok = await validateKey(k);
    setChecking(false);
    if (!ok) {
      setLoginError("Invalid admin key.");
      return;
    }
    setStoredAdminKey(k);
    setAuthenticated(true);
  }

  function logout() {
    clearStoredAdminKey();
    setAuthenticated(false);
    setKeyInput("");
    setLoginError("");
  }

  if (!authenticated) {
    if (checking && getStoredAdminKey()) {
      return (
        <div className="admin-shell">
          <p className="admin-empty">Checking session…</p>
        </div>
      );
    }
    return (
      <div className="admin-shell">
        <div className="admin-login-card">
          <div className="admin-login-brand">
            <span className="admin-login-icon" aria-hidden>
              <IconWindow size={32} />
            </span>
            <h1>Admin</h1>
            <p>Enter your admin key to open messages and invoices.</p>
          </div>
          <form className="admin-login-form" onSubmit={handleLogin}>
            <label className="admin-label">
              <span>Admin key</span>
              <input
                type="password"
                name="adminKey"
                autoComplete="current-password"
                value={keyInput}
                onChange={(e) => setKeyInput(e.target.value)}
                placeholder="Same as ADMIN_KEY on the server"
                required
              />
            </label>
            {loginError ? (
              <p className="admin-alert" role="alert">
                {loginError}
              </p>
            ) : null}
            <button
              type="submit"
              className="admin-btn admin-btn-primary"
              disabled={checking}
            >
              {checking ? "Checking…" : "Unlock dashboard"}
            </button>
          </form>
          <p className="admin-hint">
            Use <code>ADMIN_KEY</code> from <code>.env</code>. Run{" "}
            <code>npm run dev</code> for API + client + admin.
          </p>
          <a href="/" className="admin-back">
            ← Back to site
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="admin-app">
      <header className="admin-topbar">
        <div className="admin-topbar-inner admin-topbar-wide">
          <a href="/" className="admin-topbar-brand">
            <IconWindow size={22} aria-hidden />
            <span>
              Ryzhkov <span className="admin-accent">ClearView</span> Admin
            </span>
          </a>
          <nav className="admin-tabs" aria-label="Admin sections">
            <NavLink
              to="messages"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Messages
            </NavLink>
            <NavLink
              to="invoices"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Invoices
            </NavLink>
          </nav>
          <div className="admin-topbar-actions">
            <button
              type="button"
              className="admin-btn admin-btn-danger"
              onClick={logout}
            >
              Log out
            </button>
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
}

