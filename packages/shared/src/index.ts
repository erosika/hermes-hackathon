// shared types — money + registry shapes mirror Supabase; sessions live in Honcho.

export type ModelKind =
  | "art"
  | "ascii"
  | "visual"
  | "tech"
  | "puzzle"
  | "wordplay"
  | "story"
  | "music"
  | "esoteric"
  | "philosophy"
  | "horror"
  | "cursed";
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
  hfId?: string; // source weights on Hugging Face (self-hosted models)
  author?: string; // true creator (override when a GGUF requant hides it); else derived from hfId org
  params?: string; // param count, drives lane placement
  releasedAt: string; // ISO date
  cardMd: string;
  tags: string[];
  enabled: boolean;
  license?: string; // SPDX id — the admission gate (apache-2.0, mit, ...); null/absent = unvetted
  priceUsd?: number; // monthly subscription price; falls back to PRICING.defaultMonthlyUsd
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
  maxTokens?: number; // output cap; clamped to the gateway ceiling
  sessionId?: string; // honcho session for continuity across the deck
}

// subscription revenue log — one income row per Stripe payment.
export type LedgerKind = "income";

export interface LedgerEntry {
  id: string;
  kind: LedgerKind;
  amountUsd: number;
  ref: string; // stripe
  profile: string | null;
  note: string;
  createdAt: string;
}

// customer side — one Pantheon Pro subscription per customer.
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface Subscription {
  id: string;
  modelSlug: string; // plan slug (pantheon-pro)
  customerRef: string; // stripe customer id or email
  status: SubscriptionStatus;
  priceUsd: number;
  createdAt: string;
}

// per-model display price (the pantheon shows these; billing is one platform plan).
export const PRICING = {
  defaultMonthlyUsd: 3,
} as const;
