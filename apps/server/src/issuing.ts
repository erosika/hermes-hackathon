// Stripe Issuing rail — the steward's fiat agent wallet. one spend-controlled virtual card,
// no crypto, no per-spend human approval. the card's spending_controls mirror the guard caps:
// defense in depth — Stripe enforces the credential hard-floor at authorization, the guard
// enforces runtime policy. provision the card once (provisionAgentCard), then top-ups use it.

export interface IssuingPolicy {
  maxTxUsd: number;
  maxDailyUsd: number;
  categories: string[]; // allowed merchant categories (empty = no category restriction)
}

export interface IssuingResult { ok: boolean; ref: string; cardId?: string; error?: string }

const usdToCents = (u: number) => Math.round(u * 100);

// pure: map our caps → Stripe issuing spending_controls. testable without the SDK.
export function cardSpendingControls(p: IssuingPolicy) {
  return {
    spending_limits: [
      { amount: usdToCents(p.maxTxUsd), interval: "per_authorization" as const },
      { amount: usdToCents(p.maxDailyUsd), interval: "daily" as const },
    ],
    ...(p.categories.length ? { allowed_categories: p.categories } : {}),
  };
}

// minimal shim for the optional `stripe` dep so this file typechecks without it installed.
interface StripeIssuing {
  issuing: {
    cards: {
      create(p: Record<string, unknown>): Promise<{ id: string }>;
      retrieve(id: string): Promise<{ id: string; status: string }>;
    };
  };
}

async function client(): Promise<StripeIssuing | null> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  const pkg = "stripe"; // variable specifier: optional dep, don't statically resolve
  const Stripe = (await import(pkg)).default as new (k: string) => StripeIssuing;
  return new Stripe(key);
}

// the rail: verify the agent's spend-controlled card is live, then book the top-up.
// (the card pays the vendor out-of-band — same as any card — but with Stripe-enforced limits.)
// dry-run by default; armed mode hits the real Stripe API.
export async function issuingTopUp(_amountUsd: number, _p: IssuingPolicy): Promise<IssuingResult> {
  if (process.env.STEWARD_ISSUING_ARMED !== "1") {
    return { ok: true, ref: "stripe-issuing", cardId: "dry-run" };
  }
  const stripe = await client();
  if (!stripe) return { ok: false, ref: "stripe-issuing", error: "STRIPE_SECRET_KEY unset" };
  const cardId = process.env.STRIPE_ISSUING_CARD;
  if (!cardId) return { ok: false, ref: "stripe-issuing", error: "STRIPE_ISSUING_CARD unset (run provisionAgentCard)" };
  try {
    const card = await stripe.issuing.cards.retrieve(cardId);
    if (card.status !== "active") return { ok: false, ref: "stripe-issuing", error: `card ${cardId} is ${card.status}` };
    return { ok: true, ref: "stripe-issuing", cardId: card.id };
  } catch (e) {
    return { ok: false, ref: "stripe-issuing", error: `issuing error: ${String(e)}` };
  }
}

// one-time setup — mint the agent's virtual card with spend controls. call from a script,
// not the hot loop; stash the returned id in STRIPE_ISSUING_CARD.
export async function provisionAgentCard(cardholderId: string, p: IssuingPolicy): Promise<string> {
  const stripe = await client();
  if (!stripe) throw new Error("STRIPE_SECRET_KEY unset");
  const card = await stripe.issuing.cards.create({
    type: "virtual",
    cardholder: cardholderId,
    currency: "usd",
    spending_controls: cardSpendingControls(p),
  });
  return card.id;
}
