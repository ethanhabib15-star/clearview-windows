import { useCallback, useEffect, useState } from "react";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";
import "./InvoicePrint.css";

const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function computeInvoiceTotals(inv) {
  if (!inv?.lineItems?.length) return { subtotal: 0, tax: 0, total: 0 };
  const subtotal = inv.lineItems.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const tax = (subtotal * (Number(inv.taxPercent) || 0)) / 100;
  return { subtotal, tax, total: subtotal + tax };
}

function cloneInvoice(inv) {
  return JSON.parse(JSON.stringify(inv));
}

function InvoiceDocument({ invoice }) {
  if (!invoice) return null;
  const { subtotal, tax, total } = computeInvoiceTotals(invoice);
  return (
    <div className="invoice-doc">
      <header className="invoice-doc-header">
        <div>
          <div className="invoice-doc-brand">
            {invoice.fromName ? (
              invoice.fromName
            ) : (
              <>
                Ryzhkov <span>ClearView Windows</span>
              </>
            )}
          </div>
          <p className="invoice-doc-tag">Tulsa metro · Broken Arrow · Coweta</p>
        </div>
        <div className="invoice-doc-invoice-label">
          <strong>INVOICE</strong>
          <div className="invoice-doc-meta">
            <div>{invoice.number}</div>
            <div>
              Issued {invoice.issueDate || "—"}
              {invoice.dueDate ? ` · Due ${invoice.dueDate}` : ""}
            </div>
          </div>
        </div>
      </header>

      <div className="invoice-doc-columns">
        <div className="invoice-doc-box">
          <h3>From</h3>
          <p>
            {[invoice.fromName, invoice.fromAddress, invoice.fromPhone, invoice.fromEmail]
              .filter(Boolean)
              .join("\n") || "—"}
          </p>
        </div>
        <div className="invoice-doc-box">
          <h3>Bill to</h3>
          <p>
            {[invoice.clientName, invoice.clientAddress, invoice.clientEmail]
              .filter(Boolean)
              .join("\n") || "—"}
          </p>
        </div>
      </div>

      <table className="invoice-doc-table">
        <thead>
          <tr>
            <th>Description</th>
            <th>Qty</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          {invoice.lineItems?.map((row) => {
            const line = (Number(row.quantity) || 0) * (Number(row.rate) || 0);
            return (
              <tr key={row.id}>
                <td>{row.description || "—"}</td>
                <td>{row.quantity}</td>
                <td>{money.format(line)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="invoice-doc-totals">
        <div className="invoice-doc-totals-row">
          <span>Subtotal</span>
          <strong>{money.format(subtotal)}</strong>
        </div>
        <div className="invoice-doc-totals-row">
          <span>Tax ({Number(invoice.taxPercent) || 0}%)</span>
          <strong>{money.format(tax)}</strong>
        </div>
        <div className="invoice-doc-totals-row invoice-doc-total-final">
          <span>Total due</span>
          <span>{money.format(total)}</span>
        </div>
      </div>

      {invoice.notes?.trim() ? (
        <div className="invoice-doc-notes">
          <h3>Notes</h3>
          <p>{invoice.notes}</p>
        </div>
      ) : null}

      <footer className="invoice-doc-footer">
        Thank you for your business · Questions? Reply to this invoice or call{" "}
        {invoice.fromPhone || "us"}.
      </footer>
    </div>
  );
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [draft, setDraft] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const loadInvoices = useCallback(async () => {
    const k = getStoredAdminKey();
    if (!k) return;
    setLoading(true);
    setError("");
    try {
      const r = await fetch("/api/invoices", { headers: adminAuthHeaders(k) });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin");
        return;
      }
      if (!r.ok) {
        setError("Could not load invoices.");
        return;
      }
      const data = await r.json();
      const list = Array.isArray(data.invoices) ? data.invoices : [];
      setInvoices(list);
      setDraft((prev) => {
        if (prev?.id) {
          const fresh = list.find((x) => String(x.id) === String(prev.id));
          if (fresh) return cloneInvoice(fresh);
          return list[0] ? cloneInvoice(list[0]) : null;
        }
        if (!prev && list.length > 0) return cloneInvoice(list[0]);
        return prev;
      });
    } catch {
      setError("Network error loading invoices.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  function selectInvoice(inv) {
    setDraft(cloneInvoice(inv));
  }

  async function handleNew() {
    const k = getStoredAdminKey();
    if (!k) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/invoices", {
        method: "POST",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({}),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.invoice) {
        setError(data.error || "Could not create invoice.");
        return;
      }
      setInvoices((prev) => [data.invoice, ...prev]);
      setDraft(cloneInvoice(data.invoice));
    } catch {
      setError("Network error creating invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSave() {
    if (!draft?.id) return;
    const k = getStoredAdminKey();
    if (!k) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/invoices/${encodeURIComponent(draft.id)}`, {
        method: "PUT",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(draft),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.invoice) {
        setError(data.error || "Could not save invoice.");
        return;
      }
      const saved = data.invoice;
      setInvoices((prev) => {
        const i = prev.findIndex((x) => String(x.id) === String(saved.id));
        if (i === -1) return [saved, ...prev];
        const next = [...prev];
        next[i] = saved;
        return next;
      });
      setDraft(cloneInvoice(saved));
    } catch {
      setError("Network error saving invoice.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!draft?.id) return;
    if (!window.confirm("Delete this invoice permanently?")) return;
    const k = getStoredAdminKey();
    if (!k) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch("/api/invoices/delete", {
        method: "POST",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ id: draft.id }),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok || !data.ok) {
        setError(data.error || "Could not delete invoice.");
        return;
      }
      await loadInvoices();
    } catch {
      setError("Network error deleting invoice.");
    } finally {
      setSaving(false);
    }
  }

  function handlePrint() {
    window.print();
  }

  function setField(key, value) {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  }

  function setLine(lineId, field, raw) {
    setDraft((d) => {
      if (!d) return d;
      const lineItems = d.lineItems.map((row) => {
        if (String(row.id) !== String(lineId)) return row;
        if (field === "quantity" || field === "rate") {
          const n = parseFloat(raw);
          return { ...row, [field]: Number.isFinite(n) ? n : 0 };
        }
        return { ...row, [field]: raw };
      });
      return { ...d, lineItems };
    });
  }

  function addLine() {
    setDraft((d) => {
      if (!d) return d;
      const id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `line-${Date.now()}`;
      return {
        ...d,
        lineItems: [
          ...d.lineItems,
          { id, description: "", quantity: 1, rate: 0 },
        ],
      };
    });
  }

  function removeLine(lineId) {
    setDraft((d) => {
      if (!d || d.lineItems.length <= 1) return d;
      return {
        ...d,
        lineItems: d.lineItems.filter((row) => String(row.id) !== String(lineId)),
      };
    });
  }

  return (
    <main className="admin-main admin-invoices-main">
      <div className="admin-invoices-grid">
        <aside className="invoice-aside">
          <h2>Invoices</h2>
          <button
            type="button"
            className="admin-btn admin-btn-primary invoice-new-btn"
            onClick={() => handleNew()}
            disabled={saving}
          >
            + New invoice
          </button>
          {loading ? (
            <p className="admin-muted">Loading…</p>
          ) : invoices.length === 0 ? (
            <p className="admin-muted">No invoices yet. Create one to start.</p>
          ) : (
            <ul className="invoice-list">
              {invoices.map((inv) => (
                <li key={inv.id}>
                  <button
                    type="button"
                    className={`invoice-list-item${
                      draft && String(draft.id) === String(inv.id)
                        ? " invoice-list-item-active"
                        : ""
                    }`}
                    onClick={() => selectInvoice(inv)}
                  >
                    <span className="invoice-list-num">{inv.number}</span>
                    <span className="invoice-list-meta">
                      {inv.clientName || "No client"} · {inv.issueDate || "—"}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </aside>

        <div className="invoice-form-panel">
          <h2>Edit invoice</h2>
          {error ? (
            <p className="admin-banner admin-banner-error" role="alert">
              {error}
            </p>
          ) : null}

          {!draft ? (
            <p className="admin-muted">
              Select an invoice or create a new one. Your changes stay on this
              device until you click Save.
            </p>
          ) : (
            <>
              <div className="invoice-form-grid">
                <label className="invoice-field">
                  <span>Invoice #</span>
                  <input
                    value={draft.number || ""}
                    onChange={(e) => setField("number", e.target.value)}
                  />
                </label>
                <label className="invoice-field">
                  <span>Tax %</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={draft.taxPercent ?? 0}
                    onChange={(e) =>
                      setField("taxPercent", parseFloat(e.target.value) || 0)
                    }
                  />
                </label>
                <label className="invoice-field">
                  <span>Issue date</span>
                  <input
                    type="date"
                    value={
                      draft.issueDate?.length >= 10
                        ? draft.issueDate.slice(0, 10)
                        : draft.issueDate || ""
                    }
                    onChange={(e) => setField("issueDate", e.target.value)}
                  />
                </label>
                <label className="invoice-field">
                  <span>Due date</span>
                  <input
                    type="date"
                    value={
                      draft.dueDate?.length >= 10
                        ? draft.dueDate.slice(0, 10)
                        : draft.dueDate || ""
                    }
                    onChange={(e) => setField("dueDate", e.target.value)}
                  />
                </label>

                <label className="invoice-field invoice-field-full">
                  <span>Your business name</span>
                  <input
                    value={draft.fromName || ""}
                    onChange={(e) => setField("fromName", e.target.value)}
                  />
                </label>
                <label className="invoice-field invoice-field-full">
                  <span>Your address</span>
                  <textarea
                    rows={2}
                    value={draft.fromAddress || ""}
                    onChange={(e) => setField("fromAddress", e.target.value)}
                  />
                </label>
                <label className="invoice-field">
                  <span>Your phone</span>
                  <input
                    value={draft.fromPhone || ""}
                    onChange={(e) => setField("fromPhone", e.target.value)}
                  />
                </label>
                <label className="invoice-field">
                  <span>Your email</span>
                  <input
                    type="email"
                    value={draft.fromEmail || ""}
                    onChange={(e) => setField("fromEmail", e.target.value)}
                  />
                </label>

                <label className="invoice-field invoice-field-full">
                  <span>Client / company</span>
                  <input
                    value={draft.clientName || ""}
                    onChange={(e) => setField("clientName", e.target.value)}
                  />
                </label>
                <label className="invoice-field invoice-field-full">
                  <span>Client address</span>
                  <textarea
                    rows={2}
                    value={draft.clientAddress || ""}
                    onChange={(e) => setField("clientAddress", e.target.value)}
                  />
                </label>
                <label className="invoice-field invoice-field-full">
                  <span>Client email</span>
                  <input
                    type="email"
                    value={draft.clientEmail || ""}
                    onChange={(e) => setField("clientEmail", e.target.value)}
                  />
                </label>
              </div>

              <div className="invoice-lines-header">
                <span>Description</span>
                <span>Qty</span>
                <span>Rate</span>
                <span />
              </div>
              {draft.lineItems.map((row) => (
                <div className="invoice-line-row" key={row.id}>
                  <input
                    value={row.description}
                    onChange={(e) =>
                      setLine(row.id, "description", e.target.value)
                    }
                    placeholder="e.g. Vinyl double-hung install"
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.quantity}
                    onChange={(e) => setLine(row.id, "quantity", e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={row.rate}
                    onChange={(e) => setLine(row.id, "rate", e.target.value)}
                  />
                  <button
                    type="button"
                    className="invoice-line-remove"
                    onClick={() => removeLine(row.id)}
                    title="Remove line"
                    aria-label="Remove line"
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="invoice-add-line" onClick={addLine}>
                + Add line item
              </button>

              <label className="invoice-field invoice-field-full" style={{ marginTop: "1rem" }}>
                <span>Notes (optional)</span>
                <textarea
                  rows={3}
                  value={draft.notes || ""}
                  onChange={(e) => setField("notes", e.target.value)}
                  placeholder="Payment terms, thank-you, warranty notes…"
                />
              </label>

              <div className="invoice-toolbar">
                <button
                  type="button"
                  className="admin-btn admin-btn-primary"
                  onClick={() => handleSave()}
                  disabled={saving}
                >
                  {saving ? "Saving…" : "Save invoice"}
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => handlePrint()}
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-danger"
                  onClick={() => handleDelete()}
                  disabled={saving}
                >
                  Delete
                </button>
              </div>
            </>
          )}
        </div>

        <div className="invoice-preview-wrap">
          <p className="invoice-preview-label">Print preview</p>
          <div id="invoice-print-root">
            {draft ? (
              <InvoiceDocument invoice={draft} />
            ) : (
              <div className="invoice-doc invoice-doc-placeholder">
                Select or create an invoice to see the print preview.
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
