-- Run this once in the Supabase SQL editor for the Felice project.
create table if not exists public.app_settings (
  key text primary key,
  value text not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;
grant select, insert, update on public.app_settings to service_role;

-- Site branding is public, so the logo bucket allows public reads.
insert into storage.buckets (id, name, public)
values ('felice-assets', 'felice-assets', true)
on conflict (id) do update set public = true;