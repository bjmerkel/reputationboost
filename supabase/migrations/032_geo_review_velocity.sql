-- Geo-targeted review velocity: customer job locations, cell targeting, weakness index

alter table public.customers
  add column if not exists service_address text,
  add column if not exists service_city text,
  add column if not exists service_zip text,
  add column if not exists service_lat double precision,
  add column if not exists service_lng double precision,
  add column if not exists grid_north numeric(6, 3),
  add column if not exists grid_east numeric(6, 3),
  add column if not exists geo_resolved_at timestamptz;

alter table public.sms_messages
  add column if not exists target_grid_north numeric(6, 3),
  add column if not exists target_grid_east numeric(6, 3),
  add column if not exists target_zone text,
  add column if not exists neighborhood_label text;

alter table public.review_keyword_campaigns
  add column if not exists target_zones text[],
  add column if not exists target_cells jsonb,
  add column if not exists geo_baseline_coverage jsonb;

alter table public.review_outreach_attributions
  add column if not exists target_grid_north numeric(6, 3),
  add column if not exists target_grid_east numeric(6, 3),
  add column if not exists target_zone text,
  add column if not exists review_mentions_neighborhood boolean;

create table if not exists public.cell_weakness_scores (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  grid_north numeric(6, 3) not null,
  grid_east numeric(6, 3) not null,
  zone_direction text,
  rank integer,
  in_local_pack boolean not null default false,
  review_gap integer not null default 0,
  weakness_score numeric(5, 2) not null,
  computed_at timestamptz not null default now()
);

create index if not exists cell_weakness_scores_business_keyword_idx
  on public.cell_weakness_scores (business_id, keyword, computed_at desc);

create index if not exists cell_weakness_scores_lookup_idx
  on public.cell_weakness_scores (business_id, grid_north, grid_east, weakness_score desc);

create index if not exists customers_grid_cell_idx
  on public.customers (business_id, grid_north, grid_east)
  where grid_north is not null and grid_east is not null;

create index if not exists sms_messages_target_cell_idx
  on public.sms_messages (business_id, target_grid_north, target_grid_east, sent_at desc)
  where target_grid_north is not null;

alter table public.cell_weakness_scores enable row level security;

create policy "Users can read own cell weakness scores"
  on public.cell_weakness_scores for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );
