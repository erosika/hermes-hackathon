import { type Subscription } from "@hermetika/shared";

// in-memory cache of the Supabase `subscriptions` table. one row per subscription.
// with SUPABASE_SERVICE_KEY set, writes are mirrored to Supabase and the cache is
// hydrated from it on boot, so subs survive restarts. without it, pure in-memory.

const subs: Subscription[] = [];

function dbBase(): string | null {
  const base = process.env.SUPABASE_URL;
  return base && process.env.SUPABASE_SERVICE_KEY ? base.replace(/\/$/, "") : null;
}
function dbHeaders(): Record<string, string> {
  const key = process.env.SUPABASE_SERVICE_KEY!;
  return { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" };
}
function fromRow(r: Record<string, unknown>): Subscription {
  return {
    id: String(r.id),
    modelSlug: String(r.plan_slug),
    customerRef: String(r.customer_ref),
    status: r.status as Subscription["status"],
    priceUsd: Number(r.price_usd),
    createdAt: String(r.created_at),
  };
}

// hydrate the cache from Supabase on boot (no-op without a service key).
export async function loadSubs(): Promise<void> {
  const base = dbBase();
  if (!base) return;
  try {
    const r = await fetch(`${base}/rest/v1/subscriptions?select=*`, { headers: dbHeaders() });
    if (!r.ok) throw new Error(`load ${r.status}`);
    const rows = (await r.json()) as Record<string, unknown>[];
    subs.length = 0;
    for (const row of rows) subs.push(fromRow(row));
    console.log(`☿ subscriptions: hydrated ${subs.length} from supabase`);
  } catch (e) {
    console.error("subscriptions: load failed", e);
  }
}

async function dbInsert(s: Subscription): Promise<void> {
  const base = dbBase();
  if (!base) return;
  try {
    await fetch(`${base}/rest/v1/subscriptions`, {
      method: "POST",
      headers: { ...dbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ id: s.id, plan_slug: s.modelSlug, customer_ref: s.customerRef, status: s.status, price_usd: s.priceUsd, created_at: s.createdAt }),
    });
  } catch (e) {
    console.error("subscriptions: insert failed", e);
  }
}

async function dbCancelByCustomer(customerRef: string): Promise<void> {
  const base = dbBase();
  if (!base) return;
  try {
    await fetch(`${base}/rest/v1/subscriptions?customer_ref=eq.${encodeURIComponent(customerRef)}&status=eq.active`, {
      method: "PATCH",
      headers: { ...dbHeaders(), Prefer: "return=minimal" },
      body: JSON.stringify({ status: "canceled" }),
    });
  } catch (e) {
    console.error("subscriptions: cancel failed", e);
  }
}

// activate a subscription for a customer. write-through to Supabase (best-effort).
export function activateSubscription(modelSlug: string, customerRef: string, priceUsd: number): Subscription {
  const s: Subscription = {
    id: crypto.randomUUID(),
    modelSlug,
    customerRef,
    status: "active",
    priceUsd,
    createdAt: new Date().toISOString(),
  };
  subs.push(s);
  void dbInsert(s);
  return s;
}

export function cancelSubscription(id: string): boolean {
  const s = subs.find((x) => x.id === id);
  if (!s) return false;
  s.status = "canceled";
  const base = dbBase();
  if (base) void fetch(`${base}/rest/v1/subscriptions?id=eq.${encodeURIComponent(id)}`, {
    method: "PATCH", headers: { ...dbHeaders(), Prefer: "return=minimal" }, body: JSON.stringify({ status: "canceled" }),
  }).catch((e) => console.error("subscriptions: cancel failed", e));
  return true;
}

// cancel every active sub for a customer (Stripe subscription.deleted).
export function cancelByEmail(customerRef: string): number {
  let n = 0;
  for (const s of subs) {
    if (s.status === "active" && s.customerRef === customerRef) { s.status = "canceled"; n++; }
  }
  if (n > 0) void dbCancelByCustomer(customerRef);
  return n;
}

export function listSubscriptions(): Subscription[] {
  return subs;
}

// comped accounts — HERMETIKA_PRO_EMAILS (comma-separated) are always pro, regardless of Stripe.
function proAllowlist(): string[] {
  return (process.env.HERMETIKA_PRO_EMAILS ?? "").split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

// gate check — does this customer hold an active subscription?
export function isSubscribed(customerRef?: string): boolean {
  if (customerRef && proAllowlist().includes(customerRef.toLowerCase())) return true;
  return subs.some((s) => s.status === "active" && (customerRef === undefined || s.customerRef === customerRef));
}

const active = () => subs.filter((s) => s.status === "active");

// monthly recurring revenue — the one number the platform runs on.
export function mrrUsd(): number {
  return Number(active().reduce((s, x) => s + x.priceUsd, 0).toFixed(2));
}

export function activeCount(): number {
  return active().length;
}

export function subscriptionSummary() {
  return { mrr: mrrUsd(), active: activeCount(), total: subs.length, recent: subs.slice(-8).reverse() };
}

// test seam — clears the cache between cases.
export function __resetSubsForTest(): void {
  subs.length = 0;
}
