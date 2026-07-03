-- Driver vs outcome columns on daily score snapshots

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
