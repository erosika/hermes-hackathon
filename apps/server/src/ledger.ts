import { FLOAT, type LedgerEntry } from "@hermetika/shared";
import type { Backend } from "./backends";

// survival-loop P&L. in-memory for now (Supabase is system-of-record at D4);
// this makes the live ledger UI + steward logic real today.
// owned compute (spark) = free → spend stays 0; paid backends accrue real spend.

const entries: LedgerEntry[] = [];
let seq = 0;

// crude demo rate — real metering lands with usage rows. owned = free.
const RATE_PER_1K: Record<string, number> = { vllm: 0.0008, ollama: 0.0006, proxy: 0.0015 };

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

// meter a completed inference → ledger spend (0 for owned compute).
export function meter(provider: string, backend: Backend, tokens: number, modelSlug: string): void {
  if (!backend.paid) return; // owned temple, free marginal cost
  const cost = (tokens / 1000) * (RATE_PER_1K[backend.runtime] ?? 0.0015);
  record("spend", cost, provider, `inference · ${modelSlug} · ${tokens}tok`);
}

export function ledger(): LedgerEntry[] {
  return entries;
}

// float = compute credit balance the steward watches. seeded for the demo.
let seededFloat = 24;
export function floatUsd(): number {
  const delta = entries.reduce((s, e) => s + (e.kind === "income" ? e.amountUsd : -e.amountUsd), 0);
  return Number((seededFloat + delta).toFixed(2));
}
export function seedFloat(v: number): void {
  seededFloat = v;
}

// steward decision (pure) — does the float need a top-up? Stripe Skills call lands D6.
export function stewardDecision(): { topUp: boolean; amount: number; float: number } {
  const f = floatUsd();
  return { topUp: f < FLOAT.lowWater, amount: FLOAT.topUp, float: f };
}
