import type { NextRequest } from "next/server";

type ReadResult =
  | { ok: true; data: unknown }
  | { ok: false; reason: "too_large" | "unreadable" | "invalid_json" };

/**
 * Read and parse a request body with a byte cap. Rejects early if Content-Length
 * declares an oversized body; checks a running byte counter while streaming to
 * abort if chunked transfer exceeds the cap. Returns a discriminated result
 * object; parse failures or size violations are never thrown.
 *
 * @param req NextRequest with a readable body stream
 * @param maxBytes Cap in bytes; requests exceeding this return { ok: false, reason: "too_large" }
 * @returns { ok: true, data: parsed object } or { ok: false, reason: discriminant }
 */
export async function readJsonCapped(
  req: NextRequest,
  maxBytes: number
): Promise<ReadResult> {
  // Check Content-Length if present as a fast reject (client-supplied hint only).
  // If Content-Length is absent or unparseable, fall through to the streaming reader.
  // Only reject early if it parses to a non-negative number exceeding the cap.
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const bytes = parseInt(contentLength, 10);
    // Only reject if the header parsed cleanly AND the value exceeds the cap.
    // Malformed headers (e.g., "chunked") are treated as absent.
    if (!isNaN(bytes) && bytes >= 0 && bytes > maxBytes) {
      return { ok: false, reason: "too_large" };
    }
  }

  // Read body with running byte counter
  const reader = req.body?.getReader();
  if (!reader) {
    return { ok: false, reason: "unreadable" };
  }

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        reader.cancel();
        return { ok: false, reason: "too_large" };
      }

      chunks.push(value);
    }
  } catch (err) {
    console.error("Failed to read request body:", err);
    reader.cancel();
    return { ok: false, reason: "unreadable" };
  }

  // Decode with proper handling of multi-byte UTF-8 characters split across chunks.
  // Use TextDecoder.decode(chunk, { stream: true }) to buffer incomplete sequences,
  // then final decode() to flush.
  let text = "";
  const decoder = new TextDecoder();
  try {
    for (const chunk of chunks) {
      text += decoder.decode(chunk, { stream: true });
    }
    text += decoder.decode(); // final flush for incomplete sequences
  } catch (err) {
    console.error("Failed to decode request body as UTF-8:", err);
    reader.cancel();
    return { ok: false, reason: "unreadable" };
  }

  // Parse JSON
  try {
    const data = JSON.parse(text);
    return { ok: true, data };
  } catch (err) {
    console.error("Failed to parse JSON body:", err instanceof Error ? err.message : String(err));
    return { ok: false, reason: "invalid_json" };
  }
}
