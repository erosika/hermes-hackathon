# Hermetika — Full Ops Handoff (for an autonomous agent)

Everything needed to operate hermetika.io end-to-end. Written to be self-sufficient: an agent
with this doc + repo access + the machines can run the whole platform. Identifiers below are
infra references (not secrets); actual secret VALUES live in Fly/Supabase/keychain (see §Secrets).

---

## 0. What it is
Hermetika = an interface for exploring esoteric/experimental/niche LLMs. A curated "pantheon"
of small+weird models, **self-hosted on owned NVIDIA hardware** (two DGX Sparks), served through
one OpenAI-compatible gateway. Subscription (Stripe $2/mo Pantheon Pro) gates unlimited use;
free tier = 5 messages per model. No proxying — everything is owned weights on the Sparks.

Live:
- Site:    https://hermetika.io  (also https://hermetika.pages.dev, www.hermetika.io)
- Gateway: https://hermetika-gateway.fly.dev  (intended custom domain: https://api.hermetika.io — DNS not live)

---

## 1. Architecture (owned floor, no proxy)
```
BROWSER (Vite SPA, Cloudflare Pages)
   │  HTTPS + Supabase JWT (Bearer)  ·  per-customer auth
   ▼
FLY GATEWAY  hermetika-gateway.fly.dev  (Elysia/Bun, always-warm)
   ├ /api/models          registry ⊕ live Ollama /api/tags (resident flags, auto-surface)
   ├ /v1/chat/completions OpenAI-compat · auth gate (free 5/model | pro unlimited) · input/output caps
   ├ /api/sessions[/:id]  chat transcript archive (Supabase, per-user RLS)
   ├ /api/subscribe /api/portal /webhooks/stripe   billing
   └ /api/auth/me /api/nudge /api/profiles /health
   │  per-model backend resolve: gpu://spark/<slug> or gpu://sparktail/<slug>
   │  HTTPS + Bearer (infra token), over Tailscale FUNNEL (public TLS)
   ▼
CADDY (docker, per Spark)  bearer-auth reverse proxy on :8080  →  127.0.0.1:11434
   ▼
OLLAMA (systemd, per Spark)  serves the GGUF models
   ▼
2× DGX SPARK  (GB10, 128GB unified each, ~273 GB/s, aarch64/CUDA)
   spark-1 (host spark-66f4, tailscale 100.72.92.74) = hot lane  gpu://spark
   spark-2 (host spark-1a01, tailscale 100.68.36.57) = breadth   gpu://sparktail
   tailnet MagicDNS suffix: tail9518ea.ts.net  (funnels: spark-1.tail9518ea.ts.net, spark-2…)
```
Owned floor = free marginal cost. Sparks are the whole product; there is NO paid proxy/Brev lane.

---

## 2. Repo (Bun monorepo)
Root: `/Users/eribarrett/Documents/coding/hermes-hackathon` · GitHub: `github.com/erosika/hermes-hackathon` (default branch **master**).
Package mgr: **bun** (never npm). Python: **uv**.
```
apps/server/src/
  index.ts        Elysia app: routes, /v1 handler, auth gate, /api/models live-merge, persistence
  seed.ts         MODELS[] (the pantheon registry) + PROFILES[] (hermetika operator)
  backends.ts     BACKENDS: spark + sparktail (baseUrl from env, apiKey=bearer, failover twins)
  router.ts       slug→backend resolve + dispatch (adds stop tokens + max_tokens clamp)
  auth.ts         Supabase JWT verify via GET /auth/v1/user (never throws → returns null)
  ratelimit.ts    free tier: FREE.perModel = 5, keyed (identity|model), in-memory
  chats.ts        Supabase transcript store (ensureSession/appendMessages/list/get) — degrade-safe
  subscriptions.ts billing.ts webhooks.ts stripe.ts   Stripe (Pantheon Pro $2/mo)
  db/index.ts     Supabase adapter (getDb) — needs SUPABASE_URL + SUPABASE_SERVICE_KEY
  db/schema.sql   DDL (models/subscriptions/usage/ledger/shares + chat_sessions/chat_messages+RLS)
  honcho.ts       session stub (memory layer, not wired to real SDK yet)
apps/web/src/
  App.tsx         shell: tiling WM, mobile drawer (isMobile→monocle), archive modal
  Sidebar.tsx     pantheon grouped by kind (CATEGORY_ORDER, ascii-first), resident dots, HF links
  SandboxWindow.tsx  chat playground per model + per-model quota bar
  useChatStream.ts   SSE stream, unique sessionId per convo (crypto.randomUUID)
  SessionArchive.tsx chat archive (⌗ in topnav) → /api/sessions
  config.ts       API_BASE: dev="" (vite proxy :3001) · prod=VITE_API_BASE, FALLS BACK to gateway if unset/api.hermetika.io
  supabase.ts     client auth (magic link) + authHeader()
  styles.css      Sanzo Wada themes, mobile @media, safety-gated motion (prefers-reduced-motion)
  fly.toml (root) · apps/server/Dockerfile   deploy config
docs/planning/    specs, handoffs, pantheon-ui-manifest.json
```

