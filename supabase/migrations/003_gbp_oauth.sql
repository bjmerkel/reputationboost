-- GBP OAuth connection per business (per-user tokens)

alter table public.businesses
  add column if not exists gbp_account_id text,
  add column if not exists gbp_location_id text,
  add column if not exists gbp_refresh_token text,
  add column if not exists gbp_access_token text,
  add column if not exists gbp_token_expires_at timestamptz,
  add column if not exists gbp_connected_at timestamptz,
  add column if not exists onboarding_complete boolean not null default false;

create index if not exists businesses_onboarding_idx on public.businesses (user_id, onboarding_complete);
