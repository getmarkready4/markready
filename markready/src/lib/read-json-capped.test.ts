import { describe, it, expect } from "vitest";
import { readJsonCapped } from "./read-json-capped";

import type { NextRequest } from "next/server";

/**
 * Helper to create a NextRequest with a JSON body and optional Content-Length.
 */
function createRequest(body: unknown, contentLength?: number): NextRequest {
  const text = JSON.stringify(body);
  const encoder = new TextEncoder();
  const bytes = encoder.encode(text);

  const headers = new Headers();
  if (contentLength !== undefined) {
    headers.set("content-length", String(contentLength));
  } else {
    headers.set("content-length", String(bytes.byteLength));
  }

  return new Request("http://localhost/test", {
    method: "POST",
    headers,
    body: bytes,
  }) as unknown as NextRequest;
}

describe("readJsonCapped", () => {
  it("successfully reads and parses JSON within the cap", async () => {
    // WHY: valid requests within the quota should parse successfully
    const body = { essay: "test essay", score: 7.5 };
    const req = createRequest(body);
    const result = await readJsonCapped(req, 10000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(body);
    }
  });

  it("rejects bodies exceeding the cap", async () => {
    // WHY: oversized bodies must be rejected before memory is exhausted
    const largeBody = { essay: "x".repeat(10000) };
    const req = createRequest(largeBody);
    const result = await readJsonCapped(req, 1000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
    }
  });

  it("rejects Content-Length header exceeding the cap", async () => {
    // WHY: Content-Length should allow fast rejection without streaming
    const body = { test: "data" };
    const req = createRequest(body, 5000); // Declare 5000 but cap is 1000
    const result = await readJsonCapped(req, 1000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("too_large");
    }
  });

  it("rejects malformed JSON", async () => {
    // WHY: invalid JSON should return a structured error, not throw
    const encoder = new TextEncoder();
    const malformed = encoder.encode("{ invalid json }");

    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-length": String(malformed.byteLength) },
      body: malformed,
    }) as unknown as NextRequest;

    const result = await readJsonCapped(req, 10000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe("invalid_json");
    }
  });

  it("handles empty JSON object", async () => {
    // WHY: edge case of minimal valid JSON should work
    const body = {};
    const req = createRequest(body);
    const result = await readJsonCapped(req, 100);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual({});
    }
  });

  it("handles JSON arrays", async () => {
    // WHY: arrays are valid JSON and should parse correctly
    const body = [1, 2, 3, "four"];
    const req = createRequest(body);
    const result = await readJsonCapped(req, 1000);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(body);
    }
  });

  it("preserves multi-byte UTF-8 characters split across chunk boundaries", async () => {
    // WHY: essays contain em-dashes, curly quotes, accented characters;
    // a multi-byte char split mid-sequence across chunks must decode without corruption
    const essay = { text: "Hello—world’s café" }; // em-dash, right quote, accented e
    const text = JSON.stringify(essay);
    const encoder = new TextEncoder();
    const fullBytes = encoder.encode(text);

    // Create a request and manually split the body to break multi-byte sequences.
    // We'll split at position 10 to ensure we split mid-UTF-8 sequence.
    const part1 = fullBytes.slice(0, 10);
    const part2 = fullBytes.slice(10);

    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: new ReadableStream({
        start(controller) {
          controller.enqueue(part1);
          controller.enqueue(part2);
          controller.close();
        },
      }),
      // `duplex` is required for a streaming body but is absent from the DOM RequestInit type.
      duplex: "half",
    } as unknown as RequestInit) as unknown as NextRequest;

    const result = await readJsonCapped(req, 10000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      // Verify the exact text round-trips without replacement characters
      expect(result.data).toEqual(essay);
      const decoded = result.data as { text: string };
      expect(decoded.text).toBe("Hello—world’s café");
      // Ensure no U+FFFD replacement chars (which would indicate corruption)
      expect(decoded.text).not.toContain("�");
    }
  });

  it("accepts small valid body despite malformed Content-Length", async () => {
    // WHY: a garbage Content-Length (e.g., from a misconfigured proxy) must not reject valid small bodies
    const body = { essay: "test" };
    const encoder = new TextEncoder();
    const bytes = encoder.encode(JSON.stringify(body));

    const req = new Request("http://localhost/test", {
      method: "POST",
      headers: { "content-length": "chunked" }, // Malformed, but body is valid
      body: bytes,
    }) as unknown as NextRequest;

    const result = await readJsonCapped(req, 10000);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data).toEqual(body);
    }
  });
});
