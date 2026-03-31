/**
 * Confirms the API exposes public Pay-online routes (same host/port as dev:api).
 * If GET /api/public/health is 404, stop the old Node process on PORT and run: npm run dev:api
 */
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "..", ".env"), override: true });

const PORT = Number(process.env.PORT || process.env.API_PORT) || 3001;
const base = `http://127.0.0.1:${PORT}`;

const h = await fetch(`${base}/api/public/health`).catch((e) => {
  console.error("API not running on", PORT, "—", e.message);
  console.error(`Start it: npm run dev:api   (PORT/API_PORT in .env = ${PORT})`);
  process.exit(1);
});

if (h.status === 404) {
  console.error(
    "GET /api/public/health → 404. The Node process on port",
    PORT,
    "is an OLD build without public routes."
  );
  console.error(
    "Fix: stop every `node server/index.js` / old terminal, then run: npm run dev:api"
  );
  process.exit(1);
}

if (!h.ok) {
  console.error("GET /api/public/health failed:", h.status);
  process.exit(1);
}

const j = await h.json().catch(() => ({}));
console.log("OK — API public routes:", j.invoiceLookup || j);
