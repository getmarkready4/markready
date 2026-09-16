import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import type { ChatCompletionContentPart, ChatCompletionContentPartText } from "openai/resources/chat/completions";
import {
  IELTS_TASK2_SYSTEM_PROMPT,
  IELTS_TASK1_ACADEMIC_SYSTEM_PROMPT,
  IELTS_TASK1_GENERAL_SYSTEM_PROMPT,
} from "@/lib/system-prompt";
import type { ScoringResult, TaskType } from "@/types/scoring";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { parseScoringResult, extractJson } from "@/lib/parse-scoring";
import { getScoringUsage, remainingToday, isCohort, DAILY_FREE_LIMIT, type Cohort } from "@/lib/quota";
import type { SupabaseClient } from "@supabase/supabase-js";

export const maxDuration = 240;

/** Conditional database release can never remove a completed score. */
async function releaseReservation(service: SupabaseClient, userId: string, id: string) {
  try {
    const { error } = await service.rpc("release_scoring", { p_user_id: userId, p_id: id })
      .abortSignal(AbortSignal.timeout(10_000));
    return !error;
  } catch {
    return false;
  }
}

function uncertainOutcome() {
  return NextResponse.json({ code: "outcome_uncertain", error: "We could not confirm the result. Check My progress before trying again; an unfinished request expires within five minutes." }, { status: 503 });
}

const client = new OpenAI({
  maxRetries: 0,
  timeout: 90_000,
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: process.env.OPENROUTER_API_KEY,
  defaultHeaders: {
    "HTTP-Referer": "https://markready.app",
    "X-Title": "MarkReady",
  },
});

const MODEL = process.env.OPENROUTER_MODEL ?? "anthropic/claude-haiku-4.5";
const MODEL_OVERRIDE_ALLOWED =
  process.env.NODE_ENV === "development" ||
  process.env.ALLOW_MODEL_OVERRIDE === "1";

const MAX_QUESTION_CHARS = 5_000;
const MAX_ESSAY_CHARS = 30_000;
// Length of the base64 *data-URI string* (NOT bytes, NOT file.size).
// Client-downscaled 1024px JPEGs are < ~300k chars; a raw 10MB upload
// base64-encodes to ~13.3M chars and is rejected.
const MAX_IMAGE_DATA_URI_CHARS = 2_000_000;

const SYSTEM_PROMPTS: Record<TaskType, string> = {
  TASK2: IELTS_TASK2_SYSTEM_PROMPT,
  TASK1_ACADEMIC: IELTS_TASK1_ACADEMIC_SYSTEM_PROMPT,
  TASK1_GENERAL: IELTS_TASK1_GENERAL_SYSTEM_PROMPT,
};

function getAllowedModels(): Set<string> {
  const allowedModelsEnv = process.env.OPENROUTER_ALLOWED_MODELS ?? "";
  if (!allowedModelsEnv.trim()) {
    return new Set();
  }
  return new Set(
    allowedModelsEnv.split(",").map((m) => m.trim()).filter((m) => m.length > 0)
  );
}

async function callModel(
  systemPrompt: string,
  userContent: string | Array<ChatCompletionContentPart>,
  model: string
): Promise<string> {
  const completion = await client.chat.completions.create({
    model,
    max_tokens: 4000,
    temperature: 0,
    messages: [
      {
        role: "system",
        content: [
          {
            type: "text",
            text: systemPrompt,
            cache_control: { type: "ephemeral" },
          } as ChatCompletionContentPartText & { cache_control: { type: string } },
        ],
      },
      { role: "user", content: userContent },
    ],
  });

  if (completion.choices[0]?.finish_reason === "length") {
    throw new Error("truncated");
  }

  return completion.choices[0]?.message?.content ?? "";
}

type Unscorable = { reason: string; detectedTask?: string };

