# Session brief: review-fixes (findings 1–11)

## Goal

Implement the 11 approved fixes from the 2026-07-07 code review of the MarkReady app, exactly as specified in `feature-research/review-fixes/plan.md` (same directory as this file). The plan was critiqued by the reviewer agent and updated with all 7 of its required changes — it is the approved, authoritative spec. Read it in full before touching any file.

## What MarkReady is (context you need)

An IELTS writing scorer: Next.js 16.2.9 App Router app at `markready/`, Supabase auth + `submissions`/`profiles` tables, LLM scoring via OpenRouter (openai SDK pointed at openrouter.ai). Flow: authenticated POST to `/api/score` → ban check → daily cap (10/day, UTC) → placeholder row insert → LLM call with a large static system prompt → JSON response parsed and stored → rendered by `ScoreReport`. Dashboard pages read submissions and compute trends in `src/lib/progress.ts`.

## Constraints

- **Next.js 16.2.9** — per `markready/AGENTS.md`, conventions may differ from your training data. `src/proxy.ts` is the middleware replacement (exports `proxy` + `config.matcher`); `params`/`searchParams` in server components are Promises. If unsure about a Next API, read `markready/node_modules/next/dist/docs/` — do not guess from memory.
- Surgical changes only: touch exactly the files the plan lists, match existing style (no semicolon/quote churn, keep existing naming and Tailwind idioms).
- Simplicity first: implement the plan as written; do not add abstractions, extra options, or speculative handling beyond it.
- Do not commit anything to git. Leave the working tree for review.
- Working directory for all npm/npx commands: `C:\Users\User\Desktop\AI exam coach\markready`.
- The repo has pre-existing uncommitted changes (`markready/.gitignore`, `markready/.env.example`) — leave them alone except for the `.env.example` addition the plan asks for (fix 11b).

## Files in scope

- `markready/src/app/api/score/route.ts` — fixes 1, 2, 3, 5, 6, 7, 11b, 11c
- `markready/src/lib/parse-scoring.ts` (NEW) + `markready/src/lib/parse-scoring.test.ts` (NEW) — fixes 2, 8
- `markready/src/types/scoring.ts` — tuples → arrays for `weaknesses` / `vocabulary_upgrades`
- `markready/src/app/score/page.tsx` — fixes 4, 11c, 11e
- `markready/src/lib/progress.ts` + `markready/src/lib/progress.test.ts` — fix 10 + test-helper cleanup
- `markready/src/app/dashboard/page.tsx` — fix 9
- `markready/src/proxy.ts` — fix 11d
- `markready/package.json` / `package-lock.json` — fix 11a (`npm uninstall @anthropic-ai/sdk`)
- `markready/.env.example` — fix 11b (add `OPENROUTER_ALLOWED_MODELS`)

## Key decisions already made (do not relitigate)

1. Manual type checks for the request body — no zod (it's only a transitive dep).
2. `parseScoringResult` returns `null` on structural invalidity (missing/typeless `criteria`, non-array `weaknesses`, missing or non-string `model_paragraph.original`/`rewrite`); minor fields are coerced. Invalid `weakest_criterion` is replaced in code with the lowest-band criterion key.
3. `overall_band` and `word_count` are recomputed server-side and overwrite the model's values (mean of criterion bands, `Math.round(mean*2)/2`, clamped 1–9; word count = `essay.trim().split(/\s+/).length`).
4. Single attempt loop (max 2 attempts) replaces the nested try/catch; API errors, truncation (`finish_reason === "length"` → throw), parse and validation failures all consume an attempt; terminal failure deletes the placeholder and returns 502 (last failure was API) or 500 (last failure was parse).
5. Cap check: insert placeholder FIRST, then count with the existing filters, reject when `count > 10` (strictly greater — placeholder is already in the count; see plan for why).
6. Ban check: `.maybeSingle()`, fail closed (500) on query error, missing profile row = not banned.
7. Prompt caching: system message content becomes a one-element array with the exact intersection cast given in the plan (`ChatCompletionContentPartText & { cache_control: { type: string } }`).
8. Dashboard segmentation: filter happens in the page (server component, `?task=` Link tabs), NOT in `progress.ts`. History list keeps showing all submissions.
9. Recurring-weakness issues: first pass filters by normalized criterion match (`toLowerCase().replace(/[^a-z]/g, "")`), falls back to collect-everything if zero matches. Tests specified in the plan, including exact data shapes.
10. `remaining_today` is spread into the API response but NOT added to `ScoringResult`; the client extracts it into separate state before `setResult(data)`.
11. Model override outside dev requires membership in `OPENROUTER_ALLOWED_MODELS` (comma-separated env); empty/unset allowlist = reject all overrides in prod. Dev behavior unchanged.

## Success criteria (verify all before finishing)

1. `npx tsc --noEmit` → 0 errors.
2. `npx eslint` → clean.
3. `npx vitest run` → ALL tests pass: existing `progress.test.ts` (updated), new `parse-scoring.test.ts`.
4. Report results honestly — if anything is skipped or failing, say so explicitly.

Baseline before your changes: tsc clean, eslint clean, 8/8 tests passing.
