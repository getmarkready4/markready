# Plan: Fix code-review findings 1–11

Scope approved by Albert ("fix 1-11 first"). Findings come from a full-codebase review on 2026-07-07. All work is inside `markready/`. Baseline state: `tsc --noEmit`, `eslint`, and `vitest run` (8/8) all pass.

## Context

MarkReady is a Next.js 16.2.9 (App Router, `src/proxy.ts` instead of middleware) + Supabase + OpenRouter app that scores IELTS writing. The scoring API is `src/app/api/score/route.ts`; prompts in `src/lib/system-prompt.ts`; dashboard analytics in `src/lib/progress.ts` (tested in `progress.test.ts`).

NOTE (from `markready/AGENTS.md`): this Next.js version may differ from training data — consult `node_modules/next/dist/docs/` if unsure about an API.

---

## Fix 1 — Validate request body (route.ts)

- Wrap `await req.json()` in try/catch → on throw, return 400 `{ error: "Invalid JSON body" }`.
- After parsing, before any use:
  - `question` and `essay` must be strings (`typeof x === "string"`) → else 400.
  - `taskType`: default `"TASK2"` when `undefined`; must be one of the three TaskType values (existing check, keep).
  - `model`: if present, must be a string → else 400.
  - `image`: if present and not null, must be a string → else 400.
- Keep existing trim/length checks unchanged.

## Fix 2 + 8 — Validate & robustly extract the model response

New file `src/lib/parse-scoring.ts` (pure, testable) exporting:

- `extractJson(raw: string): string` — current `stripFences` behavior, plus fallback: if the fence-stripped string doesn't parse, take the substring from the first `{` to the last `}` and return that. (Move `stripFences` here; delete it from route.ts.)
- `parseScoringResult(raw: string): ScoringResult | null` — parse via `extractJson`; return `null` if JSON.parse fails or the shape is structurally invalid. Rules:
  - `criteria` must be an object with ≥1 entry whose `band` is a finite number; drop entries with non-numeric band; clamp bands to [1, 9]. Coerce missing `strengths_noted`/`rationale` to `""`.
  - `weaknesses` must be an array → else invalid. Keep only entries where `issue`, `quoted_example`, `explanation`, `fix`, `criterion` are strings (coerce missing optional-ish fields to `""` but `issue` must be a non-empty string).
  - `vocabulary_upgrades`: if not an array, coerce to `[]`; keep only entries with string `original`/`upgrade`/`why`.
  - `model_paragraph` must be an object with string `original` and `rewrite` → else invalid (UI renders it unconditionally). If `original` or `rewrite` is present but NOT a string, return null — do not coerce. Coerce `changes_explained` to `""`, `target_band` to 8, `criterion_improved` to `""` if missing.
  - `examiner_summary`: coerce to `""` if not a string.
  - `weakest_criterion`: if not one of the five `CriterionKey` values, replace with the key of the lowest-band criterion present (deterministic fallback — code answers, not the model).
  - `exam`, `overview_present`, `data_accuracy_note`: pass through if present with the right primitive type, drop otherwise.

Type change in `src/types/scoring.ts`: `weaknesses` becomes `Weakness[]` and `vocabulary_upgrades` becomes `VocabUpgrade[]` (the tuple types lie — the model may return other lengths and the UI just maps). Update the test helper in `progress.test.ts` accordingly (the `as unknown as [Weakness, ...]` cast becomes unnecessary).