---

## 3. Infrastructure detail

### DGX Sparks (owned, on Tailscale)
- ssh: `ssh eri@spark-1` / `ssh eri@spark-2` (user `eri`). NO passwordless sudo.
- Ollama: systemd service, active, binds 127.0.0.1:11434 (NOT exposed directly).
- `ollama list` = installed models; `ollama ps` = loaded/GPU; `nvidia-smi` (GB10 reports N/A mem — normal).
- Prior workload: Step-3.7 vLLM container `vllm_node` (image stepfun37-workspace:latest) — STOPPED.
  Restore anytime: `docker start vllm_node` (eri is in docker group, no sudo). It eats ~115GB, so
  stop it (`docker stop vllm_node`) before loading Ollama models if memory is tight.

### Tailscale (the transport + the gotchas)
- Both Sparks + this Mac are peers on the `erosika` tailnet. MagicDNS suffix `tail9518ea.ts.net`.
- **GOTCHA — SSH "check" mode:** the tailnet SSH ACL is `"action":"check"` → non-interactive ssh
  HANGS waiting for a browser approval. Fixes: (a) run interactive `ssh eri@spark-1 echo ok` once and
  approve the printed URL (~12h), or (b) permanent: admin → Access Controls → ssh block `"check"`→`"accept"`.
- **Funnel** exposes each Spark's Caddy publicly with a real TLS cert:
  `https://spark-1.tail9518ea.ts.net`, `https://spark-2.tail9518ea.ts.net`. Enabled via nodeAttrs
  `funnel` in the ACL + MagicDNS + HTTPS certs on. On-box: `tailscale funnel --bg --https=443 http://127.0.0.1:8080`.

### Caddy (bearer auth in front of Ollama, per Spark, docker)
- `~/hermetika/Caddyfile` (listens :8080, checks `Authorization: Bearer {$SPARK_TOKEN}`, rewrites
  `Host: localhost` — Ollama 403s foreign Host — proxies to 127.0.0.1:11434).
- token: `~/hermetika/token` (chmod 600). Container: `hermetika-auth` (image caddy:2, --network host,
  --restart unless-stopped, `-e SPARK_TOKEN=$(cat ~/hermetika/token)`).
- Verify: `curl -sk https://<ts-ip>/api/version` → 401; with `-H "Authorization: Bearer $(cat ~/hermetika/token)"` → 200.

---

## 4. Gateway (Fly)
- App: `hermetika-gateway` (org: personal / Erika Jane Barrett). `fly.toml` at repo root, build =
  `apps/server/Dockerfile`. internal_port 3001, PORT=3001, **min_machines_running=1** (keep warm —
  idle-stop was dropping the model list). `auto_stop_machines="suspend"`.
- Deploy: `cd <repo root> && fly deploy --ha=false --app hermetika-gateway`.
- Logs: `fly logs --app hermetika-gateway`. Status: `fly status --app hermetika-gateway`.
- Secrets (set via `fly secrets set K=V --app hermetika-gateway`; SPARK tokens already set):
  `SPARK_URL=https://spark-1.tail9518ea.ts.net/v1`  `SPARKTAIL_URL=https://spark-2.tail9518ea.ts.net/v1`
  `SPARK_TOKEN`, `SPARKTAIL_TOKEN` (the per-Spark Caddy bearers)
  `SUPABASE_URL`, `SUPABASE_ANON_KEY` (auth verify), `SUPABASE_SERVICE_KEY` (chat persistence)
  `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (billing)
  fly.toml [env]: `CORS_ORIGIN` (regex allows *.hermetika.pages.dev + *.hermetika.io), `APP_URL`,
  optional `RATE_LIMIT_RPM`, `MAX_INPUT_CHARS` (24000), `MAX_OUTPUT_TOKENS` (2048), `SEED_DEMO_REVENUE`.
- Auth model: `/v1` reads Supabase JWT (readIdentity). Pro (isSubscribed) = unlimited; else free
  tier `checkFreeTier(identity|ip, model)` = 5/model → 402 when spent. Persistence is FIRE-AND-FORGET
  (never blocks/500s inference — this was a real bug, keep it that way).

---

## 5. Web (Cloudflare Pages)
- Project `hermetika`. Domains: hermetika.pages.dev, hermetika.io, www.hermetika.io (all serve the
  ONE production deployment). **Git-connected** → every push to GitHub master triggers a Pages build.
  Production branch is **main** (Cloudflare treats master pushes as production).
- **GOTCHA:** the git-connected production owns the domains; direct `wrangler` uploads can be
  overwritten by the next git build. The git build bakes dashboard env `VITE_API_BASE` (was the dead
  `api.hermetika.io`). MITIGATION in code: `config.ts` falls back to `hermetika-gateway.fly.dev`
  whenever VITE_API_BASE is empty OR contains `api.hermetika.io`. So prod works regardless.
- Deploy (either): `git push origin master` (Pages auto-builds) OR manual:
  `cd apps/web && VITE_API_BASE=https://hermetika-gateway.fly.dev VITE_SUPABASE_URL=… VITE_SUPABASE_ANON_KEY=… bun run build && bunx wrangler pages deploy dist --project-name hermetika --branch main`
