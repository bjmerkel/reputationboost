-- Track when Google sends GOOGLE_UPDATE Pub/Sub notifications for a business.
alter table public.businesses
  add column if not exists gbp_google_update_at timestamptz;

create index if not exists businesses_gbp_google_update_at_idx
  on public.businesses (gbp_google_update_at desc)
  where gbp_google_update_at is not null;
