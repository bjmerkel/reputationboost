-- Admin weekly digest send log (idempotency)

create table if not exists public.admin_digest_sends (
  week_start date primary key,
  sent_at timestamptz not null default now(),
  recipient_count integer not null default 0
);

alter table public.admin_digest_sends enable row level security;

-- Service role only (no user policies)
