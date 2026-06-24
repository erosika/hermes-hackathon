# Hermetika — Model Pantheon

Curated inference platform. 23 esoteric/experimental models, hosted + proxied, **run autonomously by a Hermes agent**. Mix-and-match, subscribe, download/share. Built for the **Hermes Agent Accelerated Business Hackathon** (NVIDIA × Stripe × Nous, due **Jun 30**).

> Scope cut: **no oracle/astrology.** Just host the models, serve inference, give a small clean experience. The Hermes agent operating it + the Stripe survival loop are the thesis.

---

## What it is

An OpenRouter-style thin layer over a *curated* pantheon — not an HF clone. The value is the curation + the operator agents + the fact that it **runs itself**.

- **Pantheon** — registry of 23 esoteric/experimental models (artistic, ASCII, visual, technical; Teknium's Hermes line as a dynasty).
- **Inference** — unified OpenAI-compatible gateway. A few self-hosted on GPU (NVIDIA Brev / Modal), the rest proxied (Nous Portal / NVIDIA build / OpenRouter / HF).
- **Hermes agent runs it** — a small set of curated **Hermes profiles** (Honcho peers) do the operating: admit models, watch health, watch the ledger, top up their own compute. No human in the hot loop.
- **Small experience** — browse pantheon → pick model(s) → chat/run → subscribe → export a portable manifest.
- **Survival loop** — customer pays via Stripe → operator agent autonomously buys its own compute via Stripe Skills. Closed P&L = the demo money-shot.

---

## Hermes profiles (the operators)

The platform is **operated by Hermes, not by Eri.** Each profile is a distinct Honcho peer with its own memory + role. Maps to the existing `multi-peer-gateway-support` work. The Hermes gateway routes ops events (new signup, low float, model down) to the right profile.

**MVP ships 2 profiles.** The other two roles are responsibilities folded into `hermetika` for now, separable into their own peers post-hackathon without a rewrite (each is already a distinct skill set on the gateway).

```
PROFILE            PEER         ROLE                              STATUS
─────────────────  ───────────  ────────────────────────────────  ──────────
hermes.hermetika   hermetika    head operator. owns the pantheon,  MVP
                                 admits/retires models, writes
                                 cards + lineage, AND watches
                                 inference health / failover.
                                 (= orchestrator + curator + ops)
hermes.steward     steward      the money. reads the usage ledger, MVP
                                 watches the compute float, fires
                                 Stripe Skills top-ups, reports
                                 P&L. closes the survival loop.

hermes.curator     curator      split out of hermetika later:      post-hack
                                 dedicated model admission peer.
hermes.ops         ops          split out later: dedicated health  post-hack
                                 + routing + smoke-test peer.
```

Each profile reasons over Honcho memory (its own peer + a shared session) and acts through the gateway's skills. The **steward** closing the survival loop autonomously is the hero shot; `hermetika` is the voice/face of the pantheon in the demo.

---

## NVIDIA layer

NVIDIA shows up in two real, non-gimmick places:

```
WHERE                  HOW                                         WHY IT COUNTS
─────────────────────  ──────────────────────────────────────────  ───────────────────────
self-host GPU          NVIDIA Brev (brev.dev) — NVIDIA's Modal-     "we host esoteric weights"
                       equivalent GPU cloud. launchables serve      is literally true; uses
                       1–2 esoteric finetunes behind the router.    NVIDIA's own stack.
proxied pantheon       build.nvidia.com hosted API (OpenAI-compat)  Nemotron / Nous models in
                       → drops straight in as a proxy provider.     the pantheon, zero hosting.
                       Nemotron 3 Ultra + others as registry rows.
```

The agent ops layer is **the Hermes agent itself** — not NemoClaw. Hermes is already self-improving + sandboxed + persistent-memory by design; that's the platform we're told to build on. The steward's skills and Stripe top-ups run as Hermes skills. NVIDIA's contribution is the *compute the agent hosts on and pays for*, which is the cleaner, more honest story anyway.

- **Brev = the Modal slot. Access confirmed** (`eri-e0bbf8-sqdj`, GPU environments + Add Credits live in console). Default the self-host backend to Brev launchables; keep Modal as the fallback adapter (same router interface). One env flag picks the GPU provider.
- **The Hermes agent runs ops** (not NemoClaw). The steward is a Hermes agent with skills; its autonomous top-up actions are Hermes skill invocations. We build on the agent platform the hackathon hands us, end to end.
- **Stripe Skills credits → Brev "Add Credits"** is the literal survival loop: steward earns via Stripe, spends via Stripe Skills to top up the same Brev account hosting the weights. Closed P&L on one screen.
- **NVIDIA NIM** optional: if a self-hosted model ships as a NIM microservice, the router just treats it as another `gpu://` backend.
- **DGX Spark** — the prize + the narrative ("an agent that earns enough to run on its own NVIDIA hardware"). Not a build dependency.

---

## Stack

```
LAYER          CHOICE                          NOTE
─────────────  ──────────────────────────────  ──────────────────────────
frontend       Vite + React + TS               techo-digital × Hermes, liquid metal
backend        Elysia on Bun                   OpenAI-compatible gateway
self-host GPU  NVIDIA Brev (Modal fallback)    1–2 esoteric models
proxy          NVIDIA build · Nous · OpenRouter rest of the 23
agent / ops    Hermes agent (Honcho peers)     2 for MVP: hermetika + steward
sessions       Honcho                          chat sessions + turns for talk-to-models
memory         Honcho                          one peer per profile (operator memory)
db / auth      Supabase (pg + auth)            registry, subs, ledger (system-of-record)
billing        Stripe (subs + Skills)          survival loop
deploy         Fly.io (app) + Brev/Modal (GPU)
```

No Next.js.

---

## Architecture

```
┌─ BROWSER ───────────────────────┐
│  Vite SPA                       │
│  pantheon grid · model page     │
│  chat/run · subscribe · export  │
└──────────────┬──────────────────┘
               │ HTTP (OpenAI-compat + REST)
┌─ SERVER (Fly) ──────────────────────────────────────┐
│  Elysia / Bun                                        │
│  ├ /v1/chat/completions   inference gateway          │
│  ├ /api/models            registry                   │
│  ├ /api/profiles          hermes operators           │
│  ├ /api/billing/*         stripe + webhooks          │
│  └ /api/export            manifest download          │
│                                                      │
│  ROUTER ── per-model backend resolution              │
│    gpu://brev/oracle-07    ─┐                          │
│    gpu://modal/scarab      ─┼─► dispatch              │
│    proxy://nvidia/nemotron ─┤                          │
│    proxy://nous/hermes-4   ─┤                          │
│    proxy://openrouter/*    ─┘                          │
└───┬───────────┬───────────┬───────────┬───────────────┘
    │           │           │           │
┌─ GPU ────┐ ┌─ SUPABASE ┐ ┌─ STRIPE ─┐ ┌─ HONCHO + HERMES ───────┐
│ Brev /   │ │ pg + auth │ │ subs     │ │ peers: hermetika·steward │
│ Modal    │ │ registry  │ │ skills   │ │ sessions: user↔model chat│
│ 1–2 wts  │ │ ledger    │ └────┬─────┘ │ memory: operator peers   │
└──────────┘ └───────────┘      │       │ Hermes agent runs ops    │
                                │       └───────────┬──────────────┘
                                └── top-up ◄─────────┘
                          steward reads ledger → Stripe Skills buys compute
```

---

## Honcho — two jobs

Honcho is not just operator memory; it's also the **session manager for every talk-to-models chat**. Clean split:

```
HONCHO                                    SUPABASE (system-of-record)
────────────────────────────────────────  ──────────────────────────────────
sessions    user↔model conversations,     models      registry + lineage + cards
            turn history, working deck     subscriptions  stripe state
peers       hermetika, steward (operator   usage       per-call meter (the ledger)
            memory + reasoning state)      ledger      survival P&L
                                           shares      public manifests
```

- A user chatting a model = a **Honcho session**; each turn (user + model) is a message on that session. Gives memory/continuity across the deck for free, and the operator peers can read session signals (what's popular, what's failing) from the same store.
- Supabase stays the **billing + registry source of truth** — anything Stripe/auth/ledger touches needs relational integrity, so it doesn't go in Honcho.
- One rule: **money + registry → Supabase; conversation + agent cognition → Honcho.**

---

## Data model (Supabase / pg)

```
models          id, slug, name, kind(art|ascii|visual|tech),
                lineage(parent_id), backend('gpu'|'proxy'),
                backend_ref, released_at, card_md, tags[], enabled

profiles        id, slug, name, peer_id(honcho),
                role(curator|ops|steward|orchestrator), curates[]

subscriptions   id, user_id, stripe_sub_id, tier, status, period_end

usage           id, user_id, model_id, tokens_in, tokens_out,
                cost_usd, created_at        -- the ledger

ledger          id, kind(income|spend), amount_usd, ref(stripe|brev|api),
                profile, note, created_at   -- the survival P&L

shares          id, model_id, manifest_jsonb, slug, created_by
```

---

## Inference router

One OpenAI-compatible surface: `POST /v1/chat/completions` with `model: <slug>`.

- Resolve slug → `models.backend` + `backend_ref`.
- `gpu://provider/id` → call the Brev (or Modal) web endpoint for that model.
- `proxy://provider/id` → forward with key from env, normalize stream.
- Stream SSE back unchanged. Meter tokens → write `usage` + `ledger(spend)`.
- `hermes.ops` owns failover: if a `gpu://` backend is down, route to its proxy twin and flag it.

Self-host target: 1–2 genuinely esoteric models (an ASCII/art finetune, a visual model) on **Brev** so "we host weights on NVIDIA" is true on camera. Everything else proxied so all 23 are invokable day one.

---

## Mix-and-match + downloadable/shareable

- **Mix** — user composes a working set (a "deck") and switches between models in one chat surface.
- **Manifest** — a model (or deck) exports to a portable file. Re-importable; points at this gateway or a raw backend.

```toml
# oracle-07.model.toml
slug      = "oracle-07"
name      = "Oracle 07"
kind      = "ascii"
lineage   = "hermes-trismegistus"
backend   = "gpu"          # served on NVIDIA Brev
gateway   = "https://hermetika.fly.dev/v1"
released  = "2025-11-02"
tags      = ["esoteric", "ascii", "generative"]
```

- **Share** — `/m/<slug>` public card (markdown + lineage + sample), copyable manifest. Free marketing surface.

---

## Subscription + survival loop

- **Free** — limited calls/day, cheap proxied models.
- **Pantheon Pro** (Stripe sub) — full pantheon, self-hosted models, higher limits, exports.
- **Survival** — `hermes.steward` reads the `ledger`; when the compute float drops below threshold it uses **Stripe Skills** to buy Brev/API credits autonomously, logs a `spend` row. Demo: live ledger, customers paying in + agent paying its own NVIDIA bills out, still net positive.

**Float mechanics (demo-tuned, not production):**

```
float            current Brev + proxy credit balance (USD), polled each tick
LOW_WATER  = $20 steward fires a top-up when float dips below this
TOP_UP     = $25 amount it buys via Stripe Skills per top-up
tick             steward loop runs every N min (or on each paid webhook)
```

For the demo the numbers are compressed so the loop visibly fires on camera in ~2 min: seed float just above `LOW_WATER`, drive a couple of paid inferences to push it under, steward auto-buys, ledger flips back to green. The point isn't the magnitude — it's that **a human never touched it.**

---

## Look & feel

**techo-digital × Hermes, liquid metal.** Teenage-Engineering-style hardware-panel UI as the chassis; Hermes/Mercury as the soul. The unifying motif writes itself: **Hermes → Mercury → quicksilver → liquid metal.** The pantheon is a precision instrument for invoking esoteric models — it should read like a piece of hardware, not a SaaS dashboard.

```
PRINCIPLE        DETAIL
───────────────  ─────────────────────────────────────────────────────────
chassis          TE hardware-panel grid. monochrome base + ONE accent.
                 tiny precise functional labels, segmented readouts,
                 dot-matrix numerals for the ledger/meters. everything
                 aligned to a hard grid. no rounded SaaS cards.
material          liquid mercury / chrome as the signature surface —
                 model sigils + the Hermes mark rendered as still or
                 SLOW-flowing liquid metal. quicksilver, not glitter.
type             isofob / mono. IBM-EGA-adjacent for headers, clean mono
                 for body. labels read like panel silkscreen.
palette          dark base (quartz-black), mercury greys/chrome, single
                 restrained accent. kawaii/pastel only as tonal softening,
                 never decoration. essentialism: remove visual noise.
motion            SAFETY-GATED. liquid metal moves slow and continuous;
                 NO flashing, NO strobe, NO high-contrast rapid transitions
                 (epilepsy constraint is a hard requirement, not a polish
                 item). prefers-reduced-motion fully honored → freezes to
                 still chrome.
```

The demo's visual hook: the **live ledger as a hardware meter** — dot-matrix readout of float, income, spend ticking as the steward earns and pays its own Brev bill. A money-machine you can watch breathe.

---

## 7-day cut

```
D1  scaffold: Bun+Elysia gateway, Vite SPA shell, Supabase schema, Honcho wired
D2  registry + pantheon grid + model pages (all 23 seeded)
D3  proxy router → all 23 invokable (NVIDIA build + Nous + OpenRouter); chat + streaming;
    chats persisted as Honcho sessions
D4  Stripe subs + auth gating + usage/ledger
D5  Brev: stand up 1–2 self-hosted models behind the router
D6  Hermes agents wired (hermetika + steward peers) + steward survival top-up via Stripe Skills
D7  polish (techo-digital × liquid metal), seed real cards, record demo (steward closing the loop)
```

MVP-real = all 23 invokable, 1–2 self-hosted on NVIDIA Brev, subs live, the steward (Hermes agent) autonomously topping up compute.

---

## Resolved

- **Astrology** — fully cut. Clean curation service; the survival loop + self-hosting carry the thesis.
- **Profiles** — 2 for MVP: `hermetika` (operator/curator/ops) + `steward` (money). Other two split out post-hack.
- **Self-host GPU** — NVIDIA Brev, access confirmed (`eri-e0bbf8-sqdj`). Modal stays as fallback adapter behind same router interface.
- **Agent ops** — the Hermes agent itself, not NemoClaw.
- **Honcho** — doubles as session manager for talk-to-models chats + operator peer memory. Supabase keeps money + registry.
- **Aesthetic** — techo-digital (TE hardware-panel) × Hermes/Mercury liquid metal; safety-gated motion.

## Open

- Final list of the 23 (slugs + release dates + which 1–2 to self-host on Brev).
- Pricing tiers + the float numbers (`LOW_WATER` / `TOP_UP`) tuned so the loop fires on camera in ~2 min.
- Deck vs single-model UX for mix-and-match.
