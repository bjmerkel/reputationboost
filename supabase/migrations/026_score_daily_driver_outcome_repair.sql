-- Repair migration: ensure driver/outcome columns exist on score_daily.
-- Safe to run even if 010_score_daily_driver_outcome was skipped or partially applied.

alter table public.score_daily
  add column if not exists driver_score smallint,
  add column if not exists outcome_index smallint;

-- Backfill from existing component columns
update public.score_daily
set
  driver_score = coalesce(driver_score, conversion),
  outcome_index = coalesce(
    outcome_index,
    round(visibility * 0.6 + revenue_capture * 0.4)
  )
where driver_score is null or outcome_index is null;
