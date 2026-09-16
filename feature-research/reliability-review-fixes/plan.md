# Plan: scoring reliability and safe repeat practice

Date: 2026-09-14
Status: implemented, independently reviewed, human approved and released to production on 2026-09-16. See session.md for deployment evidence, tests and follow-up.
Baseline: local main at 05d1650. Recheck GitHub before implementation; preserve unrelated work.

## Scope and authority

Implement the five concrete findings from the September review, test, obtain diff approval, then commit and push main for production as explicitly requested on 2026-09-14. Production migration/deployment must follow the controlled cutover below and requires authenticated service access. Do not send emails or call the paid scoring service as part of verification. Preserve all evaluation prompts byte-for-byte. No new model calls, redesign, payment work, or chart-history storage in this batch.

## Changes

1. Score validation: pass the selected task type to the parser. Require exactly the expected four criterion keys and valid finite bands; reject missing, unknown, duplicate task-response/achievement, and invalid criteria instead of averaging a partial result. Preserve legitimate existing score conventions. Invalid results follow the existing bounded retry and cleanup path. Validate request bodies before destructuring null.
2. Drafts and allowance: load current profile allowance before enabling scoring, distinguish loading/error/staff from zero remaining, and refresh usage after scoring and on return to the tab/day reset. Keep quota errors inline instead of navigating away from an unsaved essay. Save drafts per authenticated user and task in tab-scoped sessionStorage, including question selection and custom image where capacity permits. Restore before saving; handle unavailable/full storage visibly without clearing in-memory work. Do not share drafts across accounts. Explicit task switching or repeat-practice actions must not silently discard drafts. Disable duplicate submission before asynchronous chart conversion. After quota is spent, show review/draft actions rather than inviting another scored attempt; show a local reset time. Server enforcement remains authoritative.
3. Atomic quota: replace insert-then-count with a service-only database reservation function using a short per-user lock, checking successful marks plus active reservations before inserting. Keep staff unlimited and the UTC-day rule. Distinguish an active request from a spent mark. Define a bounded reservation lease; expired workers must be prevented from saving scores after a replacement reservation is granted. Release only the current unfinished reservation on every terminal failure, including persistence errors. Never delete a completed score after an uncertain database response. No transaction spans a model call. Prepare an additive migration with explicit function privileges; no client/anonymous execution. Document migration-first rollout and fail closed if the function is missing. Preserve existing historical submissions.
4. Task-aware feedback: pass task type to nextAction so letters get purpose/bullet-point/tone guidance and Academic Task 1 retains overview guidance. Label non-diagnostic criterion advice as a general practice tip. Do not rewrite the model's report or evaluation prompt.
5. Session redirects: copy refreshed cookies and Supabase cache-control headers to every returned redirect/error response after session refresh. Preserve getUser validation and current onboarding/staff behaviour. Avoid copying internal Next.js routing headers.

## Expected files

- markready/src/lib/parse-scoring.ts and its tests; immediate callers only where needed.
- markready/src/app/api/score/route.ts and its tests.
- markready/src/lib/quota.ts and focused tests.
- markready/src/app/api/profile/route.ts where quota state/reset information requires it.
- markready/src/app/score/page.tsx; small draft helper and focused tests if necessary.
- markready/src/app/upgrade/page.tsx only for reset/practice copy consistency.
- markready/src/lib/feedback-copy.ts, components/GameSummary.tsx and focused tests.
- markready/src/proxy.ts and focused tests.
- One new Supabase migration, generated with the CLI; local SQL integration tests where supported.
- feature-research/reliability-review-fixes/{plan,session}.md and MEMORY.md.

## Verification / acceptance

