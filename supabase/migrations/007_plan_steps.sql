-- Phase 0: Link execution tasks to plan steps

alter table public.execution_tasks
  add column if not exists plan_step_number integer,
  add column if not exists plan_phase_id text;

update public.execution_tasks
set plan_step_number = cast(substring(action_item_id from 'gbp-step-(\d+)') as integer)
where action_item_id like 'gbp-step-%'
  and plan_step_number is null;

create index if not exists execution_tasks_plan_step_idx
  on public.execution_tasks (audit_id, plan_step_number);
