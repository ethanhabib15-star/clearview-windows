import Stripe from "stripe";
import crypto from "crypto";
import {
  computeInvoiceTotalCents,
  findInvoiceById,
  markInvoicePaidById,
  markInvoicePaymentPending,
  clearInvoicePaymentPending,
} from "../invoiceOps.js";
import {
  appendPayment,
  readPayments,
  upsertPaymentByStripeSession,
} from "./store.js";
import { finalizePaymentIntentIfSucceeded } from "./paymentIntentFinalize.js";
import {
  isPayoutKeyConfigured,
  readPayoutSettings,
  writePayoutSettings,
} from "./payoutVault.js";
import {
  isValidAccountNumber,
  isValidUsRoutingNumber,
  sanitizePayoutPayload,
} from "./validation.js";
import { paymentRecordFromCheckoutSession } from "./stripeSessionPayment.js";

function getStripe() {
  const sk = process.env.STRIPE_SECRET_KEY?.trim();
  if (!sk) return null;
  return new Stripe(sk);
}

/** Publishable key: prefer Stripe’s name; STRIPE_PUBLIC_KEY is an accepted alias. */
function getStripePublishableKey() {
  return (
    process.env.STRIPE_PUBLISHABLE_KEY?.trim() ||
    process.env.STRIPE_PUBLIC_KEY?.trim() ||
    ""
  );
}

function getAppBaseUrl() {
  const u = String(
    process.env.APP_BASE_URL || process.env.PUBLIC_APP_URL || ""
  )
    .trim()
    .replace(/\/$/, "");
  return u || "http://localhost:5173";
}

function demoPaymentsAllowed() {
  return String(process.env.ALLOW_DEMO_PAYMENTS || "").toLowerCase() === "true";
}

function sanitizeBillingZip(raw) {
  const s = String(raw ?? "")
    .trim()
    .replace(/[^\d-]/g, "")
    .slice(0, 10);
  if (!s) return "";
  if (/^\d{5}(-\d{4})?$/.test(s)) return s;
  if (/^\d{5}$/.test(s)) return s;
  return "";
}

function sanitizeInvoiceCheckout(body) {
  const invoiceId = String(body?.invoiceId ?? "").trim().slice(0, 80);
  const customerName = String(body?.customerName ?? "")
    .trim()
    .slice(0, 200);
  const email = String(body?.email ?? "").trim().slice(0, 320);
  const billingZipRaw = String(body?.billingZip ?? "").trim().slice(0, 20);
  const billingZip = sanitizeBillingZip(billingZipRaw);
  if (!invoiceId) {
    return { error: "Invoice is required. Look up your invoice number first." };
  }
  if (!customerName) {
    return { error: "Full name is required." };
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "A valid email address is required." };
  }
  if (billingZipRaw && !billingZip) {
    return { error: "Enter a valid US ZIP code (5 digits or ZIP+4)." };
  }
  return { invoiceId, customerName, email, billingZip };
}

async function resolveInvoiceForPayment(invoiceId) {
  const inv = await findInvoiceById(invoiceId);
  if (!inv) {
    return { error: "Invoice not found." };
  }
  if (inv.paymentStatus === "paid") {
    return { error: "This invoice is already paid." };
  }
  const { totalCents } = computeInvoiceTotalCents(inv);
  if (totalCents < 50) {
    return {
      error:
        "This invoice total is below the minimum for online card payment. Contact us to pay another way.",
    };
  }
  if (totalCents > 10_000_000) {
    return { error: "Invoice total is too large for online checkout." };
  }
  return { invoice: inv, amountCents: totalCents };
}

async function finalizeSuccessfulPayment(record) {
  const id = record?.invoiceId;
  if (id) {
    await markInvoicePaidById(id);
  }
}

/**
 * @param {import('express').Express} app
 * @param {{ requireAdmin: import('express').RequestHandler }} opts
 */
