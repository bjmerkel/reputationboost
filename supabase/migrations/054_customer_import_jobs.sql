-- Background customer CSV/JSON import jobs

create table if not exists public.customer_import_jobs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'pending'
    check (status in ('pending', 'processing', 'completed', 'failed', 'cancelled')),
  import_format text not null default 'csv'
    check (import_format in ('csv', 'json')),
  raw_csv text,
  raw_json jsonb,
  total_rows int not null default 0,
  processed_rows int not null default 0,
  imported_count int not null default 0,
  updated_count int not null default 0,
  failed_count int not null default 0,
  skipped_count int not null default 0,
  parse_line_offset int not null default 0,
  parse_errors jsonb not null default '[]'::jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  constraint customer_import_jobs_payload_check check (
    (import_format = 'csv' and raw_csv is not null)
    or (import_format = 'json' and raw_json is not null)
  )
);

create index if not exists customer_import_jobs_pending_idx
  on public.customer_import_jobs (created_at)
  where status in ('pending', 'processing');

create index if not exists customer_import_jobs_business_idx
  on public.customer_import_jobs (business_id, created_at desc);

alter table public.customer_import_jobs enable row level security;

create policy "Users can view own customer import jobs"
  on public.customer_import_jobs for select
  using (auth.uid() = user_id);

create policy "Users can insert own customer import jobs"
  on public.customer_import_jobs for insert
  with check (auth.uid() = user_id);
