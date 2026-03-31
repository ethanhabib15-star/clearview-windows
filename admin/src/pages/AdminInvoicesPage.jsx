import { useCallback, useEffect, useRef, useState } from "react";
import InvoiceDocument from "@shared/invoice/InvoiceDocument.jsx";
import ElectronicSignatureModal from "../components/ElectronicSignatureModal.jsx";
import { apiUrl, readResponseJson } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";
import "./InvoicePrint.css";

function cloneInvoice(inv) {
  return JSON.parse(JSON.stringify(inv));
}

function computeInvoiceTotalDollars(inv) {
  if (!inv?.lineItems?.length) return 0;
  const subtotal = inv.lineItems.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const tax = (subtotal * (Number(inv.taxPercent) || 0)) / 100;
  return subtotal + tax;
}

const moneyHistory = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatInvoiceCreatedAt(iso) {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return String(iso);
  }
}

function invoiceHistoryStatus(inv) {
  if (inv?.paymentStatus === "paid") return "paid";
  if (inv?.paymentStatus === "pending") return "pending";
  return "unpaid";
}

function normalizeInvoiceNumberKey(s) {
  return String(s ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

function isLocalDraft(d) {
  return Boolean(d?.id?.startsWith("local-"));
}

function createBlankLocalDraft() {
  const id = `local-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const lineId = crypto.randomUUID();
  return {
    id,
    number: "",
    issueDate: now.slice(0, 10),
    dueDate: "",
    fromName: "Ryzhkov ClearView Windows",
    fromAddress: "Tulsa metro · Broken Arrow · Coweta\nNortheast Oklahoma",
    fromPhone: "(918) 555-0100",
    fromEmail: "hello@ryzhkovclearviewwindows.com",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    lineItems: [{ id: lineId, description: "", quantity: 1, rate: 0 }],
    taxPercent: 8.25,
    notes: "",
    paymentBank: "",
    paymentAccount: "",
    paymentPhone: "",
    signatureDataUrl: "",
    signedAt: "",
    paymentStatus: "unpaid",
    paidAt: "",
    createdAt: "",
    updatedAt: "",
  };
}

function newLineItemId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `line-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function bodyForInvoiceApi(draft) {
  const lines = Array.isArray(draft.lineItems) ? draft.lineItems : [];
  return {
    number: String(draft?.number ?? "").trim(),
    issueDate: draft.issueDate,
    dueDate: draft.dueDate,
    fromName: draft.fromName,
    fromAddress: draft.fromAddress,
    fromPhone: draft.fromPhone,
    fromEmail: draft.fromEmail,
    clientName: draft.clientName,
    clientAddress: draft.clientAddress,
    clientEmail: draft.clientEmail,
    lineItems: lines.map((row) => ({
      id:
        row?.id != null && String(row.id).trim()
          ? String(row.id).trim()
          : newLineItemId(),
      description: row.description ?? "",
      quantity: Number(row.quantity) || 0,
      rate: Number(row.rate) || 0,
    })),
    taxPercent: Number(draft.taxPercent) || 0,
    notes: draft.notes,
    paymentBank: draft.paymentBank,
    paymentAccount: draft.paymentAccount,
    paymentPhone: draft.paymentPhone,
    signatureDataUrl: draft.signatureDataUrl,
    signedAt: draft.signedAt,
  };
}

function validateDraftForSave(draft, savedInvoices) {
  const errors = [];
  const num = String(draft.number ?? "").trim();
  if (!num) errors.push("Invoice number is required.");
  const client = String(draft.clientName ?? "").trim();
  if (!client) errors.push("Customer / company name is required.");
  const lines = draft.lineItems || [];
  let hasLine = false;
  for (const row of lines) {
    const desc = String(row.description ?? "").trim();
    const qty = Number(row.quantity) || 0;
    const rate = Number(row.rate) || 0;
    if (desc && qty > 0 && rate > 0) {
      hasLine = true;
      break;
    }
  }
  if (!hasLine) {
    errors.push(
      "Add at least one line item with a description, quantity greater than zero, and price greater than zero."
    );
  }
  const total = computeInvoiceTotalDollars(draft);
  if (!(total > 0)) {
    errors.push("Invoice total must be greater than zero.");
  }
  if (num) {
    const key = normalizeInvoiceNumberKey(num);
    const selfId = isLocalDraft(draft) ? null : String(draft.id);
    const dup = savedInvoices.find((inv) => {
      if (selfId && String(inv.id) === selfId) return false;
      return normalizeInvoiceNumberKey(inv.number) === key;
    });
    if (dup) {
      errors.push(
        "An invoice with this number already exists. Use a unique invoice number."
      );
    }
  }
  return { ok: errors.length === 0, errors };
}

export default function AdminInvoicesPage() {
  const [invoices, setInvoices] = useState([]);
  const [draft, setDraft] = useState(() => createBlankLocalDraft());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [sigModalOpen, setSigModalOpen] = useState(false);
  const [adminSection, setAdminSection] = useState("create");
  const [viewInvoice, setViewInvoice] = useState(null);
  /** Keeps save in sync with the invoice # field (React state can lag the DOM by one update). */
  const invoiceNumberInputRef = useRef(null);

  const loadInvoices = useCallback(async (opts) => {
    const silent = Boolean(opts?.silent);
    const k = getStoredAdminKey();
    if (!k) {
      setLoading(false);
      return;
    }
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const r = await fetch(apiUrl("/api/invoices"), {
        headers: adminAuthHeaders(k),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      if (!r.ok) {
        if (!silent) {
          setError("Could not load invoices.");
        }
        return;
      }
      const data = await r.json();
      const list = Array.isArray(data.invoices) ? data.invoices : [];
      setInvoices(list);
      setDraft((prev) => {
        if (prev?.id && isLocalDraft(prev)) {
          return prev;
        }
        if (prev?.id) {
          const fresh = list.find((x) => String(x.id) === String(prev.id));
          if (fresh) return cloneInvoice(fresh);
          // Do not clear the editor if the list is empty or missing this id (avoids wiping after save).
          return prev;
        }
        return prev;
      });
    } catch {
      if (!silent) {
        setError("Network error loading invoices.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInvoices();
  }, [loadInvoices]);

  useEffect(() => {
    if (adminSection === "history") {
      loadInvoices();
    }
  }, [adminSection, loadInvoices]);

  useEffect(() => {
    if (!viewInvoice) return undefined;
    function onKey(e) {
      if (e.key === "Escape") setViewInvoice(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [viewInvoice]);

  useEffect(() => {
    if (!successMessage) return undefined;
    const t = window.setTimeout(() => setSuccessMessage(""), 5000);
    return () => window.clearTimeout(t);
  }, [successMessage]);

  useEffect(() => {
    if (!isLocalDraft(draft)) return undefined;
    function beforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, [draft]);

  function confirmDiscardLocalDraft() {
    return window.confirm(
      "You have an unsaved invoice draft. Discard it and continue?"
    );
  }

  function selectInvoice(inv) {
    if (isLocalDraft(draft) && !confirmDiscardLocalDraft()) {
      return;
    }
    setError("");
    setSuccessMessage("");
    setDraft(cloneInvoice(inv));
  }

  function handleNew() {
    if (isLocalDraft(draft) && !confirmDiscardLocalDraft()) {
      return;
    }
    setError("");
    setSuccessMessage("");
    setDraft(createBlankLocalDraft());
  }

  function draftWithInvoiceNumberFromDom(d) {
    if (!d) return d;
    const el = invoiceNumberInputRef.current;
    if (!el || typeof el.value !== "string") return d;
    const domTrim = el.value.trim();
    const stateTrim = String(d.number ?? "").trim();
    // Avoid overwriting state with an empty input (ref present but value not yet synced).
    if (!domTrim && stateTrim) return d;
    return { ...d, number: el.value };
  }

  async function handleSave() {
    if (!draft) {
      setError(
        "No invoice to save. Click + New invoice, fill in the form, then try again."
      );
      return;
    }
    const toSave = draftWithInvoiceNumberFromDom(draft);
    const v = validateDraftForSave(toSave, invoices);
    if (!v.ok) {
      setSuccessMessage("");
      setError(v.errors.join(" "));
      return;
    }
    const k = getStoredAdminKey();
    if (!k) {
      setError(
        "Not signed in. Open the admin login page and enter your admin API key, then try again."
      );
      return;
    }
    setSaving(true);
    setError("");
    setSuccessMessage("");
    try {
      const mustCreateNew = String(toSave?.id || "").startsWith("local-");
      if (mustCreateNew) {
        const r = await fetch(apiUrl("/api/invoices"), {
          method: "POST",
          headers: {
            ...adminAuthHeaders(k),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(bodyForInvoiceApi(toSave)),
        });
        if (r.status === 401) {
          clearStoredAdminKey();
          window.location.assign("/admin/");
          return;
        }
        const data = await readResponseJson(r);
        if (!r.ok || !data.invoice) {
          setError(
            data.error ||
              `Could not save invoice (HTTP ${r.status}). Run the API on the same port as API_PORT in .env (e.g. npm run dev:api) and open the admin app from the Vite dev server so /api is proxied. Sign in with the same value as ADMIN_KEY in .env.`
          );
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
        const numLabel = String(saved.number || "").trim() || "Invoice";
        setSuccessMessage(
          `${numLabel} was saved and added to Invoice History. Open Create Invoice when you are ready for the next one.`
        );
        await loadInvoices({ silent: true });
        setDraft(createBlankLocalDraft());
        setAdminSection("history");
        return;
      }

      const r = await fetch(
        apiUrl(`/api/invoices/${encodeURIComponent(toSave.id)}`),
        {
          method: "PUT",
          headers: {
            ...adminAuthHeaders(k),
            "Content-Type": "application/json",
          },
          body: JSON.stringify(toSave),
        }
      );
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      const data = await readResponseJson(r);
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
      const numLabel = String(saved.number || "").trim() || "Invoice";
      setSuccessMessage(
        `${numLabel} was saved. Your changes are shown in Invoice History below.`
      );
      await loadInvoices({ silent: true });
      setAdminSection("history");
    } catch (e) {
      const msg =
        e instanceof Error && e.message
          ? e.message
          : "Could not reach the server.";
      setError(
        `${msg} Start the API (npm run dev:api or full npm run dev) and ensure API_PORT in .env matches the port the admin app proxies to (see admin/vite.config.js).`
      );
    } finally {
      setSaving(false);
    }
  }

  function handleDiscardLocal() {
    if (!isLocalDraft(draft)) return;
    if (
      !window.confirm(
        "Discard this unsaved invoice? Nothing will be stored. This cannot be undone."
      )
    ) {
      return;
    }
    setError("");
    setSuccessMessage("");
    setDraft(createBlankLocalDraft());
  }

  async function handleDelete() {
    if (!draft?.id || isLocalDraft(draft)) return;
    await handleDeleteById(draft.id);
  }

  async function handleDeleteById(id) {
    if (!id || String(id).startsWith("local-")) return;
    if (!window.confirm("Delete this invoice permanently?")) return;
    const k = getStoredAdminKey();
    if (!k) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch(apiUrl("/api/invoices/delete"), {
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
      if (!r.ok || !data.ok) {
        setError(data.error || "Could not delete invoice.");
        return;
      }
      if (viewInvoice && String(viewInvoice.id) === String(id)) {
        setViewInvoice(null);
      }
      if (draft && String(draft.id) === String(id)) {
        setDraft(createBlankLocalDraft());
      }
      setSuccessMessage("");
      await loadInvoices();
    } catch {
      setError("Network error deleting invoice.");
    } finally {
      setSaving(false);
    }
  }

  function openHistoryView(inv) {
    setViewInvoice(cloneInvoice(inv));
  }

  function editInvoiceFromHistory(inv) {
    if (isLocalDraft(draft) && !confirmDiscardLocalDraft()) {
      return;
    }
    setViewInvoice(null);
    setAdminSection("create");
    setError("");
    setSuccessMessage("");
    setDraft(cloneInvoice(inv));
  }

  function handlePrint() {
    window.print();
  }

  function applySignature(dataUrl) {
    setDraft((d) =>
      d
        ? {
            ...d,
            signatureDataUrl: dataUrl,
            signedAt: new Date().toISOString(),
          }
        : d
    );
  }

  function clearSignature() {
    setDraft((d) =>
      d ? { ...d, signatureDataUrl: "", signedAt: "" } : d
    );
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
      <div className="invoice-admin-top">
        <div className="invoice-admin-tabs-row">
          <button
            type="button"
            className={`invoice-admin-tab${
              adminSection === "create" ? " invoice-admin-tab--active" : ""
            }`}
            onClick={() => {
              setError("");
              setSuccessMessage("");
              setViewInvoice(null);
              setAdminSection("create");
            }}
          >
            Create Invoice
          </button>
          <button
            type="button"
            className={`invoice-admin-tab${
              adminSection === "history" ? " invoice-admin-tab--active" : ""
            }`}
            onClick={() => {
              setError("");
              setSuccessMessage("");
              setAdminSection("history");
            }}
          >
            Invoice History
          </button>
        </div>
        <p className="invoice-admin-sync-hint">
          The public <strong>Pay online</strong> page only sees invoices after you
          click <strong>Save Invoice</strong>. Drafts stay in the browser until
          then and never appear in Invoice History or customer lookup. Only saved,
          valid invoices can be paid (minimum $0.50 for cards).
        </p>
        {error ? (
          <p className="admin-banner admin-banner-error" role="alert">
            {error}
          </p>
        ) : null}
        {successMessage ? (
          <p className="admin-banner admin-banner-success" role="status">
            {successMessage}
          </p>
        ) : null}
      </div>

      {adminSection === "create" ? (
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
          ) : (
            <>
              {!isLocalDraft(draft) && invoices.length === 0 ? (
                <p className="admin-muted">
                  No saved invoices yet. Click <strong>+ New invoice</strong> to
                  start a draft, then <strong>Save Invoice</strong> when it is
                  complete.
                </p>
              ) : null}
              {isLocalDraft(draft) || invoices.length > 0 ? (
                <ul className="invoice-list">
                  {isLocalDraft(draft) ? (
                    <li key={draft.id}>
                      <button
                        type="button"
                        className="invoice-list-item invoice-list-item-active"
                      >
                        <span className="invoice-list-row1">
                          <span className="invoice-list-num invoice-list-num--draft">
                            Unsaved draft
                          </span>
                        </span>
                        <span className="invoice-list-meta">
                          Not stored until you save
                        </span>
                      </button>
                    </li>
                  ) : null}
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
                        <span className="invoice-list-row1">
                          <span className="invoice-list-num">{inv.number}</span>
                          {inv.paymentStatus === "paid" ? (
                            <span className="invoice-list-paid">Paid</span>
                          ) : inv.paymentStatus === "pending" ? (
                            <span className="invoice-list-pending">Pending</span>
                          ) : null}
                        </span>
                        <span className="invoice-list-meta">
                          {inv.clientName || "No client"} · {inv.issueDate || "—"}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
        </aside>

        <div className="invoice-form-panel">
          <h2>Edit invoice</h2>
          {isLocalDraft(draft) ? (
            <p className="admin-muted invoice-draft-banner">
              <strong>Draft</strong> — not saved yet. Nothing is written to the
              server or Invoice History until you click <strong>Save Invoice</strong>
              .
            </p>
          ) : null}
          {error ? (
            <p className="admin-banner admin-banner-error" role="alert">
              {error}
            </p>
          ) : null}
          {successMessage ? (
            <p className="admin-banner admin-banner-success" role="status">
              {successMessage}
            </p>
          ) : null}

          {!draft ? (
            <p className="admin-muted">
              Select a saved invoice from the list, or click <strong>+ New invoice</strong>{" "}
              to start a draft. Use <strong>Save Invoice</strong> when the invoice is
              complete and valid.
            </p>
          ) : (
            <>
              <div className="invoice-form-grid">
                <label className="invoice-field">
                  <span>Invoice #</span>
                  <input
                    ref={invoiceNumberInputRef}
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

                <label className="invoice-field invoice-field-full">
                  <span>Payment — bank name (print layout)</span>
                  <input
                    value={draft.paymentBank || ""}
                    onChange={(e) => setField("paymentBank", e.target.value)}
                    placeholder="e.g. Your business bank"
                  />
                </label>
                <label className="invoice-field">
                  <span>Payment — account / name on account</span>
                  <input
                    value={draft.paymentAccount || ""}
                    onChange={(e) => setField("paymentAccount", e.target.value)}
                  />
                </label>
                <label className="invoice-field">
                  <span>Payment — phone</span>
                  <input
                    value={draft.paymentPhone || ""}
                    onChange={(e) => setField("paymentPhone", e.target.value)}
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
                  {saving ? "Saving…" : "Save Invoice"}
                </button>
                {isLocalDraft(draft) ? (
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => handleDiscardLocal()}
                    disabled={saving}
                  >
                    Discard Invoice
                  </button>
                ) : (
                  <button
                    type="button"
                    className="admin-btn admin-btn-danger"
                    onClick={() => handleDelete()}
                    disabled={saving}
                  >
                    Delete
                  </button>
                )}
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => handlePrint()}
                >
                  Print / PDF
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => setSigModalOpen(true)}
                >
                  Sign electronically
                </button>
                <button
                  type="button"
                  className="admin-btn admin-btn-ghost"
                  onClick={() => clearSignature()}
                  disabled={!draft?.signatureDataUrl}
                >
                  Clear signature
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
      ) : (
      <div className="invoice-history-wrap">
        <h2 className="invoice-history-title">All invoices</h2>
        {loading ? (
          <p className="admin-muted">Loading…</p>
        ) : invoices.length === 0 ? (
          <p className="admin-muted">
            No invoices yet. Open <strong>Create Invoice</strong> to add one.
          </p>
        ) : (
          <div className="invoice-history-table-wrap">
            <table className="invoice-history-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Customer</th>
                  <th>Total</th>
                  <th>Date created</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {[...invoices]
                  .sort(
                    (a, b) =>
                      new Date(b.createdAt || 0).getTime() -
                      new Date(a.createdAt || 0).getTime()
                  )
                  .map((inv) => {
                    const st = invoiceHistoryStatus(inv);
                    return (
                      <tr key={inv.id}>
                        <td className="invoice-history-mono">
                          {inv.number || "—"}
                        </td>
                        <td>{inv.clientName?.trim() || "—"}</td>
                        <td>
                          {moneyHistory.format(
                            computeInvoiceTotalDollars(inv)
                          )}
                        </td>
                        <td>{formatInvoiceCreatedAt(inv.createdAt)}</td>
                        <td>
                          <span
                            className={`invoice-status-pill invoice-status-pill--${st}`}
                          >
                            {st === "paid"
                              ? "Paid"
                              : st === "pending"
                                ? "Pending"
                                : "Unpaid"}
                          </span>
                        </td>
                        <td>
                          <div className="invoice-history-actions">
                            <button
                              type="button"
                              className="admin-btn admin-btn-ghost invoice-history-action-btn"
                              onClick={() => openHistoryView(inv)}
                            >
                              View
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-ghost invoice-history-action-btn"
                              onClick={() => editInvoiceFromHistory(inv)}
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              className="admin-btn admin-btn-danger invoice-history-action-btn"
                              onClick={() => handleDeleteById(inv.id)}
                              disabled={saving}
                            >
                              Delete
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      )}

      {viewInvoice ? (
        <div
          className="invoice-view-modal-backdrop"
          role="presentation"
          onClick={() => setViewInvoice(null)}
        >
          <div
            className="invoice-view-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="invoice-view-title"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="invoice-view-modal-head">
              <h2 id="invoice-view-title">
                Invoice {viewInvoice.number || ""}
              </h2>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => setViewInvoice(null)}
              >
                Close
              </button>
            </div>
            <div className="invoice-view-modal-scroll">
              <div id="invoice-print-root">
                <InvoiceDocument invoice={viewInvoice} />
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <ElectronicSignatureModal
        open={sigModalOpen}
        onClose={() => setSigModalOpen(false)}
        onApply={applySignature}
      />
    </main>
  );
}
