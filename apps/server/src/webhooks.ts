// Stripe webhook — books subscription revenue. real path verifies the signature with the
// SDK (async / Web Crypto, Bun-safe); demo path parses raw JSON. never throws in demo.
// requires the RAW request body for signature verification (the route passes it as text).

import { type LedgerEntry, type Subscription } from "@hermetika/shared";
import { recordIncome } from "./ledger";
import { activateSubscription, cancelByEmail } from "./subscriptions";
import { PLAN, stripeClient } from "./billing";

export interface StripeEventLike {
  type: string;
  data?: { object?: Record<string, any> };
}

export async function verifyAndParse(rawBody: string, signature?: string): Promise<StripeEventLike> {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  const stripe = stripeClient();
  if (secret && stripe && signature) {
    // throws on a bad signature — caller returns 400.
    return (await stripe.webhooks.constructEventAsync(rawBody, signature, secret)) as unknown as StripeEventLike;
  }
  return JSON.parse(rawBody) as StripeEventLike; // demo mode — trust the body
}

const INCOME_EVENTS = new Set(["checkout.session.completed", "invoice.paid", "invoice.payment_succeeded"]);

function emailOf(obj: Record<string, any>): string {
  return obj.customer_email ?? obj.customer_details?.email ?? obj.metadata?.email ?? obj.customer ?? "anon";
}

export async function handleStripeEvent(evt: StripeEventLike): Promise<{ handled: boolean; note: string }> {
  const obj = evt.data?.object ?? {};

  if (evt.type === "customer.subscription.deleted") {
    const n = cancelByEmail(emailOf(obj));
    return { handled: true, note: `canceled ${n} sub(s)` };
  }

  if (!INCOME_EVENTS.has(evt.type)) {
    return { handled: false, note: `ignored ${evt.type}` };
  }

  const cents = obj.amount_total ?? obj.amount_paid ?? Math.round(PLAN.priceUsd * 100);
  const amountUsd = Number(cents) / 100;
  const customerRef = emailOf(obj);

  const entry: LedgerEntry = recordIncome(amountUsd, "stripe", `${PLAN.name} · ${customerRef}`);
  const sub: Subscription = activateSubscription(PLAN.slug, customerRef, amountUsd);

  return { handled: true, note: `income $${amountUsd.toFixed(2)} (${entry.ref}) · ${sub.status} ${PLAN.slug}` };
}
