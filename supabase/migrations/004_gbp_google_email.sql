-- Store the Google account email used for GBP OAuth (distinct from Supabase sign-in)

alter table public.businesses
  add column if not exists gbp_google_email text;
