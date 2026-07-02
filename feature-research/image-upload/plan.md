# Plan — Task 1 Academic chart image upload

## Goal
Let candidates attach the chart/graph/map/diagram image for **Task 1 Academic** scoring, so the
vision model can verify data accuracy and key-feature selection instead of running in NO-VISUAL MODE.
Scope is strictly `TASK1_ACADEMIC`. Task 2 and Task 1 General stay text-only and untouched.

## Success criteria
1. On the Task 1 Academic tab only, the user can attach one image (png/jpeg/webp), see a thumbnail, and remove it.
2. When an image is attached, the model receives it as a multimodal message and scores against it
   (NO-VISUAL MODE rule does NOT apply; data accuracy IS assessed).
3. When no image is attached, behaviour is exactly as today (NO-VISUAL MODE still applies).
4. Image is never persisted — passed inline to the model for one call and discarded.
5. Image is downscaled client-side before upload (max ~1024px longest edge) to bound tokens + payload.
6. Other two task types are visually and behaviourally unchanged.

## Constraints / facts established
- Vision confirmed working on `qwen/qwen3.6-flash` (and gemini-2.5-flash, haiku) via direct probe.
- Next.js 16.2.9 App Router route handlers have a **4MB default body size limit** (not 10MB —
  `experimental.proxyClientMaxBodySize` is a proxy setting, not the route handler limit). A 1024px
  JPEG at quality 0.85 encodes to ~300–600 KB binary → ~400–800 KB base64, well under 4MB.
  **No next.config change is required.** Confirmed from bundled docs.
- OpenRouter uses the OpenAI-compatible multimodal format: `content: [{type:"text"...},{type:"image_url",image_url:{url:dataUri}}]`.
- Current Task 1 Academic prompt rule 7 (system-prompt.ts:270) = NO-VISUAL MODE. Must be overridden
  when an image is present.

## Changes (surgical)

### 1. `src/app/score/page.tsx` (client)
- Add state: `imageDataUri: string | null`.
- Render an image upload control **only when `taskType === "TASK1_ACADEMIC"`** (between question and essay).
  - `<input type="file" accept="image/png,image/jpeg,image/webp">`.
  - On select: validate type; downscale via a canvas helper to max 1024px longest edge; re-encode to
    JPEG (quality ~0.85) → data URI; store in state; show thumbnail + "Remove" button.
  - Reject non-images with an inline error. Validate as `["image/png","image/jpeg","image/jpg","image/webp"].includes(file.type)` — not `file.type.startsWith("image/")`, as Windows may report JPEG files as `image/jpg`. Cap original file at 10MB before processing.
- Clear `imageDataUri` in `switchTaskType` and in "Score another". The "Score another" `onClick` at
  `page.tsx:494` currently calls `setResult(null); setError(null); setEssay("")` — add
  `setImageDataUri(null)` to that same handler. All four setters must be present.
- In `handleScore`, include `image: taskType === "TASK1_ACADEMIC" ? imageDataUri : null` in the POST body.
- Add a small helper `downscaleImage(file): Promise<string>` (canvas) co-located in this file
  (single-use; no shared util per Rule 2).
- Optional copy: a one-line hint under the control ("Attach the chart for accurate data scoring").
  Not required for success criteria.

### 2. `src/app/api/score/route.ts` (server)
- Extend the destructured body type with `image?: string | null`.
- Validate: if `image` is present, check that the data URI prefix declares an allowed MIME type.
  Specifically: parse the prefix before `;base64,` and assert it is one of
  `data:image/png`, `data:image/jpeg`, `data:image/jpg`, `data:image/webp`.
  Reject (treat as no image) if it starts with `data:image/` but with a disallowed subtype (e.g. `image/svg+xml`).
  This matches the client-side allowlist and prevents SVG payloads reaching the model.
