import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import crypto from "crypto";
import { getSupabaseAdminClient } from "./supabaseClient.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MESSAGES_PATH = path.join(__dirname, "messages.json");
const MESSAGES_TABLE = "contact_messages";
const QUOTE_REQUESTS_TABLE = "quote_requests";

function normalizeMessageList(data) {
  if (!Array.isArray(data)) return [];
  const objects = data.filter((m) => m && typeof m === "object");
  return objects.map((m) => {
    if (m.id == null || String(m.id).trim() === "") {
      return { ...m, id: crypto.randomUUID() };
    }
    return m;
  });
}

async function writeMessagesFile(messages) {
  const payload = JSON.stringify(messages, null, 2);
  const tmp = `${MESSAGES_PATH}.tmp`;
  await fs.writeFile(tmp, payload, "utf8");
  await fs.rename(tmp, MESSAGES_PATH);
}

async function insertQuoteRequestIfNeeded(supabase, message) {
  if (!supabase || String(message?.subject || "").toLowerCase() !== "quote") return;
  const quote = {
    id: crypto.randomUUID(),
    message_id: String(message.id),
    name: String(message.name || ""),
    email: String(message.email || ""),
    phone: String(message.phone || ""),
    service_type: String(message.serviceType || ""),
    project_details: String(message.projectDetails || ""),
    budget_range: String(message.budgetRange || ""),
    data: message,
    created_at: message.createdAt || new Date().toISOString(),
  };
  const { error } = await supabase.from(QUOTE_REQUESTS_TABLE).insert(quote);
  if (error) throw error;
}

export async function readMessages() {
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .select("data")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return normalizeMessageList((Array.isArray(data) ? data : []).map((r) => r?.data));
    } catch (e) {
      console.warn("Supabase read messages failed, falling back to file:", e?.message || e);
    }
  }
  try {
    const raw = await fs.readFile(MESSAGES_PATH, "utf8");
    return normalizeMessageList(JSON.parse(raw));
  } catch {
    return [];
  }
}

export async function createMessage(entry) {
  const msg = {
    ...entry,
    id:
      entry?.id && String(entry.id).trim()
        ? String(entry.id).trim()
        : crypto.randomUUID(),
    createdAt: entry?.createdAt || new Date().toISOString(),
  };
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      const row = {
        id: msg.id,
        subject: String(msg.subject || ""),
        name: String(msg.name || ""),
        email: String(msg.email || ""),
        phone: String(msg.phone || ""),
        data: msg,
        created_at: msg.createdAt,
      };
      const { error } = await supabase.from(MESSAGES_TABLE).insert(row);
      if (error) throw error;
      await insertQuoteRequestIfNeeded(supabase, msg);
      return msg;
    } catch (e) {
      console.warn("Supabase create message failed, falling back to file:", e?.message || e);
    }
  }
  const list = await readMessages();
  list.unshift(msg);
  await writeMessagesFile(list);
  return msg;
}

export async function deleteMessageById(id) {
  const sid = String(id || "").trim();
  if (!sid) return false;
  const supabase = getSupabaseAdminClient();
  if (supabase) {
    try {
      await supabase.from(QUOTE_REQUESTS_TABLE).delete().eq("message_id", sid);
      const { data, error } = await supabase
        .from(MESSAGES_TABLE)
        .delete()
        .eq("id", sid)
        .select("id");
      if (error) throw error;
      return Array.isArray(data) && data.length > 0;
    } catch (e) {
      console.warn("Supabase delete message failed, falling back to file:", e?.message || e);
    }
  }
  const list = await readMessages();
  const next = list.filter((m) => m && String(m.id) !== sid);
  if (next.length === list.length) return false;
  await writeMessagesFile(next);
  return true;
}

export async function readQuoteRequests() {
  const supabase = getSupabaseAdminClient();
  if (!supabase) {
    const messages = await readMessages();
    return messages.filter((m) => String(m.subject || "").toLowerCase() === "quote");
  }
  try {
    const { data, error } = await supabase
      .from(QUOTE_REQUESTS_TABLE)
      .select("data")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (Array.isArray(data) ? data : [])
      .map((row) => row?.data)
      .filter((x) => x && typeof x === "object");
  } catch (e) {
    console.warn("Supabase read quote requests failed:", e?.message || e);
    return [];
  }
}
