# Plan: Dashboard cleanup — hooks bug, typecheck fix, defense-in-depth, dedup

**Date:** 2026-07-03
**Status:** v2 — revised after reviewer critique. Reviewer points 2, 3, 4, 6
and suggestion A adopted below. Points 1 and 5 REJECTED with evidence (see
"Reviewer rebuttals" at the bottom); do not apply them.
**Scope:** Fixes findings 1–4 plus smaller items from the 2026-07-03 code review.
No schema changes. No behavior changes visible to a legitimate user except
better chart rendering.

## Files in scope

1. `markready/src/components/BandTrendChart.tsx` — rewrite (fixes 1, 3, dedup, dead code)
2. `markready/src/lib/progress.test.ts` — type fixes (fix 2, `any` removal)
3. `markready/src/app/dashboard/page.tsx` — add user_id filter (fix 4); update SignOutButton import path
4. `markready/src/app/dashboard/[id]/page.tsx` — add user_id filter (fix 4)
5. `markready/src/app/score/page.tsx` — remove unused imports; reuse SignOutButton
6. `markready/src/proxy.ts` — canonical Supabase cookie pattern (fixes prefer-const)
7. MOVE `markready/src/app/dashboard/sign-out-button.tsx` → `markready/src/components/SignOutButton.tsx`

## Changes

### 1. BandTrendChart.tsx — rewrite with a single render path

Current problems: `useState` called after a conditional early return
(rules-of-hooks error); ~100 lines duplicated between the single-point and
multi-point branches; unused `minVal`/`maxVal`; x-axis renders one label per
point (unreadable past ~8 points).

New structure (one render path):

- `useState` is the FIRST statement in the component. The
  `if (data.length === 0) return null` guard moves AFTER all hooks.
- Delete `minVal`/`maxVal`.
- Unify the two branches:
  - x position: `data.length === 1 ? marginLeft + plotWidth / 2 :
    marginLeft + (i / (data.length - 1)) * plotWidth`.
  - Dots are drawn for every non-null value at its actual index position
    (this also improves the old behavior where a series with one non-null
    value among many was centered instead of placed at its date).
  - The line `<path>` is drawn only when the selected series has ≥2 non-null
    values.
  - Buttons, gridlines, y-labels, and `<title>` are rendered ONCE.
- If the selected series has zero non-null values, keep rendering the buttons
  and the empty grid (do NOT return null — the old code made the whole chart,
  including the series buttons, vanish with no way back). Note: currently
  unreachable for criteria (options are derived from data) but reachable for
  "overall" if all `overall_band` are null.
- X-axis label thinning: `const step = Math.ceil(data.length / 6);` render a
  label when `i % step === 0 || i === data.length - 1`. To avoid the last two
  labels colliding, skip the second-to-last modulo label when
  `data.length - 1 - i < step` (i.e. render modulo labels only while
  `i <= data.length - 1 - step`, plus always the final point).
  Edge cases (verified): 1 point → single label on the final point;
  2 points → both labeled (step=1, i=0 passes `0 <= 0`, i=1 is final);
  7 points → labels at i=0,2,4,6 with a full step between the last two.
- Preserve: viewBox dimensions, colors, Tailwind classes, series-button
  styling, fixed 0–9 y-range, gridlines at bands 1–9.

### 2. progress.test.ts — make it typecheck without `any`

- `makeScoringResult` helper, lines ~19–25: `Object.entries(criteria)` yields
  `number | undefined` values. Guard with `if (band !== undefined)` inside the
  loop (do not cast).
- Replace the five `any` usages (exact instructions, no implementer choice):
  - Declare `criteriaMap` as `Partial<Record<CriterionKey, CriterionScore>>`
    from the start (import `CriterionScore`, `CriterionKey` from
    `@/types/scoring`). In the loop, assign via
    `criteriaMap[key as CriterionKey] = { ... }`. Then pass
    `criteria: criteriaMap` with NO cast.
  - `weaknessesArray: any[]` → `const weaknessesArray: Weakness[] = []`
    (import `Weakness` from `@/types/scoring`).
  - `weaknesses: weaknessesArray as any` →
    `weaknessesArray as [Weakness, Weakness, Weakness]`. If tsc rejects the
    direct array→tuple cast under strict mode, use
    `weaknessesArray as unknown as [Weakness, Weakness, Weakness]`.
  - `weakest_criterion: weakestCriterion as any` →
    `weakestCriterion as CriterionKey` (string → string-literal-union `as`
    cast is legal; this is the single deliberate type escape that lets tests
    pass invalid values through the `string`-typed parameter).
  - Test 5, line ~273: `"invalid_criterion" as any` — remove the cast
    entirely. The parameter `weakestCriterion` is typed `string`, so the
    string literal needs no cast at the call site; the escape happens inside
    the helper (previous bullet).
