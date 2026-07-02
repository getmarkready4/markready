# Session Brief: Progress Dashboard — history, band trends, weakness tracking

## Goal
Authenticated users get a `/dashboard` showing submission history, band trends over time, and recurring
weaknesses, plus a detail page that re-renders any past report. All data already persists in the Supabase
`submissions` table — this is a read/render feature. No schema change, no scoring change, no new runtime
dependency.

## Critical codebase facts (Next.js 16.2.9 — differs from what you may know)

- Project root: `markready/` (all paths below relative to it). App dir: `src/app`.
- **Dynamic route `params` is a Promise**: `{ params }: { params: Promise<{ id: string }> }` then
  `const { id } = await params;`. Writing `params.id` synchronously is a runtime error.
- **The server Supabase client factory is async**: `const supabase = await createClient();`
  (from `@/lib/supabase/server`). Without `await` you get a Promise, and `.auth.getUser()` fails.
- Proxy (renamed middleware) lives at `src/proxy.ts` and already gates `/score` (redirect → `/login`) and
  `/api/score` (401 JSON).
- Verify with `npm run build` (must pass — it type-checks and prerenders). Dev server: `npm run dev`.
- Existing Supabase clients: `src/lib/supabase/client.ts` (browser), `server.ts` (server, session-scoped,
  RLS applies), `service.ts` (service-role — **do NOT use it anywhere in this feature**; RLS scoping is
  security-critical).

## Read these files FIRST (before writing any code)

1. `src/types/scoring.ts` — confirm the exact shape: `ScoringResult` (fields used here:
   `criteria: Partial<Record<CriterionKey, CriterionScore>>`, `weakest_criterion: CriterionKey`,
   `weaknesses: Weakness[]` with `.issue`, `overall_band`), the `CriterionKey` union values,
   `CRITERION_LABELS`, `TASK_LABELS`, `TaskType`.
2. `src/app/score/page.tsx` — the results JSX you will extract (see ScoreReport below). Note it renders
   `TASK_LABELS[taskType]` from component state inside the results markup.
3. `src/proxy.ts` — the gating pattern you will extend.

## DB shape (already exists, RLS "users read own submissions")

`submissions`: `id uuid`, `user_id uuid`, `task_type text` (a `TaskType` string), `question text`,
`essay text`, `scores jsonb` (= full `ScoringResult`), `overall_band numeric`, `created_at timestamptz`.
Table is brand new and empty — no legacy-shape rows exist.

---

## Files to create

### 1. `src/lib/progress.ts` — pure functions, no I/O

`SubmissionRow` is defined HERE and only here (canonical). Do not re-declare it elsewhere; pages import it
from `@/lib/progress`.

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
```

Define a local runtime constant of the known criterion keys (copy the values from the `CriterionKey` union
in `src/types/scoring.ts` after reading it) — needed for runtime guards, since `scores` comes from LLM
output at insert time:

```ts
const CRITERION_KEYS: CriterionKey[] = [/* exact union members from types/scoring.ts */];
```

Three exported functions (handle empty input and single-row input without throwing; never emit
`undefined`/`NaN` values):

```ts
// Oldest→newest series for charting, regardless of input order.
// Iterate ONLY criterion keys present on each row's scores.criteria; omit absent ones.
export function computeBandTrend(subs: SubmissionRow[]): {
  date: string;                                      // created_at
  overall: number | null;
  criteria: Partial<Record<CriterionKey, number>>;   // only keys present on that row
}[];

// Group by scores.weakest_criterion (a CriterionKey) — NOT by weakness.criterion free-text.
// Runtime-guard: skip rows whose weakest_criterion is missing or not in CRITERION_KEYS.
// Sorted by timesWeakest descending.
export function computeRecurringWeaknesses(subs: SubmissionRow[]): {
  criterion: CriterionKey;
  timesWeakest: number;     // count of submissions where this was the weakest_criterion
  avgBand: number;          // mean band of this criterion across rows where it is present
  recentIssues: string[];   // up to 3 verbatim weaknesses[].issue strings from those rows, newest first
}[];

export function computeSummary(subs: SubmissionRow[]): {
  total: number;
  latestOverall: number | null;
  bestOverall: number | null;
  deltaFromFirst: number | null;  // latest overall − first (chronological) overall; null if <2 rows
};
```

### 2. `src/components/ScoreReport.tsx` — behavior-preserving extraction

Extract the existing results-rendering JSX from `src/app/score/page.tsx` verbatim into:

```ts
function ScoreReport({ result, taskType }: { result: ScoringResult; taskType: TaskType })
```

- The results markup reads `TASK_LABELS[taskType]` — that is why `taskType` is a prop. Do NOT derive the
  label from `result.exam` (a plain string, not a `TaskType`).
- Move the markup **verbatim** — no visual/structural changes, no "improvements". `/score` must look
  identical afterwards.
- The extracted JSX uses no hooks or browser APIs, so the component needs no `"use client"` directive of
  its own; it is imported by both a client page and server pages.

### 3. `src/components/BandTrendChart.tsx` — hand-rolled SVG, client component

`"use client"`. Props: the array returned by `computeBandTrend`. No charting library.

- Inline SVG line chart: x = submission order (label with short dates), y = band, **fixed y-axis 0–9** with
  horizontal gridlines at integer bands.
- Series toggle: buttons for "Overall" plus one per criterion that appears anywhere in the data
  (label via `CRITERION_LABELS`); default = Overall. One series drawn at a time (keep it simple).
- Degenerate cases: empty series → render nothing (parent shows empty state); single point → dot, no line.
- Accessibility: `<title>` inside the SVG describing the current series.

### 4. `src/app/dashboard/page.tsx` — Server Component

```ts
const supabase = await createClient();                 // async factory!
const { data: { user } } = await supabase.auth.getUser();
if (!user) redirect("/login");                          // defence in depth (proxy already gates)
const { data } = await supabase
  .from("submissions")
  .select("id, task_type, question, essay, scores, overall_band, created_at")
  .order("created_at", { ascending: false });
