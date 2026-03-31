import Stripe from "stripe";
import crypto from "crypto";
import { markInvoicePaidById } from "../invoiceOps.js";
import { upsertPaymentByStripeSession } from "./store.js";
import { paymentRecordFromCheckoutSession } from "./stripeSessionPayment.js";
import { finalizePaymentIntentIfSucceeded } from "./paymentIntentFinalize.js";

function getStripe() {
  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!sk) return null;
  return new Stripe(sk);
}

export async function handleStripeWebhook(req, res) {
  const stripe = getStripe();
  const whSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
  if (!stripe || !whSecret) {
    return res.status(503).json({ error: "Stripe webhook not configured" });
  }
  const sig = req.headers["stripe-signature"];
  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, whSecret);
  } catch (err) {
    console.warn("Stripe webhook signature failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    const base = paymentRecordFromCheckoutSession(session);
    await upsertPaymentByStripeSession(session.id, {
      ...base,
      id: crypto.randomUUID(),
    });
    if (base.invoiceId) {
      await markInvoicePaidById(base.invoiceId);
    }
  }

  if (event.type === "payment_intent.succeeded") {
    const pi = event.data.object;
    try {
      await finalizePaymentIntentIfSucceeded(stripe, pi.id);
    } catch (e) {
      console.warn("payment_intent.succeeded finalize:", e?.message || e);
    }
  }

  res.json({ received: true });
}
