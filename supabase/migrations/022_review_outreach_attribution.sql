-- Review outreach attribution + private feedback routing

alter table public.businesses
  add column if not exists private_feedback_url text;

create table if not exists public.review_outreach_attributions (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  sms_message_id uuid references public.sms_messages on delete set null,
  customer_event_id uuid references public.customer_events on delete set null,
  review_author text,
  review_rating smallint,
  review_detected_at timestamptz not null default now(),
  attribution_method text not null default 'time_window',
  window_days smallint not null default 14,
  created_at timestamptz default now() not null
);

create index if not exists review_outreach_attributions_business_idx
  on public.review_outreach_attributions (business_id, review_detected_at desc);

create unique index if not exists review_outreach_attributions_sms_unique
  on public.review_outreach_attributions (sms_message_id)
  where sms_message_id is not null;

alter table public.review_outreach_attributions enable row level security;

create policy "Users can view own outreach attributions"
  on public.review_outreach_attributions for select
  using (auth.uid() = user_id);
