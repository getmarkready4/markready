import type { CriterionKey, TaskType } from "@/types/scoring";
import { MIN_WORDS } from "@/types/scoring";

/**
 * Plain-English framing derived from the scoring JSON.
 *
 * All of it is templated in code, deliberately. A learner sitting at Band 5
 * cannot read Band 8 prose, and the scoring prompt writes at Band 8 because it
 * is written at Band 8 — so the top of the report is generated from structured
 * fields (band numbers, criterion keys, counts) rather than from model text.
 * No second model call, no latency, no drift, nothing new to calibrate.
 *
 * The official IELTS wording is kept alongside as a subtitle: candidates do
 * need to learn the real terms, they just should not have to decode them to
 * find out what went wrong.
 */

/** What a Band 5 reader actually understands, per criterion. */
export const PLAIN_CRITERION_LABELS: Record<CriterionKey, string> = {
  task_response: "Answering the question",
  task_achievement: "Covering the task",
  coherence_cohesion: "Organisation",
  lexical_resource: "Vocabulary",
  grammatical_range_accuracy: "Grammar",
};

/** Short category badge for a weakness card. */
export const PLAIN_CRITERION_SHORT: Record<CriterionKey, string> = {
  task_response: "Answer",
  task_achievement: "Task",
  coherence_cohesion: "Structure",
  lexical_resource: "Vocabulary",
  grammatical_range_accuracy: "Grammar",
};

export type Verdict = "Excellent" | "Good" | "OK" | "Needs work";

export function bandVerdict(band: number): Verdict {
  if (band >= 7.5) return "Excellent";
  if (band >= 6.5) return "Good";
  if (band >= 5.5) return "OK";
  return "Needs work";
}

export function verdictClasses(v: Verdict): string {
  switch (v) {
    case "Excellent":
      return "bg-teal-50 text-teal-800 border-teal-200";
    case "Good":
      return "bg-teal-50 text-teal-700 border-teal-200";
    case "OK":
      return "bg-amber-50 text-amber-700 border-amber-200";
    default:
      return "bg-red-50 text-red-700 border-red-200";
  }
}

/**
 * One short, imperative instruction for the next attempt.
 *
 * Kept in code rather than taken from `weaknesses[].fix`, because the model's
 * fix text runs to several sentences and often carries its own jargon. This is
 * the single line a skimmer reads, so it has to stay short and plain.
 */
const NEXT_ACTION: Record<CriterionKey, string> = {
  task_response: "Give one reason and one example for every point you make.",
  task_achievement: "Cover every part of the task, and add an overview.",
  coherence_cohesion: "Start each paragraph with its main idea in one sentence.",
  lexical_resource: "Replace your five most repeated words with better ones.",
  grammatical_range_accuracy: "Check every verb matches its subject.",
};

export function nextAction(weakest: CriterionKey): string {
  return NEXT_ACTION[weakest] ?? "Read your essay aloud and fix what sounds wrong.";
}

export function isCriterionKey(v: unknown): v is CriterionKey {
  return typeof v === "string" && v in PLAIN_CRITERION_LABELS;
}

/** Word count vs the task minimum — arithmetic, no model involved. */
export function wordCountStatus(count: number, taskType: TaskType) {
  const min = MIN_WORDS[taskType];
  const short = min - count;
  return {
    min,
    under: short > 0,
    message:
      short > 0
        ? `${count} words — ${short} under the ${min} minimum. This costs you marks.`
        : `${count} words — over the ${min} minimum.`,
  };
}

/**
 * Splits a quoted example into its individual fragments. The scorer often packs
 * several offending phrases into one string separated by slashes.
 */
export function splitQuotedExample(quoted: string): string[] {
  return quoted
    .split("/")
    .map((s) => s.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, "").trim())
    .filter((s) => s.length > 0);
}
