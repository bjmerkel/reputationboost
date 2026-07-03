-- Global learned score model (click-share curve + blend weights)

create table if not exists public.score_model_global (
  id smallint primary key default 1 check (id = 1),
  click_share_pack1 numeric(5, 2) not null default 45,
  click_share_pack2 numeric(5, 2) not null default 25,
  click_share_pack3 numeric(5, 2) not null default 15,
  click_share_outside numeric(5, 2) not null default 3,
  click_share_deep numeric(5, 2) not null default 3,
  click_share_samples integer not null default 0,
  blend_visibility numeric(4, 3) not null default 0.5,
  blend_conversion numeric(4, 3) not null default 0.3,
  blend_revenue_capture numeric(4, 3) not null default 0.2,
  blend_samples integer not null default 0,
  source text not null default 'default',
  updated_at timestamptz default now() not null
);

insert into public.score_model_global (id)
values (1)
on conflict (id) do nothing;

alter table public.score_model_global enable row level security;

create policy "Authenticated users can read score_model_global"
  on public.score_model_global for select
  to authenticated
  using (true);
