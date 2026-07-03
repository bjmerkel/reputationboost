-- Track projected vs observed driver-score impact per completed action

alter table public.action_attributions
  add column if not exists projected_driver_impact smallint,
  add column if not exists observed_driver_impact smallint,
  add column if not exists driver_score_before smallint,
  add column if not exists driver_score_after smallint;

create index if not exists action_attributions_projection_idx
  on public.action_attributions (business_id, published_at desc)
  where projected_driver_impact is not null;
