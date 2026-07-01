# Hosting — hermetika.io

Web (static SPA) on **Cloudflare Pages**, gateway (Bun/Elysia) on **Fly.io**, Cloudflare as
DNS + SSL. Supabase (auth) and Stripe (billing) are external services the gateway talks to.

```
                         hermetika.io  (Cloudflare — DNS + SSL + CDN)
        ┌────────────────────────────┴─────────────────────────────┐
        │                                                            │
   hermetika.io                                            api.hermetika.io
   Cloudflare Pages                                        Fly.io  (Bun gateway)
   apps/web (Vite build → dist)   ──fetch VITE_API_BASE──▶ /v1/chat · /api/* · /webhooks/stripe
        │                                                            │
        └── Supabase Auth (magic link → JWT) ◀───── verify token, gate free vs pro ──┘
                                             Stripe Checkout + webhook ◀── api.hermetika.io/webhooks/stripe
```

┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

## 1 · Gateway → Fly (api.hermetika.io)

```
fly launch --no-deploy          # from repo root; reuses fly.toml, app "hermetika-gateway"
fly secrets set \
  SUPABASE_URL=https://eggksxzwehpwithcagih.supabase.co \
  SUPABASE_ANON_KEY=<anon key> \
  STRIPE_SECRET_KEY=sk_live_or_test_... \
  STRIPE_WEBHOOK_SECRET=whsec_...        # from the prod webhook endpoint (step 4)
fly deploy
fly certs add api.hermetika.io          # then add the DNS record below
```
`fly.toml` already sets `APP_URL` + `CORS_ORIGIN` to `https://hermetika.io` and health-checks `/health`.

## 2 · Web → Cloudflare Pages (hermetika.io)

Connect the repo in the Pages dashboard (or `wrangler pages deploy`):
- **Build command:** `bun install && bun run --filter './apps/web' build`
- **Output dir:** `apps/web/dist`
- **Env (Production):** from `apps/web/.env.production.example`
  - `VITE_API_BASE=https://api.hermetika.io`
  - `VITE_SUPABASE_URL=https://eggksxzwehpwithcagih.supabase.co`
  - `VITE_SUPABASE_ANON_KEY=<anon key>`
- SPA fallback is handled by `apps/web/public/_redirects`.
- Add custom domain **hermetika.io** in Pages.

## 3 · DNS (Cloudflare)

```
TYPE    NAME    VALUE                         PROXY
CNAME   @       <project>.pages.dev           proxied   (Pages auto-manages once domain added)
CNAME   api     hermetika-gateway.fly.dev     proxied
```

## 4 · Dashboard settings (can't be done from code)

- **Supabase → Authentication → URL Configuration:**
  - Site URL: `https://hermetika.io`
  - Redirect URLs: `https://hermetika.io`, `https://hermetika.io/**` (keep localhost for dev)
- **Supabase → Authentication → Email Templates → Magic Link:** paste `apps/server/emails/supabase-magic-link.html`
- **Stripe → Developers → Webhooks:** add endpoint `https://api.hermetika.io/webhooks/stripe`,
  events: `checkout.session.completed`, `invoice.paid`, `customer.subscription.deleted` →
  copy the signing secret into the Fly secret `STRIPE_WEBHOOK_SECRET`.

┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈

## Env matrix

| var | dev | Fly (gateway) | Pages (web) |
|-----|-----|---------------|-------------|
| VITE_API_BASE | "" (proxy) | — | https://api.hermetika.io |
| VITE_SUPABASE_URL / ANON_KEY | .env.local | — | Pages env |
| SUPABASE_URL / ANON_KEY | apps/server/.env | fly secret | — |
| STRIPE_SECRET_KEY / WEBHOOK_SECRET | apps/server/.env | fly secret | — |
| APP_URL / CORS_ORIGIN | default | fly.toml | — |

Note: the separate gateway you built can slot in at `api.hermetika.io` instead of the Fly app —
same contract (`/v1/chat/completions`, `/api/*`, `/webhooks/stripe`); just point the DNS + `VITE_API_BASE` at it and set its CORS to allow `https://hermetika.io`.
