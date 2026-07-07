import type { ScoringResult, CriterionKey, Weakness, VocabUpgrade } from "@/types/scoring";

export function extractJson(raw: string): string {
  // First try: strip fences
  const fenceStripped = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  try {
    JSON.parse(fenceStripped);
    return fenceStripped;
  } catch {
    // Fallback: find first { and last } in the original raw string
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && firstBrace < lastBrace) {
      return raw.substring(firstBrace, lastBrace + 1);
    }
    // If no braces found, return the fence-stripped version
    // (will fail on parse, which is the intended behavior)
    return fenceStripped;
  }
}

export function parseScoringResult(raw: string): ScoringResult | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }

  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const obj = parsed as Record<string, unknown>;

  // Validate and process criteria
  const criteria = obj.criteria as Record<string, unknown>;
  if (typeof criteria !== "object" || criteria === null) {
    return null;
  }

  const processedCriteria: Record<string, { band: number; strengths_noted: string; rationale: string }> = {};
  let hasValidCriteria = false;

  for (const [key, value] of Object.entries(criteria)) {
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      const band = typeof v.band === "number" && Number.isFinite(v.band)
        ? Math.max(1, Math.min(9, v.band))
        : undefined;
      if (band !== undefined) {
        processedCriteria[key] = {
          band,
          strengths_noted: typeof v.strengths_noted === "string" ? v.strengths_noted : "",
          rationale: typeof v.rationale === "string" ? v.rationale : "",
        };
        hasValidCriteria = true;
      }
    }
  }

  if (!hasValidCriteria) {
    return null;
  }

  // Validate weaknesses
  if (!Array.isArray(obj.weaknesses)) {
    return null;
  }

  const weaknesses: Weakness[] = [];
  for (const w of obj.weaknesses) {
    if (typeof w === "object" && w !== null) {
      const ww = w as Record<string, unknown>;
      if (
        typeof ww.issue === "string" &&
        ww.issue.length > 0 &&
        typeof ww.criterion === "string" &&
        typeof ww.quoted_example === "string" &&
        typeof ww.explanation === "string" &&
        typeof ww.fix === "string"
      ) {
        weaknesses.push({
          issue: ww.issue,
          criterion: ww.criterion,
          quoted_example: ww.quoted_example,
          explanation: ww.explanation,
          fix: ww.fix,
        });
      }
    }
  }

  // Validate vocabulary_upgrades (coerce to array if needed)
  const upgrades: VocabUpgrade[] = [];
  if (Array.isArray(obj.vocabulary_upgrades)) {
    for (const u of obj.vocabulary_upgrades) {
      if (typeof u === "object" && u !== null) {
        const uu = u as Record<string, unknown>;
        if (
          typeof uu.original === "string" &&
          typeof uu.upgrade === "string" &&
          typeof uu.why === "string"
        ) {
          upgrades.push({
            original: uu.original,
            upgrade: uu.upgrade,
            why: uu.why,
          });
        }
      }
    }
  }

  // Validate model_paragraph (MUST have original and rewrite as strings, NOT coercible)
  const mp = obj.model_paragraph as Record<string, unknown> | undefined;
  if (
    typeof mp !== "object" ||
    mp === null ||
    typeof mp.original !== "string" ||
    typeof mp.rewrite !== "string"
  ) {
    return null;
  }

  const modelParagraph = {
    original: mp.original,
    rewrite: mp.rewrite,
    target_band: typeof mp.target_band === "number" ? mp.target_band : 8,
    criterion_improved: typeof mp.criterion_improved === "string" ? mp.criterion_improved : "",
    changes_explained: typeof mp.changes_explained === "string" ? mp.changes_explained : "",
  };

  // Validate/replace weakest_criterion
  const VALID_KEYS: CriterionKey[] = [
    "task_response",
    "task_achievement",
    "coherence_cohesion",
    "lexical_resource",
    "grammatical_range_accuracy",
  ];
  let weakestCriterion = obj.weakest_criterion as string;
  if (!VALID_KEYS.includes(weakestCriterion as CriterionKey)) {
    // Fallback: pick the lowest-band criterion key
    let lowestKey: CriterionKey | null = null;
    let lowestBand = Infinity;
    for (const [key, score] of Object.entries(processedCriteria)) {
      if (score.band < lowestBand) {
        lowestBand = score.band;
        lowestKey = key as CriterionKey;
      }
    }
    weakestCriterion = lowestKey ?? "task_response";
  }

  // Optional fields
  const examinerSummary = typeof obj.examiner_summary === "string" ? obj.examiner_summary : "";
  const exam = typeof obj.exam === "string" ? obj.exam : "";
  const overviewPresent = typeof obj.overview_present === "boolean" ? obj.overview_present : undefined;
  const dataAccuracyNote = typeof obj.data_accuracy_note === "string" ? obj.data_accuracy_note : undefined;

  return {
    exam,
    word_count: 0, // Will be overwritten by route
    overall_band: 0, // Will be overwritten by route
    criteria: processedCriteria as Record<string, { band: number; strengths_noted: string; rationale: string }>,
    weakest_criterion: weakestCriterion as CriterionKey,
    weaknesses: weaknesses as Weakness[],
    vocabulary_upgrades: upgrades as VocabUpgrade[],
    model_paragraph: modelParagraph,
    examiner_summary: examinerSummary,
    overview_present: overviewPresent,
    data_accuracy_note: dataAccuracyNote,
  } as ScoringResult;
}
