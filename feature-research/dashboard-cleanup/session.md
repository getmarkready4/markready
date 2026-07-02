# Session brief: dashboard cleanup

**Goal:** Execute the approved plan at
`feature-research/dashboard-cleanup/plan.md` (v2). Read it in full first —
it is the complete spec, including two reviewer points that were explicitly
REJECTED with rebuttals at the bottom; do not apply those.

## Files in scope (edit only these)

1. `markready/src/components/BandTrendChart.tsx` — rewrite per plan §1
2. `markready/src/lib/progress.test.ts` — type fixes per plan §2 (do NOT
   change test logic/assertions — 8 tests must still pass identically)
3. `markready/src/app/dashboard/page.tsx` — add `.eq("user_id", user.id)` to
   the submissions query; update SignOutButton import to
   `@/components/SignOutButton`
4. `markready/src/app/dashboard/[id]/page.tsx` — add `.eq("user_id", user.id)`
   to the detail query
5. `markready/src/app/score/page.tsx` — remove unused imports
   (`CriterionKey`, `CRITERION_LABELS`, `TASK_LABELS`); replace inline
   header sign-out button with `<SignOutButton />`
6. `markready/src/proxy.ts` — canonical Supabase setAll pattern per plan §6;
   the MAINTENANCE_MODE block at the top must remain first and unchanged
7. CREATE `markready/src/components/SignOutButton.tsx` (content of the old
   sign-out-button.tsx) and DELETE
   `markready/src/app/dashboard/sign-out-button.tsx`

## Constraints

- No new dependencies, no schema changes, no other files.
- Match existing style (Tailwind arbitrary-value colors like `#1F5C4E`,
  sparse comments).
- Chart: preserve viewBox 600×300, margins, colors, button styling, fixed
  0–9 y-range, gridlines/labels at bands 1–9. New behavior allowed ONLY as
  specified: thinned x-labels, dots at true index positions, line only with
  ≥2 non-null points, empty-series renders buttons + empty grid instead of
  vanishing.
- This project's CLAUDE.md rules apply (surgical changes, fail loud).

## Verification (run all from `markready/`, report full results)

1. `npx tsc --noEmit` — must be 0 errors (the progress.test.ts error must be
   gone).
2. `npx eslint src` — must be 0 errors. The only acceptable remaining
   warnings are the two pre-existing ones in `src/app/score/page.tsx`
   (`react-hooks/exhaustive-deps` on the getUser effect, and
   `@next/next/no-img-element`). The unused-import warnings there must be
   gone; the BandTrendChart error+warnings must be gone; the proxy.ts
   prefer-const error must be gone.
3. `npm test` — 8/8 passing.
4. `npm run build` — green.

Report back: summary per file, verification output, any deviations with
justification.
