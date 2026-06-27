// shared types — money + registry shapes mirror Supabase; sessions live in Honcho.

export type ModelKind = "art" | "ascii" | "visual" | "tech";
export type Backend = "gpu" | "proxy";

// backend_ref grammar: "<gpu|proxy>://<provider>/<id>"  e.g. "gpu://brev/oracle-07"
export type BackendRef = `${Backend}://${string}/${string}`;

export interface Model {
  id: string;
  slug: string;
  name: string;
  kind: ModelKind;
  lineage: string | null; // parent slug — the "dynasty"
  backend: Backend;
  backendRef: BackendRef;
  speed: "fast" | "standard"; // fast = 1-3B hot lane (vLLM); standard = everything else
  releasedAt: string; // ISO date
  cardMd: string;
  tags: string[];
  enabled: boolean;
}

export type ProfileRole = "orchestrator" | "curator" | "ops" | "steward";

export interface Profile {
  id: string;
  slug: string; // e.g. "hermes.hermetika"
  name: string;
  peerId: string; // honcho peer
  role: ProfileRole;
  curates: string[]; // model slugs
}

// OpenAI-compatible chat surface
export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  model: string; // slug
  messages: ChatMessage[];
  stream?: boolean;
  sessionId?: string; // honcho session for continuity across the deck
}

// the survival ledger
export type LedgerKind = "income" | "spend";

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amountUsd: number;
  ref: string; // stripe | brev | api
  profile: string | null;
  note: string;
  createdAt: string;
}

// demo-tuned float mechanics for the survival loop
export const FLOAT = {
  lowWater: 20,
  topUp: 25,
  tickMs: 10_000, // steward evaluates float on this cadence
  cooldownMs: 30_000, // min gap between autonomous top-ups so one dip = one charge
} as const;
