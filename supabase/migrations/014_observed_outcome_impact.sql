-- Observed outcome impact for closed-loop projection tracking

alter table public.action_attributions
  add column if not exists observed_outcome_impact smallint,
  add column if not exists outcome_index_before smallint,
  add column if not exists outcome_index_after smallint;

create index if not exists action_attributions_outcome_projection_idx
  on public.action_attributions (business_id, published_at desc)
  where projected_outcome_impact is not null;
