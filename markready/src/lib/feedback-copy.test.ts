import { expect, it } from "vitest";
import { nextAction } from "./feedback-copy";

it("gives letter writers purpose, coverage and tone advice without a chart overview", () => {
  const tip = nextAction("task_achievement", "TASK1_GENERAL");
  expect(tip).toMatch(/purpose.*bullet point.*tone/);
  expect(tip).not.toContain("overview");
  expect(nextAction("task_achievement", "TASK1_ACADEMIC")).toContain("overview");
  expect(nextAction("task_response", "TASK2")).toContain("example");
});
