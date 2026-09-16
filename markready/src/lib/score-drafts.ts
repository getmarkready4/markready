import type { TaskType } from "@/types/scoring";

export type ScoreDraft = {
  question: string;
  customQuestion: boolean;
  essay: string;
  imageDataUri: string | null;
};

export type ScoreDrafts = {
  taskType: TaskType;
  drafts: Partial<Record<TaskType, ScoreDraft>>;
};

const tasks: TaskType[] = ["TASK2", "TASK1_ACADEMIC", "TASK1_GENERAL"];
// Retain work during same-page reauthentication even if storage is unavailable.
const memory = new Map<string, ScoreDrafts>();
const unsaved = new Set<string>();
const key = (userId: string) => `markready:score-drafts:v1:${userId}`;
const warning = "Draft storage is unavailable or full. Keep this page open and copy your response before leaving; the latest text or chart may not survive a reload.";

export function readScoreDrafts(userId: string): { value: ScoreDrafts; warning: string | null } {
  const fallback = memory.get(userId) ?? { taskType: "TASK2", drafts: {} };
  try {
    const raw = window.sessionStorage.getItem(key(userId));
    if (memory.has(userId)) return { value: fallback, warning: unsaved.has(userId) ? warning : null };
    if (!raw) return { value: fallback, warning: null };
    const value = JSON.parse(raw) as ScoreDrafts;
    if (!tasks.includes(value.taskType) || !value.drafts || typeof value.drafts !== "object") throw new Error("Invalid draft");
    for (const [task, draft] of Object.entries(value.drafts)) {
      if (!tasks.includes(task as TaskType) || !draft ||
          typeof draft.question !== "string" || typeof draft.essay !== "string" ||
          typeof draft.customQuestion !== "boolean" ||
          !(draft.imageDataUri === null || (typeof draft.imageDataUri === "string" && /^data:image\/(png|jpeg|webp);base64,/.test(draft.imageDataUri)))) {
        throw new Error("Invalid draft");
      }
    }
    return { value, warning: null };
  } catch {
    return { value: fallback, warning };
  }
}

export function writeScoreDrafts(userId: string, value: ScoreDrafts): string | null {
  memory.set(userId, value);
  try {
    window.sessionStorage.setItem(key(userId), JSON.stringify(value));
    unsaved.delete(userId);
    return null;
  } catch {
    unsaved.add(userId);
    return warning;
  }
}
