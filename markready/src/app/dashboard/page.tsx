import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { TASK_LABELS, CRITERION_LABELS } from "@/types/scoring";
import {
  computeBandTrend,
  computeRecurringWeaknesses,
  computeSummary,
} from "@/lib/progress";
import type { SubmissionRow } from "@/lib/progress";
import { BandTrendChart } from "@/components/BandTrendChart";
import { SignOutButton } from "@/components/SignOutButton";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data } = await supabase
    .from("submissions")
    .select("id, task_type, question, essay, scores, overall_band, created_at")
    .eq("user_id", user.id)
    .not("scores", "is", null)
    .order("created_at", { ascending: false });

  const submissions = (data ?? []) as SubmissionRow[];

  if (submissions.length === 0) {
    return (
      <div className="min-h-screen bg-[#FAF8F3]">
        {/* Header */}
        <header className="border-b border-[#E4DFD3] bg-[#FAF8F3]/80 backdrop-blur sticky top-0 z-20">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
            <Link href="/" className="font-serif text-xl font-semibold text-[#23282B]">
              MarkReady
            </Link>
            <div className="flex items-center gap-4">
              {user.email && <span className="text-sm text-gray-500">{user.email}</span>}
              <SignOutButton />
            </div>
          </div>
        </header>

        <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
          <div className="text-center space-y-4">
            <h1 className="font-serif text-3xl font-semibold text-[#23282B]">
              No evaluations yet
            </h1>
            <p className="text-[#5B6266]">
              Get started by scoring your first essay to see your progress and
              trends.
            </p>
            <Link
              href="/score"
              className="inline-block px-6 py-3 rounded-xl bg-[#1F5C4E] text-white font-semibold text-sm hover:bg-[#154136] transition-colors"
            >
              Score your first essay
            </Link>
          </div>
        </main>
      </div>
    );
  }

  const trend = computeBandTrend(submissions);
  const weaknesses = computeRecurringWeaknesses(submissions);
  const summary = computeSummary(submissions);

  const deltaIndicator =
    summary.deltaFromFirst != null
      ? summary.deltaFromFirst > 0
        ? "↑"
        : summary.deltaFromFirst < 0
          ? "↓"
          : ""
      : "";
  const deltaValue =
    summary.deltaFromFirst != null
      ? Math.abs(summary.deltaFromFirst).toFixed(1)
      : "—";

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <header className="border-b border-[#E4DFD3] bg-[#FAF8F3]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="font-serif text-xl font-semibold text-[#23282B]">
            MarkReady
          </Link>
          <div className="flex items-center gap-4">
            {user.email && <span className="text-sm text-gray-500">{user.email}</span>}
            <Link
              href="/score"
              className="text-sm text-[#1F5C4E] hover:text-[#154136] font-medium"
            >
              New evaluation
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-10">
        {/* Summary cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-xl border border-[#E4DFD3] bg-white px-4 py-4 text-center">
            <p className="text-xs text-[#5B6266] mb-1">Total Evaluations</p>
            <p className="font-serif text-3xl font-semibold text-[#23282B]">
              {summary.total}
            </p>
          </div>

          <div className="rounded-xl border border-[#E4DFD3] bg-white px-4 py-4 text-center">
            <p className="text-xs text-[#5B6266] mb-1">Latest Band</p>
            <p className="font-serif text-3xl font-semibold text-[#23282B]">
              {summary.latestOverall !== null
                ? summary.latestOverall.toFixed(1)
                : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-[#E4DFD3] bg-white px-4 py-4 text-center">
            <p className="text-xs text-[#5B6266] mb-1">Best Band</p>
            <p className="font-serif text-3xl font-semibold text-[#23282B]">
              {summary.bestOverall !== null ? summary.bestOverall.toFixed(1) : "—"}
            </p>
          </div>

          <div className="rounded-xl border border-[#E4DFD3] bg-white px-4 py-4 text-center">
            <p className="text-xs text-[#5B6266] mb-1">Progress</p>
            <p className="font-serif text-3xl font-semibold text-[#23282B]">
              {deltaIndicator}{deltaValue}
            </p>
          </div>
        </div>

        {/* Trend chart */}
        {trend.length > 0 && (
          <div className="rounded-2xl border border-[#E4DFD3] bg-white px-6 py-6 shadow-sm">
            <h2 className="font-serif text-lg font-semibold text-[#23282B] mb-4">
              Band Trends
            </h2>
            <BandTrendChart data={trend} />
          </div>
        )}

        {/* Recurring weaknesses */}
        {weaknesses.length > 0 && (
          <div className="space-y-3">
            <h2 className="font-serif text-lg font-semibold text-[#23282B]">
              Recurring Weaknesses
            </h2>
            {weaknesses.map((weak) => (
              <div
                key={weak.criterion}
                className="rounded-xl border border-[#E4DFD3] bg-white px-6 py-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <h3 className="font-medium text-[#23282B] mb-1">
                      {CRITERION_LABELS[weak.criterion]}
                    </h3>
                    <p className="text-xs text-[#5B6266] mb-2">
                      Weakest in {weak.timesWeakest} of {summary.total} evaluations
                      · Avg band: {weak.avgBand.toFixed(1)}
                    </p>
                    <div className="space-y-1.5">
                      {weak.recentIssues.map((issue, idx) => (
                        <p key={idx} className="text-xs text-[#5B6266] italic">
                          &ldquo;{issue}&rdquo;
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* History */}
        <div className="space-y-3">
          <h2 className="font-serif text-lg font-semibold text-[#23282B]">
            Evaluation History
          </h2>
          {submissions.map((sub) => {
            const date = new Date(sub.created_at).toLocaleDateString("en-US", {
              year: "numeric",
              month: "short",
              day: "numeric",
            });
            return (
              <Link
                key={sub.id}
                href={`/dashboard/${sub.id}`}
                className="block rounded-xl border border-[#E4DFD3] bg-white px-6 py-4 hover:border-[#1F5C4E] transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#5B6266] mb-0.5">{date}</p>
                    <p className="text-sm font-medium text-[#23282B]">
                      {TASK_LABELS[sub.task_type]}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-serif text-lg font-semibold text-[#1F5C4E]">
                      {sub.overall_band !== null
                        ? sub.overall_band.toFixed(1)
                        : "—"}
                    </p>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </main>
    </div>
  );
}
