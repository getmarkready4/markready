# Plan: Auth + Submissions DB + Daily Cap

## Goal
Add user authentication, persist scoring submissions to a database, enforce a 10-eval/day cap per user, and support immediate account banning. Replaces the current frontend-only email gate (which resets on refresh and cannot enforce anything).

## Success criteria
- [ ] Unauthenticated users cannot reach `/score` or call `/api/score`
- [ ] Users can sign in via email magic link
- [ ] Every successful scoring call is saved to the submissions table
- [ ] `/api/score` returns HTTP 429 when the user has ≥ 10 submissions today (UTC)
- [ ] Setting `banned_at` on a user's profile immediately blocks all future API calls
- [ ] Existing scoring logic (system-prompt.ts, route.ts LLM call) is unchanged

---

## Stack

- **Supabase** — auth (magic link) + Postgres DB
- **`@supabase/ssr`** — official Next.js App Router package (server + client helpers)
- No new ORM — raw Supabase client queries only

---

## Database schema

To be run in the Supabase SQL editor (manual step, documented below).

```sql
-- Extends Supabase's built-in auth.users
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text not null,
  banned_at timestamptz,
  created_at timestamptz default now() not null
);

-- Row-level security: users can only read their own profile
alter table public.profiles enable row level security;
create policy "Users read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- NOTE: No insert policy on profiles is needed. The trigger below uses
-- `security definer`, which runs with the privileges of the function owner
-- (postgres superuser) and bypasses RLS entirely. A missing insert policy
-- will not cause trigger failures.

-- Auto-create profile on signup via database trigger
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Submissions table
create table public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  task_type text not null,
  question text,
  essay text,
  scores jsonb,
  overall_band numeric(2,1),
  created_at timestamptz default now() not null
);

-- Row-level security: users can only read their own submissions
alter table public.submissions enable row level security;
create policy "Users read own submissions"
  on public.submissions for select
  using (auth.uid() = user_id);

-- Index for daily cap query
create index submissions_user_date_idx
  on public.submissions (user_id, created_at);
```

---

## Environment variables

Add to `markready/.env.local` (never commit):
```
NEXT_PUBLIC_SUPABASE_URL=<from Supabase dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<from Supabase dashboard>
```

`SUPABASE_SERVICE_ROLE_KEY` is used server-side only (API routes) to bypass RLS for the daily cap check and submission insert. It must never be prefixed with `NEXT_PUBLIC_` and must never be imported in any client-side file.

---

## Files to create

### `markready/src/lib/supabase/client.ts`
Browser-side Supabase client (uses `createBrowserClient` from `@supabase/ssr`).

```ts
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

### `markready/src/lib/supabase/server.ts`
Server-side Supabase client for **Server Components only** (where `cookies().set()` throws because headers are already committed). The silent catch is intentional and limited to this context — do not use this factory in API route handlers.

```ts
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export const createClient = async () => {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) => {
          try {
            toSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Expected in Server Components — headers are already sent
          }
        },
      },
    }
  );
};
```

### `markready/src/lib/supabase/service.ts`
Service-role client for privileged server-side operations (daily cap, submission insert, ban check). Uses `SUPABASE_SERVICE_ROLE_KEY`. Never import in `src/app/` client components or any file that could be bundled for the browser.

```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createServiceClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
```

### `markready/src/app/login/page.tsx`
Magic link login page. Single email input → calls `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: origin + "/auth/callback" } })` → shows "Check your email" confirmation. No password field.

### `markready/src/app/auth/callback/route.ts`
Handles the magic link redirect. Supabase email OTP uses the `token_hash` + `type` flow by default (not PKCE `code`). The callback must handle the `token_hash` path. `exchangeCodeForSession` also handles `token_hash` in recent `@supabase/ssr` versions — verify this is the case with the installed version; if not, use `verifyOtp` instead.

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as "magiclink" | "email" | null;
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (toSet) =>
          toSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          ),
      },
    }
  );

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) {
      return NextResponse.redirect(`${origin}/login?error=auth_failed`);
    }
  } else {
    // Neither param present — redirect to login with error
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}/score`);
}
```

### `markready/proxy.ts`
**Next.js 16 renamed `middleware` to `proxy` (v16.0.0 breaking change).** The file must be named `proxy.ts` and must export `proxy` (not `middleware`). A `middleware.ts` file will be silently ignored. File location: `markready/proxy.ts` — at the project root alongside `package.json` (or inside `src/` — both are valid per Next.js 16 docs; use project root for clarity). Next.js 16 proxy defaults to the Node.js runtime, which is required for `@supabase/ssr`.

Protects `/score` and `/api/score`. Refreshes the session cookie on every matched request (required by `@supabase/ssr`). Unauthenticated requests to `/score` redirect to `/login`. Unauthenticated requests to `/api/score` return 401 JSON.

```ts
import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          toSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    if (request.nextUrl.pathname.startsWith("/api/score")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (request.nextUrl.pathname.startsWith("/score")) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return response;
}

