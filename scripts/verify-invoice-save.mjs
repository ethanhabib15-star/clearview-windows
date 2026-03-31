/**
 * Verifies the API accepts POST /api/invoices (same flow as the admin UI).
 * Usage: ensure API is running (npm run dev:api), then: node scripts/verify-invoice-save.mjs
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, "..");
const ENV_PATH = path.join(ROOT, ".env");
dotenv.config({ path: ENV_PATH, override: true });

const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;
const ADMIN_KEY = String(
  process.env.ADMIN_KEY || process.env.ADMIN_API_KEY || ""
).trim();
if (!ADMIN_KEY) {
  console.error("ADMIN_KEY missing in .env at", ENV_PATH);
  process.exit(1);
}
const base = `http://127.0.0.1:${PORT}`;

const body = {
  number: `VERIFY-${Date.now().toString(36).toUpperCase()}`,
  issueDate: new Date().toISOString().slice(0, 10),
  dueDate: "",
  fromName: "Verify Script",
  fromAddress: "x",
  fromPhone: "1",
  fromEmail: "v@test.com",
  clientName: "Verify Client",
  clientAddress: "",
  clientEmail: "",
  lineItems: [
    { id: "l1", description: "Verification line", quantity: 1, rate: 100 },
  ],
  taxPercent: 0,
  notes: "",
  paymentBank: "",
  paymentAccount: "",
  paymentPhone: "",
  signatureDataUrl: "",
  signedAt: "",
};

const health = await fetch(`${base}/api/health`).catch((e) => {
  console.error("API not reachable:", e.message);
  console.error(`Start the API first: cd "${ROOT}" && npm run dev:api`);
  process.exit(1);
});
if (!health.ok) {
  console.error("GET /api/health failed:", health.status);
  process.exit(1);
}

const r = await fetch(`${base}/api/invoices`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json",
    "X-Admin-Key": ADMIN_KEY,
  },
  body: JSON.stringify(body),
});

const text = await r.text();
let data;
try {
  data = JSON.parse(text);
} catch {
  console.error("Non-JSON response (HTTP", r.status + "):", text.slice(0, 500));
  process.exit(1);
}

if (!r.ok || !data.invoice) {
  console.error("Save failed (HTTP", r.status + "):", data.error || data);
  process.exit(1);
}

console.log("OK — invoice saved:", data.invoice.number, "id:", data.invoice.id);
process.exit(0);
