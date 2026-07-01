# Handoff — Hermetika Operator Agent + Subscription Pantheon

Build a custom Hermes-agent profile (`hermetika`) that operates a curated, self-hosted
model pantheon: it notifies Eri of subscription + model-status events, and helps her
swap models in the infra through defined skills (tools). Human-in-the-loop for any
state change. No autonomous "survival loop," no proxying.

---

## Product decision (locked)

- **Everything self-hosted** on two owned DGX Sparks. **No proxy providers, no Brev, no Modal.**
- **Stripe = plain subscription billing** for pantheon access. No "agent buys its own compute,"
  no steward, no survival loop, no Stripe Issuing spend rail. Delete that machinery.
- **One custom operator agent** — `hermes.hermetika` — that: (1) watches Stripe subs + model
  health and **notifies Eri**, (2) **helps Eri swap/pull/retire models** on the Sparks via skills.
- HITL: read-only status + notifications are autonomous; **any state-changing infra op
  (pull that evicts, swap, retire) requires Eri's explicit approval before executing.**

---

## Live infra state (verified — do not re-derive)

Two DGX Sparks (GB10, 128GB unified each, aarch64, ~3T disk free), reached over Tailscale:

```
spark-1  host spark-66f4  100.72.92.74   ssh eri@spark-1   HOT lane
spark-2  host spark-1a01  100.68.36.57   ssh eri@spark-2   BREADTH lane
```

