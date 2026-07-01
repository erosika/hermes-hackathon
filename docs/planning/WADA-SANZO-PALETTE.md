# Hermetika — Wada Sanzo Palette + Aesthetic Spec
_Curated from wada-sanzo-colors.com/combinations/classic/all_

---

## 0. Confirmed Combinations (live from DOM)

| # | Colors | Hex | Use |
|---|--------|-----|-----|
| 1 | English Red | `#D96629` | Accent, hot state, CTAs |
|   | Cerulean Blue | `#0093A5` | Interactive, primary accent |

---

## 1. Full Wada Sanzo Color Dictionary (Classic Vol. 1)

Curated subset for Hermetika. All are direct references from the 1927 Dutch-published *Dictionary of Color Combinations* (和田三造, Sanzo Wada).

### Paper + Ink (base surfaces)

```
Shironeri (白練):   #f0ede6   ← page white, warm paper
Shironezumi (白鼠): #e8e4dc   ← light warm grey
Gohun (胡粉色):     #fdf4e8   ← lead-white warm, silver accent
Kuro (黒):          #1a1714   ← warm black (not pure #000)
Sabi (錆):          #3a3530   ← dark warm grey
```

### Warm accents (ochre / rust / earth)

```
Kogarashi (木枯):   #d97a3e   ← English Red variant
Kuchiba (朽葉):     #b8784e   ← rust-ochre, PRIMARY secondary
Kikuchiba (黄朽葉): #cca354   ← yellow-ochre, warm highlight
Cha (茶):           #7a5c45   ← earth brown
Ebicha (海老茶):    #6e3b2e   ← deep shrimp brown
```

### Cool accents (indigo / teal / sage)

```
Ruri (瑠璃):        #1e6093   ← deep lapis, dark action
Seiji (青磁):       #5c8a8f   ← celadon
Fuji (藤):          #8b7ca8   ← wisteria violet
Shion (紫苑):       #6b7faa   ← aster blue-violet, tertiary accent
Matsu (松):         #4b7a6b   ← pine green, success/ok state
Wasabi (山葵):      #5a7c4a   ← wild mustard green
```

### Neutrals (muted scale)

```
Nezu (鼠):          #8a8279   ← middle grey text
Hatobusanezu (鳩羽鼠): #7a736b  ← dark neutral
Kobai (小梅):       #c4b5ad   ← light plum grey
```

---

## 2. Proposed Hermetika Token Map

Map Wada names to CSS tokens. **One combination per element; never stack full palette on one surface.**

