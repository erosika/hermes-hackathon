# Hermetika — Interface Ideation (Creative Pass)
_Wada Sanzo palette × erosika workstation shell × techo-digital_

---

## 0. Design Direction (updated)

> **Not** the chrome/liquid-metal approach from the earlier spec.  
> **Yes** to: Wada Sanzo warmth + workstation-ui-shell minimalism + techo-digital precision.

Wada Sanzo's work (和田三造) is defined by:
- Muted, desaturated earth tones
- Warm sepia and ochre undertones
- Faded indigo and teal
- Gentle contrast, no shouting
- Analog feel — like watercolor on washi
- Restraint: every hue feels considered, not pulled from a default palette

The result should feel like **a precision instrument built by a craftsman who collects antique books** — not a startup dashboard, not a crypto terminal.

---

## 1. Wada Sanzo Palette Interpretation

```
BASE                                            
  paper:     #f4f1ea  (washi white, warm)
  ink:       #1a1714  (warm black, not #000)
  slate:     #2c2722  (warm dark gray)
  shadow:    #e8e4dc  (warm light gray)

ACCENT — the "Sanzo" notes (use ONE per element, never together)
  indigo:    #4a5c6a  (faded blue-gray, the primary)
  ochre:     #b8784e  (warm rust-ochre, secondary)
  moss:      #6b7c5e  (faded sage green, tertiary)
  cream:     #e8dcc8  (parchment, for hover states)

STATUS (desaturated, not neon)
  ok:        #5a7c6b  (muted sage)
  warn:      #c4a35a  (dusty amber)
  err:       #a65d5d  (muted brick)
  muted:     #8a8279

LIGHT MODE DEFAULT → DARK MODE INVERTS (but keeps warmth)
  dark paper: #1a1714  (inks become paper)
  dark ink:   #f4f1ea  (paper becomes ink)
```

**Rule: never use pure #000 or pure #fff. Always have a warm cast.**

Confirmed from wada-sanzo-colors.com DOM (CombinationDetail_color class):
- English Red: `#D96629`
- Cerulean Blue: `#0093A5`

---

## 2. Typography Layer

From workstation-ui-shell, preserved:
- **Departure Mono** — primary display/header font (kept from workstation-ui-shell)
- **IBM Plex Mono** — body, small labels
- **OpenDyslexic** — accessibility fallback

Hierarchy:
```
H1: Departure Mono Bold 24px  letter-spacing: 0.15em  text-transform: uppercase
H2: Departure Mono Bold 18px  letter-spacing: 0.1em
Label: Departure Mono Regular 10px  letter-spacing: 0.2em  text-transform: uppercase
Body: IBM Plex Mono Regular 13px  line-height: 1.7
Mono data: IBM Plex Mono 12px  (prices, token counts, ledger)
```

No sans-serif. No display serif. Mono is the brand.

---

## 3. Component Tokens

```css
:root {
  /* Sanzo Warmth */
  --paper:       #f4f1ea;
  --ink:         #1a1714;
  --slate:       #2c2722;
  --shadow:      #e8e4dc;
  --indigo:      #4a5c6a;
  --ochre:       #b8784e;
  --moss:        #6b7c5e;
  --cream:       #e8dcc8;
  --muted:       #8a8279;
  --ok:          #5a7c6b;
  --warn:        #c4a35a;
  --err:         #a65d5d;

  /* Derived surfaces */
  --surface-0:   var(--paper);
  --surface-1:   #ebe7df;   /* raised panel */
  --surface-2:   #ddd8cf;   /* input bg */
  --surface-3:   #2c2722;   /* ink well — for headers/controls */

  /* Text */
  --text-1:      var(--ink);
  --text-2:      var(--slate);
  --text-3:      var(--muted);
  --text-on-ink: var(--paper);

  /* Borders */
  --border:      #d4cfc6;
  --border-strong: #b8b0a5;

  /* Radii — still minimal */
  --radius-sm:   2px;
  --radius-md:   3px;

  /* Shadows — hard only */
  --shadow-1:    0 1px 0 var(--shadow);
  --shadow-2:    0 2px 4px rgba(26,23,20,0.08);
  
  /* Transitions — slow */
  --ease:        cubic-bezier(0.22, 0.61, 0.36, 1);
  --dur:         280ms;
}

[data-theme="dark"] {
  --paper:       #1a1714;
  --ink:         #f4f1ea;
  --slate:       #3a3530;
  --shadow:      #2c2722;
  --indigo:      #7a8c9a;  /* lighter for dark */
  --ochre:       #d4a07a;
  --moss:        #8a9b7e;
  --cream:       #3a3530;
  --muted:       #8a8279;
  --ok:          #7a9c8b;
  --warn:        #e4c37a;
  --err:         #c87a7a;

  --surface-0:   var(--paper);
  --surface-1:   #241f1a;
  --surface-2:   #2c2722;
  --surface-3:   #f4f1ea;

  --text-1:      var(--ink);
  --text-2:      #b8b0a5;
  --text-3:      #6a6258;
  --text-on-ink: var(--paper);

  --border:      #3a3530;
  --border-strong: #4a453f;

  --shadow-1:    0 1px 0 var(--shadow);
  --shadow-2:    0 2px 4px rgba(0,0,0,0.3);
}
```

