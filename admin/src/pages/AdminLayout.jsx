import { useCallback, useEffect, useState } from "react";
import { NavLink, Outlet } from "react-router-dom";
import { IconKey, IconShield, IconWindow } from "../components/Icons.jsx";
import { apiUrl, readResponseJson } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
  setStoredAdminKey,
} from "../admin/auth.js";
import { getAdminSupabaseClient } from "../admin/supabase.js";
import "./Admin.css";

export default function AdminLayout() {
  const [emailInput, setEmailInput] = useState("");
  const [passwordInput, setPasswordInput] = useState("");
  const [authState, setAuthState] = useState(() =>
    getStoredAdminKey() ? "checking" : "guest"
  );
  const [loginError, setLoginError] = useState("");
  const [checking, setChecking] = useState(authState === "checking");
  const validateKey = useCallback(async (k) => {
    const key = String(k ?? "").trim();
    if (!key) return { ok: false, error: "Missing auth token." };
    try {
      const r = await fetch(apiUrl("/api/admin/ping"), {
        headers: adminAuthHeaders(key),
      });
      if (r.ok) return { ok: true, error: "" };
      const body = await readResponseJson(r);
      const msg = String(body?.error || "").trim();
      return {
        ok: false,
        error:
          msg ||
          (r.status === 403
            ? "Signed in, but this account is not authorized as admin."
            : "Admin authorization failed."),
      };
    } catch {
      return { ok: false, error: "Could not reach the admin API." };
    }
  }, []);

  useEffect(() => {
    const stored = getStoredAdminKey();
    if (!stored) {
      setAuthState("guest");
      setChecking(false);
      return;
    }
    let cancelled = false;
    setAuthState("checking");
    setChecking(true);
    validateKey(stored).then((result) => {
      if (cancelled) return;
      if (result.ok) setAuthState("authed");
      else {
        clearStoredAdminKey();
        setAuthState("guest");
      }
      setChecking(false);
    });
    return () => {
      cancelled = true;
    };
  }, [validateKey]);

  async function handleLogin(e) {
    e.preventDefault();
    setLoginError("");
    const email = emailInput.trim();
    const password = passwordInput;
    if (!email || !password) {
      setLoginError("Enter your admin email and password.");
      return;
    }
    const supabase = getAdminSupabaseClient();
    if (!supabase) {
      setLoginError(
        "Supabase auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY."
      );
      return;
    }
    setChecking(true);
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error || !data?.session?.access_token) {
      setChecking(false);
      setLoginError(error?.message || "Could not sign in.");
      return;
    }
    const token = data.session.access_token;
    const result = await validateKey(token);
    setChecking(false);
    if (!result.ok) {
      await supabase.auth.signOut();
      setLoginError(
        result.error ||
          "Signed in, but this account is not authorized as admin."
      );
      return;
    }
    setStoredAdminKey(token);
    setAuthState("authed");
    setPasswordInput("");
  }

  function logout() {
    const supabase = getAdminSupabaseClient();
    if (supabase) {
      void supabase.auth.signOut();
    }
    clearStoredAdminKey();
    setAuthState("guest");
    setEmailInput("");
    setPasswordInput("");
    setLoginError("");
  }

  if (authState === "checking") {
    return (
      <div className="admin-shell">
        <p className="admin-empty">Checking session…</p>
      </div>
    );
  }

  if (authState !== "authed") {
    return (
      <div className="admin-shell">
        <div className="admin-login-page">
          <a href="/" className="admin-login-site-brand">
            <span className="admin-login-site-logo" aria-hidden>
              <IconWindow size={26} />
            </span>
            <span className="admin-login-site-name">
              Ryzhkov <span className="admin-login-site-accent">ClearView</span>
            </span>
          </a>

          <div className="admin-login-card">
            <div className="admin-login-card-head">
              <div className="admin-login-icon-stage" aria-hidden>
                <span className="admin-login-icon-badge">
                  <IconShield size={22} />
                </span>
              </div>
              <h1 className="admin-login-title">Welcome Sam Ryzhkov</h1>
              <p className="admin-login-subtitle">
                Sign in with your admin Supabase account to manage messages,
                contacts, invoices, and payments.
              </p>
            </div>

            <form className="admin-login-form" onSubmit={handleLogin}>
              <label className="admin-label admin-label--login">
                <span>Admin email</span>
                <div className="admin-login-input-wrap">
                  <IconKey size={18} className="admin-login-input-icon" />
                  <input
                    type="email"
                    name="adminEmail"
                    autoComplete="email"
                    className="admin-login-input"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="admin@yourcompany.com"
                    required
                  />
                </div>
              </label>
              <label className="admin-label admin-label--login">
                <span>Password</span>
                <div className="admin-login-input-wrap">
                  <IconKey size={18} className="admin-login-input-icon" />
                  <input
                    type="password"
                    name="adminPassword"
                    autoComplete="current-password"
                    className="admin-login-input"
                    value={passwordInput}
                    onChange={(e) => setPasswordInput(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
              </label>
              {loginError ? (
                <p className="admin-alert" role="alert">
                  {loginError}
                </p>
              ) : null}
              <button
                type="submit"
                className="admin-btn admin-btn-primary admin-login-submit"
                disabled={checking}
              >
                {checking ? "Verifying…" : "Continue to dashboard"}
              </button>
            </form>

            <p className="admin-login-footer">
              <a href="/" className="admin-login-footer-link">
                Back to main site
              </a>
            </p>
          </div>
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
              to="dashboard"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Dashboard
            </NavLink>
            <NavLink
              to="messages"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Messages
            </NavLink>
            <NavLink
              to="contacts"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Contacts
            </NavLink>
            <NavLink
              to="invoices"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Invoices
            </NavLink>
            <NavLink
              to="payments"
              className={({ isActive }) =>
                `admin-tab${isActive ? " admin-tab-active" : ""}`
              }
            >
              Payments
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

