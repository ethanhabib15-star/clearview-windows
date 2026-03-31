import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const CONTACTS_PATH = path.join(__dirname, "contacts.json");

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function defaultContacts() {
  const now = new Date().toISOString();
  return {
    businessName: "Ryzhkov ClearView Windows",
    phone: "(918) 555-0100",
    alternatePhone: "",
    email: "hello@ryzhkovclearviewwindows.com",
    address: "Tulsa metro · Broken Arrow · Coweta\nNortheast Oklahoma",
    updatedAt: now,
  };
}

function normalizeContacts(data) {
  const d = defaultContacts();
  if (!data || typeof data !== "object") return { ...d };
  return {
    businessName: String(data.businessName ?? d.businessName).slice(0, 200),
    phone: String(data.phone ?? d.phone).slice(0, 80),
    alternatePhone: String(data.alternatePhone ?? "").slice(0, 80),
    email: String(data.email ?? d.email).slice(0, 320),
    address: String(data.address ?? d.address).slice(0, 500),
    updatedAt: String(data.updatedAt ?? d.updatedAt).slice(0, 40),
  };
}

export async function readContacts() {
  try {
    const raw = await fs.readFile(CONTACTS_PATH, "utf8");
    const data = JSON.parse(raw);
    return normalizeContacts(data);
  } catch {
    return defaultContacts();
  }
}

export async function writeContacts(c) {
  const tmp = `${CONTACTS_PATH}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(c, null, 2), "utf8");
  await fs.rename(tmp, CONTACTS_PATH);
}

export function sanitizeContactsInput(body) {
  const now = new Date().toISOString();
  return {
    businessName: String(body?.businessName ?? "").trim().slice(0, 200),
    phone: String(body?.phone ?? "").trim().slice(0, 80),
    alternatePhone: String(body?.alternatePhone ?? "").trim().slice(0, 80),
    email: String(body?.email ?? "").trim().slice(0, 320),
    address: String(body?.address ?? "").trim().slice(0, 500),
    updatedAt: now,
  };
}

export function isReasonablePhone(s) {
  if (!s || typeof s !== "string") return true;
  const t = s.trim();
  if (!t) return true;
  const digits = t.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15;
}

export function isValidEmail(s) {
  return typeof s === "string" && EMAIL_RE.test(s.trim());
}

export function validateContactsForSave(c) {
  const errors = [];
  if (!c.businessName) errors.push("Business name is required.");
  if (!c.phone) errors.push("Phone number is required.");
  if (!c.email) errors.push("Email address is required.");
  else if (!isValidEmail(c.email)) errors.push("Invalid email format.");
  if (!isReasonablePhone(c.phone)) {
    errors.push("Primary phone must include 10–15 digits.");
  }
  if (c.alternatePhone && !isReasonablePhone(c.alternatePhone)) {
    errors.push("Alternate phone must include 10–15 digits when provided.");
  }
  return errors;
}

function vcardEscape(v) {
  return String(v)
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/;/g, "\\;");
}

/**
 * vCard 3.0 for iOS/Android Contacts import.
 */
export function buildVCard(c) {
  const fn = c.businessName || "Contact";
  const lines = [
    "BEGIN:VCARD",
    "VERSION:3.0",
    `FN:${vcardEscape(fn)}`,
    `ORG:${vcardEscape(c.businessName)}`,
  ];
  if (c.phone) {
    lines.push(`TEL;TYPE=WORK,VOICE:${vcardEscape(c.phone)}`);
  }
  if (c.alternatePhone) {
    lines.push(`TEL;TYPE=CELL,VOICE:${vcardEscape(c.alternatePhone)}`);
  }
  if (c.email) {
    lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(c.email)}`);
  }
  if (c.address) {
    const flat = c.address.replace(/\n/g, ", ").trim();
    lines.push(`ADR;TYPE=WORK:;;${vcardEscape(flat)};;;;`);
    lines.push(`LABEL;TYPE=WORK:${vcardEscape(c.address)}`);
  }
  lines.push("END:VCARD");
  return `${lines.join("\r\n")}\r\n`;
}

export function publicContactsPayload(c) {
  return {
    businessName: c.businessName,
    phone: c.phone,
    alternatePhone: c.alternatePhone,
    email: c.email,
    address: c.address,
    updatedAt: c.updatedAt,
  };
}
