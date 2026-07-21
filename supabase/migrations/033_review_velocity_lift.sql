-- Review velocity lift measurement per keyword x grid cell

create table if not exists public.review_velocity_lift (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  attribution_id uuid references public.review_outreach_attributions(id) on delete set null,
  sms_message_id uuid references public.sms_messages(id) on delete set null,
  review_id text,
  keyword text not null,
  grid_north numeric(6, 3) not null,
  grid_east numeric(6, 3) not null,
  target_zone text,
  sent_at timestamptz not null,
  review_detected_at timestamptz not null,
  rank_before integer,
  rank_after integer,
  in_pack_before boolean,
  in_pack_after boolean,
  coverage_before numeric(5, 2),
  coverage_after numeric(5, 2),
  lift_score numeric(6, 2),
  measured_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'measured', 'insufficient_data')),
  created_at timestamptz not null default now()
);

create index if not exists review_velocity_lift_business_keyword_idx
  on public.review_velocity_lift (business_id, keyword, measured_at desc nulls last);

create index if not exists review_velocity_lift_cell_idx
  on public.review_velocity_lift (business_id, keyword, grid_north, grid_east, status);

create index if not exists review_velocity_lift_pending_idx
  on public.review_velocity_lift (business_id, status, review_detected_at)
  where status = 'pending';

alter table public.review_velocity_lift enable row level security;

create policy "Users can read own review velocity lift"
  on public.review_velocity_lift for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

alter table public.cell_weakness_scores
  add column if not exists lift_adjustment numeric(5, 2) not null default 0;