- Do NOT change any test logic, assertions, or fixtures — behavior of the
  suite must be identical (8 tests, all passing).

### 3. Dashboard ownership filters (defense-in-depth)

RLS already restricts reads to own rows; these filters are belt-and-braces so
an accidental future swap to the service-role client cannot become an IDOR.

- `dashboard/page.tsx` list query: add `.eq("user_id", user.id)` after
  `.from("submissions").select(...)`.
- `dashboard/[id]/page.tsx` detail query: add `.eq("user_id", user.id)`
  alongside `.eq("id", id)`.
- Note: `user_id` is not in the select list and doesn't need to be.

### 4. SignOutButton move + reuse

- Move `src/app/dashboard/sign-out-button.tsx` to
  `src/components/SignOutButton.tsx` (same content; it's now shared). It is a
  `"use client"` component; `score/page.tsx` is also a client component, and
  `dashboard/page.tsx` is a server component importing a client child — both
  import patterns are fine as-is, no re-export tricks needed.
- Update the import in `dashboard/page.tsx`.
- In `score/page.tsx`: delete the inline sign-out button (the
  `<button onClick={async () => { await supabase.auth.signOut(); ... }}>`
  in the header) and render `<SignOutButton />` instead. The ONLY usage
  removed is `supabase.auth.signOut()`; the `supabase` client instance stays
  (used by the `getUser()` effect) and `router` stays (used by the 401
  handler). Do not remove `createClient()` or `useRouter()`.

### 5. score/page.tsx — remove unused imports

Lint reports `CriterionKey`, `CRITERION_LABELS`, `TASK_LABELS` unused (left
over from the ScoreReport extraction). Remove exactly those from the two
import statements; keep whatever is still used (`TaskType`, `MIN_WORDS`,
`ScoringResult`, etc. — verify against usage).

### 6. proxy.ts — canonical Supabase SSR cookie pattern

Replace the current `setAll` with the documented pattern so refreshed tokens
propagate to downstream server code within the same request:

```ts
let supabaseResponse = NextResponse.next({ request });
// ...
cookies: {
  getAll: () => request.cookies.getAll(),
  setAll: (toSet) => {
    toSet.forEach(({ name, value }) => request.cookies.set(name, value));
    supabaseResponse = NextResponse.next({ request });
    toSet.forEach(({ name, value, options }) =>
      supabaseResponse.cookies.set(name, value, options)
    );
  },
},
```

- Rename `response` → `supabaseResponse` (matches the canonical example) or
  keep `response` — implementer's choice, but the reassignment must exist
  (this is what resolves the `prefer-const` error correctly — do NOT "fix"
  the lint by changing `let` to `const`).
- The MAINTENANCE_MODE block at the top of `proxy()` must stay first and
  unchanged.
- The unauth redirect/401 logic and the matcher stay unchanged.

## Success criteria

- `npx tsc --noEmit` — fully clean (0 errors, including the test file).
- `npx eslint src` — 0 errors. Remaining warnings allowed ONLY if pre-existing
  and out of scope (`supabase.auth` useEffect dep, `<img>` element in
  score/page.tsx).
- `npm test` — 8/8 pass, unchanged.
- `npm run build` — green.
- No visual/behavioral change to dashboard or score flows for a legitimate
  user, except: chart x-labels are thinned, and a sparse series now shows
  dots at correct date positions.

## Reviewer rebuttals (do NOT apply these two review points)

- **Reviewer point 1 (proxy `options` on request-side set): rejected.** The
  current code passes `(name, value)` only to `request.cookies.set` (options
  go to the response-side set), and the canonical @supabase/ssr middleware
  example does the same — request cookies carry no options; attributes like
  `httpOnly`/`sameSite` are response-cookie concepts. The plan's snippet is
  correct as written.
- **Reviewer point 5 (`"invalid_criterion" as any` must stay as a cast):
  rejected.** The helper parameter is typed `string`; a string literal call
  argument needs no cast. The deliberate invalid-value escape lives inside
  the helper (`weakestCriterion as CriterionKey`). Removing the call-site
  cast is correct.

## Out of scope

- Pagination / column-pruning of the dashboard query (future-scale item).
- `computeSummary` delta semantics.
- `useEffect` dependency warning and `<img>` warning in score/page.tsx.
- BUILD_STATUS.md changelog (orchestrator updates after diff review).
