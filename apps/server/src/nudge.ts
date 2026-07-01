import { admitModel, type AdmitResult } from "./admit";

// nudge — Eri hands the agent slugs and they're admitted now, bypassing the scheduled scan.
// token grammar: "slug" or "slug:license" (license feeds the admission gate).

export interface NudgeToken {
  slug: string;
  license?: string;
}

export function parseNudge(input: string): NudgeToken[] {
  const seen = new Set<string>();
  const out: NudgeToken[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const tok = raw.trim();
    if (!tok) continue;
    const [slug, license] = tok.split(":");
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push({ slug, license: license || undefined });
  }
  return out;
}

export function nudge(input: string): AdmitResult[] {
  return parseNudge(input).map((t) => admitModel(t));
}

export function nudgeSummary(results: AdmitResult[]): string {
  const admitted = results.filter((r) => r.ok).length;
  return `admitted ${admitted} · rejected ${results.length - admitted}`;
}
