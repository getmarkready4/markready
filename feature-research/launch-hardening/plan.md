# Launch hardening — plan

Branch: `feat/launch-hardening` off `main` @ a063f7a

Five items, requested by the founder after the 2026-09-22 launch-readiness audit.
Next.js 16.2.9 -> 16.3.5 is deliberately NOT in this batch (not requested).

Out of scope, stated so it is not silently assumed: Turnstile/CAPTCHA, custom 404,
robots/sitemap, analytics, contrast fixes, landing-page caching.

---

## Item 1 — Security headers (`next.config.ts`)

Today `next.config.ts` is empty; the live response carries only Vercel's default
`Strict-Transport-Security`. Add an `async headers()` block applying to all routes:

| Header | Value | Why |
|---|---|---|
| `X-Frame-Options` | `DENY` | Login page is currently framable |
| `X-Content-Type-Options` | `nosniff` | MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Don't leak paths off-site |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | App needs none of these |
| `Content-Security-Policy` | see below | Clickjacking + injection hardening |

CSP — deliberately permissive on scripts/styles, strict everywhere else:

    default-src 'self';
    script-src 'self' 'unsafe-inline' 'unsafe-eval';
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: blob:;
    font-src 'self';
    connect-src 'self' <NEXT_PUBLIC_SUPABASE_URL origin> <same origin as wss:>;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
    object-src 'none';

DECISION: no nonce-based strict CSP in this batch. Next inlines both scripts and
styles; a nonce CSP requires threading a nonce through `proxy.ts` and risks
breaking hydration. The directives above still kill clickjacking, base-tag
injection, form exfiltration and plugin embedding — the realistic risks — at zero
breakage cost. Nonce CSP is a follow-up.

`img-src` needs `data:` and `blob:` — the Task 1 chart upload previews a
base64 data-URI (score/page.tsx:760) and client-side downscaling uses a canvas/blob.
`connect-src` must include the Supabase origin: the browser client talks to
Supabase directly. Derive it from `NEXT_PUBLIC_SUPABASE_URL` at config load so it
cannot drift; fall back to `https://*.supabase.co` if the var is unset.

REVIEW AMENDMENT — `wss:`: reviewer claimed a missing `wss://` would break auth.
Checked: `onAuthStateChange` (score/page.tsx:293) is a local event emitter, and
there is no `.channel()` call anywhere, so supabase-js opens no WebSocket today.
Not a current break. Add the `wss://` origin anyway — it costs one token and
avoids a silent breakage the day anyone adds Realtime.

REVIEW AMENDMENT — `X-Frame-Options` alongside `frame-ancestors 'none'` is
intentional and redundant-by-design: `frame-ancestors` supersedes it in CSP2+
browsers, XFO covers the rest. Keep both, say so in a comment.

REVIEW AMENDMENT — `Permissions-Policy`: dropped `interest-cohort=()` from the
original plan. It is a non-standard, now-dead FLoC directive, and an unrecognised
token risks the whole header being ignored. Keep only camera/microphone/geolocation.

REVIEW AMENDMENT — env at config load: `next.config.ts` is evaluated in Node at
build time, and Vercel injects `NEXT_PUBLIC_*` into the build environment, so
reading `NEXT_PUBLIC_SUPABASE_URL` there works. Guard it anyway: if the var is
missing or unparseable, fall back to the wildcard rather than emitting a broken
CSP directive.

Verify: `curl -I` every header present; load `/score` signed-in and confirm no CSP
violations in the console and that chart upload still previews.

---

## Item 2 — Rewrite privacy + terms

Both pages currently render a generic Shopify-style ecommerce template. Evidence:
privacy/page.tsx:50 collects "shipping address", :52 "items you ... add to your
wishlist"; terms/page.tsx:69 restricts "dealers, resellers or distributors", :108
"product shipping charges, transit times". Privacy hardcodes the alpha Vercel URL.

NOTE: both files carry a header comment saying the text was supplied by the
founder and is rendered verbatim. This change overrides founder-supplied text.
That comment must be replaced, not left lying.

Keep the page chrome exactly as it is — header, footer, `<main>`, every CSS class
and the render JSX are untouched. Only the `SECTIONS` data arrays and the
`metadata` export change.

REVIEW AMENDMENT — terms needs lists. `terms/page.tsx:12` is
`{ heading: string; paragraphs: string[] }`, paragraphs only, while privacy
already has a richer `Block` union with `ul`. The new terms content (data
collected, subprocessors, what a mark pack includes) is naturally a list.
EXPLICITLY PERMITTED: widen the terms `Section` type to privacy's `Block` union so
both files share one shape. This is a type change, not a chrome change.

REVIEW AMENDMENT — `withPolicyLinks()` stays and stays used. Confirmed the
placeholders appear in the content, not just the function, and the rewritten
terms will still link the refund and privacy policies. Do not leave it dead; if
the rewrite ends up not using a placeholder, delete that branch.

