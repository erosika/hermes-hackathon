-- subscriptions system-of-record. the gateway writes via the service role (bypasses RLS).
create table if not exists public.subscriptions (
  id          text primary key,
  plan_slug   text not null,
  customer_ref text not null,
  status      text not null default 'active',
  price_usd   numeric not null,
  created_at  timestamptz not null default now()
);

create index if not exists subscriptions_active_customer
  on public.subscriptions (customer_ref) where status = 'active';

-- RLS on, no public policies: only the service role (gateway) can read/write.
alter table public.subscriptions enable row level security;
