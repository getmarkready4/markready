# Launch hardening round 2 — plan

Branch: continue on `feat/launch-hardening` (round 1 + Next 16.3.5 upgrade are
uncommitted in the working tree).

Three items the founder asked for after round 1:
1. Turnstile CAPTCHA on login
2. Colour contrast AA failures
3. Landing page: remove the Supabase round-trip so it can be CDN-cached

Out of scope, stated so it is not assumed: custom 404, robots/sitemap, analytics,
cookie banner, per-page meta descriptions, single-CTA hero.

---

## Item 1 — Turnstile on login

The gap: `login/page.tsx:65` calls `signInWithOtp` with any email typed in, no
throttle. It can be pointed at a stranger's inbox, and it burns Supabase's SMTP
quota, which locks out real signups. The round-1 rate limiter does NOT cover this
— that call goes browser -> Supabase and never touches our API routes.

Cloudflare Turnstile is free and Supabase supports it natively.

### Requires founder action — cannot be done from here

1. Create a Turnstile site at dash.cloudflare.com -> Turnstile. Gives a **site
   key** (public) and a **secret key** (private).
2. Supabase Dashboard -> Authentication -> Settings -> enable CAPTCHA protection,
   provider "Turnstile", paste the **secret key**.
3. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` in Vercel (and `.env.local`).

**ORDERING MATTERS — call this out in the README.** Set the site key and deploy
FIRST, then enable it in Supabase. If Supabase is enabled while the client is not
sending a token, every login fails. Reverse order is safe.

### Code

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` unset => widget not rendered, no token passed,
login behaves exactly as today. This is the critical safety property: deploying
this code before the founder configures anything must not break login.

- New `src/components/Turnstile.tsx` (client): loads
  `https://challenges.cloudflare.com/turnstile/v0/api.js` once, renders the
  widget, calls back with the token. Must handle: token expiry (Turnstile tokens
  are single-use and expire ~300s) and widget reset after a failed login, or the
  second attempt silently fails with a stale token.
- `login/page.tsx`: render the widget when the site key is set. Pass
  `options: { captchaToken }` to BOTH `signInWithOtp` and `signInWithPassword`.
  `signInWithOAuth` (Google) does NOT take a captchaToken — leave it alone.
  Reset the widget after any failed attempt and after a successful magic-link
  send, since the token is spent.
- Disable submit while the site key is set but no token has arrived yet, so the
  user cannot fire a request Supabase will reject.

REVIEW AMENDMENT — ad-blocker lockout, must handle. If the Cloudflare script is
blocked by a content blocker, fails to load, or the user is offline, the token
never arrives and a submit button gated on it stays disabled forever. That is a
total login lockout, self-inflicted, for a population that overlaps heavily with
privacy-conscious users. Add a timeout (10s) after which the button re-enables
with no token. If CAPTCHA is enforced in Supabase the request then fails with a
clear server error, which is a far better outcome than a dead button. Surface
that error rather than swallowing it.

REVIEW AMENDMENT — `signInWithOAuth` DOES accept `captchaToken` in this version
(auth-js GoTrueClient). The plan's instruction to leave the Google path alone
stands, but not for the reason originally given: the OAuth flow redirects to
Google and Supabase does not apply CAPTCHA enforcement to it, so wiring a token
there adds complexity for nothing.

### CSP — BLOCKING INTERACTION, verified

`next.config.ts` currently has `default-src 'self'` and NO `frame-src`. Turnstile
loads a script from `challenges.cloudflare.com` and renders its challenge in an
iframe from the same origin. Both are blocked today. Must add:
- `script-src ... https://challenges.cloudflare.com`
- `frame-src https://challenges.cloudflare.com`

Do NOT loosen anything else. `frame-ancestors 'none'` stays — that governs who
may frame US, which is unrelated to us framing Turnstile.

REVIEW AMENDMENT — also add `connect-src https://challenges.cloudflare.com`.
Most widget variants make their network calls inside the iframe, which is
evaluated against its own CSP, so the parent `connect-src` is usually not needed
— but it is one token, and the failure mode without it is a silent challenge
failure that is tedious to diagnose. Add it. Confirm during the criterion-5
manual test that the console shows no CSP violations.

Add `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to `.env.example` with the ordering warning.

---

## Item 2 — Colour contrast

Measured against WCAG AA (4.5:1 for text under 18.66px bold / 24px).

### 2a. `#9BA3A8` -> `#667075`

