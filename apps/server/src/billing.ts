// subscription billing — one plan, one button. the button redirects to a Stripe-hosted
// surface (Payment Link to subscribe, or Billing Portal to manage). configure STRIPE_PORTAL_URL
// with that link; with none set we hand back a local demo URL so the flow runs dry.

// one plan: $2/mo, unlimited access to the whole pantheon.
export const PLAN = {
  slug: "pantheon-pro",
  name: "Pantheon Pro",
  blurb: "unlimited access",
  priceUsd: Number(process.env.PANTHEON_PRICE_USD ?? 2),
} as const;

export interface SubscribeLink {
  url: string;
  plan: string;
  priceUsd: number;
  live: boolean; // true when redirecting to real Stripe
}

export function subscribeUrl(email?: string): SubscribeLink {
  const portal = process.env.STRIPE_PORTAL_URL;
  if (portal) {
    // prefill the buyer on the Stripe-hosted page so the webhook ties the sub to them.
    const url = email ? `${portal}${portal.includes("?") ? "&" : "?"}prefilled_email=${encodeURIComponent(email)}` : portal;
    return { url, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: true };
  }
  const q = `plan=${PLAN.slug}&price=${PLAN.priceUsd}${email ? `&email=${encodeURIComponent(email)}` : ""}`;
  return { url: `/checkout/demo?${q}`, plan: PLAN.slug, priceUsd: PLAN.priceUsd, live: false };
}
