-- GBP profile alerts and moderation events (Pub/Sub + nightly sync)

create table if not exists public.gbp_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  event_type text not null,
  severity text not null default 'info' check (severity in ('info', 'warning', 'critical')),
  source text not null default 'pubsub' check (source in ('pubsub', 'nightly', 'audit')),
  title text not null,
  message text not null,
  external_id text,
  payload jsonb not null default '{}'::jsonb,
  plan_step_number smallint,
  plan_scroll_target text,
  detected_at timestamptz not null default now(),
  acknowledged_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index if not exists gbp_events_external_unique
  on public.gbp_events (business_id, external_id);

create index if not exists gbp_events_business_active_idx
  on public.gbp_events (business_id, detected_at desc)
  where acknowledged_at is null;

create index if not exists gbp_events_user_active_idx
  on public.gbp_events (user_id, detected_at desc)
  where acknowledged_at is null;

alter table public.gbp_events enable row level security;

create policy "Users can view own gbp events"
  on public.gbp_events for select
  using (auth.uid() = user_id);

create policy "Users can acknowledge own gbp events"
  on public.gbp_events for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Nightly moderation scan watermark per business
alter table public.businesses
  add column if not exists gbp_moderation_scan_at timestamptz;