Unit tests in `src/lib/parse-scoring.test.ts`:
- fenced JSON parses (WHY: models wrap output in ```json fences despite instructions);
- preamble text + JSON parses via first-`{`/last-`}` fallback (WHY: models sometimes emit "Here is the JSON…");
- structurally invalid payloads (criteria missing / weaknesses not an array / model_paragraph missing) return null (WHY: a bad payload must trigger the retry path, never reach the DB — a stored bad payload crashes the dashboard detail page forever);
- invalid `weakest_criterion` is replaced by the lowest-band criterion key (WHY: dashboard grouping depends on it being a valid key).

## Fix 3 — Compute word_count and overall_band in code (route.ts)

After a valid parse, overwrite:
- `result.word_count = essay.trim().split(/\s+/).length` (essay already validated non-empty).
- `result.overall_band = clamp(Math.round(mean * 2) / 2, 1, 9)` where `mean` is the average of the criterion `band` values present in `result.criteria`.

Rationale: deterministic transforms belong in code (project rule 5); LLM arithmetic/word-counting is unreliable.

## Fix 5 — temperature 0 + truncation detection (route.ts)

- Add `temperature: 0` to the completion call.
- `callModel` returns the message content but throws `new Error("truncated")` when `completion.choices[0]?.finish_reason === "length"`.
- Restructure the call/parse/retry logic into a single attempt loop (max 2 attempts):

```
let result: ScoringResult | null = null;
let lastFailure: "api" | "parse" = "api";
for (let attempt = 0; attempt < 2 && !result; attempt++) {
  let raw: string;
  try { raw = await callModel(...); }
  catch (err) { console.error(...); lastFailure = "api"; continue; }
  result = parseScoringResult(raw);
  if (!result) { console.error("parse/validation failed", raw); lastFailure = "parse"; }
}
if (!result) { delete placeholder; return lastFailure === "api" ? 502 "Scoring service unavailable..." : 500 "Failed to parse scoring response..."; }
```

This replaces the current nested try/catch. Behavior change (intentional): a transient API/network error now gets one retry too, instead of failing immediately.

## Fix 6 — Fail-closed ban check + cap race (route.ts)

- Ban check: switch `.single()` → `.maybeSingle()` and capture `error`. On `error` → 500 `{ error: "Unable to verify account status" }` (fail closed on real DB failures). `data === null` (no profile row) → not banned, proceed.
- Cap race: change check-then-insert to insert-then-check. New order: auth → ban → body validation → insert placeholder → count (same filters as today: user_id, `created_at >= utcMidnight`, `.or("scores.not.is.null,created_at.gte.<fiveMinAgo>")`) → if `count > 10`, delete the placeholder and return 429. The fresh placeholder is < 5 min old so it is included in the count; limit semantics are unchanged (10/day). Concurrent requests can no longer both slip under the cap; in a rare race both may 429 at exactly the boundary, which under-serves by at most one attempt and never over-serves.
- IMPORTANT: use `> 10`, NOT the current code's `>= 10` — this is intentional, not a copy error. The placeholder is already included in the count, so count = 10 means the user just used their last allowed slot (proceed); count = 11 means they were already at the limit (reject + delete placeholder).

## Fix 7 — Prompt caching (route.ts)

Send the system message as a content-part array with an Anthropic `cache_control` breakpoint, which OpenRouter forwards:

```ts
messages: [
  {
    role: "system",
    content: [
      { type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as ChatCompletionContentPartText,
    ],
  },
  { role: "user", content: userContent },
]
```

The openai SDK types don't know `cache_control` (verified: `ChatCompletionContentPartText` has only `type` and `text`), so a bare `as ChatCompletionContentPartText` cast will NOT compile. Use exactly this intersection cast on the single part, importing `ChatCompletionContentPartText` from `"openai/resources/chat/completions"` (same module the file already imports `ChatCompletionContentPart` from):

```ts
{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } } as ChatCompletionContentPartText & { cache_control: { type: string } }
```

The system-message `content` accepts `Array<ChatCompletionContentPartText>`, so the array itself needs no cast. The Task 2 system prompt is ~43k chars of static text, well over Anthropic's 1024-token cache minimum; caching is prefix-based and shared across users, so this cuts input cost on nearly every request.

## Fix 9 — Dashboard: segment analytics by task type

`src/app/dashboard/page.tsx` (server component):
- Accept `searchParams: Promise<{ task?: string }>` (Next 16: searchParams is a Promise). `await searchParams` at the TOP of the function, before the submissions fetch and before the existing `submissions.length === 0` early-return branch (the empty branch doesn't use it, but keep the single await at the top).
- Compute the set of task types present in the user's submissions.
- Selected type: `task` param if it's a valid `TaskType` present in the data; otherwise the task type of the most recent submission.
- Feed **only the selected type's submissions** to `computeBandTrend`, `computeRecurringWeaknesses`, `computeSummary` (summary cards, trend chart, recurring weaknesses). The Evaluation History list keeps showing ALL submissions (each row already shows its task label).
- When >1 task type is present, render a tab bar of `<Link href={"/dashboard?task=" + t}>` styled like the existing pill buttons, labeled via `TASK_LABELS`. When only one type exists, render no tabs (page looks like today).
- Add a short caption near the summary cards indicating which task the stats cover (e.g. the selected TASK_LABEL), so the numbers aren't mistaken for all-time stats.

No changes to `progress.ts` functions for this fix — filtering happens in the page.

## Fix 10 — Recurring weaknesses: only show issues from that criterion

In `computeRecurringWeaknesses` (`src/lib/progress.ts`):
- Add `const normalizeCriterion = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "")` (module-private). This maps `"Task Response"`, `"task_response"` → `"taskresponse"`, `"Coherence & Cohesion"`, `"coherence_cohesion"` → `"coherencecohesion"`, etc. — the model emits free-form criterion names.
- When collecting `recentIssues` for a group, first pass: only weaknesses where `normalizeCriterion(weakness.criterion) === normalizeCriterion(groupCriterion)`. If that yields zero issues after scanning all rows, fall back to the current collect-everything behavior so the card is never empty.
- Update tests:
  - Rewrite test 5b: rows now carry weaknesses tagged with different criteria; assert only the matching-criterion issues appear (WHY: a "Lexical Resource" card showing grammar issues misleads the student about what to practice).
  - Add a test that label-form criterion strings ("Task Response") match key-form group names (WHY: the model emits human labels, the grouping uses snake_case keys).
  - Add a fallback test with this exact shape: 2 submissions, both with `weakest_criterion = "lexical_resource"`, each carrying 3 weaknesses ALL tagged `criterion = "task_response"` (so the first-pass criterion match yields zero); assert `recentIssues.length === 3` and that they come from the newest row first (WHY: an empty card is worse than loosely-related issues — the fallback path must actually trigger, not pass vacuously).

## Fix 11 — Smaller items

a. **Remove unused dependency**: `npm uninstall @anthropic-ai/sdk` in `markready/` (updates package.json + lockfile). Verify no imports reference it first (there are none).

b. **Model-override allowlist** (route.ts): keep `MODEL_OVERRIDE_ALLOWED` semantics, but outside `NODE_ENV === "development"` the override must also appear in `OPENROUTER_ALLOWED_MODELS` (comma-separated env, trimmed entries). If the flag is on but the allowlist is unset/empty, reject all overrides (fall back to `MODEL`) — never "any string goes" in prod. Dev keeps accepting any string. Update `.env.example` with the new var and a one-line comment.

c. **Remaining-count feedback**: the success response becomes `NextResponse.json({ ...result, remaining_today })` where `remaining_today = Math.max(0, 10 - (count ?? 0))` from the post-insert count (count includes this submission). In `src/app/score/page.tsx`, add a `remainingToday: number | null` state var and extract the field BEFORE the typed `setResult(data)` call (after that point the extra field is inaccessible through `ScoringResult`):
```ts
const remainingToday = typeof data.remaining_today === "number" ? data.remaining_today : null;
setRemainingToday(remainingToday);
setResult(data);
```
When a result is shown and `remainingToday !== null && remainingToday <= 3`, render a small muted line under the "Score another essay" button: `"{n} evaluation{s} left today — resets at midnight UTC."` Do NOT add `remaining_today` to `ScoringResult` (it isn't part of the stored scoring payload).

d. **/login redirect when already signed in** (`src/proxy.ts`):
   - Add `"/login"` to the matcher.
   - In the maintenance-mode block, EXEMPT `/login` from the redirect (`if pathname startsWith "/login" → NextResponse.next()`), otherwise maintenance mode now creates a redirect loop (login → login).
   - After `getUser()`: if `user` and pathname starts with `/login` → redirect to `/score`.
   - Unauthenticated users on `/login` fall through the existing not-logged-in block (it only matches /api/score, /score, /dashboard) to `return supabaseResponse` — correct as-is, do NOT add an extra guard.

e. **Select ellipsis** (`src/app/score/page.tsx`): only append `…` when truncating: `q.text.length > 85 ? q.text.slice(0, 85) + "…" : q.text`.

---

## Files touched

- `src/app/api/score/route.ts` — fixes 1, 2, 3, 5, 6, 7, 11b, 11c
- `src/lib/parse-scoring.ts` (new) + `src/lib/parse-scoring.test.ts` (new) — fixes 2, 8
- `src/types/scoring.ts` — tuple → array types
- `src/app/score/page.tsx` — fixes 4 (canvas white fill), 11c, 11e
- `src/lib/progress.ts` + `src/lib/progress.test.ts` — fix 10 (+ test-helper cleanup from type change)
- `src/app/dashboard/page.tsx` — fix 9
- `src/proxy.ts` — fix 11d
- `package.json` / `package-lock.json` — fix 11a
- `.env.example` — fix 11b

## Fix 4 — reminder of the exact change

In `downscaleImage` (`src/app/score/page.tsx`), before `drawImage`:
```ts
const ctx = canvas.getContext("2d")!;
ctx.fillStyle = "#ffffff";
ctx.fillRect(0, 0, w, h);
ctx.drawImage(img, 0, 0, w, h);
```
(WHY: `toDataURL("image/jpeg")` renders transparent PNG backgrounds as black, making chart images unreadable to the model.)

## Success criteria

1. `npx tsc --noEmit` → 0 errors.
2. `npx eslint` → clean.
3. `npx vitest run` → all tests pass, including new `parse-scoring.test.ts` and updated `progress.test.ts`.
4. No behavior regressions in untouched flows (auth callback, login form, ScoreReport rendering with a valid result).
5. Manual-review checkpoints for the diff reviewer: the retry loop deletes the placeholder on every terminal failure path; maintenance mode cannot loop on /login; the cap count runs AFTER the placeholder insert and uses `> 10`; `cache_control` cast is narrow (single content part).

## Out of scope (explicitly)

Findings 12–15 (DB schema in repo, API-route tests beyond the new pure-function tests, prompt-injection guard line, more TASK1_GENERAL fewshot examples), committing the pending `.gitignore`/`.env.example` changes, and any UI restyling.
