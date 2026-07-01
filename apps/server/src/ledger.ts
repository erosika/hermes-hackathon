import { type LedgerEntry } from "@hermetika/shared";

// subscription revenue log — one row per Stripe payment (audit trail behind MRR).
// self-hosted inference is free; the only money is subscription income. no float,
// no spend, no survival loop. in-memory now; Supabase is system-of-record at D4.

const entries: LedgerEntry[] = [];
let seq = 0;

export function recordIncome(amountUsd: number, ref: string, note: string): LedgerEntry {
  const e: LedgerEntry = {
    id: `l_${++seq}`,
    kind: "income",
    amountUsd: Number(amountUsd.toFixed(2)),
    ref,
    profile: null,
    note,
    createdAt: new Date().toISOString(),
  };
  entries.push(e);
  return e;
}

export function incomeEntries(): LedgerEntry[] {
  return entries;
}

export function incomeUsd(): number {
  return Number(entries.reduce((s, e) => s + e.amountUsd, 0).toFixed(2));
}

// test seam — clears the income log between cases.
export function __resetLedgerForTest(): void {
  entries.length = 0;
  seq = 0;
}
