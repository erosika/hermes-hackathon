// Supabase persistence adapter — degrade-safe. schema.sql is the DDL; the in-memory stores
// in ledger.ts / subscriptions / seed.ts stay source-of-truth until callers are switched over.
// with no SUPABASE_URL + SUPABASE_SERVICE_KEY set, getDb() returns null and the gateway runs
// entirely in-memory (no @supabase/supabase-js dependency required).

// minimal shim so this file typechecks without @supabase/supabase-js installed.
interface SupabaseClient {
  from(table: string): unknown;
}

let cached: SupabaseClient | null | undefined; // undefined = not yet resolved

// config is present only when both credentials are set — cheap sync gate for dbEnabled().
function configured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_KEY);
}

// lazy dynamic import via a variable specifier so tsc doesn't statically require the optional dep.
export async function getDb(): Promise<SupabaseClient | null> {
  if (cached !== undefined) return cached;
  if (!configured()) return (cached = null);
  const pkg = "@supabase/supabase-js"; // variable specifier: optional dep, don't statically resolve
  const mod = (await import(pkg)) as { createClient(u: string, k: string): SupabaseClient };
  cached = mod.createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_KEY!);
  return cached;
}

export function dbEnabled(): boolean {
  return configured();
}