export const config = {
  // /api/score/:path* included to protect any future sub-routes
  matcher: ["/score", "/score/:path*", "/api/score", "/api/score/:path*"],
};
```

---

## Files to modify

### `markready/src/app/api/score/route.ts`

Add four steps before/after the existing LLM call. Do NOT change `callModel`, `effectiveSystemPrompt`, `userContent`, or the retry logic.

Declare both clients once at the top of the handler, before any of the steps below, so all steps can reference them without hoisting issues:
```ts
const supabase = await createClient();        // from @/lib/supabase/server
const serviceClient = createServiceClient();  // from @/lib/supabase/service
```

**Step 1 — Authenticate (defence in depth):**
Use the server-side client (anon key, reads session cookie) to get the user. Proxy already blocked unauthenticated requests, but verify here too.
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Step 2 — Ban check:**
Use the service client to bypass RLS.
```ts
const { data: profile } = await serviceClient
  .from("profiles")
  .select("banned_at")
  .eq("id", user.id)
  .single();
if (profile?.banned_at) {
  return NextResponse.json({ error: "Account suspended" }, { status: 403 });
}
```

**Step 3 — Daily cap check:**
Compute UTC midnight as an ISO string in JS, then filter by it. This avoids needing `date_trunc` or an RPC call.
```ts
const utcMidnight = new Date();
utcMidnight.setUTCHours(0, 0, 0, 0);

const { count } = await serviceClient
  .from("submissions")
  .select("*", { count: "exact", head: true })
  .eq("user_id", user.id)
  .gte("created_at", utcMidnight.toISOString());

if ((count ?? 0) >= 10) {
  return NextResponse.json(
    { error: "Daily limit reached", reset: "midnight UTC" },
    { status: 429 }
  );
}
```

**Step 4 — Insert submission immediately before returning the result to the client:**

The existing route has two code paths that produce `result`: first-parse succeeds, or the retry parse succeeds. Both converge at a single `return NextResponse.json(result)` at the end of the handler. Place the insert immediately before that single return statement — not after the first parse or after the retry separately — so one insert covers both paths.

```ts
// Immediately before: return NextResponse.json(result);
const { error: insertError } = await serviceClient.from("submissions").insert({
  user_id: user.id,
  task_type: taskType,
  question,
  essay,
  scores: result,
  overall_band: result.overall_band ?? null,
});
if (insertError) {
  console.error("Submission insert failed:", insertError.message);
  return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
}
return NextResponse.json(result);
// Delete the original return NextResponse.json(result) line — it is replaced by the one above.
```

### `markready/src/app/score/page.tsx`

**Email gate removal — delete these items entirely (do not leave dead code):**
- Delete the `const [email, setEmail] = useState<string>("")` state declaration
- Delete the `const [emailSubmitted, setEmailSubmitted] = useState<boolean>(false)` state declaration
- Delete the `const unlocked = emailSubmitted;` line
- Delete the entire `{!unlocked && (...)}` JSX block (the email input gate form, lines ~429–458)
- Find the wrapper `<div className={unlocked ? "" : "select-none pointer-events-none"}>` — remove the `className` prop entirely (the `unlocked` variable no longer exists)
- Find the inner child div that applies blur/opacity when locked — it will look like `<div className={unlocked ? "space-y-8" : "opacity-20 blur-sm space-y-8"}>` or similar. Replace its `className` with just `"space-y-8"` (the static classes only, no conditional)
- Auth IS the gate. The full report (criteria, weaknesses, vocab, model paragraph) must be visible to all authenticated users with no additional blur or opacity condition. Any remaining `unlocked` or `emailSubmitted` references after these deletions are a bug — find and remove them.

**Add Supabase browser client for user display and logout:**
- Add at the top of the file (after existing imports): `import { createClient } from "@/lib/supabase/client";`
- Inside the component function body (NOT at module level — `@supabase/ssr` requires instantiation inside the component): `const supabase = createClient();`
- Add state: `const [userEmail, setUserEmail] = useState<string | null>(null);`
- Add a `useEffect` with empty deps array on mount:
  ```ts
  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);
  ```
- Show `userEmail` in the page header alongside a logout button
- Logout button onClick: `await supabase.auth.signOut(); router.push("/login");`

**Router and error handling:**
- Add `import { useRouter } from "next/navigation"` at the top of the file alongside existing imports
- Add `const router = useRouter()` inside the component function body (if not already present)
- On 429 response from `/api/score`, set error state to: `"You've reached today's limit of 10 evaluations. Resets at midnight UTC."`
- On 401 response from `/api/score`, call `router.push("/login")` — session has expired

---

## Manual setup steps (user does in Supabase dashboard)

1. Create a new Supabase project
2. Run the SQL schema above in the SQL editor
3. Auth → URL Configuration: set Site URL to `http://localhost:3000` (dev), add production URL later
4. Auth → URL Configuration: add `http://localhost:3000/auth/callback` to allowed redirect URLs
5. Auth → Email Templates: verify the magic link template redirects to `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=magiclink` (this is the default)
6. Copy Project URL, anon key, and service role key to `markready/.env.local`

---

## Out of scope

- Google OAuth (add later as a second auth method)
- Weakness tracking dashboard (separate feature)
- Admin UI for banning — ban by running SQL: `update profiles set banned_at = now() where email = 'x@y.com'`
- Payment/subscription gating
- Submission history UI (separate feature, depends on this)

---

## Package to install

```bash
cd markready && npm install @supabase/ssr @supabase/supabase-js
```

---

## Risk: middleware session refresh

`@supabase/ssr` requires middleware to refresh the session cookie on every matched request. If the matcher is misconfigured, server components will see a stale session. The matcher above includes both exact paths and wildcard sub-paths for `/score` and `/api/score`.
