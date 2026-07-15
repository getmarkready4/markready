import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

const TASK_TYPES = [
  {
    label: "Task 2",
    tag: "Essay",
    desc: "Respond to an opinion or discussion prompt with a 250-word argument essay.",
  },
  {
    label: "Task 1 — Academic",
    tag: "Chart",
    desc: "Describe a graph, chart, table, or process in at least 150 words.",
  },
  {
    label: "Task 1 — General",
    tag: "Letter",
    desc: "Write a formal, semi-formal, or informal letter of at least 150 words.",
  },
];

const STEPS = [
  { n: "1", title: "Pick your task", body: "Choose Task 2, Task 1 Academic, or Task 1 General." },
  { n: "2", title: "Paste your writing", body: "Add the prompt and your response — or use a sample question." },
  { n: "3", title: "Get examiner feedback", body: "An estimated band, the fixes that move it, and a Band 8 rewrite." },
];

const FEATURES = [
  {
    title: "Scored on all four criteria",
    body: "Task Response, Coherence & Cohesion, Lexical Resource, and Grammatical Range — each with its own band and rationale.",
  },
  {
    title: "Specific, actionable fixes",
    body: "Not just what's wrong — exactly what to change, with your own sentences quoted back to you.",
  },
  {
    title: "A Band 8 model rewrite",
    body: "Your weakest paragraph rewritten to a higher band, side by side, so you can see the difference.",
  },
  {
    title: "Progress tracking",
    body: "Watch your band trend over time and see which weaknesses keep recurring.",
  },
];

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Returning, signed-in users go straight to the app.
  if (user) redirect("/score");

  return (
    <div className="min-h-screen bg-[#FAF8F3] text-[#23282B]">
      {/* Header */}
      <header className="border-b border-[#E4DFD3]">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-serif text-xl font-semibold">MarkReady</span>
          <Link
            href="/login"
            className="text-sm font-medium text-[#1F5C4E] hover:text-[#154136]"
          >
            Sign in
          </Link>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-3xl mx-auto px-4 pt-20 pb-16 text-center">
        <h1 className="font-serif text-4xl sm:text-5xl font-semibold leading-tight">
          Examiner-level IELTS writing feedback in seconds
        </h1>
        <p className="mt-5 text-lg text-[#5B6266] max-w-xl mx-auto leading-relaxed">
          Paste your essay or letter and get an estimated band score, the specific
          fixes that will raise it, and a Band 8 rewrite — the kind of feedback a
          human examiner takes 45 minutes to produce.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl bg-[#1F5C4E] text-white font-semibold text-sm hover:bg-[#154136] transition-colors"
          >
            Get started
          </Link>
          <Link
            href="/login"
            className="px-6 py-3 rounded-xl border border-[#E4DFD3] bg-white font-semibold text-sm hover:border-[#1F5C4E] transition-colors"
          >
            Sign in
          </Link>
        </div>
        <p className="mt-4 text-xs text-[#9BA3A8]">
          AI-generated estimates to guide your practice — not official IELTS results.
        </p>
      </section>

      {/* How it works */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid sm:grid-cols-3 gap-6">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 text-center"
            >
              <div className="mx-auto w-9 h-9 rounded-full bg-[#E7EFEC] text-[#1F5C4E] font-semibold flex items-center justify-center">
                {s.n}
              </div>
              <h3 className="mt-3 font-semibold text-sm">{s.title}</h3>
              <p className="mt-1 text-xs text-[#5B6266] leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* What you get */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="font-serif text-2xl font-semibold text-center mb-8">
          What you get on every submission
        </h2>
        <div className="grid sm:grid-cols-2 gap-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-5"
            >
              <h3 className="font-semibold text-sm text-[#1F5C4E]">{f.title}</h3>
              <p className="mt-1 text-sm text-[#5B6266] leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Task types — doubles as "which one do I pick?" */}
      <section className="max-w-4xl mx-auto px-4 py-12">
        <h2 className="font-serif text-2xl font-semibold text-center mb-2">
          Three task types, one place
        </h2>
        <p className="text-sm text-[#5B6266] text-center mb-8 max-w-lg mx-auto">
          Pick the task that matches what you&apos;re practising — the scoring rubric
          changes to match.
        </p>
        <div className="grid sm:grid-cols-3 gap-4">
          {TASK_TYPES.map((t) => (
            <div
              key={t.label}
              className="rounded-2xl border border-[#E4DFD3] bg-white px-5 py-5"
            >
              <span className="inline-block text-[11px] font-semibold uppercase tracking-wide text-[#C97B4A] bg-[#F7E9DF] rounded-full px-2.5 py-0.5">
                {t.tag}
              </span>
              <h3 className="mt-2 font-semibold text-sm">{t.label}</h3>
              <p className="mt-1 text-xs text-[#5B6266] leading-relaxed">{t.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <h2 className="font-serif text-3xl font-semibold">Ready to see your band?</h2>
        <p className="mt-3 text-[#5B6266]">Score your first essay in under a minute.</p>
        <Link
          href="/login"
          className="mt-6 inline-block px-8 py-3 rounded-xl bg-[#1F5C4E] text-white font-semibold text-sm hover:bg-[#154136] transition-colors"
        >
          Get started
        </Link>
      </section>

      {/* Footer */}
      <footer className="border-t border-[#E4DFD3]">
        <div className="max-w-5xl mx-auto px-4 py-8 space-y-3">
          <div className="flex items-center justify-center gap-4 text-sm text-[#5B6266]">
            <Link href="/terms" className="hover:text-[#23282B] underline">
              Terms
            </Link>
            <Link href="/privacy" className="hover:text-[#23282B] underline">
              Privacy
            </Link>
            <Link href="/login" className="hover:text-[#23282B] underline">
              Sign in
            </Link>
          </div>
          <p className="text-center text-xs text-[#9BA3A8] leading-relaxed max-w-2xl mx-auto">
            Scores are AI-generated estimates, not official results. IELTS™ is a
            registered trademark of the British Council, IDP: IELTS Australia and
            Cambridge University Press &amp; Assessment. MarkReady is not affiliated
            with or endorsed by them.
          </p>
        </div>
      </footer>
    </div>
  );
}
