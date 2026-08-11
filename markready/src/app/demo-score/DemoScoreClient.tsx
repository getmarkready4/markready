"use client";

// TEMPORARY — local preview of the animated ScoreReport with mock data.
// DELETE THIS FILE before merging. It is unauthenticated by design so the
// reveal animation can be reviewed without a Supabase session.

import { useState } from "react";
import { ScoreReport } from "@/components/ScoreReport";
import type { ScoringResult } from "@/types/scoring";

const MOCK: ScoringResult = {
  exam: "IELTS_TASK2",
  word_count: 205,
  overall_band: 5.5,
  criteria: {
    task_response: {
      band: 5.5,
      strengths_noted: "Both views are addressed and a clear position is given.",
      rationale:
        "The essay discusses both sides but development is thin — examples are asserted rather than explained.",
    },
    coherence_cohesion: {
      band: 6,
      strengths_noted: "Clear four-paragraph structure with a visible progression.",
      rationale:
        "Paragraphing is logical, though linking is repetitive ('On one hand', 'On the other hand').",
    },
    lexical_resource: {
      band: 5,
      strengths_noted: "Some attempt at topic vocabulary ('responsible', 'competitive').",
      rationale:
        "Repeated errors with plural and word form ('peoples', 'childrens') limit precision.",
    },
    grammatical_range_accuracy: {
      band: 5,
      strengths_noted: "A mix of simple and compound sentences is attempted.",
      rationale:
        "Frequent subject–verb agreement errors and article omissions reduce clarity.",
    },
  },
  weakest_criterion: "lexical_resource",
  weaknesses: [
    {
      issue: "Uncountable noun pluralised",
      criterion: "lexical_resource",
      quoted_example: "many peoples has different opinion",
      explanation: "'People' is already plural, and the verb must agree.",
      fix: "many people have different opinions",
    },
    {
      issue: "Irregular plural formed incorrectly",
      criterion: "lexical_resource",
      quoted_example: "the grades of childrens",
      explanation: "'Children' is already the plural of 'child'.",
      fix: "children's grades",
    },
    {
      issue: "Wrong word choice",
      criterion: "lexical_resource",
      quoted_example: "will effect the grades",
      explanation: "'Effect' is a noun; the verb is 'affect'.",
      fix: "will affect the grades",
    },
  ],
  vocabulary_upgrades: [
    { original: "very important", upgrade: "crucial", why: "Avoids a weak intensifier." },
    { original: "a lot of", upgrade: "a considerable number of", why: "More formal register." },
    { original: "good", upgrade: "beneficial", why: "Precise and academic." },
    { original: "think", upgrade: "contend", why: "Signals a reasoned position." },
    { original: "big problem", upgrade: "pressing issue", why: "Collocates naturally." },
  ],
  model_paragraph: {
    original:
      "In my opinion, I think both things is important but the balance must be find.",
    rewrite:
      "In my view, the two priorities are not mutually exclusive; the challenge lies in striking a workable balance between them.",
    target_band: 8,
    criterion_improved: "grammatical_range_accuracy",
    changes_explained:
      "Corrects agreement and the passive, and replaces the redundant 'In my opinion, I think'.",
  },
  examiner_summary:
    "A competent attempt with clear structure, held back by recurrent grammatical and lexical errors. Fixing agreement and plural forms would lift this closer to Band 6.",
};

export function DemoScoreClient() {
  const [runId, setRunId] = useState(0);

  return (
    <div className="min-h-screen bg-[#FAF8F3] px-4 py-10">
      <div className="max-w-3xl mx-auto">
        <div className="mb-6 flex items-center justify-between">
          <p className="text-sm text-[#5B6266]">
            Demo — animated score reveal (mock data)
          </p>
          <button
            onClick={() => setRunId((n) => n + 1)}
            className="px-4 py-2 rounded-lg bg-[#23282B] text-white text-sm font-medium"
          >
            Replay animation
          </button>
        </div>
        <ScoreReport key={runId} result={MOCK} taskType="TASK2" animate />
      </div>
    </div>
  );
}