Content to REMOVE: shipping/delivery, physical goods, wishlists/carts, returns and
exchanges of goods, resellers/distributors, order cancellation, product pricing
errors, third-party "social media widgets".

Content to ADD / CORRECT:
- What is actually collected: email, auth identity (Google OAuth or magic link),
  essay + prompt text, uploaded Task 1 chart images, band scores, target band,
  referral source, upgrade interest.
- **LLM subprocessor disclosure** — essays and chart images are transmitted to
  OpenRouter and the model provider for scoring. This is the single most important
  missing disclosure and is currently absent entirely.
- Supabase as auth/database subprocessor; Vercel as hosting.
- AI-output disclaimer: estimates, not official IELTS results.
- IELTS trademark non-affiliation (already in the footer; belongs in terms).
- Mark packs: $20 / 20 marks / 30-day expiry, and link the no-refunds policy.
- Account deletion / data access request route.
- Contact: `getmarkready@gmail.com` (already in terms:173).

Cookies: KEEP the cookie/pixel/tracking language. Founder confirmed these are
planned. Phrase as "we use" for the essential auth cookies that exist today and
"we may use" for analytics/pixels, so the policy stays true now and does not need
rewriting when they land. Add a line that a consent mechanism will gate
non-essential cookies when introduced.

Replace the hardcoded `markready-alpha.vercel.app` with the same resolved site URL
helper introduced in Item 5.

Both pages get `description` metadata while we are in there (audit item 6, cheap).

DECISION: this is drafted as plain-language product-accurate copy, NOT as legal
advice. Plan flags that it needs a lawyer's review before it is relied on.

---

## Item 3 — Rate limiting

`/api/score` is ALREADY effectively limited: `reserve_scoring` enforces the
lifetime/daily/pack allowance atomically and returns `request_active` (409) on a
concurrent request. No money can be burned past quota. Do not re-limit it.

The real gap is `/api/profile` (GET + POST) and `/api/target-band` (POST): a
signed-in user can hammer these without limit. Each is a DB round-trip plus a
billable function invocation.

New `src/lib/rate-limit.ts`: fixed-window counter in module memory, keyed by user
id. `checkRateLimit(key, limit, windowMs) -> { ok, retryAfterSeconds }`. Prune
expired entries on write; cap the map size so a burst of distinct users cannot
grow it unboundedly.

Applied: `/api/profile` GET 30/min, POST 10/min; `/api/target-band` POST 10/min.
Over limit -> 429 with `Retry-After`.

DECISION: per-instance in-memory, not Redis/Upstash and not Postgres.
- Redis/Upstash introduces a paid third-party service. Not doing that unasked.
- Postgres-backed rate limiting to protect Postgres from load is circular, and
  needs a migration that must be hand-applied to production.
- These endpoints are authenticated, so the threat is one logged-in user looping.

Keyed on user id, so rate limiting happens AFTER the `getUser()` auth check.

REVIEW AMENDMENT — state the guarantee honestly. The original plan said Vercel
"routes a warm user's burst to the same instance, which this catches." That
overstates it: Vercel can fan one user across several warm instances
simultaneously, and a cold start resets the counter entirely. The real guarantee
is per-instance only. The module comment must say exactly that — "a single user
can exceed this limit by the number of concurrent instances, and a cold start
resets it" — so nobody later mistakes this for a real quota. It is a cheap brake
on accidental client loops and casual hammering, not an access control. Anything
that must be enforced exactly belongs in Postgres, like the scoring quota already is.

---

## Item 4 — Bound the body before parsing (`/api/score`)

route.ts:162 does `await req.json()` on an unbounded body; the 2,000,000-char
image cap is not checked until :236.

REVIEW AMENDMENT — corrected threat model. The original plan said "a 50MB POST is
fully buffered". That is wrong: Vercel rejects request bodies over 4.5 MB at the
platform edge before the function is invoked, so the true unbounded window is
0–4.5 MB, not 0–50 MB. The cap is still worth adding — it enforces the app's own
2MB-image contract, returns the app's error shape instead of a platform error,
and stops a ~4.5 MB JSON parse burning function memory and CPU on every request —
but the code comment must state the real relationship rather than implying the
app is the only thing standing between you and a 50 MB upload.

Add `readJsonCapped(req, maxBytes)`:
1. Reject early if `Content-Length` exceeds the cap.
2. Read `req.body` through its reader with a running byte counter; abort the
   moment the counter exceeds the cap. Do not trust `Content-Length` alone — it is
   absent under chunked transfer encoding and client-supplied either way.
3. Decode and `JSON.parse`; malformed JSON keeps returning the existing 400.

Cap: 3 MB. The largest legitimate body is a 2,000,000-char image data-URI plus a
30,000-char essay plus a 5,000-char question. Base64 and the JSON envelope are
ASCII, so 1 char = 1 byte; ~2.04 MB worst case. 3 MB clears it with headroom and
sits under Vercel's 4.5 MB platform cap.

