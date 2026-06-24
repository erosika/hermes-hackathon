import { Elysia, t } from "elysia";
import { cors } from "@elysiajs/cors";
import { MODELS, PROFILES } from "./seed";
import { dispatch } from "./router";
import { newSession } from "./honcho";
import type { ChatRequest } from "@hermetika/shared";

const port = Number(process.env.PORT ?? 3001);

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

  // OpenAI-compatible inference gateway
  .post(
    "/v1/chat/completions",
    async ({ body, status }) => {
      const req = body as ChatRequest;
      const model = MODELS.find((m) => m.slug === req.model);
      if (!model) return status(404, { error: `unknown model '${req.model}'` });
      const session = newSession(req.sessionId ?? `s_${req.model}`);
      try {
        const upstream = await dispatch(model, req);
        // pass SSE / json straight through; metering + honcho turn record land D3/D4
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "content-type": upstream.headers.get("content-type") ?? "application/json",
            "x-hermetika-session": session.id,
          },
        });
      } catch (e) {
        return status(502, { error: String(e) });
      }
    },
    {
      body: t.Object({
        model: t.String(),
        messages: t.Array(
          t.Object({ role: t.String(), content: t.String() }),
        ),
        stream: t.Optional(t.Boolean()),
        sessionId: t.Optional(t.String()),
      }),
    },
  )

  .listen(port);

console.log(`⚷ hermetika gateway → http://localhost:${port}  (${MODELS.length} models, ${PROFILES.length} operators)`);

export type App = typeof app;
