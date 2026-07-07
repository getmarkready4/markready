import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";
import type { ScoringResult } from "@/types/scoring";

// Mock OpenAI
const mockCreate = vi.hoisted(() => vi.fn());
vi.mock("openai", () => ({
  default: vi.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

// Mock Supabase server client
const mockGetUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
}));

// Mock Supabase service client
let testContext = {
  isBanned: false,
  profileError: false,
  dailyCount: 0,
  deletedIds: [] as string[],
  updatePayloads: [] as unknown[],
  isDeleting: false, // Track if we're in a delete() call
};

type ChainMethod = (this: Record<string, unknown>, ...args: unknown[]) => unknown;

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: vi.fn(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const createChain: Record<string, any> = {
      select: vi.fn(function (this: Record<string, unknown>) {
        return this;
      } as ChainMethod),
      insert: vi.fn(function (this: Record<string, unknown>) {
        return this;
      } as ChainMethod),
      delete: vi.fn(function (this: Record<string, unknown>) {
        testContext.isDeleting = true;
        return this;
      } as ChainMethod),
      update: vi.fn(function (this: Record<string, unknown>, payload: unknown) {
        testContext.updatePayloads.push(payload);
        return this;
      } as ChainMethod),
      eq: vi.fn(function (this: Record<string, unknown>, key?: string, value?: string) {
        if (testContext.isDeleting && key === "id" && value) {
          testContext.deletedIds.push(value);
          testContext.isDeleting = false;
        }
        return this;
      } as ChainMethod),
      gte: vi.fn(function (this: Record<string, unknown>) {
        return this;
      } as ChainMethod),
      or: vi.fn(function (this: Record<string, unknown>) {
        return this;
      } as ChainMethod),
      maybeSingle: vi.fn(async function (this: Record<string, unknown>) {
        if (testContext.profileError) {
          return { data: null, error: { message: "db error" } };
        }
        if (testContext.isBanned) {
          return { data: { banned_at: "2026-07-01" }, error: null };
        }
        return { data: null, error: null };
      } as ChainMethod),
      single: vi.fn(async function (this: Record<string, unknown>) {
        return { data: { id: "ph-1" }, error: null };
      } as ChainMethod),
      then: async function (this: Record<string, unknown>, resolve: (value: unknown) => void) {
        // For count queries
        resolve({ count: testContext.dailyCount });
      } as ChainMethod,
    };
    return {
      from: vi.fn((table: string) => {
        if (table === "profiles") {
          return {
            select: vi.fn(() => ({
              eq: vi.fn(() => ({
                maybeSingle: vi.fn(async () => {
                  if (testContext.profileError) {
                    return { data: null, error: { message: "db error" } };
                  }
                  if (testContext.isBanned) {
                    return { data: { banned_at: "2026-07-01" }, error: null };
                  }
                  return { data: null, error: null };
                }),
              })),
            })),
          };
        }
        return createChain;
      }),
    };
  }),
}));

function createRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

function validScoringJson(): ScoringResult {
  return {
    exam: "IELTS_TASK2",
    word_count: 0,
    overall_band: 0,
    criteria: {
      task_response: { band: 6, strengths_noted: "Good", rationale: "Clear" },
      coherence_cohesion: { band: 6, strengths_noted: "OK", rationale: "Linked" },
      lexical_resource: { band: 6, strengths_noted: "OK", rationale: "Adequate" },
      grammatical_range_accuracy: { band: 7, strengths_noted: "Good", rationale: "Accurate" },
    },
    weakest_criterion: "task_response",
    weaknesses: [{ issue: "Missing", criterion: "task_response", quoted_example: "p2", explanation: "Unsupported", fix: "Add" }],
    vocabulary_upgrades: [{ original: "good", upgrade: "excellent", why: "Precise" }],
    model_paragraph: { original: "Original", rewrite: "Rewritten", target_band: 8, criterion_improved: "lexical_resource", changes_explained: "Upgraded" },
    examiner_summary: "Strong",
  };
}

