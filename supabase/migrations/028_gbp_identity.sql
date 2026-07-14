-- Persist owned-location identity returned by the free Business Profile APIs.

alter table public.businesses
  add column if not exists gbp_address text,
  add column if not exists gbp_open_status text,
  add column if not exists gbp_secondary_categories text[] not null default '{}',
  add column if not exists gbp_service_area jsonb;

comment on column public.businesses.gbp_open_status is
  'Business Information API openInfo.status for the connected location.';

comment on column public.businesses.gbp_address is
  'Formatted storefront address from the connected Business Profile location.';

comment on column public.businesses.gbp_secondary_categories is
  'Business Information API additional category display names.';

comment on column public.businesses.gbp_service_area is
  'Versioned Business Information API service-area places and business coordinates.';
