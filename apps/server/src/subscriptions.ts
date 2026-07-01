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

export function listSubscriptions(): Subscription[] {
  return subs;
}

// gate check — is this model unlocked? customerRef narrows to one buyer when supplied.
export function isSubscribed(modelSlug: string, customerRef?: string): boolean {
  return subs.some(
    (s) =>
      s.status === "active" &&
      s.modelSlug === modelSlug &&
      (customerRef === undefined || s.customerRef === customerRef),
  );
}

// test seam — clears the store + seq between cases.
export function __resetSubsForTest(): void {
  subs.length = 0;
  seq = 0;
}
