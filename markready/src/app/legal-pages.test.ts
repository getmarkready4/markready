import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * Test that legal page placeholders are actually substituted in rendered output.
 * An unsubstituted placeholder like [LINK TO REFUND POLICY] renders as literal
 * bracket text on the live legal page, which is a data-accuracy bug.
 */
describe("Legal pages placeholder substitution", () => {
  it("terms page: all [LINK TO] placeholders in content have handlers in withPolicyLinks regex", () => {
    // WHY: an unsubstituted placeholder renders as literal "[LINK TO ...]" text on the
    // public legal page. This breaks both user experience and data accuracy, and
    // indicates a mismatch between placeholder in content and handler in withPolicyLinks().
    // This exact bug shipped in an earlier draft (REFUND vs RETURN mismatch).

    // Read the actual terms page source
    const termsPath = path.join(__dirname, "terms", "page.tsx");
    const termsSource = fs.readFileSync(termsPath, "utf-8");

    // Extract all [LINK TO ...] patterns from the SECTIONS data
    const placeholderMatches = termsSource.match(/\[LINK TO [^\]]+\]/g) || [];
    const placeholders = new Set(placeholderMatches);

    // Extract the regex pattern from withPolicyLinks
    const regexMatch = termsSource.match(/split\(\/\(([^)]+)\)\//);
    expect(regexMatch).toBeTruthy();
    const regexPattern = regexMatch?.[1] || "";

    // Each placeholder must appear in the regex pattern
    for (const placeholder of placeholders) {
      expect(regexPattern).toContain(placeholder.slice(1, -1)); // Remove [ and ]
    }
  });

  it("privacy page has no [LINK TO] placeholders", () => {
    // WHY: privacy page does not use withPolicyLinks (all text is inline), so this
    // test confirms privacy content has no placeholder patterns at all, since privacy
    // is meant to have inline text only, no placeholders to substitute.
    const privacyPath = path.join(__dirname, "privacy", "page.tsx");
    const privacySource = fs.readFileSync(privacyPath, "utf-8");

    // Privacy should not contain any [LINK TO placeholders
    expect(privacySource).not.toContain("[LINK TO");
  });
});
