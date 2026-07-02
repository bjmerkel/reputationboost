-- Reputation Boost: profiles, businesses, audit runs
-- Run in Supabase SQL Editor or via `supabase db push`

-- Profiles (extends auth.users)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Users can insert own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Businesses (one or more per user)
create table if not exists public.businesses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade not null,
  slug text not null,
  name text not null,
  industry text not null default '',
  location jsonb not null default '{}',
  keywords text[] not null default '{}',
  gbp_place_id text,
  website text,
  phone text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (user_id, slug)
);

alter table public.businesses enable row level security;

create policy "Users can manage own businesses"
  on public.businesses for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Audit runs (Phase 1 payloads)
create table if not exists public.audit_runs (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  audit_id text not null,
  trigger text not null default 'manual',
  period text not null default '',
  payload jsonb not null,
  started_at timestamptz not null,
  completed_at timestamptz not null,
  created_at timestamptz default now() not null,
  unique (business_id, audit_id)
);

create index if not exists audit_runs_user_id_idx on public.audit_runs (user_id);
create index if not exists audit_runs_business_id_idx on public.audit_runs (business_id);

alter table public.audit_runs enable row level security;

create policy "Users can manage own audit runs"
  on public.audit_runs for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Seed-friendly: demo business template is created per-user via app on first visit
