# MarkReady memory

## 2026-09-16, Production release approved after Supabase resume

**What was decided:** The user's latest instruction approves the reviewed diff, migration, main commit and production push. Supabase now links and answers queries. GitHub main remains 05d1650; Vercel Fluid Compute is enabled on Hobby, supporting the 240-second route budget. Apply only 20260914125956 in a transaction and record that version, because existing remote migration history differs from the repository.

**Why:** Release the five verified fixes without replaying historical migrations or overlapping old scoring workers. A scoring-only firewall pause and a full five-minute drain precede migration. Reopen only verified new production hosts; keep old deployment scoring blocked until those deployments are updated.

**What was rejected:** Broad site shutdown, historical migration replay, deleting old records, paid scoring smoke tests and unrelated changes. Migration 20260914125956 is now applied and recorded, with server-only permissions verified and all four historical scores preserved. Unit tests/lint/TypeScript/build passed again. Scoring is paused pending deployment verification; final outcome will be recorded afterward.

## 2026-09-16, Five fixes verified and independently approved; production paused

**What was decided:** Implementation is complete locally. Boyle approved the backend and the corrected frontend diff. User has authorised main production rollout; the project workflow still requires human approval of the completed diff. No commit, push or production migration has occurred.

**Why:** Verification passed: 95 unit tests, 11 native PostgreSQL scenarios, 14 rendered Edge scenarios, lint, TypeScript, production build and whitespace checks. The unit/database checks preceded the final frontend-only chart-processing correction; browser/lint/TypeScript/build checks were rerun afterward. Evaluation prompts remain unchanged.

**What was rejected:** Pushing an application that requires missing RPCs, bypassing human diff approval, creating a replacement Supabase project, or claiming production verification. CLI authentication now works for both services. Supabase project oorwwtequaicvtwuprqi is INACTIVE; the link command explicitly reports LegacyProjectPausedError and requires an admin to unpause it from the dashboard. Vercel project markready is prj_iEWt8MeX82pvdVSxp7p2hQPUXZaU in getmarkready-3803s-projects, root markready, production markready-alpha.vercel.app. Runtime duration/Fluid settings still require verification before cutover. See feature-research/reliability-review-fixes/session.md for exact changed files and follow-up.

## 2026-09-14, Implementation and production push authorised

**What was decided:** User approved carrying out the independently reviewed five-fix plan and pushing production on main. This supersedes the earlier local-only restriction. Preserve the evaluation prompts and require verified migration/application cutover, independent diff review and the project's human diff approval gate.

**Why:** Fix the reviewed reliability issues and make the corrections available to users.

**What was rejected:** Pushing code against an unprepared database, overlapping old unfenced scoring workers with new reservations, and claiming concurrency verified solely through mocks. Production credentials/access still need verification.

## 2026-09-14, Reliability fixes proposed; implementation approval pending

**What was decided:** The user requested recommended fixes and a commit to main. A five-fix implementation plan was prepared and independently reviewed successfully. Project workflow requires human plan approval before code and human diff approval before the local commit. Implementation has not started.

**Why:** Protect scoring accuracy, learner drafts, daily quota integrity and login sessions without changing the tested evaluation prompts. See feature-research/reliability-review-fixes/plan.md and session.md for the exact proposal and verification requirements.

**What was rejected:** No broader redesign, chart-history storage, new AI layer, payment work, push, deployment or production migration in this batch. Local database testing is required for quota concurrency but setup is not yet approved; no Supabase/psql/Docker executables were found on PATH.
