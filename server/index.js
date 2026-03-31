import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { handleStripeWebhook } from "./payments/stripeWebhook.js";
import { registerPaymentRoutes } from "./payments/routes.js";
import {
  computeInvoiceTotalCents,
  findDuplicateInvoiceByNumber,
  findInvoiceByNumber,
  invoicePaymentStatus,
  readInvoices,
  writeInvoices,
} from "./invoiceOps.js";
import {
  buildVCard,
  isReasonablePhone,
  isValidEmail,
  publicContactsPayload,
  readContacts,
  sanitizeContactsInput,
  validateContactsForSave,
  writeContacts,
} from "./contactSettings.js";
import {
  createMessage,
  deleteMessageById,
  readMessages,
  readQuoteRequests,
} from "./messageOps.js";
import { getSupabaseAdminClient, isSupabaseEnabled } from "./supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// override: true so values in .env always win over empty/wrong shell variables
dotenv.config({ path: ENV_PATH, override: true });

const MESSAGE_SUBJECTS = new Set([
  "general",
  "quote",
  "support",
  "partnership",
  "feedback",
]);

const QUOTE_SERVICE_TYPES = new Set([
  "residential",
  "commercial",
  "repair",
  "other",
]);

const messageRate = new Map();
const invoiceLookupRate = new Map();

function clientIp(req) {
  const x = req.headers["x-forwarded-for"];
  if (typeof x === "string" && x.trim()) {
    return x.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}

function allowMessageFromIp(ip) {
  const now = Date.now();
  const windowMs = 60 * 60 * 1000;
  const max = 25;
  let r = messageRate.get(ip);
  if (!r || now > r.resetAt) {
    r = { count: 0, resetAt: now + windowMs };
  }
  r.count += 1;
  messageRate.set(ip, r);
  return r.count <= max;
}

function allowInvoiceLookupFromIp(ip) {
  const now = Date.now();
  const windowMs = 60 * 1000;
  const max = 45;
  let r = invoiceLookupRate.get(ip);
  if (!r || now > r.resetAt) {
    r = { count: 0, resetAt: now + windowMs };
  }
  r.count += 1;
  invoiceLookupRate.set(ip, r);
  return r.count <= max;
}

function notifyContactWebhook(entry) {
  const url = String(process.env.CONTACT_NOTIFY_WEBHOOK || "").trim();
  if (!url) return Promise.resolve();
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: "contact_message", message: entry }),
    signal: AbortSignal.timeout(8000),
  })
    .then((r) => {
      if (!r.ok) console.warn("CONTACT_NOTIFY_WEBHOOK status", r.status);
    })
    .catch((e) => {
      console.warn("CONTACT_NOTIFY_WEBHOOK failed:", e?.message || e);
    });
}
const ADMIN_KEY = String(
  process.env.ADMIN_KEY || process.env.ADMIN_API_KEY || "dev-admin-key-change-me"
).trim();
const SUPABASE_ADMIN_EMAILS = new Set(
  String(
    process.env.SUPABASE_ADMIN_EMAILS || process.env.ADMIN_EMAILS || ""
  )
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean)
);
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;
const HOST =
  String(process.env.API_HOST || process.env.HOST || "0.0.0.0").trim() ||
  "0.0.0.0";
const CLIENT_DIST = path.join(ROOT, "client", "dist");
const ADMIN_DIST = path.join(ROOT, "admin", "dist");
const CLIENT_INDEX = path.join(CLIENT_DIST, "index.html");
const ADMIN_INDEX = path.join(ADMIN_DIST, "index.html");

function defaultLineItem() {
  return { id: crypto.randomUUID(), description: "", quantity: 1, rate: 0 };
}