Currently 2.41 on cream, 2.56 on white — fails. Used in 7 places
(login:127,143,160,210; page:103,198; score:685) for the IELTS trademark
disclaimer, the "AI-generated estimates, not official results" line, the "or"
divider, and input placeholders.

`#667075` measures 4.78 on cream, 5.07 on white. Both AA.

DECISION — hierarchy is deliberately compressed. The design has three greys:
`#23282B` body (14.03), `#5B6266` muted (5.85), `#9BA3A8` faint (2.41). A third
tier below AA is not a viable tier. `#667075` at 4.78 stays visibly lighter than
`#5B6266` at 5.85, so the distinction survives, just narrower. Chose `#667075`
over the bare-minimum `#6B7378` (4.55) because a 0.05 margin fails a re-audit the
moment anyone nudges the background.

Note the disclaimer being the least readable text on the site is the specific
thing being fixed — it is a liability disclaimer.

### 2b. `#C97B4A` -> `#8F4E26`

Currently 2.76 on `#F7E9DF` at 11px uppercase — fails. Used in 9 places across 4
files (page:159, score:866, AnnotatedEssay:56,70, GameSummary:55,74,
ScoreReport:274,290,327) on TWO different peach backgrounds, `#F7E9DF` and
`#FDF6F1`, plus cream and white.

`#8F4E26` measures: F7E9DF 5.38, FDF6F1 5.97, cream 6.02, white 6.39. AA on all.
Chose it over `#9E572B` (4.59 worst case) for margin.

`decoration-[#C97B4A]` (AnnotatedEssay:56) is a text-underline colour, decorative
— swap it for consistency, not for compliance.

REVIEW AMENDMENT — adjacent failure found, FLAG DO NOT FIX. `AnnotatedEssay.tsx`
uses `decoration-[#E0B79B]` for the INACTIVE state of the same toggle, and that
colour fails 1.4.11 too. It is outside what was asked and changing it would widen
the diff into untested interactive states. Report it to the founder alongside the
border finding; do not touch it.

### 2c. Borders `#E4DFD3` — DELIBERATELY NOT CHANGED

1.25 on cream. WCAG 1.4.11 wants 3:1 for UI component boundaries. Not changing
them, for reasons that must be stated rather than silently skipped:
- No candidate in the family reaches 3:1 without going olive and heavy
  (`#9C9177` is 3.12 on white but visually much darker).
- 1.4.11 applies to boundaries *required to identify* a component. Every input in
  `login/page.tsx` has a real `<label>` (`:133`, `:150`) plus a placeholder, and
  sits on white against a cream page, so the border is not the sole identifier.
- 70 usages, overwhelmingly decorative card outlines, which 1.4.11 exempts.
Changing input borders but not card borders would also look inconsistent.
FLAG THIS TO THE FOUNDER rather than reporting item 2 as fully clean.

---

## Item 3 — Landing page CDN caching

`page.tsx:49` calls `supabase.auth.getUser()` on every anonymous visit to `/`,
purely to redirect signed-in users to `/score`. Consequences measured live:
TTFB 0.63s, `Cache-Control: private, no-cache, no-store`, route marked `ƒ`
(dynamic), zero CDN caching on a pure marketing page.

Fix:
1. Remove the `getUser()` + `redirect("/score")` from `page.tsx`. It becomes a
   static server component and builds as `○`.
2. Move the signed-in redirect into `proxy.ts`. Add `"/"` to the matcher.

CRITICAL — do not simply add `"/"` to the matcher and call `getUser()` there.
That moves the round-trip, it does not remove it; anonymous visitors would still
pay a Supabase call in middleware. Instead, short-circuit on cookie absence:

- For `"/"` only, first check whether any Supabase auth cookie is present.
  `@supabase/ssr` names them `sb-<project-ref>-auth-token` (possibly chunked with
  a `.0` / `.1` suffix). Match on `name.startsWith("sb-") && name.includes("auth-token")`.

REVIEW AMENDMENT — VERIFIED, DO NOT "FIX" THIS. A review round claimed this
predicate is wrong, on the grounds that `@supabase/auth-js` defines
`STORAGE_KEY = 'supabase.auth.token'`, and proposed matching
`startsWith("supabase.auth.token")` instead. That is incorrect and acting on it
would introduce the exact bug it warned about. `@supabase/ssr` only sets
`storageKey` when `cookieOptions.name` is passed (createBrowserClient.js:38), and
this app does not pass it — but `supabase-js` has already substituted its own
default before auth-js's constant is ever reached:

    const defaultStorageKey = `sb-${baseUrl.hostname.split(".")[0]}-auth-token`

