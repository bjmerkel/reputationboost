-- Profile Guide Phase 2: theme editor, text messages, GBP sync, attribution bridge

alter table public.profile_guides
  add column if not exists background_color text not null default '#f8f9fa',
  add column if not exists button_style text not null default 'rounded',
  add column if not exists font_preset text not null default 'professional',
  add column if not exists text_message text,
  add column if not exists gbp_synced_at timestamptz;

alter table public.review_outreach_attributions
  add column if not exists profile_guide_id uuid references public.profile_guides on delete set null,
  add column if not exists profile_guide_link_id uuid references public.profile_guide_links on delete set null;

create index if not exists review_outreach_attributions_profile_guide_idx
  on public.review_outreach_attributions (profile_guide_id)
  where profile_guide_id is not null;
