# Hermetika

A curated inference **pantheon** — a small, opinionated set of esoteric and experimental models served behind one OpenAI-compatible gateway — that is **operated by agents, not people**. Two Hermes peers run it end to end: `hermetika` (orchestrator / curator / ops — admits models, watches health, fails backends over) and `steward` (money — reads the ledger, watches the compute float, buys its own compute). The thesis is the **survival loop**: a customer subscribes via Stripe, the income lands on the ledger, and when the compute float dips below its low-water mark the steward autonomously tops itself up — buying the very compute that keeps the pantheon lit. Owned floor (a DGX Spark on Tailscale, free marginal cost), paid ceiling (NVIDIA Brev burst + proxied flagships). A human never touches the hot loop.

Built for the Hermes Agent Accelerated Business Hackathon (NVIDIA × Stripe × Nous).

---

## Architecture

```
┌─ BROWSER ─────────────────────────────────────────────┐
│  Vite + React sandbox (:5173)                          │
│  pantheon grid · model cards · live ledger meter        │
│  chat / run · subscribe                                 │
└───────────────────────────┬───────────────────────────┘
                            │  /api  ·  /v1   (vite proxy → :3001)
┌─ SERVER ──────────────────┴────────────────────────────┐
│  Elysia on Bun  (:3001)                                 │
│                                                         │
│   GATEWAY   POST /v1/chat/completions  (OpenAI-compat)  │
│   ROUTER    slug → backend resolution + failover        │
│   LEDGER    two balances: USD cash P&L + compute float  │
│   STEWARD   loop: float < low-water → guarded top-up    │
│   WEBHOOKS  /webhooks/stripe → book income              │
│   NUDGE     /api/nudge → admit models live              │
└──┬────────────────┬───────────────┬───────────────┬────┘
  │ dispatch        │ income        │ top-up spend  │ persist
  ▼                ▼               ▼               ▼
┌─ CLOUD / COMPUTE ─┐ ┌─ STRIPE ──┐ ┌─ STRIPE ────┐ ┌─ SUPABASE ─┐
│ gpu://spark  vLLM │ │ Checkout  │ │ Issuing /   │ │ pg + auth  │
│ gpu://sparktail   │ │ + subs    │ │ Skills rail │ │ registry   │
│   Ollama (paged)  │ │ webhooks  │ │ (agent      │ │ ledger     │
│ gpu://brev  burst │ │           │ │  wallet)    │ │ subs       │
│ proxy://nvidia    │ └─────┬─────┘ └──────┬──────┘ └────────────┘
│ proxy://nous      │       │ income        │ spend
│ proxy://openrouter│       └───────────────┴──► LEDGER (net = money-shot)
└─────────▲─────────┘
          └─ Tailscale: DGX Spark (owned floor, free marginal cost)
```

Owned floor, paid ceiling: the Spark serves the esoteric set at zero marginal cost; the steward's real recurring spend is Brev burst + proxy API credits — the line item it pays to survive.

---

## Run locally

