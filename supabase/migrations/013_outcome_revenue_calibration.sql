-- Outcome and revenue calibration on global step aggregates

alter table public.score_calibration_global
  add column if not exists median_observed_outcome_impact smallint,
  add column if not exists median_observed_revenue_gain integer,
  add column if not exists median_projected_revenue_gain integer,
  add column if not exists revenue_projection_sample_size integer not null default 0,
  add column if not exists revenue_projection_scale numeric(4, 2) not null default 1;

alter table public.action_attributions
  add column if not exists projected_outcome_impact smallint,
  add column if not exists projected_revenue_gain integer;
