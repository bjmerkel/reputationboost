-- Profile Guide flyer studio Phase 6: prompt versioning and feedback

alter table public.profile_guide_flyer_studio
  add column if not exists prompt_version text not null default '6.1.0',
  add column if not exists quality_warnings jsonb not null default '[]'::jsonb,
  add column if not exists feedback_rating smallint check (feedback_rating in (-1, 1)),
  add column if not exists feedback_at timestamptz,
  add column if not exists feedback_history_id text;
