# Hermetika

An interface for the exploration of esoteric and experimental agents — a small, curated set of models served behind one OpenAI-compatible gateway, **operated by an agent, not a person**. A Hermes peer (`hermetika`) runs the business layer: it curates which models are admitted, watches backend health, and fails lanes over. Humans browse, chat, and subscribe; the operator keeps the lights on.

Owned floor, paid ceiling: the esoteric set is self-hosted on a DGX Spark over Tailscale (zero marginal cost), with proxied flagships as the paid ceiling.

Built for the Hermes Agent Accelerated Business Hackathon (NVIDIA × Stripe × Nous).

---

## What it is

- **A curated deck of ~18 models** — artistic, ASCII, esoteric, visual, wordplay — each with a real model card, author, license, and lineage.
- **A tiling sandbox** — open models in a keyboard-driven window manager, chat in a continuous terminal flow, swap models per window.
- **A subscription business** — a free tier (5 messages per model) gated by real auth; **$3/mo** unlocks unlimited access via Stripe.
- **Run by an agent** — the `hermetika` operator admits models, watches health, and curates the deck. It runs the business; it does not gate access.

---

## Architecture

```
┌─ BROWSER ─────────────────────────────────────────────┐
│  Vite + React sandbox                                  │
│  tiling window manager · model cards · terminal chat   │
│  Supabase auth (magic link) · subscribe                │
└───────────────────────────┬───────────────────────────┘
                            │  /api  ·  /v1
┌─ GATEWAY ─────────────────┴────────────────────────────┐
│  Elysia on Bun                                          │
│                                                         │
│   INFERENCE  POST /v1/chat/completions  (OpenAI-compat) │
│   ROUTER     slug → backend resolution + failover       │
│   AUTH       verifies the Supabase JWT server-side      │
│   RATE-LIMIT free tier: 5 messages per model            │
│   BILLING    /api/subscribe → Stripe Checkout           │
│   WEBHOOKS   /webhooks/stripe → activate subscription   │
│   OPERATOR   /api/nudge → admit models live             │
└──┬───────────────────────────────┬────────────────┬────┘
  │ dispatch                        │ auth           │ billing
  ▼                                 ▼                ▼
┌─ COMPUTE ──────────┐   ┌─ SUPABASE ─┐   ┌─ STRIPE ──────┐
│ gpu://spark  vLLM  │   │  auth      │   │  Checkout     │
│ gpu://sparktail    │   │  (JWT)     │   │  + subs       │
│   Ollama (breadth) │   └────────────┘   │  webhooks     │
│ proxy://{nvidia,   │                     └───────────────┘
│   nous, openrouter}│
└─────────▲──────────┘
          └─ Tailscale: DGX Spark (owned floor, free marginal cost)
```

---

## Run locally

Requires [Bun](https://bun.sh). Runs fully in **demo mode with no keys** — every external rail (Stripe, Supabase, Spark, proxies) degrades to a safe stub, so the UI and gateway come up without a single credential.

```sh
bun install         # workspace install (server + web + shared)
bun run dev         # gateway :3001 + sandbox :5173
```

Or each side alone:

```sh
bun run dev:server  # Elysia gateway on http://localhost:3001
bun run dev:web     # Vite sandbox on  http://localhost:5173  (proxies /api and /v1 → :3001)
```

Copy `apps/server/.env.example` → `apps/server/.env` and `apps/web/.env.example` → `apps/web/.env.local`, then fill keys as you go — each one upgrades a stub to real.

---

## Endpoints

The real routes from `apps/server/src/index.ts`:

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/health` | Liveness — `ok`, model count, operator count. |
| `GET`  | `/api/models` | Registry — all enabled models (author, params, license, lineage, HF link). |
| `GET`  | `/api/models/:slug` | One model card by slug (404 if unknown). |
| `GET`  | `/api/profiles` | The Hermes operator(s). |
| `GET`  | `/api/backends` | Live backend health snapshot (drives failover). |
| `GET`  | `/api/auth/me` | Identity + subscription status for the bearer token. |
| `GET`  | `/api/subscribe` | Mint a Stripe Checkout link (demo link with no key). |
| `POST` | `/api/subscribe/demo` | Demo-mode grant — activates the signed-in user without Stripe (refused when live). |
| `GET`  | `/api/portal` | Stripe Billing Portal link for the signed-in customer. |
| `GET`  | `/api/subscriptions` | Active subscriptions. |
| `GET`  | `/api/revenue` | Subscription revenue summary (MRR, active count). |
| `GET`  | `/api/sessions`, `/api/sessions/:id` | Persisted chat sessions for the signed-in user. |
| `POST` | `/v1/chat/completions` | OpenAI-compatible gateway; routes `model` slug → backend, meters the free tier, streams SSE. |
| `POST` | `/api/nudge` | Operator admits models live (`"slug"` or `"slug:license"`). |
| `POST` | `/webhooks/stripe` | Stripe webhook — verifies signature (real mode), activates/cancels subscriptions. |

---

## Access model

- **Free tier** — 5 messages per model, enforced server-side (keyed by identity + model slug, unbypassable from the client).
- **Subscriber** — `$3/mo` via Stripe Checkout; the webhook flips the account to unlimited.
- **Auth** — Supabase magic-link / OTP; the gateway verifies the JWT on every request.
- **Comps** — `HERMETIKA_PRO_EMAILS` (comma-separated) marks accounts pro regardless of Stripe.

---

## Status

Honest state of the entry.

**Built**
- OpenAI-compatible **gateway** with streaming SSE passthrough.
- **Router** — slug → backend across two-lane self-host + proxies, with failover.
- **Two-lane backends** — `gpu://spark` (vLLM hot), `gpu://sparktail` (Ollama breadth), `proxy://{nvidia,nous,openrouter}`.
- **Real auth** — Supabase magic-link, JWT verified server-side.
- **Per-model rate limiting** — free tier enforced at the gateway.
- **Real Stripe** — Checkout (subscription mode), signature-verified webhooks, Billing Portal.
- **Operator admission** — `/api/nudge` admits models via a license-gated path.
- **Sandbox UI** — tiling window manager, per-model chat, themes, keyboard shortcuts.

**Roadmap**
- **Durable subscriptions** — subscription state is in-memory today; the Supabase `subscriptions` table + registered webhook make it survive restarts.
- **Custom SMTP** — sign-in emails use Supabase's built-in service (rate-limited); a real SMTP provider is needed for public traffic.
- **Operator reasoning via Hermes** — admission/curation is deterministic; narrating it through a Hermes model is next.

---

## Stack

Bun workspace · Elysia (gateway) · Vite + React + TypeScript (sandbox) · Supabase (auth) · Stripe (subscriptions). Self-hosted on an owned DGX Spark (vLLM + Ollama over Tailscale); flagships proxied via build.nvidia.com / Nous / OpenRouter. Deployed on Cloudflare Pages (web) + Fly.io (gateway).
