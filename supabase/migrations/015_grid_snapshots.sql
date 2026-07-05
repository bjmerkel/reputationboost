-- Grid snapshot metadata for temporal heatmap diff (Pillar 2)

create table if not exists public.grid_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  keyword text not null,
  date date not null,
  grid_size smallint not null default 5,
  spacing_miles numeric(4, 2) not null default 0.35,
  cells_total smallint not null,
  cells_in_pack smallint not null,
  coverage_percent numeric(5, 2) not null,
  source text not null default 'audit',
  trigger_task_id uuid references public.execution_tasks on delete set null,
  created_at timestamptz default now() not null,
  unique (business_id, keyword, date)
);

create index if not exists grid_snapshots_business_keyword_date_idx
  on public.grid_snapshots (business_id, keyword, date desc);

alter table public.grid_snapshots enable row level security;

create policy "Users can view own grid_snapshots"
  on public.grid_snapshots for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );

-- Spatial attribution on completed plan tasks
alter table public.action_attributions
  add column if not exists grid_coverage_before numeric(5, 2),
  add column if not exists grid_coverage_after numeric(5, 2),
  add column if not exists cells_improved smallint;
