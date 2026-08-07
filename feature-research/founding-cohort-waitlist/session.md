# Session — Founding cohort, waitlist gate, attribution capture

**Branch:** `feat/founding-cohort-waitlist`
**Plan:** `plan.md` (approved). **Open question resolved:** quota counts *successful scores*, not attempts.

---

## What was built

**Cohorts** (`profiles.cohort`): `founding` (first 100 signups, 2 free scored essays lifetime), `waitlist` (101+, no scoring), `staff` (team, unlimited + exempt from onboarding).

**Attribution gate:** every non-staff user must answer "how did you hear about us" at `/welcome` before reaching the scorer. Options map 1:1 to the GTM channel plan.

**Quota:** derived at request time from `submissions`, never stored as a counter.

## Files

**New**
- `markready/supabase/migrations/0003_cohorts.sql` — columns, check constraint, staff backfill, headcount-based signup trigger
- `markready/src/lib/quota.ts` — `FREE_TEST_LIMIT`, `countUsedTests`, `remainingTests`, `isCohort`
- `markready/src/app/api/profile/route.ts` — GET quota/cohort state; POST attribution or upgrade interest
- `markready/src/app/welcome/page.tsx`, `waitlist/page.tsx`, `upgrade/page.tsx`

**Modified**
- `markready/src/proxy.ts` — cohort/onboarding redirects; new routes in matcher; skips the profile lookup on API paths
- `markready/src/app/api/score/route.ts` — cohort + onboarding gates before body parse; lifetime quota replaces the 10/day cap; `remaining_today` → `remaining`; extracted `deletePlaceholder`
- `markready/src/app/score/page.tsx` — 403 code routing (`quota_exhausted`/`waitlist`/`onboarding_incomplete`), free-tests-left copy
- `markready/src/app/api/score/route.test.ts` — mocks updated for cohort; 5 new tests

## Key decisions made during implementation

1. **Quota semantics.** `count > FREE_TEST_LIMIT` (not `>=`) because the count includes the just-inserted placeholder. A failed LLM call deletes its placeholder, so failures don't burn quota. In-flight placeholders under 5 minutes still count — that's the concurrency guard against parallel requests.
2. **Proxy does not check quota.** Cohort/onboarding come from one indexed profile lookup; quota needs a `submissions` count and isn't worth paying on every page load. `/api/score` returns `quota_exhausted` and the client routes to `/upgrade`.
3. **Fail closed.** A null/unknown cohort is treated as `waitlist`. Covered by a test.
4. **Staff exempt from attribution** — team accounts are created directly in Supabase and never pass through `/welcome`.

## Verification

| Gate | Result |
|---|---|
| `tsc --noEmit` | 0 errors |
| `eslint` | clean |
| `vitest` | **55/55 pass** (50 before; 5 added) |
| `next build` | green — `/welcome`, `/waitlist`, `/upgrade`, `/api/profile` all present |

New tests encode: quota exhaustion deletes the placeholder, the boundary case (`count == limit` still scores), staff bypass, waitlist rejection *before* any OpenRouter call, null-cohort fails closed, and staff attribution exemption.

## Not done / follow-ups

- **Not deployed, not pushed.** Local branch only.
- **Migration 0003 not applied** to Supabase — must run before the branch is usable against a real DB.
- `/api/profile` GET is built but the score page doesn't call it on mount yet; the free-tests counter only appears after a score returns. Wire it up if pre-scoring display is wanted.
- Waitlist email notification needs custom SMTP (separate blocker).
- `markready/.env.local` created with **dummy** values so `next build` could run locally (the OpenAI client is constructed at module scope, so the build needs the var present). Gitignored. Replace before `npm run dev`.
