import { admitModel, type AdmitResult } from "./admit";

// nudge — Eri hands the agent slugs and they're admitted now, bypassing the scheduled scan.

export function parseNudge(input: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of input.split(/[\s,]+/)) {
    const slug = raw.trim();
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    out.push(slug);
  }
  return out;
}

export function nudge(input: string): AdmitResult[] {
  return parseNudge(input).map((slug) => admitModel({ slug }));
}

export function nudgeSummary(results: AdmitResult[]): string {
  const admitted = results.filter((r) => r.ok).length;
  return `admitted ${admitted} · rejected ${results.length - admitted}`;
}
