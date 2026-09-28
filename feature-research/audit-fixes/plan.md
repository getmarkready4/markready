# Plan: Repo audit fixes

**Date:** 2026-09-28
**Branch:** feat/launch-hardening
**Status:** v2 — reviewer APPROVE WITH CHANGES applied (retry_at: GREATEST, overriding
reviewer's LEAST). **Human approved 2026-09-28, limits 10/h + 20/24h confirmed.**

Source: repo audit (bugs / security gaps). No critical findings; one medium, five
low bugs, two hardening items. Prompt injection is deliberately **excluded** — see
"Out of scope".

## Fix A (medium) — Scoring attempt limit, enforced in the database

**Problem.** `/api/score` releases the reservation (no mark consumed) on unscorable,
API-failure and parse-failure outcomes. There is no rate limit, so a user can loop
deliberately-unscorable submissions: each costs up to 2 OpenRouter calls and no mark.
The per-user lease only serialises requests. The in-memory `checkRateLimit` is useless
here (per-instance, reset on cold start).

**Fix.** New migration `markready/supabase/migrations/20260928000000_scoring_attempt_limit.sql`:

1. `create table public.scoring_attempts (id bigint generated always as identity primary key, user_id uuid not null references public.profiles(id) on delete cascade, created_at timestamptz not null default now())`,
   index on `(user_id, created_at)`, `enable row level security`, **no policies**
   (service role only).
2. `create or replace function public.reserve_scoring(...)` — identical to the
   20260917 version, plus, for non-staff only, **after** the `request_active` check and
   **after** the quota check succeeds (so exhausted users are not also counted):
   - delete this user's `scoring_attempts` older than 24h (bounded retention, inside the
     existing advisory lock);
   - count attempts in the last 1h and last 24h; if `>= 10` in 1h or `>= 20` in 24h,
     return `v_usage || {code: 'rate_limited', retry_at}` — no submission row, no attempt row.
     `retry_at` = **GREATEST** over the breached windows of (oldest attempt in that
     window + window length). GREATEST, not LEAST: a retry only succeeds once *every*
     breached window has room, so the earlier time would just be rejected again
     (reviewer suggested LEAST; overridden for this reason);
   - otherwise insert a `scoring_attempts` row, then proceed to the existing insert.
   Staff are exempt, matching quota.
3. Re-issue `revoke`/`grant` for `reserve_scoring` (service_role only), and revoke all
   on `scoring_attempts` from `anon, authenticated`.

**Limits: 10/hour, 20/rolling-24h. These are the human's call.** Legitimate use is ~1
submission per ~15 min of writing; 20/day is above a heavy real user, and caps an
abusive account at ~40 model calls/day (≈$0.40 at Haiku 4.5 rates).

**Route** (`src/app/api/score/route.ts`, the `slot.code` branch at ~L276): add
`rate_limited` → **429** `{ code, error: "Too many scoring attempts. Try again later.", retry_at }`
with a `Retry-After` header (seconds until `retry_at`, min 1).

**Client** (`src/app/score/page.tsx` ~L544): add a `res.status === 429 && data.code === "rate_limited"`
branch → `setError("You’ve submitted a lot in a short time. Your draft is kept here — try again in about N minutes.")`
(N = ceil minutes to `retry_at`, fallback text if missing).

**Deploy order:** apply migration first (old route treats unknown `code` as a slot
without a string `id` → `uncertainOutcome()` 503 — safe fail-closed), then deploy.
The human applies the migration via the SQL editor; the implementer does not touch
production.

## Fix B (low) — `null` JSON body crashes `/api/profile` POST and `/api/target-band` POST

`body as Record<string, unknown>` destructuring throws on `null` → unhandled 500.
The existing try/catch only covers `req.json()` parse errors. Insert the guard
between that try/catch and the destructure — `profile/route.ts` before L130,
`target-band/route.ts` before L32 — using the same shape `/api/score` uses:
`if (!body || typeof body !== "object" || Array.isArray(body)) return 400 { error: "Invalid JSON body" }`.

## Fix C (low) — `/api/target-band` silently no-ops on a missing profile row

Plain `.update()` reports success when no row matches. Export `writeProfile` from
`src/app/api/profile/route.ts`? **No** — route files should not export helpers
(Next route export restrictions). Move `writeProfile` unchanged into
`src/lib/write-profile.ts`, import it from both routes, and use it in target-band.
Behaviour for existing rows is unchanged.

## Fix D (low) — Deleting a mark pack reclassifies its marks as free marks

`submissions.pack_id ... on delete set null`. In the same new migration:
`alter table public.submissions drop constraint submissions_pack_id_fkey, add constraint submissions_pack_id_fkey foreign key (pack_id) references public.mark_packs(id) on delete restrict;`
Revocation (`revoked_at`) remains the supported path. Implementer must confirm the
constraint name in the regression harness before relying on it.

