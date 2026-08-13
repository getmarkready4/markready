# Plan — Task 1 Academic: add corresponding charts

Branch: `feat/task1-academic-charts` (off `getmarkready/main` @ d2e8ae9)

## Goal
Each Task 1 Academic sample prompt references a visual ("the table below", "the
graph below", "the diagrams below") but no visual is shown — the candidate must
upload their own. Add the **correct corresponding chart** for each of the three
samples, rendered as **original inline SVG** (recreated from the standard
Cambridge data — not copied images), displayed below the prompt, and
**auto-fed into scoring** so the candidate does not have to upload anything for
a sample.

## Success criteria
1. Selecting a Task 1 Academic sample shows a matching, readable chart below the prompt.
2. That chart is automatically attached to the scoring request (no upload step) —
   the `/api/score` route and its `image` contract are unchanged.
3. Choosing "Use my own question" hides the sample chart and restores the manual
   upload field (existing behaviour).
4. Switching task type / question clears any stale chart image.
5. `npm run build` + `npm run lint` pass. No changes to the API or scoring prompt.

## Decisions (confirmed with user)
- Format: inline SVG/React components (matches `BandTrendChart.tsx`).
- Scoring: auto-feed — rasterize the shown SVG to a JPEG data-URI client-side and
  set it as `imageDataUri`, exactly as an upload would. API stays untouched.
- Data: recreated from the standard Cambridge versions; **user verifies the
  numbers before merge** (values flagged VERIFY below).
- Copyright: original renderings from the underlying data only; no Cambridge image assets.

## Files

### New — `src/components/task1-charts/`
- `svgToDataUri.ts` — helper: serialize an `SVGSVGElement`, load via `Image`,
  draw onto a white canvas, return `canvas.toDataURL("image/jpeg", 0.9)`.
  Mirrors the existing `downscaleImage` approach in `score/page.tsx`.
- `AshdownMuseumChart.tsx` — visitor-numbers table + two satisfaction surveys
  (before/after) as labelled horizontal bars.
- `Co2EmissionsChart.tsx` — multi-series line graph, 4 countries, 1967–2007.
- `WaterUsageChart.tsx` — grouped bar chart, 6 regions × {agricultural,
  industrial, domestic}.
- `index.tsx` — `SAMPLE_CHARTS: Record<string, React.ComponentType>` keyed by
  sample id (`museum` | `co2` | `water`).

Each chart: fixed `viewBox`, explicit `fill="#…"` colours (not `currentColor`,
so rasterization is faithful), white background, `<title>` for a11y — same
palette as `BandTrendChart`.

### Edited — `src/app/score/page.tsx` (surgical)
- Derive selected sample id: `SAMPLE_QUESTIONS.TASK1_ACADEMIC.find(q => q.text === question)?.id`.
- When `taskType === "TASK1_ACADEMIC"` and **not** custom and the id has a chart:
  render `<SAMPLE_CHARTS[id] />` inside a ref'd wrapper; in a `useEffect` keyed on
  that id, rasterize the wrapper's `<svg>` and `setImageDataUri(dataUri)`.
- Replace the file-input block with: sample chart (when a sample is active) OR the
  existing upload input (custom questions only).
- Extend `switchTaskType` / question-change handlers to clear `imageDataUri` when
  leaving a sample (criterion 4). No other logic touched.

## Standard data to encode — VERIFY before merge
**Ashdown Museum (Cambridge 11 T1)** — Visitors: before 74,000 / after 92,000.
Satisfaction: before {V.satisfied 15, Satisfied 30, Dissatisfied 40, V.dissatisfied 10, No response 5};
after {35, 40, 15, 5, 5}.

**CO₂ emissions, metric tonnes/person**, at 1967/1977/1987/1997/2007:
UK 10.5/11.0/10.0/9.2/8.8 · Sweden 8.8/10.2/7.0/5.9/5.6 ·
Italy 4.3/6.0/6.8/7.5/8.0 · Portugal 1.1/2.0/3.2/5.2/5.5.

**Water use, % agricultural/industrial/domestic**:
World 70/20/10 · N.America 39/48/13 · Europe 32/53/15 ·
Africa 84/6/10 · Central Asia 88/5/7 · S.E. Asia 81/12/7.

## Out of scope
- No API / system-prompt / DB changes.
- No new upload validation; existing image-size guard on the API still applies to
  the rasterized data-URI (JPEG at 1024px is comfortably under the cap).
- `eval-task1.json` and Task 2 / General untouched.

## Risks
- Rasterizing SVG with foreign fonts can taint the canvas. Mitigation: use only
  plain `<text>` with system fonts and numeric labels; no external fonts/images →
  canvas stays exportable.
- Numbers are approximate reconstructions → gated on user verification (above).
