/**
 * Normalizes a Stripe Checkout Session into our persisted payment shape.
 */
export function paymentRecordFromCheckoutSession(session) {
  const meta = session.metadata || {};
  const invoiceId = String(meta.invoiceId || "").trim().slice(0, 80);
  return {
    customerName: String(meta.customerName || "").slice(0, 200) || "Customer",
    email: String(meta.customerEmail || "").slice(0, 320),
    invoiceRef: String(meta.invoiceRef || "").slice(0, 120),
    invoiceId: invoiceId || undefined,
    billingZip: String(meta.billingZip || "").slice(0, 20),
    amountCents: session.amount_total || 0,
    currency: (session.currency || "usd").toUpperCase(),
    method: "card",
    status: "successful",
    createdAt: new Date((session.created || Date.now() / 1000) * 1000).toISOString(),
    stripeSessionId: session.id,
    stripePaymentIntentId:
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id || "",
  };
}
