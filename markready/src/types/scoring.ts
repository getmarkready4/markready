export type TaskType = "TASK2" | "TASK1_ACADEMIC" | "TASK1_GENERAL";

export interface CriterionScore {
  strengths_noted: string;
  band: number;
  rationale: string;
}

export interface Weakness {
  criterion: string;
  issue: string;
  quoted_example: string;
  explanation: string;
  fix: string;
}

export interface VocabUpgrade {
  original: string;
  upgrade: string;
  why: string;
}

export interface ModelParagraph {
  target_band: number;
  criterion_improved: string;
  original: string;
  rewrite: string;
  changes_explained: string;
}

// Task 2 uses task_response; Task 1 uses task_achievement
export type CriterionKey =
  | "task_response"
  | "task_achievement"
  | "coherence_cohesion"
  | "lexical_resource"
  | "grammatical_range_accuracy";

export interface ScoringResult {
  exam: string;
  word_count: number;
  overall_band: number;
  criteria: Partial<Record<CriterionKey, CriterionScore>>;
  weakest_criterion: CriterionKey;
  weaknesses: [Weakness, Weakness, Weakness];
  vocabulary_upgrades: [
    VocabUpgrade,
    VocabUpgrade,
    VocabUpgrade,
    VocabUpgrade,
    VocabUpgrade,
  ];
  model_paragraph: ModelParagraph;
  examiner_summary: string;
  // Task 1 extras
  overview_present?: boolean;
  data_accuracy_note?: string;
}

export const CRITERION_LABELS: Record<CriterionKey, string> = {
  task_response: "Task Response",
  task_achievement: "Task Achievement",
  coherence_cohesion: "Coherence & Cohesion",
  lexical_resource: "Lexical Resource",
  grammatical_range_accuracy: "Grammatical Range & Accuracy",
};

export const TASK_LABELS: Record<TaskType, string> = {
  TASK2: "Writing Task 2",
  TASK1_ACADEMIC: "Writing Task 1 — Academic",
  TASK1_GENERAL: "Writing Task 1 — General (Letter)",
};

export const MIN_WORDS: Record<TaskType, number> = {
  TASK2: 250,
  TASK1_ACADEMIC: 150,
  TASK1_GENERAL: 150,
};
