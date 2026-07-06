-- Scheduled SMS review requests (delay queue)

alter table public.sms_messages
  add column if not exists scheduled_at timestamptz;

create index if not exists sms_messages_scheduled_due_idx
  on public.sms_messages (scheduled_at)
  where status = 'scheduled';
