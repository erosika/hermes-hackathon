# Hermetika — Step-by-Step Hackathon Spec
_Curated inference platform. Hermes agents ops + Stripe survival loop._

---

## 0. Where we are now

You already have:
- **`/home/eri/coding/hermes-hackathon/`** — scaffolded Bun/Elysia backend + Vite SPA
- **SPEC.md** — 332-line architecture doc (DGX Spark + Brev + proxy lanes, two Hermes peers, Supabase schema)
- **CHECKLIST.md** — manual setup steps (Stripe Issuing, Supabase, Brev keys, Honcho)
- Existing Cosmania fleet + Dexter datastore

The code is scaffolded but the Hermes agent loop + Stripe webhooks + frontend are not wired yet.

---

## 1. What competes with this (honest landscape)

| Product | What it is | Gap vs Hermetika |
|---------|-----------|-----------------|
| **OpenRouter** | 200+ models, flat API price | No curation, no agent ops, no Stripe survival loop, no cute sandbox |
| **Hugging Face Inference API** | Host any model on HF infra | Queueing, cold starts, rate limits, no Stripe billing, no live sandbox |
| **Together AI / Fireworks** | Hosted finetunes + base models | Enterprise-only pricing, no agent-curated "pantheon," no micro-subscription |
| **Replicate** | Pay-per-run for any model | No subscription model, no persistent sandbox, per-run billing |
| **Modal / Brev** | GPU serverless | Infrastructure, not a curated platform — developers still have to build on top |
| **Poe (Quora)** | Curated model chat UI | Closed platform, no agent curation, no live survival loop |
| **Groq** | Fast LLM inference | One provider's acceleration, not a platform |

**The gap**: No one offers **curation + hosted sandbox + Stripe subscription + autonomous agent ops** all in one. OpenRouter has the API layer. HF has the models. Nobody has the agent-operated hermetic loop.

---

## 2. What "cute sandbox" means (aesthetic spec)

> techo-digital × Hermes/Mercury × erosika warmth × liquid metal

### Core design tokens

```
COLORS
  base:    #0a0a0a  (quartz-black)
  panel:   #141414  (slightly raised)
  metal:   #8a8a8a  (mercury grey)
  chrome:  #c0c0c0  (light chrome, highlights)
  accent1: #c4e0ff  (cold mercury blue)   ← primary accent
  accent2: #ffb4a2  (warm erosika/coral)   ← secondary, sparing
  text:    #e0e0e0  (soft white)
  muted:   #666666
  ok:      #7ec699
  warn:    #e8c547
  err:     #e07a5f

TYPOGRAPHY
  display:  JetBrains Mono Bold, uppercase, tracked out
  label:    JetBrains Mono Regular, all-caps, 10px, panel silkscreen
  body:     IBM Plex Mono or Inter Mono, 12-13px
  numbers:  dot-matrix style (use monospace, simulated 7-seg feel via letter-spacing)

RADIUS
  corners:  2px (hardware panel, no SaaS softness)
  sandboxes: 4px max

BORDERS
  1px solid #2a2a2a for panels
  1px solid #3a3a3a on hover

SHADOWS
  Hard shadows only: 0 1px 0 #000, 0 4px 8px rgba(0,0,0,0.8)
  NO drop shadows, NO blurs

MOTION
  Slow mercury drip: 40-80fps canvas animation, 1-3s loop
  NO flashing, NO strobe, NO fast contrast transitions
  prefers-reduced-motion: freeze chrome to still silver
```

### The "cute sandbox" upgrade (per model)

Each model page gets:
1. **Chrome panel wrapper** — bordered container, not a SaaS card
2. **Mercury sigil** — tiny canvas animation: liquid metal droplet that slowly slides down the panel edge or settles into the model's glyph shape (use `<canvas>` + sine-based vertex animation, no WebGL needed)
3. **Usage meter** — dot-matrix style numbers, ticker-tape feel ("14 inferences left")
4. **Playground strip** — input/output in a single terminal-like panel, monospace, no emoji
5. **Subscribe button** — hardware-panel style: raised border, accent1 glow on hover, not a rounded pill
6. **Model card** — adjacent panel, IBM Plex Mono body, fine divider lines

```
+──────────────────────────────────────────────────┐
│▌  MODEL: oracle-07                     [SUB $2] │  ← metal header
│▌  kind: ASCII   backend: gpu://spark            │
├──────────────────────────────────────────────────┤
│                                                  │
│  ┌── mercury sigil canvas ──────────────────┐   │
│  │ [slow drip of liquid metal, ~60fps]      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌── playground ────────────────────────────┐   │
│  │ > input text here...                     │   │
│  │                                           │   │
│  │ oracle-07:  [Cleaned transcription]      │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
│  ┌── meter ─────────────────────────────────┐   │
│  │ ████░░░░░░  4 inferences left           │   │
│  │ Float: $87.20    Today: +$12            │   │
│  └──────────────────────────────────────────┘   │
│                                                  │
└──────────────────────────────────────────────────┘
```

