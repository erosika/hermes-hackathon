// secure spend layer — every autonomous payment passes this guard before a rail signs.
// controls are enforced here (server-side), never trusted to the prompt or a remote 402:
// kill-switch · per-tx cap · daily cap · idempotency · then the selected rail.
// rails: demo (book only) · stripe (Stripe Issuing agent wallet) · link (Stripe Link CLI).

import { linkBuyCredit } from "./stripe";
import { issuingTopUp, type IssuingPolicy } from "./issuing";

export interface SpendResult { ok: boolean; ref: string; txHash?: string; error?: string }
export interface SpendCtx { idempotencyKey: string }

// stripe = Stripe Issuing agent wallet (fiat, recommended) · link = Link CLI.
type RailName = "demo" | "stripe" | "link";

interface Policy {
  rail: RailName;
  maxTxUsd: number;
  maxDailyUsd: number;
  halt: boolean;
  issuing: IssuingPolicy;
}

function policy(): Policy {
  const env = process.env;
  const maxTxUsd = Number(env.STEWARD_MAX_TX_USD ?? 50);
  const maxDailyUsd = Number(env.STEWARD_MAX_DAILY_USD ?? 200);
  return {
    rail: (env.STEWARD_RAIL as RailName) || "demo",
    maxTxUsd,
    maxDailyUsd,
    halt: env.STEWARD_HALT === "1",
    issuing: {
      maxTxUsd,
      maxDailyUsd,
      categories: (env.STEWARD_ISSUING_CATEGORIES ?? "").split(",").map((s) => s.trim()).filter(Boolean),
    },
  };
}

// state the guard accumulates — daily total + spent idempotency keys.
let day = "";
let dailyTotal = 0;
const seen = new Set<string>();

const fail = (ref: string, error: string): SpendResult => ({ ok: false, ref, error });

export async function guardedSpend(amountUsd: number, ctx: SpendCtx): Promise<SpendResult> {
  const p = policy();
  if (p.halt) return fail("halt", "kill-switch engaged (STEWARD_HALT=1)");
  if (!(amountUsd > 0)) return fail("policy", "non-positive amount");
  if (amountUsd > p.maxTxUsd) return fail("policy", `over per-tx cap $${p.maxTxUsd}`);
  if (seen.has(ctx.idempotencyKey)) return fail("idempotent", "duplicate spend suppressed");

  const today = new Date().toISOString().slice(0, 10);
  if (day !== today) { day = today; dailyTotal = 0; }
  if (dailyTotal + amountUsd > p.maxDailyUsd) return fail("policy", `over daily cap $${p.maxDailyUsd}`);

  const res = await runRail(p, amountUsd);
  if (res.ok) { seen.add(ctx.idempotencyKey); dailyTotal += amountUsd; }
  return res;
}

async function runRail(p: Policy, amountUsd: number): Promise<SpendResult> {
  switch (p.rail) {
    case "demo":
      return { ok: true, ref: "demo" }; // book the credit, no external call
    case "stripe": {
      const r = await issuingTopUp(amountUsd, p.issuing);
      return { ok: r.ok, ref: r.ref, txHash: r.cardId, error: r.error };
    }
    case "link": {
      const ok = await linkBuyCredit(amountUsd);
      return { ok, ref: "stripe-link", error: ok ? undefined : "link-cli spend failed" };
    }
    default:
      return fail("policy", `unknown rail '${p.rail}'`);
  }
}

// test seam — reset the guard's daily total + idempotency set.
export function __resetSpendForTest(): void {
  day = "";
  dailyTotal = 0;
  seen.clear();
}
