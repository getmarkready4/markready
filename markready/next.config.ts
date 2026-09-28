import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    // Derive Supabase origin from NEXT_PUBLIC_SUPABASE_URL at build time, fall back to wildcard.
    let supabaseOrigin = "https://*.supabase.co";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (supabaseUrl) {
      try {
        const url = new URL(supabaseUrl);
        supabaseOrigin = url.origin;
      } catch {
        // Unparseable or missing; use wildcard fallback.
      }
    }

    // X-Frame-Options and frame-ancestors 'none' are intentionally redundant:
    // frame-ancestors supersedes in CSP2+ browsers; XFO covers older agents.
    const unsafeEval = process.env.NODE_ENV === "development" ? " 'unsafe-eval'" : "";
    const csp = [
      "default-src 'self'",
      `script-src 'self' 'unsafe-inline'${unsafeEval} https://challenges.cloudflare.com`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      `connect-src 'self' ${supabaseOrigin} wss:${supabaseOrigin.replace(/^https?:/, "")} https://challenges.cloudflare.com`,
      "frame-src https://challenges.cloudflare.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "object-src 'none'",
    ].join("; ");

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
