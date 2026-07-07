# Session brief: review-fixes-12-15

## Goal

Implement the 4 remaining approved fixes (findings 12–15) from the 2026-07-07 code review, exactly as specified in `feature-research/review-fixes-12-15/plan.md` (same directory as this file). The plan was critiqued by the reviewer agent and updated with all of its required changes — it is the approved, authoritative spec. Read it in full before touching any file.

## What MarkReady is (context you need)

An IELTS writing scorer: Next.js 16.2.9 App Router app at `markready/`, Supabase auth + `profiles`/`submissions` tables, LLM scoring via OpenRouter (openai SDK pointed at openrouter.ai). The scoring route `src/app/api/score/route.ts` was recently reworked (findings 1–11, already in the working tree, uncommitted): it now has typed body validation, a fail-closed `.maybeSingle()` ban check, insert-placeholder-then-count daily cap (reject when `count > 10`), a max-2-attempt LLM loop using `parseScoringResult` from `src/lib/parse-scoring.ts` (returns null on structural invalidity → attempt consumed; truncation via `finish_reason === "length"` throws), placeholder deletion on every terminal failure, server-side recompute of `overall_band` (mean of criterion bands, `Math.round(mean*2)/2`, clamp 1–9) and `word_count`, a `cache_control` content-part system message, and `remaining_today` in the success response. Your new tests target THIS current code — read route.ts and parse-scoring.ts fully before writing tests.

## Constraints

- Surgical: touch ONLY the 4 files in the plan's "Files touched" list. No route.ts changes, no config changes, no new deps.
- Match existing style (see `src/lib/progress.test.ts` and `src/lib/parse-scoring.test.ts` for test idiom — vitest, `// WHY:` comments).
- Do not commit to git. The working tree already has uncommitted changes from findings 1–11 — leave them untouched.
- Working directory for all commands: `C:\Users\User\Desktop\AI exam coach\markready`.
- Next.js 16.2.9 — if unsure about a Next API, check `markready/node_modules/next/dist/docs/`, don't guess. (For this task you shouldn't need Next APIs beyond importing the route handler.)

## Files in scope

1. `markready/supabase/migrations/0001_init.sql` (NEW) — fix 12: schema + RLS recorded from `feature-research/auth-db/plan.md` (copy that SQL verbatim; header comment per plan).
2. `markready/src/app/api/score/route.test.ts` (NEW) — fix 13: ~15 route tests; the plan gives the exact mock factory shapes (hoisted `mockCreate` wired into a `vi.mock("openai")` factory; `createClient` as `mockResolvedValue`; a universal argument-agnostic chainable+thenable service-client stub with `deletedIds`/update-payload recording) and the full test list with WHY lines.
3. `markready/src/lib/system-prompt.ts` — fix 14: insert the UNTRUSTED CANDIDATE TEXT guard block verbatim into all three raw prompts, between `<<CALIBRATION_EXAMPLES>>` and `## OUTPUT FORMAT`, preserving each prompt's `---` separator structure.
4. `markready/src/data/fewshot.json` — fix 15: append corpus entries `b11gt-t3-task1` (7.0) and `b11gt-t4-task1` (5.0) from `calibration-corpus.json` → `examples` to `TASK1_GENERAL`, in that order, copying fields as-is EXCEPT `question`, which gets the exact placeholder string used by the existing two TASK1_GENERAL fewshot entries. Existing entries byte-for-byte unmodified; valid JSON.

## Key decisions already made (do not relitigate)

- Migration is a record of the deployed schema, not a CLI-managed migration chain — one SQL file, no supabase config, no README.
- Route tests mock at module boundaries (`openai`, `@/lib/supabase/server`, `@/lib/supabase/service`) with request stubs `{ json: async () => body } as unknown as NextRequest`. No supertest, no test server.
- Ban-check error test: the stub RESOLVES `{ data: null, error: {...} }` (maybeSingle's real shape) — never a rejected promise.
- Test 14's structurally-invalid fixture = validScoringJson() with ONLY `weaknesses` made a non-array, so it fails exactly at the Array.isArray check.
- Model-override gating is intentionally untested (module-level env constant; poor value for the complexity).
- Guard block text is fixed in the plan — insert verbatim, identical in all three prompts.

## Success criteria (verify all before finishing)

1. `npx tsc --noEmit` → 0 errors.
2. `npx eslint` → clean.
3. `npx vitest run` → ALL tests pass: existing 27 + the new route tests.
4. `node -e "console.log(require('./src/data/fewshot.json').TASK1_GENERAL.length)"` prints 4.
5. Report honestly — anything skipped or failing must be stated explicitly.

Baseline before your changes: tsc clean, eslint clean, 27/27 tests passing.
