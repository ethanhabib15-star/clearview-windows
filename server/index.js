import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { existsSync } from "node:fs";
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");

// override: true so values in .env always win over empty/wrong shell variables
dotenv.config({ path: ENV_PATH, override: true });

const DATA_PATH = path.join(__dirname, "messages.json");
const INVOICES_PATH = path.join(__dirname, "invoices.json");
const ADMIN_KEY = String(process.env.ADMIN_KEY || "dev-admin-key-change-me").trim();
const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;
const HOST =
  String(process.env.API_HOST || process.env.HOST || "0.0.0.0").trim() ||
  "0.0.0.0";
const DIST_DIR = path.join(ROOT, "dist");

async function writeMessages(messages) {
  const payload = JSON.stringify(messages, null, 2);
  const tmp = `${DATA_PATH}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, DATA_PATH);
}

/** Drops invalid rows and ensures every message has a stable id. */
async function readMessages() {
  try {
    const raw = await fs.readFile(DATA_PATH, "utf8");
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    const objects = data.filter((m) => m && typeof m === "object");
    let changed = objects.length !== data.length;
    const normalized = objects.map((m) => {
      if (m.id == null || String(m.id).trim() === "") {
        changed = true;
        return { ...m, id: crypto.randomUUID() };
      }
      return m;
    });
    if (changed) await writeMessages(normalized);
    return normalized;
  } catch {
    return [];
  }
}

async function writeInvoices(list) {
  const tmp = `${INVOICES_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(list, null, 2), "utf8");
  await fs.rename(tmp, INVOICES_PATH);
}

async function readInvoices() {
  try {
    const raw = await fs.readFile(INVOICES_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

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
  const num =
    String(body?.number ?? existing?.number ?? "").trim().slice(0, 80) ||
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
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };
}

const app = express();
app.use(
  cors({
    origin: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-Admin-Key", "Authorization"],
    exposedHeaders: ["Content-Type"],
  })
);
app.use(express.json({ limit: "512kb" }));

app.post("/api/messages", async (req, res) => {
  const { name, email, phone, type, message } = req.body || {};
  const n = typeof name === "string" ? name.trim() : "";
  const em = typeof email === "string" ? email.trim() : "";
  if (!n || !em) {
    return res.status(400).json({ error: "Name and email are required." });
  }
  const messages = await readMessages();
  const entry = {
    id: crypto.randomUUID(),
    name: n.slice(0, 200),
    email: em.slice(0, 320),
    phone: typeof phone === "string" ? phone.trim().slice(0, 50) : "",
    type: typeof type === "string" ? type.trim().slice(0, 50) : "",
    message: typeof message === "string" ? message.trim().slice(0, 5000) : "",
    createdAt: new Date().toISOString(),
  };
  messages.unshift(entry);
  await writeMessages(messages);
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

function requireAdmin(req, res, next) {
  const key = getKeyFromRequest(req);
  if (!key || key !== ADMIN_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.get("/api/admin/ping", requireAdmin, (_req, res) => {
  res.json({ ok: true });
});

app.get("/api/messages", requireAdmin, async (_req, res) => {
  const messages = await readMessages();
  res.json({ messages });
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
  const list = await readInvoices();
  const inv = buildInvoice(req.body, null);
  list.unshift(inv);
  await writeInvoices(list);
  res.status(201).json({ ok: true, invoice: inv });
});

app.put("/api/invoices/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id || id.length > 80) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const list = await readInvoices();
  const idx = list.findIndex((x) => x && String(x.id) === id);
  if (idx === -1) return res.status(404).json({ error: "Invoice not found." });
  const inv = buildInvoice(req.body, list[idx]);
  list[idx] = inv;
  await writeInvoices(list);
  res.json({ ok: true, invoice: inv });
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
  const messages = await readMessages();
  const next = messages.filter((m) => m && String(m.id) !== id);
  if (next.length === messages.length) {
    return res.status(404).json({ error: "Message not found." });
  }
  await writeMessages(next);
  res.json({ ok: true });
});

app.delete("/api/messages/:id", requireAdmin, async (req, res) => {
  const id = String(req.params.id || "").trim();
  if (!id || id.length > 80) {
    return res.status(400).json({ error: "Invalid id." });
  }
  const messages = await readMessages();
  const next = messages.filter((m) => m && String(m.id) !== id);
  if (next.length === messages.length) {
    return res.status(404).json({ error: "Message not found." });
  }
  await writeMessages(next);
  res.json({ ok: true });
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true });
});

if (existsSync(path.join(DIST_DIR, "index.html"))) {
  app.use(express.static(DIST_DIR));
  app.use((req, res, next) => {
    if (req.method !== "GET" && req.method !== "HEAD") return next();
    if (req.path.startsWith("/api")) return next();
    res.sendFile(path.join(DIST_DIR, "index.html"));
  });
}

app.listen(PORT, HOST, () => {
  const where =
    HOST === "0.0.0.0" || HOST === "::"
      ? `http://127.0.0.1:${PORT} (all interfaces: ${HOST})`
      : `http://${HOST}:${PORT}`;
  console.log(`Server ${where}`);
  if (existsSync(path.join(DIST_DIR, "index.html"))) {
    console.log("Serving SPA from dist/");
  } else {
    console.log("No dist/index.html — run npm run build to serve the site, or use Vite dev separately.");
  }
  if (existsSync(ENV_PATH)) {
    console.log(".env found — ADMIN_KEY taken from file (shell vars overridden).");
  } else {
    console.log(`No file at ${ENV_PATH} — using ADMIN_KEY from environment or default.`);
  }
});
