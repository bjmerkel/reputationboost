-- Cross-client market calibration from ranking experiments (Ranking Autopilot Phase D)

create table if not exists public.score_calibration_market (
  market_key text not null,
  action_type text not null,
  step_number smallint,
  sample_size integer not null default 0,
  median_target_cell_rank_delta numeric(6, 2),
  median_rank_improvement numeric(6, 2),
  win_rate numeric(5, 4),
  confidence text not null default 'default'
    check (confidence in ('high', 'medium', 'low', 'default')),
  updated_at timestamptz default now() not null,
  primary key (market_key, action_type)
);

create index if not exists score_calibration_market_action_idx
  on public.score_calibration_market (action_type, sample_size desc);

alter table public.score_calibration_market enable row level security;

create policy "Authenticated users can read score_calibration_market"
  on public.score_calibration_market for select
  to authenticated
  using (true);
