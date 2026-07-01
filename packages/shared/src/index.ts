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

// customer side — subscriptions feed the income lane of the ledger.
export type SubscriptionStatus = "active" | "canceled" | "past_due";

export interface Subscription {
  id: string;
  modelSlug: string;
  customerRef: string; // stripe customer id or email
  status: SubscriptionStatus;
  priceUsd: number;
  createdAt: string;
}

// a Stripe Checkout session the sandbox opens to start a subscription.
export interface CheckoutSession {
  id: string;
  url: string; // hosted checkout url (stub url in demo mode)
  modelSlug: string;
  priceUsd: number;
}

// per-call usage row (mirrors Supabase `usage`); powers the sandbox meter + spend lane.
export interface UsageRow {
  id: string;
  modelSlug: string;
  provider: string;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  sessionId: string;
  createdAt: string;
}

// pantheon pricing defaults.
export const PRICING = {
  defaultMonthlyUsd: 2,
} as const;
