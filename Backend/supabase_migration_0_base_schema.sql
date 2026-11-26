-- =====================================================================
-- Aakarshan AI - STEP 0 (fresh projects only): base tables and storage bucket
-- Run FIRST on a brand-new Supabase project, then run, in order:
--   supabase_migration.sql  ->  supabase_migration_2_ab_testing.sql  ->  supabase_migration_3_roles.sql
-- If your project already has the `users` and `campaigns` tables, skip this file.
-- =====================================================================

create extension if not exists pgcrypto;

-- Profile row for every account created through /api/auth/register (id = Supabase auth user id)
create table if not exists public.users (
  id          uuid primary key references auth.users(id) on delete cascade,
  full_name   text not null,
  email       text not null unique,
  created_at  timestamptz not null default now()
);

-- One row per generated campaign. Counters are kept up to date by record_ad_event() (migration 1).
create table if not exists public.campaigns (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  brand_name         text not null,
  category           text,
  target_audience    text,
  platform           text,
  prompt             text default '',
  headline           text,
  ad_copy            text,
  cta                text,
  hashtags           text[] not null default '{}',
  image_url          text,
  status             text not null default 'active',
  performance_score  numeric,
  performance_tier   text,
  views              integer not null default 0,
  likes              integer not null default 0,
  shares             integer not null default 0,
  comments           integer not null default 0,
  created_at         timestamptz not null default now()
);
create index if not exists campaigns_user_created_idx on public.campaigns (user_id, created_at desc);

-- The API uses the service-role key (bypasses RLS). Enabling RLS with no policies means the
-- public anon key can never read or write these tables directly.
alter table public.users     enable row level security;
alter table public.campaigns enable row level security;

-- Public bucket for the composited ad images (the API uploads with the service-role key).
insert into storage.buckets (id, name, public)
values ('campaign-images', 'campaign-images', true)
on conflict (id) do nothing;
