-- Ranking Autopilot Phase E: per-business modes + bandit selection metadata

alter table public.businesses
  add column if not exists autopilot_mode text not null default 'manual'
    check (autopilot_mode in ('off', 'manual', 'suggest', 'auto'));

alter table public.ranking_experiments
  add column if not exists origin text not null default 'manual'
    check (origin in ('manual', 'suggested', 'auto')),
  add column if not exists bandit_metadata jsonb;

create index if not exists ranking_experiments_suggested_idx
  on public.ranking_experiments (business_id, created_at desc)
  where status = 'proposed' and origin = 'suggested';
