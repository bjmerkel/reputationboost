-- Phase 1: Normalized time-series tables for rank and performance tracking

-- Revenue input for ROI (used in Phase 4)
alter table public.businesses
  add column if not exists avg_customer_value numeric(10, 2),
  add column if not exists avg_customer_value_currency text not null default 'USD';

-- Daily GBP performance metrics (one row per business × date × metric)
create table if not exists public.performance_daily (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  date date not null,
  metric text not null,
  value integer not null default 0,
  source text not null default 'api',
  created_at timestamptz default now() not null,
  unique (business_id, date, metric)
);

create index if not exists performance_daily_business_date_idx
  on public.performance_daily (business_id, date desc);

-- Keyword rank snapshots (one row per business × keyword × grid point × date)
create table if not exists public.rank_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  date date not null,
  distance_miles smallint not null default 1,
  grid_north numeric(6, 3) not null default 0,
  grid_east numeric(6, 3) not null default 0,
  rank smallint,
  in_local_pack boolean not null default false,
  local_pack_position smallint,
  source text not null default 'api',
  created_at timestamptz default now() not null,
  unique (business_id, keyword, date, distance_miles, grid_north, grid_east)
);

create index if not exists rank_snapshots_business_keyword_date_idx
  on public.rank_snapshots (business_id, keyword, date desc);

-- Action attribution (computed in Phase 2; schema created now)
create table if not exists public.action_attributions (
  id uuid primary key default gen_random_uuid(),
  execution_task_id uuid references public.execution_tasks on delete cascade not null unique,
  business_id uuid references public.businesses on delete cascade not null,
  task_type text not null,
  action_item_id text not null,
  published_at timestamptz not null,
  window_days smallint not null default 14,
  primary_keyword text,
  rank_before smallint,
  rank_after smallint,
  rank_delta smallint,
  keywords_improved integer default 0,
  calls_delta integer,
  directions_delta integer,
  website_clicks_delta integer,
  impressions_delta integer,
  estimated_revenue numeric(12, 2),
  narrative text,
  computed_at timestamptz default now() not null,
  created_at timestamptz default now() not null
);

create index if not exists action_attributions_business_idx
  on public.action_attributions (business_id, published_at desc);

-- Ingest run log for ops visibility
create table if not exists public.ingest_runs (
  id uuid primary key default gen_random_uuid(),
  job_name text not null,
  started_at timestamptz not null,
  completed_at timestamptz,
  businesses_processed integer not null default 0,
  performance_rows_upserted integer not null default 0,
  rank_rows_upserted integer not null default 0,
  errors jsonb not null default '[]',
  status text not null default 'running'
);

alter table public.performance_daily enable row level security;
alter table public.rank_snapshots enable row level security;
alter table public.action_attributions enable row level security;
alter table public.ingest_runs enable row level security;

-- Users can read their own business metrics
create policy "Users can view own performance_daily"
  on public.performance_daily for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create policy "Users can view own rank_snapshots"
  on public.rank_snapshots for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

create policy "Users can view own action_attributions"
  on public.action_attributions for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

-- Service role bypasses RLS for cron writes; ingest_runs is service-only (no user policy)