- Partial Band-9 payload rejected; valid Task 2, Academic Task 1 and General Training results accepted. Null body returns 400. Evaluation prompt git diff is empty.
- Draft survives reload, quota rejection and reauthentication as the same account; account changes cannot display another user's draft. Storage failure is visible. Task/chart pairing survives restore; double-click sends one request.
- Zero allowance is visible before submission and does not prevent reviewing or drafting. Staff remain unlimited. Refresh at UTC reset enables the next mark without discarding drafts.
- Two concurrent reservations allow one model call, not two rejections; terminal failures release allowance. Stale worker cannot complete after lease expiry/replacement. Midnight boundary and existing successful submissions retain correct quota. Uncertain completion cannot delete a saved result.
- Letter tips never request a chart overview. Redirects retain every refreshed cookie and cache headers.
- Run focused tests, full Vitest, lint, TypeScript and production build. Database concurrency needs real local Postgres integration, not just mocked counts. Report any unavailable check explicitly; no production testing without separate permission.
- Independent diff review, human approval, stage only scoped files, commit to main. Production push authorised by latest user message; do not push before the database is ready and old scoring workers are drained.

## Prerequisites and open constraints

Workspace is read-only: writing plans/code, generated files and commits needs tool approval. No local Supabase configuration was found in the current file inventory; verify available CLI/Postgres before promising integration coverage. Database migration execution (including a local test database) requires separate permission under project rules. Reviewer must confirm the lease/completion design before implementation. Read local Next.js docs and current Supabase docs before writing framework/auth code.

## Alternatives

- Selected by user: the five-fix batch above, including a verified production cutover and main push.
- Smaller alternative: validation, draft/UI, letter tips and cookies first; defer atomic quota until a test database is available. This leaves finding 3 unresolved and must be reported as partial completion.

## Reviewer resolutions (2026-09-14)

- Reservation lifecycle: use the submission UUID as reservation identity plus a nullable database-generated reservation_expires_at column. Use a five-minute lease, two maximum 90-second model calls, SDK automatic retries disabled, and a 240-second route budget (deployment support must be checked before rollout). Reserve, complete and release functions use the same transaction-scoped per-user lock and SECURITY INVOKER with service-role-only execution. Completion checks user, UUID, null scores and database-clock expiry, returning the saved row or an explicit rejection. Release only affects that user's unfinished UUID; never completed scores. After an uncertain completion response, read that UUID: return a confirmed completed result; otherwise release conditionally through the locked function. If the database remains unavailable, report an uncertain outcome with dashboard recovery rather than promise quota was released. Lease expiry eventually restores availability. Never return a computed score as saved without database confirmation.
- Rollout: this migration differs from 0004. Do not execute rollout in this task. Later, with separate approval, pause scoring, stop new traffic to old scoring deployments and drain all old executions (verify deployed maximum duration), apply the additive migration, deploy the new application, verify and reopen scoring. Old unfenced workers must not overlap new workers. Preserve historical successful rows; existing unfinished rows without a lease are inactive after the drain and cannot be completed by the new code. Rollback keeps the additive schema, pauses/drains workers first, and never resumes mixed versions. No destructive schema rollback.
- Privacy: subscribe to auth changes; immediately hide/reset account-bound page state when identity changes or becomes unknown. Fence all restore/profile/scoring/image callbacks with an account-generation identifier and discard stale results. Same-user reauthentication restores that user's draft only. Different users never receive another user's draft or response, including cross-tab account changes.
- Allowance: use one database usage definition for both profile reads and reservation writes: completed rows created on the current UTC day plus every unexpired leased pending row, including yesterday's active work. Completed work is charged to the reservation start day, preserving existing created_at semantics; yesterday's in-flight work blocks overlap until completed/released/expired, after which today's mark is available. Return used-successful, active state, lease expiry and next UTC reset. UI refreshes on visibility return, reset and lease expiry, while errors remain distinct from zero quota. Remove the old five-minute created_at heuristic from quota reads.
- Cookies: capture the SDK setAll second-argument cache headers and preserve cookies plus these headers on normal NextResponse.next responses as well as redirects/errors. Test every response class; do not copy internal routing headers.

These are proposed implementation decisions, subject to human approval. Real local Postgres testing is a completion prerequisite; no Supabase, psql or Docker executable was found on PATH during planning. If no approved local test setup becomes available, stop and report the quota portion unverified rather than declare the batch complete.
