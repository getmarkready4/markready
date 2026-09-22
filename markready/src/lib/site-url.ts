// Server-only: contains env vars that are not NEXT_PUBLIC_*, so importing into
// "use client" components would silently yield the fallback and lose the real origin.

/**
 * Resolve the canonical origin: NEXT_PUBLIC_SITE_URL environment variable,
 * falling back to VERCEL_PROJECT_PRODUCTION_URL, then to the alpha URL.
 */
export function getSiteUrl(): string {
  // User-supplied or CI-set override
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    try {
      const url = new URL(process.env.NEXT_PUBLIC_SITE_URL);
      return url.origin;
    } catch {
      // Invalid URL; fall through to next option
    }
  }

  // Vercel build environment variable (not NEXT_PUBLIC, so only available at build time)
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }

  // Fallback to alpha
  return "https://markready-alpha.vercel.app";
}
