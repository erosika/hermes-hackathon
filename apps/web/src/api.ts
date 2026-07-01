import type { CheckoutSession, LedgerEntry, Model, Profile } from "@hermetika/shared";

// thin client over the gateway's REST surface.

export type { CheckoutSession };

export interface LedgerView {
  float: number; // compute-credit wallet
  income: number; // customer revenue in
  spend: number; // real USD out (steward top-ups)
  net: number; // income − spend, the money-shot
  entries: LedgerEntry[];
}

export interface StewardView {
  topUp: boolean;
  amount: number;
  float: number;
  lastAction: { at: string; amount: number; floatBefore: number; floatAfter: number } | null;
}

async function getJson<T>(path: string): Promise<T> {
  const r = await fetch(path);
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const r = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) throw new Error(`${path} → ${r.status}`);
  return r.json() as Promise<T>;
}

export const getModels = () => getJson<Model[]>("/api/models");
export const getModel = (slug: string) => getJson<Model>(`/api/models/${slug}`);
export const getProfiles = () => getJson<Profile[]>("/api/profiles");
export const getBackends = () => getJson<unknown>("/api/backends");
export const getLedger = () => getJson<LedgerView>("/api/ledger");
export const getSteward = () => getJson<StewardView>("/api/steward");

// caller decides how to open the returned url (real Stripe url or demo stub).
export const createCheckout = (slug: string) => postJson<CheckoutSession>("/api/checkout", { slug });

// derive the serving lane from a model's backend_ref for honest labels.
// gpu://spark → owned hot · gpu://sparktail → owned tail · gpu://brev → paid burst · proxy://x → proxied
export function laneLabel(backendRef: string): string {
  const provider = backendRef.split("://")[1]?.split("/")[0] ?? "";
  switch (provider) {
    case "spark":
      return "◆ owned · spark hot";
    case "sparktail":
      return "◆ owned · spark tail";
    case "brev":
      return "◇ paid · brev burst";
    case "modal":
      return "◇ paid · modal";
    default:
      return `proxy · ${provider}`;
  }
}
