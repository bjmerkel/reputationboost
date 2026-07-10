-- Version rank/grid measurements so legacy radius data never blends with radial samples.

alter table public.rank_snapshots
  add column if not exists ranking_model text not null default 'legacy_nearby_radius';

alter table public.grid_snapshots
  add column if not exists ranking_model text not null default 'legacy_nearby_radius';

alter table public.rank_cell_leaders
  add column if not exists ranking_model text not null default 'legacy_nearby_radius';

do $$
declare
  constraint_row record;
begin
  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.rank_snapshots'::regclass and contype = 'u'
  loop
    execute format('alter table public.rank_snapshots drop constraint %I', constraint_row.conname);
  end loop;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.grid_snapshots'::regclass and contype = 'u'
  loop
    execute format('alter table public.grid_snapshots drop constraint %I', constraint_row.conname);
  end loop;

  for constraint_row in
    select conname
    from pg_constraint
    where conrelid = 'public.rank_cell_leaders'::regclass and contype = 'u'
  loop
    execute format('alter table public.rank_cell_leaders drop constraint %I', constraint_row.conname);
  end loop;
end $$;

alter table public.rank_snapshots
  add constraint rank_snapshots_identity_model_key
  unique (business_id, keyword, date, distance_miles, grid_north, grid_east, ranking_model);

alter table public.grid_snapshots
  add constraint grid_snapshots_identity_model_key
  unique (business_id, keyword, date, ranking_model);

alter table public.rank_cell_leaders
  add constraint rank_cell_leaders_identity_model_key
  unique (business_id, keyword, date, grid_north, grid_east, position, ranking_model);

create index if not exists rank_snapshots_model_date_idx
  on public.rank_snapshots (business_id, keyword, ranking_model, date desc);

create index if not exists grid_snapshots_model_date_idx
  on public.grid_snapshots (business_id, keyword, ranking_model, date desc);
