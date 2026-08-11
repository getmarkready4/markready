import type { Weakness } from "@/types/scoring";
import { splitQuotedExample } from "./feedback-copy";

export interface EssaySegment {
  text: string;
  /** Index into the weaknesses array, or null for untouched text. */
  weaknessIndex: number | null;
}

/**
 * Splits the candidate's essay into plain and flagged segments so their own
 * writing can carry the feedback.
 *
 * This is the lowest-reading-load way to show what went wrong: the learner
 * already knows what they wrote, so a highlight over their own words needs no
 * comprehension at all — unlike a paragraph explaining the error.
 *
 * Matching is best-effort by design. `quoted_example` is meant to be verbatim,
 * but the model sometimes normalises punctuation or quotes a phrase that spans
 * an edit. A fragment that cannot be located is simply skipped: a missing
 * highlight is invisible, whereas a wrong one would point the learner at
 * innocent text.
 */
export function annotateEssay(essay: string, weaknesses: Weakness[]): EssaySegment[] {
  if (!essay) return [];

  const haystack = essay.toLowerCase();
  const hits: { start: number; end: number; weaknessIndex: number }[] = [];

  weaknesses.forEach((w, weaknessIndex) => {
    for (const fragment of splitQuotedExample(w.quoted_example ?? "")) {
      // Single words match too loosely ("is", "the") and would litter the essay.
      if (fragment.length < 4) continue;

      const at = haystack.indexOf(fragment.toLowerCase());
      if (at === -1) continue;

      hits.push({ start: at, end: at + fragment.length, weaknessIndex });
    }
  });

  if (hits.length === 0) return [{ text: essay, weaknessIndex: null }];

  // Earliest first; on a tie prefer the longer match, then drop anything that
  // overlaps a highlight already taken — nested <mark>s would render as noise.
  hits.sort((a, b) => a.start - b.start || b.end - a.end);

  const segments: EssaySegment[] = [];
  let cursor = 0;

  for (const hit of hits) {
    if (hit.start < cursor) continue;
    if (hit.start > cursor) {
      segments.push({ text: essay.slice(cursor, hit.start), weaknessIndex: null });
    }
    segments.push({
      text: essay.slice(hit.start, hit.end),
      weaknessIndex: hit.weaknessIndex,
    });
    cursor = hit.end;
  }

  if (cursor < essay.length) {
    segments.push({ text: essay.slice(cursor), weaknessIndex: null });
  }

  return segments;
}

/** How many weaknesses were actually located in the essay text. */
export function countAnnotated(segments: EssaySegment[]): number {
  return new Set(
    segments.filter((s) => s.weaknessIndex !== null).map((s) => s.weaknessIndex)
  ).size;
}
