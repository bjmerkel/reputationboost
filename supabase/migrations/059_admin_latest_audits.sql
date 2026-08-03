-- Accurate latest audit timestamps for admin dashboard (no row-limit scan).

create or replace view public.admin_latest_audits_by_user as
select
  user_id,
  max(completed_at) as last_audit_at
from public.audit_runs
group by user_id;

create or replace view public.admin_latest_audits_by_business as
select
  business_id,
  max(completed_at) as last_audit_at
from public.audit_runs
group by business_id;
