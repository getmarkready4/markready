# Plan: Progress Dashboard — history, band trends, weakness tracking

## Goal
Turn the one-shot grader into a coach. Authenticated users get a `/dashboard` showing their submission
history, band trends over time, and recurring weaknesses. All data already persists in the `submissions`
table (created in the auth-db feature) — this is almost entirely a read/render feature, no new scoring.

## Success criteria
- [ ] Authenticated user at `/dashboard` sees their submissions, most recent first
- [ ] Overall band trend over time is visualised; per-criterion trends viewable
- [ ] A "recurring weaknesses" summary shows which criterion is consistently weakest + frequent weakness notes
- [ ] User can open any past submission and see its full original report
- [ ] Sensible empty state for users with zero submissions
- [ ] All reads are RLS-scoped to the signed-in user — no cross-user data access
- [ ] `/score` results rendering is unchanged (verified by extracting, not rewriting)

---

## No schema change needed
`submissions` already stores: `id`, `user_id`, `task_type`, `question`, `essay`, `scores` (jsonb = full
`ScoringResult`), `overall_band`, `created_at`. Index `submissions_user_date_idx (user_id, created_at)` exists.
Per-criterion bands live inside `scores.criteria` — fetch rows and extract in JS (per-user volume is tiny;
no jsonb SQL needed).

---

## Key decisions (flagged for approval — reviewer/human should confirm)

1. **Charting: hand-rolled SVG, no dependency.** A band trend is a simple line over time (y-axis 0–9).
   Rationale: avoids React 19 / Next 16 charting-lib compat risk, keeps the bundle small, matches the
   project's dependency-light style (Rule 2). *Alternative:* add `recharts` for richer interactivity — more
   capable but a new dependency and compat risk on Next 16.

2. **Weakness aggregation is deterministic code, not an LLM pass (Rule 5).** We already store per-criterion
   bands and a `weaknesses[]` array per submission. Compute recurring weaknesses by: (a) counting how often
   each criterion is the lowest-scoring / below a threshold, and (b) surfacing the most recent verbatim
   `weakness.issue` strings for the weakest criterion. **No** NLP clustering of free-text — that adds cost,
   latency, and nondeterminism for no clear gain at this scale.
   **Grouping key:** do NOT group on `weakness.criterion` — it is typed as plain `string` and the LLM may
   emit free-text there (e.g. "Coherence and Cohesion"), which would silently fragment the aggregation.
   Instead use `scores.weakest_criterion` (which IS a `CriterionKey`) to identify each submission's weakest
   criterion, and group that submission's `weaknesses[].issue` strings under it.

3. **Dashboard data fetch is a Server Component using the user-scoped server client** (`@/lib/supabase/server`,
   anon key + session cookie) so **RLS applies**. Do NOT use the service-role client here — that would bypass
   RLS and risk cross-user leakage. Charts are client components receiving already-fetched data as props.

4. **Past-submission detail re-renders the stored `scores` jsonb** — no re-scoring. Free, instant, and
   preserves the exact original result the user saw.

---

## Files to create

### `src/lib/progress.ts` (pure functions, unit-testable)

**`SubmissionRow` is defined HERE and only here** — this is the canonical location. Pages and components
import it from `@/lib/progress`. Do not re-declare it in `src/types/scoring.ts` or anywhere else.

```ts
import type { ScoringResult, TaskType, CriterionKey } from "@/types/scoring";

export interface SubmissionRow {
  id: string;
  task_type: TaskType;
  question: string | null;
  essay: string | null;
  scores: ScoringResult;
  overall_band: number | null;
  created_at: string;
}

// Overall + per-criterion band series, oldest→newest, for charting.
// `scores.criteria` is Partial<Record<CriterionKey, CriterionScore>> — Task 2 rows
// have no task_achievement, Task 1 rows no task_response. Iterate ONLY the keys
// actually present on each row; when a criterion is absent for a row, OMIT it from
// that row's `criteria` map (never emit undefined/NaN values).
export function computeBandTrend(subs: SubmissionRow[]): {
  date: string;
  overall: number | null;
  criteria: Partial<Record<CriterionKey, number>>; // only keys present on that row
}[];

// Which criterion is weakest most often, + representative recent issues.
// Identify each submission's weakest criterion via `scores.weakest_criterion`
// (a CriterionKey) — NOT by parsing weakness.criterion free-text. Group each
// submission's weaknesses[].issue strings under that key. Skip rows where
// weakest_criterion is missing/invalid (runtime-guard against the known
// CriterionKey values) rather than throwing.
export function computeRecurringWeaknesses(subs: SubmissionRow[]): {
  criterion: CriterionKey;    // e.g. "coherence_cohesion"
  timesWeakest: number;       // count of submissions where this was the weakest
  avgBand: number;            // mean band of this criterion across rows where present
  recentIssues: string[];     // up to 3 verbatim weakness.issue strings, newest first
}[];

// Small summary for the header cards.
export function computeSummary(subs: SubmissionRow[]): {
  total: number;
  latestOverall: number | null;
  bestOverall: number | null;
  deltaFromFirst: number | null; // latest - first, for a trend arrow
};
```
Keep these pure (no I/O) so they can be tested against fixture arrays. Handle `null`/missing bands and the
zero-submission case without throwing.

