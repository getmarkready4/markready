# Session brief: audit-fixes (implementer context)

**Your full spec is `feature-research/audit-fixes/plan.md` (approved v2). Implement exactly
that — Fixes A–H — nothing more.** This brief adds context the plan assumes.

## Goal
Close the audit findings: a DB-enforced scoring attempt limit (the only medium item),
five low bugs, two hardening items.

## Constraints
- App lives in `markready/` (Next.js — this version differs from your training data; read
  `markready/node_modules/next/dist/docs/` before relying on Next behaviour).
- **Never spend money.** No OpenRouter/model calls, no paid APIs. Do not set
  `OPENROUTER_API_KEY` for anything. Tests mock the model.
- **Never touch production.** Do not connect to Supabase. The migration is applied later
  by the human in the SQL editor. Use only the local harness
  `node scripts/quota-postgres-regression.mjs` (run from `markready/`; it starts a
  throwaway loopback Postgres).
- Surgical changes, match existing style (terse comments, same guard shapes as
  `/api/score`). No refactors beyond what the plan names.
- Do not commit. The orchestrator handles git after diff review.

## Key decisions (settled — do not revisit)
- Limits: **10 per rolling hour, 20 per rolling 24h**, non-staff only. Counted only for
  reservations that pass the `request_active` and quota checks; released attempts still
  count (that is the abuse path).
- `retry_at` = **GREATEST** across breached windows of (oldest attempt in window + window
  length).
- Rate-limited path creates no submission row and no attempt row.
- Band parse: **reject** off-grid bands (`Number.isInteger(band * 2)`), never round.
- `writeProfile` moves unchanged to `src/lib/write-profile.ts`; route files export only
  handlers.
- `unsafe-eval` only when `NODE_ENV === "development"`.
- Prompt injection: no change (already defended).

## Files in scope
- NEW `markready/supabase/migrations/20260928000000_scoring_attempt_limit.sql`
  (Fixes A, D, F). Base `reserve_scoring` and `grant_mark_pack` on the **20260917**
  versions verbatim, then add the changes. Confirm the FK name with
  `select conname from pg_constraint where conrelid='public.submissions'::regclass and conname like '%pack%'`
  in the harness (expected `submissions_pack_id_fkey`).
- `markready/src/app/api/score/route.ts` (A: `rate_limited` → 429 + `Retry-After`)
- `markready/src/app/score/page.tsx` (A: 429 message branch near L544)
- `markready/src/app/api/profile/route.ts` (B guard before L130; C import writeProfile)
- `markready/src/app/api/target-band/route.ts` (B guard before L32; C use writeProfile)
- NEW `markready/src/lib/write-profile.ts` (C)
- `markready/src/lib/parse-scoring.ts` L53 (E)
- `markready/next.config.ts` (G)
- `markready/src/lib/supabase/service.ts` (H)
- Tests: `src/app/api/score/route.test.ts`, `src/app/api/profile/route.test.ts`,
  NEW `src/app/api/target-band/route.test.ts`, `src/lib/parse-scoring.test.ts`,
  `scripts/quota-postgres-regression.mjs` (add `"grant_mark_pack"` to the `call()`
  allow-list at L39; add the cases listed in the plan's success criteria).

## Done means
`npx tsc --noEmit`, `npm run lint`, `npm test`, and the regression script all pass with
nothing skipped. Report each command's result verbatim-summarised. **Fix G's CSP check
needs a browser — do NOT start servers; report it as pending for the orchestrator.**
If anything in the plan turns out wrong against the code, stop and report rather than
improvising.
