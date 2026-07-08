-- Keyword review campaigns + enriched SMS / attribution tracking

alter table public.sms_messages
  add column if not exists focus_keyword text;

alter table public.review_outreach_attributions
  add column if not exists focus_keyword text,
  add column if not exists review_id text,
  add column if not exists review_text text,
  add column if not exists review_mentions_keyword boolean;

create table if not exists public.review_keyword_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  keyword text not null,
  started_at timestamptz not null default now(),
  baseline_mention_count integer not null default 0,
  target_reviews integer,
  attributed_reviews integer not null default 0,
  status text not null default 'active',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create unique index if not exists review_keyword_campaigns_active_unique
  on public.review_keyword_campaigns (business_id, keyword)
  where status = 'active';

create index if not exists review_keyword_campaigns_business_idx
  on public.review_keyword_campaigns (business_id, started_at desc);

create index if not exists sms_messages_focus_keyword_idx
  on public.sms_messages (business_id, focus_keyword, sent_at desc)
  where focus_keyword is not null;

alter table public.review_keyword_campaigns enable row level security;

create policy "Users can manage own review keyword campaigns"
  on public.review_keyword_campaigns for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
