import { FLOAT, type LedgerEntry } from "@hermetika/shared";
import type { Backend } from "./backends";
import { guardedSpend, __resetSpendForTest } from "./spend";

// survival-loop accounting — two balances over one store:
//   entries[] = USD cash ledger (the P&L): income = customer revenue in, spend = real USD out (steward top-ups).
//   float     = compute-credit wallet: bought by top-ups, burned by paid inference. owned compute is free.
// net = income − spend is the money-shot; float dipping under low-water is what fires the steward.
// in-memory for now (Supabase is system-of-record at D4).

const entries: LedgerEntry[] = [];
let seq = 0;

// crude demo rate — real metering lands with usage rows. owned = free.
const RATE_PER_1K: Record<string, number> = { vllm: 0.0008, ollama: 0.0006, proxy: 0.0015 };

const SEED_FLOAT = 24;
let floatCredit = SEED_FLOAT; // compute-credit wallet (USD-denominated)

export function record(kind: "income" | "spend", amountUsd: number, ref: string, note: string, profile?: string): LedgerEntry {
  const e: LedgerEntry = {
    id: `l_${++seq}`,
    kind,
    amountUsd: Number(amountUsd.toFixed(4)),
    ref,
    profile: profile ?? null,
    note,
    createdAt: new Date().toISOString(),
  };
  entries.push(e);
  return e;
}

// customer revenue → cash in. (Stripe subs/webhooks feed this at D4; seedable for the demo.)
export function recordIncome(amountUsd: number, ref: string, note: string): LedgerEntry {
  return record("income", amountUsd, ref, note);
}

// meter a completed inference → burn compute credit (prepaid, so no new cash row). owned = free.
export function meter(_provider: string, backend: Backend, tokens: number, _modelSlug: string): void {
  if (!backend.paid) return; // owned temple, free marginal cost
  const cost = (tokens / 1000) * (RATE_PER_1K[backend.runtime] ?? 0.0015);
  floatCredit = Number((floatCredit - cost).toFixed(4));
}

export function ledger(): LedgerEntry[] {
  return entries;
}

// float = compute-credit balance the steward watches (reported to 2 decimals).
export function floatUsd(): number {
  return Number(floatCredit.toFixed(2));
}

function sumUsd(kind: "income" | "spend"): number {
  return Number(entries.filter((e) => e.kind === kind).reduce((s, e) => s + e.amountUsd, 0).toFixed(2));
}
export const incomeUsd = () => sumUsd("income");
export const spendUsd = () => sumUsd("spend");
export const netUsd = () => Number((incomeUsd() - spendUsd()).toFixed(2)); // the money-shot

// steward decision (pure) — does the credit wallet need a top-up?
export function stewardDecision(): { topUp: boolean; amount: number; float: number } {
  const f = floatUsd();
  return { topUp: f < FLOAT.lowWater, amount: FLOAT.topUp, float: f };
}

// actuator. routes the spend through the secure guard → selected rail (STEWARD_RAIL:
// demo | stripe | link). on success: real USD out → cash spend row; credit bought → float up.
// `key` is the idempotency key so one dip can never double-pay.
async function chargeTopUp(amountUsd: number, key: string): Promise<boolean> {
  const res = await guardedSpend(amountUsd, { idempotencyKey: key });
  if (!res.ok) {
    console.warn(`⚷ steward: top-up blocked (${res.ref}) — ${res.error}`);
    return false;
  }
  const tx = res.txHash ? ` · ${res.txHash}` : "";
  record("spend", amountUsd, res.ref, `steward top-up · compute credit · auto${tx}`);
  floatCredit = Number((floatCredit + amountUsd).toFixed(4));
  return true;
}

let lastTopUpAt = 0;
let lastAction: { at: string; amount: number; floatBefore: number; floatAfter: number } | null = null;

export function stewardStatus() {
  return { ...stewardDecision(), income: incomeUsd(), spend: spendUsd(), net: netUsd(), lastAction };
}

// one evaluation of the survival loop. on low float (cooldown-gated) it charges
// autonomously and books it. returns true iff it fired. `now` is injectable so the
// cooldown is deterministically testable.
export async function stewardTick(now = Date.now()): Promise<boolean> {
  const d = stewardDecision();
  if (!d.topUp) return false;
  if (now - lastTopUpAt < FLOAT.cooldownMs) return false;
  lastTopUpAt = now;
  const before = d.float;
  if (!(await chargeTopUp(d.amount, `topup-${now}`))) return false;
  lastAction = { at: new Date().toISOString(), amount: d.amount, floatBefore: before, floatAfter: floatUsd() };
  console.log(`⚷ steward: float $${before} < $${FLOAT.lowWater} → top-up $${d.amount} → float $${floatUsd()} · net $${netUsd()}`);
  return true;
}

// the closed loop — steward ticks on a cadence; stewardTick does the work.
export function startStewardLoop(): void {
  setInterval(() => void stewardTick(), FLOAT.tickMs);
}

// test seam — clears the cash ledger + credit wallet + steward state between cases.
export function __resetLedgerForTest(float = SEED_FLOAT): void {
  entries.length = 0;
  seq = 0;
  floatCredit = float;
  lastTopUpAt = 0;
  lastAction = null;
  __resetSpendForTest();
}
