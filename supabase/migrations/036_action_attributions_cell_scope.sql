-- Per-cell attribution scope for ranking autopilot experiments (Phase C)

alter table public.action_attributions
  add column if not exists experiment_id uuid references public.ranking_experiments(id) on delete set null,
  add column if not exists grid_north numeric(6, 3),
  add column if not exists grid_east numeric(6, 3),
  add column if not exists target_cell_rank_before int,
  add column if not exists target_cell_rank_after int,
  add column if not exists target_cell_rank_delta int;

create index if not exists action_attributions_experiment_idx
  on public.action_attributions (experiment_id)
  where experiment_id is not null;