export function registerPaymentRoutes(app, { requireAdmin }) {
  app.get("/api/payments/config", (_req, res) => {
    const pk = getStripePublishableKey();
    const stripeEnabled = Boolean(getStripe() && pk);
    res.json({
      stripeEnabled,
      publishableKey: stripeEnabled ? pk : null,
      demoEnabled: demoPaymentsAllowed(),
    });
  });

  app.post("/api/payments/create-checkout-session", async (req, res) => {
    const form = sanitizeInvoiceCheckout(req.body || {});
    if (form.error) return res.status(400).json({ error: form.error });
    const resolved = await resolveInvoiceForPayment(form.invoiceId);
    if (resolved.error) {
      const code =
        resolved.error === "Invoice not found."
          ? 404
          : resolved.error.includes("already paid")
            ? 409
            : 400;
      return res.status(code).json({ error: resolved.error });
    }
    const { invoice, amountCents } = resolved;
    const invoiceRef = String(invoice.number || "").slice(0, 120);

    const stripe = getStripe();
    const baseUrl = getAppBaseUrl();

    if (stripe) {
      try {
        await markInvoicePaymentPending(String(invoice.id));
        const session = await stripe.checkout.sessions.create({
          mode: "payment",
          payment_method_types: ["card"],
          customer_email: form.email || undefined,
          line_items: [
            {
              price_data: {
                currency: "usd",
                product_data: {
                  name: `Invoice ${invoiceRef || invoice.id}`,
                  description: `Payment for invoice ${invoiceRef || invoice.id}`.slice(
                    0,
                    500
                  ),
                },
                unit_amount: amountCents,
              },
              quantity: 1,
            },
          ],
          metadata: {
            customerName: form.customerName,
            customerEmail: form.email,
            invoiceRef,
            invoiceId: String(invoice.id),
            billingZip: form.billingZip || "",
          },
          success_url: `${baseUrl}/payments/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${baseUrl}/payments?canceled=1`,
        });
        return res.json({ url: session.url, sessionId: session.id });
      } catch (e) {
        console.warn("Stripe checkout error:", e.message);
        await clearInvoicePaymentPending(String(invoice.id));
        return res.status(502).json({
          error:
            "Could not start checkout. Check Stripe keys and try again, or contact us.",
        });
      }
    }

    if (demoPaymentsAllowed()) {
      return res.json({
        demo: true,
        message:
          "Stripe is not configured; demo mode will record a test payment without charging a card.",
      });
    }

    return res.status(503).json({
      error:
        "Online card payments are not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY, or enable ALLOW_DEMO_PAYMENTS=true for local testing.",
    });
  });

  /**
   * Stripe Elements: create PaymentIntent and return client_secret.
   * POST body matches create-checkout-session: invoiceId, customerName, email, billingZip.
   */
  app.post("/api/payments/create-intent", async (req, res) => {
    const form = sanitizeInvoiceCheckout(req.body || {});
    if (form.error) return res.status(400).json({ error: form.error });
    const resolved = await resolveInvoiceForPayment(form.invoiceId);
    if (resolved.error) {
      const code =
        resolved.error === "Invoice not found."
          ? 404
          : resolved.error.includes("already paid")
            ? 409
            : 400;
      return res.status(code).json({ error: resolved.error });
    }
    const { invoice, amountCents } = resolved;
    const invoiceRef = String(invoice.number || "").slice(0, 120);
    const stripe = getStripe();
    const pk = getStripePublishableKey();
    if (!stripe || !pk) {
      return res.status(503).json({
        error:
          "Stripe is not configured. Set STRIPE_SECRET_KEY and STRIPE_PUBLISHABLE_KEY (or STRIPE_PUBLIC_KEY) in .env and restart the API.",
      });
    }
    try {
      await markInvoicePaymentPending(String(invoice.id));
      const pi = await stripe.paymentIntents.create({
        amount: amountCents,
        currency: "usd",
        payment_method_types: ["card"],
        metadata: {
          customerName: form.customerName,
          customerEmail: form.email,
          invoiceRef,
          invoiceId: String(invoice.id),
          billingZip: form.billingZip || "",
        },
        receipt_email: form.email || undefined,
        description: `Invoice ${invoiceRef || invoice.id}`.slice(0, 500),
      });
      return res.json({
        clientSecret: pi.client_secret,
        paymentIntentId: pi.id,
      });
    } catch (e) {
      console.warn("Stripe PaymentIntent error:", e.message);
      await clearInvoicePaymentPending(String(invoice.id));
      return res.status(502).json({
        error:
          "Could not start payment. Check Stripe keys (test mode sk_test_ / pk_test_) and try again.",
      });
    }
  });

  /** After Elements confirmPayment (no redirect) — idempotent finalize. */
  app.post("/api/payments/confirm-intent", async (req, res) => {
    const piId = String(req.body?.paymentIntentId ?? "").trim();
    if (!piId) {
      return res.status(400).json({ error: "Missing paymentIntentId." });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured." });
    }
    try {
      const out = await finalizePaymentIntentIfSucceeded(stripe, piId);
      if (!out.paid) {
        return res.status(409).json({
          error: `Payment is not complete yet (${out.status}).`,
        });
      }
      return res.json({
        ok: true,
        customerName: out.customerName,
        email: out.email,
        invoiceRef: out.invoiceRef,
        amountCents: out.amountCents,
        currency: out.currency,
      });
    } catch (e) {
      console.warn("confirm-intent:", e.message);
      return res.status(502).json({ error: e.message || "Could not confirm payment." });
    }
  });

  /** After 3DS redirect to /payments/success — Stripe adds ?payment_intent=… */
  app.get("/api/payments/intent-status", async (req, res) => {
    const piId = String(
      req.query.payment_intent || req.query.payment_intent_id || ""
    ).trim();
    if (!piId) {
      return res.status(400).json({ error: "Missing payment_intent." });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured." });
    }
    try {
      const out = await finalizePaymentIntentIfSucceeded(stripe, piId);
      if (!out.paid) {
        return res.json({
          paid: false,
          status: out.status || "unknown",
        });
      }
      return res.json({
        paid: true,
        customerName: out.customerName,
        email: out.email,
        invoiceRef: out.invoiceRef,
        invoiceId: out.invoiceId,
        amountCents: out.amountCents,
        currency: out.currency,
      });
    } catch (e) {
      console.warn("intent-status:", e.message);
      return res.status(400).json({ error: "Could not verify this payment." });
    }
  });

  app.post("/api/payments/demo-complete", async (req, res) => {
    if (!demoPaymentsAllowed()) {
      return res.status(403).json({ error: "Demo payments are disabled." });
    }
    const form = sanitizeInvoiceCheckout(req.body || {});
    if (form.error) return res.status(400).json({ error: form.error });
    const resolved = await resolveInvoiceForPayment(form.invoiceId);
    if (resolved.error) {
      const code =
        resolved.error === "Invoice not found."
          ? 404
          : resolved.error.includes("already paid")
            ? 409
            : 400;
      return res.status(code).json({ error: resolved.error });
    }
    const { invoice, amountCents } = resolved;
    const invoiceRef = String(invoice.number || "").slice(0, 120);

    const now = new Date().toISOString();
    const payment = {
      id: crypto.randomUUID(),
      customerName: form.customerName,
      email: form.email,
      invoiceRef,
      invoiceId: String(invoice.id),
      billingZip: form.billingZip || "",
      amountCents,
      currency: "USD",
      method: "demo",
      status: "successful",
      createdAt: now,
    };
    await appendPayment(payment);
    await finalizeSuccessfulPayment(payment);
    res.status(201).json({
      ok: true,
      payment: {
        id: payment.id,
        customerName: payment.customerName,
        email: payment.email,
        invoiceRef: payment.invoiceRef,
        invoiceId: payment.invoiceId,
        amountCents: payment.amountCents,
        currency: payment.currency,
        method: payment.method,
        status: payment.status,
        createdAt: payment.createdAt,
      },
    });
  });

  app.get("/api/payments/session-status", async (req, res) => {
    const sessionId = String(req.query.session_id || "").trim();
    if (!sessionId) {
      return res.status(400).json({ error: "Missing session_id." });
    }
    const stripe = getStripe();
    if (!stripe) {
      return res.status(503).json({ error: "Stripe is not configured." });
    }
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.payment_status !== "paid") {
        return res.json({
          paid: false,
          status: session.payment_status || "open",
        });
      }
      const base = paymentRecordFromCheckoutSession(session);
      await upsertPaymentByStripeSession(sessionId, {
        ...base,
        id: crypto.randomUUID(),
      });
      await finalizeSuccessfulPayment(base);
      return res.json({
        paid: true,
        customerName: base.customerName,
        email: base.email,
        invoiceRef: base.invoiceRef,
        invoiceId: base.invoiceId,
        amountCents: base.amountCents,
        currency: base.currency,
      });
    } catch (e) {
      console.warn("session-status:", e.message);
      return res.status(400).json({ error: "Could not verify this payment session." });
    }
  });

  app.get("/api/admin/payments", requireAdmin, async (req, res) => {
    let rows = await readPayments();
    const q = String(req.query.q || "").trim().toLowerCase();
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    if (
      statusFilter &&
      ["successful", "pending", "failed"].includes(statusFilter)
    ) {
      rows = rows.filter((p) => p && p.status === statusFilter);
    }
    if (q) {
      rows = rows.filter((p) => {
        const hay = [
          p.customerName,
          p.email,
          p.invoiceRef,
          p.invoiceId,
          p.id,
          p.stripeSessionId,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      });
    }
    const sort = String(req.query.sort || "date").toLowerCase();
    const order = String(req.query.order || "desc").toLowerCase() === "asc" ? 1 : -1;
    rows = [...rows].sort((a, b) => {
      if (sort === "amount") {
        return order * ((a.amountCents || 0) - (b.amountCents || 0));
      }
      if (sort === "status") {
        return (
          order * String(a.status || "").localeCompare(String(b.status || ""))
        );
      }
      const ta = new Date(a.createdAt || 0).getTime();
      const tb = new Date(b.createdAt || 0).getTime();
      return order * (ta - tb);
    });
    res.json({ payments: rows });
  });

  app.get("/api/admin/payout-settings", requireAdmin, async (_req, res) => {
    if (!isPayoutKeyConfigured()) {
      return res.json({
        configured: false,
        settings: null,
        message:
          "Set PAYOUT_ENCRYPTION_KEY in .env (64-char hex or any passphrase) to store bank details encrypted on disk.",
      });
    }
    const settings = await readPayoutSettings();
    res.json({ configured: true, settings });
  });

  app.put("/api/admin/payout-settings", requireAdmin, async (req, res) => {
    if (!isPayoutKeyConfigured()) {
      return res.status(503).json({
        error:
          "PAYOUT_ENCRYPTION_KEY is not set. Banking details cannot be stored securely until it is configured.",
      });
    }
    const raw = sanitizePayoutPayload(req.body || {});
    if (!raw.accountHolderName || !raw.bankName) {
      return res.status(400).json({
        error: "Account holder name and bank name are required.",
      });
    }
    if (!isValidUsRoutingNumber(raw.routingNumber)) {
      return res.status(400).json({
        error: "Routing number must be 9 digits with a valid US ABA checksum.",
      });
    }
    if (!isValidAccountNumber(raw.accountNumber)) {
      return res.status(400).json({
        error: "Account number must be 4–17 digits.",
      });
    }
    const payload = {
      accountHolderName: raw.accountHolderName,
      bankName: raw.bankName,
      routingNumber: raw.routingNumber,
      accountNumber: raw.accountNumber,
      updatedAt: new Date().toISOString(),
    };
    try {
      await writePayoutSettings(payload);
    } catch (e) {
      console.warn("payout save:", e.message);
      return res.status(500).json({ error: "Could not save payout settings." });
    }
    res.json({ ok: true, savedAt: payload.updatedAt });
  });
}