---

## 4. Five Interface Versions (ideation)

### Version A: "The Ledger" (default — most distinctive)
**Metaphor: A bookkeeper's desk.**

Full page is a single dark warm surface (`surface-3`/`ink`). All panels are slightly lighter (`surface-2`/`slate`).

- Top: single row of Departure Mono headers, all-caps, ochre accent for the active tab
- Pantheon grid: 3 columns, each card is a "page" — slightly raised, 1px border, hard shadow
- Each card has:
  - Top-left: model slug in 10px uppercase labels
  - Center: a small monochrome glyph (Generated ascii art or geometric mark — no photos)
  - Bottom-right: inference counter in 12px IBM Plex Mono, ochre if >80% used, err if >95%
  - Mouse hover: card lifts 1px (shadow-2), border shifts to ochre
- Subscribe button: small, rectangular, indigo fill, paper text, no rounded corners, uppercase 10px label
- No hero image. No illustration. No emoji.

**Where the Sanzo palette sings:** the ochre counter + indigo button on dark paper reads like a label on an antique text.

---

### Version B: "The Tiling" (uses workstation-ui-shell's native strength)
**Metaphor: Multiple monitor panels, like a trading floor or mission control.**

Leverage the existing `Desktop.tsx` + `TilingLayoutManager.ts` from workstation-ui-shell directly — import as a submodule or copy.

Each window is a model sandbox:
- Window title bar: 24px high,ochre dot + model slug in 10px labels
- Content: terminal-style chat panel, IBM Plex Mono, paper text on slate bg
- Sidebar: vertical icon rail with Departure Mono one-char labels (P, L, F, S for Pantheon/Ledger/Free/Subscribe)
- Active window: 1px indigo left border only (no glow, no shadow change)
- Mousedown on title bar: drag to tile (real tiling, from workstation-ui-shell)
- The header row itself is a dock: logo left, time right (Departure Mono, warm)

**Where it wins:** this is literally your existing code. The hackathon judges see a working multi-panel desktop environment running model inference, not a web page. Maximum "this was built on a real system" signal.

---

### Version C: "The Print Shop" (most erosika/artsy)
**Metaphor: Letterpress workshop. Typesetting. Manual craft.**

- Background: paper texture (CSS noise at 2% opacity, warm)
- All panels have a 2px border that looks like a printed frame
- Model cards look like broadsides / typeset specimens:
  - Model name set in Departure Mono Bold, centered, large
  - Below it: a horizontal rule (1px ochre)
  - Below that: 3-4 lines of "sample output" in IBM Plex Mono, indented
  - Bottom: price in ochre, small, right-aligned
- "Subscribe" looks like rubber-stamp: square, slightly rotated on hover, ink bleed effect (CSS blur)
- Mercury sigil → ink blot animation (black/gray, slow dissolve)
- The whole page has a slight paper texture (SVG filter feTurbulence at 0.03)

**Where it wins:** completely unique visual identity. No other AI tool looks like a print shop. The "cute" factor is in the craft feel, not the pastel colors.

---

### Version D: "The Instrument" (most techo-digital)
**Metaphor: Analog audio equipment. Teenage Engineering + vintage test equipment.**

- Deep paper bg, everything else slightly raised metal panels (`#2c2722` to `#3a3530`)
- Panel headers: minimal, 8px uppercase Departure Mono, ochre dot indicator
- Each sandbox panel is a "module" with:
  - Left edge: a 3px status bar (moss = idle, indigo = running, ochre = waiting, err = down)
  - Center: model card
  - Right: live counter with segmented-style font (use IBM Plex Mono with letter-spacing to simulate)
- Knob/slider for temperature: vertical, minimal, paper on dark
- The subscription flow reads like a "channel selector" — slots you tune into
- The treasurer/ledger section is a row of physical-style meters (CSS gradients + tick marks)

**Where it wins:** judges from hardware/NVIDIA backgrounds will feel at home. It reads as "precision instrument."

---

### Version E: "The Garden" (most Sanzo / warm / erosika)
**Metaphor: A curated garden of models, each a plant in a bed.**

- Background: paper
- Pantheon is a grid of "specimen cards" — each looks like a pressed flower sheet:
  - Top: specimen number (001–023) in 10px uppercase ochre
  - Center: a delicate line drawing or ascii "illustration" of the model's domain
  - Below: model name in Departure Mono
  - Bottom: "bloom date" (release date) + health indicator (moss dot)
- Cards have rounded corners (exception to the hard-edge rule — intentional, evokes pressed paper)
- Hover: card lifts, a faint ochre underline grows from center
- Subscribe button: looks like a tag on a plant stake — small, rectangular, tied-in corner
- Mercury sigil: a droplet that slowly rolls off the card edge (CSS transform, not canvas)

**Where it wins:** maximum "cute." Maximum warmth. The Sanzo palette is made for this. If you want to lean into erosika's softer side, this is it.

