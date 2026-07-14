-- Budget-aware manual and delayed event-driven rank pulses.

alter table public.businesses
  add column if not exists last_manual_rank_refresh_at timestamptz;

create table if not exists public.market_refresh_queue (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  collection_type text not null
    check (collection_type = 'event_rank_pulse'),
  trigger_source text not null
    check (trigger_source in ('task_completion', 'gbp_event', 'gbp_identity_change')),
  trigger_ref text,
  keyword_scope text not null default '__all__',
  run_after timestamptz not null,
  status text not null default 'pending'
    check (status in ('pending', 'running', 'completed', 'skipped', 'failed')),
  calls_estimated smallint not null default 0,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists market_refresh_queue_due_idx
  on public.market_refresh_queue (run_after)
  where status = 'pending';

create unique index if not exists market_refresh_queue_pending_business_idx
  on public.market_refresh_queue (business_id)
  where status = 'pending';

alter table public.market_refresh_queue enable row level security;

create policy "Users can view own market refresh queue"
  on public.market_refresh_queue for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );
