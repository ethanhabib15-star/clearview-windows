/**
 * Same request as the Pay online page: POST /api/public/invoices/lookup
 * Usage: node scripts/verify-public-lookup.mjs [invoiceNumber]
 */
import dotenv from "dotenv";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;

let num = String(process.argv[2] || "").trim();
if (!num) {
  const invPath = path.join(__dirname, "..", "server", "invoices.json");
  if (existsSync(invPath)) {
    try {
      const list = JSON.parse(readFileSync(invPath, "utf8"));
      num =
        Array.isArray(list) && list[0]?.number
          ? String(list[0].number).trim()
          : "";
    } catch {
      num = "";
    }
  }
}

if (!num) {
  console.error(
    "Usage: node scripts/verify-public-lookup.mjs <invoiceNumber>\nOr add an invoice to server/invoices.json"
  );
  process.exit(1);
}

const base = `http://127.0.0.1:${PORT}`;
const r = await fetch(`${base}/api/public/invoices/lookup`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ invoiceNumber: num }),
});
const data = await r.json().catch(() => ({}));
if (!r.ok) {
  console.error("FAIL", r.status, data.error || data);
  process.exit(1);
}
console.log(
  "OK — public lookup works for:",
  data.number || num,
  "totalCents:",
  data.totalCents
);
