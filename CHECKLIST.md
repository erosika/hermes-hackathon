# Hermetika — manual setup checklist

Things only Eri can do (accounts, keys, hardware). Code is wired to **degrade safely**: nothing
here is needed to run the demo in dry-run/demo mode — each item just upgrades a stub to real.
Copy `apps/server/.env.example` → `apps/server/.env` and fill as you go.

## Steward spend rail — Stripe Issuing (the agent wallet)
- [ ] Enable **Issuing** on the Stripe account (dashboard → Issuing → activate).
- [ ] Create a **Cardholder** (the business entity) → note `ich_…` id.
- [ ] `cd apps/server && bun add stripe`
- [ ] Run `provisionAgentCard(cardholderId, policy)` once (one-off script) → stash card id.
- [ ] `.env`: `STRIPE_SECRET_KEY`, `STRIPE_ISSUING_CARD`, `STEWARD_RAIL=stripe`, `STEWARD_ISSUING_ARMED=1`
- [ ] Sanity: caps (`STEWARD_MAX_TX_USD` / `STEWARD_MAX_DAILY_USD`) auto-mirror onto the card's spending_controls.

## Steward reasoning — make it actually agentic (NOT WIRED YET — next on roadmap)
- [ ] (code) make the steward narrate its decision via Hermes-4, within deterministic rails
- [ ] then `.env`: `NOUS_API_KEY` + `STEWARD_REASON=1` to turn it on

## Income side — Stripe subscriptions (D4)
- [ ] `.env`: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
- [ ] Create Pantheon Pro price/product; wire the webhook → `recordIncome` (not built yet — see roadmap).

## Memory + sessions — Honcho
- [ ] `.env`: `HONCHO_API_KEY`, `HONCHO_WORKSPACE=hermetika`
- [ ] (real SDK wiring for chat sessions + steward thoughts is still stubbed — see roadmap D3.)

## Registry + ledger source-of-record — Supabase (D4)
- [ ] `.env`: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- [ ] Apply schema (models / profiles / subscriptions / usage / ledger / shares). (ledger is in-memory today.)

## Compute — owned floor + paid ceiling
- [ ] **DGX Spark** reachable over Tailscale → `.env`: `SPARK_VLLM_URL` (hot), `SPARK_OLLAMA_URL` (tail)
- [ ] **Brev** burst → `.env`: `BREV_BASE_URL`, `BREV_API_KEY`
- [ ] Proxy flagships → `.env`: `NVIDIA_API_KEY`, `NOUS_API_KEY`, `OPENROUTER_API_KEY`

## Deploy
- [ ] Fly app for the gateway; set the above as Fly **secrets** (never commit `.env`).
- [ ] Confirm Tailscale reachability from Fly → Spark (the one early-derisk item).
