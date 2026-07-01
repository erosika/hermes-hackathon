# Hermetika — 75-Second Demo Script

_Three shots. One thesis: a curated inference pantheon that a Hermes agent operates and pays for, with no human in the hot loop._

Aesthetic note for the cut: quartz-black base, mercury-chrome readouts, one cold accent. Slow motion only — no flashing, no strobe. No emoji on screen or in narration.

---

## Ground truth (what is actually wired today)

Written against the current server (`apps/server/src/index.ts`) so the script never over-promises. Live endpoints:

```
GET   /health
GET   /api/models              registry (enabled models)
GET   /api/models/:slug
GET   /api/profiles            hermetika + steward
GET   /api/backends            live backend health
GET   /api/ledger              float · income · spend · net · entries[]
GET   /api/steward             top-up decision + last autonomous action
GET   /api/subscriptions       active subscriptions
POST  /api/checkout            create a checkout session for a model slug
GET   /checkout/demo           demo-completes a checkout → books income
POST  /api/nudge               license-gate + admit model slugs live
POST  /webhooks/stripe         income webhook (demo parses; real verifies sig)
POST  /v1/chat/completions     OpenAI-compatible gateway (stream + non-stream)
```

Status of the three shots against that surface — all three run today:

- **Shot C (survival loop) is fully real and autonomous.** `startStewardLoop()` ticks every 10s; when credit float dips under the $20 low-water it fires a guarded top-up, books a spend row, and net updates — no human. The hero shot; needs no faking.
- **Shot A (live admission via `POST /api/nudge`) is real.** The route parses `slug:license` tokens, license-gates each, admits survivors into the pantheon registry. Smoke-tested: 2 admitted / 1 rejected.
- **Shot B (`POST /api/checkout` → `GET /checkout/demo`) is real.** Checkout returns a session; opening its demo url books an income row and activates a subscription. Smoke-tested: ledger income $0 → $2.

Rails note: the steward's spend goes through a real guarded-spend layer (`spend.ts` → kill-switch, per-tx cap, daily cap, idempotency, then the rail). Default rail is `demo` (book-only); `stripe` swings it onto Stripe Issuing. The top-up logic is **deterministic rails, not LLM-reasoned** — say that on camera. Hermes-4 steward reasoning is not wired.

---

## Shot A — the agent admits a model live (≈25s)

**Story:** you hand Hermetika three model IDs. It admits the two with clean licenses and rejects the proprietary one at the license gate. The pantheon grid grows on screen.

### On-screen action
Split view: terminal on the left, the pantheon grid (`apps/web`) on the right. Grid starts at its seeded count.

### Commands / clicks

```bash
curl -s http://localhost:3001/api/models | grep -o '"slug"' | wc -l   # count before → 7
curl -s http://localhost:3001/api/nudge \
  -H 'content-type: application/json' \
  -d '{"input":"aurora-ascii:apache-2.0, glyph-weaver:mit, sketchy:proprietary"}'
# → {"summary":"admitted 2 · rejected 1","results":[
#      {"ok":true,"reason":"admitted","model":{"slug":"aurora-ascii",...}},
#      {"ok":true,"reason":"admitted","model":{"slug":"glyph-weaver",...}},
#      {"ok":false,"reason":"license 'proprietary' not admissible"}]}
curl -s http://localhost:3001/api/models | grep -o '"slug"' | wc -l   # count after → 9
```

Then the right pane reloads and two new cells appear; the proprietary ID never shows up.

### Spoken narration
"I throw three raw model IDs at Hermetika. It license-gates each one — apache and MIT get admitted into the pantheon, the proprietary one gets rejected at the gate. No cron, no human review; the agent packages them and they're live."

### What the viewer should SEE
- Terminal prints two admitted slugs and one rejected with a license reason.
- The pantheon grid gains exactly two cells; the rejected slug is absent.
- Header still reads `operated by hermes`.

---

