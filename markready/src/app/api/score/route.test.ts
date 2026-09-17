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
  // Completed marks, lifetime; active leases are a separate database state.
  usedCount: 0,
  // Marks left in an unexpired pack once the two free marks are spent.
  packRemaining: 0,
  active: false,
  reservationError: false,
  usageError: false,
  completionError: false,
  recoveryError: false,
  releaseError: false,
  completionRejected: false,
  recoveredScores: null as ScoringResult | null,
  cohort: "user" as string | null,
  referralSource: "reddit" as string | null,
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
        resolve({ count: testContext.usedCount, error: null });
      } as ChainMethod,
    };
    return {
      rpc: vi.fn((name: string, args: Record<string, unknown>) => ({
        abortSignal: async () => {
          // Mirrors scoring_usage: two free marks for life, then pack marks.
          const freeRemaining = Math.max(0, 2 - testContext.usedCount - Number(testContext.active));
          const usage = {
            used_successful: testContext.usedCount, free_used: Math.min(testContext.usedCount, 2),
            free_remaining: freeRemaining, pack_remaining: testContext.packRemaining,
            remaining: freeRemaining + testContext.packRemaining,
            active: testContext.active, lease_expires_at: testContext.active ? "2026-09-17T23:59:00Z" : null,
            next_expiry_at: testContext.packRemaining > 0 ? "2026-10-17T00:00:00Z" : null,
            // Transitional field the database still emits; the app must not echo it.
            reset_at: "2026-09-18T00:00:00Z",
          };
          if (name === "reserve_scoring") {
            if (testContext.reservationError) return { data: null, error: { message: "function missing" } };
            return { error: null, data: testContext.cohort !== "staff" && testContext.active
              ? { ...usage, code: "request_active" }
              : testContext.cohort !== "staff" && usage.remaining <= 0
                ? { ...usage, code: "quota_exhausted" } : { ...usage, id: "ph-1" } };
          }
          if (name === "complete_scoring") {
            if (testContext.completionError) throw new Error("lost completion response");
            if (testContext.completionRejected) return { data: { code: "reservation_expired" }, error: null };
            testContext.updatePayloads.push({ scores: args.p_scores, overall_band: args.p_overall_band });
            if (testContext.cohort !== "staff" && testContext.usedCount >= 2) testContext.packRemaining--;
            testContext.usedCount++;
            return { data: { submission: { scores: args.p_scores } }, error: null };
          }
          if (name === "release_scoring") {
            testContext.deletedIds.push(String(args.p_id));
            return { data: true, error: testContext.releaseError ? { message: "offline" } : null };
          }
          return { data: usage, error: testContext.usageError ? { message: "usage unavailable" } : null };
        },
      })),
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
                    return {
                      data: {
                        banned_at: "2026-07-01",
                        cohort: testContext.cohort,
                        referral_source: testContext.referralSource,
                      },
                      error: null,
                    };
                  }
                  return {
                    data: {
                      banned_at: null,
                      cohort: testContext.cohort,
                      referral_source: testContext.referralSource,
                    },
                    error: null,
                  };
                }),
              })),
            })),
          };
        }
        return { ...createChain,
          abortSignal() { return this; },
          maybeSingle: async () => ({ data: testContext.recoveredScores ? { scores: testContext.recoveredScores } : null,
            error: testContext.recoveryError ? { message: "offline" } : null }),
        };
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
    testContext = { isBanned: false, profileError: false, usedCount: 0, packRemaining: 0, active: false,
      reservationError: false, usageError: false, completionError: false, recoveryError: false, releaseError: false,
      completionRejected: false, recoveredScores: null,
      cohort: "user", referralSource: "reddit", deletedIds: [], updatePayloads: [], isDeleting: false };
    mockCreate.mockClear();
    mockGetUser.mockClear();
  });

  describe("Auth & Validation", () => {
    it.each([null, [], 3])("returns 400 for non-object request body %s", async (body) => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      expect((await POST(createRequest(body))).status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });
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

    it("refuses a spent mark before inserting a reservation or calling the model", async () => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.usedCount = 2;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json() as Record<string, unknown>;
      expect(data.code).toBe("quota_exhausted");
      expect(testContext.deletedIds).toEqual([]);
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("allows both lifetime free marks", async () => {
      // WHY: the allowance is two successful marks per account, not one per day
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
      const req = () => createRequest({ question: "Q?", essay: "Essay word count test", taskType: "TASK2" });
      testContext.usedCount = 0;
      expect((await POST(req())).status).toBe(200);
      testContext.usedCount = 1;
      const second = await POST(req());
      expect(second.status).toBe(200);
      expect((await second.json() as Record<string, unknown>).remaining).toBe(0);
    });

    it("draws on an unexpired pack once the free marks are spent", async () => {
      // WHY: a paid pack must unlock scoring, and only its own marks may be consumed
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.usedCount = 2;
      testContext.packRemaining = 20;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
      const res = await POST(createRequest({ question: "Q?", essay: "Essay word count test", taskType: "TASK2" }));
      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ remaining: 19, free_remaining: 0, pack_remaining: 19 });
      expect(mockCreate).toHaveBeenCalledTimes(1);
    });

    it("lets staff score past the free limit", async () => {
      // WHY: team accounts must be able to QA without burning a founding allowance
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.cohort = "staff";
      testContext.usedCount = 99;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay word count test", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.remaining).toBeNull();
    });
  });

  describe("Cohort gates", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    });

    it("treats a missing/unknown cohort as a limited user, never as staff", async () => {
      // WHY: fail closed on privilege — a null cohort must not unlock unlimited
      // scoring — but it must never lock anyone out either
      testContext.cohort = null;
      testContext.usedCount = 2;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json() as Record<string, unknown>;
      expect(data.code).toBe("quota_exhausted");
    });

    it("returns 403 onboarding_incomplete when attribution is missing", async () => {
      // WHY: attribution is the whole point of the gate — it must be enforced
      // server-side, not just by the UI redirect
      testContext.referralSource = null;
      const req = createRequest({ question: "Q?", essay: "Essay", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(403);
      const data = await res.json() as Record<string, unknown>;
      expect(data.code).toBe("onboarding_incomplete");
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it("exempts staff from the attribution requirement", async () => {
      // WHY: team accounts are created directly in Supabase and never see /welcome
      testContext.cohort = "staff";
      testContext.referralSource = null;
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
      const req = createRequest({ question: "Q?", essay: "Essay word count test", taskType: "TASK2" });
      const res = await POST(req);
      expect(res.status).toBe(200);
    });
  });

  describe("Retry Loop & Cleanup", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      testContext.usedCount = 0;
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

    it("returns 422 without retry or storage when model reports scorable:false", async () => {
      // WHY: a wrong-task-type refusal is a user mistake, not a score — it must not be
      // stored (dashboard pollution), must not consume quota, and must not retry
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: JSON.stringify({ scorable: false, detected_task: "TASK2", reason: "This is a Task 2 essay, not a letter." }) }, finish_reason: "stop" }],
      });
      const req = createRequest({ question: "Write a letter…", essay: "Some people think… Discuss both views.", taskType: "TASK1_GENERAL" });
      const res = await POST(req);
      expect(res.status).toBe(422);
      const data = await res.json() as Record<string, unknown>;
      expect(data.error).toBe("unscorable");
      expect(data.detectedTask).toBe("TASK2");
      expect(mockCreate).toHaveBeenCalledTimes(1); // no retry
      expect(testContext.deletedIds).toContain("ph-1"); // placeholder removed
      expect(testContext.updatePayloads).toEqual([]); // no score written
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
      testContext.usedCount = 0;
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
      expect(data.remaining).toBe(1);
      expect(data).toMatchObject({ used_successful: 1, free_remaining: 1, pack_remaining: 0, active: false, lease_expires_at: null, next_expiry_at: null });
      // The database still emits a transitional reset_at; the contract does not.
      expect(data).not.toHaveProperty("reset_at");
      expect(testContext.updatePayloads[0]).toHaveProperty("overall_band", 6.5);
      expect(testContext.deletedIds).toEqual([]);
    });
  });

  describe("Reservation failures", () => {
    beforeEach(() => {
      mockGetUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(validScoringJson()) }, finish_reason: "stop" }] });
    });
    const request = () => createRequest({ question: "Q?", essay: "An essay", taskType: "TASK2" });
    it("distinguishes active work from a spent mark without another model call", async () => {
      testContext.active = true;
      const res = await POST(request());
      expect(res.status).toBe(409);
      expect((await res.json()).code).toBe("request_active");
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it("fails closed when the migration is unavailable", async () => {
      testContext.reservationError = true;
      expect((await POST(request())).status).toBe(503);
      expect(mockCreate).not.toHaveBeenCalled();
    });
    it("rejects partial Band 9 output on both attempts and releases the reservation", async () => {
      mockCreate.mockResolvedValue({ choices: [{ message: { content: JSON.stringify({ ...validScoringJson(), criteria: { task_response: { band: 9 } } }) } }] });
      expect((await POST(request())).status).toBe(500);
      expect(mockCreate).toHaveBeenCalledTimes(2);
      expect(testContext.deletedIds).toEqual(["ph-1"]);
      expect(testContext.updatePayloads).toEqual([]);
    });
    it("recovers a committed result after a lost completion response without deleting it", async () => {
      testContext.completionError = true;
      testContext.recoveredScores = { ...validScoringJson(), overall_band: 7 };
      const res = await POST(request());
      expect(res.status).toBe(200);
      expect((await res.json()).overall_band).toBe(7);
      expect(testContext.deletedIds).toEqual([]);
    });
    it("preserves the saved score when allowance refresh fails, without implying unlimited scoring", async () => {
      testContext.usageError = true;
      const res = await POST(request());
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toMatchObject({ overall_band: 6.5, allowance_unavailable: true, user_id: "user-1" });
      expect(body).not.toHaveProperty("remaining");
      expect(body).not.toHaveProperty("error");
      expect(testContext.updatePayloads).toHaveLength(1);
      expect(testContext.deletedIds).toEqual([]);
    });
    it.each(["completionError", "completionRejected"] as const)("conditionally releases unfinished work on %s", async (failure) => {
      testContext[failure] = true;
      const res = await POST(request());
      expect(res.status).toBe(503);
      expect((await res.json()).overall_band).toBeUndefined();
      expect(testContext.deletedIds).toEqual(["ph-1"]);
    });
    it("reports an uncertain outcome when both recovery and release are unavailable", async () => {
      testContext.completionError = testContext.recoveryError = testContext.releaseError = true;
      const res = await POST(request());
      expect((await res.json()).code).toBe("outcome_uncertain");
      expect(testContext.deletedIds).toEqual(["ph-1"]);
    });
  });
});
