import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TASK_LABELS } from "@/types/scoring";
import { ScoreReport } from "@/components/ScoreReport";
import type { SubmissionRow } from "@/lib/progress";

export default async function SubmissionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: submission } = await supabase
    .from("submissions")
    .select("id, task_type, question, essay, scores, overall_band, created_at")
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!submission || !submission.scores) notFound();

  const sub = submission as SubmissionRow;

  const date = new Date(sub.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <header className="border-b border-[#E4DFD3] bg-[#FAF8F3]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <Link href="/dashboard" className="font-serif text-xl font-semibold text-[#23282B]">
            ← Back to Dashboard
          </Link>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Title */}
        <div className="space-y-2">
          <h1 className="font-serif text-3xl font-semibold text-[#23282B]">
            {TASK_LABELS[sub.task_type]}
          </h1>
          <p className="text-[#5B6266]">{date}</p>
        </div>

        {/* Question & Essay (collapsible sections) */}
        <div className="space-y-4">
          {sub.question && (
            <details className="rounded-xl border border-[#E4DFD3] bg-white px-6 py-4">
              <summary className="cursor-pointer font-medium text-[#23282B] hover:text-[#1F5C4E]">
                Original Question / Prompt
              </summary>
              <p className="mt-3 text-sm text-[#5B6266] leading-relaxed">
                {sub.question}
              </p>
            </details>
          )}

          {sub.essay && (
            <details className="rounded-xl border border-[#E4DFD3] bg-white px-6 py-4">
              <summary className="cursor-pointer font-medium text-[#23282B] hover:text-[#1F5C4E]">
                Your Response
              </summary>
              <p className="mt-3 text-sm text-[#5B6266] leading-relaxed whitespace-pre-wrap">
                {sub.essay}
              </p>
            </details>
          )}
        </div>

        {/* Score Report */}
        <div className="rounded-2xl border border-[#E4DFD3] bg-white p-6 shadow-sm">
          <ScoreReport
            result={sub.scores!}
            taskType={sub.task_type}
            essay={sub.essay ?? undefined}
          />
        </div>

        {/* Back link */}
        <div>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 rounded-xl border border-[#E4DFD3] bg-white text-[#23282B] font-semibold text-sm hover:border-[#1F5C4E] transition-colors"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </main>
    </div>
  );
}
