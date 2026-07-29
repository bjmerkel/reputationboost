-- Outbound email log for review request campaigns (Resend)

create table if not exists public.email_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  execution_task_id text,
  to_email text not null,
  subject text not null,
  body_text text not null,
  body_html text not null,
  status text not null default 'pending',
  provider text not null default 'resend',
  provider_message_id text,
  error_message text,
  focus_keyword text,
  target_grid_north integer,
  target_grid_east integer,
  target_zone text,
  neighborhood_label text,
  sent_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists email_messages_business_id_idx on public.email_messages (business_id);
create index if not exists email_messages_customer_id_idx on public.email_messages (customer_id);
create index if not exists email_messages_sent_at_idx on public.email_messages (business_id, sent_at desc);

alter table public.email_messages enable row level security;

create policy "Users can manage own email messages"
  on public.email_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Link email outreach to review attribution (parallel to sms_message_id)
alter table public.review_outreach_attributions
  add column if not exists email_message_id uuid references public.email_messages on delete set null;

create index if not exists review_outreach_attributions_email_message_id_idx
  on public.review_outreach_attributions (email_message_id)
  where email_message_id is not null;