function sanitizeLineItems(raw) {
  if (!Array.isArray(raw) || raw.length === 0) return [defaultLineItem()];
  return raw.slice(0, 50).map((row) => ({
    id:
      typeof row?.id === "string" && String(row.id).trim()
        ? String(row.id).trim()
        : crypto.randomUUID(),
    description: String(row?.description ?? "").slice(0, 500),
    quantity: Math.min(99999, Math.max(0, Number(row?.quantity) || 0)),
    rate: Math.min(1e9, Math.max(0, Number(row?.rate) || 0)),
  }));
}

function buildInvoice(body, existing) {
  const now = new Date().toISOString();
  const lineItems = sanitizeLineItems(body?.lineItems);
  const id = existing?.id ?? crypto.randomUUID();
  const rawNum = String(
    body?.number ?? body?.invoiceNumber ?? existing?.number ?? ""
  )
    .trim()
    .slice(0, 80);
  const num =
    rawNum ||
    `INV-${now.slice(0, 10)}-${id.slice(0, 8).toUpperCase()}`;
  return {
    id,
    number: num,
    issueDate:
      String(body?.issueDate ?? existing?.issueDate ?? "").slice(0, 32) ||
      now.slice(0, 10),
    dueDate: String(body?.dueDate ?? existing?.dueDate ?? "").slice(0, 32),
    fromName: String(
      body?.fromName ?? existing?.fromName ?? "Ryzhkov ClearView Windows"
    ).slice(0, 200),
    fromAddress: String(
      body?.fromAddress ??
        existing?.fromAddress ??
        "Tulsa metro · Broken Arrow · Coweta\nNortheast Oklahoma"
    ).slice(0, 500),
    fromPhone: String(
      body?.fromPhone ?? existing?.fromPhone ?? "(918) 555-0100"
    ).slice(0, 80),
    fromEmail: String(
      body?.fromEmail ??
        existing?.fromEmail ??
        "hello@ryzhkovclearviewwindows.com"
    ).slice(0, 200),
    clientName: String(body?.clientName ?? existing?.clientName ?? "").slice(
      0,
      200
    ),
    clientAddress: String(
      body?.clientAddress ?? existing?.clientAddress ?? ""
    ).slice(0, 500),
    clientEmail: String(body?.clientEmail ?? existing?.clientEmail ?? "").slice(
      0,
      200
    ),
    lineItems,
    taxPercent: Math.min(
      100,
      Math.max(0, Number(body?.taxPercent ?? existing?.taxPercent ?? 8.25) || 0)
    ),
    notes: String(body?.notes ?? existing?.notes ?? "").slice(0, 2000),
    paymentBank: String(
      body?.paymentBank ?? existing?.paymentBank ?? ""
    ).slice(0, 200),
    paymentAccount: String(
      body?.paymentAccount ?? existing?.paymentAccount ?? ""
    ).slice(0, 200),
    paymentPhone: String(
      body?.paymentPhone ?? existing?.paymentPhone ?? ""
    ).slice(0, 80),
    signatureDataUrl: String(
      body?.signatureDataUrl ?? existing?.signatureDataUrl ?? ""
    ).slice(0, 240000),
    signedAt: String(body?.signedAt ?? existing?.signedAt ?? "").slice(0, 40),
    paymentStatus: (() => {
      if (existing?.paymentStatus === "paid") return "paid";
      if (existing?.paymentStatus === "pending") return "pending";
      return "unpaid";
    })(),
    paidAt:
      existing?.paymentStatus === "paid"
        ? String(existing?.paidAt ?? "").slice(0, 40)
        : "",
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

function validateInvoiceBodyFields(body) {
  if (!String(body?.number ?? body?.invoiceNumber ?? "").trim()) {
    return "Invoice number is required.";
  }
  if (!String(body?.clientName ?? "").trim()) {
    return "Customer name is required.";
  }
  const lines = body?.lineItems;
  if (!Array.isArray(lines) || lines.length === 0) {
    return "Add at least one line item.";
  }
  let hasValidLine = false;
  for (const row of lines) {
    const desc = String(row?.description ?? "").trim();
    const qty = Number(row?.quantity) || 0;
    const rate = Number(row?.rate) || 0;
    if (desc && qty > 0 && rate > 0) {
      hasValidLine = true;
      break;
    }
  }
  if (!hasValidLine) {
    return "Add at least one line item with a description, quantity, and price greater than zero.";
  }
  return null;
}

function validateInvoiceTotals(inv) {
  const { totalCents } = computeInvoiceTotalCents(inv);
  if (totalCents >= 1) return null;
  if (!inv?.lineItems?.length) {
    return "Invoice total must be greater than zero.";
  }
  const subtotal = inv.lineItems.reduce(
    (s, r) => s + (Number(r.quantity) || 0) * (Number(r.rate) || 0),
    0
  );
  const tax = (subtotal * (Number(inv.taxPercent) || 0)) / 100;
  const totalDollars = subtotal + tax;
  if (totalDollars > 0) return null;
  return "Invoice total must be greater than zero.";
}

const app = express();
// Chrome “Private Network Access” preflight (e.g. localhost → 127.0.0.1) requires this on the response.
app.use((req, res, next) => {
  if (req.headers["access-control-request-private-network"] === "true") {
    res.setHeader("Access-Control-Allow-Private-Network", "true");
  }
  next();
});
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Admin-Key", "Authorization"],
    exposedHeaders: ["Content-Type"],
  })
);

