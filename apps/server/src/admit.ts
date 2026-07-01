// curator's admission logic — license gate + backend placement for the live "nudge" flow.
// Eri throws a slug at the agent; admitModel decides if it belongs and where it runs.
import { type Model, type ModelKind, type Backend, type BackendRef, PRICING } from "@hermetika/shared";
import { MODELS } from "./seed";

// SPDX-ish allowlist — permissive + the model-specific licenses we're willing to serve.
const ADMISSIBLE_LICENSES = new Set([
  "apache-2.0",
  "mit",
  "bsd-2-clause",
  "bsd-3-clause",
  "cc-by-4.0",
  "cc-by-sa-4.0",
  "mpl-2.0",
  "llama3",
  "llama3.1",
  "gemma",
  "openrail",
]);

export function isAdmissibleLicense(license?: string): boolean {
  if (!license) return false;
  return ADMISSIBLE_LICENSES.has(license.trim().toLowerCase());
}

export interface AdmitInput {
  slug: string;
  name?: string;
  kind?: ModelKind;
  license?: string;
  lineage?: string | null;
  tags?: string[];
  releasedAt?: string;
}

export interface AdmitResult {
  ok: boolean;
  reason: string;
  model?: Model;
}

interface Placement {
  backend: Backend;
  backendRef: BackendRef;
  speed: "fast" | "standard";
}

function place(slug: string, kind: ModelKind, tags: string[]): Placement {
  // uncensored/no-guardrails: corporate APIs refuse it → paid GPU burst (Brev).
  if (tags.includes("uncensored") || tags.includes("no-guardrails")) {
    return { backend: "gpu", backendRef: `gpu://brev/${slug}`, speed: "standard" };
  }
  // small owned showcase kinds live on the Spark hot lane; ascii is the 1-3B fast tier.
  if (kind === "ascii" || kind === "art" || kind === "visual") {
    return { backend: "gpu", backendRef: `gpu://spark/${slug}`, speed: kind === "ascii" ? "fast" : "standard" };
  }
  // flagships and everything else are proxied via OpenRouter.
  return { backend: "proxy", backendRef: `proxy://openrouter/${slug}`, speed: "standard" };
}

function titleize(slug: string): string {
  return slug
    .split(/[^a-z0-9]+/i)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function admitModel(input: AdmitInput): AdmitResult {
  if (!isAdmissibleLicense(input.license)) {
    return { ok: false, reason: `license '${input.license ?? ""}' not admissible` };
  }
  if (MODELS.some((m) => m.slug === input.slug)) {
    return { ok: false, reason: "already in the registry" };
  }

  const slug = input.slug;
  const name = input.name ?? titleize(slug);
  const kind = input.kind ?? "tech";
  const tags = input.tags ?? [];
  const license = input.license as string; // guarded by isAdmissibleLicense above
  const { backend, backendRef, speed } = place(slug, kind, tags);

  const model: Model = {
    id: `m_${slug.replace(/[^a-z0-9]/gi, "")}`,
    slug,
    name,
    kind,
    lineage: input.lineage ?? null,
    backend,
    backendRef,
    speed,
    releasedAt: input.releasedAt ?? new Date().toISOString().slice(0, 10),
    cardMd: `# ${name}\nadmitted by hermes · license ${license}`,
    tags,
    enabled: true,
    license,
    priceUsd: PRICING.defaultMonthlyUsd,
  };

  MODELS.push(model);
  return { ok: true, reason: "admitted", model };
}
