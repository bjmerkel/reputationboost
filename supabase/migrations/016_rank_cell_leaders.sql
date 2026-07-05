-- Per-cell local pack leaders for historical competitor overlay (Pillar 4)

create table if not exists public.rank_cell_leaders (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  date date not null,
  grid_north numeric(6, 3) not null,
  grid_east numeric(6, 3) not null,
  position smallint not null check (position between 1 and 3),
  place_id text,
  name text not null,
  rating numeric(2, 1),
  review_count integer,
  created_at timestamptz default now() not null,
  unique (business_id, keyword, date, grid_north, grid_east, position)
);

create index if not exists rank_cell_leaders_business_keyword_date_idx
  on public.rank_cell_leaders (business_id, keyword, date desc);

alter table public.rank_cell_leaders enable row level security;

create policy "Users can view own rank_cell_leaders"
  on public.rank_cell_leaders for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );
