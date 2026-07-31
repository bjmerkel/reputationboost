-- Retry metadata for scheduled outreach worker

alter table public.sms_messages
  add column if not exists retry_count smallint not null default 0;

alter table public.email_messages
  add column if not exists retry_count smallint not null default 0;
