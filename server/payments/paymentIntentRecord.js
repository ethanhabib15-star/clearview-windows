/**
 * Normalizes a Stripe PaymentIntent into our persisted payment shape.
 */
export function paymentRecordFromPaymentIntent(pi) {
  const meta = pi.metadata || {};
  const invoiceId = String(meta.invoiceId || "").trim().slice(0, 80);
  return {
    customerName: String(meta.customerName || "").slice(0, 200) || "Customer",
    email: String(meta.customerEmail || "").slice(0, 320),
    invoiceRef: String(meta.invoiceRef || "").slice(0, 120),
    invoiceId: invoiceId || undefined,
    billingZip: String(meta.billingZip || "").slice(0, 20),
    amountCents: pi.amount_received ?? pi.amount ?? 0,
    currency: (pi.currency || "usd").toUpperCase(),
    method: "card",
    status: "successful",
    createdAt: new Date().toISOString(),
    stripePaymentIntentId: pi.id,
  };
}