## Fix E (low) — Criterion bands not constrained to 0.5 steps

`src/lib/parse-scoring.ts` L53: add `Number.isInteger(v.band * 2)` to the band check.
An off-grid band makes the criterion invalid → parse fails → existing retry. This is
**reject**, not round, so a malformed model output is not silently "fixed".

## Fix F (low) — Concurrent `grant_mark_pack` with same external_ref raises instead of returning duplicate

In the same migration, `create or replace` `grant_mark_pack`: replace the
select-then-insert with
`insert ... on conflict (source, external_ref) where external_ref is not null do nothing returning * into v_row;`
and if `not found`, select the existing row and return `duplicate: true`. Re-issue
revoke/grant.

## Fix G (hardening) — `'unsafe-eval'` in production CSP

`next.config.ts`: include `'unsafe-eval'` in `script-src` only when
`process.env.NODE_ENV === "development"` (React dev tooling needs it; Turnstile does
not per Cloudflare's CSP guidance). **Verification required:** `npm run build && npm run start`,
load `/`, `/login` (Turnstile), `/score`, `/dashboard` in the preview browser, and
confirm zero CSP violations in the console. If any appear, stop and report — do not
re-add it silently.

## Fix H (hardening) — service client guard

`src/lib/supabase/service.ts`: add `import "server-only";` and
`{ auth: { persistSession: false, autoRefreshToken: false } }`. Confirm `server-only`
resolves (it ships with Next); if vitest fails on it, add a `vi.mock("server-only", () => ({}))`
in the two route tests that mock service — or, if the tests mock the service module
entirely (they do), no change needed.

## Fix I (test-only, added after implementation; human-approved 2026-09-28) — stale regression harness

`scripts/quota-postgres-regression.mjs` predates 20260917 (2 free marks, lifetime) and the
`readJsonCapped` route change. Against the current schema, 3 checks fail and the route checks
crash. Update to current semantics — expectations derive from the 20260917 migration's
documented accounting rules, not from observed output:

1. L211 `post()`: pass a real `Request` (POST, JSON content-type, stringified body) instead of
   `{ json }`.
2. L88 legacy check: the legacy completed row (pack_id null) counts as 1 free mark →
   `free_used === 1`, `free_remaining === 1`; the legacy unfinished row does not count; a
   reservation is granted (release it); completing the legacy unfinished row still returns
   `reservation_expired`.
3. L110 check: two completed marks exhaust the free allowance → third reserve is
   `quota_exhausted`, `used_successful === 2`; conditional release still cannot delete a
   completed row.
4. L134 check → rename to "active work across UTC midnight blocks overlap; completed marks
   never reset". Keep the backdate + Honolulu timezone + `request_active` assertions; after
   completion expect `used_successful === 1` and `free_remaining === 1` (yesterday's mark still
   counts — no daily reset); a second mark is granted and completed; the next reserve is
   `quota_exhausted`. Drop the `reset_at` assertion (transitional field, not in app contract).

Done = the unmodified script run exits 0 with every check passing.

## Success criteria

- `npx tsc --noEmit`, `npm run lint`, `npm test` all clean; nothing skipped.
- `node scripts/quota-postgres-regression.mjs` passes. Its `call()` allow-list (L39)
  must gain `"grant_mark_pack"`. Extended with:
  - 10 granted+released reservations in an hour → 11th returns `rate_limited`, creates no submission row;
  - staff are never `rate_limited`;
  - `quota_exhausted` users do not accrue attempt rows;
  - deleting a pack referenced by a submission fails;
  - two concurrent `grant_mark_pack` calls with the same external_ref → one pack, one `duplicate: true`, no error.
- Route tests: `rate_limited` → 429 with `Retry-After`; `null` body → 400 on profile and target-band;
  target-band on missing profile row inserts it (new file
  `src/app/api/target-band/route.test.ts`, mocking like `profile/route.test.ts`).
- Parse test: a 6.3 criterion band is rejected; 6.5 accepted.
- CSP check in Fix G passes.

**Tests must encode why:** e.g. the rate-limit test asserts *released* attempts still
count, because that is the abuse path.

## Out of scope

- **Prompt injection in essays.** Audit finding withdrawn: all three system prompts
  (`src/lib/system-prompt.ts` L132/320/459) already mark the question and response as
  untrusted data. Residual model-level risk is bounded by strict output parsing and the
  server-computed overall band, and affects only the submitter's own score. No change.
- Applying the migration to production (human, via SQL editor).
- Replacing the in-memory `checkRateLimit` on profile/target-band (low-cost endpoints).
