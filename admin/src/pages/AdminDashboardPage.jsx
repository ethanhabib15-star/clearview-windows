import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { apiUrl } from "../admin/api.js";
import {
  adminAuthHeaders,
  clearStoredAdminKey,
  getStoredAdminKey,
} from "../admin/auth.js";
import "./Admin.css";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

function formatWhen(iso) {
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

function invoiceStatusLabel(status) {
  if (status === "paid") return "Paid";
  if (status === "pending") return "Pending";
  return "Unpaid";
}

function invoiceStatusClass(status) {
  if (status === "paid") return "invoice-status-pill--paid";
  if (status === "pending") return "invoice-status-pill--pending";
  return "invoice-status-pill--unpaid";
}

export default function AdminDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [payments, setPayments] = useState([]);
  const [invoices, setInvoices] = useState([]);

  const loadDashboardData = useCallback(async () => {
    const key = getStoredAdminKey();
    if (!key) return;
    setLoading(true);
    setError("");

    try {
      const [paymentsRes, invoicesRes] = await Promise.all([
        fetch(apiUrl("/api/admin/payments?sort=date&order=desc"), {
          headers: adminAuthHeaders(key),
        }),
        fetch(apiUrl("/api/invoices"), {
          headers: adminAuthHeaders(key),
        }),
      ]);

      if (paymentsRes.status === 401 || invoicesRes.status === 401) {
        clearStoredAdminKey();
        window.location.assign("/admin/");
        return;
      }
      if (!paymentsRes.ok || !invoicesRes.ok) {
        setError("Could not load dashboard history.");
        return;
      }

      const paymentsData = await paymentsRes.json().catch(() => ({}));
      const invoicesData = await invoicesRes.json().catch(() => ({}));
      setPayments(Array.isArray(paymentsData.payments) ? paymentsData.payments : []);
      setInvoices(Array.isArray(invoicesData.invoices) ? invoicesData.invoices : []);
    } catch {
      setError("Cannot reach the API.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const metrics = useMemo(() => {
    const successfulPayments = payments.filter((p) => p.status === "successful");
    const totalRevenueCents = successfulPayments.reduce(
      (sum, p) => sum + (Number(p.amountCents) || 0),
      0
    );
    const paidInvoices = invoices.filter((inv) => inv.paymentStatus === "paid").length;
    const outstandingInvoices = invoices.filter(
      (inv) => inv.paymentStatus !== "paid"
    ).length;
    return {
      totalRevenueCents,
      paymentCount: payments.length,
      paidInvoices,
      outstandingInvoices,
    };
  }, [payments, invoices]);

  const recentPayments = useMemo(() => payments.slice(0, 6), [payments]);
  const recentInvoices = useMemo(
    () =>
      [...invoices]
        .sort(
          (a, b) =>
            new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
        )
        .slice(0, 6),
    [invoices]
  );

  return (
    <main className="admin-main admin-dashboard-main">
      <div className="admin-container">
        <div className="admin-page-title-row">
          <div className="admin-page-title">
            <h1>Dashboard</h1>
            <p className="admin-subtitle">
              Payment and invoice history overview for quick daily operations.
            </p>
          </div>
          <button
            type="button"
            className="admin-btn admin-btn-ghost"
            onClick={() => loadDashboardData()}
            disabled={loading}
          >
            {loading ? "Refreshing..." : "Refresh"}
          </button>
        </div>

        {error ? (
          <p className="admin-banner admin-banner-error" role="alert">
            {error}
          </p>
        ) : null}

        <section className="admin-dashboard-metrics" aria-label="Dashboard metrics">
          <article className="admin-dashboard-card">
            <p className="admin-dashboard-kicker">Revenue (successful payments)</p>
            <p className="admin-dashboard-value">
              {currencyFormatter.format(metrics.totalRevenueCents / 100)}
            </p>
          </article>
          <article className="admin-dashboard-card">
            <p className="admin-dashboard-kicker">Payment records</p>
            <p className="admin-dashboard-value">{metrics.paymentCount}</p>
          </article>
          <article className="admin-dashboard-card">
            <p className="admin-dashboard-kicker">Paid invoices</p>
            <p className="admin-dashboard-value">{metrics.paidInvoices}</p>
          </article>
          <article className="admin-dashboard-card">
            <p className="admin-dashboard-kicker">Outstanding invoices</p>
            <p className="admin-dashboard-value">{metrics.outstandingInvoices}</p>
          </article>
        </section>

        <section className="admin-dashboard-panels" aria-label="Recent history">
          <article className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <h2>Recent payments</h2>
              <Link to="/payments" className="admin-link">
                View all
              </Link>
            </div>
            {loading ? (
              <p className="admin-muted">Loading payments...</p>
            ) : recentPayments.length === 0 ? (
              <p className="admin-muted">No payment history yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>When</th>
                      <th>Customer</th>
                      <th>Invoice / ref</th>
                      <th>Amount</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="admin-cell-muted">{formatWhen(p.createdAt)}</td>
                        <td className="admin-cell-strong">{p.customerName || "—"}</td>
                        <td>{p.invoiceRef || "—"}</td>
                        <td>{currencyFormatter.format((Number(p.amountCents) || 0) / 100)}</td>
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
          </article>

          <article className="admin-dashboard-panel">
            <div className="admin-dashboard-panel-head">
              <h2>Recent invoices</h2>
              <Link to="/invoices" className="admin-link">
                View all
              </Link>
            </div>
            {loading ? (
              <p className="admin-muted">Loading invoices...</p>
            ) : recentInvoices.length === 0 ? (
              <p className="admin-muted">No invoice history yet.</p>
            ) : (
              <div className="admin-table-wrap">
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Invoice #</th>
                      <th>Customer</th>
                      <th>Created</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="admin-cell-strong">{inv.number || "—"}</td>
                        <td>{inv.clientName || "—"}</td>
                        <td className="admin-cell-muted">{formatWhen(inv.createdAt)}</td>
                        <td>
                          <span
                            className={`invoice-status-pill ${invoiceStatusClass(
                              inv.paymentStatus
                            )}`}
                          >
                            {invoiceStatusLabel(inv.paymentStatus)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </section>
      </div>
    </main>
  );
}
