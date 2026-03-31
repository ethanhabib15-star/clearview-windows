import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VAULT_PATH = path.join(__dirname, "..", "payout-settings.enc.json");

function getKey() {
  const raw = process.env.PAYOUT_ENCRYPTION_KEY;
  if (!raw || !String(raw).trim()) return null;
  const s = String(raw).trim();
  if (/^[a-fA-F0-9]{64}$/.test(s)) return Buffer.from(s, "hex");
  return crypto.createHash("sha256").update(s, "utf8").digest();
}

export function isPayoutKeyConfigured() {
  return Boolean(getKey());
}

function encrypt(plainObj, key) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const json = JSON.stringify(plainObj);
  const enc = Buffer.concat([cipher.update(json, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("hex"),
    tag: tag.toString("hex"),
    data: enc.toString("hex"),
  };
}

function decrypt(blob, key) {
  const iv = Buffer.from(blob.iv, "hex");
  const tag = Buffer.from(blob.tag, "hex");
  const data = Buffer.from(blob.data, "hex");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const out = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(out.toString("utf8"));
}

export async function readPayoutSettings() {
  const key = getKey();
  if (!key) return null;
  try {
    const raw = await fs.readFile(VAULT_PATH, "utf8");
    const blob = JSON.parse(raw);
    if (!blob?.iv || !blob?.tag || !blob?.data) return null;
    return decrypt(blob, key);
  } catch {
    return null;
  }
}

export async function writePayoutSettings(obj) {
  const key = getKey();
  if (!key) {
    throw new Error("PAYOUT_ENCRYPTION_KEY is not set");
  }
  const sealed = encrypt(obj, key);
  const tmp = `${VAULT_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(sealed, null, 2), "utf8");
  await fs.rename(tmp, VAULT_PATH);
}