```

- Uses the **session-scoped** client only — RLS restricts rows to the signed-in user.
- Compute summary / trend / weaknesses via `@/lib/progress`.
- Render, in order:
  - Header: user email, "New evaluation" link → `/score`, sign-out button (small `"use client"` child
    component `SignOutButton` using the browser client: `await supabase.auth.signOut(); router.push("/login")` —
    same pattern as the score page's existing sign-out)
  - Summary cards: total evaluations, latest overall, best overall, delta-from-first (↑/↓ indicator)
  - `<BandTrendChart data={trend} />`
  - Recurring weaknesses: for each entry — criterion label, "weakest in N of M evaluations", avg band, and
    its `recentIssues` as quoted lines
  - History list: each row = date · `TASK_LABELS[task_type]` · overall band · link to `/dashboard/{id}`
- Empty state (0 submissions): friendly message + link to `/score`. No chart, no weaknesses section.
- Match the existing visual style of the app (Tailwind classes consistent with `score/page.tsx`).

### 5. `src/app/dashboard/[id]/page.tsx` — Server Component

```ts
export default async function SubmissionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;                          // Next 16: params is a Promise
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: submission } = await supabase
    .from("submissions")
    .select("id, task_type, question, essay, scores, overall_band, created_at")
    .eq("id", id)
    .maybeSingle();
  if (!submission) notFound();                          // covers non-owner ids too (RLS returns no row)
  ...
}
```

- `notFound()` imported from `next/navigation`. Never dereference a null row.
- Render: date + task label header, the original question and essay (collapsible or plain sections),
  `<ScoreReport result={submission.scores} taskType={submission.task_type} />`, back link to `/dashboard`.

---

## Files to modify

### `src/app/score/page.tsx`
- Replace the inline results JSX with `<ScoreReport result={result} taskType={taskType} />` (import it).
  The removed markup must equal what went into ScoreReport — behavior-preserving.
- Add a "My progress" link → `/dashboard` in the header near the existing sign-out button.
- Touch nothing else (no changes to submission logic, image upload, tabs, error handling).

### `src/proxy.ts`
- Add `"/dashboard"` and `"/dashboard/:path*"` to the `config.matcher` array.
- Extend the existing unauthenticated redirect condition (currently
  `request.nextUrl.pathname.startsWith("/score")`) to also cover `/dashboard` — dashboard routes get the
  **redirect to `/login`**, NOT the 401-JSON branch (that is only for `/api/*`).

---

## Tests (unit — encode intent)

Add **vitest as a devDependency** (`npm install -D vitest`) and a `"test": "vitest run"` script in
`package.json`. Create `src/lib/progress.test.ts` importing `{ describe, it, expect }` from `"vitest"`
explicitly (no globals config needed). Fixture arrays of `SubmissionRow`. Required cases:

1. **Most-often-weakest beats worst-average**: fixture where criterion A has the worst *average* band but
   criterion B is `weakest_criterion` most *often* → `computeRecurringWeaknesses` ranks B first by
   `timesWeakest`. (This encodes WHY: the product surfaces the recurring weakness, not the single worst score.)
2. **Chronological order**: `computeBandTrend` returns oldest→newest even when input rows are newest-first
   (the dashboard queries descending — the function must not depend on input order).
3. **Degenerate inputs**: empty array and single-row array → all three functions return safe results
   (empty arrays / nulls), no throw.
4. **Missing criteria omitted**: a Task 2 row (no `task_achievement` in `criteria`) produces a trend entry
   whose `criteria` map has no `task_achievement` key at all (not `undefined`).
5. **Runtime guard**: a row with an invalid `weakest_criterion` string is skipped by
   `computeRecurringWeaknesses`, not crashed on.

Run `npx vitest run` — all tests must pass. Then run `npm run build` — must pass (it type-checks the whole
project including the test file).

## Out of scope — do NOT build
- Editing/deleting submissions, export, pagination, notifications, cross-user stats
- Any change to scoring logic, prompts, models, or `/api/score`
- Any schema change; any use of the service-role client
- Any new runtime dependency (vitest is dev-only)

## Report back
List files created/modified, test results (pass/fail counts), and the `npm run build` outcome.
