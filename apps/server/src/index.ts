import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { MODELS, PROFILES } from "./seed";
import { dispatch } from "./router";
import { getBackend } from "./backends";
import { startHealthLoop, snapshot } from "./health";
import { incomeEntries, incomeUsd, recordIncome } from "./ledger";
import { activateSubscription, listSubscriptions, subscriptionSummary, isSubscribed } from "./subscriptions";
import { subscribeUrl, portalUrl, PLAN } from "./billing";
import { readIdentity, authConfigured } from "./auth";
import { checkFreeTier, FREE } from "./ratelimit";
import { newSession } from "./honcho";
import { ensureSession, appendMessages, listSessions, getSessionMessages } from "./chats";
import { verifyAndParse, handleStripeEvent, type StripeEventLike } from "./webhooks";
import { nudge, nudgeSummary } from "./nudge";
import type { ChatRequest, Model } from "@hermetika/shared";

const port = Number(process.env.PORT ?? 3001);

// demo subscribers so MRR isn't empty until real Stripe subs land.
if (process.env.SEED_DEMO_REVENUE !== "0") {
  for (const who of ["ada@demo", "lin@demo"]) {
    activateSubscription(PLAN.slug, who, PLAN.priceUsd);
    recordIncome(PLAN.priceUsd, "stripe", `${PLAN.name} · ${who}`);
  }
}

startHealthLoop();

// prod: set CORS_ORIGIN=https://hermetika.io (comma-sep for multiple). unset = allow all (dev).
// allow any hermetika.pages.dev / hermetika.io subdomain (preview deploys) + explicit env origins.
const corsOrigin = process.env.CORS_ORIGIN
  ? [
      /^https:\/\/([a-z0-9-]+\.)?hermetika\.pages\.dev$/,
      /^https:\/\/([a-z0-9-]+\.)?hermetika\.io$/,
      ...process.env.CORS_ORIGIN.split(",").map((s) => s.trim()),
    ]
  : true;

