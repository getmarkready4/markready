# Changelog

All notable changes to MarkReady are documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project uses [Semantic Versioning](https://semver.org/). While the app
is pre-1.0, minor versions (0.x.0) group feature work and patch versions (0.x.y)
cover fixes.

## [0.4.0] — 2026-07-15

### Added
- Public landing page at `/` for signed-out visitors: hero, "how it works",
  feature overview, task-type explainer, and legal footer. Signed-in users are
  still routed straight to the scorer.
- "Not sure which?" helper under the task tabs on the score page, explaining
  Task 2 vs Task 1 Academic vs Task 1 General at a glance.

### Fixed
- Restored production scoring, which was returning "Scoring service unavailable".
  The deployed `OPENROUTER_API_KEY` had a UTF-8 BOM prepended (a Windows/PowerShell
  artifact) that broke the `Authorization` header before any request was sent.

## [0.3.0] — 2026-07-14

### Added
- Terms of Service and Privacy Policy pages, publicly accessible and linked from
  a legal footer on the login screen.

### Changed
- Submissions whose content does not match the selected task type (e.g. a Task 2
  essay scored under the Task 1 General letter rubric) are now rejected with a
  clear "switch tabs" message instead of being mis-scored or stored as a band 1.0.
  Rejected attempts consume no daily quota and no longer pollute the dashboard.
- The essay field now clears when switching task tabs, preventing a stale response
  from being scored against the wrong rubric.
- Legal pages point to in-app feedback rather than exposing a personal email.

## [0.2.1] — 2026-07-10

### Security
- Auth callback now allowlists the OTP `type` parameter (`magiclink`/`email`
  only), rejecting unexpected token types.

### Fixed
- Re-added cross-platform SWC optional-dependency metadata to the lockfile.

## [0.2.0] — 2026-07-07

### Added
- Support for all three task types — Task 2, Task 1 Academic (with chart image
  upload), and Task 1 General — each with its own scoring rubric.
- Dashboard analytics segmented by task type, with recurring-weakness tracking.
- Prompt caching and a retry loop on the scoring endpoint.

### Changed
- Hardened `/api/score` with strict input and model-response validation.
- Proxy redirects signed-in users away from `/login` and exempts `/login` from
  the maintenance-mode redirect.

### Security
- Added an untrusted-candidate-text guard to the scoring prompts so instructions
  embedded in a submission cannot influence scoring.

## [0.1.0] — 2026-07-03

### Added
- Initial MarkReady MVP: IELTS Writing Task 2 scoring with examiner-style
  feedback (four criteria, weaknesses, vocabulary upgrades, Band 8 model
  rewrite), Supabase auth, and a progress dashboard.
- Calibration corpus and extraction scripts for Cambridge IELTS sample answers.

[0.4.0]: https://github.com/Albertc11/markready/releases/tag/v0.4.0
[0.3.0]: https://github.com/Albertc11/markready/releases/tag/v0.3.0
[0.2.1]: https://github.com/Albertc11/markready/releases/tag/v0.2.1
[0.2.0]: https://github.com/Albertc11/markready/releases/tag/v0.2.0
[0.1.0]: https://github.com/Albertc11/markready/releases/tag/v0.1.0
