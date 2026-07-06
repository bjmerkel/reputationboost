-- Customer contacts for review request SMS campaigns

create table if not exists public.customers (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  first_name text not null default '',
  last_name text not null default '',
  phone text not null,
  email text,
  service_notes text,
  last_service_date date,
  source text not null default 'manual',
  opted_out boolean not null default false,
  review_requested_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (business_id, phone)
);

create index if not exists customers_business_id_idx on public.customers (business_id);
create index if not exists customers_review_eligible_idx
  on public.customers (business_id, opted_out, review_requested_at)
  where opted_out = false;

alter table public.customers enable row level security;

create policy "Users can manage own customers"
  on public.customers for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Outbound SMS log for review requests and delivery tracking

create table if not exists public.sms_messages (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  execution_task_id text,
  to_phone text not null,
  body text not null,
  status text not null default 'pending',
  provider text not null default 'twilio',
  provider_sid text,
  error_message text,
  sent_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists sms_messages_business_id_idx on public.sms_messages (business_id);
create index if not exists sms_messages_customer_id_idx on public.sms_messages (customer_id);

alter table public.sms_messages enable row level security;

create policy "Users can manage own sms messages"
  on public.sms_messages for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
