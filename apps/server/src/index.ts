import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { MODELS, PROFILES } from "./seed";
import { dispatch } from "./router";
import { getBackend } from "./backends";
import { startHealthLoop, snapshot } from "./health";
import { meter, ledger, floatUsd, incomeUsd, spendUsd, netUsd, stewardStatus, startStewardLoop, recordIncome } from "./ledger";
import { newSession } from "./honcho";
import type { ChatRequest, Model } from "@hermetika/shared";

const port = Number(process.env.PORT ?? 3001);

// demo revenue so the P&L has a customer side until Stripe subs land (D4).
if (process.env.SEED_DEMO_REVENUE !== "0") {
  recordIncome(30, "stripe", "pantheon pro · sub");
  recordIncome(18, "stripe", "pantheon pro · sub");
}

startHealthLoop();
startStewardLoop();

// customer auth on /v1 — shared keys for now; builder swaps for Stripe-issued per-customer keys.
const gatewayKeys = (process.env.GATEWAY_KEYS ?? "").split(",").filter(Boolean);

const HF = "https://huggingface.co/";
const withLinks = (m: Model) => ({
  ...m,
  author: m.author ?? m.hfId?.split("/")[0] ?? null,
  hfUrl: m.hfId ? HF + m.hfId.split(":")[0] : null,
});

// live resident set from Ollama /api/tags on both Sparks, cached briefly so swaps auto-surface.
let residentCache: { at: number; set: Set<string> } = { at: 0, set: new Set() };
async function residentSlugs(): Promise<Set<string>> {
  if (Date.now() - residentCache.at < 15_000) return residentCache.set;
  const names = new Set<string>();
  for (const p of ["spark", "sparktail"]) {
    const b = getBackend(p);
    if (!b?.baseUrl) continue;
    try {
      const root = b.baseUrl.replace(/\/v1\/?$/, "");
      const r = await fetch(`${root}/api/tags`, {
        headers: b.apiKey ? { authorization: `Bearer ${b.apiKey}` } : {},
        signal: AbortSignal.timeout(4000),
      });
      const j = (await r.json()) as { models?: { name: string }[] };
      for (const m of j.models ?? []) names.add(m.name.split(":")[0]!);
    } catch {}
  }
  residentCache = { at: Date.now(), set: names };
  return names;
}

const app = new Elysia()
  .use(cors())
  .onBeforeHandle(({ request, path, set }) => {
    if (!path.startsWith("/v1/") || gatewayKeys.length === 0) return; // open until keys set
    const key = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
    if (!gatewayKeys.includes(key)) return (set.status = 401), { error: "invalid api key" };
  })
  .get("/health", () => ({ ok: true, models: MODELS.length, profiles: PROFILES.length }))

  // registry
  .get("/api/models", async () => {
    const resident = await residentSlugs();
    const known = MODELS.filter((m) => m.enabled).map((m) => ({ ...withLinks(m), resident: resident.has(m.slug) }));
    const knownSlugs = new Set(MODELS.map((m) => m.slug));
    // auto-surface clean slugs present on the Sparks but not yet curated in the registry
    const extra = [...resident]
      .filter((s) => !knownSlugs.has(s) && !s.includes("/") && !s.includes("."))
      .map((s) => ({ slug: s, name: s, kind: "uncategorized", resident: true, backend: "gpu", enabled: true }));
    return [...known, ...extra];
  })
  .get("/api/models/:slug", async ({ params, status }) => {
    const m = MODELS.find((x) => x.slug === params.slug);
    if (!m) return status(404, { error: "model not found" });
    const resident = await residentSlugs();
    return { ...withLinks(m), resident: resident.has(m.slug) };
  })

  // hermes operators
  .get("/api/profiles", () => PROFILES)

  // ops surfaces — backend health + survival-loop P&L
  .get("/api/backends", () => snapshot())
  .get("/api/ledger", () => ({ float: floatUsd(), income: incomeUsd(), spend: spendUsd(), net: netUsd(), entries: ledger() }))
  .get("/api/steward", () => stewardStatus())

  // OpenAI-compatible inference gateway
  .post(
    "/v1/chat/completions",
    async ({ body, status }) => {
      const req = body as ChatRequest;
      const model = MODELS.find((m) => m.slug === req.model);
      if (!model) return status(404, { error: `unknown model '${req.model}'` });
      const session = newSession(req.sessionId ?? `s_${req.model}`);

      try {
        const { res, resolved } = await dispatch(model, req);

        // stream → pass SSE straight through (stream metering lands with usage events)
        if (req.stream) {
          return new Response(res.body, {
            status: res.status,
            headers: {
              "content-type": res.headers.get("content-type") ?? "text/event-stream",
              "x-hermetika-session": session.id,
              "x-hermetika-backend": resolved.provider,
              ...(resolved.failedOver ? { "x-hermetika-failover": "1" } : {}),
            },
          });
        }

        // non-stream → meter precisely from usage, then return
        const json = (await res.json()) as { usage?: { total_tokens?: number } };
        const tokens = json.usage?.total_tokens ?? 0;
        meter(resolved.provider, resolved.backend, tokens, model.slug);
        return new Response(JSON.stringify(json), {
          status: res.status,
          headers: {
            "content-type": "application/json",
            "x-hermetika-session": session.id,
            "x-hermetika-backend": resolved.provider,
            ...(resolved.failedOver ? { "x-hermetika-failover": "1" } : {}),
          },
        });
      } catch (e) {
        return status(502, { error: String(e) });
      }
    },
    {
      body: t.Object({
        model: t.String(),
        messages: t.Array(t.Object({ role: t.String(), content: t.String() })),
        stream: t.Optional(t.Boolean()),
        sessionId: t.Optional(t.String()),
      }),
    },
  )

  .listen(port);

console.log(`⚷ hermetika gateway → http://localhost:${port}  (${MODELS.length} models, ${PROFILES.length} operators)`);

export type App = typeof app;
