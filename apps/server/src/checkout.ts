import { type CheckoutSession, PRICING } from "@hermetika/shared";
import { MODELS } from "./seed";

// Stripe Checkout rail — the buy-flow the web sandbox opens to unlock a model.
// degrade-safe: with no STRIPE_SECRET_KEY we mint a demo session pointing at the
// local /checkout/demo page, so the whole flow runs dry without Stripe wired.

function priceFor(slug: string): number {
  const model = MODELS.find((m) => m.slug === slug);
  return model?.priceUsd ?? PRICING.defaultMonthlyUsd;
}

function demoSession(slug: string, price: number): CheckoutSession {
  return {
    id: `cs_demo_${slug}`,
    url: `/checkout/demo?slug=${slug}&price=${price}`,
    modelSlug: slug,
    priceUsd: price,
  };
}

// synchronous entry the gateway calls. demo path is instant; the real Stripe path
// is best-effort scaffolding that falls back to demo if the SDK isn't installed/armed.
export function createCheckoutSession(slug: string): CheckoutSession {
  const price = priceFor(slug);
  if (!process.env.STRIPE_SECRET_KEY) return demoSession(slug, price);

  // key present but real session creation is async + needs the optional `stripe`
  // dep; kick it off, and until it's wired hand back the demo session so we never throw.
  void createStripeCheckout(slug, price).catch(() => {});
  return demoSession(slug, price);
}

// minimal shim for the optional `stripe` dep so this file typechecks without it installed.
interface StripeCheckout {
  checkout: {
    sessions: {
      create(p: Record<string, unknown>): Promise<{ id: string; url: string | null }>;
    };
  };
}

async function client(): Promise<StripeCheckout | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const pkg = "stripe"; // variable specifier: optional dep, don't statically resolve
  const Stripe = (await import(pkg)).default as new (k: string) => StripeCheckout;
  return new Stripe(key);
}

// real rail scaffold — mints a live Stripe Checkout Session. returns null (caller
// keeps the demo session) whenever the SDK is absent or the API rejects the call.
async function createStripeCheckout(slug: string, price: number): Promise<CheckoutSession | null> {
  const stripe = await client();
  if (!stripe) return null;
  try {
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: Math.round(price * 100),
            recurring: { interval: "month" },
            product_data: { name: `hermetika · ${slug}` },
          },
        },
      ],
      metadata: { modelSlug: slug },
      success_url: `/checkout/success?slug=${slug}`,
      cancel_url: `/checkout/cancel?slug=${slug}`,
    });
    if (!session.url) return null;
    return { id: session.id, url: session.url, modelSlug: slug, priceUsd: price };
  } catch {
    return null;
  }
}
