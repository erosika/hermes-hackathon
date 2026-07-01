import Stripe from "stripe";

// subscription billing. real path: create a Stripe Checkout Session (subscription mode)
// tied to the signed-in email, so the webhook can activate the right customer. with no
// STRIPE_SECRET_KEY we fall back to STRIPE_PORTAL_URL, then to a local demo checkout.

export const PLAN = {
  slug: "hermetika-pro",
  name: "Hermetika Pro",
  blurb: "unlimited access",
  priceUsd: Number(process.env.HERMETIKA_PRICE_USD ?? process.env.PANTHEON_PRICE_USD ?? 3),
} as const;

export interface SubscribeLink {
  url: string;
  plan: string;
  priceUsd: number;
  live: boolean;
}

let stripe: Stripe | null = null;
export function stripeClient(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripe) stripe = new Stripe(key);
  return stripe;
}

export async function subscribeUrl(email?: string): Promise<SubscribeLink> {
  const s = stripeClient();
  if (s) {
    const appUrl = process.env.APP_URL ?? "http://localhost:5173";
    const meta = { plan: PLAN.slug, ...(email ? { email } : {}) };
    const session = await s.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(PLAN.priceUsd * 100),
            recurring: { interval: "month" },
            product_data: { name: "Hermetika", description: `${PLAN.name} · ${PLAN.blurb}` },
          },
        },
      ],
      ...(email ? { customer_email: email } : {}),
      metadata: meta,
      subscription_data: { metadata: meta }, // so subscription.* webhooks carry the email
      success_url: `${appUrl}/?sub=success`,
      cancel_url: `${appUrl}/?sub=cancel`,
    });
    if (session.url) return { url: session.url, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: true };
  }

  const portal = process.env.STRIPE_PORTAL_URL;
  if (portal) {
    const url = email ? `${portal}${portal.includes("?") ? "&" : "?"}prefilled_email=${encodeURIComponent(email)}` : portal;
    return { url, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: true };
  }

  const q = `plan=${PLAN.slug}&price=${PLAN.priceUsd}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  return { url: `/checkout/demo?${q}`, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: false };
}

// Stripe Billing Portal — where a customer manages or cancels their subscription.
// resolves the Stripe customer by email; null if Stripe/customer isn't there yet.
export async function portalUrl(email: string): Promise<string | null> {
  const s = stripeClient();
  if (!s) return null;
  const appUrl = process.env.APP_URL ?? "http://localhost:5173";
  const found = await s.customers.list({ email, limit: 1 });
  const customer = found.data[0];
  if (!customer) return null;
  const session = await s.billingPortal.sessions.create({ customer: customer.id, return_url: appUrl });
  return session.url;
}
