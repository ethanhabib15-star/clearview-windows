import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { PaySiteFooter, PaySiteHeader } from "../components/PaySiteChrome.jsx";
import "../App.css";
import "./PaymentsPage.css";

function formatMoney(cents, currency) {
  const c = String(currency || "USD").toUpperCase();
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: c === "USD" ? "USD" : c,
    }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(2)}`;
  }
}

export default function PaymentSuccessPage() {
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const paymentIntentId = searchParams.get("payment_intent");
  const isDemo = searchParams.get("demo") === "1";

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [detail, setDetail] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setDetail(null);

    if (paymentIntentId && !isDemo) {
      try {
        const r = await fetch(
          `/api/payments/intent-status?payment_intent=${encodeURIComponent(paymentIntentId)}`
        );
        const data = await r.json().catch(() => ({}));
        if (!r.ok) {
          setError(data.error || "Could not confirm payment.");
          setLoading(false);
          return;
        }
        if (!data.paid) {
          setError(
            data.status === "requires_payment_method"
              ? "Payment was not completed. Try again from Pay online."
              : "Payment is not complete yet. Refresh in a moment or contact us."
          );
          setLoading(false);
          return;
        }
        setDetail({
          paid: true,
          customerName: data.customerName,
          email: data.email,
          invoiceRef: data.invoiceRef,
          amountCents: data.amountCents,
          currency: data.currency,
          method: "card",
        });
      } catch {
        setError("Network error confirming payment.");
      }
      setLoading(false);
      return;
    }

    if (isDemo) {
      try {
        const raw = window.sessionStorage.getItem("pay_success");
        if (raw) {
          const p = JSON.parse(raw);
          window.sessionStorage.removeItem("pay_success");
          setDetail({
            paid: true,
            customerName: p.customerName,
            email: p.email,
            invoiceRef: p.invoiceRef,
            amountCents: p.amountCents,
            currency: p.currency,
            method: p.method,
          });
        } else {
          setError(
            "No payment details found. Return to Pay online and try again, or contact us."
          );
        }
      } catch {
        setError("Could not read payment confirmation.");
      }
      setLoading(false);
      return;
    }

    if (!sessionId) {
      setError(
        "Missing payment confirmation. Return to Pay online and try again, or use the link from your email."
      );
      setLoading(false);
      return;
    }

    try {
      const r = await fetch(
        `/api/payments/session-status?session_id=${encodeURIComponent(sessionId)}`
      );
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setError(data.error || "Could not confirm payment.");
        setLoading(false);
        return;
      }
      if (!data.paid) {
        setError(
          data.status === "unpaid"
            ? "This session is not paid yet. Complete checkout or start again."
            : "Payment is not complete yet. Refresh in a moment or contact us."
        );
        setLoading(false);
        return;
      }
      setDetail({
        paid: true,
        customerName: data.customerName,
        email: data.email,
        invoiceRef: data.invoiceRef,
        amountCents: data.amountCents,
        currency: data.currency,
        method: "card",
      });
    } catch {
      setError("Network error confirming payment.");
    } finally {
      setLoading(false);
    }
  }, [isDemo, sessionId, paymentIntentId]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="pay-page">
      <PaySiteHeader variant="success" />
      <main className="pay-main pay-success-main">
        <div className="container pay-outer">
          <div className="pay-panel pay-panel--success">
            {loading ? (
              <p className="pay-muted pay-muted--pulse">
                Confirming your payment…
              </p>
            ) : error ? (
              <div className="pay-success-state">
                <h1 className="pay-title pay-success-title">Couldn&apos;t confirm</h1>
                <p className="pay-error pay-error--block" role="alert">
                  {error}
                </p>
                <div className="pay-success-actions">
                  <Link to="/payments" className="pay-link-btn">
                    Back to pay online
                  </Link>
                  <Link to="/" className="pay-link-btn pay-link-btn-ghost">
                    Home
                  </Link>
                </div>
              </div>
            ) : detail ? (
              <div className="pay-success-state">
                <div className="pay-success-icon" aria-hidden>
                  ✓
                </div>
                <p className="pay-kicker pay-kicker--success">Payment received</p>
                <h1 className="pay-title pay-success-title">Thank you</h1>
                <p className="pay-lead pay-success-lead">
                  {detail.customerName
                    ? `${detail.customerName}, your payment went through.`
                    : "Your payment went through."}
                </p>
                <dl className="pay-receipt">
                  <div>
                    <dt>Amount</dt>
                    <dd>{formatMoney(detail.amountCents, detail.currency)}</dd>
                  </div>
                  {detail.invoiceRef ? (
                    <div>
                      <dt>Reference</dt>
                      <dd>{detail.invoiceRef}</dd>
                    </div>
                  ) : null}
                  {detail.email ? (
                    <div>
                      <dt>Email</dt>
                      <dd>{detail.email}</dd>
                    </div>
                  ) : null}
                  <div>
                    <dt>Method</dt>
                    <dd>
                      {detail.method === "demo"
                        ? "Demo (no charge)"
                        : "Card"}
                    </dd>
                  </div>
                </dl>
                <p className="pay-panel-foot pay-panel-foot--tight">
                  You may get a confirmation email if the server is configured to
                  send one. Keep this screen for your records.
                </p>
                <div className="pay-success-actions">
                  <Link to="/" className="pay-link-btn">
                    Return home
                  </Link>
                  <Link to="/payments" className="pay-link-btn pay-link-btn-ghost">
                    Pay again
                  </Link>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </main>
      <PaySiteFooter />
    </div>
  );
}
