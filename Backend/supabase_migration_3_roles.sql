-- =====================================================================
-- Aakarshan AI - STEP 3: role-based access control for the admin console
-- Run after supabase_migration_2_ab_testing.sql. Safe to run more than once.
-- =====================================================================

alter table public.users add column if not exists role text not null default 'user';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'users_role_check') then
    alter table public.users add constraint users_role_check check (role in ('user', 'admin'));
  end if;
end $$;

-- Make yourself the first admin (replace the e-mail), then use the Admin tab to manage others:
-- update public.users set role = 'admin' where email = 'you@example.com';
