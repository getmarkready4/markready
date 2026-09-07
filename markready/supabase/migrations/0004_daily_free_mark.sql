-- 0004_daily_free_mark.sql
-- Retires the founding/waitlist gate in favour of one free scored essay per
-- user per UTC day, and repairs any auth user left without a profile row.
-- Apply via the Supabase SQL editor AFTER the matching app code is deployed:
-- the new code tolerates the old cohort values, but the old code treats an
-- unknown cohort as waitlist and would gate real users until the deploy lands.
--
-- Cohorts after this migration:
--   user  — everyone; 1 free mark per UTC day (enforced in /api/score)
--   staff — team accounts; unlimited, exempt from onboarding

-- 1. Cohorts collapse to user/staff.
alter table public.profiles drop constraint if exists profiles_cohort_check;

update public.profiles
  set cohort = 'user'
  where cohort in ('founding', 'waitlist');

alter table public.profiles alter column cohort set default 'user';

alter table public.profiles
  add constraint profiles_cohort_check check (cohort in ('user', 'staff'));

-- 2. Signup trigger no longer counts anyone.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, cohort)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

-- 3. Repair: every auth user gets a profile row. Idempotent. A profile can go
--    missing when rows are cleared in the Table Editor during testing; the app
--    now recreates a missing row on demand too, but this closes the gap for
--    accounts that never revisit /welcome.
insert into public.profiles (id, email, cohort)
select u.id, u.email, 'user'
from auth.users u
where u.email is not null  -- profiles.email is NOT NULL; an email-less auth user cannot be onboarded anyway
  and not exists (select 1 from public.profiles p where p.id = u.id);

-- 4. Team accounts.
update public.profiles
  set cohort = 'staff'
  where email in (
    'nlnguyen@gmail.com',
    'getmarkready@gmail.com',
    'albertchang011@gmail.com'
  );
