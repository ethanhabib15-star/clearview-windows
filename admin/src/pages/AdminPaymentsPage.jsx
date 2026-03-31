import { useCallback, useEffect, useMemo, useState } from "react";
import { apiUrl } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";

const STATUS_OPTS = [
  { value: "", label: "All statuses" },
  { value: "successful", label: "Successful" },
  { value: "pending", label: "Pending" },
  { value: "failed", label: "Failed" },
];

function formatWhen(iso) {
  try {
    return new Date(iso).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso || "—";
  }
}

function formatMoney(cents, currency) {
  const c = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c === "USD" ? "USD" : c,
    }).format((Number(cents) || 0) / 100);
  } catch {
    return `$${((Number(cents) || 0) / 100).toFixed(2)}`;
  }
}

function methodLabel(m) {
  if (!m) return "—";
  if (m === "card") return "Card";
  if (m === "demo") return "Demo";
  if (m === "bank_transfer") return "Bank transfer";
  return m;
}

function maskAccount(n) {
  const s = String(n || "").replace(/\s/g, "");
  if (s.length <= 4) return s ? "••••" : "";
  return `••••${s.slice(-4)}`;
}

export default function AdminPaymentsPage() {
  const [mainTab, setMainTab] = useState("history");

  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [sort, setSort] = useState("date");
  const [order, setOrder] = useState("desc");
  const [statusFilter, setStatusFilter] = useState("");
  const [searchQ, setSearchQ] = useState("");

  const [payoutMsg, setPayoutMsg] = useState("");
  const [payoutError, setPayoutError] = useState("");
  const [payoutLoading, setPayoutLoading] = useState(false);
  const [payoutConfigured, setPayoutConfigured] = useState(true);
  const [payoutHint, setPayoutHint] = useState("");
  const [payoutForm, setPayoutForm] = useState({
    accountHolderName: "",
    bankName: "",
    routingNumber: "",
    accountNumber: "",
  });

  const queryString = useMemo(() => {
    const p = new URLSearchParams();
    p.set("sort", sort);
    p.set("order", order);
    if (statusFilter) p.set("status", statusFilter);
    if (searchQ.trim()) p.set("q", searchQ.trim());
    return p.toString();
  }, [sort, order, statusFilter, searchQ]);

  const fetchPayments = useCallback(async () => {
    const k = getStoredAdminKey();
    if (!k) return;
    setLoading(true);
    setLoadError("");
    try {
      const r = await fetch(apiUrl(`/api/admin/payments?${queryString}`), {
        headers: adminAuthHeaders(k),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      if (!r.ok) {
        setLoadError("Could not load payments.");
        return;
      }
      const data = await r.json();
      setPayments(Array.isArray(data.payments) ? data.payments : []);
    } catch {
      setLoadError("Cannot reach the API.");
    } finally {
      setLoading(false);
    }
  }, [queryString]);

  useEffect(() => {
    if (mainTab !== "history") return;
    fetchPayments();
  }, [mainTab, fetchPayments]);

  const loadPayout = useCallback(async () => {
    const k = getStoredAdminKey();
    if (!k) return;
    setPayoutLoading(true);
    setPayoutError("");
    setPayoutMsg("");
    try {
      const r = await fetch("/api/admin/payout-settings", {
        headers: adminAuthHeaders(k),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      const data = await r.json();
      setPayoutConfigured(Boolean(data.configured));
      setPayoutHint(data.message || "");
      if (data.settings) {
        setPayoutForm({
          accountHolderName: data.settings.accountHolderName || "",
          bankName: data.settings.bankName || "",
          routingNumber: data.settings.routingNumber || "",
          accountNumber: data.settings.accountNumber || "",
        });
      } else {
        setPayoutForm({
          accountHolderName: "",
          bankName: "",
          routingNumber: "",
          accountNumber: "",
        });
      }
    } catch {
      setPayoutError("Could not load payout settings.");
    } finally {
      setPayoutLoading(false);
    }
  }, []);

  useEffect(() => {
    if (mainTab !== "payout") return;
    loadPayout();
  }, [mainTab, loadPayout]);

  async function savePayout(e) {
    e.preventDefault();
    const k = getStoredAdminKey();
    if (!k) return;
    setPayoutError("");
    setPayoutMsg("");
    setPayoutLoading(true);
    try {
      const r = await fetch(apiUrl("/api/admin/payout-settings"), {
        method: "PUT",
        headers: {
          ...adminAuthHeaders(k),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payoutForm),
      });
      if (r.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setPayoutError(data.error || "Save failed.");
        return;
      }
      setPayoutMsg("Payout details saved. They are encrypted on the server disk.");
      await loadPayout();
    } catch {
      setPayoutError("Network error while saving.");
    } finally {
      setPayoutLoading(false);
    }
  }

  return (
    <div className="admin-main">
      <div className="admin-container">
        <div className="admin-page-title-row">
          <div className="admin-page-title">
            <h1>Payments</h1>
            <p className="admin-subtitle">
              Customer payment history and secure payout (bank) configuration.
            </p>
          </div>
        </div>

        <div className="admin-payments-tabs" role="tablist" aria-label="Payments sections">
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "history"}
            className={`admin-payments-tab${mainTab === "history" ? " admin-payments-tab-active" : ""}`}
            onClick={() => setMainTab("history")}
          >
            Payment history
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainTab === "payout"}
            className={`admin-payments-tab${mainTab === "payout" ? " admin-payments-tab-active" : ""}`}
            onClick={() => setMainTab("payout")}
          >
            Payout settings
          </button>
        </div>

        {mainTab === "history" ? (
          <>
            <div className="admin-filters admin-payments-filters">
              <label className="admin-label admin-filter-field">
                <span>Search</span>
                <input
                  type="search"
                  value={searchQ}
                  onChange={(e) => setSearchQ(e.target.value)}
                  placeholder="Name, email, invoice, id…"
                  aria-label="Search payments"
                />
              </label>
              <label className="admin-label admin-filter-field">
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  {STATUS_OPTS.map((o) => (
                    <option key={o.value || "all"} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="admin-label admin-filter-field">
                <span>Sort by</span>
                <select value={sort} onChange={(e) => setSort(e.target.value)}>
                  <option value="date">Date</option>
                  <option value="amount">Amount</option>
                  <option value="status">Status</option>
                </select>
              </label>
              <label className="admin-label admin-filter-field">
                <span>Order</span>
                <select value={order} onChange={(e) => setOrder(e.target.value)}>
                  <option value="desc">Newest / high first</option>
                  <option value="asc">Oldest / low first</option>
                </select>
              </label>
              <button
                type="button"
                className="admin-btn admin-btn-ghost"
                onClick={() => fetchPayments()}
              >
                Refresh
              </button>
            </div>

            {loadError ? (
              <p className="admin-banner admin-banner-error" role="alert">
                {loadError}
              </p>
            ) : null}

            {loading ? (
              <p className="admin-empty">Loading…</p>
            ) : payments.length === 0 ? (
              <div className="admin-empty-card">
                <p>No payments yet.</p>
                <p className="admin-muted">
                  Successful Stripe checkouts and demo payments appear here.
                </p>
              </div>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Customer</th>
                      <th>Email</th>
                      <th>Invoice / ref</th>
                      <th>Amount</th>
                      <th>Method</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payments.map((p) => (
                      <tr key={p.id}>
                        <td className="admin-cell-muted">{formatWhen(p.createdAt)}</td>
                        <td className="admin-cell-strong">{p.customerName || "—"}</td>
                        <td>{p.email || "—"}</td>
                        <td>{p.invoiceRef || "—"}</td>
                        <td>{formatMoney(p.amountCents, p.currency)}</td>
                        <td>{methodLabel(p.method)}</td>
                        <td>
                          <span className={`admin-pay-status admin-pay-status-${p.status || "unknown"}`}>
                            {p.status || "—"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        ) : (
          <>
            {!payoutConfigured ? (
              <p className="admin-banner admin-banner-error" role="status">
                {payoutHint ||
                  "Set PAYOUT_ENCRYPTION_KEY in server .env to store bank details encrypted."}
              </p>
            ) : (
              <p className="admin-muted">
                Banking details are encrypted at rest (AES-256-GCM). Only admins with
                your key can read or change them. Use HTTPS in production.
              </p>
            )}

            {payoutError ? (
              <p className="admin-banner admin-banner-error" role="alert">
                {payoutError}
              </p>
            ) : null}
            {payoutMsg ? (
              <p className="admin-banner admin-banner-success" role="status">
                {payoutMsg}
              </p>
            ) : null}

            {payoutConfigured && payoutForm.accountNumber ? (
              <p className="admin-muted">
                Saved account (masked): {maskAccount(payoutForm.accountNumber)} · routing
                ends {String(payoutForm.routingNumber || "").slice(-4) || "—"}
              </p>
            ) : null}

            <form className="admin-payout-form" onSubmit={savePayout}>
              <label className="admin-label">
                <span>Account holder name</span>
                <input
                  value={payoutForm.accountHolderName}
                  onChange={(e) =>
                    setPayoutForm((f) => ({
                      ...f,
                      accountHolderName: e.target.value,
                    }))
                  }
                  maxLength={200}
                  required
                  disabled={!payoutConfigured || payoutLoading}
                />
              </label>
              <label className="admin-label">
                <span>Bank name</span>
                <input
                  value={payoutForm.bankName}
                  onChange={(e) =>
                    setPayoutForm((f) => ({ ...f, bankName: e.target.value }))
                  }
                  maxLength={200}
                  required
                  disabled={!payoutConfigured || payoutLoading}
                />
              </label>
              <label className="admin-label">
                <span>Routing number (9 digits, US ABA)</span>
                <input
                  value={payoutForm.routingNumber}
                  onChange={(e) =>
                    setPayoutForm((f) => ({
                      ...f,
                      routingNumber: e.target.value.replace(/\D/g, "").slice(0, 9),
                    }))
                  }
                  inputMode="numeric"
                  pattern="\d{9}"
                  title="Nine-digit ABA routing number"
                  required
                  disabled={!payoutConfigured || payoutLoading}
                />
              </label>
              <label className="admin-label">
                <span>Account number</span>
                <input
                  value={payoutForm.accountNumber}
                  onChange={(e) =>
                    setPayoutForm((f) => ({
                      ...f,
                      accountNumber: e.target.value.replace(/\s/g, "").slice(0, 17),
                    }))
                  }
                  inputMode="numeric"
                  autoComplete="off"
                  required
                  disabled={!payoutConfigured || payoutLoading}
                />
              </label>
              <button
                type="submit"
                className="admin-btn admin-btn-primary"
                disabled={!payoutConfigured || payoutLoading}
              >
                {payoutLoading ? "Saving…" : "Save payout settings"}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
