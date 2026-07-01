import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// real auth via Supabase. set VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (.env.local).
// with none set, supabase is null and the UI shows an "auth not configured" state.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const supabaseEnabled = !!(url && anon);
export const supabase: SupabaseClient | null = supabaseEnabled ? createClient(url!, anon!) : null;

// current access token, mirrored from the Supabase session for gateway calls.
let token: string | null = null;
export function setToken(t: string | null): void {
  token = t;
}
export function authHeader(): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}
