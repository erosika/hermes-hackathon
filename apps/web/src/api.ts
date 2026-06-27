import type { LedgerEntry, Model } from "@hermetika/shared";

// thin client over the gateway's REST surface.

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

export const getModels = () => getJson<Model[]>("/api/models");
export const getLedger = () => getJson<LedgerView>("/api/ledger");
export const getSteward = () => getJson<StewardView>("/api/steward");

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
