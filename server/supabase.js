import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.warn(
    "[supabase] SUPABASE_URL と SUPABASE_SERVICE_ROLE_KEY（または SUPABASE_ANON_KEY）を .env に設定してください"
  );
}

export const supabase = url && key
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
  }
  return supabase;
}
