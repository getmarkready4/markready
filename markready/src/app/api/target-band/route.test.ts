import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  updateResponse: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({
    from: vi.fn(() => ({
      update: vi.fn((fields: Record<string, unknown>) => ({
        eq: vi.fn(() => ({
          select: vi.fn(async () => mocks.updateResponse(fields)),
        })),
      })),
      insert: vi.fn(async (fields: Record<string, unknown>) => ({
        data: null,
        error: mocks.updateResponse(fields),
      })),
    })),
  }),
}));

vi.mock("@/lib/rate-limit", () => ({
  checkRateLimit: () => ({ ok: true }),
}));

function createRequest(body: unknown): NextRequest {
  const text = JSON.stringify(body);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  const request = new Request("http://localhost/api/target-band", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "content-length": String(bytes.byteLength),
    },
    body: bytes,
  });

  return request as unknown as NextRequest;
}

describe("POST /api/target-band", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1", email: "test@example.com" } } });
    mocks.updateResponse.mockResolvedValue({ data: [{ id: "user-1" }], error: null });
  });

  it("returns 401 when user is not authenticated", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createRequest({ target: 6.5 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 for null JSON body", async () => {
    // WHY: null body would cause destructuring to throw; must be rejected early
    const req = new Request("http://localhost/api/target-band", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "null",
    }) as unknown as NextRequest;
    const res = await POST(req);
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.error).toBe("Invalid JSON body");
  });

  it("returns 400 for array JSON body", async () => {
    const req = createRequest([6.5]);
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it("returns 400 for invalid target value", async () => {
    const res = await POST(createRequest({ target: 6.3 }));
    expect(res.status).toBe(400);
    const data = await res.json() as Record<string, unknown>;
    expect(data.error).toContain("target must be");
  });

  it("updates existing profile row with writeProfile", async () => {
    const res = await POST(createRequest({ target: 6.5 }));
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.target_band).toBe(6.5);
  });

  it("inserts missing profile row if update returns no rows", async () => {
    // WHY: missing profile rows should be recreated, not silently ignored
    mocks.updateResponse.mockResolvedValueOnce({ data: [], error: null })
      .mockResolvedValueOnce({ data: { id: "user-1" }, error: null });
    const res = await POST(createRequest({ target: 7 }));
    expect(res.status).toBe(200);
  });

  it("clears target band when target is null", async () => {
    const res = await POST(createRequest({ target: null }));
    expect(res.status).toBe(200);
    const data = await res.json() as Record<string, unknown>;
    expect(data.target_band).toBeNull();
  });

  it("returns 500 when writeProfile fails", async () => {
    mocks.updateResponse.mockResolvedValue({ data: [{ id: "user-1" }], error: { message: "Database error" } });
    const res = await POST(createRequest({ target: 6.5 }));
    expect(res.status).toBe(500);
    const data = await res.json() as Record<string, unknown>;
    expect(data.error).toContain("Could not save");
  });

  it("accepts all valid IELTS band targets", async () => {
    const validBands = [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9];
    for (const band of validBands) {
      const res = await POST(createRequest({ target: band }));
      expect(res.status).toBe(200);
      const data = await res.json() as Record<string, unknown>;
      expect(data.target_band).toBe(band);
    }
  });
});
