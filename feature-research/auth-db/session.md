# Session Brief: Auth + Submissions DB + Daily Cap

## Goal
Add Supabase auth (magic link), persist every scoring call to a submissions table, enforce a 10-eval/day cap per user, and support immediate account banning. Replaces the frontend-only email gate.

## Critical context for this codebase

- **Next.js version: 16.2.9** — breaking changes vs. what you may know:
  - Middleware is renamed to **Proxy**. File must be `markready/proxy.ts` exporting `export async function proxy(...)`. A file named `middleware.ts` is silently ignored.
  - Proxy defaults to Node.js runtime (good — required for `@supabase/ssr`).
- **Project root**: `markready/` — all paths below are relative to this directory.
- **Do NOT touch**: `src/app/api/score/route.ts` LLM logic (`callModel`, `effectiveSystemPrompt`, `userContent`, retry). Only add auth/cap/insert steps around it.
- **Do NOT commit** `.env.local`.

## Package to install first

```bash
cd markready && npm install @supabase/ssr @supabase/supabase-js
```

## Files to create

### `src/lib/supabase/client.ts`
```ts
import { createBrowserClient } from "@supabase/ssr";

export const createClient = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
```

### `src/lib/supabase/server.ts`
For Server Components only. The silent catch is intentional — `cookies().set()` throws in Server Components because headers are already committed.
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
            // Expected in Server Components — headers already sent
          }
        },
      },
    }
  );
};
```

### `src/lib/supabase/service.ts`
Service-role client for privileged ops. NEVER import in any client-side file. `SUPABASE_SERVICE_ROLE_KEY` must never have `NEXT_PUBLIC_` prefix.
```ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js";

export const createServiceClient = () =>
  createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
```

### `src/app/login/page.tsx`
`"use client"` component. Single email input. On submit calls:
```ts
const supabase = createClient(); // from @/lib/supabase/client — inside component, not module level
const { error } = await supabase.auth.signInWithOtp({
  email,
  options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
});
```
On success show "Check your email for a login link." On error show the error message. No password field. Display any `?error=` query param from the URL as an error message (e.g. `auth_failed` → "Login link expired or already used. Please try again.").

### `src/app/auth/callback/route.ts`
Handles the magic link redirect. Check error on both paths — do not proceed to `/score` on failure.
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
    if (error) return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  } else if (token_hash && type) {
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });
    if (error) return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  } else {
    return NextResponse.redirect(`${origin}/login?error=invalid_link`);
  }

  return NextResponse.redirect(`${origin}/score`);
}
```

### `proxy.ts` (at project root — NOT inside `src/`)
Next.js 16 renamed middleware to proxy. Export `proxy`, not `middleware`.
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
  matcher: ["/score", "/score/:path*", "/api/score", "/api/score/:path*"],
};
```

## Files to modify

### `src/app/api/score/route.ts`

Add these imports at the top:
```ts
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
```

At the very top of the POST handler body (before any existing logic), declare both clients:
```ts
const supabase = await createClient();
const serviceClient = createServiceClient();
```

Then add four steps before the existing LLM logic:

**Step 1 — Auth check:**
```ts
const { data: { user } } = await supabase.auth.getUser();
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
```

**Step 2 — Ban check:**
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

**Step 3 — Daily cap check (10/day, resets at UTC midnight):**
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

**Step 4 — After the LLM call, immediately before `return NextResponse.json(result)`:**

Replace the existing `return NextResponse.json(result)` with:
```ts
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
```

There is only one `return NextResponse.json(result)` in the file — both the first-parse and retry paths converge there. Replace that one line with the block above.

### `src/app/score/page.tsx`

**Imports to add at the top:**
```ts
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
```
(Add `useRouter` if not already imported — check first before adding.)

**Inside the component function body, add:**
```ts
const supabase = createClient(); // inside component, NOT at module level
const router = useRouter();      // if not already present
const [userEmail, setUserEmail] = useState<string | null>(null);
```

**Add a useEffect to load user email on mount:**
```ts
useEffect(() => {
  supabase.auth.getUser().then(({ data: { user } }) => {
    setUserEmail(user?.email ?? null);
  });
}, []);
```

**Add logout button in the page header** (wherever the header/nav is):
```tsx
<div className="flex items-center gap-4">
  {userEmail && <span className="text-sm text-gray-500">{userEmail}</span>}
  <button
    onClick={async () => { await supabase.auth.signOut(); router.push("/login"); }}
    className="text-sm text-gray-500 hover:text-gray-700"
  >
    Sign out
  </button>
</div>
```

**Email gate removal — delete entirely (no dead code):**
- Delete `const [email, setEmail] = useState<string>("")`
- Delete `const [emailSubmitted, setEmailSubmitted] = useState<boolean>(false)`
- Delete `const unlocked = emailSubmitted`
- Delete the entire `{!unlocked && (...)}` JSX block (the email input gate form)
- Find the wrapper div with className `{unlocked ? "" : "select-none pointer-events-none"}` — remove the `className` prop entirely
- Find the inner child div with className like `{unlocked ? "space-y-8" : "opacity-20 blur-sm space-y-8"}` — replace with just `className="space-y-8"` (static only)
- After these deletions, grep for any remaining `unlocked` or `emailSubmitted` references — they are bugs and must be removed

**HTTP error handling in the fetch/submit function:**

After getting the API response, check status before parsing:
```ts
if (res.status === 429) {
  setError("You've reached today's limit of 10 evaluations. Resets at midnight UTC.");
  return;
}
if (res.status === 401) {
  router.push("/login");
  return;
}
```

## Environment variables needed in `.env.local`

The user must add these (implementer cannot do this — it requires the Supabase dashboard):
```
NEXT_PUBLIC_SUPABASE_URL=<Project URL from Supabase dashboard>
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon/public key from Supabase dashboard>
SUPABASE_SERVICE_ROLE_KEY=<service_role key from Supabase dashboard>
```

## Out of scope

- Google OAuth
- Weakness tracking dashboard
- Payment/subscription gating
- Submission history UI
- Admin UI for banning (ban via SQL: `update profiles set banned_at = now() where email = 'x@y.com'`)
