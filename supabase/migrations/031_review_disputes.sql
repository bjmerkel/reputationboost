-- Review dispute tracking for Plan step 9 workflow

create table if not exists public.review_disputes (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  review_id text not null,
  status text not null default 'flagged',
  policy_violation text not null,
  evidence_notes text,
  reviewer_name text,
  review_rating smallint,
  review_text text,
  review_published_at timestamptz,
  execution_task_id uuid references public.execution_tasks on delete set null,
  projected_score_gain numeric(5, 2),
  submitted_at timestamptz,
  resolved_at timestamptz,
  resolution_notes text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (business_id, review_id)
);

create index if not exists review_disputes_business_idx
  on public.review_disputes (business_id, status, created_at desc);

create index if not exists review_disputes_user_idx
  on public.review_disputes (user_id, created_at desc);

alter table public.review_disputes enable row level security;

create policy "Users can manage own review disputes"
  on public.review_disputes for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
