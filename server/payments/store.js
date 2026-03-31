import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getSupabaseAdminClient } from "../supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PAYMENTS_PATH = path.join(__dirname, "..", "payments.json");
const PAYMENTS_TABLE = "payments";

function rowToPayment(row) {
  if (!row || typeof row !== "object") return null;
  if (row.data && typeof row.data === "object") return row.data;
  return null;
}

export async function readPayments() {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(PAYMENTS_TABLE)
        .select("data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (Array.isArray(data) ? data : [])
        .map(rowToPayment)
        .filter((x) => x && typeof x === "object");
    } catch (e) {
      console.warn("Supabase read payments failed, falling back to file:", e?.message || e);
    }
  }
  try {
    const raw = await fs.readFile(PAYMENTS_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writePayments(list) {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const safe = (Array.isArray(list) ? list : []).filter(
        (x) => x && typeof x === "object" && String(x.id || "").trim()
      );
      const ids = safe.map((row) => String(row.id).trim());
      const upserts = safe.map((row) => ({
        id: String(row.id).trim(),
        stripe_session_id: String(row.stripeSessionId || "").trim() || null,
        stripe_payment_intent_id:
          String(row.stripePaymentIntentId || "").trim() || null,
        data: row,
        created_at: row.createdAt || new Date().toISOString(),
      }));
      if (upserts.length) {
        const { error: upsertErr } = await supabase
          .from(PAYMENTS_TABLE)
          .upsert(upserts, { onConflict: "id" });
        if (upsertErr) throw upsertErr;
      }
      if (ids.length) {
        const { error: delErr } = await supabase
          .from(PAYMENTS_TABLE)
          .delete()
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
        if (delErr) throw delErr;
      } else {
        const { error: truncateErr } = await supabase.from(PAYMENTS_TABLE).delete().neq("id", "");
        if (truncateErr) throw truncateErr;
      }
      return;
    } catch (e) {
      console.warn("Supabase write payments failed, falling back to file:", e?.message || e);
    }
  }
  const tmp = `${PAYMENTS_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, PAYMENTS_PATH);
}

/**
 * Merge by Stripe Checkout session id so webhooks and success-page verify stay idempotent.
 */
export async function upsertPaymentByStripeSession(sessionId, fields) {
  if (!sessionId) return;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const payload = {
      ...fields,
      id:
        fields.id && String(fields.id).length
          ? String(fields.id)
          : crypto.randomUUID(),
      stripeSessionId: sessionId,
    };
    try {
      const { error } = await supabase.from(PAYMENTS_TABLE).upsert(
        {
          id: payload.id,
          stripe_session_id: sessionId,
          stripe_payment_intent_id:
            String(payload.stripePaymentIntentId || "").trim() || null,
          data: payload,
          created_at: payload.createdAt || new Date().toISOString(),
        },
        { onConflict: "stripe_session_id" }
      );
      if (!error) return;
      throw error;
    } catch (e) {
      console.warn("Supabase upsert by session failed, falling back to file:", e?.message || e);
    }
  }
  const list = await readPayments();
  const idx = list.findIndex((p) => p && p.stripeSessionId === sessionId);
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...prev,
      ...fields,
      id: prev.id,
      stripeSessionId: sessionId,
    };
  } else {
    const id =
      fields.id && String(fields.id).length ? String(fields.id) : crypto.randomUUID();
    list.unshift({
      ...fields,
      id,
      stripeSessionId: sessionId,
    });
  }
  await writePayments(list);
}

export async function appendPayment(payment) {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const id =
      payment?.id && String(payment.id).length
        ? String(payment.id)
        : crypto.randomUUID();
    const payload = { ...payment, id };
    try {
      const { error } = await supabase.from(PAYMENTS_TABLE).insert({
        id,
        stripe_session_id: String(payload.stripeSessionId || "").trim() || null,
        stripe_payment_intent_id:
          String(payload.stripePaymentIntentId || "").trim() || null,
        data: payload,
        created_at: payload.createdAt || new Date().toISOString(),
      });
      if (!error) return;
      throw error;
    } catch (e) {
      console.warn("Supabase append payment failed, falling back to file:", e?.message || e);
    }
  }
  const list = await readPayments();
  list.unshift(payment);
  await writePayments(list);
}

/**
 * Merge by Stripe PaymentIntent id (Elements flow) — idempotent with webhooks.
 */
export async function upsertPaymentByPaymentIntent(paymentIntentId, fields) {
  if (!paymentIntentId) return;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    const payload = {
      ...fields,
      id:
        fields.id && String(fields.id).length
          ? String(fields.id)
          : crypto.randomUUID(),
      stripePaymentIntentId: paymentIntentId,
    };
    try {
      const { error } = await supabase.from(PAYMENTS_TABLE).upsert(
        {
          id: payload.id,
          stripe_session_id: String(payload.stripeSessionId || "").trim() || null,
          stripe_payment_intent_id: paymentIntentId,
          data: payload,
          created_at: payload.createdAt || new Date().toISOString(),
        },
        { onConflict: "stripe_payment_intent_id" }
      );
      if (!error) return;
      throw error;
    } catch (e) {
      console.warn(
        "Supabase upsert by payment intent failed, falling back to file:",
        e?.message || e
      );
    }
  }
  const list = await readPayments();
  const idx = list.findIndex(
    (p) => p && String(p.stripePaymentIntentId) === String(paymentIntentId)
  );
  if (idx >= 0) {
    const prev = list[idx];
    list[idx] = {
      ...prev,
      ...fields,
      id: prev.id,
      stripePaymentIntentId: paymentIntentId,
    };
  } else {
    const id =
      fields.id && String(fields.id).length ? String(fields.id) : crypto.randomUUID();
    list.unshift({
      ...fields,
      id,
      stripePaymentIntentId: paymentIntentId,
    });
  }
  await writePayments(list);
}