- ssh user is `eri` (Tailscale SSH). No passwordless sudo — root steps must be handed to Eri.
- **Ollama** installed + `active` (systemd) on both, API 200 at `127.0.0.1:11434`.
  - IT ONLY BINDS LOCALHOST. To reach it from the gateway, Eri must set
    `OLLAMA_HOST=0.0.0.0:11434` via a systemd override on both boxes (one sudo step —
    write the override, hand Eri the exact command, don't try to sudo yourself).
- Prior workload `stepfun-ai/Step-3.7` ran as docker container **`vllm_node`** — currently
  **stopped** on both (freed ~115GB). Restore anytime with `docker start vllm_node` (eri is in
  the docker group; no sudo). Leave it stopped.
- Models pulled via `ollama pull hf.co/<repo>:<quant>` (all public/ungated GGUF):
  - spark-1: `TheBloke/Hermes-Trismegistus-Mistral-7B-GGUF:Q4_K_M`,
    `NousResearch/Hermes-3-Llama-3.2-3B-GGUF:Q4_K_M`,
    `bartowski/Dolphin3.0-Qwen2.5-0.5B-GGUF:Q4_K_M`, `liminerity/mm4.ascii.star.gguf`
  - spark-2: `TheBloke/Mistral-Trismegistus-7B-GGUF:Q4_K_M`,
    `bartowski/Dolphin3.0-Qwen2.5-3b-GGUF:Q4_K_M`
  - CONFIRM final state with `ollama list` on each box before wiring.
- **Rename to clean slugs**: `ollama cp hf.co/TheBloke/Hermes-Trismegistus-Mistral-7B-GGUF:Q4_K_M
  hermes-trismegistus` so the Ollama model name == registry slug (router resolves cleanly).

Agent brain: default to **self-hosted `hermes-3-mini` (Hermes-3-Llama-3.2-3B)** on spark-1 for
full sovereignty + tool-calling. Confirm its function-calling is good enough for the skills; if
not, ask Eri before reaching for any external model.

---

## Repo (Bun monorepo)

Root: the repo checkout directory. **Work in a git worktree.**
Package managers: **bun** (JS/TS), **uv** (Python) — never npm/pip.

```
packages/shared/src/index.ts   Model, Profile, ChatRequest, LedgerEntry types (+ ModelKind
                               already extended: art|ascii|visual|tech|puzzle|wordplay|
                               story|music|esoteric; Model has hfId?/license?/params?)
apps/server/src/
  backends.ts   backend registry. KEEP spark(spark-1,vLLM/ollama) + sparktail(spark-2).
                DELETE brev, modal, nvidia, nous, openrouter.
  seed.ts       MODELS[] + PROFILES[]. DELETE proxy rows (hermes-4, nemotron) + the brev
                dolphin row (move Dolphin-3b onto a Spark). Keep only self-hosted.
  router.ts     slug -> ollama model on the right Spark. DELETE the proxy branch.
  stripe.ts     KEEP subscription/checkout. 
  issuing.ts spend.ts ledger.ts   REMOVE steward survival top-up + issuing spend rail.
                Keep a simple income/usage ledger for the subs dashboard only.
  honcho.ts     hermetika peer (operator memory + reasoning).
  health.ts     per-Spark + per-model health.
  index.ts      Elysia app wiring.
apps/web/        Vite+React SPA (pantheon grid, chat, subscribe).
```

Read these before writing. Match existing idioms. One-line comments only, WHY not WHAT.

---

## The `hermetika` operator agent — skills to build

Expose as gateway functions the agent can call. Each returns human-legible, turn-grouped output.

**Read-only (autonomous):**
- `pantheon.list()` — registry rows + live resident state (`ollama list`/`ps` on both Sparks).
- `spark.status()` — per-box: ollama up?, models loaded, tok/s on a probe gen, mem/disk.
- `subs.report()` — Stripe: active subs, MRR, new/canceled since last check.

**State-changing (require Eri's explicit approval before executing):**
- `model.pull(hfId, lane)` — `ollama pull` onto spark-1|spark-2, then `ollama cp` to a clean slug,
  then a smoke-test gen. Report progress.
- `model.swap(slug, newHfId)` — pull new + verify gen + repoint registry + remove old.
- `model.retire(slug)` — disable in registry + `ollama rm` on the box.

**Notifications (autonomous, outbound to Eri):**
- `notify(message)` — push to Eri. Default sink: Discord webhook (env `DISCORD_WEBHOOK_URL`);
  make the sink pluggable (Telegram optional). Fire on: new/canceled subscription (Stripe
  webhook), model/lane down, disk/mem over threshold, pull/swap complete.
- A scheduled tick (cron, e.g. every N min) runs `spark.status()` + `subs.report()` and
  notifies **only on change** (no spam).

Infra ops execute over `ssh eri@spark-{1,2}` + the Ollama HTTP API. Skills that mutate must
print exactly what they'll run and wait for approval.

---

## Stripe (subscription only)

- One product/price ("Pantheon Pro"), Stripe Checkout for signup, customer portal for manage.
- Webhook `/webhooks/stripe`: `checkout.session.completed` -> mark sub active + `notify`;
  `customer.subscription.deleted` -> mark canceled + `notify`.
- Gate inference: `/v1/chat/completions` checks an active sub (free tier optional: N calls/day).
- Test mode through submission; live keys at the end. Keys via env, never committed.

---

## Constraints

- **No proxy, no survival loop, no Issuing spend rail.** Delete that code, don't leave it dark.
- HITL for every state change (infra + any outbound post). Read-only + notify are autonomous.
- Aesthetic: techo-digital × liquid-metal hardware panel; **Wada Sanzo palettes 235, 234, 238/239**;
  CSS custom properties only (no inline hex / Tailwind arbitrary colors); 0px radius on structural
  elements. **Safety-gated motion: slow/continuous only, no flash/strobe** (hard epilepsy
  requirement), honor `prefers-reduced-motion`.
- Git: small task-specific commits; preserve authorship; **no Co-Authored-By, no AI attribution**.
- Verify by running it (live gen through the router, real webhook event) — not just types compiling.

## Acceptance

1. Gateway serves `/v1/chat/completions` with `model=hermes-trismegistus` streaming real tokens
   from spark-1 over Tailscale. Occult prompt -> in-character answer.
2. `hermetika` answers "what's the pantheon status?" by calling `spark.status()` + `pantheon.list()`
   and returns a legible report.
3. A test Stripe subscription fires a Discord notification via `notify`.
4. Eri says "swap ascii-star for <hfId>" -> agent proposes the plan, waits for approval, executes,
   verifies with a gen, updates the registry.
5. Proxy/steward/issuing code is gone. Pantheon is 100% self-hosted on the two Sparks.
