import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { MODELS, PROFILES } from "./seed";
import { dispatch } from "./router";
import { startHealthLoop, snapshot } from "./health";
import { meter, ledger, floatUsd, stewardDecision } from "./ledger";
import { newSession } from "./honcho";
import type { ChatRequest } from "@hermetika/shared";

const port = Number(process.env.PORT ?? 3001);

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

  // hermes operators
  .get("/api/profiles", () => PROFILES)

  // ops surfaces — backend health + survival-loop P&L
  .get("/api/backends", () => snapshot())
  .get("/api/ledger", () => ({ float: floatUsd(), entries: ledger() }))
  .get("/api/steward", () => stewardDecision())

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
