-- Webhook outreach channel preference + scheduled email queue

alter table public.businesses
  add column if not exists webhook_outreach_channel text not null default 'auto';

alter table public.email_messages
  add column if not exists scheduled_at timestamptz;

create index if not exists email_messages_scheduled_due_idx
  on public.email_messages (scheduled_at)
  where status = 'scheduled';
