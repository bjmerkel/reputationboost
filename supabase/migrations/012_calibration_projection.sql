-- Projection-accuracy fields on global step calibration

alter table public.score_calibration_global
  add column if not exists projection_sample_size integer not null default 0,
  add column if not exists median_projected_driver_impact smallint,
  add column if not exists median_observed_driver_impact smallint;
