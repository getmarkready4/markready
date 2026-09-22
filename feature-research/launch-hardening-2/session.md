# Session brief — launch hardening round 2

Read `plan.md` in full first. Blocks marked REVIEW AMENDMENT are corrections from
a review pass and override the text above them.

## Goal

Three items. Repo root `C:\Users\User\Desktop\AI exam coach`, Next app in
`markready/`. Stay on branch `feat/launch-hardening` — round 1 and the Next
16.3.5 upgrade are already in the working tree, uncommitted. Do not commit.

1. Turnstile CAPTCHA on login (inert until the founder configures it)
2. Colour contrast: `#9BA3A8` -> `#667075`, `#C97B4A` -> `#8F4E26`
3. Landing page: remove the Supabase round-trip so `/` can be CDN-cached

## Constraints

- **No new npm dependencies.** Turnstile loads from Cloudflare's CDN via a
  script tag. Do not install a React wrapper package.
- **No paid services.** Turnstile is free. Nothing else gets added.
- Match house style: see `src/lib/quota.ts` and `src/lib/score-drafts.ts`. Terse
  JSDoc saying *why*. Fail closed. No speculative abstraction.
- Tests carry `// WHY:` comments per Rule 9 — copy `src/lib/quota.test.ts`.
- Rule 3, surgical. The colour work is a find-and-replace of two hex values, not
  a design pass. Do not restyle anything.

## The one thing most likely to go wrong

The auth cookie predicate in item 3. A reviewer claimed it should be
`supabase.auth.token` and was wrong; I verified the real cookie name at runtime
against this project's Supabase URL:

    sb-edbzutktxyvvbtdozuqk-auth-token

So `name.startsWith("sb-") && name.includes("auth-token")` is correct. The plan
has the full explanation. Do not change it. And do not write the new proxy test
using the existing mock cookie names `token.0` / `token.1` — those do not match
the predicate, so such a test would pass while proving nothing. Use
`sb-testref-auth-token`.

## Key files

| File | What happens |
|---|---|
| `next.config.ts` | Add `challenges.cloudflare.com` to `script-src`, `frame-src`, `connect-src`. Keep `frame-ancestors 'none'`. |
| `src/components/Turnstile.tsx` | NEW. Loads the widget script, returns a token, resets on demand, 10s load timeout. |
| `src/app/login/page.tsx` | Render widget when site key set; pass `captchaToken` to `signInWithOtp` + `signInWithPassword`; reset after every attempt. Also colour swaps. |
| `src/app/page.tsx` | Remove `getUser()` + `redirect()`. Becomes static. Also colour swaps. |
| `src/proxy.ts` | Add `"/"` to matcher; cookie short-circuit; exempt `/` from MAINTENANCE_MODE redirect. |
| `src/proxy.test.ts` | New cases: anonymous `/` makes no Supabase call; `/` with auth cookie + session redirects to `/score`; `/` served under MAINTENANCE_MODE. |
| `src/app/score/page.tsx`, `src/components/AnnotatedEssay.tsx`, `GameSummary.tsx`, `ScoreReport.tsx` | Colour swaps only. |
| `.env.example` | Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` with the ordering warning. |

## Decisions already made — do not relitigate

- `#667075` and `#8F4E26` were chosen by computing WCAG ratios across every
  background they appear on. Do not substitute your own colours.
- Borders `#E4DFD3` are deliberately NOT changed. Reasoning is in the plan.
  Report it as a known exception, not as done.
- `AnnotatedEssay.tsx`'s `#E0B79B` inactive underline also fails. FLAG IT, do not
  fix it — out of scope.
- Turnstile must be completely inert when `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is
  unset. Login must work exactly as today. This is the property that matters most
  — the founder has not configured Cloudflare or Supabase yet, so the deployed
  code will run with it unset.

## Success criteria

Criteria 1–7 at the bottom of `plan.md`. Run `npm test`, `npm run lint`,
`npm run build` from `markready/` and paste real output.

For criterion 5, actually load the login page in a browser or with curl against
`npx next start` and confirm the form still works with the env var unset. Do not
infer it from reading the code.

For criterion 4, report it as "locally verified, CDN pending deploy" — you cannot
prove Vercel edge caching from a local server, and claiming otherwise is exactly
the kind of unverified success the project rules forbid.

Rule 12 applies: if you skip something, say so explicitly. A previous round
reported a test as written when it was not, which cost a full extra cycle. Be
accurate about what you did and did not do.
