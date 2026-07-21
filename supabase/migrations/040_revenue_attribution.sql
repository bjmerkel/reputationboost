-- Revenue-per-keyword attribution: CRM transactions, rollups, observed ACV

alter table public.businesses
  add column if not exists observed_avg_customer_value numeric(10, 2),
  add column if not exists observed_avg_customer_value_currency text not null default 'USD',
  add column if not exists observed_acv_sample_size integer not null default 0,
  add column if not exists observed_acv_updated_at timestamptz;

create table if not exists public.revenue_transactions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  customer_event_id uuid references public.customer_events on delete set null,
  external_id text,
  source text not null default 'webhook',
  event_type text not null,
  amount numeric(12, 2) not null,
  currency text not null default 'USD',
  occurred_at timestamptz not null,
  matched_keyword text,
  matched_grid_north numeric(6, 3),
  matched_grid_east numeric(6, 3),
  matched_zone text,
  match_method text,
  match_confidence numeric(3, 2),
  gbp_call_matched boolean not null default false,
  created_at timestamptz default now() not null,
  unique (business_id, source, external_id)
);

create index if not exists revenue_transactions_business_occurred_idx
  on public.revenue_transactions (business_id, occurred_at desc);

create index if not exists revenue_transactions_business_keyword_idx
  on public.revenue_transactions (business_id, matched_keyword)
  where matched_keyword is not null;

create index if not exists revenue_transactions_unmatched_idx
  on public.revenue_transactions (business_id)
  where matched_keyword is null;

create table if not exists public.keyword_revenue_monthly (
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  month date not null,
  observed_revenue numeric(12, 2) not null default 0,
  observed_jobs integer not null default 0,
  modeled_revenue numeric(12, 2),
  avg_rank smallint,
  impressions integer,
  unique (business_id, keyword, month)
);

create index if not exists keyword_revenue_monthly_business_month_idx
  on public.keyword_revenue_monthly (business_id, month desc);

create table if not exists public.grid_cell_revenue_monthly (
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  grid_north numeric(6, 3) not null,
  grid_east numeric(6, 3) not null,
  month date not null,
  observed_revenue numeric(12, 2) not null default 0,
  observed_jobs integer not null default 0,
  modeled_revenue numeric(12, 2),
  avg_rank smallint,
  unique (business_id, keyword, grid_north, grid_east, month)
);

create index if not exists grid_cell_revenue_monthly_business_month_idx
  on public.grid_cell_revenue_monthly (business_id, month desc);

alter table public.revenue_transactions enable row level security;
alter table public.keyword_revenue_monthly enable row level security;
alter table public.grid_cell_revenue_monthly enable row level security;

create policy "Users can view own revenue transactions"
  on public.revenue_transactions for select
  using (auth.uid() = user_id);

create policy "Users can view own keyword revenue monthly"
  on public.keyword_revenue_monthly for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = keyword_revenue_monthly.business_id
        and b.user_id = auth.uid()
    )
  );

create policy "Users can view own grid cell revenue monthly"
  on public.grid_cell_revenue_monthly for select
  using (
    exists (
      select 1 from public.businesses b
      where b.id = grid_cell_revenue_monthly.business_id
        and b.user_id = auth.uid()
    )
  );
