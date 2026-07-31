-- Internal admin dashboard: roles and audit log

create table if not exists public.admin_users (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('viewer', 'operator', 'superadmin')),
  granted_by uuid references auth.users on delete set null,
  created_at timestamptz default now() not null
);

alter table public.admin_users enable row level security;

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_user_id uuid references auth.users on delete set null,
  action text not null,
  target_type text,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz default now() not null
);

create index if not exists admin_audit_log_created_at_idx
  on public.admin_audit_log (created_at desc);

create index if not exists admin_audit_log_admin_user_id_idx
  on public.admin_audit_log (admin_user_id);

alter table public.admin_audit_log enable row level security;

-- Latest score snapshot per business (service-role reads for admin dashboard)
create or replace view public.admin_latest_scores as
select distinct on (business_id)
  business_id,
  overall,
  visibility,
  conversion,
  revenue_capture,
  driver_score,
  outcome_index,
  date as score_date
from public.score_daily
order by business_id, date desc;
