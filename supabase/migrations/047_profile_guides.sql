-- Profile Guide: branded link-in-bio pages with QR codes and click analytics

create table if not exists public.profile_guides (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses on delete cascade not null,
  user_id uuid references auth.users on delete cascade not null,
  slug text not null,
  display_name text not null,
  published boolean not null default false,
  published_at timestamptz,
  primary_color text not null default '#1a73e8',
  logo_url text,
  tagline text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique (business_id),
  unique (slug)
);

create index if not exists profile_guides_business_id_idx on public.profile_guides (business_id);
create index if not exists profile_guides_slug_idx on public.profile_guides (slug);
create index if not exists profile_guides_published_idx on public.profile_guides (published) where published = true;

alter table public.profile_guides enable row level security;

create policy "Users can manage own profile guides"
  on public.profile_guides for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Public can read published profile guides"
  on public.profile_guides for select
  using (published = true);

create table if not exists public.profile_guide_links (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.profile_guides on delete cascade not null,
  link_type text not null,
  label text not null,
  url text not null default '',
  sort_order int not null default 0,
  enabled boolean not null default true,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists profile_guide_links_guide_id_idx on public.profile_guide_links (guide_id, sort_order);

alter table public.profile_guide_links enable row level security;

create policy "Users can manage own profile guide links"
  on public.profile_guide_links for all
  using (
    exists (
      select 1 from public.profile_guides pg
      where pg.id = guide_id and pg.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.profile_guides pg
      where pg.id = guide_id and pg.user_id = auth.uid()
    )
  );

create policy "Public can read links for published guides"
  on public.profile_guide_links for select
  using (
    exists (
      select 1 from public.profile_guides pg
      where pg.id = guide_id and pg.published = true
    )
  );

create table if not exists public.profile_guide_events (
  id uuid primary key default gen_random_uuid(),
  guide_id uuid references public.profile_guides on delete cascade not null,
  link_id uuid references public.profile_guide_links on delete set null,
  event_type text not null,
  source text,
  referrer text,
  user_agent text,
  occurred_at timestamptz default now() not null
);

create index if not exists profile_guide_events_guide_time_idx
  on public.profile_guide_events (guide_id, occurred_at desc);

create index if not exists profile_guide_events_link_idx
  on public.profile_guide_events (guide_id, link_id, event_type, occurred_at desc);

alter table public.profile_guide_events enable row level security;

create policy "Users can read own profile guide events"
  on public.profile_guide_events for select
  using (
    exists (
      select 1 from public.profile_guides pg
      where pg.id = guide_id and pg.user_id = auth.uid()
    )
  );
