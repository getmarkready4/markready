# MarkReady — Build Status

**Last updated:** 2026-06-26  
**Branch:** main  
**Stack:** Next.js 16.2.9 · TypeScript · Tailwind CSS · OpenRouter (`anthropic/claude-haiku-4.5` default; `qwen/qwen3.6-flash` reserved for Task 1 charts)

---

## How to Run

### Prerequisites

- Node.js 18+
- Python 3.9+ (scripts only)
- An [OpenRouter](https://openrouter.ai) API key

### 1. Install dependencies

```bash
cd markready
npm install
```

### 2. Configure environment

Create `markready/.env.local`:

```
OPENROUTER_API_KEY=your_key_here
OPENROUTER_MODEL=anthropic/claude-haiku-4.5   # optional — current default (Task 2 MVP)
```

Speed/accuracy/cost tradeoffs (measured per-eval cost, real pipeline, 2026-06-26):
```
OPENROUTER_MODEL=anthropic/claude-haiku-4.5   # ~22s, $0.019/eval, T2 MAE 0.39 — DEFAULT
OPENROUTER_MODEL=qwen/qwen3.6-flash           # ~64s, $0.011/eval, T2 MAE 0.39, best T1 MAE 0.32 (use for charts)
OPENROUTER_MODEL=google/gemini-2.5-flash      # ~11s, weakest accuracy (T1 MAE 0.73) — not recommended
```

### 3. Start the dev server

```bash
cd markready
npm run dev
```

App runs at `http://localhost:3000/score`

### 4. Rebuild the corpus (optional)

Only needed if you add new Cambridge books or re-OCR existing ones:

```bash
python scripts/build_corpus.py    # parse OCR files → calibration-corpus.json
python scripts/split_corpus.py    # split → fewshot.json + eval-set.json
```

---

## Current Status

| Area | Status |
|---|---|
| Scoring API (`/api/score`) | Working |
| Score UI (`/score`) | Working |
| IELTS Task 2 prompt | Complete |
| IELTS Task 1 Academic prompt | Complete |
| IELTS Task 1 General prompt | Complete |
| Task 1 Academic image upload | Complete — chart image scored via multimodal API |
| Few-shot calibration injection | Working |
| Auth (Supabase magic link) | Complete — `/login`, `/auth/callback`, `src/proxy.ts` gate |
| Submissions DB (Supabase Postgres) | Complete — `profiles` + `submissions` tables, RLS, signup trigger |
| Daily cap (10 evals/day, UTC) | Complete — enforced server-side in `/api/score` (429) |
| Account ban support | Complete — `profiles.banned_at` → 403 (set via SQL) |
| Corpus pipeline (`build_corpus.py`) | Complete |
| Corpus split (`split_corpus.py`) | Complete |
| Eval harness (`eval_accuracy.py`, `eval_one.py`) | Complete and runnable |
| Model bake-off (`model_bakeoff.py`) | Complete — results in `bakeoff_results.json` |
| Model probe (`probe_model.py`, `probe_vision.py`) | Complete |
| Red-team test (`make_redteam_chart.py`, `redteam_test.py`) | Complete |
| PDF page extraction (`pdf_pages/`) | Complete — 7 books, OCR done |
| Deployment | Live but dormant — Vercel Hobby (free), https://markready-olive.vercel.app; login pending Supabase redirect-URL config |

---

## What's Built

### App — `markready/src/`

**API — `app/api/score/route.ts`**
- `POST /api/score` accepts `{ question, essay, taskType, model?, image? }`
- `image` — optional base64 data URI (TASK1_ACADEMIC only); validated against MIME allowlist
  (`image/png`, `image/jpeg`, `image/jpg`, `image/webp`) to block SVG and other types
- When image present + TASK1_ACADEMIC: sends multimodal message to OpenRouter and appends a
  directive overriding the NO-VISUAL MODE rule (rule 7) so data accuracy is assessed against the chart
- `effectiveSystemPrompt` and `userContent` derived once and used in both the primary call and the
  one-retry fallback — prevents the retry silently dropping the image on parse failure
- `model` override param lets the bake-off script hot-swap models without restarting the server
- Routes to the correct system prompt, calls OpenRouter, strips markdown fences, returns JSON
- Model configurable via `OPENROUTER_MODEL` env var (default: `anthropic/claude-haiku-4.5`; code fallback also haiku)

**Scoring prompts — `lib/system-prompt.ts`**  
Three full prompts (Task 2, Task 1 Academic, Task 1 General) each containing:
- Official IELTS band descriptors per criterion (1–9 in 0.5 increments)
- Calibration rules (word count penalties, overview cap, register penalties)
- Strengths-first scoring philosophy with explicit band anchors for CC, LR, GRA
- `<<CALIBRATION_EXAMPLES>>` injected at runtime from `fewshot.json`
- Task 1 Academic: NO-VISUAL MODE clause (can't verify data without the chart)
- Task 1 General: NO-PROMPT MODE clause (can't verify bullet points without the full prompt)

**UI — `app/score/page.tsx`**  
- Task type tabs: Task 2 · Task 1 Academic · Task 1 General
- Sample question selector + custom question toggle per task type
- **Task 1 Academic only:** chart/diagram image upload control — file picker, client-side downscale
  to max 1024px (canvas → JPEG 0.85), thumbnail preview, remove button; cleared on tab switch
  and "Score another"; MIME validated client-side (`image/png`, `image/jpeg`, `image/jpg`, `image/webp`)
- Live word count with colour-coded warnings below minimum
- Animated loading state with rotating examiner messages
- Results: overall band hero, per-criterion scores with bar + pill + strengths callout
- Full report (no gate — auth is the gate): criterion rationales, 3 quoted weaknesses with fixes, 5 vocab upgrades, Band 8 model rewrite, examiner verdict
- Header shows signed-in email + sign-out; 429 (daily cap) and 401 (session expired → `/login`) handled
- Task 1 extras: `overview_present` badge, `data_accuracy_note` callout

**Auth & DB — Supabase**
- `src/lib/supabase/{client,server,service}.ts` — browser, server-component, and service-role clients
- `app/login/page.tsx` — magic-link login (email OTP); `useSearchParams` wrapped in `<Suspense>` (required by Next 16 build)
- `app/auth/callback/route.ts` — handles both PKCE `code` and email-OTP `token_hash`+`type`; errors → `/login?error=...`
- `src/proxy.ts` — Next 16 "proxy" (renamed from middleware); gates `/score` (redirect) and `/api/score` (401). MUST live in `src/` because the app uses `src/app`
- `app/api/score/route.ts` — auth check → ban check → daily-cap check → LLM call → insert submission (fail-loud on insert error)
- Schema: `profiles` (id, email, banned_at) with signup trigger; `submissions` (user_id, task_type, question, essay, scores jsonb, overall_band); RLS restricts reads to own rows; service-role client bypasses RLS server-side
- Uses Supabase new-format keys (`sb_publishable_` / `sb_secret_`), validated against REST + auth endpoints

**Types — `types/scoring.ts`**  
- `TaskType`, `ScoringResult`, `CriterionScore`, `Weakness`, `VocabUpgrade`, `ModelParagraph`
- `CRITERION_LABELS`, `TASK_LABELS`, `MIN_WORDS` shared between API and UI

---

### Corpus pipeline — `scripts/`

**`build_corpus.py`**  
Parses OCR text files from 7 Cambridge IELTS books into a structured JSON corpus. Handles two OCR layouts (answer-first vs comment-first), extracts band scores, strips page numbers and artefacts, separates clean scored examples from model answers and incomplete extractions.

Sources: Cambridge 14, 15, 16, 17, 18 Academic; Cambridge 11 Academic; Cambridge 11 General Training.  
Output: `markready/src/data/calibration-corpus.json`

**`split_corpus.py`**  
Populates Task 2 questions from `pdf_pages/q2_*.txt` (assigns by page order within each book). Task 1 Academic gets a generic NO-VISUAL prompt; Task 1 General gets a generic NO-PROMPT prompt.  
Splits corpus into:
- `fewshot.json` — 6 anchors per task type, spanning the full band scale (Band 4.5–7.5)
- `eval-set.json` — held-out examples for accuracy measurement

**`eval_accuracy.py`**  
Runs the held-out eval set through the live `/api/score` endpoint. Reports MAE, % within 0.5, % within 1.0 band, and worst misses.  
Usage: `python scripts/eval_accuracy.py` (requires `npm run dev` running)

**`eval_one.py`**  
Single-model eval — same harness as `eval_accuracy.py` but accepts a model slug as argument. Useful for targeted re-runs without running the full bake-off.

**`model_bakeoff.py`**  
Sequential multi-model bake-off. Passes a `model` override to the API so models run one at a time (no throughput interference). Classifies failures by type (timeout vs HTTP 500 vs HTTP 502). Saves results to `scripts/bakeoff_results.json` and prints a ranked table by Task 2 MAE.

**`probe_model.py`**  
Direct-to-OpenRouter probe bypassing the Next.js layer. Sends a compact scoring prompt to check whether a model produces valid JSON — useful to distinguish model incompatibility from pipeline issues.

**`probe_vision.py`**  
Generates a synthetic bar chart with a hidden secret code and sends it to a model as a base64 image. Confirms whether a model has true vision capability vs text-only inference.

**`make_redteam_chart.py`**  
Generates a synthetic bar chart with known ground-truth values (`scripts/redteam_chart.png`) for red-team testing. Values are not from any published source — no contamination risk.

**`redteam_test.py`**  
Posts a deliberately flawed essay (wrong figures, missing overview, opinion sentences) with the red-team chart to `/api/score`. Used to verify that the scoring rubric fires correctly independent of training-data contamination.

---

### Corpus data — `pdf_pages/`

| Book tag | Source | Task 1 type |
|---|---|---|
| `b11gt` | Cambridge IELTS 11 General Training | TASK1_GENERAL |
| `b11ac` | Cambridge IELTS 11 Academic | TASK1_ACADEMIC |
| `b14` | Cambridge IELTS 14 Academic | TASK1_ACADEMIC |
| `b15` | Cambridge IELTS 15 Academic | TASK1_ACADEMIC |
| `b_unknown` | Cambridge IELTS 16 Academic | TASK1_ACADEMIC |
| `b17` | Cambridge IELTS 17 Academic | TASK1_ACADEMIC |
| `b18` | Cambridge IELTS 18 Academic | TASK1_ACADEMIC |

PDF pages extracted as PNGs (`p001.png` etc.), OCR'd to `ocr_<tag>.txt`, Task 2 questions extracted to `q2_<tag>.txt`.

---

## Model Bake-off Results

**Fair sequential bake-off** (2026-06-25) — 20 held-out essays, models run ONE AT A TIME to avoid
dev-server contention. Earlier parallel-run numbers were discarded (parallel load faked timeouts).

| Model | T2 MAE | T2 w1.0 | T1 MAE | T1 w1.0 | Latency | Fails |
|---|---|---|---|---|---|---|
| **qwen/qwen3.6-flash** | **0.39** | **100%** | **0.32** | **100%** | ~50s | 0 |
| anthropic/claude-haiku-4.5 | 0.39 | 100% | 0.59 | 85% | ~22s | 0 |
| google/gemini-2.5-flash | 0.44 | 90% | 0.73 | 90% | ~11s | 0 |
| deepseek/deepseek-v4-flash | 0.625 | — | 0.818 | — | 15–138s | 4/20 |
| z-ai/glm-4.7-flash | n/a | — | n/a | — | — | 8/9 |
| z-ai/glm-5.2 | skipped | — | skipped | — | — | — |
| google/gemini-2.5-pro | skipped | — | skipped | — | — | — |

**Default (2026-06-26): `anthropic/claude-haiku-4.5`** for the Task 2 MVP — same Task 2 accuracy as
qwen (0.39 MAE), ~3× faster (~22s vs ~64s), cost difference negligible once measured (see below).  
**Reserved: `qwen/qwen3.6-flash`** for Task 1 Academic (charts) — best Task 1 MAE (0.32 vs haiku 0.59);
to be wired via task-routing (fast text model for T2/T1-General, qwen only when a chart image is present).  
**Not recommended: `google/gemini-2.5-flash`** — ~11s but weakest accuracy (T1 MAE 0.73).

### Measured per-eval cost (2026-06-26) — corrects earlier estimates

Earlier per-eval cost figures were *estimates* from published per-M pricing × assumed token counts. They
were wrong because they ignored hidden reasoning-token burn. Measured via the real pipeline (full ~7.8K-token
system prompt, 3 Task 2 essays each, OpenRouter `usage.cost`):

| Model | Measured $/eval | Input tok | Output tok | Reasoning tok | Latency |
|---|---|---|---|---|---|
| `anthropic/claude-haiku-4.5` | **$0.0193** | ~7,966 | ~2,275 | 0 | 20–24s |
| `qwen/qwen3.6-flash` | **$0.0107** | ~7,662 | ~8,267 | **~6,516** | 64–66s |

- **qwen3.6-flash is a heavy reasoning model** — it burns ~6,500 hidden reasoning tokens per eval. This is
  why it takes ~64s and why its real cost ($0.0107) is ~5× the old $0.002 estimate.
- The real cost gap between haiku and qwen is **1.8×, not the ~7× previously assumed** — the 7× was an
  artifact of the bad qwen estimate. Cost is therefore *not* a deciding factor; latency and accuracy are.
- `google/gemini-2.5-pro` re-probed solo (2026-06-26): it works fine — the bake-off's 20 failures were
  infrastructural (parallel-load contention), not model quality. But it's a reasoning model (2,246 reasoning
  tokens on a *trivial* 267-token prompt), so on the real prompt it is neither cheap nor fast → ruled out.
- New candidates probed (2026-06-26): `stepfun/step-3.7-flash` broke out of the box (`finish_reason: length`,
  no content — same truncation failure as glm); `qwen/qwen3.7-plus` returns clean JSON but is a ~50s reasoning
  model with no latency win over the current qwen. Neither adopted.

**Subscription economics ($19.99/mo, 10-eval/day cap):** heavy user (150/mo) costs $2.90 (haiku) / $1.61
(qwen); sustained at cap (300/mo) costs $5.80 / $3.22. Both comfortable; the cap bounds worst-case COGS.

**Ruled out:**  
- `deepseek-v4-flash` — 4/20 failures even solo, weak Task 1 accuracy.  
- `z-ai/glm-4.7-flash` — reasoning model burns ~1,575 hidden tokens on the full IELTS prompt, truncating JSON output → HTTP 500. Incompatible.  
- `glm-5.2` / `gemini-2.5-pro` — skipped on cost ($80 of $150 OpenRouter credits used at time of bake-off).

**Contamination caveat:** eval set uses Cambridge IELTS sample answers which are widely published
online. Bake-off accuracy numbers are optimistic upper bounds — not ground truth. Red-team testing
with synthetic essays (see `redteam_test.py`) confirmed rubric logic fires correctly. True accuracy
validation requires the §2.5 gate: 100 real users sharing official IELTS results.

---

## Learnings

**Scoring bias is the hardest prompt engineering problem.** Raw LLMs error-hunt — they find mistakes and assign Band 5 without crediting range or sophistication. The fix was adding explicit band anchors (plain-language descriptions of what distinguishes Band 5 from 6 from 7) and a mandatory two-step: identify strengths first, then weigh errors. Without this, the model assigns too many Band 5s.

**Reliability beats accuracy in a bake-off.** Qwen3.6-flash had better w0.5 numbers than Haiku on some splits, but a 45% failure rate makes it unusable. Gemini 2.5 Pro had zero usable results (20 failures) — likely a context-length or rate-limit issue via OpenRouter, not a model quality issue.

**Failure classification matters.** `model_bakeoff.py` distinguishes HTTP 500 (route can't parse the model output), HTTP 502 (OpenRouter upstream error), and timeout. Without this, a slow-but-working model (Pro, reasoning models) looks the same as a genuinely incompatible one.

**NO-VISUAL MODE is necessary for Task 1 Academic.** Without the chart image, the scorer can't verify data accuracy or determine which features are "key." The clause tells the model to assume figures are accurate and assess only observable structure — otherwise it penalises Task Achievement for things it can't verify.

**Task 1 questions are unsalvageable from text extraction alone.** The chart/diagram is an image embedded in the PDF. The workaround (generic NO-VISUAL prompt) is sufficient for CC/LR/GRA and most of Task Achievement, but data-accuracy scoring is inherently limited.

**The NO-VISUAL MODE override must propagate to the retry call.** The API has a one-retry fallback on JSON parse failure. Both the modified system prompt and the multimodal user content must be derived before the first call and passed to both call sites — using the originals on retry silently drops the image and reverts to NO-VISUAL MODE.

**Cambridge eval set is contaminated.** Published Cambridge IELTS sample answers are in the training data of most LLMs. The model scoring a Cambridge essay "correctly" may be recalling the answer rather than scoring it. Signals: (a) the model says "No inaccuracies detected" without an image when NO-VISUAL MODE should prevent that claim; (b) scores match the examiner's band exactly. True accuracy requires novel essays (§2.5 gate).

**Parallel model testing is not a valid bake-off.** Running multiple models concurrently against one Next.js dev server causes contention that manifests as timeouts — making reliable models look broken. Always run models sequentially (one at a time) for fair comparison.

**Estimated token costs are unreliable for reasoning models — measure the real `usage.cost`.** The per-eval
cost estimates ($0.002 qwen) were 5× too low because they assumed no hidden reasoning tokens. qwen3.6-flash
actually burns ~6,500 reasoning tokens per eval. Always read OpenRouter's `usage.cost` from a real-pipeline
call before reasoning about COGS — published per-M pricing × assumed output is not enough when a model reasons.

**Latency is mostly a reasoning-token problem, not a prompt-size problem.** qwen's ~64s comes from generating
~8,300 output tokens (6,500 of them reasoning), not from the ~7.8K input. Trimming few-shot examples (input)
would barely move latency. Switching to a non-reasoning model (haiku, 0 reasoning, ~22s) is what actually fixes it.

**Use the right model per task type.** Haiku ties qwen on Task 2 accuracy (0.39 MAE) at 3× the speed, so it is
the Task 2 MVP default. qwen keeps a real edge only on Task 1 Academic data accuracy (0.32 vs 0.59 MAE), where
chart reading benefits from its extra reasoning. Plan: task-route — haiku for Task 2 / Task 1 General, qwen
only when a Task 1 Academic chart image is present.

**Bake-off failures can be infrastructural, not model quality.** gemini-2.5-pro's 20 failures were parallel-load
contention on one dev server, confirmed by a clean solo probe. Always re-probe a "failed" model solo before
ruling it out on quality — but a model that only works solo and is a slow/expensive reasoner is still ruled out
for production.

**Self-authored essays test rubric logic, not calibration.** A novel essay we write avoids training-data
contamination and confirms the rubric *fires* (flags planted errors), but it has no authoritative official band,
so it cannot measure calibrated accuracy (MAE). Calibration still requires the §2.5 gate (novel essays WITH
official IELTS results).

**Next.js 16 `proxy.ts` must sit next to the `app` dir.** With a `src/` layout, proxy belongs at
`src/proxy.ts`, not the project root — a root `proxy.ts` is silently ignored (no error, no warning), which
left `/score` unprotected on the first deploy. The `/api/score` route's own auth check masked it by still
returning 401. Verify proxy/middleware actually runs (curl an unauth'd protected route) rather than assuming.

**`useSearchParams` needs a `<Suspense>` boundary or the production build fails.** `next build` (not `dev`)
errors with "should be wrapped in a suspense boundary" and aborts the export. Extract the component using it
into a child and wrap that child in `<Suspense>`. `dev` doesn't catch this — always run `npm run build`
before deploying.

**Vercel Hobby + Supabase Free = $0, no surprise bills.** Hobby cannot incur overage charges (it throttles);
Supabase Free bills only on an explicit Pro upgrade. `NEXT_PUBLIC_*` vars are inlined at build time, so they
must exist in Vercel *before* the build, not just at runtime.

**Red-team with synthetic charts, not Cambridge ones.** To test whether the scoring rubric fires correctly (independent of contamination), generate a chart with known ground-truth values and write an essay with deliberate errors. The model correctly flagged two wrong figures and the opinion sentences in the red-team test, confirming the logic works on novel input.

**JSON fence stripping is required.** Even with explicit "no markdown" instructions, Gemini 2.5 Flash occasionally wraps output in ` ```json ` blocks. The `stripFences` utility handles it; the one-retry fallback handles rarer parse failures.

**Two OCR layouts exist in Cambridge books.** Cambridge 11 puts the examiner comment before the candidate answer in the PDF. The parser detects this by checking how close the comment marker is to the band line. Most other books use answer-first layout.

**Email gate is a deliberate MVP shortcut.** The email is not sent anywhere and resets on page refresh. This is accepted for validation purposes — backend capture is a next step.

---

## Changelog

### 2026-07-03 — Dashboard cleanup + maintenance mode
Plan/review pipeline in `feature-research/dashboard-cleanup/`. All gates green: tsc 0 errors,
eslint 0 errors (2 known warnings), 8/8 tests, build green.
- **Fixed rules-of-hooks violation in `BandTrendChart`** (`useState` after conditional return) and
  rewrote the chart to a single render path (~100 duplicated lines removed). X-axis labels now
  thinned to ~6 (`step = ceil(n/6)`, final point always labeled); dots plot at true date positions;
  an empty series shows the buttons + empty grid instead of vanishing.
- **Fixed `tsc --noEmit`** — `progress.test.ts` typed properly, all `any` casts removed. Note:
  `next build` excludes test files from its typecheck, so this was a dev-signal fix, not a deploy fix.
- **Defense-in-depth:** both dashboard queries now filter `.eq("user_id", user.id)` explicitly on
  top of RLS (guards against a future accidental service-role client swap becoming an IDOR).
- **`SignOutButton` moved to `src/components/`** and reused by the score page header (inline
  duplicate removed). Unused imports in `score/page.tsx` cleaned.
- **`proxy.ts` aligned with the canonical @supabase/ssr pattern** — `setAll` now recreates the
  response after mutating request cookies so refreshed tokens propagate downstream in the same
  request (this also resolves the long-standing `prefer-const` lint error correctly).
- **`MAINTENANCE_MODE=1` kill switch added to `proxy.ts`** (2026-07-02): all `/api/*` → 503, UI
  routes → `/login` redirect, checked before any Supabase call. NOT YET DEPLOYED — Vercel still
  runs the pre-dashboard build.
- **Git + Vercel wiring (2026-07-03):** initial commit pushed to private repo
  `github.com/Albertc11/markready` (origin, HTTPS; creds in git credential store). Vercel project
  `markready` connected to that repo (production branch `main`, Root Directory set to `markready`
  via API — required because the app lives in a subfolder). Env restored in Vercel Production:
  `OPENROUTER_API_KEY`, `OPENROUTER_MODEL=anthropic/claude-haiku-4.5`, plus `MAINTENANCE_MODE=1`.
  **Next `git push` to main auto-deploys** the new build WITH the maintenance gate active
  (`/api/*` → 503). To go live for users: remove `MAINTENANCE_MODE` in Vercel and redeploy.
  Old public repo `Albertc11/ai-exam-coach` is empty of content and unused — delete/archive at will;
  its SSH deploy key does not work for the new repo (pushes use HTTPS). `pdf_pages/` (88MB raw
  copyrighted scans) is excluded from git via root `.gitignore`.

### 2026-07-02 — API abuse hardening (`/api/score`)
Plan/review pipeline in `feature-research/api-abuse-hardening/`. One file changed: `route.ts`.
- **Model override gated:** the `model` body param is now honored only when `NODE_ENV === "development"`
  or `ALLOW_MODEL_OVERRIDE=1`; production silently ignores it. Bake-off/eval scripts against `npm run dev`
  keep working with zero config. Assumption: `NODE_ENV` is `"production"` in all deploy environments
  (Vercel bakes it in; unset fails safe).
- **Daily-cap race closed (placeholder-row pattern):** a submission row (`scores: null`) is inserted
  *before* the ~22s LLM call and updated in place on success / deleted on failure (delete errors logged,
  never surfaced). Cap count excludes null-score rows older than 5 minutes, so a crashed/timed-out
  function's orphan stops burning quota without a cleanup job. Residual race is now milliseconds
  (count→insert); truly atomic enforcement would need a Postgres function — accepted for MVP.
  **Invariant: `scores IS NULL` rows are in-flight/orphaned placeholders — every query against
  `submissions` (dashboard, analytics) must filter `scores is not null`.** (The dashboard feature
  built 2026-07-02 already does.)
- **Server-side size limits:** question ≤ 5,000 chars, essay ≤ 30,000 chars, image data-URI ≤ 2,000,000
  chars (base64 string length, not bytes) → 400 with a readable message. Body validation now runs
  before the cap check, so an over-cap client with an invalid payload gets 400, not 429 (deliberate).
  Also stricter: an image with a non-allowlisted MIME prefix now returns 400 instead of being silently
  dropped (previously scoring proceeded without the image — misleading result).

### 2026-06-26 (session 3, cont.)
- **Built auth + submissions DB + daily cap** (Supabase): magic-link login, `profiles`/`submissions` tables
  with RLS + signup trigger, 10-eval/day cap (429), ban support (`banned_at` → 403). Replaced the old
  frontend-only email gate — auth is now the gate. Plan/review pipeline in `feature-research/auth-db/`.
- **Deployed to Vercel** (Hobby, free) at https://markready-olive.vercel.app. Env vars pushed to Vercel
  production; build verified green; auth gate verified live (`/score`→307, `/api/score`→401). **Dormant** —
  login needs Supabase redirect-URL config (Site URL + `…/**` allowlist), intentionally deferred.
- Two deploy bugs found & fixed: `/login` needed a `<Suspense>` boundary around `useSearchParams`;
  `proxy.ts` was at project root but must be in `src/` (this project uses `src/app`) — it was silently
  ignored, leaving `/score` unprotected until moved.
- Cost posture confirmed **$0**: Vercel Hobby cannot incur overage charges; Supabase Free tier bills only on
  explicit Pro upgrade. No payment methods attached.

### 2026-06-26 (session 3)
- **Switched default model to `anthropic/claude-haiku-4.5`** for the Task 2 MVP (was `qwen/qwen3.6-flash`).
  Same Task 2 accuracy (0.39 MAE), ~3× faster (~22s vs ~64s). Updated `.env.local` and the code fallback in
  `route.ts` (was `google/gemini-2.5-flash` — the worst-accuracy model — now haiku, so a missing env var on
  deploy can't silently pick the weakest model).
- **Measured real per-eval cost** (replacing earlier estimates) via a temporary unauthenticated `/api/measure`
  route (since `route.ts` is now auth-gated): haiku $0.0193, qwen $0.0107. Discovered qwen3.6-flash burns
  ~6,500 reasoning tokens/eval — the real cost gap is 1.8×, not the ~7× previously assumed. Temp route deleted
  after measurement.
- **Re-probed gemini-2.5-pro solo** — confirmed bake-off failures were infrastructural, not quality; still
  ruled out (reasoning model, not cheap/fast on the real prompt).
- **Probed two new June-2026 candidates** — `stepfun/step-3.7-flash` (broke: truncated, no content) and
  `qwen/qwen3.7-plus` (clean JSON but ~50s reasoning model, no latency win). Neither adopted.
- Decision recorded: reserve `qwen/qwen3.6-flash` for Task 1 Academic charts (best T1 MAE 0.32) via future
  task-routing.

### 2026-06-25 (session 2)
- Switched default model to `qwen/qwen3.6-flash` (fair sequential bake-off winner)
- Fixed Turbopack crash on Windows: added `--webpack` flag to `npm run dev`
- Built Task 1 Academic image upload feature:
  - UI: file picker, canvas downscale (max 1024px, JPEG 0.85), thumbnail, remove button; conditional on TASK1_ACADEMIC tab only
  - API: multimodal message to OpenRouter, NO-VISUAL MODE rule-7 override directive, server-side MIME allowlist validation, retry path uses same `effectiveSystemPrompt` + `userContent`
- Fixed tab label: "Task 1 — General" (was "Task 1 — Letter")
- Built red-team test suite: `make_redteam_chart.py` (synthetic chart with known values), `redteam_test.py` (posts flawed essay with image to API)
- Red-team result: model correctly flagged both planted data errors and the opinion sentences; `overview_present` detection is arguable (flagged "Overall, the data suggests..." as an overview despite it being an opinion sentence)

### 2026-06-25 (session 1)
- Built full corpus pipeline: `build_corpus.py`, `split_corpus.py`
- Extracted and OCR'd 7 Cambridge IELTS books into `pdf_pages/`
- Built eval harness: `eval_accuracy.py`, `eval_one.py`
- Built model bake-off: `model_bakeoff.py` — ran 7 models sequentially, results in `bakeoff_results.json`
- Built diagnostic tools: `probe_model.py` (JSON compliance check), `probe_vision.py` (vision capability check)
- API: added `model` override param to `POST /api/score` to support bake-off without server restarts

### 2026-06-24
- Added IELTS Task 1 General (letter) scoring support
- Added IELTS Task 1 Academic prompt with NO-VISUAL MODE clause
- Extended score UI with three-tab task type switcher and per-task sample questions
- Added `overview_present` and `data_accuracy_note` display in results
- Baked strengths-first scoring philosophy and band anchors into all three prompts
- Wired `fewshot.json` calibration injection via `renderCalibration()` in system-prompt.ts

### Pre-history (initial commit)
- Next.js project scaffolded
- IELTS Task 2 scoring prompt (first version)
- `/api/score` route with OpenRouter integration
- Basic score UI (Task 2 only)
- Calibration corpus ingested

---

## Known Gaps

- **Latency:** Addressed for the Task 2 MVP by defaulting to `anthropic/claude-haiku-4.5` (~22s, measured), down from qwen's ~64s. Still above the <15s business-plan target — prompt caching (haiku via Anthropic direct on the ~7.8K static system prompt) and/or reorder-JSON streaming are the remaining levers if needed. qwen (~64s) only re-enters for Task 1 charts.
- **Login not live yet:** Deployment is dormant — Supabase Auth needs Site URL + redirect-URL allowlist set to the Vercel domain before magic-link login works end-to-end. Intentionally deferred until the dashboard/progress feature is built.
- **Eval harness blocked by auth:** `/api/score` now requires a Supabase session, so bake-offs/evals can't POST to it directly. Use a temporary unauthenticated route (as done for the cost measurement) or a session token when re-running evals.
- **Env vars set for Vercel `production` only:** preview/development deploys won't have them until added.
- **Accuracy validation:** Eval set uses published Cambridge essays — contamination risk. §2.5 gate (100 users sharing official results) is the real validation. Red-team test with synthetic chart confirmed rubric logic is sound.
- **Re-eval with images:** `pdf_pages/` has chart PNGs for all 9 TASK1_ACADEMIC eval essays but no `page_map.json` mapping essay IDs to page files. Must be created manually before an image-scored re-eval script can run.
- **`overview_present` detection:** Model flagged "Overall, the data suggests..." as an overview despite it pivoting immediately to an opinion. May need a stricter rule in the prompt.
- **`needs_review` bucket:** Incomplete Cambridge 11 extractions (comment-first essays without a "Dear" boundary) — not used in fewshot or eval
- **No `.env.example`** — required vars (`OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) must be set manually
- **No progress/dashboard yet** — submissions are stored but there's no UI to view history, band trends, or recurring weaknesses (next feature)