## Shot B — the cute sandbox and a $2 checkout (≈30s)

**Story:** open a model's sandbox, subscribe for $2, and run a live streamed completion in the playground. The income books to the survival ledger.

### On-screen action
Click a model cell (e.g. `oracle-07`) to open its sandbox panel — mercury sigil animating slow in the corner, playground strip, subscribe button as a hardware panel, not a SaaS pill.

### Commands / clicks

```bash
# 1. create a checkout session for the model slug
curl -s http://localhost:3001/api/checkout \
  -H 'content-type: application/json' -d '{"slug":"oracle-07"}'
# → {"id":"cs_demo_oracle-07","url":"/checkout/demo?slug=oracle-07&price=2","modelSlug":"oracle-07","priceUsd":2}

# 2. opening the session url completes the demo checkout → books income + activates the sub
curl -s "http://localhost:3001/checkout/demo?slug=oracle-07&price=2"   # → income booked
curl -s http://localhost:3001/api/ledger | grep -o '"income":[0-9.]*'  # → income rose by 2
curl -s http://localhost:3001/api/subscriptions                        # → oracle-07 active
```

Then, in the playground, a real streamed completion against the live gateway:

```bash
curl -N http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"oracle-07","stream":true,"messages":[{"role":"user","content":"draw me a small ascii sigil"}]}'
```

### Spoken narration
"Every model gets a small, honest sandbox — no dashboard, just the instrument. Subscribe for two dollars, and the payment books straight into the survival ledger. Then I run a real streamed completion through the OpenAI-compatible gateway."

### What the viewer should SEE
- Sandbox panel: quartz-black chassis, slow mercury sigil, monospace playground.
- Tokens stream into the playground output live (SSE), with `x-hermetika-backend` proving the router picked the right lane.
- The ledger tape gains a green `income` row (`+$2.00` or the seeded sub rows), and `revenue in` ticks up.

---

## Shot C — the survival loop (≈20s) — the hero shot

**Story:** the steward's compute float sits just above low-water. A couple of paid inferences push it under $20. With no human touching anything, the steward fires an autonomous top-up, books the spend, and net updates. This one is fully real today.

### On-screen action
Bring the `LedgerMeter` full-frame. Seed float is `$24`, low-water `$20`, top-up `$25` (from `packages/shared` `FLOAT`). Steward evaluates every 10s; one dip = one charge (30s cooldown, idempotency-keyed).

### Commands / clicks
Drive the float under low-water with paid-lane inference (owned Spark lanes are free; `proxy`/`brev` burn credit), or just let a couple of metered proxy calls run:

```bash
# a few paid-lane completions burn credit float toward low-water
curl -s http://localhost:3001/v1/chat/completions \
  -H 'content-type: application/json' \
  -d '{"model":"hermes-4","messages":[{"role":"user","content":"one line, please"}]}' >/dev/null
# watch the decision flip
curl -s http://localhost:3001/api/steward   # → { topUp:true, amount:25, float:<20, ... } then lastAction populates
```

### Spoken narration
"The steward reads its own ledger on a timer. When the compute float drops under twenty dollars, it buys more compute itself — deterministic rails through a guarded spend layer, not an LLM guessing. A customer paid in; the agent paid its own NVIDIA bill out; nobody touched it."

### What the viewer should SEE
- `credit float` readout crosses under $20 and flips amber (`float low`).
- Within a tick, a `spend` row appears on the tape: `steward top-up · compute credit · auto`, float jumps back up by $25, and the readout returns to green.
- `net p&l` recomputes on screen (`revenue − vendor`) and stays positive.
- The steward line updates: `last top-up · $25.00 · $<before> → $<after>`.
- In the server console, the signature line prints:
  `⚷ steward: float $<before> < $20 → top-up $25 → float $<after> · net $<net>`

---

## Close (≈3s)
Hold on the meter breathing — income in, vendor out, net positive. One line: "Operated by Hermes. Not by me."
