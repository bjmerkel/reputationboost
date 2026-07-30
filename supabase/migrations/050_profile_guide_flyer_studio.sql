-- Profile Guide: persisted AI flyer studio state per guide

create table if not exists public.profile_guide_flyer_studio (
  guide_id uuid primary key references public.profile_guides on delete cascade,
  template text not null default 'professional',
  format text not null default 'letter',
  prompt_refinement text not null default '',
  display_options jsonb not null default '{"showPhone":true,"showStars":true,"showAddress":false,"showTagline":true}'::jsonb,
  image_prompt text,
  copy jsonb,
  preview_url text,
  background_url text,
  history jsonb not null default '[]'::jsonb,
  selected_history_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profile_guide_flyer_studio_updated_idx
  on public.profile_guide_flyer_studio (updated_at desc);

alter table public.profile_guide_flyer_studio enable row level security;

create policy "Users can manage own profile guide flyer studio"
  on public.profile_guide_flyer_studio for all
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