- Derive **two variables before the first call** and use them in BOTH the primary call (line 68) AND the
  retry call (line 83):
  ```
  // derive once, before any callModel call
  const effectiveSystemPrompt =
    image && taskType === "TASK1_ACADEMIC"
      ? systemPrompt +
        "\n\nIMAGE PROVIDED: The Task 1 chart/diagram IS attached to this message. " +
        "NO-VISUAL MODE (rule 7) does NOT apply — verify the figures and key-feature " +
        "selection against the image and assess Task Achievement (including data accuracy) normally."
      : systemPrompt;

  const userContent: string | Array<ChatCompletionContentPart> =
    image && taskType === "TASK1_ACADEMIC"
      ? [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: { url: image } },
        ]
      : userMessage;
  ```
  Add this import at the top of the file:
  ```typescript
  import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
  ```
  Use `ChatCompletionContentPart` — this is the correct SDK type; do NOT invent a custom `ChatContent` type.
  The `import type` form is required (this is a TypeScript type with no runtime value).

- Change `callModel` signature: `userContent: string | Array<ChatCompletionContentPart>` (replace
  `userMessage: string`). Pass through verbatim to the `content` field of the user message.

- **Both call sites must use `effectiveSystemPrompt` and `userContent`:**
  - Primary (currently line 68): `callModel(effectiveSystemPrompt, userContent, activeModel)`
  - Retry (currently line 83): `callModel(effectiveSystemPrompt, userContent, activeModel)`
  The retry must NOT fall back to the plain `systemPrompt`/`userMessage` variables — that would silently
  drop the image and the rule-7 override on parse-error retries.

- Keep `max_tokens: 4000` and all error handling identical.

### 3. No type changes required in `src/types/scoring.ts`
- `ScoringResult` already has `data_accuracy_note` and `overview_present`. With a real image these
  fields become meaningful (currently suppressed by NO-VISUAL MODE). No schema change.

## Explicitly out of scope
- No image storage / DB / blob.
- No multipart/form-data (JSON base64 is sufficient at this size).
- No change to Task 2 / Task 1 General.
- No new few-shot examples with images (the few-shot stays text; only the live request carries the image).

## Risks
- **Large payloads** if downscaling is skipped → mitigated by mandatory client downscale; downscaled
  payload is ~800KB base64, well under the 4MB App Router route handler default.
- **Model ignores rule-7 override** → mitigate by making the directive explicit and first-person imperative;
  verify manually with one map and one process image.
- **Token cost** of images → downscale to 1024px caps it; note for cost tracking.

## Verification

### Manual smoke tests (4 checks)
1. Task 1 Academic: attach a chart image, score, confirm `data_accuracy_note` reflects the real figures
   and the band is plausible. Test once with a **process diagram** and once with a **map** (the hard cases).
2. Task 1 Academic with NO image: confirm NO-VISUAL MODE still applies (unchanged behaviour).
3. Task 2 and Task 1 General: confirm no upload control appears and scoring is unchanged.
4. Confirm switching tabs / "Score another" clears the attached image.

### Accuracy re-eval (automated, with images)
Source images are available in `pdf_pages/` for all 9 TASK1_ACADEMIC eval essays:
- `pdf_pages/b14/` — covers `b14-t3-task1`
- `pdf_pages/b_unknown/` — covers `b_unknown-t2/t3/t4-task1` (Cambridge 16)
- `pdf_pages/b17/` — covers `b17-t1-task1`, `b17-t4-task1`
- `pdf_pages/b18/` — covers `b18-t2-task1`
- Cambridge 15 question pages exist in `pdf_pages/` root as numbered PNGs — covers `b15-t1-task1`, `b15-t4-task1`

**Prerequisite (manual, before writing the script):** identify which PNG in each book subfolder
corresponds to which test's Task 1 question page. The subdirs (`b14/p001–p007`, etc.) use
sequential filenames with no manifest — someone must open each PNG and note the mapping, e.g.:
`b17/p003.png → Test 1 Task 1 (Norbiton map)`. Record this as a JSON mapping file
(e.g., `pdf_pages/page_map.json`) keyed by eval essay ID.

After the mapping exists and image upload is implemented, write a script (similar to `scripts/eval_one.py`) that:
1. Loads `pdf_pages/page_map.json` to resolve each TASK1_ACADEMIC eval essay ID → PNG path
2. Encodes the PNG as `data:image/png;base64,...` and adds it to the POST body as `image`
3. Scores each essay **with** the matched image via `/api/score`
4. Reports MAE alongside the image-less baseline (current Task1 MAE 0.32 from bake-off)

This gives a quantitative before/after comparison and closes the accuracy loop.
</content>
</invoke>
