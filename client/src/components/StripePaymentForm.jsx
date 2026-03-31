import { useState } from "react";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";

/**
 * In-page Stripe Elements form (PaymentIntent). Card data goes to Stripe only.
 */
export default function StripePaymentForm({ disabled }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true);
    setErr("");
    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/payments/success`,
      },
      redirect: "if_required",
    });
    if (error) {
      setErr(error.message);
      setBusy(false);
      return;
    }
    if (paymentIntent?.status === "succeeded") {
      const r = await fetch("/api/payments/confirm-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIntentId: paymentIntent.id }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setErr(d.error || "Could not finalize payment.");
        setBusy(false);
        return;
      }
      window.sessionStorage.setItem(
        "pay_success",
        JSON.stringify({
          customerName: d.customerName,
          email: d.email,
          invoiceRef: d.invoiceRef,
          amountCents: d.amountCents,
          currency: d.currency || "USD",
          method: "card",
        })
      );
      window.location.assign("/payments/success?demo=1");
      return;
    }
    setBusy(false);
  }

  return (
    <form onSubmit={handleSubmit} className="pay-form pay-form--stripe">
      <div className="pay-stripe-element-wrap">
        <PaymentElement />
      </div>
      {err ? (
        <p className="pay-error" role="alert">
          {err}
        </p>
      ) : null}
      <button
        type="submit"
        className="pay-submit"
        disabled={!stripe || busy || disabled}
      >
        {busy ? "Processing…" : "Pay now"}
      </button>
    </form>
  );
}