---

## 5. Recommended Hybrid

Start with **Version B (Tiling)** as the structural base since you already have that code, then skin it with **Version E (Garden)** aesthetics.

Result: a multi-window desktop shell where each window is a warm, paper-toned specimen card. The contrast between the cold technical shell and the warm Sanzo-flavored content is itself the brand statement.

**Specifically:**
- Window chrome = dark ink (from workstation-ui-shell, kept dark)
- Window content = paper surface
- Status bars = moss/ochre
- Typography = Departure Mono headers + IBM Plex Mono body
- Mercury sigil → ink blot canvas in window header

This is your existing workstation-ui-shell aesthetic pivoted warm. Minimal new code. Maximum reuse.

---

## 6. What to Cut / Simplify (Final)

| Feature | Cut? | Reason |
|---------|------|--------|
| Mix-and-match deck | YES | Stretch, costs hours |
| Manifest export | YES | Nice-to-have, demo doesn't need it |
| Full 23 models | NO (keep target) but demo 6 | Core thesis |
| Honcho session memory | YES (Supabase sessions table stub) | Infrastructure, not demo |
| Honcho peer memory | YES for MVP | Can demo the steward as a cron script, not a full peer yet |
| Fine-tuning pipeline | ALREADY CUT | Correct decision |
| Astrology/oracle | ALREADY CUT | Clean curation only |
| NemoClaw sandbox per model | YES (one shared Brev/Spark pool) | Infrastructure cost |
| mercury canvas | YES but simple | CSS ink blot or simple canvas drip, not full WebGL |
| OpenRouter self-host competition | YES | Use as proxy only |

---

## 7. Repo structure (hermes-business)

```
/home/eri/Documents/coding/hermes-business/
├── .git/
├── package.json              ← bun workspace root
├── tsconfig.json
├── apps/
│   ├── gateway/              ← Elysia backend (OpenAI-compat router)
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── chat.ts         → /v1/chat/completions
│   │   │   │   ├── models.ts       → /api/models
│   │   │   │   ├── ledger.ts       → /api/ledger
│   │   │   │   ├── billing.ts      → /webhooks/stripe
│   │   │   │   └── steward.ts      → /api/steward/topup
│   │   │   ├── router/
│   │   │   │   ├── resolve.ts      → slug → backend
│   │   │   │   ├── spark.ts        → Ollama/vLLM client
│   │   │   │   ├── brev.ts         → Brev burst client
│   │   │   │   └── proxy.ts        → OpenRouter/NVIDIA/Nous
│   │   │   └── lib/
│   │   │       ├── db.ts           → Supabase client
│   │   │       └── meters.ts       → token counting
│   │   └── package.json
│   └── web/                  ← Vite SPA (Sanzo-skinned)
│       ├── src/
│       │   ├── index.css           ← Sanzo tokens
│       │   ├── App.tsx
│       │   ├── pages/
│       │   │   ├── Pantheon.tsx    ← grid of models
│       │   │   ├── ModelPage.tsx   ← sandbox view
│       │   │   └── Ledger.tsx      ← treasurer dashboard
│       │   ├── components/
│       │   │   ├── ModelCard.tsx
│       │   │   ├── Sandbox.tsx
│       │   │   ├── InkBlot.tsx     ← canvas sigil
│       │   │   └── StatusBar.tsx
│       │   └── lib/
│       │       └── api.ts          ← fetch wrapper
│       └── package.json
├── packages/
│   └── schema/              ← shared Supabase types + Zod schemas
│       ├── src/
│       │   ├── models.ts
│       │   ├── subscriptions.ts
│       │   ├── usage.ts
│       │   └── ledger.ts
│       └── package.json
├── scripts/
│   ├── admit.ts             → hermes nudge handler — admit model
│   ├── retire.ts            → Friday retire sweep
│   └── seed.ts              → seed 23 model cards from JSON
├── .env.example
├── README.md
└── HACKATHON-SPEC.md        ← this ideation doc
```

**Tech stack:** Bun monorepo (matches workstation-ui-shell + hermes-hackathon), Elysia backend, Vite SPA, Supabase PostgreSQL, Tailwind CSS v4 (from workstation-ui-shell pattern).

---

## 8. First 12 items to build (in order)

1. Initialize monorepo at `/home/eri/Documents/coding/hermes-business/`
2. Copy Sanzo palette into `apps/web/src/index.css`
3. Build `ModelCard.tsx` — the minimum viable UI unit
4. Build `Pantheon.tsx` — grid of 6 seeded cards
5. Wire `apps/gateway/routes/models.ts` — return seeded models
6. Wire `apps/gateway/routes/chat.ts` — proxy to OpenRouter for one model
7. Connect ModelCard → chat endpoint → show response
8. Add Stripe Checkout button (test mode) → create session
9. Add webhook handler → mark subscription active in Supabase
10. Add usage meter → write usage row per call
11. Add Ledger page → show income/spend rows
12. Record 90s demo

---

_ideation version: 0.1 | 2026-06-30 | based on workstation-ui-shell ecosystem_
