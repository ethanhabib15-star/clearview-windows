import { useCallback, useEffect, useState } from "react";
import { IconMail, IconPhone, IconTrash } from "../components/Icons.jsx";
import { apiUrl } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

function typeLabel(v) {
  if (!v) return "—";
  if (v === "both") return "Both / unsure";
  return v.charAt(0).toUpperCase() + v.slice(1);
}

const SUBJECT_LABELS = {
  general: "General inquiry",
  quote: "Request a quote",
  support: "Technical / support",
  partnership: "Partnership / commercial",
  feedback: "Feedback",
};

function subjectLabel(m) {
  const s = m.subject;
  if (s && SUBJECT_LABELS[s]) return SUBJECT_LABELS[s];
  if (m.type) return `Project: ${typeLabel(m.type)}`;
  return "—";
}

export default function AdminMessagesPage() {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [deletingId, setDeletingId] = useState(null);

  const fetchMessages = useCallback(async () => {
    const k = getStoredAdminKey();
    if (!k) return;
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch(apiUrl("/api/messages"), {
        headers: adminAuthHeaders(k),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      if (!r.ok) {
        setLoadError("Could not load messages. Is the API running?");
        return;
      }
      const data = await r.json();
      setMessages(Array.isArray(data.messages) ? data.messages : []);
    } catch {
      setLoadError(
        "Cannot reach the API. Run npm run dev (API + client + admin)."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMessages();
  }, [fetchMessages]);

  async function handleDeleteMessage(id) {
    if (!window.confirm("Delete this message permanently?")) return;
    const k = getStoredAdminKey();
    if (!k) return;
    setDeletingId(id);
    setLoadError("");
    try {
      const r = await fetch(apiUrl("/api/messages/delete"), {
        method: "POST",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id }),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (r.ok && data.ok === true) {
        setMessages((prev) => prev.filter((m) => String(m.id) !== String(id)));
        return;
      }
      setLoadError(
        data.error ||
          "Delete did not reach the server. Refreshed the list from the API."
      );
      await fetchMessages();
    } catch {
      setLoadError("Network error while deleting. Refreshing the list.");
      await fetchMessages();
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="admin-main">
      <div className="admin-container">
        <div className="admin-page-title admin-page-title-row">
          <div>
            <h1>Contact messages</h1>
            <p className="admin-subtitle">
              {messages.length} total · newest first
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => fetchMessages()}
            disabled={loading}
          >
            {loading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {loadError ? (
          <p className="admin-banner admin-banner-error" role="alert">
            {loadError}
          </p>
        ) : null}

        {loading && messages.length === 0 ? (
          <p className="admin-empty">Loading…</p>
        ) : messages.length === 0 ? (
          <div className="admin-empty-card">
            <p>No messages yet.</p>
            <p className="admin-muted">
              Submit the contact form on the site; entries appear here
              instantly.
            </p>
            <a href="/contact" className="admin-link">
              Open contact page
            </a>
          </div>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Received</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Subject</th>
                  <th>Message</th>
                  <th className="admin-th-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {messages.map((m) => (
                  <tr key={m.id}>
                    <td className="admin-cell-muted">{formatWhen(m.createdAt)}</td>
                    <td className="admin-cell-strong">{m.name}</td>
                    <td>
                      <a
                        className="admin-mail"
                        href={`mailto:${encodeURIComponent(m.email)}`}
                      >
                        <IconMail size={14} aria-hidden />
                        {m.email}
                      </a>
                    </td>
                    <td>
                      {m.phone ? (
                        <a
                          className="admin-tel"
                          href={`tel:${m.phone.replace(/\s/g, "")}`}
                        >
                          <IconPhone size={14} aria-hidden />
                          {m.phone}
                        </a>
                      ) : (
                        <span className="admin-cell-muted">—</span>
                      )}
                    </td>
                    <td>{subjectLabel(m)}</td>
                    <td className="admin-cell-message">
                      {m.message || m.projectDetails ? (
                        <details className="admin-details">
                          <summary>
                            {(m.message || m.projectDetails || "").length > 80
                              ? `${(m.message || m.projectDetails || "").slice(0, 80)}…`
                              : m.message || m.projectDetails || "—"}
                          </summary>
                          {m.subject === "quote" &&
                          (m.serviceType || m.projectDetails || m.budgetRange) ? (
                            <div className="admin-quote-meta">
                              {m.serviceType ? (
                                <p>
                                  <strong>Service:</strong>{" "}
                                  {typeLabel(m.serviceType)}
                                </p>
                              ) : null}
                              {m.projectDetails ? (
                                <p>
                                  <strong>Project:</strong> {m.projectDetails}
                                </p>
                              ) : null}
                              {m.budgetRange ? (
                                <p>
                                  <strong>Budget:</strong> {m.budgetRange}
                                </p>
                              ) : null}
                            </div>
                          ) : null}
                          {m.message ? <p>{m.message}</p> : null}
                          {m.type && !m.subject ? (
                            <p className="admin-muted">
                              <strong>Project type:</strong> {typeLabel(m.type)}
                            </p>
                          ) : null}
                        </details>
                      ) : (
                        <span className="admin-cell-muted">—</span>
                      )}
                    </td>
                    <td className="admin-cell-actions">
                      <button
                        type="button"
                        className="admin-btn-delete"
                        onClick={() => handleDeleteMessage(m.id)}
                        disabled={deletingId !== null}
                        aria-busy={deletingId === m.id}
                        title="Delete message"
                      >
                        <IconTrash size={16} aria-hidden />
                        {deletingId === m.id ? "…" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
