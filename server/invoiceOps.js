import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import { getSupabaseAdminClient } from "./supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const INVOICES_PATH = path.join(__dirname, "invoices.json");
const INVOICES_TABLE = "invoices";

function rowToInvoice(row) {
  if (!row || typeof row !== "object") return null;
  if (row.data && typeof row.data === "object") return row.data;
  return null;
}

async function readInvoicesFromSupabase(client) {
  const { data, error } = await client
    .from(INVOICES_TABLE)
    .select("data")
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (Array.isArray(data) ? data : [])
    .map(rowToInvoice)
    .filter((x) => x && typeof x === "object");
}

export async function readInvoices() {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      return await readInvoicesFromSupabase(supabase);
    } catch (e) {
      console.warn("Supabase read invoices failed, falling back to file:", e?.message || e);
    }
  }
  try {
    const raw = await fs.readFile(INVOICES_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

export async function writeInvoices(list) {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const safe = (Array.isArray(list) ? list : []).filter(
        (x) => x && typeof x === "object" && String(x.id || "").trim()
      );
      const ids = safe.map((row) => String(row.id).trim());
      const upserts = safe.map((row) => ({
        id: String(row.id).trim(),
        number: String(row.number || "").slice(0, 120),
        data: row,
        updated_at: new Date().toISOString(),
      }));
      if (upserts.length) {
        const { error: upsertErr } = await supabase
          .from(INVOICES_TABLE)
          .upsert(upserts, { onConflict: "id" });
        if (upsertErr) throw upsertErr;
      }
      if (ids.length) {
        const { error: delErr } = await supabase
          .from(INVOICES_TABLE)
          .delete()
          .not("id", "in", `(${ids.map((id) => `"${id}"`).join(",")})`);
        if (delErr) throw delErr;
      } else {
        const { error: truncateErr } = await supabase.from(INVOICES_TABLE).delete().neq("id", "");
        if (truncateErr) throw truncateErr;
      }
      return;
    } catch (e) {
      console.warn("Supabase write invoices failed, falling back to file:", e?.message || e);
    }
  }
  const payload = JSON.stringify(list, null, 2);
  const tmp = `${INVOICES_PATH}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  try {
    await fs.rename(tmp, INVOICES_PATH);
  } catch {
    // Windows often throws EPERM when replacing a file that is open/locked; direct write still works.
    await fs.writeFile(INVOICES_PATH, payload, "utf8");
    await fs.unlink(tmp).catch(() => {});
  }
}

export function normalizeInvoiceNumber(raw) {
  return String(raw ?? "")
    .trim()
    .replace(/\s+/g, "")
    .toLowerCase();
}

export function computeInvoiceTotalCents(invoice) {
  if (!invoice?.lineItems?.length) {
    return { subtotalCents: 0, taxCents: 0, totalCents: 0 };
  }
  const subtotal = invoice.lineItems.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const tax = (subtotal * (Number(invoice.taxPercent) || 0)) / 100;
  const total = subtotal + tax;
  const subtotalCents = Math.round(subtotal * 100);
  const taxCents = Math.round(tax * 100);
  const totalCents = Math.round(total * 100);
  return { subtotalCents, taxCents, totalCents };
}

export async function findInvoiceByNumber(raw) {
  const key = normalizeInvoiceNumber(raw);
  if (!key) return null;
  const list = await readInvoices();
  return (
    list.find((inv) => inv && normalizeInvoiceNumber(inv.number) === key) ||
    null
  );
}

export async function findInvoiceById(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return null;
  const list = await readInvoices();
  return list.find((inv) => inv && String(inv.id) === sid) || null;
}

/**
 * @returns {"paid" | "pending" | "unpaid"}
 */
export function invoicePaymentStatus(inv) {
  if (!inv) return "unpaid";
  if (inv.paymentStatus === "paid") return "paid";
  if (inv.paymentStatus === "pending") return "pending";
  return "unpaid";
}

/**
 * Another invoice (excluding excludeId) already uses this number (case/spacing insensitive).
 */
export function findDuplicateInvoiceByNumber(list, number, excludeId) {
  const key = normalizeInvoiceNumber(number);
  if (!key) return null;
  const ex = excludeId != null ? String(excludeId) : "";
  return (
    list.find(
      (row) =>
        row &&
        normalizeInvoiceNumber(row.number) === key &&
        String(row.id) !== ex
    ) || null
  );
}

/**
 * Mark checkout in progress (Stripe redirect). No-op if already paid.
 */
export async function markInvoicePaymentPending(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return { ok: false, reason: "missing_id" };
  const list = await readInvoices();
  const idx = list.findIndex((x) => x && String(x.id) === sid);
  if (idx === -1) return { ok: false, reason: "not_found" };
  const row = list[idx];
  if (row.paymentStatus === "paid") return { ok: true, skip: true };
  const now = new Date().toISOString();
  list[idx] = {
    ...row,
    paymentStatus: "pending",
    updatedAt: now,
  };
  await writeInvoices(list);
  return { ok: true };
}

/** If checkout session creation fails after marking pending, allow retry as unpaid. */
export async function clearInvoicePaymentPending(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return;
  const list = await readInvoices();
  const idx = list.findIndex((x) => x && String(x.id) === sid);
  if (idx === -1) return;
  const row = list[idx];
  if (row.paymentStatus !== "pending") return;
  const now = new Date().toISOString();
  list[idx] = { ...row, paymentStatus: "unpaid", updatedAt: now };
  await writeInvoices(list);
}

/**
 * Idempotent: marks invoice paid; preserves existing paid state.
 */
export async function markInvoicePaidById(id) {
  const sid = String(id ?? "").trim();
  if (!sid) return { ok: false, reason: "missing_id" };
  const list = await readInvoices();
  const idx = list.findIndex((x) => x && String(x.id) === sid);
  if (idx === -1) return { ok: false, reason: "not_found" };
  const row = list[idx];
  if (row.paymentStatus === "paid") {
    return { ok: true, already: true };
  }
  const now = new Date().toISOString();
  list[idx] = {
    ...row,
    paymentStatus: "paid",
    paidAt: row.paidAt || now,
    updatedAt: now,
  };
  await writeInvoices(list);
  return { ok: true };
}