app.post(
  "/api/stripe/webhook",
  express.raw({ type: "application/json", limit: "1mb" }),
  handleStripeWebhook
);

app.use(express.json({ limit: "1.5mb" }));

app.get("/api/contacts/vcard", async (_req, res) => {
  try {
    const c = await readContacts();
    const raw = buildVCard(c);
    const safeName = String(c.businessName || "contact")
      .replace(/[^\w\-]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 60) || "contact";
    res.setHeader("Content-Type", "text/vcard; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${safeName}-contact.vcf"`
    );
    res.send(Buffer.from(raw, "utf8"));
  } catch (e) {
    console.warn("vcard:", e?.message || e);
    res.status(500).json({ error: "Could not build contact card." });
  }
});

app.get("/api/contacts", async (_req, res) => {
  const c = await readContacts();
  res.json(publicContactsPayload(c));
});

app.post("/api/messages", async (req, res) => {
  const ip = clientIp(req);
  if (!allowMessageFromIp(ip)) {
    return res
      .status(429)
      .json({ error: "Too many messages from this address. Try again later." });
  }

  const body = req.body || {};
  if (typeof body.website === "string" && body.website.trim()) {
    return res.status(201).json({ ok: true, id: crypto.randomUUID() });
  }

  const {
    name,
    email,
    phone,
    type,
    message,
    subject,
    serviceType,
    projectDetails,
    budgetRange,
  } = body;

  const n = typeof name === "string" ? name.trim() : "";
  const em = typeof email === "string" ? email.trim() : "";
  const msg = typeof message === "string" ? message.trim() : "";

  if (!n || !em) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  if (!isValidEmail(em)) {
    return res.status(400).json({ error: "Invalid email format." });
  }
  if (!msg) {
    return res.status(400).json({ error: "Message is required." });
  }

  let subj =
    typeof subject === "string" ? subject.trim().toLowerCase() : "";
  if (!subj || !MESSAGE_SUBJECTS.has(subj)) {
    subj = "general";
  }

  const phoneSan =
    typeof phone === "string" ? phone.trim().slice(0, 50) : "";
  if (phoneSan && !isReasonablePhone(phoneSan)) {
    return res
      .status(400)
      .json({ error: "Phone number must include 10–15 digits." });
  }

  let st =
    typeof serviceType === "string" ? serviceType.trim().toLowerCase() : "";
  if (subj !== "quote") {
    st = "";
  } else if (st && !QUOTE_SERVICE_TYPES.has(st)) {
    return res.status(400).json({ error: "Invalid service type." });
  }

  const proj =
    subj === "quote" && typeof projectDetails === "string"
      ? projectDetails.trim().slice(0, 2000)
      : "";
  const budget =
    subj === "quote" && typeof budgetRange === "string"
      ? budgetRange.trim().slice(0, 120)
      : "";

  const typeLegacy =
    typeof type === "string" ? type.trim().slice(0, 50) : "";

  const entry = {
    id: crypto.randomUUID(),
    name: n.slice(0, 200),
    email: em.slice(0, 320),
    phone: phoneSan,
    type: typeLegacy,
    subject: subj,
    serviceType: st,
    projectDetails: proj,
    budgetRange: budget,
    message: msg.slice(0, 5000),
    createdAt: new Date().toISOString(),
  };
  await createMessage(entry);
  void notifyContactWebhook(entry);
  res.status(201).json({ ok: true, id: entry.id });
});

function getKeyFromRequest(req) {
  const headerKey = req.headers["x-admin-key"];
  if (typeof headerKey === "string" && headerKey.trim()) {
    return headerKey.trim();
  }
  const auth = req.headers["authorization"];
  if (typeof auth === "string" && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7).trim();
  }
  return "";
}

function hasSupabaseAdminRole(user) {
  const roleCandidates = [
    user?.app_metadata?.role,
    user?.app_metadata?.user_role,
    user?.user_metadata?.role,
    user?.user_metadata?.user_role,
  ];
  const roleCollections = [user?.app_metadata?.roles, user?.user_metadata?.roles];
  const flagCandidates = [
    user?.app_metadata?.is_admin,
    user?.app_metadata?.admin,
    user?.user_metadata?.is_admin,
    user?.user_metadata?.admin,
  ];

  const isAdminRole = (raw) => {
    const role = String(raw || "").trim().toLowerCase();
    return role === "admin" || role === "owner" || role === "super_admin";
  };
  const isTruthyAdminFlag = (raw) => {
    if (raw === true) return true;
    const value = String(raw || "")
      .trim()
      .toLowerCase();
    return value === "1" || value === "true" || value === "yes";
  };

  if (roleCandidates.some(isAdminRole)) return true;
  if (
    roleCollections.some(
      (items) => Array.isArray(items) && items.some((entry) => isAdminRole(entry))
    )
  ) {
    return true;
  }
  return flagCandidates.some(isTruthyAdminFlag);
}

function isSupabaseAdminUser(user) {
  const email = String(user?.email || "").trim().toLowerCase();
  if (email && SUPABASE_ADMIN_EMAILS.has(email)) return true;
  if (hasSupabaseAdminRole(user)) return true;
  // Dev-friendly fallback: if no explicit allowlist is configured and token is valid,
  // treat authenticated Supabase users as admins.
  return SUPABASE_ADMIN_EMAILS.size === 0;
}

async function requireAdmin(req, res, next) {
  const key = getKeyFromRequest(req);
  if (!key) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (isSupabaseEnabled()) {
    try {
      const supabase = getSupabaseAdminClient();
      const { data, error } = await supabase.auth.getUser(key);
      if (error || !data?.user) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      if (!isSupabaseAdminUser(data.user)) {
        return res.status(403).json({ error: "Forbidden" });
      }
      req.adminUser = {
        id: String(data.user.id || ""),
        email: String(data.user.email || "").trim().toLowerCase(),
      };
      return next();
    } catch {
      return res.status(401).json({ error: "Unauthorized" });
    }
  }

  if (key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

registerPaymentRoutes(app, { requireAdmin });

/** Quick check that this server build includes public Pay-online routes (open in browser). */
app.get("/api/public/health", (_req, res) => {
  res.json({
    ok: true,
    invoiceLookup:
      "POST /api/public/invoices/lookup JSON { invoiceNumber: string }",
  });
});

app.post("/api/public/invoices/lookup", async (req, res) => {
  const ip = clientIp(req);
  if (!allowInvoiceLookupFromIp(ip)) {
    return res
      .status(429)
      .json({ error: "Too many attempts. Try again shortly." });
  }
  const rawNum = String(req.body?.invoiceNumber ?? "").trim();
  if (!rawNum || rawNum.length > 120) {
    return res.status(400).json({ error: "Enter a valid invoice number." });
  }
  const inv = await findInvoiceByNumber(rawNum);
  if (!inv) {
    return res.status(404).json({ error: "Invoice not found" });
  }
  const { totalCents } = computeInvoiceTotalCents(inv);
  const payState = invoicePaymentStatus(inv);
  const paid = payState === "paid";
  const paymentPending = payState === "pending";
  res.json({
    ok: true,
    invoice: inv,
    invoiceId: inv.id,
    number: inv.number,
    totalCents,
    currency: "USD",
    paid,
    paymentPending,
    payableOnline: totalCents >= 50 && !paid,
  });
});

app.get("/api/admin/ping", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.put("/api/admin/contacts", requireAdmin, async (req, res) => {
  const next = sanitizeContactsInput(req.body);
  const errors = validateContactsForSave(next);
  if (errors.length) {
    return res.status(400).json({ error: errors.join(" ") });
  }
  await writeContacts(next);
  res.json({ ok: true, contacts: publicContactsPayload(next) });
});

app.get("/api/admin/contacts", requireAdmin, async (_req, res) => {
  const c = await readContacts();
  res.json({ contacts: publicContactsPayload(c) });
});

app.get("/api/messages", requireAdmin, async (_req, res) => {
  const messages = await readMessages();
  res.json({ messages });
});

app.get("/api/admin/quote-requests", requireAdmin, async (_req, res) => {
  const quoteRequests = await readQuoteRequests();
  res.json({ quoteRequests });
});

app.get("/api/invoices", requireAdmin, async (_req, res) => {
  const invoices = await readInvoices();
  invoices.sort(
    (a, b) =>
      new Date(b.updatedAt || 0).getTime() -
      new Date(a.updatedAt || 0).getTime()
  );
  res.json({ invoices });
});

app.post("/api/invoices", requireAdmin, async (req, res) => {
  try {
    const body = req.body || {};
    const fieldErr = validateInvoiceBodyFields(body);
    if (fieldErr) {
      return res.status(400).json({ error: fieldErr });
    }
    const normalizedNumber = String(
      body.number ?? body.invoiceNumber ?? ""
    )
      .trim()
      .slice(0, 80);
    const list = await readInvoices();
    const inv = buildInvoice({ ...body, number: normalizedNumber }, null);
    const totalErr = validateInvoiceTotals(inv);
    if (totalErr) {
      return res.status(400).json({ error: totalErr });
    }
    if (findDuplicateInvoiceByNumber(list, inv.number, inv.id)) {
      return res.status(409).json({
        error:
          "An invoice with this number already exists. Enter a unique invoice number.",
      });
    }
    list.unshift(inv);
    await writeInvoices(list);
    res.status(201).json({ ok: true, invoice: inv });
  } catch (e) {
    console.warn("POST /api/invoices:", e?.message || e);
    res.status(500).json({ error: "Could not save invoice to storage." });
  }
});

app.put("/api/invoices/:id", requireAdmin, async (req, res) => {
  try {
    const id = String(req.params.id || "").trim();
    if (!id || id.length > 80) {
      return res.status(400).json({ error: "Invalid id." });
    }
    const list = await readInvoices();
    const idx = list.findIndex((x) => x && String(x.id) === id);
    if (idx === -1) return res.status(404).json({ error: "Invoice not found." });
    const body = req.body || {};
    const fieldErr = validateInvoiceBodyFields(body);
    if (fieldErr) {
      return res.status(400).json({ error: fieldErr });
    }
    const normalizedNumber = String(
      body.number ?? body.invoiceNumber ?? ""
    )
      .trim()
      .slice(0, 80);
    const inv = buildInvoice({ ...body, number: normalizedNumber }, list[idx]);
    const totalErr = validateInvoiceTotals(inv);
    if (totalErr) {
      return res.status(400).json({ error: totalErr });
    }
    if (findDuplicateInvoiceByNumber(list, inv.number, inv.id)) {
      return res.status(409).json({
        error:
          "An invoice with this number already exists. Enter a unique invoice number.",
      });
    }
    list[idx] = inv;
    await writeInvoices(list);
    res.json({ ok: true, invoice: inv });
  } catch (e) {
    console.warn("PUT /api/invoices:", e?.message || e);
    res.status(500).json({ error: "Could not save invoice to storage." });
  }
});

app.post("/api/invoices/delete", requireAdmin, async (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  if (!id || id.length > 80) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const list = await readInvoices();
  const next = list.filter((x) => x && String(x.id) !== id);
  if (next.length === list.length) {
    return res.status(404).json({ error: "Invoice not found." });
  }
  await writeInvoices(next);
  res.json({ ok: true });
});

/** POST avoids dev-proxy issues where DELETE sometimes never hits the API. */
app.post("/api/messages/delete", requireAdmin, async (req, res) => {
  const id = String(req.body?.id ?? "").trim();
  if (!id || id.length > 80) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const removed = await deleteMessageById(id);
  if (!removed) {
    return res.status(404).json({ error: "Message not found." });
  }
  res.json({ ok: true });
});

app.delete("/api/messages/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id || id.length > 80) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const removed = await deleteMessageById(id);
  if (!removed) {
    return res.status(404).json({ error: "Message not found." });
  }
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

const hasClientDist = existsSync(CLIENT_INDEX);
const hasAdminDist = existsSync(ADMIN_INDEX);

if (hasAdminDist) {
  app.use("/admin", express.static(ADMIN_DIST));
}
if (hasClientDist) {
  app.use(express.static(CLIENT_DIST));
}

app.use((req, res, next) => {
  if (req.method !== "GET" && req.method !== "HEAD") return next();
  if (req.path.startsWith("/api")) return next();
  if (req.path.startsWith("/admin")) {
    if (!hasAdminDist) return next();
    return res.sendFile(ADMIN_INDEX);
  }
  if (!hasClientDist) return next();
  res.sendFile(CLIENT_INDEX);
});

app.listen(PORT, HOST, () => {
  const where =
    HOST === "0.0.0.0" || HOST === "::"
      ? `http://127.0.0.1:${PORT} (all interfaces: ${HOST})`
      : `http://${HOST}:${PORT}`;
  console.log(`Server ${where}`);
  console.log(
    "Public invoice lookup: POST /api/public/invoices/lookup — restart this process after git pull if Pay online cannot find invoices."
  );
  if (hasClientDist || hasAdminDist) {
    if (hasClientDist) console.log("Public site → client/dist/");
    if (hasAdminDist) console.log("Admin app → /admin (admin/dist/)");
  } else {
    console.log(
      "No client/dist or admin/dist — run npm run build, or use Vite dev (client + admin)."
    );
  }
  if (existsSync(ENV_PATH)) {
    console.log(".env found — environment loaded from file (shell vars overridden).");
  } else {
    console.log(`No file at ${ENV_PATH} — using process environment values.`);
  }
  if (isSupabaseEnabled()) {
    if (SUPABASE_ADMIN_EMAILS.size > 0) {
      console.log(
        `Admin auth: Supabase token + email allowlist OR role metadata (${SUPABASE_ADMIN_EMAILS.size} allowlisted account${SUPABASE_ADMIN_EMAILS.size === 1 ? "" : "s"}).`
      );
    } else {
      console.log(
        "Admin auth: Supabase token accepted (role metadata/flags optional when no allowlist is set)."
      );
    }
  } else {
    console.log("Admin auth: ADMIN_KEY fallback (Supabase not configured).");
  }
});
