# Session brief: API abuse hardening — /api/score

**Goal:** Close three cost/abuse holes in `POST /api/score` per the approved
plan in `feature-research/api-abuse-hardening/plan.md` (v2, reviewer-approved
after revisions). Read that plan in full before editing — it is the spec.

## Files in scope

- `markready/src/app/api/score/route.ts` — the ONLY file to edit.

Read-only context:
- `markready/src/types/scoring.ts` — `ScoringResult`, `TaskType`
- `markready/src/lib/supabase/service.ts` — service-role client (bypasses RLS)
- `markready/src/app/score/page.tsx` — the only client; special-cases 429 and
  401, displays `data.error` for all other non-ok responses. Do not change it.

## Constraints

- No schema changes. `submissions.scores` (jsonb) and `overall_band`
  (numeric) are already nullable.
- No new dependencies.
- Preserve existing behavior exactly except where the plan says otherwise:
  auth 401 → ban 403 → (body validation 400 now before) cap 429; image
  multimodal path; one-retry with the SAME `effectiveSystemPrompt` +
  `userContent` (critical — see BUILD_STATUS learning about the retry
  silently dropping the image); response body shapes.
- Match existing code style (no comments narrating changes; the codebase uses
  sparse comments like `// Step 1 — Auth check`).
- This project's CLAUDE.md rules apply: surgical changes only, simplicity
  first, fail loud.

## Key decisions already made (do not relitigate)

1. **Model override gate:** `NODE_ENV === "development" ||
   process.env.ALLOW_MODEL_OVERRIDE === "1"`. Production silently ignores the
   `model` param (no error response).
2. **Cap race fix — placeholder row pattern:**
   - New handler order: auth → ban → parse body → validate (incl. size
     limits) → cap count → placeholder insert → LLM → update-or-delete.
   - Cap count query adds
     `.or(\`scores.not.is.null,created_at.gte.${fiveMinAgo}\`)` so stale
     (>5 min) null-score orphans stop counting. Keep the existing
     `.eq("user_id", ...)` and `.gte("created_at", utcMidnight...)` clauses.
   - Placeholder insert: `{ user_id, task_type, question, essay, scores:
     null, overall_band: null }` with `.select("id").single()`. Insert
     failure → 500 `{ error: "Failed to save submission" }` (existing
     message).
   - On LLM error (502 path) or final parse failure (500 path): delete the
     placeholder by id first. If the delete errors, `console.error` it and
     still return the original error response — never throw, never surface it.
   - On success: `update({ scores: result, overall_band: result.overall_band
     ?? null }).eq("id", placeholderId)`. Update failure → existing fail-loud
     500 `{ error: "Failed to save submission" }`.
3. **Size limits** (module-top constants, checked in validation, 400 with a
   human-readable `{ error }` message):
   - `MAX_QUESTION_CHARS = 5_000`
   - `MAX_ESSAY_CHARS = 30_000`
   - `MAX_IMAGE_DATA_URI_CHARS = 2_000_000` — this is the LENGTH OF THE
     BASE64 DATA-URI STRING, not bytes; keep the clarifying comment from the
     plan.
   - Size checks run on the raw strings before the MIME-prefix allowlist
     check; an oversized image is a 400, not silently nulled.
4. Malformed `req.json()` stays unguarded (out of scope, separate fix).

## Verification (run these, report results)

- `npx tsc --noEmit` from `markready/` — must be clean.
- `npx eslint src` from `markready/` — no NEW findings (one pre-existing
  `prefer-const` error in `src/proxy.ts` and two pre-existing warnings in
  `src/app/score/page.tsx` are known; do not fix them, they are out of scope).
- Do NOT run the dev server or hit the live API (needs auth session + costs
  money).

Report back: what changed (summary), verification output, anything that
deviated from the plan and why.
