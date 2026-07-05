-- Per-business heatmap grid profile (compact / standard / extended)

alter table public.businesses
  add column if not exists heatmap_profile text not null default 'standard'
  check (heatmap_profile in ('compact', 'standard', 'extended'));
