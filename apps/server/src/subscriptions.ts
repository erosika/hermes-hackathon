import { type Subscription } from "@hermetika/shared";

// in-memory subscription store — mirrors the Supabase `subscriptions` table
// (system-of-record at D4). one row per active model unlock per customer.
// module-level array + incrementing seq, same style as the cash ledger.

const subs: Subscription[] = [];
let seq = 0;

// activate a model unlock for a customer. always "active" — cancels flip status via cancelSubscription.
export function activateSubscription(modelSlug: string, customerRef: string, priceUsd: number): Subscription {
  const s: Subscription = {
    id: `sub_${++seq}`,
    modelSlug,
    customerRef,
    status: "active",
    priceUsd,
    createdAt: new Date().toISOString(),
  };
  subs.push(s);
  return s;
}

export function cancelSubscription(id: string): boolean {
  const s = subs.find((x) => x.id === id);
  if (!s) return false;
  s.status = "canceled";
  return true;
}

// cancel every active sub for a customer (Stripe subscription.deleted).
export function cancelByEmail(customerRef: string): number {
  let n = 0;
  for (const s of subs) {
    if (s.status === "active" && s.customerRef === customerRef) { s.status = "canceled"; n++; }
  }
  return n;
}

export function listSubscriptions(): Subscription[] {
  return subs;
}

// gate check — does this customer hold an active subscription?
export function isSubscribed(customerRef?: string): boolean {
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

// test seam — clears the store + seq between cases.
export function __resetSubsForTest(): void {
  subs.length = 0;
  seq = 0;
}
