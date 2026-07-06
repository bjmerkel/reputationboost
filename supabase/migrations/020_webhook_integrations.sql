-- Universal inbound webhook for CRM / field-service / invoicing tools (Zapier, Make, etc.)

alter table public.businesses
  add column if not exists webhook_token text unique,
  add column if not exists webhook_auto_send boolean not null default false,
  add column if not exists webhook_delay_hours integer not null default 2,
  add column if not exists webhook_trigger_events text[] not null default array['job.completed', 'invoice.paid'];

alter table public.customers
  add column if not exists external_ids jsonb not null default '{}',
  add column if not exists last_event_at timestamptz,
  add column if not exists last_event_type text;

create table if not exists public.customer_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  customer_id uuid references public.customers on delete set null,
  event_type text not null,
  source text not null default 'webhook',
  external_id text,
  payload jsonb not null default '{}',
  occurred_at timestamptz not null default now(),
  review_request_sent boolean not null default false,
  created_at timestamptz default now() not null
);

create index if not exists customer_events_business_id_idx on public.customer_events (business_id);
create index if not exists customer_events_customer_id_idx on public.customer_events (customer_id);
create index if not exists customer_events_occurred_at_idx on public.customer_events (business_id, occurred_at desc);

alter table public.customer_events enable row level security;

create policy "Users can view own customer events"
  on public.customer_events for select
  using (auth.uid() = user_id);

create index if not exists businesses_webhook_token_idx on public.businesses (webhook_token);
