-- Hermetika gateway — Supabase (Postgres) system-of-record.
-- Mirrors the in-memory stores in apps/server/src/{seed,ledger,subscriptions}; those remain
-- source-of-truth until callers are switched over. camelCase fields map to snake_case columns here.

-- registry of the pantheon (mirrors shared Model + seed MODELS)
create table if not exists models (
  id          text primary key,
  slug        text not null unique,
  name        text not null,
  kind        text not null,            -- art | ascii | visual | tech
  lineage     text,                     -- parent slug (the dynasty); null = root
  backend     text not null,            -- gpu | proxy
  backend_ref text not null,            -- <gpu|proxy>://<provider>/<id>
  speed       text not null,            -- fast (1-3B hot lane) | standard
  released_at date,
  card_md     text,
  tags        text[] not null default '{}',
  enabled     boolean not null default true,
  license     text,
  price_usd   numeric(12,4)
);

-- Hermes operators as Honcho peers (mirrors shared Profile + seed PROFILES)
create table if not exists profiles (
  id       text primary key,
  slug     text not null unique,        -- e.g. hermes.hermetika
  name     text not null,
  peer_id  text not null,               -- honcho peer
  role     text not null,               -- orchestrator | curator | ops | steward
  curates  text[] not null default '{}' -- model slugs
);

-- Stripe subscription state per customer/model
create table if not exists subscriptions (
  id           text primary key,
  model_slug   text not null,
  customer_ref text not null,
  status       text not null,
  price_usd    numeric(12,4),
  created_at   timestamptz not null default now()
);

-- per-call meter — one row per completed inference
create table if not exists usage (
  id          text primary key,
  model_slug  text not null,
  provider    text,
  tokens_in   integer not null default 0,
  tokens_out  integer not null default 0,
  cost_usd    numeric(12,4) not null default 0,
  session_id  text,
  created_at  timestamptz not null default now()
);

-- survival P&L (mirrors shared LedgerEntry): income = revenue in, spend = real USD out
create table if not exists ledger (
  id         text primary key,
  kind       text not null,             -- income | spend
  amount_usd numeric(12,4) not null,
  ref        text not null,             -- stripe | brev | api
  profile    text,
  note       text,
  created_at timestamptz not null default now()
);

-- public portable manifests for /m/<slug> share cards
create table if not exists shares (
  id         text primary key,
  model_slug text not null,
  manifest   jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_subscriptions_model_slug on subscriptions (model_slug);
create index if not exists idx_subscriptions_customer_ref on subscriptions (customer_ref);
create index if not exists idx_usage_model_slug on usage (model_slug);
create index if not exists idx_usage_created_at on usage (created_at);
create index if not exists idx_ledger_kind on ledger (kind);
create index if not exists idx_ledger_created_at on ledger (created_at);
create index if not exists idx_shares_model_slug on shares (model_slug);