Over-cap returns 413 with the existing error shape. Must land BEFORE the
`reserve_scoring` call so an oversized body never consumes a reservation. It runs
after auth, so it cannot be used as an unauthenticated memory-exhaustion vector.

REVIEW AMENDMENT — BLOCKING, test mock. `route.test.ts:172` is
`{ json: async () => body } as unknown as NextRequest` — no `headers`, no `body`
stream. A streaming `readJsonCapped` calls `req.headers.get(...)` and
`req.body.getReader()` and would throw on that mock, breaking every one of the
existing tests that use `createRequest`, not just the new one.

Resolution, both required:
1. Put `readJsonCapped` in its own module, `src/lib/read-json-capped.ts`, and unit
   test it directly against real `Request` objects with real bodies. That is where
   the byte-counting behaviour is actually proven.
2. Update `createRequest` in route.test.ts to build a real `Request` (it has a
   genuine `headers` and `body`) rather than a bare object literal, so the route
   tests exercise the real path. Verify all pre-existing tests in that file still
   pass unchanged — if any regress, the mock change is wrong, not the tests.

Do NOT special-case the parse to keep the old mock working. That would make the
tests pass while testing a path production never takes.

---

## Item 5 — OG / Twitter card + social preview image

Live check confirms zero `og:` or `twitter:` tags and no canonical on any page.
Links shared to the stated GTM channels render as a bare box.

1. `src/lib/site-url.ts` — resolve the canonical origin:
   `NEXT_PUBLIC_SITE_URL` -> `VERCEL_PROJECT_PRODUCTION_URL` -> alpha URL fallback.
   Shared with Item 2. Add `NEXT_PUBLIC_SITE_URL` to `.env.example`.
   REVIEW AMENDMENT: `VERCEL_PROJECT_PRODUCTION_URL` is NOT `NEXT_PUBLIC_*`, so it
   is `undefined` in any client bundle. This helper is server-only. Both consumers
   (`layout.tsx` metadata, the legal pages) are server components, so this is fine
   — but the file must carry a `// Server-only` comment naming the footgun, since
   importing it into a `"use client"` component would silently yield the fallback.
2. `layout.tsx`: add `metadataBase`, `openGraph`, `twitter: { card: "summary_large_image" }`,
   `alternates.canonical`. Fix the stale description — it says "Task 2 essays"
   but the app scores three task types.
3. `src/app/opengraph-image.tsx` — 1200x630 via `next/og` `ImageResponse`, using
   the existing brand colors (`#FAF8F3` bg, `#1F5C4E` green, `#23282B` text).
   DECISION: generated, not a checked-in PNG — no raster assets in the repo today
   and `next/og` ships with Next, so this adds no dependency and nothing to compress.
4. `twitter-image.tsx` re-exports the same.
   REVIEW AMENDMENT: Next requires all four exports, not just `default`. Must be
   `export { default, alt, size, contentType } from "./opengraph-image"` —
   re-exporting `default` alone produces wrong card metadata or a build error.

Verify: fetch `/opengraph-image` and confirm 200 + `image/png`; confirm the tags
render in the served HTML.

---

## Sequencing

Items 1, 2, 5 touch disjoint files and may run together.
Items 3 and 4 both touch API route code -> sequential, 3 then 4.

## Tests (Rule 9 — encode WHY)

- `src/lib/rate-limit.test.ts` — allows up to the limit, blocks past it, window
  resets, distinct keys are independent, map does not grow unboundedly.
- `src/app/api/score/route.test.ts` — extend: oversized body returns 413 and
  never calls `reserve_scoring` (the point is quota is not consumed).
- `src/lib/site-url.test.ts` — env precedence, and trailing-slash normalisation.
- Legal pages: no test. Prose has no business logic; a snapshot test would
  encode nothing about why the text matters and would fail on every wording edit.

## Success criteria

1. `npm test` green; `npm run lint` clean; `npm run build` succeeds.
2. `curl -I` shows all five headers.
3. Signed-in `/score` has zero CSP console violations; chart upload still previews.
4. Oversized POST to `/api/score` -> 413, no reservation row created.
5. `/opengraph-image` -> 200 image/png; og+twitter tags in served HTML.
6. `grep -ri "shipping\|wishlist\|reseller" src/app/privacy src/app/terms` -> empty.
7. Privacy contains an explicit OpenRouter/LLM subprocessor disclosure.
8. REVIEW AMENDMENT: `git diff` on the two legal pages shows changes confined to
   the `SECTIONS` arrays, the `metadata` export, the file-header comment and (for
   terms) the `Section` type widening. No CSS class, no JSX structure, no chrome.
9. REVIEW AMENDMENT: every pre-existing test in `route.test.ts` passes unchanged
   after `createRequest` is rebuilt on a real `Request`.
