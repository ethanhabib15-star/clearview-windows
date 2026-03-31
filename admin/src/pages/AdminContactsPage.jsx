import { useCallback, useEffect, useState } from "react";
import { IconWindow } from "../components/Icons.jsx";
import { apiUrl } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";

const emptyForm = {
  businessName: "",
  phone: "",
  alternatePhone: "",
  email: "",
  address: "",
};

export default function AdminContactsPage() {
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [saveOk, setSaveOk] = useState(false);
  const [fieldErrors, setFieldErrors] = useState([]);

  const load = useCallback(async () => {
    const k = getStoredAdminKey();
    if (!k) return;
    setLoading(true);
    setLoadError("");
    setSaveOk(false);
    try {
      const r = await fetch("/api/admin/contacts", {
        headers: adminAuthHeaders(k),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      if (!r.ok) {
        setLoadError("Could not load contacts.");
        return;
      }
      const data = await r.json();
      const c = data.contacts;
      if (c && typeof c === "object") {
        setForm({
          businessName: String(c.businessName ?? ""),
          phone: String(c.phone ?? ""),
          alternatePhone: String(c.alternatePhone ?? ""),
          email: String(c.email ?? ""),
          address: String(c.address ?? ""),
        });
      }
    } catch {
      setLoadError("Cannot reach the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setField(name, value) {
    setForm((f) => ({ ...f, [name]: value }));
    setSaveOk(false);
    setFieldErrors([]);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    const k = getStoredAdminKey();
    if (!k) return;
    setSaving(true);
    setSaveOk(false);
    setFieldErrors([]);
    setLoadError("");
    try {
      const r = await fetch(apiUrl("/api/admin/contacts"), {
        method: "PUT",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        const msg = data.error || "Save failed.";
        setFieldErrors([msg]);
        return;
      }
      if (data.contacts) {
        const c = data.contacts;
        setForm({
          businessName: String(c.businessName ?? ""),
          phone: String(c.phone ?? ""),
          alternatePhone: String(c.alternatePhone ?? ""),
          email: String(c.email ?? ""),
          address: String(c.address ?? ""),
        });
      }
      setSaveOk(true);
    } catch {
      setLoadError("Network error while saving.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="admin-main">
      <div className="admin-container">
        <div className="admin-page-title admin-page-title-row">
          <div>
            <h1>Contacts</h1>
            <p className="admin-subtitle">
              Public site, contact form sidebar, and vCard downloads use this
              data.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => load()}
            disabled={loading}
          >
            {loading ? "Loading…" : "Reload"}
          </button>
        </div>

        {loadError ? (
          <p className="admin-banner admin-banner-error" role="alert">
            {loadError}
          </p>
        ) : null}

        {saveOk ? (
          <p className="admin-banner admin-banner-success" role="status">
            Contact details saved. The public site will show updates on next
            load.
          </p>
        ) : null}

        {fieldErrors.length ? (
          <p className="admin-banner admin-banner-error" role="alert">
            {fieldErrors.join(" ")}
          </p>
        ) : null}

        {loading ? (
          <p className="admin-empty">Loading…</p>
        ) : (
          <form className="admin-contacts-form" onSubmit={handleSubmit}>
            <div className="admin-contacts-card">
              <div className="admin-contacts-card-head">
                <span className="admin-login-icon" aria-hidden>
                  <IconWindow size={28} />
                </span>
                <div>
                  <h2 className="admin-contacts-card-title">
                    Business information
                  </h2>
                  <p className="admin-muted admin-contacts-card-desc">
                    Required fields are validated (email format, phone digits).
                  </p>
                </div>
              </div>

              <label className="admin-label">
                Business name
                <input
                  type="text"
                  value={form.businessName}
                  onChange={(e) => setField("businessName", e.target.value)}
                  required
                  maxLength={200}
                  autoComplete="organization"
                />
              </label>

              <label className="admin-label">
                Phone number
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(e) => setField("phone", e.target.value)}
                  required
                  maxLength={80}
                  autoComplete="tel"
                  placeholder="(918) 555-0100"
                />
              </label>

              <label className="admin-label">
                Alternate phone{" "}
                <span className="admin-optional">(optional)</span>
                <input
                  type="tel"
                  value={form.alternatePhone}
                  onChange={(e) => setField("alternatePhone", e.target.value)}
                  maxLength={80}
                  autoComplete="tel"
                />
              </label>

              <label className="admin-label">
                Email address
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setField("email", e.target.value)}
                  required
                  maxLength={320}
                  autoComplete="email"
                />
              </label>

              <label className="admin-label">
                Business address{" "}
                <span className="admin-optional">(optional)</span>
                <textarea
                  value={form.address}
                  onChange={(e) => setField("address", e.target.value)}
                  rows={4}
                  maxLength={500}
                  placeholder="Street, city, ZIP — or service area description"
                />
              </label>

              <div className="admin-contacts-actions">
                <button
                  type="submit"
                  className="admin-btn admin-btn-primary"
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save contact details"}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
