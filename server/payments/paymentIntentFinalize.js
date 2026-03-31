import crypto from "crypto";
import { markInvoicePaidById } from "../invoiceOps.js";
import { upsertPaymentByPaymentIntent } from "./store.js";
import { paymentRecordFromPaymentIntent } from "./paymentIntentRecord.js";

/**
 * Idempotent: if PI is succeeded, persist payment + mark invoice paid.
 * @param {import("stripe").Stripe} stripe
 * @param {string} piId
 */
export async function finalizePaymentIntentIfSucceeded(stripe, piId) {
  const pi = await stripe.paymentIntents.retrieve(piId);
  if (pi.status !== "succeeded") {
    return {
      paid: false,
      status: pi.status,
    };
  }
  const base = paymentRecordFromPaymentIntent(pi);
  await upsertPaymentByPaymentIntent(piId, {
    ...base,
    id: crypto.randomUUID(),
  });
  if (base.invoiceId) {
    await markInvoicePaidById(base.invoiceId);
  }
  return {
    paid: true,
    customerName: base.customerName,
    email: base.email,
    invoiceRef: base.invoiceRef,
    invoiceId: base.invoiceId,
    amountCents: base.amountCents,
    currency: base.currency,
    method: "card",
  };
}
