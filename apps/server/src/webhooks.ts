// Stripe webhook handler — feeds the income lane of the survival-loop ledger.
// customer pays (checkout / invoice) → cash row in + subscription activated.
// demo-degrades: with no STRIPE_WEBHOOK_SECRET it parses raw JSON and never throws,
// so the flow is drivable end-to-end without real Stripe keys.

import { type LedgerEntry, type Subscription } from "@hermetika/shared";
import { recordIncome } from "./ledger";
import { activateSubscription } from "./subscriptions";

export interface StripeEventLike {
  type: string;
  data?: { object?: Record<string, any> };
}

// demo mode: JSON.parse only. with a secret set, verify the signature via Stripe's SDK.
export function verifyAndParse(rawBody: string, signature?: string): StripeEventLike {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    return JSON.parse(rawBody) as StripeEventLike; // demo mode — trust the body, never throw
  }

  // real path: lazy-import so the SDK is only needed when a secret is configured (mirrors stripe.ts).
  try {
    const req = (globalThis as any).require as ((m: string) => any) | undefined;
    const Stripe = req ? req("stripe") : undefined;
    if (Stripe && signature) {
      const client = new Stripe(process.env.STRIPE_SECRET_KEY ?? "");
      return client.webhooks.constructEvent(rawBody, signature, secret) as StripeEventLike;
    }
    console.warn("⚷ webhook: STRIPE_WEBHOOK_SECRET set but SDK/signature unavailable — falling back to parse");
  } catch (e) {
    console.warn(`⚷ webhook: signature verification unavailable (${String(e)}) — falling back to parse`);
  }
  return JSON.parse(rawBody) as StripeEventLike;
}

const INCOME_EVENTS = new Set(["checkout.session.completed", "invoice.paid"]);

export async function handleStripeEvent(evt: StripeEventLike): Promise<{ handled: boolean; note: string }> {
  if (!INCOME_EVENTS.has(evt.type)) {
    return { handled: false, note: `ignored ${evt.type}` };
  }

  const obj = evt.data?.object ?? {};
  const cents = obj.amount_total ?? obj.amount_paid ?? 0; // Stripe amounts are in cents
  const amountUsd = Number(cents) / 100;
  const slug: string | undefined = obj.metadata?.slug;
  const customerRef: string = obj.customer_email ?? obj.customer ?? "anon";

  const entry: LedgerEntry = recordIncome(amountUsd, "stripe", `pantheon pro · ${slug ?? "sub"}`);

  let sub: Subscription | undefined;
  if (slug) sub = activateSubscription(slug, customerRef, amountUsd);

  const suffix = sub ? ` · sub ${slug}` : "";
  return { handled: true, note: `income $${amountUsd.toFixed(2)} (${entry.ref})${suffix}` };
}
