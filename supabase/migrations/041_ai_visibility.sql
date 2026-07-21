-- AI answer visibility: whether ChatGPT, Gemini, and Google AI Overviews recommend a business.

create table if not exists public.ai_visibility_snapshots (
  id uuid primary key default gen_random_uuid(),
  business_id uuid references public.businesses(id) on delete cascade not null,
  keyword text not null,
  query_text text not null,
  surface text not null check (surface in ('google_ai_overview', 'chatgpt', 'gemini')),
  date date not null,
  mentioned boolean not null default false,
  recommended boolean not null default false,
  position smallint,
  competitors_named jsonb not null default '[]',
  citations jsonb not null default '[]',
  answer_excerpt text,
  raw_response_hash text,
  source text not null default 'api',
  created_at timestamptz not null default now(),
  unique (business_id, keyword, surface, date, query_text)
);

create index if not exists ai_visibility_snapshots_business_date_idx
  on public.ai_visibility_snapshots (business_id, date desc);

create index if not exists ai_visibility_snapshots_business_keyword_idx
  on public.ai_visibility_snapshots (business_id, keyword, date desc);

alter table public.ai_visibility_snapshots enable row level security;

create policy "Users can view own ai_visibility_snapshots"
  on public.ai_visibility_snapshots for select
  using (
    business_id in (
      select id from public.businesses where user_id = auth.uid()
    )
  );
