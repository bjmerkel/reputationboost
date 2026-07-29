-- Repair score_calibration_global columns used by attribution calibration refresh.
-- Migrations 012/013 may not have been applied on all environments.

alter table public.score_calibration_global
  add column if not exists projection_sample_size integer not null default 0,
  add column if not exists median_projected_driver_impact smallint,
  add column if not exists median_observed_driver_impact smallint,
  add column if not exists median_observed_outcome_impact smallint,
  add column if not exists median_observed_revenue_gain integer,
  add column if not exists median_projected_revenue_gain integer,
  add column if not exists revenue_projection_sample_size integer not null default 0,
  add column if not exists revenue_projection_scale numeric(4, 2) not null default 1,
  add column if not exists median_directions_delta numeric(8, 2),
  add column if not exists median_website_clicks_delta numeric(8, 2);