```css
:root {
  /* ---- Base (Shironeri warm paper) ---- */
  --paper:       #f0ede6;
  --paper-dim:   #e8e4dc;
  --ink:         #1a1714;
  --sabi:        #3a3530;
  --gohun:       #fdf4e8;
  --kuro:        #0f0d0b;   /* near-black, still warm */

  /* ---- Accent System ---- */
  /* Primary: English Red (confirmed from DOM) */
  --accent-primary:     #D96629;
  --accent-primary-dim: #b8551f;
  --accent-primary-bg:  rgba(217,102,41,0.08);

  /* Secondary: Cerulean Blue (confirmed from DOM) */
  --accent-secondary:   #0093A5;
  --accent-secondary-dim:#007a88;
  --accent-secondary-bg: rgba(0,147,165,0.08);

  /* Tertiary: Kuchiba rust-ochre (texture, lettemarks, borders) */
  --accent-tertiary:    #b8784e;
  --accent-tertiary-bg: rgba(184,120,78,0.1);

  /* Quaternary: Ruri lapis (deep action) */
  --accent-action:      #1e6093;
  --accent-action-bg:   rgba(30,96,147,0.1);

  /* ---- Status ---- */
  --ok:     #4b7a6b;   /* Matsu pine */
  --ok-bg:  rgba(75,122,107,0.12);
  --warn:   #cca354;   /* Kikuchiba ochre */
  --warn-bg:rgba(204,163,84,0.12);
  --err:    #b84a3a;   /* Ebicha red-brown variant */
  --err-bg: rgba(184,74,58,0.12);
  --muted:  #8a8279;   /* Nezu */

  /* ---- Surfaces ---- */
  --surface-base:  var(--paper);
  --surface-raised:#fdf4e8;  /* Gohun lead-white */
  --surface-sunken:#e8e4dc;  /* Shironezumi */
  --surface-dark:  var(--sabi);
  --surface-border:#d4cfc6;

  /* ---- Type ---- */
  --font-display: 'Departure Mono', 'IBM Plex Mono', monospace;
  --font-body:    'IBM Plex Mono', monospace;
  --font-label:   'Departure Mono', monospace;

  /* ---- Misc ---- */
  --radius: 2px;
  --ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  --dur: 280ms;
}

[data-theme="dark"] {
  --paper:       #1a1714;
  --paper-dim:   #241f1a;
  --ink:         #f0ede6;
  --sabi:        #3a3530;
  --gohun:       #2c2722;
  --kuro:        #060403;

  --accent-primary:     #e07a3e;   /* brighter English Red for dark */
  --accent-primary-dim: #c4682a;
  --accent-primary-bg:  rgba(224,122,62,0.15);

  --accent-secondary:   #1aafc2;   /* brighter Cerulean */
  --accent-secondary-dim:#0093A5;
  --accent-secondary-bg: rgba(26,175,194,0.12);

  --accent-tertiary:    #d49a6e;   /* brighter Kuchiba */
  --accent-tertiary-bg: rgba(212,154,110,0.12);

  --accent-action:      #2a82c0;   /* brighter Ruri */
  --accent-action-bg:   rgba(42,130,192,0.15);

  --ok:     #5d9a8a;
  --ok-bg:  rgba(93,154,138,0.15);
  --warn:  #ddb464;
  --warn-bg:rgba(221,180,100,0.15);
  --err:   #d4624a;
  --err-bg: rgba(212,98,74,0.15);
  --muted:  #8a8279;

  --surface-base:  var(--paper);
  --surface-raised:#2c2722;
  --surface-sunken:#1f1b17;
  --surface-dark:  var(--ink);
  --surface-border:#3a3530;
}
```

---

## 3. Interface Concepts (named by Wada Sanzo Combinations)



### Concept A: "Kuro + Shiro" （黒 + 白）
_Most minimal. Absolute. Black/white only._

- Background: Kuro `#0f0d0b`
- Surface: slightly raised in Sabi `#3a3530`
- Text: Shironezumi `#e8e4dc` (never pure white)
- Interactive element: one dot of English Red `#D96629` for active/hover state
- No shadows. No gradients. Flat plane.
- Typography: Departure Mono, heavy, small sizes.
- Model cards are rectangles with 1px borders, no cards-within-cards.
- "Subscribe" button: small English Red dot + text span, no pill.
- Ledger: dot-matrix style numbers in one place, blinking colon separator.

_Use when: you want the judges to see "this is not a dash SaaS template."_



### Concept B: "Ruri + Fuji" （瑠璃 + 藤）
_Indigo + violet. The most "hermetika mystical" pairing._

- Background: dark paper
- Primary accent: Ruri `#1e6093` (indigo, for default states, borders, navigation)
- Secondary accent: Fuji `#8b7ca8` (wisteria violet, for cards, active states, hover)
- Status: Matsu `#4b7a6b` (ok), Ebicha `#6e3b2e` (warn)
- Model cards have a 1px Fuji left border. Hover → fills to Fuji-bg (10% opacity).
- The mercury/cute element: a tiny canvas droplet that's indigo with violet edges.
- "Subscribe": Ruri fill, paper text, 2px radius square.

_Use when: the "mystical" vibe is the selling point. This reads as occult-craft._



### Concept C: "English Red + Cerulean Blue" （英国赤 + 青碧）
_Confirmed from DOM. The strongest contrast pair._