- To point at api.hermetika.io eventually: Cloudflare DNS add `A api → 66.241.125.187`, `AAAA api →
  2a09:8280:1::13a:7caf:0` (DNS-only/grey); Fly cert already requested (`fly certs check api.hermetika.io`).
  Then drop the config.ts fallback.

---

## 6. MODELS — the core ops
Registry = `apps/server/src/seed.ts` `MODELS[]`. Each entry (see `packages/shared` `Model` type):
`id, slug, name, kind, lineage, backend:"gpu", backendRef:"gpu://spark|sparktail/<slug>", speed, hfId, author?, license?, params?, releasedAt, cardMd, tags[], enabled`.
`/api/models` returns seed ⊕ live Ollama `/api/tags` (adds `resident` bool + `author`/`hfUrl`; auto-surfaces
resident slugs not yet in seed as kind "uncategorized"). Kinds: art|ascii|visual|tech|puzzle|wordplay|story|music|esoteric|cursed|horror|philosophy|fanfic.

### Add a model (GGUF only, must be ollama-pullable)
1. Pick lane: hot heroes → spark-1 (`gpu://spark`), breadth/curios → spark-2 (`gpu://sparktail`).
2. On the Spark: `ollama pull hf.co/<org>/<repo>:<QUANT>` then `ollama cp hf.co/<org>/<repo>:<QUANT> <clean-slug>`
   (clean slug so router resolves `gpu://spark/<clean-slug>`). Verify: `ollama run <slug> "hi"`.
3. Add a `Model` entry to `seed.ts` (backendRef matches the lane + slug; set kind/author/license/params).
4. `fly deploy --app hermetika-gateway`. (`/api/models` auto-shows resident within ~15s even pre-deploy,
   but curated metadata/kind needs the seed entry + deploy.)
Notes: prefer Q4_K_M/Q6_K; low quant wrecks ASCII spacing. Ollama can't run T5/BERT/diffusion archs.
Requant repos (mradermacher/bartowski/RichardErkhov) are the usual GGUF source for obscure bases.

### Remove / swap
- Remove: `ollama rm <slug>` on the Spark + delete its seed entry → deploy.
- Swap: pull new + `ollama cp` to same slug (or new) + repoint seed → deploy.

### ASCII done right (no good dedicated model exists)
`ollama create ascii-master -f Modelfile` where Modelfile = `FROM <capable resident model, e.g. weirdcompound-24b>`
+ `SYSTEM "master ASCII/ANSI artist, monospace only, box-drawing+shading, aligned, no prose"` + `PARAMETER temperature 0.8`.
Big model + prompt beats every tiny ascii finetune.

### Live health check (one-liner)
`curl -s https://hermetika-gateway.fly.dev/api/models | python3 -c "import sys,json;d=json.load(sys.stdin);print(len(d),'models',sum(m['resident'] for m in d),'resident')"`
Spark funnels: `curl -s -o /dev/null -w '%{http_code}' https://spark-1.tail9518ea.ts.net/api/version` (401=up).

---

## 7. Supabase
- Project ref `eggksxzwehpwithcagih` (name "hermetika", region us-west-2). URL https://eggksxzwehpwithcagih.supabase.co.
- Tables: registry (models/profiles/subscriptions/usage/ledger/shares) + `chat_sessions` + `chat_messages`
  (RLS: `user_email = auth.jwt()->>'email'`). Schema in `apps/server/src/db/schema.sql`.