Requires [Bun](https://bun.sh). Runs fully in **demo / dry-run mode with no keys** — every external rail (Stripe, Brev, Spark, Honcho, Supabase) degrades to a safe stub, so the whole survival loop fires locally without a single credential.

```sh
bun install         # workspace install (server + web + shared)
bun run dev         # both apps: gateway :3001 + sandbox :5173
```

Or run each side alone:

```sh
bun run dev:server  # Elysia gateway on http://localhost:3001
bun run dev:web     # Vite sandbox on  http://localhost:5173  (proxies /api and /v1 → :3001)
```

Copy `apps/server/.env.example` → `apps/server/.env` and fill in as you go — each key upgrades one stub to real. See [CHECKLIST.md](./CHECKLIST.md) for the account-side setup.

---

## Endpoints

The real routes from `apps/server/src/index.ts`:

| Method | Route | Description |
|--------|-------|-------------|
| `GET`  | `/health` | Liveness — returns `ok`, model count, operator count. |
| `GET`  | `/api/models` | Registry — all enabled models in the pantheon. |
| `GET`  | `/api/models/:slug` | One model card by slug (404 if unknown). |
| `GET`  | `/api/profiles` | The Hermes operators (`hermetika`, `steward`). |
| `GET`  | `/api/backends` | Live backend health snapshot (drives failover). |
| `GET`  | `/api/ledger` | Survival-loop P&L: `float`, `income`, `spend`, `net`, entries. |
| `GET`  | `/api/steward` | Steward status — top-up decision, P&L, last action. |
| `GET`  | `/api/subscriptions` | Active subscriptions (customer side). |
| `POST` | `/v1/chat/completions` | OpenAI-compatible inference gateway; routes `model` slug → backend, meters tokens, streams SSE through. |
| `POST` | `/api/checkout` | Mint a Checkout session for a model slug (demo session with no Stripe key). |
| `POST` | `/api/nudge` | Hand the agent slugs (`"slug"` or `"slug:license"`) → admitted live, bypassing the scheduled scan. |
| `POST` | `/webhooks/stripe` | Stripe income webhook — books revenue (demo mode parses directly; real mode verifies the signature). |
| `GET`  | `/checkout/demo` | Demo checkout page — opening it fires `checkout.session.completed` and books income without real Stripe. |

---

## Survival loop in one curl

Seed the float just above low-water, drive the steward under it, watch it pay its own bill. No keys required.

```sh
# 1. mint a demo checkout session for a model (returns a /checkout/demo url)
curl -s localhost:3001/api/checkout -H 'content-type: application/json' \
  -d '{"slug":"oracle-07"}'

# 2. "complete" that checkout → books customer income onto the ledger
curl -s 'localhost:3001/checkout/demo?slug=oracle-07&price=12'

# 3. watch the P&L: income in, float, net
curl -s localhost:3001/api/ledger
curl -s localhost:3001/api/steward
```

Paid inference burns the compute float. When it dips below `lowWater` ($20), the steward loop autonomously fires a guarded top-up (`topUp` $25) through its spend rail and books a `spend` row — logged to the gateway console as:

```
⚷ steward: float $19.40 < $20 → top-up $25 → float $44.40 · net $30.60
```

Income up, compute paid for, still net positive — and a human never touched it.

---

## Status

Honest state of the entry.

**Built**
- OpenAI-compatible **gateway** (`/v1/chat/completions`) with streaming SSE passthrough.
- **Router** — slug → backend resolution across two-lane self-host + proxies, with failover.
- **Two-lane backends** — `gpu://spark` (vLLM hot), `gpu://sparktail` (Ollama breadth), `gpu://brev` (paid burst), `proxy://{nvidia,nous,openrouter}`.
- **Ledger** — two-balance accounting: USD cash P&L (income/spend) + compute-credit float.
- **Steward** — survival loop tick: low-water detection, cooldown gate, guarded spend, booked top-ups.
- **Checkout + webhook** (demo) — `/api/checkout` → `/checkout/demo` → income booked; `/webhooks/stripe` handler.
- **Admission + nudge** — `/api/nudge` admits models live via a license-gated admission path.
- **Sandbox UI** — Vite/React pantheon grid + live ledger meter (float / net / income / spend).
- **Streaming chat** — SSE relayed through the gateway with backend/session/failover headers.

**Stubbed / next**
- **Stripe live keys** — Checkout, subscriptions, and Issuing/Skills spend rail are scaffolded and degrade to demo without `STRIPE_SECRET_KEY`.
- **Honcho real sessions** — session manager + operator peer memory are stubbed; SDK wiring pending.
- **Supabase persistence** — schema scaffolded (registry / subs / usage / ledger / shares); ledger is in-memory today.
- **Steward reasoning via Hermes-4** — the loop is deterministic; narrating decisions through Hermes-4 within the rails is the next roadmap item.

See [CHECKLIST.md](./CHECKLIST.md) for the account-side setup (Stripe Issuing, subs, Honcho, Supabase, compute keys, deploy).

---

## Stack

Bun workspace · Elysia (gateway) · Vite + React (sandbox) · TypeScript throughout. Self-host on an owned DGX Spark (vLLM + Ollama over Tailscale) with NVIDIA Brev paid burst; flagships proxied via build.nvidia.com / Nous / OpenRouter. Stripe for the survival loop; Honcho for sessions + operator memory; Supabase as system-of-record.
