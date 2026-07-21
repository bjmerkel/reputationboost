-- Ranking Autopilot Phase F: in-app notifications for suggestions and conclusions

create table if not exists public.user_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  business_id uuid references public.businesses on delete cascade not null,
  type text not null
    check (type in ('suggestion_created', 'experiment_queued', 'experiment_concluded')),
  experiment_id uuid references public.ranking_experiments on delete cascade,
  title text not null,
  body text not null,
  read_at timestamptz,
  created_at timestamptz default now() not null
);

create index if not exists user_notifications_user_unread_idx
  on public.user_notifications (user_id, business_id, created_at desc)
  where read_at is null;

alter table public.user_notifications enable row level security;

create policy "Users can manage own notifications"
  on public.user_notifications for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
