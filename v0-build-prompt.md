# v0 Build Prompt — MarkReady (AI IELTS Writing Coach)

Paste everything below into v0.dev. If v0 supports file/image attachments, also attach `ielts-landing-page.html` as a visual style reference.

---

## Prompt

Build a full Next.js (App Router) web app called **MarkReady** — an AI tool that scores IELTS Writing essays against the official band descriptors and gives examiner-style feedback. Use TypeScript, Tailwind CSS, and shadcn/ui components. Use mock/sample data and local state for anything that would need a real backend — wire up clear placeholder functions (e.g. `scoreEssay()`, `getUserEssays()`) so the logic can be swapped for real API calls later.

### Design system (match this exactly)

- **Vibe:** calm, academic, trustworthy, quietly delightful — never cartoonish, no emoji, no playful illustrations or mascots.
- **Typography:** `Fraunces` (serif) for headings, `Inter` (sans) for body/UI text.
- **Colors:**
  - Paper background `#FAF8F3`, secondary panel `#F2EEE5`
  - Ink text `#23282B`, soft text `#5B6266`, border `#E4DFD3`
  - Primary accent (teal) `#1F5C4E`, teal tint `#E7EFEC`, teal deep `#154136`
  - Secondary accent (amber/terracotta) `#C97B4A`, amber tint `#F7E9DF`
- **UI feel:** generous whitespace, soft shadows, pill-shaped buttons, subtle hover lift on cards, thin progress bars for band scores, rounded 12–14px corners.

### Pages & flows

**1. Marketing landing page (`/`)**
- Hero with headline "Find out your band score before the examiner does," a live-looking sample report card (overall band + 4 criterion bars), and primary CTA "Score my essay free."
- Stat strip: 3.8M IELTS tests/year, Writing is the lowest-scoring section, <15 sec feedback, 60-day retake window.
- How it works (3 steps), feature grid (per-criterion scores, quoted weaknesses, vocab upgrades, model rewrite), before/after sentence upgrade example, retake-mode countdown module, accuracy validation section, pricing teaser, footer with legal links.

**2. Free scorer tool (`/score`)**
- Prompt picker (dropdown of sample Task 2 questions) + essay textarea with live word count.
- "Get my score" button → loading state (animated, ~15s, reassuring copy like "Reading your essay the way an examiner would...").
- Result view: show **overall band only** first, with detailed per-criterion scores, weaknesses, vocab upgrades, and model rewrite **blurred/locked**.
- Email-gate modal: "Enter your email to unlock your full report" → on submit, reveal full report.
- Banner once weekly free essay is used: "You've used your free essay this week — upgrade for unlimited" with CTA to `/pricing`.

**3. Auth (`/login`, `/signup`)**
- Email + password fields, "Continue with Google" button (OAuth), magic-link option.
- Signup includes a short value-prop sidebar (reuse landing page visuals/colors).
- Forgot-password flow (`/forgot-password`) and email-verification pending state.

**4. Onboarding (`/onboarding`, shown once after first signup)**
- Multi-step (3 steps, progress indicator): (1) target band score, (2) test date / "Are you retaking just Writing?" toggle, (3) current level — diagnostic via a short essay or self-reported band.
- Skippable, but skipping shows a gentle nudge ("You can set this up later in Settings").

**5. Dashboard (`/dashboard`)**
- Welcome header with current streak and days-to-test countdown (if set).
- Band trajectory line chart (overall + per-criterion over time).
- "Recent essays" list with mini score badges.
- Empty state for brand-new users: friendly prompt to write their first essay, no chart yet.
- Primary CTA: "Write a new essay."

**6. Practice / new essay (`/practice`)**
- Question bank browser: filter by topic category (Education, Technology, Environment, etc.) and task type (Task 1 Academic / Task 1 General / Task 2).
- "Timed mode" toggle: 40-min countdown for Task 2, 20-min for Task 1, editor locks at zero.
- Essay editor with word count and autosave indicator.

**7. Essay report (`/essays/[id]`)**
- Overall band (large, serif) + 4 criterion bars.
- "Weaknesses" section: 3 cards, each with a quoted sentence from the essay and the specific issue.
- "Vocabulary upgrades": 5 before→after pill pairs.
- "Model rewrite" of the weakest paragraph, shown side-by-side with the original.
- Share/export button (PDF or shareable link — UI only).

**8. Retake plan (`/retake-plan`)**
- If user set a test date in onboarding, show a countdown and an auto-generated week-by-week plan (diagnose → targeted drills → timed essays → mock + review).
- Each week expands to show recommended essay count and focus criterion.

**9. Pricing (`/pricing`)**
- Three cards: Free ($0, 1 essay/week), Premium ($19/mo or $99/yr, "Most popular" badge, unlimited essays + full features), Prep Centres ($300/mo+, teacher dashboard).
- Toggle for monthly/annual pricing.
- FAQ accordion below (billing, cancellation, accuracy guarantee).

**10. Checkout / upgrade (`/checkout` or modal from `/pricing`)**
- Stripe Checkout–style payment form UI (card fields via placeholder, plan summary, total).
- Success state (`/checkout/success`) confirming upgrade and linking to dashboard.

**11. Account & billing (`/account`)**
- Tabs: Profile (name, email, avatar, target band/test date editable), Subscription (current plan, "Manage billing" → Stripe customer portal placeholder, upgrade/downgrade/cancel), Notifications (weekly reminder emails, streak nudges toggle), Security (change password, connected Google account, delete account with confirmation modal).

**12. Legal (`/privacy`, `/terms`)**
- Standard privacy policy and terms-of-service page layouts (use placeholder legal text clearly marked "[placeholder — replace with reviewed legal copy]"), styled consistently with the rest of the site.

**13. Cookie/consent banner**
- Bottom banner on first visit: "We use cookies to improve your experience" with Accept/Decline, linking to `/privacy`.

### Conversion-optimization requirements
- Every page has one obvious primary CTA in the teal accent color; never more than one primary CTA per view.
- Free scorer follows the "value first, email second" pattern: show the overall band before asking for anything.
- Persistent but unobtrusive upgrade prompts triggered by usage limits, not random interstitials.
- Dashboard and report pages always end with a contextual next-action (e.g., report page ends with "Practice this again" or "Upgrade to see unlimited model rewrites").
- Use the retake countdown as an urgency device on the dashboard and retake-plan page for users who set a test date.
- Include a subtle trust strip (accuracy validation stat) near pricing.

### Things to add beyond the literal spec
- **Loading/empty/error states** for every async view (scoring in progress, no essays yet, scoring failed/rate-limited).
- **Responsive layouts** — all pages usable at mobile widths (375px) with the nav collapsing to a hamburger/menu sheet.
- **Accessibility**: sufficient color contrast, focus states on all interactive elements, semantic headings.
- **Referral nudge**: small card on dashboard — "Invite a study partner, get 1 extra free essay this week" (UI only).
- **Streak indicator** on dashboard to encourage daily/weekly practice habit.
- **Settings persistence note**: mock with local state/localStorage so the prototype feels stateful across navigation within a session.
- A small **"Coming soon" teaser** on the dashboard or pricing page for future modules (Speaking practice, TOEFL) to set up cross-sell — styled as a disabled card, not a broken link.

Build this as a cohesive, navigable prototype — every nav link and CTA should route somewhere real within the app (no dead links).
