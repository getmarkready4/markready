# Plan — One free mark per day; retire founding/waitlist; self-healing profiles

**Status:** awaiting human approval. No code written yet.
**Trigger:** signup hang on `/welcome` (2026-09-07) + product decision to drop the
founding/waitlist gate in favour of one free scored essay per user per day.

---

## Goal

1. Every non-staff user gets **1 free scored essay per UTC day**. Staff unlimited.
2. **No founding cohort, no waitlist.** Everyone who signs up can score today.
3. **A missing `profiles` row can never brick an account.** The app creates it
   on demand instead of silently updating nothing.
4. Keep the "how did you hear about us" gate — it is GTM data and was not the bug.

## Root cause being fixed alongside

`/api/profile` used `update … eq(id)`, which returns 204 on zero rows. With the
profile row deleted, the proxy kept redirecting to `/welcome`, and the page's
`router.push` soft-navigated back onto itself with `saving` still true.
Confirmed from edge logs 2026-09-07 15:39–15:42 (three identical cycles).

---

## Decisions

| Decision | Choice | Why |
|---|---|---|
| Cohort model | `cohort in ('user','staff')`; default `'user'` | Keeps the staff exemption; drops the counting trigger and the two dead states |
| Daily window | **UTC midnight** | Matches the original daily-cap convention already documented in BUILD_STATUS; no timezone plumbing |
| Quota rule | `count(today's successful scores + in-flight <5 min) > 1` → 403 | Same placeholder-row pattern as before; failures don't burn the mark |
| Missing profile | `/api/profile` **upserts** (`id`, `email`, fields) | Self-heals a deleted row; no more silent 204 |
| Post-save navigation | `window.location.assign('/score')` | Hard navigation — a proxy redirect can no longer land on a stale component |
| Unknown/null cohort | treated as `'user'` (limited), never staff | Fail closed on privilege, but never lock anyone out |
| `/waitlist` page | **delete** — route, matcher entry, redirects | Dead state; nothing can reach it |
| `/upgrade` page | keep; copy becomes "today's free mark is used — back tomorrow, or tell us you want unlimited" | Interest capture stays useful |

---

## Migration `0004_daily_free_mark.sql` (needs explicit approval — production DB)

```sql
-- 1. Cohorts collapse to user/staff
alter table public.profiles drop constraint if exists profiles_cohort_check;
update public.profiles set cohort = 'user' where cohort in ('founding', 'waitlist');
alter table public.profiles alter column cohort set default 'user';
alter table public.profiles
  add constraint profiles_cohort_check check (cohort in ('user', 'staff'));

-- 2. Trigger no longer counts anyone
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, cohort)
  values (new.id, new.email, 'user');
  return new;
end;
$$;

-- 3. Repair: every auth user gets a profile row (idempotent)
insert into public.profiles (id, email, cohort)
select u.id, u.email, 'user'
from auth.users u
where not exists (select 1 from public.profiles p where p.id = u.id);

-- 4. Team accounts (confirm this list)
update public.profiles set cohort = 'staff'
where email in ('nlnguyen@gmail.com', 'getmarkready@gmail.com', 'albertchang011@gmail.com');
```

Step 3 immediately un-bricks `nlnguyen@gmail.com` and `treeholicleebot@gmail.com`.

---

## Files

| File | Change |
|---|---|
| `markready/supabase/migrations/0004_daily_free_mark.sql` | new — above |
| `markready/src/lib/quota.ts` | `Cohort = 'user' \| 'staff'`; `DAILY_FREE_LIMIT = 1`; `countUsedToday()` (UTC window + 5-min placeholder guard) |
| `markready/src/app/api/profile/route.ts` | POST → **upsert** for both attribution and upgrade-interest; GET reports daily `used/remaining/limit` |
| `markready/src/app/api/score/route.ts` | drop `waitlist` 403; daily quota with `reset: 'midnight UTC'`; `remaining` = today's |
| `markready/src/proxy.ts` | remove waitlist redirects + matcher entry; onboarding gate unchanged |
| `markready/src/app/welcome/page.tsx` | hard navigation after save |
| `markready/src/app/upgrade/page.tsx` | daily copy |
| `markready/src/app/score/page.tsx` | "1 free mark left today" / "That was today's free mark — back tomorrow"; drop `waitlist` code branch |
| `markready/src/app/waitlist/page.tsx` | **delete** |
| `markready/src/app/api/score/route.test.ts` | remove waitlist tests; quota tests → limit 1 (count 2 → 403, count 1 → 200); null cohort → limited not locked out; staff + onboarding tests kept |

**Untouched:** scoring prompts, charts, question bank, ScoreReport/annotation, dashboard.

## Verification before merge

- tsc / eslint / vitest / `next build` green
- Live: sign in as `nlnguyen@gmail.com` → `/welcome` saves and lands on `/score` (this is the exact failing flow)
- Live: non-staff account scores once → second attempt → `/upgrade` with the daily copy; `/api/score` returns 403 `quota_exhausted`
- Live: staff account scores twice in a row
- DB: `select cohort, count(*) from profiles group by 1` shows only `user`/`staff`; zero auth users without a profile
