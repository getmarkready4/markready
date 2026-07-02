# Plan: API abuse hardening — /api/score

**Date:** 2026-07-02
**Scope:** `markready/src/app/api/score/route.ts` only. No schema changes, no UI changes.
**Status:** Revised after reviewer critique (v2) — addresses all 5 required changes.

## Problem

Three cost/abuse holes found in code review of `POST /api/score`:

1. **Model override exposed in production.** The `model` body param (added for the
   bake-off scripts) is honored for any authenticated user. Anyone can POST
   `{"model": "openai/o1-pro"}` and run arbitrary expensive models on the
   OpenRouter key.

2. **Daily cap is racy (check-then-act).** The `count < 10` check and the
   submission insert are separated by the ~22s LLM call. N concurrent requests
   from one user all pass the check, so the 10/day cap is not actually enforced
   against a deliberate attacker. Combined with (1) this is unbounded spend.

3. **No server-side payload size limits.** The client downscales images to
   ~1024px JPEG, but the API accepts any base64 payload posted directly. A 20MB
   image or 100k-word essay inflates OpenRouter token cost per request.

## Fixes

### Fix 1 — Gate the model override

```ts
const MODEL_OVERRIDE_ALLOWED =
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_MODEL_OVERRIDE === "1";
...
const activeModel = MODEL_OVERRIDE_ALLOWED && model ? model : MODEL;
```

- Dev servers (`npm run dev`) keep zero-config bake-off/eval compatibility.
- Production ignores the param silently (no error — the param simply has no
  effect, so probing reveals nothing).
- `ALLOW_MODEL_OVERRIDE=1` escape hatch for a production measurement session.
- **Deployment assumption (explicit):** `NODE_ENV` is `"production"` on Vercel
  (baked in at build time) and must be set to `"production"` in any future
  deployment environment (e.g. containers) — an *unset* `NODE_ENV` fails safe
  here (`undefined !== "development"` → override stays off), but the assumption
  is still documented so nobody runs production with `NODE_ENV=development`.

### Fix 2 — Close the cap race with a placeholder insert

Schema already supports it: `submissions.scores` (jsonb) and `overall_band`
(numeric) are nullable (see `feature-research/auth-db/plan.md`).

New request flow:

1. Auth check (unchanged)
2. Ban check (unchanged)
3. **Parse + validate body** (moved before the cap check — includes new size
   limits from Fix 3, so invalid requests never touch the cap).
   **Deliberate status-order change:** an over-cap client sending an invalid or
   oversized payload now gets 400, not 429. The only client (`page.tsx`)
   special-cases 429/401 and falls through to `data.error` display for
   everything else, so nothing breaks; the change also reveals less about
   rate-limit state to probing. This is intentional, not a side effect.
4. **Cap count — modified query.** Counts today's rows EXCEPT stale
   placeholders: completed rows (`scores` not null) always count; null-score
   rows count only if created within the last 5 minutes (in-flight window; max
   legitimate request is call + one retry ≈ 45s, and Vercel's function timeout
   is ≤60s). supabase-js:

   ```ts
   const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
   const { count } = await serviceClient
     .from("submissions")
     .select("*", { count: "exact", head: true })
     .eq("user_id", user.id)
     .gte("created_at", utcMidnight.toISOString())
     .or(`scores.not.is.null,created_at.gte.${fiveMinAgo}`);
   ```

   This means a crashed/timed-out function's orphan row stops burning the
   user's cap after 5 minutes — no cleanup job needed, no slot lost until
   UTC midnight.
5. **Insert placeholder row immediately** (`scores: null`,
   `overall_band: null`) via `.select("id").single()` to get the row id.
   Insert failure → 500 with the existing body
   `{ error: "Failed to save submission" }` (same message as the current
   insert-failure path — do not invent a new one). Plain insert, no upsert —
   there are no unique constraints on `submissions`.
6. LLM call + parse (+ existing one-retry)
   - On LLM 502 or final parse failure → **delete the placeholder row**, then
     return the existing error response. Failures don't burn the user's cap
     (matches current behavior where failed evals aren't saved).
   - **The delete itself must be guarded:** if the delete errors, log it
     (`console.error`) and still return the original 502/500 to the caller —
     never surface a delete error to the user, never throw. The orphan row
     ages out of the cap count via the 5-minute rule above.
7. On success → **update** the placeholder row with `scores` and
   `overall_band` (match on `id`). Update failure → existing fail-loud 500
   (row remains with null scores; it ages out of the cap count after 5 min).

Race window shrinks from ~22s to the milliseconds between the count query and
the insert. Residual overshoot of a couple of evals under deliberate concurrent
fire is accepted for the MVP; a fully atomic cap needs a Postgres function
(`insert ... where count < 10` in one statement) and is out of scope. Noted as
a known limitation.

**Mandatory downstream post-condition:** rows with `scores IS NULL` are
in-flight or orphaned placeholders. Any future dashboard/history/analytics
query against `submissions` MUST filter `scores is not null`. Record this in
BUILD_STATUS.md when the changelog is updated.

### Fix 3 — Server-side size limits

Constants at module top, checked during body validation (step 3 above):

```ts
const MAX_QUESTION_CHARS = 5_000;  // string length; real prompts are < 500 chars
const MAX_ESSAY_CHARS = 30_000;    // string length; real essays < 3,500 chars (~500 words)
// Length of the base64 *data-URI string* (NOT bytes, NOT file.size).
// Client-downscaled 1024px JPEGs are < ~300k chars; a raw 10MB upload
// base64-encodes to ~13.3M chars and is rejected.
const MAX_IMAGE_DATA_URI_CHARS = 2_000_000;
```

- Over-limit question/essay → 400 `{ error: "..." }` with a human-readable
  message (UI already displays `data.error` for non-ok responses).
- Over-limit image → 400 as well (not 413 — keeps the single client error path).
- Limits are 6–10× above any legitimate payload, so zero false-positive risk.

## Success criteria

- `npx tsc --noEmit` clean; `npx eslint src` no new findings.
- `model` param: honored in dev, ignored when `NODE_ENV === "production"`
  without `ALLOW_MODEL_OVERRIDE=1`.
- A submission row exists (scores null) during the LLM call; row is updated in
  place on success; row is deleted on LLM/parse failure (delete errors logged,
  never surfaced).
- Cap count excludes null-score rows older than 5 minutes.
- Requests over the size limits return 400 before any DB write or LLM call.
- Existing behavior preserved: 401/403/429 order and payloads, image
  multimodal path, retry uses same `effectiveSystemPrompt` + `userContent`,
  response body shape unchanged.

## Out of scope (noted for later)

- try/catch around `req.json()` malformed-body crash (finding 6) — separate
  fix. Note: this plan moves `req.json()` earlier in the handler (before the
  cap check), so a malformed body now crashes before any DB work — same
  unhandled-500 signature as today, just earlier. Behavior unchanged in kind.
- Zod validation of the LLM response shape (finding 5).
- Atomic Postgres-side cap enforcement.
- BUILD_STATUS.md changelog update happens after diff review (orchestrator).
