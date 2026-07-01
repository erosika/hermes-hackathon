// free-tier limiter — a taste, then subscribe. subscribers bypass this entirely.
// two ceilings: a lifetime trial per identity + a daily cap per IP (abuse guard).
// in-memory; single instance. Redis-backed is the multi-node upgrade.

export const FREE = { lifetime: 20, daily: 20 } as const;

const lifetimeUsed = new Map<string, number>();
const dailyUsed = new Map<string, number>();

export interface RateResult {
  allowed: boolean;
  remaining: number;
  reason?: string;
}

export function checkFreeTier(identity: string, ip: string, now = new Date()): RateResult {
  const life = lifetimeUsed.get(identity) ?? 0;
  if (life >= FREE.lifetime) {
    return { allowed: false, remaining: 0, reason: `free trial used up (${FREE.lifetime} calls) — subscribe for unlimited` };
  }
  const dayKey = `${ip}|${now.toISOString().slice(0, 10)}`;
  const day = dailyUsed.get(dayKey) ?? 0;
  if (day >= FREE.daily) {
    return { allowed: false, remaining: 0, reason: `daily free limit (${FREE.daily}/day) — subscribe for unlimited` };
  }
  lifetimeUsed.set(identity, life + 1);
  dailyUsed.set(dayKey, day + 1);
  return { allowed: true, remaining: FREE.lifetime - (life + 1) };
}

export function __resetRateLimitForTest(): void {
  lifetimeUsed.clear();
  dailyUsed.clear();
}
