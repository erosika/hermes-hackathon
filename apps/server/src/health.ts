import { BACKENDS } from "./backends";

// backend health — cheap cached pings so failover is instant, not per-request.
// hermetika reads this to swing spark→brev. no backend configured = treated down.

type Status = { up: boolean; checkedAt: number; ms: number | null };
const status = new Map<string, Status>();

const STALE_MS = 15_000;

export function isHealthy(provider: string): boolean {
  const s = status.get(provider);
  if (!s) return false; // unknown until first probe
  return s.up;
}

export function snapshot(): Record<string, Status> {
  return Object.fromEntries(status);
}

async function ping(provider: string): Promise<void> {
  const b = BACKENDS[provider];
  if (!b?.baseUrl) {
    status.set(provider, { up: false, checkedAt: Date.now(), ms: null });
    return;
  }
  const t0 = Date.now();
  try {
    const r = await fetch(`${b.baseUrl}/models`, {
      headers: b.apiKey ? { authorization: `Bearer ${b.apiKey}` } : {},
      signal: AbortSignal.timeout(4000),
    });
    status.set(provider, { up: r.ok, checkedAt: Date.now(), ms: Date.now() - t0 });
  } catch {
    status.set(provider, { up: false, checkedAt: Date.now(), ms: null });
  }
}

export async function pollAll(): Promise<void> {
  await Promise.all(Object.keys(BACKENDS).map(ping));
}

// background poller — keep status fresh without blocking requests.
export function startHealthLoop(): void {
  void pollAll();
  setInterval(() => void pollAll(), STALE_MS);
}