---

## 3. The Hermes curation loop (how the agent runs itself)

### Three daily automated runs

```yaml
dawn_scan (06:00):
  trigger: cron / manual nudge from Eri
  hermes_role: hermetika (or single profiles/hermes peer)
  input: HF trending + "downloads < 500" OR Eri's manual list
  action: score, admit top 1-2 into pantheon
  output: 1-2 new model cards in Supabase

noon_triage (12:00):
  trigger: cron
  hermes_role: steward (light) + hermetika
  input: 7-day usage per model
  action: 
    - if usage = 0 for 3 days → mark for retirement, post to Discord
    - if usage > threshold and spark saturated → Brev top-up (if float allows)
    - if Stripe subscriptions = 0 → alert: "consider pulling this one"
  output: retirement queue, auto-pop FRIDAY_DROP list

friday_retire (Fri 17:00):
  trigger: cron
  action: archive oldest N from retirement queue, free spark lane
  output: FRIDAY_NEWS tweet draft, model archive manifest commit
```

### The nudge mechanism (Eri → Hermes)

Eri can send a "nudge" at any time:

```
echo "oracle-09, lucid-mermaid-v3, nocturne-reason-v2" | \
  hermes nudge --to hermetika --action admit
```

Hermes parses, validates license, scores, admits immediately (bypasses dawn scan).

**This is the key feature that makes it "live":** you don't wait for the cron. You throw model IDs into the agent's head and it packages + deploys them.

---

## 4. Stripe survival loop (the money shot)

### Flow

```
Customer subscribes ($2/mo)      
  → Stripe webhook            
  → Supabase subscriptions marked "active"
  → OpenRouter/Stripe Skills credit hits steward's floating balance

User calls inference API
  → gateway checks subscription.active
  → meter writes usage row in Supabase (tokens_in, tokens_out, cost)
  → ledger writes spend row (compute cost for that call)
  → usage shown in sandbox in real time

Steward loop (every check cycle)
  → reads ledger: sum spend_30d, sum income_30d
  → float = Stripe Skills balance + Brev/API credit balance
  → if float < LOW_WATER ($25): auto top-up $30 via Stripe Skills
  → if profit = income - spend - topup AND profit > $50: 
      reinvest 60%, stash 40% to Eri-linked payout (post-hackathon)
```

### One line of code, the whole loop

```typescript
// steward loop (pseudocode)
const ledger = await supabase.from("ledger").select("*")
const income = ledger.filter(r => r.kind === "income").sum()
const spend  = ledger.filter(r => r.kind === "spend").sum()
const float_ = await getStripeSkillsBalance()
if (float_ < 25) await stripeSkillsBuy(30)
const profit = income - spend
if (profit > 50) await reinvest(profit * 0.6)
```

---

## 5. Step-by-step build order (48h from now to Tuesday)

### Pre-work (today, before coding)
- [ ] 1. Pull the 23 model slugs + license check from HF into a JSON
- [ ] 2. Pick 3 to self-host on DGX Spark as the "hero" sandboxes (ascii/art ones)
- [ ] 3. Pick 10 to proxy (OpenRouter / NVIDIA build / Nous) — already hosted
- [ ] 4. Reserve subdomain: `modelbnb.dev` or `pantheon.dev` (use Namecheap or similar)
- [ ] 5. Confirm Tailscale from DGX Spark → your laptop → eventual Fly droplet
- [ ] 6. Set up Stripe test keys (use test mode through Tuesday, flip to live at submit)
- [ ] 7. Open Supabase project, push schema

### Hour 1-3: scaffold the gateway
- [ ] Wire Elysia routes: `/v1/chat/completions`, `/api/models`, `/api/ledger`
- [ ] Implement `resolveBackend(slug)` router
- [ ] Connect Snowflake/Ollama to Spark via Tailscale (stub if unreachable — fall back to proxy)
- [ ] Verify: call one proxied model end-to-end from localhost

### Hour 4-6: build the sandbox template
- [ ] Create React component `Sandbox.tsx` (the panel layout above)
- [ ] Add mercury canvas animation (sine-wobbled blob, 40fps, respect prefers-reduced-motion)
- [ ] Hook up to `/v1/chat/completions` with streaming SSE
- [ ] Add subscribe button wired to Stripe Checkout session creation
- [ ] Build `ModelCard.tsx` + `PantheonGrid.tsx`

### Hour 7-9: Stripe + auth
- [ ] Stripe webhook handler at `/webhooks/stripe`
- [ ] Supabase `subscriptions` table + RLS
- [ ] Usage meter: count tokens per call, write to `usage` table
- [ ] Ledger: every paid call writes a `spend` row; every webhook `checkout.session.completed` writes `income`

### Hour 10-12: agent loop
- [ ] Write `steward/loop.ts` — cron-triggered every 5 min in demo mode
- [ ] Write `hermes/nudge.ts` — Eri can push model IDs
- [ ] Write `hermes/admit.ts` — validate license, pick backend, insert to Supabase
- [ ] Wire to Honcho (stub Hermes peer memory, real Supabase for now)

