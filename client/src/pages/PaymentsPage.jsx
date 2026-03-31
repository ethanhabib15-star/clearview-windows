import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Elements } from "@stripe/react-stripe-js";
import { loadStripe } from "@stripe/stripe-js";
import InvoiceDocument from "@shared/invoice/InvoiceDocument.jsx";
import StripePaymentForm from "../components/StripePaymentForm.jsx";
import { PaySiteFooter, PaySiteHeader } from "../components/PaySiteChrome.jsx";
import "../App.css";
import "./PaymentsPage.css";

function formatMoneyCents(cents) {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: "USD",
    }).format((cents || 0) / 100);
  } catch {
    return `$${((cents || 0) / 100).toFixed(2)}`;
  }
}

export default function PaymentsPage() {
  const [searchParams] = useSearchParams();
  const canceled = searchParams.get("canceled") === "1";

  const [config, setConfig] = useState({
    stripeEnabled: false,
    publishableKey: null,
    demoEnabled: false,
  });
  const [configLoading, setConfigLoading] = useState(true);

  const [step, setStep] = useState(1);
  const [invoiceNumberInput, setInvoiceNumberInput] = useState("");
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState("");

  const [invoice, setInvoice] = useState(null);
  const [invoiceId, setInvoiceId] = useState("");
  const [totalCents, setTotalCents] = useState(0);
  const [invoicePaid, setInvoicePaid] = useState(false);
  const [paymentPending, setPaymentPending] = useState(false);
  const [payableOnline, setPayableOnline] = useState(false);

  const [submitError, setSubmitError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  /** Stripe Elements: billing first, then card step. */
  const [payPhase, setPayPhase] = useState("billing");
  const [clientSecret, setClientSecret] = useState(null);

  const stripePromise = useMemo(() => {
    if (!config.publishableKey) return null;
    return loadStripe(config.publishableKey);
  }, [config.publishableKey]);

  const loadConfig = useCallback(async () => {
    setConfigLoading(true);
    try {
      const r = await fetch("/api/payments/config");
      const data = await r.json().catch(() => ({}));
      setConfig({
        stripeEnabled: Boolean(data.stripeEnabled),
        publishableKey: data.publishableKey || null,
        demoEnabled: Boolean(data.demoEnabled),
      });
    } catch {
      setConfig({
        stripeEnabled: false,
        publishableKey: null,
        demoEnabled: false,
      });
    } finally {
      setConfigLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  useEffect(() => {
    if (step === 2 && config.stripeEnabled) {
      setPayPhase("billing");
      setClientSecret(null);
    }
  }, [step, invoiceId, config.stripeEnabled]);

  const canPay = config.stripeEnabled || config.demoEnabled;

  function resetToStep1() {
    setStep(1);
    setInvoice(null);
    setInvoiceId("");
    setTotalCents(0);
    setInvoicePaid(false);
    setPaymentPending(false);
    setPayableOnline(false);
    setLookupError("");
    setSubmitError("");
    setPayPhase("billing");
    setClientSecret(null);
  }

  async function handleLookupContinue(e) {
    e.preventDefault();
    setLookupError("");
    const num = invoiceNumberInput.trim();
    if (!num) {
      setLookupError("Enter your invoice number.");
      return;
    }
    setLookupLoading(true);
    try {
      const r = await fetch("/api/public/invoices/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceNumber: num }),
      });
      const data = await r.json().catch(() => ({}));
      if (r.status === 404) {
        setLookupError("Invoice not found");
        return;
      }
      if (!r.ok) {
        setLookupError(data.error || "Could not look up invoice.");
        return;
      }
      if (!data.invoice || !data.invoiceId) {
        setLookupError("Invalid response from server.");
        return;
      }
      setInvoice(data.invoice);
      setInvoiceId(String(data.invoiceId));
      setTotalCents(Number(data.totalCents) || 0);
      setInvoicePaid(Boolean(data.paid));
      setPaymentPending(Boolean(data.paymentPending));
      setPayableOnline(Boolean(data.payableOnline));
      setStep(2);
    } catch {
      setLookupError("Network error. Check your connection and try again.");
    } finally {
      setLookupLoading(false);
    }
  }

  /** Step 1 of Stripe: billing → create PaymentIntent */
  async function handleStartStripePayment(e) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const body = {
      invoiceId,
      customerName: String(fd.get("customerName") || "").trim(),
      email: String(fd.get("email") || "").trim(),
      billingZip: String(fd.get("billingZip") || "").trim(),
    };
    try {
      if (!invoiceId) {
        setSubmitError("Session expired. Look up your invoice again.");
        return;
      }
      const r = await fetch("/api/payments/create-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSubmitError(data.error || "Could not start payment.");
        return;
      }
      if (!data.clientSecret) {
        setSubmitError("Invalid response from server.");
        return;
      }
      setClientSecret(data.clientSecret);
      setPayPhase("card");
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  /** Demo-only: no Stripe keys */
  async function handleDemoPaySubmit(e) {
    e.preventDefault();
    setSubmitError("");
    setSubmitting(true);
    const form = e.currentTarget;
    const fd = new FormData(form);
    const customerName = String(fd.get("customerName") || "").trim();
    const email = String(fd.get("email") || "").trim();
    const billingZip = String(fd.get("billingZip") || "").trim();
    const body = { invoiceId, customerName, email, billingZip };
    try {
      if (!invoiceId) {
        setSubmitError("Session expired. Look up your invoice again.");
        return;
      }
      const r = await fetch("/api/payments/demo-complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        setSubmitError(data.error || "Could not record payment.");
        return;
      }
      window.sessionStorage.setItem(
        "pay_success",
        JSON.stringify(data.payment || {})
      );
      window.location.assign("/payments/success?demo=1");
    } catch {
      setSubmitError("Network error. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const defaultName = invoice?.clientName?.trim() || "";

  const elementsOptions = useMemo(() => {
    if (!clientSecret) return undefined;
    return {
      clientSecret,
      appearance: {
        theme: "night",
        variables: {
          colorPrimary: "#c62828",
          borderRadius: "6px",
        },
      },
    };
  }, [clientSecret]);

  return (
    <div className="pay-page">
      <PaySiteHeader variant="pay" />
      <main className="pay-main">
        <div
          className={`container ${step === 2 ? "pay-outer pay-outer--wide" : "pay-outer"}`}
        >
          <div className={step === 2 ? "pay-panel pay-panel--flush" : "pay-panel"}>
            <header className="pay-intro">
              <p className="pay-kicker">Secure checkout</p>
              <h1 className="pay-title">Pay online</h1>
              <p className="pay-lead">
                {step === 1
                  ? "Enter the invoice number from your statement. You can only pay invoices that exist in our system."
                  : "Review your invoice and complete payment. Amount due matches the invoice total."}
              </p>
            </header>

            <div className="pay-alerts" aria-live="polite">
              {canceled ? (
                <div className="pay-banner pay-banner-warn" role="status">
                  Checkout was canceled — you were not charged.
                  {step === 1
                    ? " Look up your invoice again when you are ready."
                    : " You can try payment again below."}
                </div>
              ) : null}

              {configLoading ? (
                <p className="pay-muted pay-muted--pulse">
                  Loading payment options…
                </p>
              ) : !canPay ? (
                <div className="pay-banner pay-banner-warn" role="alert">
                  Online payments are not set up on this server yet. Add{" "}
                  <code>STRIPE_SECRET_KEY</code> and{" "}
                  <code>STRIPE_PUBLISHABLE_KEY</code> (or <code>STRIPE_PUBLIC_KEY</code>){" "}
                  (test: <code>sk_test_…</code> / <code>pk_test_…</code>) to{" "}
                  <code>.env</code>, or set <code>ALLOW_DEMO_PAYMENTS=true</code> for
                  local demo only. Restart the API after changing{" "}
                  <code>.env</code>.
                </div>
              ) : null}

              {config.demoEnabled && !config.stripeEnabled ? (
                <div className="pay-banner pay-banner-info" role="status">
                  <strong>Demo mode.</strong> No card is charged — a test entry is
                  saved for admins only.
                </div>
              ) : null}

              {config.stripeEnabled ? (
                <div className="pay-banner pay-banner-info" role="status">
                  Secure card payment via Stripe (test mode: use card{" "}
                  <code>4242 4242 4242 4242</code>).
                </div>
              ) : null}
            </div>

            {step === 1 ? (
              <form
                className="pay-form pay-form--step1"
                onSubmit={handleLookupContinue}
                noValidate
              >
                <label className="pay-label pay-label--full pay-label--centered">
                  <span>Enter Invoice Number</span>
                  <input
                    type="text"
                    name="invoiceNumber"
                    autoComplete="off"
                    maxLength={120}
                    value={invoiceNumberInput}
                    onChange={(e) => setInvoiceNumberInput(e.target.value)}
                    placeholder="e.g. INV-2026-03-29-0D000D16"
                    disabled={lookupLoading}
                  />
                </label>
                {lookupError ? (
                  <p className="pay-error" role="alert">
                    {lookupError}
                  </p>
                ) : null}
                <button
                  type="submit"
                  className="pay-submit pay-submit--narrow"
                  disabled={lookupLoading || configLoading}
                >
                  {lookupLoading ? "Please wait…" : "Continue"}
                </button>
              </form>
            ) : (
              <div className="pay-step2">
                <div className="pay-checkout-layout">
                  <div className="pay-invoice-pane">
                    <h2 className="pay-pane-title">Invoice</h2>
                    <div id="invoice-print-root" className="pay-invoice-scroll">
                      {invoice ? <InvoiceDocument invoice={invoice} /> : null}
                    </div>
                  </div>

                  <div className="pay-payment-pane">
                    <h2 className="pay-pane-title">Payment Details</h2>

                    {invoicePaid ? (
                      <div className="pay-banner pay-banner-info" role="status">
                        This invoice has already been paid. If you believe this
                        is a mistake, contact us with your invoice number.
                      </div>
                    ) : null}

                    {!invoicePaid && paymentPending ? (
                      <div className="pay-banner pay-banner-info" role="status">
                        A payment was started for this invoice. If you did not
                        finish, you can complete it below.
                      </div>
                    ) : null}

                    {!invoicePaid && !payableOnline ? (
                      <div className="pay-banner pay-banner-warn" role="alert">
                        {totalCents < 50
                          ? "This invoice total is below the minimum for online card payment. Please contact us to pay another way."
                          : "This invoice cannot be paid online right now. Please contact us."}
                      </div>
                    ) : null}

                    <div className="pay-total-banner" aria-live="polite">
                      <span className="pay-total-label">Amount due</span>
                      <span className="pay-total-value">
                        {formatMoneyCents(totalCents)}
                      </span>
                    </div>

                    {!invoicePaid && payableOnline && config.stripeEnabled ? (
                      payPhase === "billing" ? (
                        <form
                          className="pay-form pay-form--payment"
                          onSubmit={handleStartStripePayment}
                          noValidate
                        >
                          <div className="pay-form-fields pay-form-fields--stack">
                            <label className="pay-label pay-label--full">
                              <span>Full Name</span>
                              <input
                                name="customerName"
                                type="text"
                                autoComplete="name"
                                required
                                maxLength={200}
                                placeholder="Name as it appears on the card"
                                defaultValue={defaultName}
                              />
                            </label>
                            <label className="pay-label pay-label--full">
                              <span>Email</span>
                              <input
                                name="email"
                                type="email"
                                autoComplete="email"
                                required
                                maxLength={320}
                                placeholder="For receipt"
                                defaultValue={invoice?.clientEmail?.trim() || ""}
                              />
                            </label>
                            <label className="pay-label pay-label--full">
                              <span>Billing ZIP Code</span>
                              <input
                                name="billingZip"
                                type="text"
                                autoComplete="postal-code"
                                maxLength={10}
                                placeholder="12345 or 12345-6789"
                              />
                            </label>
                          </div>
                          <p className="pay-card-hint-text pay-muted">
                            Next step: enter card details in Stripe&apos;s secure
                            form. We never store your card number on our servers.
                          </p>
                          {submitError ? (
                            <p className="pay-error" role="alert">
                              {submitError}
                            </p>
                          ) : null}
                          <button
                            type="submit"
                            className="pay-submit"
                            disabled={submitting || configLoading}
                          >
                            {submitting ? "Please wait…" : "Continue to card payment"}
                          </button>
                        </form>
                      ) : clientSecret && stripePromise && elementsOptions ? (
                        <Elements
                          stripe={stripePromise}
                          options={elementsOptions}
                        >
                          <StripePaymentForm
                            disabled={invoicePaid || !payableOnline}
                          />
                        </Elements>
                      ) : (
                        <p className="pay-muted pay-muted--pulse">
                          Loading secure card form…
                        </p>
                      )
                    ) : null}

                    {!invoicePaid &&
                    payableOnline &&
                    !config.stripeEnabled &&
                    config.demoEnabled ? (
                      <form
                        className="pay-form pay-form--payment"
                        onSubmit={handleDemoPaySubmit}
                        noValidate
                      >
                        <div className="pay-form-fields pay-form-fields--stack">
                          <label className="pay-label pay-label--full">
                            <span>Full Name</span>
                            <input
                              name="customerName"
                              type="text"
                              autoComplete="name"
                              required
                              maxLength={200}
                              placeholder="Name for the receipt"
                              defaultValue={defaultName}
                            />
                          </label>
                          <label className="pay-label pay-label--full">
                            <span>Email</span>
                            <input
                              name="email"
                              type="email"
                              autoComplete="email"
                              required
                              maxLength={320}
                              placeholder="For receipt"
                              defaultValue={invoice?.clientEmail?.trim() || ""}
                            />
                          </label>
                          <label className="pay-label pay-label--full">
                            <span>Billing ZIP Code</span>
                            <input
                              name="billingZip"
                              type="text"
                              autoComplete="postal-code"
                              maxLength={10}
                              placeholder="Optional for demo"
                            />
                          </label>
                        </div>
                        {submitError ? (
                          <p className="pay-error" role="alert">
                            {submitError}
                          </p>
                        ) : null}
                        <button
                          type="submit"
                          className="pay-submit"
                          disabled={
                            submitting || !canPay || configLoading
                          }
                        >
                          {submitting ? "Please wait…" : "Record test payment"}
                        </button>
                      </form>
                    ) : null}

                    {!invoicePaid &&
                    payableOnline &&
                    !config.stripeEnabled &&
                    !config.demoEnabled ? (
                      <p className="pay-error" role="alert">
                        Payments are not available. Configure Stripe or demo mode
                        on the server.
                      </p>
                    ) : null}

                    <button
                      type="button"
                      className="pay-back-link"
                      onClick={resetToStep1}
                    >
                      ← Different invoice
                    </button>
                  </div>
                </div>
              </div>
            )}

            {step === 1 ? (
              <footer className="pay-panel-foot">
                {config.stripeEnabled ? (
                  <p>
                    Cards are processed by Stripe. Billing details and card data
                    are handled securely; we never store full card numbers.
                  </p>
                ) : config.demoEnabled ? (
                  <p>
                    Demo payments are for testing only and do not move real
                    money.
                  </p>
                ) : (
                  <p>
                    Add Stripe keys or <code>ALLOW_DEMO_PAYMENTS=true</code> in
                    server <code>.env</code> to enable this page.
                  </p>
                )}
              </footer>
            ) : null}
          </div>
        </div>
      </main>
      <PaySiteFooter />
    </div>
  );
}
