import { useSyncExternalStore } from "react";

// global free-tier state, shared across every sandbox window so the limit can't be
// dodged by opening/swapping windows. synced from the gateway's response headers;
// the server is the hard enforcer (402), this just reflects it in the UI.
export interface RateSnap {
  remaining: number | null; // null = unknown until first call; number = free calls left
  pro: boolean;
}

let snap: RateSnap = { remaining: null, pro: false };
const subs = new Set<() => void>();

export function setRate(remaining: number | null, pro: boolean): void {
  snap = { remaining, pro };
  subs.forEach((f) => f());
}

export function useRate(): RateSnap {
  return useSyncExternalStore(
    (cb) => { subs.add(cb); return () => subs.delete(cb); },
    () => snap,
    () => snap,
  );
}
