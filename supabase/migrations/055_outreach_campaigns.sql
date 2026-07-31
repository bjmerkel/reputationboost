-- Bulk outreach campaigns (queue-based SMS/email review requests)

create table if not exists public.outreach_campaigns (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'planning'
    check (status in ('planning', 'queuing', 'active', 'completed', 'cancelled', 'failed')),
  channel text not null check (channel in ('sms', 'email', 'auto')),
  focus_keyword text,
  sms_template text not null,
  email_template text,
  email_subject text,
  target_count int not null default 0,
  queued_sms_count int not null default 0,
  queued_email_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  skipped_count int not null default 0,
  daily_send_cap int not null default 100,
  spread_start_at timestamptz not null default now(),
  planned_entries jsonb not null default '[]'::jsonb,
  queue_offset int not null default 0,
  import_job_id uuid references public.customer_import_jobs(id) on delete set null,
  dry_run boolean not null default false,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists outreach_campaigns_business_idx
  on public.outreach_campaigns (business_id, created_at desc);

create index if not exists outreach_campaigns_queuing_idx
  on public.outreach_campaigns (created_at)
  where status = 'queuing';

alter table public.sms_messages
  add column if not exists outreach_campaign_id uuid references public.outreach_campaigns(id) on delete set null;

alter table public.email_messages
  add column if not exists outreach_campaign_id uuid references public.outreach_campaigns(id) on delete set null;

create unique index if not exists sms_messages_campaign_customer_scheduled_idx
  on public.sms_messages (outreach_campaign_id, customer_id)
  where status = 'scheduled' and outreach_campaign_id is not null;

create unique index if not exists email_messages_campaign_customer_scheduled_idx
  on public.email_messages (outreach_campaign_id, customer_id)
  where status = 'scheduled' and outreach_campaign_id is not null;

alter table public.outreach_campaigns enable row level security;

create policy "Users can view own outreach campaigns"
  on public.outreach_campaigns for select
  using (auth.uid() = user_id);

create policy "Users can insert own outreach campaigns"
  on public.outreach_campaigns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own outreach campaigns"
  on public.outreach_campaigns for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
