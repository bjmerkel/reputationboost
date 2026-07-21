-- Normalized competitor profile snapshots for beat-the-leader diffs (Ranking Autopilot Phase A)

create table if not exists public.competitor_profile_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  place_id text not null,
  collected_at timestamptz not null,
  source text not null check (source in ('audit', 'grid', 'leader_enrichment')),
  profile jsonb not null,
  created_at timestamptz default now() not null,
  unique (business_id, keyword, place_id, collected_at)
);

create index if not exists competitor_profile_snapshots_business_keyword_idx
  on public.competitor_profile_snapshots (business_id, keyword, collected_at desc);

create index if not exists competitor_profile_snapshots_place_id_idx
  on public.competitor_profile_snapshots (place_id, collected_at desc);

alter table public.competitor_profile_snapshots enable row level security;

create policy "Users can view own competitor_profile_snapshots"
  on public.competitor_profile_snapshots for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );
