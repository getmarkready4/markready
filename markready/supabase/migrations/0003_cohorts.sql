-- 0003_cohorts.sql
-- Founding cohort (first 100 signups) + waitlist gate + signup attribution.
-- Apply via the Supabase SQL editor (see the 0001 note on how migrations are
-- deployed).
--
-- Cohorts:
--   founding — one of the first 100 signups; 2 free scored essays, lifetime
--   waitlist — signup 101+; can authenticate but cannot score
--   staff    — team accounts; unlimited, exempt from quota and onboarding
--
-- Quota is NOT stored as a counter. It is derived from submissions at request
-- time (see src/lib/quota.ts) so there is one source of truth and no drift.

alter table public.profiles
  add column if not exists cohort text not null default 'waitlist',
  add column if not exists referral_source text,
  add column if not exists referral_detail text,
  add column if not exists upgrade_interest_at timestamptz;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_cohort_check'
  ) then
    alter table public.profiles
      add constraint profiles_cohort_check
      check (cohort in ('founding', 'waitlist', 'staff'));
  end if;
end $$;

-- Backfill: every account that exists at migration time is a team account.
-- WARNING: run this only while the sole accounts are team members. If real
-- users have already signed up, replace this with an explicit email list:
--   update public.profiles set cohort = 'staff' where email in ('a@x.com', ...);
update public.profiles set cohort = 'staff';

-- Assign cohort at signup by headcount. Accepted race: two concurrent signups
-- can both read the same count and both land in 'founding'. Worst case is a
-- handful of extra founding users, not double. Strict correctness would need an
-- advisory lock; deliberately not doing that for MVP (consistent with the
-- daily-cap race accepted in 2026-07-02).
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_count int;
begin
  -- Staff accounts must not consume founding places: the 100 is 100 real users.
  select count(*) into existing_count
  from public.profiles
  where cohort <> 'staff';

  insert into public.profiles (id, email, cohort)
  values (
    new.id,
    new.email,
    case when existing_count < 100 then 'founding' else 'waitlist' end
  );

  return new;
end;
$$;
