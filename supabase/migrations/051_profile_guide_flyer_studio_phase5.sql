-- Profile Guide flyer studio: archetype + cover photo preferences

alter table public.profile_guide_flyer_studio
  add column if not exists archetype text,
  add column if not exists archetype_override text,
  add column if not exists selected_cover_url text;
