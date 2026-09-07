# Session — One free mark per day; retire founding/waitlist; self-healing profiles

**Plan:** `plan.md` (approved 2026-09-07 by Nam, with the three staff accounts confirmed).
**Shipped to:** `main` directly, per Nam's instruction.

---

## What was built

- **Access model:** every non-staff user gets 1 free scored essay per UTC day; staff unlimited. Founding cohort and waitlist are gone.
- **Self-healing profiles:** `/api/profile` updates first and, if no row matched, inserts one — a profile cleared in the Table Editor can no longer strand an account on `/welcome`.
- **No stale-component loop:** `/welcome` navigates with `window.location.assign` after saving, so a proxy redirect always produces a fresh page load.
- **Attribution gate kept** — it is GTM data and was never the bug.

## Root cause of the reported hang (confirmed from edge logs)

`PATCH /rest/v1/profiles?id=eq.<user>` → 204 with zero rows (profile deleted for testing) → proxy `GET profiles` → empty → redirect `/welcome` → `router.push` soft-navigated onto the same component with `saving` still true. Three identical cycles at 15:39–15:42 UTC. The trigger was never at fault; Google sign-in had linked to the existing user, which is why "no new account" appeared.

## Files

| File | Change |
|---|---|
| `markready/supabase/migrations/0004_daily_free_mark.sql` | new — cohorts → `user`/`staff`, non-counting trigger, orphan repair, staff list |
| `markready/src/lib/quota.ts` | `Cohort = 'user' \| 'staff'`, `DAILY_FREE_LIMIT = 1`, `countUsedToday` (UTC window + 5-min placeholder guard), `remainingToday` |
| `markready/src/app/api/profile/route.ts` | `writeProfile` (update → insert if missing) for both POST branches; GET reports today's quota + reset |
| `markready/src/app/api/score/route.ts` | waitlist 403 removed; daily quota; `reset: "midnight UTC"` in the 403 |
| `markready/src/proxy.ts` | waitlist redirects + matcher entry removed; missing profile = not-yet-onboarded |
| `markready/src/app/welcome/page.tsx` | hard navigation after save |
| `markready/src/app/upgrade/page.tsx` | daily copy |
| `markready/src/app/score/page.tsx` | daily copy; waitlist branch removed |
| `markready/src/app/waitlist/page.tsx` | **deleted** |
| `markready/src/app/api/score/route.test.ts` | waitlist test removed; quota tests → limit 1; null cohort = limited-not-locked-out |

## Deploy order (deliberate)

Code first, then migration. The new code tolerates the old cohort values (`founding`/`waitlist` → treated as `user`); the old code would treat `user` as waitlist. Running the migration before the deploy would have gated real users for the ~90s build window.

## Verification

| Gate | Result |
|---|---|
| `next build` | green; route table has `/welcome`, `/upgrade`, `/api/profile`, no `/waitlist` |
| `tsc --noEmit` | 0 errors (after clearing stale generated route types from the deleted page) |
| `eslint` | clean |
| `vitest` | 54/54 (55 − 1 deleted waitlist test) |

Live checks after deploy + migration are recorded in the chat transcript: DB cohort distribution, zero orphaned auth users, route health, and Nam's own `/welcome` → `/score` flow.

## Not done / follow-ups

- No unit test for `writeProfile`'s insert path (route tests mock the service client at the chain level; adding one is a small follow-up).
- `CHANGELOG.md` not updated.
- `DemoScoreClient.tsx` still carries a stale "DELETE THIS FILE" comment (out of scope, flagged earlier).