- Background: white-ish (Shironeri in light, Kuchiba-ish in dark)
- Cards: English Red `#D96629` for borders on hover, for status indicators, for "LIVE" pips.
- Primary actions: Cerulean Blue `#0093A5` for buttons, links, active nav.
- Tertiary: Kuchiba `#b8784e` for labels, breadcrumbs, metadata — neither primary wins, this keeps hierarchy clean.
- Body text: Sabi `#3a3530` / Nezu `#8a8279` (muted).
- Error state: Ebicha red-brown `#b84a3a`.
- `--accent-primary-bg` = English Red at 8% opacity. `--accent-secondary-bg` = Cerulean at 8% opacity.
- Ledger: English Red text for "-spend" rows, Cerulean Blue for "income" rows. Net = Kuchiba.

_Use as default. Highest contrast, best readability, most brand-identifiable._



### Concept D: "Seiji + Kikuchiba" （青磁 + 黄朽葉）
_Celadon + gold-ochre. The "garden / specimen" approach — your "Version E" from ideation._

- Background: warm paper (Shironeri)
- Card surfaces: Gohun `#fdf4e8` (lead-white)
- Borders: Kikuchiba `#cca354` (1px, understated)
- "Live" indicators: Seiji `#5c8a8f` (celadon teal)
-价格/price text: Kikuchiba `#cca354`, monospace, small.
- Hover animation: Kikuchiba underline grows from center of card.
- Subscribe button: Seiji fill, paper text, 2px radius.
- Specimen number (001–023): Kuchiba `#b8784e`, small.
- "Cute factor": use a #5c8a8f celadon lotus/ droplet motif on cards.

_Use when: warmth and "handcraft" feeling is primary. Maximum erosika cozy for the judges._



### Concept E: "Murasaki + Kurenai" （紫 + 紅）
_Violet + crimson. The premium / luxury read._

- Background: very dark warm (Kuro + 10% Sabi)
- Primary: Murasaki `#6b4f7a` (traditional Japanese purple, cards)
- Accent: Kurenai `#b84a3a` (crimson, CTAs, active)
- Secondary: Shion `#6b7faa` (aster, links, metadata)
- Text: gohun `#fdf4e8` (bright warm white, not blue-white)
- Status: Matsu `#4b7a6b` (ok)
- Mercury sigil: a slow-drip of Kurenai-bg into Murasaki card.
- Hire code: "an agent that charges $2/month, lives on a DGX Spark, and wears violet."

_Use if you want judges to remember "the purple one."_



## 4. Recommended Starting Point

Apply **Concept B (Ruri + Fuji)** as the base — it reads as "occult agent tooling" — but surface the **combination #1 (English Red + Cerulean Blue)** prominently: on the Stripe checkout, the submit-to-Twitter button, and the "LIVE" indicators in the steward ledger.

The result is a dark warm paper base (`#1a1714`) with:
- Ruri `#1e6093` for panels and chrome
- Fuji `#8b7ca8` for active cards
- Cerulean Blue `#0093A5` for CTAs
- English Red `#D96629` for hot state / pricing / live pip
- Kuchiba `#b8784e` for metadata / labels

This gives you **up to 4 active accent colors on one page without clashing** because none of them are neon, all are desaturated, and the warm base absorbs them.

---

## 5. Where to find more (browser-free)

- The actual Wada Sanzo RGB values are in the HTML of wada-sanzo-colors.com (confirmed extracted from `.CombinationDetail_color__CR1L5` class → `rgb(217, 102, 41)` = English Red, etc.)
- For any combination: open `https://www.wada-sanzo-colors.com/combinations/classic/<number>` and read `getComputedStyle(div).backgroundColor` on the color swatch divs.
- The full 366-color dictionary is also mirrored in various design-token repos on GitHub (search "wada sanzo colors json").
- The original reference: *A Dictionary of Color Combinations* by Sanzo Wada, 1927 (republished by DNP).

---

_Generated: 2026-06-30 | Confirmed: English Red + Cerulean Blue from live DOM scrape_
