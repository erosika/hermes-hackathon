// free-tier limiter — 5 messages per model per identity, then subscribe.
// keyed by (identity, model) so each model gets its own free allowance.
// in-memory, single instance; Redis-backed is the multi-node upgrade.

export const FREE = { perModel: 5 } as const;

const used = new Map<string, number>(); // key: `${identity}|${modelSlug}`

export interface RateResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

export function checkFreeTier(identity: string, modelSlug: string): RateResult {
  const key = `${identity}|${modelSlug}`;
  const n = used.get(key) ?? 0;
  if (n >= FREE.perModel) {
    return { allowed: false, remaining: 0, reason: `free limit: ${FREE.perModel} messages per model — subscribe for unlimited` };
  }
  used.set(key, n + 1);
  return { allowed: true, remaining: FREE.perModel - (n + 1) };
}

export function __resetRateLimitForTest(): void {
  used.clear();
}
