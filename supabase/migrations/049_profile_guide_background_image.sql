-- Profile Guide: optional cover/background image from GBP photos

alter table public.profile_guides
  add column if not exists background_image_url text;
