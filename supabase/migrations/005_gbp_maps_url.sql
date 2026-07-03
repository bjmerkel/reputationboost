-- Canonical Google Maps listing URL from Places API
alter table public.businesses
  add column if not exists gbp_maps_url text;