// input/output guards — protect the GPUs from oversized prompts + runaway generations.
const MAX_INPUT_CHARS = Number(process.env.MAX_INPUT_CHARS ?? 24000); // ~6k tokens
const MAX_OUTPUT_TOKENS = Number(process.env.MAX_OUTPUT_TOKENS ?? 2048);

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
  .use(cors({ origin: corsOrigin }))
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

  // hermes operators + backend health
  .get("/api/profiles", () => PROFILES)
  .get("/api/backends", () => snapshot())

  // auth — identity from the Supabase JWT (Bearer). sign-in itself happens client-side.
  .get("/api/auth/me", async ({ request }) => {
    const id = await readIdentity(request);
    return { email: id?.email ?? null, subscribed: id ? isSubscribed(id.email) : false, authConfigured: authConfigured() };
  })

  // subscription business — one plan, MRR + income log
  .get("/api/revenue", () => ({ ...subscriptionSummary(), incomeTotal: incomeUsd(), entries: incomeEntries() }))
  .get("/api/subscriptions", () => listSubscriptions())

  // chat history — signed-in users' own transcripts (Supabase system-of-record)
  .get("/api/sessions", async ({ request, status }) => {
    const id = await readIdentity(request);
    if (!id) return status(401, { error: "sign in first" });
    return await listSessions(id.email);
  })
  .get("/api/sessions/:id", async ({ params, request, status }) => {
    const id = await readIdentity(request);
    if (!id) return status(401, { error: "sign in first" });
    const s = await getSessionMessages(params.id, id.email);
    return s ?? status(404, { error: "session not found" });
  })
  .get("/api/subscribe", async ({ request }) => {
    const id = await readIdentity(request);
    return await subscribeUrl(id?.email);
  })
  .get("/api/portal", async ({ request, status }) => {
    const id = await readIdentity(request);
    if (!id) return status(401, { error: "sign in first" });
    const url = await portalUrl(id.email);
    return url ? { url } : status(404, { error: "no billing account yet — subscribe first" });
  })

  // demo checkout — opening the subscribe url books a Pantheon Pro sub for the signed-in email.
  .get("/checkout/demo", async ({ query }) => {
    const price = Number(query.price ?? PLAN.priceUsd);
    const email = String(query.email ?? "demo@hermetika");
    const evt: StripeEventLike = {
      type: "checkout.session.completed",
      data: { object: { amount_total: Math.round(price * 100), customer_email: email } },
    };
    const r = await handleStripeEvent(evt);
    const html = `<!doctype html><meta charset="utf-8"><body style="font-family:monospace;background:#17100a;color:#ecdcae;padding:2rem"><p>${PLAN.name}</p><p>subscription active · ${r.note}</p><p>close this tab to return.</p></body>`;
    return new Response(html, { headers: { "content-type": "text/html" } });
  })

  // hermes ops — nudge admits models live
  .post("/api/nudge", ({ body }) => {
    const results = nudge((body as { input: string }).input);
    return { summary: nudgeSummary(results), results };
  }, { body: t.Object({ input: t.String() }) })

  // stripe income webhook — raw body for signature verification (real mode); demo parses json
  .post("/webhooks/stripe", async ({ body, request, status }) => {
    try {
      const evt = await verifyAndParse(String(body), request.headers.get("stripe-signature") ?? undefined);
      return await handleStripeEvent(evt);
    } catch (e) {
      return status(400, { error: `webhook: ${String(e)}` });
    }
  }, { parse: "text" })

  // OpenAI-compatible inference gateway
  .post(
    "/v1/chat/completions",
    async ({ body, status, request }) => {
      const req = body as ChatRequest;
      const model = MODELS.find((m) => m.slug === req.model);
      if (!model) return status(404, { error: `unknown model '${req.model}'` });
      const inputChars = req.messages.reduce((n, m) => n + m.content.length, 0);
      if (inputChars > MAX_INPUT_CHARS) {
        return status(413, { error: "input too large", max_input_chars: MAX_INPUT_CHARS, got: inputChars });
      }
      req.maxTokens = Math.min(req.maxTokens ?? MAX_OUTPUT_TOKENS, MAX_OUTPUT_TOKENS);

      // access gate — subscribers are unlimited; everyone else gets the free tier.
      const id = await readIdentity(request);
      const email = id?.email ?? null;
      const pro = email ? isSubscribed(email) : false;
      let freeRemaining: number = FREE.lifetime;
      if (!pro) {
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
        const rl = checkFreeTier(email ?? ip, ip);
        if (!rl.allowed) return status(402, { error: rl.reason, upgrade: "/api/subscribe" });
        freeRemaining = rl.remaining;
      }
      const session = newSession(req.sessionId ?? `s_${req.model}`);
      const lastUser = [...req.messages].reverse().find((m) => m.role === "user");
      if (email) {
        await ensureSession(session.id, email, model.slug, lastUser?.content.slice(0, 80));
        if (lastUser) await appendMessages(session.id, [{ role: "user", content: lastUser.content }]);
      }

      try {
        const { res, resolved } = await dispatch(model, req);
        const headers: Record<string, string> = {
          "x-hermetika-session": session.id,
          "x-hermetika-backend": resolved.provider,
          "x-hermetika-tier": pro ? "pro" : "free",
          ...(pro ? {} : { "x-hermetika-free-remaining": String(freeRemaining) }),
          ...(resolved.failedOver ? { "x-hermetika-failover": "1" } : {}),
        };

        if (req.stream) {
          // tee the SSE stream so the completed assistant reply persists to the transcript
          let assistant = "";
          const persist = new TransformStream<Uint8Array, Uint8Array>({
            transform(chunk, ctrl) {
              ctrl.enqueue(chunk);
              for (const line of new TextDecoder().decode(chunk).split("\n")) {
                const t = line.trim();
                if (!t.startsWith("data:")) continue;
                const p = t.slice(5).trim();
                if (p === "[DONE]") continue;
                try { assistant += JSON.parse(p).choices?.[0]?.delta?.content ?? ""; } catch {}
              }
            },
            flush() {
              if (email && assistant) void appendMessages(session.id, [{ role: "assistant", content: assistant }]);
            },
          });
          return new Response(res.body?.pipeThrough(persist), {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") ?? "text/event-stream", ...headers },
          });
        }

        const json = await res.json();
        const reply = json?.choices?.[0]?.message?.content;
        if (email && typeof reply === "string") {
          await appendMessages(session.id, [{ role: "assistant", content: reply, tokens: json?.usage?.total_tokens }]);
        }
        return new Response(JSON.stringify(json), {
          status: res.status,
          headers: { "content-type": "application/json", ...headers },
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
        maxTokens: t.Optional(t.Number()),
        sessionId: t.Optional(t.String()),
      }),
    },
  )

  .listen(port);

console.log(`☿ hermetika gateway → http://localhost:${port}  (${MODELS.length} models, ${PROFILES.length} operators)`);

export type App = typeof app;
