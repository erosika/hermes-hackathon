// subscription billing — one plan, one button. the button redirects to a Stripe-hosted
// surface (Payment Link to subscribe, or Billing Portal to manage). configure STRIPE_PORTAL_URL
// with that link; with none set we hand back a local demo URL so the flow runs dry.

export const PLAN = {
  slug: "pantheon-pro",
  name: "Pantheon Pro",
  priceUsd: Number(process.env.PANTHEON_PRICE_USD ?? 9),
} as const;

export interface SubscribeLink {
  url: string;
  plan: string;
  priceUsd: number;
  live: boolean; // true when redirecting to real Stripe
}

export function subscribeUrl(): SubscribeLink {
  const portal = process.env.STRIPE_PORTAL_URL;
  if (portal) return { url: portal, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: true };
  return { url: `/checkout/demo?plan=${PLAN.slug}&price=${PLAN.priceUsd}`, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: false };
}