Resolved at runtime against this project's real URL, the storage key is
`sb-edbzutktxyvvbtdozuqk-auth-token`. The predicate in this plan matches it; the
proposed replacement does not match anything and would make the signed-in
redirect dead code.

The test MUST use a realistic cookie name. `proxy.test.ts` currently mocks
cookies as `token.0` / `token.1`, which do NOT match the predicate. A test
written against those names would pass while proving nothing. Use
`sb-testref-auth-token` (and a `.0` chunked variant) in the new test.
- No such cookie => definitively anonymous => `NextResponse.next()` immediately,
  zero Supabase calls, static HTML served from CDN.
- Cookie present => existing `getUser()` path; redirect to `/score` if the
  session is valid, otherwise fall through and serve the landing page.

A stale or forged cookie costs one `getUser()` that returns null and then renders
the landing page — correct, just not free. That is the right trade: the common
anonymous case is free, and correctness never depends on the cookie's contents.

REVIEW AMENDMENT — MAINTENANCE_MODE interaction, decide explicitly. `proxy.ts:12`
redirects every matched non-`/login` UI route to `/login` when
`MAINTENANCE_MODE=1`. Adding `"/"` to the matcher therefore starts gating the
public marketing page behind maintenance mode, which it is not gated by today.
DECISION: that is wrong. The landing page is marketing and should stay reachable
while the app is locked — a visitor during maintenance should see the product,
not a login wall. Exempt `"/"` from the maintenance redirect alongside `/login`.
Add a proxy test asserting `/` is served, not redirected, when
`MAINTENANCE_MODE=1`.

Do NOT extend the cookie short-circuit to `/score`, `/dashboard` or the API
routes. Those must keep calling `getUser()` — presence of a cookie is not proof
of a valid session, and those routes gate real data.

Verify: `npm run build` shows `/` as `○` not `ƒ`; a request with no cookies
returns a cacheable `Cache-Control`; protected routes still 307 to `/login`.

---

## Sequencing

Item 1 touches `login/page.tsx` + `next.config.ts`; item 2 touches colours across
8 files including `login/page.tsx`; item 3 touches `page.tsx` + `proxy.ts`.
Items 1 and 2 collide on `login/page.tsx` -> sequential, 1 then 2.
Item 3 is disjoint and may run any time.

## Tests (Rule 9)

- `src/proxy.test.ts` — extend: anonymous request to `/` performs NO Supabase
  call and is not redirected; request to `/` with an auth cookie and a valid
  session redirects to `/score`; protected routes are unaffected. The no-call
  assertion is the point — it is what makes the page cacheable.
- No test for colour values. A test asserting hex strings encodes nothing about
  why they matter and breaks on every design tweak. Contrast was verified by
  computation and is recorded above.
- Turnstile: no unit test for the widget (third-party script, DOM-heavy, node
  test environment). Verify manually that login still works with the env var
  unset — that is the property that matters and it is a runtime check.

## Success criteria

1. `npm test` green, `npm run lint` 0 errors, `npm run build` succeeds.
2. `grep -rn "#9BA3A8\|#C97B4A" src/` returns nothing.
3. `npm run build` route table shows `/` as `○` (static), not `ƒ`.
4. Production server (`npx next start`): a cookieless `curl -I /` returns 200,
   is NOT redirected, and its `Cache-Control` does NOT contain `no-store` or
   `private`. `/score` still 307s to `/login`; `/api/score` still 401s.
   REVIEW AMENDMENT — honest limit of this check: `next start` cannot prove
   Vercel CDN behaviour. Absence of `no-store` plus a `○` route is necessary but
   not sufficient. Confirming an actual edge cache needs a deploy and two
   requests checking `x-vercel-cache: HIT`. Report criterion 4 as "locally
   verified, CDN pending deploy" — do not claim the CDN result without it.
5. With `NEXT_PUBLIC_TURNSTILE_SITE_KEY` UNSET, the login page renders no widget
   and the sign-in form still submits — proven by loading it, not by reading code.
6. CSP contains `challenges.cloudflare.com` in both `script-src` and `frame-src`,
   and still contains `frame-ancestors 'none'`.
7. README or `.env.example` documents the site-key-before-Supabase ordering.