// The model returns { "scorable": false, ... } when the candidate response is a
// different task type than the selected rubric (e.g. a Task 2 essay submitted for
// letter scoring). These are user mistakes, not scores — the route must NOT store
// them or consume the daily quota, and must not retry (the verdict is deterministic).
function detectUnscorable(raw: string): Unscorable | null {
  let obj: unknown;
  try {
    obj = JSON.parse(extractJson(raw));
  } catch {
    return null;
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  if (o.scorable !== false) return null;
  return {
    reason:
      typeof o.reason === "string" && o.reason.trim()
        ? o.reason.trim()
        : "This response doesn't match the selected task type.",
    detectedTask: typeof o.detected_task === "string" ? o.detected_task : undefined,
  };
}

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // Step 1 — Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Step 2 — Ban, cohort, and onboarding checks
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("banned_at, cohort, referral_source")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Unable to verify account status" }, { status: 500 });
  }
  if (profile?.banned_at) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  // Unknown or missing cohort is a regular user: limited, never locked out,
  // never staff.
  const cohort: Cohort = isCohort(profile?.cohort) ? profile.cohort : "user";

  if (cohort !== "staff" && !profile?.referral_source) {
    return NextResponse.json(
      { error: "Tell us how you found us first", code: "onboarding_incomplete" },
      { status: 403 }
    );
  }

  // Step 3 — Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  const { question, essay, taskType, model, image } = body as Record<string, unknown>;

  if (typeof question !== "string" || typeof essay !== "string") {
    return NextResponse.json(
      { error: "question and essay are required" },
      { status: 400 }
    );
  }

  const validTaskTypes = ["TASK2", "TASK1_ACADEMIC", "TASK1_GENERAL"];
  let resolvedTaskType: TaskType;

  if (taskType === undefined) {
    resolvedTaskType = "TASK2";
  } else if (typeof taskType === "string" && validTaskTypes.includes(taskType)) {
    resolvedTaskType = taskType as TaskType;
  } else {
    return NextResponse.json({ error: "invalid taskType" }, { status: 400 });
  }

  if (model !== undefined && typeof model !== "string") {
    return NextResponse.json({ error: "Invalid model parameter" }, { status: 400 });
  }

  if (image !== undefined && image !== null && typeof image !== "string") {
    return NextResponse.json({ error: "Invalid image parameter" }, { status: 400 });
  }

  if (!question.trim() || !essay.trim()) {
    return NextResponse.json(
      { error: "question and essay are required" },
      { status: 400 }
    );
  }

  if (question.length > MAX_QUESTION_CHARS) {
    return NextResponse.json(
      { error: `Question exceeds maximum length of ${MAX_QUESTION_CHARS} characters` },
      { status: 400 }
    );
  }

  if (essay.length > MAX_ESSAY_CHARS) {
    return NextResponse.json(
      { error: `Essay exceeds maximum length of ${MAX_ESSAY_CHARS} characters` },
      { status: 400 }
    );
  }

  const ALLOWED_PREFIXES = [
    "data:image/png;base64,",
    "data:image/jpeg;base64,",
    "data:image/jpg;base64,",
    "data:image/webp;base64,",
  ];
  const validImage: string | null =
    image && ALLOWED_PREFIXES.some((p) => image.startsWith(p)) ? image : null;

  if (image && !validImage) {
    return NextResponse.json(
      { error: "Image must be a valid base64 data-URI (PNG, JPEG, JPG, or WebP)" },
      { status: 400 }
    );
  }

  if (validImage && validImage.length > MAX_IMAGE_DATA_URI_CHARS) {
    return NextResponse.json(
      { error: `Image exceeds maximum size of ${MAX_IMAGE_DATA_URI_CHARS} characters` },
      { status: 400 }
    );
  }

  // Gate the model override: outside dev, must be in OPENROUTER_ALLOWED_MODELS
  let activeModel = MODEL;
  if (model && MODEL_OVERRIDE_ALLOWED) {
    if (process.env.NODE_ENV === "development") {
      activeModel = model;
    } else {
      const allowedModels = getAllowedModels();
      if (allowedModels.has(model)) {
        activeModel = model;
      }
    }
  }

  // Atomic service-only reservation. A missing migration fails closed.
  let reservation;
  try {
    reservation = await serviceClient.rpc("reserve_scoring", {
      p_user_id: user.id, p_task_type: resolvedTaskType, p_question: question, p_essay: essay,
    }).abortSignal(AbortSignal.timeout(10_000));
  } catch {
    return uncertainOutcome();
  }
  if (reservation.error || !reservation.data) return uncertainOutcome();
  const slot = reservation.data;
  if (slot.code === "request_active" || slot.code === "quota_exhausted") {
    return NextResponse.json({ ...slot, limit: DAILY_FREE_LIMIT,
      error: slot.code === "request_active" ? "A scoring request is already in progress." : "You've used today's free mark",
    }, { status: slot.code === "request_active" ? 409 : 403 });
  }
  if (typeof slot.id !== "string") return uncertainOutcome();
  const placeholderId = slot.id;

  const systemPrompt = SYSTEM_PROMPTS[resolvedTaskType];
  const userMessage = `TASK QUESTION:\n${question}\n\nCANDIDATE RESPONSE:\n${essay}\n\nScore this response now.`;

  const effectiveSystemPrompt =
    validImage && resolvedTaskType === "TASK1_ACADEMIC"
      ? systemPrompt +
        "\n\nIMAGE PROVIDED: The Task 1 chart/diagram IS attached to this message. " +
        "NO-VISUAL MODE (rule 7) does NOT apply — verify the figures and key-feature " +
        "selection against the image and assess Task Achievement (including data accuracy) normally."
      : systemPrompt;

  const userContent: string | Array<ChatCompletionContentPart> =
    validImage && resolvedTaskType === "TASK1_ACADEMIC"
      ? [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: { url: validImage } },
        ]
      : userMessage;

  // Step 6 — Call model with retry loop
  let result: ScoringResult | null = null;
  let unscorable: Unscorable | null = null;
  let lastFailure: "api" | "parse" = "api";

  for (let attempt = 0; attempt < 2 && !result && !unscorable; attempt++) {
    let raw: string;
    try {
      raw = await callModel(effectiveSystemPrompt, userContent, activeModel);
    } catch (err) {
      console.error(`Attempt ${attempt + 1} API error:`, err);
      lastFailure = "api";
      continue;
    }

    // Wrong task type for this rubric — deterministic refusal, no retry
    unscorable = detectUnscorable(raw);
    if (unscorable) break;

    result = parseScoringResult(raw, resolvedTaskType);
    if (!result) {
      console.error(`Attempt ${attempt + 1} parse/validation failed. Raw:`, raw);
      lastFailure = "parse";
    }
  }

  // Unscorable — delete placeholder, store no band, consume no quota
  if (unscorable) {
    if (!await releaseReservation(serviceClient, user.id, placeholderId)) return uncertainOutcome();
    return NextResponse.json(
      { error: "unscorable", reason: unscorable.reason, detectedTask: unscorable.detectedTask },
      { status: 422 }
    );
  }

  if (!result) {
    if (!await releaseReservation(serviceClient, user.id, placeholderId)) return uncertainOutcome();

    if (lastFailure === "api") {
      return NextResponse.json(
        { error: "Scoring service unavailable. Please try again." },
        { status: 502 }
      );
    } else {
      return NextResponse.json(
        { error: "Failed to parse scoring response. Please try again." },
        { status: 500 }
      );
    }
  }

  // Step 7 — Compute and overwrite word_count and overall_band
  result.word_count = essay.trim().split(/\s+/).length;

  const meanBand = Object.values(result.criteria)
    .reduce((sum, criterion) => sum + (criterion?.band ?? 0), 0) /
    Math.max(1, Object.keys(result.criteria).length);
  result.overall_band = Math.max(1, Math.min(9, Math.round(meanBand * 2) / 2));

  // Only return database-confirmed scores. A lost completion response is not
  // proof of failure: recover by UUID before attempting a conditional release.
  let saved: { scores: ScoringResult } | null = null;
  try {
    const completion = await serviceClient.rpc("complete_scoring", {
      p_user_id: user.id, p_id: placeholderId, p_scores: result, p_overall_band: result.overall_band,
    }).abortSignal(AbortSignal.timeout(10_000));
    if (!completion.error) saved = completion.data?.submission ?? null;
  } catch { /* Reconcile uncertain completion below. */ }
  if (!saved?.scores) {
    try {
      const recovery = await serviceClient.from("submissions").select("scores")
        .eq("id", placeholderId).eq("user_id", user.id)
        .abortSignal(AbortSignal.timeout(10_000)).maybeSingle();
      if (!recovery.error && recovery.data?.scores) saved = recovery.data;
    } catch { /* Conditional release remains safe even if this read failed. */ }
  }
  if (!saved?.scores) {
    const released = await releaseReservation(serviceClient, user.id, placeholderId);
    if (!released) return uncertainOutcome();
    // A completion may have committed while recovery was unavailable. Never
    // promise that quota was restored or report an unsaved computed result.
    return uncertainOutcome();
  }
  const usage = await getScoringUsage(serviceClient, user.id);
  if (!usage) {
    return NextResponse.json({ ...saved.scores, user_id: user.id, allowance_unavailable: true });
  }
  return NextResponse.json({ ...saved.scores, user_id: user.id,
    ...usage,
    remaining: remainingToday(cohort, usage.used_successful, usage.active),
  });
}
