import { createClient } from "@supabase/supabase-js";

let cachedClient;

export function getSupabaseAdminClient() {
  if (cachedClient !== undefined) return cachedClient;

  const url = String(process.env.SUPABASE_URL || "").trim();
  const serviceRoleKey = String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").trim();
  const anonKey = String(process.env.SUPABASE_ANON_KEY || "").trim();
  const key = serviceRoleKey || anonKey;

  if (!url || !key) {
    cachedClient = null;
    return cachedClient;
  }

  if (!serviceRoleKey && anonKey) {
    console.warn(
      "[supabase] SUPABASE_SERVICE_ROLE_KEY is missing. Using SUPABASE_ANON_KEY fallback; writes will depend on your RLS policies.",
    );
  }

  cachedClient = createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
  return cachedClient;
}

export function isSupabaseEnabled() {
  return Boolean(getSupabaseAdminClient());
}
