-- Internal admin notes on user accounts

create table if not exists public.admin_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  author_id uuid references auth.users on delete set null,
  body text not null,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists admin_notes_user_id_idx
  on public.admin_notes (user_id, created_at desc);

alter table public.admin_notes enable row level security;