### `src/components/ScoreReport.tsx`
Extract the existing results-rendering JSX from `src/app/score/page.tsx` into a reusable presentational
component. **The results JSX reads `taskType` component state** (the overall-band hero renders
`TASK_LABELS[taskType]`), so a `{ result }` prop alone is insufficient. Signature:

```ts
function ScoreReport({ result, taskType }: { result: ScoringResult; taskType: TaskType })
```

- `/score` passes its existing `taskType` state.
- The dashboard detail page passes the row's `task_type` column (it is a `TaskType`).
- Do NOT try to derive the label from `result.exam` — that is a plain string like "IELTS", not a `TaskType`.

**Behavior-preserving extraction** — move the markup verbatim, wire the two props; no visual or structural
change to `/score`. Used by both the live score page and the dashboard detail page so reports render
identically.

### `src/components/BandTrendChart.tsx` (client component)
Hand-rolled inline SVG line chart. Props: the series from `computeBandTrend`. Renders overall band over time
with a toggle (or small multiples) for the four criteria. Fixed y-axis 0–9. Accessible: include a text
fallback / `<title>`. Handle 1-point series (dot, no line) and empty series.

### `src/app/dashboard/page.tsx` (Server Component)
- **The server client factory is async** — it must be `const supabase = await createClient();`
  (from `@/lib/supabase/server`). Calling `createClient()` without `await` yields a Promise and
  `.auth.getUser()` fails silently.
- Get user via `supabase.auth.getUser()` (proxy already gated the route; verify here too — redirect to
  `/login` if no user)
- Query submissions (RLS-scoped): `select id, task_type, question, essay, scores, overall_band, created_at
  from submissions order by created_at desc`
- Compute summary / trend / weaknesses via `@/lib/progress`
- Render: header (email + sign out + "New evaluation" → `/score`), summary cards, `<BandTrendChart/>`,
  recurring-weaknesses section, and a history list (date · task type · overall band · link to
  `/dashboard/[id]`)
- Empty state when no submissions: friendly prompt linking to `/score`

### `src/app/dashboard/[id]/page.tsx` (Server Component)
- **Next.js 16: `params` is a Promise.** The page must await it:
  ```ts
  export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    ...
  }
  ```
  Writing `params.id` synchronously (the Next 14/15 habit) is a runtime error.
- `const supabase = await createClient();` (async factory, same note as above); get user
- Fetch the single submission by id with the **user-scoped client** (RLS ensures only the owner can read —
  a non-owner id returns no row)
- **If the query returns no row, call `notFound()` from `next/navigation`** — do not render a blank page or
  dereference null
- Render `<ScoreReport result={submission.scores} taskType={submission.task_type} />` plus the original
  question/essay and date
- Back link to `/dashboard`

---

## Files to modify

### `src/app/score/page.tsx`
- Replace the inline results JSX with `<ScoreReport result={result} />` (import the new component)
- Add a nav link/button to `/dashboard` (e.g. "My progress") in the header, near the sign-out button

### `src/proxy.ts`
- Add `"/dashboard"` and `"/dashboard/:path*"` to the `config.matcher` array
- In the unauthenticated branch, dashboard routes get the **redirect-to-`/login`** treatment (same as
  `/score`), NOT the 401-JSON treatment (that is only for `/api/*` routes). Concretely: extend the existing
  `request.nextUrl.pathname.startsWith("/score")` redirect condition to also cover `/dashboard`

### Types
- No change to `src/types/scoring.ts`. `SubmissionRow` lives canonically in `src/lib/progress.ts` (see
  above); pages and components import it from `@/lib/progress`. Do not create `src/types/db.ts`.

---

## Testing (Rule 9 — encode intent)
- Unit-test `src/lib/progress.ts` against fixture submission arrays:
  - `computeRecurringWeaknesses` correctly identifies the criterion that is lowest most often (not merely
    lowest on average) — a test where criterion A has the worst average but criterion B is lowest most
    frequently must return B as `timesWeakest` leader
  - `computeBandTrend` preserves chronological order oldest→newest regardless of input order
  - zero-submission and single-submission inputs return safe empty/degenerate results, no throw
- Manual: create 2–3 submissions via the live score flow, confirm they appear on `/dashboard`, the trend
  renders, weakest criterion is correct, and a detail page re-renders the stored report identically.

---

## Out of scope
- Editing or deleting submissions
- PDF/CSV export
- Cross-user comparisons, leaderboards, cohort stats
- Email reminders / notifications
- Pagination (fine until a user has many dozens of submissions — note as future)
- Any change to scoring, prompts, or the model

---

## Risks
- **RLS correctness is the security-critical point.** The dashboard and detail pages must use the
  user-scoped server client (session cookie), never the service-role client. A non-owner requesting
  `/dashboard/<someone-elses-id>` must get no row.
- **ScoreReport extraction must be behavior-preserving** — the `/score` output should look identical after
  the refactor. Extract verbatim; do not "improve" the markup (Rule 3).
- **jsonb shape:** the `submissions` table is brand new and empty, so there is no legacy `scores` data with a
  mismatched shape — safe to assume current `ScoringResult` everywhere.
- **No new dependency** if the hand-rolled SVG decision holds; revisit only if richer charts are needed.
