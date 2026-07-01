import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { MODELS, PROFILES } from "./seed";
import { dispatch } from "./router";
import { startHealthLoop, snapshot } from "./health";
import { incomeEntries, incomeUsd, recordIncome } from "./ledger";
import { activateSubscription, listSubscriptions, subscriptionSummary, isSubscribed } from "./subscriptions";
import { subscribeUrl, PLAN } from "./billing";
import { readIdentity, authConfigured } from "./auth";
import { checkFreeTier, FREE } from "./ratelimit";
import { newSession } from "./honcho";
import { verifyAndParse, handleStripeEvent, type StripeEventLike } from "./webhooks";
import { nudge, nudgeSummary } from "./nudge";
import type { ChatRequest } from "@hermetika/shared";

const port = Number(process.env.PORT ?? 3001);

// demo subscribers so MRR isn't empty until real Stripe subs land.
if (process.env.SEED_DEMO_REVENUE !== "0") {
  for (const who of ["ada@demo", "lin@demo"]) {
    activateSubscription(PLAN.slug, who, PLAN.priceUsd);
    recordIncome(PLAN.priceUsd, "stripe", `${PLAN.name} · ${who}`);
  }
}

startHealthLoop();

const app = new Elysia()
  .use(cors())
  .get("/health", () => ({ ok: true, models: MODELS.length, profiles: PROFILES.length }))

  // registry
  .get("/api/models", () => MODELS.filter((m) => m.enabled))
  .get("/api/models/:slug", ({ params, status }) => {
    const m = MODELS.find((x) => x.slug === params.slug);
    return m ?? status(404, { error: "model not found" });
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
  .get("/api/subscribe", async ({ request }) => {
    const id = await readIdentity(request);
    return subscribeUrl(id?.email);
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

  // stripe income webhook (demo mode parses directly; real mode verifies the signature)
  .post("/webhooks/stripe", async ({ body, request }) => {
    const evt = verifyAndParse(JSON.stringify(body), request.headers.get("stripe-signature") ?? undefined);
    return handleStripeEvent(evt);
  }, { body: t.Any() })

  // OpenAI-compatible inference gateway
  .post(
    "/v1/chat/completions",
    async ({ body, status, request }) => {
      const req = body as ChatRequest;
      const model = MODELS.find((m) => m.slug === req.model);
      if (!model) return status(404, { error: `unknown model '${req.model}'` });

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
          return new Response(res.body, {
            status: res.status,
            headers: { "content-type": res.headers.get("content-type") ?? "text/event-stream", ...headers },
          });
        }

        const json = await res.json();
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
        sessionId: t.Optional(t.String()),
      }),
    },
  )

  .listen(port);

console.log(`⚷ hermetika gateway → http://localhost:${port}  (${MODELS.length} models, ${PROFILES.length} operators)`);

export type App = typeof app;
