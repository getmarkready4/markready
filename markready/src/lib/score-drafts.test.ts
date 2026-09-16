import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("account drafts", () => {
  const values = new Map<string, string>();
  beforeEach(() => {
    vi.resetModules();
    values.clear();
    vi.stubGlobal("window", { sessionStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    } });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("restores the task, question, response and chart after reload without leaking another account", async () => {
    const { writeScoreDrafts } = await import("./score-drafts");
    const value = { taskType: "TASK1_ACADEMIC" as const, drafts: {
      TASK1_ACADEMIC: { question: "Custom chart", customQuestion: true, essay: "Private response", imageDataUri: "data:image/png;base64,YQ==" },
      TASK2: { question: "Essay prompt", customQuestion: false, essay: "Separate essay", imageDataUri: null },
    } };
    expect(writeScoreDrafts("alice", value)).toBeNull();
    vi.resetModules();
    const { readScoreDrafts } = await import("./score-drafts");
    expect(readScoreDrafts("alice").value).toEqual(value);
    expect(readScoreDrafts("bob").value.drafts).toEqual({});
  });

  it("keeps the latest work through reauthentication when storage fills and keeps warning", async () => {
    const { readScoreDrafts, writeScoreDrafts } = await import("./score-drafts");
    window.sessionStorage.setItem = () => { throw new Error("full"); };
    const value = { taskType: "TASK2" as const, drafts: { TASK2: { question: "q", customQuestion: true, essay: "Unsaved work", imageDataUri: null } } };
    expect(writeScoreDrafts("alice", value)).toContain("copy your response");
    expect(readScoreDrafts("alice")).toMatchObject({ value, warning: expect.any(String) });
    expect(readScoreDrafts("bob").value.drafts).toEqual({});
  });

  it("fails visibly for blocked storage or damaged drafts without writing defaults over them", async () => {
    const { readScoreDrafts } = await import("./score-drafts");
    values.set("markready:score-drafts:v1:alice", "invalid json");
    expect(readScoreDrafts("alice").warning).toBeTruthy();
    expect(values.get("markready:score-drafts:v1:alice")).toBe("invalid json");
    Object.defineProperty(window, "sessionStorage", { get: () => { throw new Error("blocked"); } });
    expect(readScoreDrafts("bob").warning).toBeTruthy();
  });
});
