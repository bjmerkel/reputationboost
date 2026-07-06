-- Repair migration: ensure extended attribution columns exist on production.
-- Safe to run even if 011, 013, 014, or 015 were skipped or partially applied.

alter table public.action_attributions
  add column if not exists projected_driver_impact smallint,
  add column if not exists observed_driver_impact smallint,
  add column if not exists driver_score_before smallint,
  add column if not exists driver_score_after smallint,
  add column if not exists projected_outcome_impact smallint,
  add column if not exists projected_revenue_gain integer,
  add column if not exists observed_outcome_impact smallint,
  add column if not exists outcome_index_before smallint,
  add column if not exists outcome_index_after smallint,
  add column if not exists grid_coverage_before numeric(5, 2),
  add column if not exists grid_coverage_after numeric(5, 2),
  add column if not exists cells_improved smallint;

create index if not exists action_attributions_projection_idx
  on public.action_attributions (business_id, published_at desc)
  where projected_driver_impact is not null;

create index if not exists action_attributions_outcome_projection_idx
  on public.action_attributions (business_id, published_at desc)
  where projected_outcome_impact is not null;
