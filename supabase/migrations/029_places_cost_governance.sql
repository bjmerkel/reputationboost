-- Persistent Places request deduplication and conservative monthly call budgets.

create table if not exists public.places_search_cache (
  cache_key text primary key,
  search_mode text not null check (search_mode in ('nearby', 'text')),
  results jsonb not null,
  fetched_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count integer not null default 0
);

create index if not exists places_search_cache_expires_idx
  on public.places_search_cache (expires_at);

create table if not exists public.places_api_monthly_usage (
  business_id uuid not null references public.businesses(id) on delete cascade,
  month date not null,
  calls_budget integer not null default 120,
  calls_reserved integer not null default 0,
  collections_skipped integer not null default 0,
  updated_at timestamptz not null default now(),
  primary key (business_id, month)
);

create table if not exists public.market_collection_claims (
  business_id uuid not null references public.businesses(id) on delete cascade,
  collection_type text not null,
  keyword text not null,
  period_start date not null,
  status text not null default 'running'
    check (status in ('running', 'completed', 'failed')),
  calls_reserved integer not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error_message text,
  primary key (business_id, collection_type, keyword, period_start)
);

alter table public.places_search_cache enable row level security;
alter table public.places_api_monthly_usage enable row level security;
alter table public.market_collection_claims enable row level security;

alter table public.ingest_runs
  add column if not exists result jsonb,
  add column if not exists places_calls_reserved integer not null default 0,
  add column if not exists places_collections_skipped integer not null default 0;

create or replace function public.reserve_places_api_calls(
  p_business_id uuid,
  p_month date,
  p_calls integer,
  p_budget integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  affected_rows integer := 0;
begin
  insert into public.places_api_monthly_usage (
    business_id,
    month,
    calls_budget
  ) values (
    p_business_id,
    p_month,
    p_budget
  )
  on conflict (business_id, month) do nothing;

  update public.places_api_monthly_usage
  set calls_reserved = calls_reserved + greatest(p_calls, 0),
      updated_at = now()
  where business_id = p_business_id
    and month = p_month
    and calls_reserved + greatest(p_calls, 0) <= calls_budget;

  get diagnostics affected_rows = row_count;
  return affected_rows > 0;
end;
$$;

create or replace function public.release_places_api_calls(
  p_business_id uuid,
  p_month date,
  p_calls integer
) returns void
language sql
security definer
set search_path = public
as $$
  update public.places_api_monthly_usage
  set calls_reserved = greatest(0, calls_reserved - greatest(p_calls, 0)),
      updated_at = now()
  where business_id = p_business_id
    and month = p_month;
$$;

revoke all on function public.reserve_places_api_calls(uuid, date, integer, integer)
  from public, anon, authenticated;
grant execute on function public.reserve_places_api_calls(uuid, date, integer, integer)
  to service_role;

revoke all on function public.release_places_api_calls(uuid, date, integer)
  from public, anon, authenticated;
grant execute on function public.release_places_api_calls(uuid, date, integer)
  to service_role;
