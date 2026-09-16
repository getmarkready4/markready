# Implementation brief: reliability review fixes

Date: 2026-09-16
Status: implementation and independent full diff review complete; human approved commit and production push after resuming Supabase on 2026-09-16. Production cutover in progress. Earlier implementation instructions below are historical context.

## Goal

Implement the five concrete review findings and verify. Obtain independent diff review; surface the completed diff for the human approval gate required by AGENTS.md. The user has explicitly requested a main production push. Verify production access and migration compatibility before pushing anything that deploys.

## Required context

Read plan.md in this directory completely, especially Reviewer resolutions. It is the approved technical proposal and defines scope, files, migration lifecycle, tests and rollout constraints. Read root AGENTS.md, markready/AGENTS.md, applicable Supabase/Postgres skills and local Next.js documentation before implementation. Orchestrator plans; implementer implements only the approved plan; reviewer never edits.

## Current state and constraints

- Local main and GitHub main both verified at 05d16506b24d339959ad9f6212b420da9b0651ee on 2026-09-14. Recheck before starting.
- No tracked code changes were present. Preserve unrelated untracked .claude/settings.local.json, .codex, root AGENTS.md and existing research documents.
- Preserve system-prompt.ts byte-for-byte; no additional model calls or model changes. Keep one successful mark per UTC day and staff unlimited.
- Scope: strict four-criterion validation, account-isolated drafts and quota-aware UI, atomic leased reservations with fenced completion, task-specific tips, refreshed cookies/cache headers.
- No Supabase CLI, psql or Docker executable found on PATH. User approved the plan including local database setup/testing; real concurrency verification remains a completion requirement.
- Main orchestrator handles production access, deployment and commits. Implementer must not push, deploy, run production migrations, send email, or call a paid model. No historical data deletion. Only approved local tooling/test setup is in scope.
- Workspace permissions are read-only; use supported approval mechanisms for denied writes/tests/commit operations. Plan documents were created successfully with apply_patch.
- Run focused/full tests, lint, TypeScript and build; surface every unavailable check. Independent reviewer approved the plan, not any implementation.

## Handoff

### Release checkpoint (2026-09-16)

Human approved the reviewed diff and production release. Supabase linked successfully after resume. Vercel project has Fluid Compute enabled on Hobby (300-second maximum; new route requests 240). Scoring-only firewall rule `Scoring release cutover` was activated at 09:29 UTC, confirmed HTTP 403, and the five-minute drain elapsed before migration. Other pages remain accessible.

Applied only migration 20260914125956 in a transaction with its history entry. Existing remote history contains 20260907160144, so old repository migrations were not replayed or repaired. Verified all four RPCs are SECURITY INVOKER, executable by service_role but not anon/authenticated; four existing submissions and four completed scores remain intact. Final rerun passed 95 unit tests, lint, TypeScript, production build and whitespace checks. Prompt remains unchanged.

Pre-existing advisor warnings (not modified): handle_new_user SECURITY DEFINER execution grants to anon/authenticated and disabled leaked-password protection. Vercel production secrets cannot be exported by env run; local .env.local is not the production project, so no smoke requests were sent to that local target. Production release still requires deployment readiness, live API verification and narrowing the firewall to exclude verified production hosts. Old preview/deployment scoring must stay blocked until updated to leased code; do not remove this safeguard or roll back without another pause/drain.

### Latest checkpoint (2026-09-16)

All five fixes implemented. Backend compile error fixed; saved scores survive allowance-read failures. Reviewer found and implementer corrected a custom-image processing/submission race. Boyle approved the final combined diff.

Passed: 95 unit tests; 11 native PostgreSQL scenarios using repository SQL and route code (including repeated concurrent requests, stale workers, cross-midnight usage, permissions, cleanup and lost-response recovery); 14 rendered Edge scenarios; lint; TypeScript; production build; whitespace checks. PostgreSQL harness uses synthetic auth/model and a pg adapter, not live PostgREST HTTP. Unit/DB tests preceded the final frontend-only correction; browser/lint/TS/build were rerun afterward. Review was read-only and did not duplicate the implementer's executions. No prompt diff.

Production access verified: Supabase lists oorwwtequaicvtwuprqi as INACTIVE; CLI link returns LegacyProjectPausedError with admin dashboard unpause instruction. Vercel whoami is getmarkready-3803; correct project/production URL verified. CLI database read preflight has not succeeded: --project-ref requires --linked, then IPv6 preflight requested linking, and linking exposed the paused-project blocker. Use npx.cmd in the user's PowerShell (npx.ps1 is blocked by execution policy).