- Gateway writes with SERVICE_KEY (bypasses RLS); UI reads via gateway with user JWT.
- **Run SQL / migrations without the dashboard:** the Supabase Management API works with the CLI access
  token stored in the Mac keychain. `TOKEN=$(security find-generic-password -s "Supabase CLI" -w)` then
  `POST https://api.supabase.com/v1/projects/eggksxzwehpwithcagih/database/query` with header
  `User-Agent: Mozilla/5.0 …` (Cloudflare WAF blocks bare UA → 1010) and body `{"query":"…"}`.
  Get keys: `supabase projects api-keys --project-ref eggksxzwehpwithcagih -o json` (anon/service_role).
- **KNOWN BROKEN — magic-link email:** SMTP is configured (Resend, sender hermes@hermetika.io) but the
  **Resend API key (smtp_pass) is invalid** → sends fail with "Error sending confirmation email" (proven:
  even Resend's onboarding@resend.dev sender fails = auth-to-Resend failure, not domain). FIX: new Resend
  API key → Supabase → Auth → SMTP → password (or PATCH smtp_pass via Management API config/auth). Until
  fixed, sign-in can't send.

---

## 8. Stripe
- Product: Pantheon Pro, $2/mo. Checkout via `/api/subscribe` (session-aware email). Portal `/api/portal`.
- Webhook `/webhooks/stripe` (raw-body sig verify). **prod STRIPE_WEBHOOK_SECRET must be a Dashboard
  webhook endpoint secret** (the local `stripe listen` whsec won't verify prod events). Endpoint URL to
  register: `https://hermetika-gateway.fly.dev/webhooks/stripe` (events: checkout.session.completed,
  invoice.paid, customer.subscription.deleted).

---

## 9. Known issues / gotchas (all real, learned the hard way)
- Tailscale SSH "check" mode blocks non-interactive ssh → approve or set ACL to "accept".
- Fly idle-stop dropped the model list → `min_machines_running=1` (keep it).
- Cloudflare git-connected prod overrides wrangler deploys; `config.ts` API-base fallback covers it.
- Signed-in chat 500'd when persistence was `await`ed before dispatch → made fire-and-forget; keep it.
- Ollama 403s if Host header isn't localhost → Caddy rewrites Host.
- Some GGUFs leak `<|im_end|>`/template tokens → router injects stop tokens.
- Completion-style tiny models (tinystories, shakespeare) are weak/empty through /v1/chat (they want
  raw completion) — fine as curiosities, flag in UI.
- No GGUF for: conlangs, I-Ching, kabbalah, runes, most ABC-music (ChatMusician is the exception),
  Gemma-diffusion (arch unsupported by Ollama). Don't chase these.

## 10. Secrets inventory (WHERE, not values)
- Spark Caddy bearers: `~/hermetika/token` on each Spark; mirrored as Fly `SPARK_TOKEN`/`SPARKTAIL_TOKEN`.
- Supabase anon/service: `supabase projects api-keys …`; on Fly + web build env.
- Supabase Management API: keychain `security find-generic-password -s "Supabase CLI" -w`.
- Stripe keys: Stripe dashboard; on Fly.
- Fly: `fly auth` (logged in as erosikaakisore@gmail.com). Cloudflare: `wrangler` authed.
- Honcho: `~/.honcho/config.json` (apiKey, peer `eri`, workspace `claude-code`, base api.honcho.dev).
- Local server env: `apps/server/.env` (SUPABASE_*, STRIPE_*, SPARK_* for local dev:server).

## 11. Operating principles (eri's rules)
- Owned floor, no proxy. Everything self-hosted on the 2 Sparks.
- Essentialist UI: Sanzo Wada themes, 0px radius structural, safety-gated motion (NO flash/strobe —
  epilepsy), honor prefers-reduced-motion. techo-digital × liquid-metal.
- HITL for destructive/outward actions (deploys to prod, DB migrations, posts). Ask first.
- Granular commits, preserve authorship, NO AI attribution in commits/PRs.
- bun + uv only. Read code before changing. Verify by running (real smoke tests), not assumptions.

## 12. Quick runbook
```
# health
curl -s https://hermetika-gateway.fly.dev/health
# add model (on a spark)
ssh eri@spark-1 'ollama pull hf.co/ORG/REPO:Q4_K_M && ollama cp hf.co/ORG/REPO:Q4_K_M SLUG'
#   → add Model{} to apps/server/src/seed.ts → fly deploy --app hermetika-gateway
# redeploy gateway
cd <repo> && fly deploy --ha=false --app hermetika-gateway
# redeploy web
cd apps/web && bun run build && bunx wrangler pages deploy dist --project-name hermetika --branch main
# gateway logs / restore step-3.7
fly logs --app hermetika-gateway   ·   ssh eri@spark-1 'docker start vllm_node'
```
