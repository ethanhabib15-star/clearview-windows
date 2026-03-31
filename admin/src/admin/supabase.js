import { createClient } from "@supabase/supabase-js";

let cachedClient;

export function getAdminSupabaseClient() {
  if (cachedClient !== undefined) return cachedClient;

  const url = String(import.meta.env.VITE_SUPABASE_URL || "").trim();
  const anonKey = String(import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim();

  if (!url || !anonKey) {
    cachedClient = null;
    return cachedClient;
  }

  cachedClient = createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}