describe("POST /api/score", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    testContext = { isBanned: false, profileError: false, dailyCount: 0, deletedIds: [], updatePayloads: [], isDeleting: false };
    mockCreate.mockClear();
    mockGetUser.mockClear();
  });

  describe("Auth & Validation", () => {
    it("returns 400 when JSON body is malformed", async () => {
      // WHY: previously an unhandled 500
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = { json: async () => { throw new Error("invalid"); } } as unknown as NextRequest;
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when question is not a string", async () => {
      // WHY: ?.trim() only guards null/undefined; a number crashed the route
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = createRequest({ question: 123, essay: "test", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when essay exceeds 30,000 chars", async () => {
      // WHY: existing limit still enforced after refactor
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = createRequest({ question: "Q?", essay: "x".repeat(30001), taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when essay is empty string", async () => {
      // WHY: empty essay or question should be rejected
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = createRequest({ question: "Q?", essay: "", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 400 when taskType is invalid", async () => {
      // WHY: an unknown task type must never be silently scored against the wrong rubric
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK3" });
      const res = await POST(req);
      expect(res.status).toBe(400);
      const data = await res.json() as Record<string, unknown>;
      expect(data.error).toContain("taskType");
    });

    it("returns 400 when image has disallowed prefix", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK1_ACADEMIC", image: "data:text/plain;base64,abc" });
      const res = await POST(req);
      expect(res.status).toBe(400);
    });

    it("returns 401 when user is not authenticated", async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(401);
    });
  });

  describe("Ban & Cap", () => {
    it("returns 403 when user is banned and does not call LLM", async () => {
      // WHY: a DB outage must not silently unban users
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.isBanned = true;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("returns 500 when ban-check query fails (fail closed)", async () => {
      // WHY: a DB outage must not silently unban users
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.profileError = true;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(500);
    });

    it("returns 429 when post-insert count exceeds 10 and deletes placeholder", async () => {
      // WHY: insert-then-count closes the race; the placeholder must not linger
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.dailyCount = 11;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(429);
      expect(testContext.deletedIds).toContain("ph-1");
    });

    it("returns 200 when post-insert count equals 10", async () => {
      // WHY: > 10 not >= 10 — count includes this submission, so 10 means the user just used their last slot
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.dailyCount = 10;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay word count test", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("Retry Loop & Cleanup", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.dailyCount = 5;
    });

    it("returns 500 when mockCreate returns unparseable content twice and deletes placeholder", async () => {
      // WHY: bad payloads must trigger retry then cleanup
      mockCreate.mockResolvedValue({ choices: [{ message: { content: "I cannot score this essay" }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(testContext.deletedIds).toContain("ph-1");
    });

    it("returns 502 when mockCreate rejects twice and deletes placeholder", async () => {
      mockCreate.mockRejectedValue(new Error("network error"));
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(502);
      expect(testContext.deletedIds).toContain("ph-1");
    });

    it("returns 200 when first response has finish_reason='length', second is valid", async () => {
      // WHY: truncation must consume an attempt, not poison the request
      const valid = validScoringJson();
      mockCreate.mockResolvedValueOnce({ choices: [{ message: { content: "truncated response" }, finish_reason: "length" }] }).mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(valid) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay test words", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });

    it("returns 500 when structurally invalid response twice and deletes placeholder", async () => {
      // WHY: JSON.parse success is not payload validity
      const invalid = { ...validScoringJson(), weaknesses: "none" } as unknown as Record<string, unknown>;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(invalid) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(500);
      expect(testContext.deletedIds).toContain("ph-1");
    });
  });

  describe("Success Path", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.dailyCount = 5;
    });

    it("returns 200 with server-computed overall_band and word_count", async () => {
      // WHY: deterministic transforms are computed in code; the model's arithmetic is not trusted
      const payload = validScoringJson();
      payload.overall_band = 9.0;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(payload) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "One two three four five", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.overall_band).toBe(6.5);
      expect(data.word_count).toBe(5);
      expect(data.remaining_today).toBe(5);
      expect(testContext.updatePayloads[0]).toHaveProperty("overall_band", 6.5);
      expect(testContext.deletedIds).toEqual([]);
    });
  });
});
