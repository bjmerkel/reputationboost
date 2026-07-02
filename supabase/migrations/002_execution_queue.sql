-- Phase 3: Execution task queue with approval workflow

create table if not exists public.execution_tasks (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  audit_id text not null,
  action_item_id text not null,
  task_type text not null,
  title text not null,
  description text not null default '',
  priority text not null default 'P2',
  status text not null default 'pending_approval',
  draft_content text not null default '',
  payload jsonb not null default '{}',
  requires_approval boolean not null default true,
  scheduled_for timestamptz,
  completed_at timestamptz,
  result text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists execution_tasks_user_id_idx on public.execution_tasks (user_id);
create index if not exists execution_tasks_business_id_idx on public.execution_tasks (business_id);
create index if not exists execution_tasks_audit_id_idx on public.execution_tasks (audit_id);
create index if not exists execution_tasks_status_idx on public.execution_tasks (status);

alter table public.execution_tasks enable row level security;

create policy "Users can manage own execution tasks"
  on public.execution_tasks for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
