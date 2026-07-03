-- Daily listing strength snapshots + cross-customer step calibration

create table if not exists public.score_daily (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  date date not null,
  overall smallint not null,
  visibility smallint not null,
  conversion smallint not null,
  revenue_capture smallint not null,
  source text not null default 'ingest',
  created_at timestamptz default now() not null,
  unique (business_id, date)
);

create index if not exists score_daily_business_date_idx
  on public.score_daily (business_id, date desc);

-- Aggregated step impact from all customers (refreshed by nightly ingest)
create table if not exists public.score_calibration_global (
  step_number smallint primary key,
  sample_size integer not null default 0,
  median_rank_delta numeric(6, 2),
  median_calls_delta numeric(8, 2),
  estimated_score_impact smallint not null,
  updated_at timestamptz default now() not null
);

alter table public.score_daily enable row level security;
alter table public.score_calibration_global enable row level security;

create policy "Users can view own score_daily"
  on public.score_daily for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

-- Global calibration is read-only for authenticated users (no PII)
create policy "Authenticated users can read score_calibration_global"
  on public.score_calibration_global for select
  to authenticated
  using (true);
