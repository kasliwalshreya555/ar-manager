import "server-only";
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_ANON_KEY;
const workspace = process.env.AR_WORKSPACE_ID;
if (!url || !key || !workspace) {
  // Keep build-time rendering possible; requests fail with a clear message in loadArData.
}
export const db = url && key && workspace ? createClient(url, key, {
  auth: { persistSession: false },
  global: { headers: { "x-workspace": workspace } },
}) : null;

export function requireDb() {
  if (!db) throw new Error("Supabase is not configured. Set SUPABASE_URL, SUPABASE_ANON_KEY and AR_WORKSPACE_ID in .env.local.");
  return db;
}