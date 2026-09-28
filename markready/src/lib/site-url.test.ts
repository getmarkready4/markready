import { describe, it, expect, afterEach } from "vitest";
import { getSiteUrl } from "./site-url";

describe("getSiteUrl", () => {
  const original = { ...process.env };

  afterEach(() => {
    // WHY: restore original env to avoid test pollution
    process.env = { ...original };
  });

  it("uses NEXT_PUBLIC_SITE_URL when set", () => {
    // WHY: user-supplied var should take precedence for explicit overrides
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("normalizes trailing slash in NEXT_PUBLIC_SITE_URL", () => {
    // WHY: origin should be consistent whether user includes trailing slash or not
    process.env.NEXT_PUBLIC_SITE_URL = "https://example.com/";
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getSiteUrl()).toBe("https://example.com");
  });

  it("falls back to VERCEL_PROJECT_PRODUCTION_URL when NEXT_PUBLIC_SITE_URL is unset", () => {
    // WHY: Vercel env var is the second preference for canonical origin
    delete process.env.NEXT_PUBLIC_SITE_URL;
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    expect(getSiteUrl()).toBe("https://prod.vercel.app");
  });

  it("falls back to alpha URL when both vars are unset", () => {
    // WHY: dev/local runs need a fallback that won't error
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.VERCEL_PROJECT_PRODUCTION_URL;
    expect(getSiteUrl()).toBe("https://markready-alpha.vercel.app");
  });

  it("ignores unparseable NEXT_PUBLIC_SITE_URL and falls back", () => {
    // WHY: malformed user input should not break the fallback chain
    process.env.NEXT_PUBLIC_SITE_URL = "not a valid url";
    process.env.VERCEL_PROJECT_PRODUCTION_URL = "prod.vercel.app";
    expect(getSiteUrl()).toBe("https://prod.vercel.app");
  });
});
