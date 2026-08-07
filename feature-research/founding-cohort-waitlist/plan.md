# Plan — Founding cohort, waitlist gate, attribution capture

**Branch:** `feat/founding-cohort-waitlist` (sandbox — nothing lands on `main` until approved)
**Status:** awaiting human approval. No code written yet.

---

## Goal

Replace the flat "10 evals/day for everyone" model with:

1. **First 100 signups = founding cohort** → 2 free scored essays, lifetime
2. **Signup 101+ = waitlist cohort** → can authenticate, but sees a waitlist page instead of the scorer
3. **Every user must state how they found us** before using the app (attribution → feeds GTM channel measurement)
4. **Founding user who spends both tests** → upgrade/interest page that captures purchase intent

## Constraints

- **Sandbox only.** Work stays on `feat/founding-cohort-waitlist`; production (`main` → `markready-alpha.vercel.app`) untouched until a reviewed merge.
- Preview deploys need the 5 env vars copied to Vercel's **Preview** environment (currently Production-only) — otherwise the preview builds but can't reach Supabase/OpenRouter.
- No payment rails exist yet (Paddle/Xendit is a later GTM step). "Upgrade" captures *intent* only — it must not imply a working checkout.
- Follow existing architecture: service-role client for all writes, RLS SELECT-only for clients, proxy for UI gating, API route for hard enforcement.
- Preserve the documented invariant: **`scores IS NULL` rows are in-flight/orphaned placeholders — every `submissions` query must filter them.**

---

## Key decisions

| Decision | Choice | Why |
|---|---|---|
| Cohort assignment | In the `handle_new_user()` signup trigger, based on `count(*) from profiles` | Atomic with user creation; no app-code race on first request |
| Quota tracking | **Derived** from `submissions` count, not a counter column | Single source of truth; no drift; mirrors the existing daily-cap query |
| Attribution timing | **Post-signup gate** at `/welcome`, not on the login form | Magic-link and Google OAuth have no signup form to extend — this is the only place that works for all three auth methods |
| Enforcement | Two layers: `proxy.ts` redirects (UX) + `/api/score` checks (security) | Never trust the client; matches existing pattern |
| Team testing | Add a `staff` cohort exempt from quotas | Otherwise team accounts burn their 2 tests and can't QA |

### Accepted risk — cohort race

Two simultaneous signups could both read `count = 99` and both land in `founding`. Worst case: a few extra founding users (101–103, not 200). Strict correctness needs an advisory lock or sequence; **accepting the loose version for MVP**, consistent with how the existing daily-cap race was accepted (documented in BUILD_STATUS 2026-07-02).

---

## Schema — new migration `0003_cohorts.sql`

```sql
alter table public.profiles
  add column if not exists cohort text not null default 'waitlist',
  add column if not exists referral_source text,
  add column if not exists referral_detail text,
  add column if not exists upgrade_interest_at timestamptz;

alter table public.profiles
  add constraint profiles_cohort_check
  check (cohort in ('founding', 'waitlist', 'staff'));

-- Backfill: everyone who already signed up (team accounts) becomes staff
update public.profiles set cohort = 'staff' where cohort = 'waitlist';
```

Then replace `handle_new_user()` to assign cohort by headcount:

```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  existing_count int;
begin
  select count(*) into existing_count from public.profiles;
  insert into public.profiles (id, email, cohort)
  values (
    new.id,
    new.email,
    case when existing_count < 100 then 'founding' else 'waitlist' end
  );
  return new;
end;
$$;
```

> **Note on the backfill:** it promotes *all current* accounts to `staff`. Run it only while the sole accounts are team members. If real users have signed up by then, change the backfill to target specific team emails instead.

---

## Files in scope

**New:**
| File | Purpose |
|---|---|
| `markready/supabase/migrations/0003_cohorts.sql` | Schema + trigger above |
| `markready/src/app/welcome/page.tsx` | Attribution gate — required before app access |
| `markready/src/app/waitlist/page.tsx` | Shown to `cohort = 'waitlist'` |
| `markready/src/app/upgrade/page.tsx` | Shown when founding user's 2 tests are spent |
| `markready/src/app/api/profile/route.ts` | POST attribution + upgrade-interest (service-role write, modelled on existing `api/target-band/route.ts`) |
| `markready/src/lib/quota.ts` | Shared `getQuotaState(userId)` — cohort, tests used, remaining |

**Modified:**
| File | Change |
|---|---|
| `markready/src/proxy.ts` | Redirect chain: no `referral_source` → `/welcome`; `waitlist` → `/waitlist`; founding & spent → `/upgrade`. Add new routes to `matcher`. |
| `markready/src/app/api/score/route.ts` | Replace the 10/day cap (lines ~242–268) with cohort + lifetime-quota enforcement; update `remaining_today` → `remaining` |
| `markready/src/app/score/page.tsx` | Show "X of 2 free tests left"; handle new 403 responses |

**Untouched:** scoring prompts, corpus/eval scripts, dashboard internals, auth callback, legal pages.

---

## Enforcement logic

`/api/score`, after the existing auth + ban checks, before the LLM call:

```
staff                                   → unlimited (existing behaviour)
cohort = 'waitlist'                     → 403 { error: 'waitlist' }
referral_source is null                 → 403 { error: 'onboarding_incomplete' }
founding && lifetime_used >= 2          → 403 { error: 'quota_exhausted' }
otherwise                               → proceed
```

`lifetime_used` reuses the existing counting pattern minus the date filter:
```
count(submissions where user_id = X and (scores is not null or created_at > now() - 5min))
```

The placeholder row must still be deleted on every rejection path — same as the current 429 branch.

---

## Attribution options (`/welcome`)

Tied to the GTM channel plan so the data is directly comparable to marketing spend:

- Facebook group
- TikTok
- YouTube
- Reddit
- Google search
- Friend or colleague
- Review centre / teacher
- Other → free-text into `referral_detail`

Stored in `profiles.referral_source` (enum-ish text) + `referral_detail` (optional free text).

---

## Out of scope (explicitly)

- Payment/checkout — no Paddle or Xendit integration; `/upgrade` records interest only
- Email notifications to waitlisted users (needs custom SMTP first — separate blocker)
- Admin UI for managing cohorts (manual SQL is fine at 100 users)
- Changing the free/paid packaging in the business plan

---

## Verification before merge

1. `npm run build` green, `tsc --noEmit` clean, existing tests pass
2. Manually exercise on the preview deployment with 3 test accounts:
   - staff → unlimited scoring
   - founding → 2 essays succeed, 3rd returns `quota_exhausted` → `/upgrade`
   - waitlist → redirected to `/waitlist`, `/api/score` returns 403
3. New account with no attribution → forced to `/welcome` before reaching `/score`
4. Confirm placeholder rows are cleaned up on each rejection path (no orphan quota burn)

---

## Open question for approval

**Does the 2-test quota count *attempts* or *successful scores*?** Plan assumes **successful scores** — a failed LLM call deletes the placeholder and doesn't burn quota. That's more user-friendly but means a user could retry indefinitely on errors. Flagging rather than assuming silently.