### Hour 13-16: polish + demo prep
- [ ] Live demo recording script (75s, 3 takes)
- [ ] Landing page: `pantheon.dev` hero with 6-8 visible models
- [ ] Telegram/Discord alert on each new admission + each retirement
- [ ] Tweet copy + Discord submission text

### Hour 17-24: buffer + stretch
- [ ] Mix-and-match deck feature
- [ ] Manifest export
- [ ] NemoClaw sandbox integration for Thor/agentisolation mention
- [ ] DGX Spark real hardware testing

---

## 6. Aesthetic implementation notes

### Mercury canvas (reusable component)

```tsx
// MercurySigil.tsx — 50 lines
// Draws a slowly morphing blob using sine-warped circle
// Colors: mercury greys + optional accent2 glow
// Respects prefers-reduced-motion
const MercurySigil = ({ accent = false }) => {
  const canvasRef = useRef()
  useEffect(() => {
    const ctx = canvasRef.current.getContext("2d")
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    let t = 0
    const draw = () => {
      t += reducedMotion ? 0 : 0.008
      ctx.clearRect(0,0,w,h)
      // draw blob with sine-warped vertices
      for (let i = 0; i < N; i++) {
        const θ = (i/N) * Math.PI * 2
        const r = baseR + sin(θ*3 + t) * amp + sin(θ*7 - t*0.7) * amp*0.4
        // fill with linear gradient: metal → chrome
      }
      !reducedMotion && requestAnimationFrame(draw)
    }
    draw()
  }, [accent])
  return <canvas ref={canvasRef} width={80} height={80} />
}
```

### Font imports (single CSS file)

```css
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;500&display=swap');

:root {
  --base: #0a0a0a; --panel: #141414; --metal: #8a8a8a; --chrome: #c0c0c0;
  --accent1: #c4e0ff; --accent2: #ffb4a2; --text: #e0e0e0; --muted: #666;
  --ok: #7ec699; --warn: #e8c547; --err: #e07a5f;
  --font-display: 'IBM Plex Mono', monospace;
  --font-body: 'IBM Plex Mono', monospace;
  --radius: 2px;
}
```

---

## 7. What to cut ruthlessly

- ❌ No Mix-and-match deck (stretch, nice-to-have)
- ❌ No manifest export/import
- ❌ No full 23 models for demo (6-8 is enough)
- ❌ No Honcho session memory (Supabase sessions table + in-memory is fine for demo)
- ❌ No OpenRouter self-host competition (use their API as proxy, don't compete)
- ❌ No fine-tuning pipeline (your instinct was right)
- ❌ No astrology/oracle content (already resolved in existing SPEC)
- ❌ No mobile-first (desktop-only hackathon demo)

---

## 8. Three demo shots to film

### Shot A — The Agent Finding a Model (10s)
> "Hermes just scanned 89 new HF releases. Here's what it found."

Show HF API response JSON scrolling in terminal. Hermes peer logs: `ADMIT: nocturne-reason-v3 | license: apache-2.0 | kind: ascii`. Sandbox card appears in grid.

### Shot B — The Cute Sandbox Live (20s)
> "User opens a page, subscribes for $2, and uses a model that costs nothing to self-host."

Camera pans across: subscribe button → Stripe Checkout (test mode, $2) → sandbox playground → model response. Mercury sigil animating in corner.

### Shot C — The Survival Loop (15s)
> "The steward just sold $12 of inference. It paid its own Brev bill. Nobody touched it."

Show ledger panel: income $12.00, spend $8.50, float $23.80 → dot added. "Auto top-up fired: float → $51.20."

---

## 9. Submission checklist (due EOD Tuesday)

- [ ] Typeform filled: http://form.typeform.com/to/hpEifIK4
- [ ] Discord post in http://discord.gg/nousresearch/PFbQZMesC
  - 1-3 min demo video link (upload to YouTube unlisted first)
  - 3-5 sentence project description
  - Link to GitHub (hermes-business or hermes-hackathon repo)
- [ ] Tweet: `@NousResearch #HermesHackathon` + video + short writeup
- [ ] README on GitHub covers: what it is, how to run locally, Stripe test mode, screenshots

---

## 10. Open questions (decide before Hour 1)

1. **Domain name**: `modelbnb.dev` vs `pantheon.dev` vs `hermetika.dev`
2. **Pricing tier**: $2/month flat vs "first 20 free then $3/mo"
3. **How many real models vs stubs for demo**: 3 real (Spark) + 3 proxied vs 8 proxied, 0 Spark
4. **Stripe mode**: all test through submit, or set up live keys now
5. **Aesthetic fork**: wipe the existing Vite/React scaffold and rebuild from scratch, or iterate on what's there?

---

_Spec version: 0.1 | written 2026-06-30 23:xx | Eri Barrett / Hermes Hackathon_
_Based on: existing SPEC.md + CHECKLIST.md + erosika/workstation-ui-shell aesthetic direction_