Next: user resumes https://supabase.com/dashboard/project/oorwwtequaicvtwuprqi and approves the reviewed diff. Recheck remote main and project health; verify runtime supports maxDuration=240; inspect existing schema/migration state without reading essays; arrange maintenance/drain of ALL old scoring deployments. Apply only the reviewed additive migration, verify service-only RPCs through the actual production access path, stage scoped source/test/migration/documentation files only, commit and push main, verify the deployment, then reopen scoring. Do not stage .codex tooling, credentials, Supabase .temp, unrelated research or user AGENTS files. Do not blindly replay old migrations. No historical records may be deleted.

### Exact application/test file manifest

- markready/src/app/api/profile/route.ts: shared allowance snapshot and reset/lease fields.
- markready/src/app/api/profile/route.test.ts: allowance/auth regression coverage.
- markready/src/app/api/score/route.ts: atomic reservations, bounded model calls, strict validation and safe recovery.
- markready/src/app/api/score/route.test.ts: route validation, quota and failure-recovery tests.
- markready/src/app/score/page.tsx: account-isolated drafts, allowance-aware actions, upload/submit guards.
- markready/src/app/upgrade/page.tsx: draft return and daily reset wording.
- markready/src/components/GameSummary.tsx: task-aware general practice tip.
- markready/src/lib/feedback-copy.ts: separate letter/chart advice.
- markready/src/lib/feedback-copy.test.ts: task-aware advice tests.
- markready/src/lib/parse-scoring.ts: require correct four criteria for selected task.
- markready/src/lib/parse-scoring.test.ts: incomplete/wrong/valid criterion tests.
- markready/src/lib/quota.ts: validated shared database allowance definition.
- markready/src/lib/quota.test.ts: allowance semantics and invalid-response tests.
- markready/src/lib/score-drafts.ts: account/task draft storage and visible storage-failure handling.
- markready/src/lib/score-drafts.test.ts: draft preservation/isolation tests.
- markready/src/proxy.ts: preserve refreshed cookies and cache headers on every response path.
- markready/src/proxy.test.ts: session response regression tests.
- markready/supabase/migrations/20260914125956_leased_scoring_reservations.sql: additive lease column/index and restricted reservation/usage/completion/release functions.
- markready/scripts/quota-postgres-regression.mjs: local real-Postgres and route concurrency harness.
- markready/scripts/score-ui-regression.mjs: synthetic-auth rendered browser harness.

Documentation changed: root MEMORY.md, ERRORS.md, and this directory's plan.md/session.md. These changes and generated tooling are uncommitted. The task exceeded the default 4,000-token budget, surfaced during implementation; this checkpoint preserves the verified state.

## Parallel implementation ownership

- Backend implementer Poincare owns parser/API/quota/migration/feedback/proxy and their tests. Do not edit score/page.tsx, upgrade/page.tsx or draft helpers/tests.
- Frontend implementer owns score/page.tsx, upgrade/page.tsx, draft helpers/tests and local UI regression harness only. No backend/feedback/proxy edits.
- API contract for frontend: GET /api/profile retains cohort and remaining (null only for staff), adds used_successful (number), active (boolean), lease_expires_at (ISO string or null), reset_at (ISO next UTC midnight). Backend score uses 409 code request_active for another pending request, 403 quota_exhausted for completed daily quota, and returns current allowance on success. Refresh profile after response. Never infer staff from missing quota data.
- Tools: npx --yes supabase@2.117.0; native PostgreSQL and pg packages in E:/Projects/MarkReady/.codex/reliability-tools-20260914/node_modules. Playwright runner in E:/Projects/MarkReady/.codex/reliability-browser-tools-20260914/node_modules. Browser download was declined: DO NOT download browsers. Installed Edge exists at C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe and Chrome at C:/Program Files/Google/Chrome/Application/chrome.exe; local tests may use installed browsers without modifying the user's profile. Use isolated browser contexts and synthetic/mocked auth only, no paid or production calls. Request required execution approvals.

List exact files changed and checks performed. Stage scoped files only after diff approval. No code or commits have been made during planning. Root MEMORY.md records this pending decision; update it after human approval rather than treating the proposal as already authorised.
