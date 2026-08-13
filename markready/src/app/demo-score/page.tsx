import { notFound } from "next/navigation";
import { DemoScoreClient } from "./DemoScoreClient";

/**
 * Scratch page for reviewing the animated score reveal with mock data, without
 * needing a session or spending an OpenRouter call.
 *
 * It is deliberately unauthenticated, so it must never be reachable in
 * production. VERCEL_ENV is "production" only on the production deployment —
 * previews report "preview" and local dev reports undefined — so this 404s
 * where it matters while staying available where it is useful. A guard rather
 * than a "remember to delete this" comment, because those get forgotten.
 */
export default function DemoScorePage() {
  if (process.env.VERCEL_ENV === "production") notFound();
  return <DemoScoreClient />;
}
