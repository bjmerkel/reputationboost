-- Ranking experiments: per-cell beat-the-leader GBP tests (Ranking Autopilot Phase B)

create table if not exists public.ranking_experiments (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  audit_id text not null,
  keyword text not null,
  grid_north numeric(6, 3) not null,
  grid_east numeric(6, 3) not null,
  leader_place_id text not null,
  leader_name text not null,
  action_type text not null,
  plan_step_number int,
  hypothesis text not null,
  leader_delta jsonb not null,
  market_key text not null,
  status text not null default 'proposed'
    check (status in (
      'proposed',
      'pending_approval',
      'running',
      'measuring',
      'won',
      'lost',
      'inconclusive',
      'cancelled'
    )),
  execution_task_id uuid references public.execution_tasks on delete set null,
  baseline_snapshot_date date not null,
  target_rank_before int,
  target_rank_after int,
  target_cell_improved boolean,
  attribution_window_days int not null default 14,
  started_at timestamptz,
  concluded_at timestamptz,
  conclusion_reason text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists ranking_experiments_active_cell_idx
  on public.ranking_experiments (business_id, keyword, grid_north, grid_east)
  where status in ('proposed', 'pending_approval', 'running', 'measuring');

create index if not exists ranking_experiments_business_status_idx
  on public.ranking_experiments (business_id, status, created_at desc);

create index if not exists ranking_experiments_task_idx
  on public.ranking_experiments (execution_task_id)
  where execution_task_id is not null;

alter table public.ranking_experiments enable row level security;

create policy "Users can manage own ranking_experiments"
  on public.ranking_experiments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
