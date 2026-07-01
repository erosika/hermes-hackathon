# Hermetika — Submission Package

_Hermes Agent Accelerated Business Hackathon (NVIDIA × Stripe × Nous). No emoji._

---

## Project description (3–5 sentences)

Hermetika is a curated inference pantheon — a small, deliberate set of esoteric and experimental models — that a Hermes agent operates end to end. A `hermetika` peer admits models through a license gate and places each on the right lane; a `steward` peer runs the survival loop: it reads its own ledger on a timer and, when the compute float drops under low-water, autonomously tops itself up through a guarded spend layer and books the spend. The NVIDIA angle is owned floor, paid ceiling: the esoteric set runs on an owned DGX Spark, flagships too large to self-host are proxied via build.nvidia.com, and paid burst goes to NVIDIA Brev — the line item the agent pays to stay alive. Stripe closes the loop: customers subscribe, revenue books in, and the steward spends through Stripe Issuing rails to buy the compute back. The whole P&L — revenue in, vendor out, net positive — reads on one hardware meter, with no human in the hot loop.

---

## Tweet copy

```
Hermetika: a curated pantheon of esoteric models, operated by a Hermes agent — not a team.

It admits models through a license gate, serves them on an owned DGX Spark + proxied flagships, and its steward pays its own NVIDIA compute bill out of Stripe revenue. Net positive, no human in the loop.

@NousResearch #HermesHackathon
[DEMO VIDEO LINK]
```

---

## Demo video

**Link:** _[PLACEHOLDER — upload the 1–3 min cut to YouTube unlisted, paste URL here]_

Follows `docs/demo/DEMO-SCRIPT.md`: Shot A (agent admits a model live), Shot B (sandbox + $2 checkout), Shot C (the survival loop firing autonomously).

---

## Submission checklist

- [ ] Fill the Typeform: http://form.typeform.com/to/hpEifIK4
- [ ] Record the 1–3 min demo (script: `docs/demo/DEMO-SCRIPT.md`), upload to YouTube unlisted
- [ ] Paste the video link into the Demo video placeholder above and into the tweet
- [ ] Post in Discord (http://discord.gg/nousresearch): demo video link + the 3–5 sentence description + GitHub link
- [ ] Tweet with `@NousResearch #HermesHackathon` + video + short writeup
- [ ] README covers: what it is, how to run locally, Stripe test/demo mode, screenshots
- [ ] Confirm the steward runs on the safe rail for filming (`STEWARD_RAIL=demo` books without moving real money; switch to `stripe` only intentionally)

---

## How to run locally

```
bun install; bun run dev
```

Gateway comes up on `http://localhost:3001` (see the `⚷ hermetika gateway` line); the SPA on the Vite dev port. Seeded demo revenue books on boot so the P&L has a customer side — set `SEED_DEMO_REVENUE=0` to start clean.
