/**
 * Optional absolute API origin when the dev proxy is unavailable (set VITE_API_BASE in .env).
 * Example: VITE_API_BASE=http://localhost:3020
 */
const RAW = import.meta.env.VITE_API_BASE;
const BASE =
  typeof RAW === "string" && RAW.trim() ? RAW.trim().replace(/\/$/, "") : "";

export function apiUrl(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (!BASE) return p;
  return `${BASE}${p}`;
}

/** Single read of body — avoids empty `{}` when the server returns HTML (proxy error) or plain text. */
export async function readResponseJson(r) {
  const text = await r.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {
      error:
        text.length > 400
          ? `${text.slice(0, 400)}…`
          : text || `Non-JSON response (HTTP ${r.status}).`,
    };
  }
}
