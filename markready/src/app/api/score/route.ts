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
import { parseScoringResult } from "@/lib/parse-scoring";

const client = new OpenAI({
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

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const serviceClient = createServiceClient();

  // Step 1 — Auth check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Step 2 — Ban check
  const { data: profile, error: profileError } = await serviceClient
    .from("profiles")
    .select("banned_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) {
    return NextResponse.json({ error: "Unable to verify account status" }, { status: 500 });
  }
  if (profile?.banned_at) {
    return NextResponse.json({ error: "Account suspended" }, { status: 403 });
  }

  // Step 3 — Parse and validate body
  let body: unknown;
  try {
    body = await req.json();
  } catch {
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

  // Step 4 — Insert placeholder row first
  const { data: placeholder, error: placeholderError } = await serviceClient
    .from("submissions")
    .insert({
      user_id: user.id,
      task_type: resolvedTaskType,
      question,
      essay,
      scores: null,
      overall_band: null,
    })
    .select("id")
    .single();

  if (placeholderError || !placeholder) {
    console.error("Placeholder insert failed:", placeholderError?.message);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  const placeholderId = placeholder.id;

  // Step 5 — Daily cap check (10/day, resets at UTC midnight)
  // Count query excludes stale null-score placeholders (>5 min old)
  const utcMidnight = new Date();
  utcMidnight.setUTCHours(0, 0, 0, 0);
  const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

  const { count } = await serviceClient
    .from("submissions")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .gte("created_at", utcMidnight.toISOString())
    .or(`scores.not.is.null,created_at.gte.${fiveMinAgo}`);

  if ((count ?? 0) > 10) {
    // Delete placeholder and reject
    const { error: deleteError } = await serviceClient
      .from("submissions")
      .delete()
      .eq("id", placeholderId);
    if (deleteError) {
      console.error("Placeholder delete failed:", deleteError.message);
    }
    return NextResponse.json(
      { error: "Daily limit reached", reset: "midnight UTC" },
      { status: 429 }
    );
  }

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
  let lastFailure: "api" | "parse" = "api";

  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    let raw: string;
    try {
      raw = await callModel(effectiveSystemPrompt, userContent, activeModel);
    } catch (err) {
      console.error(`Attempt ${attempt + 1} API error:`, err);
      lastFailure = "api";
      continue;
    }

    result = parseScoringResult(raw);
    if (!result) {
      console.error(`Attempt ${attempt + 1} parse/validation failed. Raw:`, raw);
      lastFailure = "parse";
    }
  }

  if (!result) {
    // Delete placeholder on terminal failure
    const { error: deleteError } = await serviceClient
      .from("submissions")
      .delete()
      .eq("id", placeholderId);
    if (deleteError) {
      console.error("Placeholder delete failed:", deleteError.message);
    }

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

  // Step 8 — Update placeholder with scores
  const { error: updateError } = await serviceClient
    .from("submissions")
    .update({
      scores: result,
      overall_band: result.overall_band,
    })
    .eq("id", placeholderId);

  if (updateError) {
    console.error("Submission update failed:", updateError.message);
    return NextResponse.json({ error: "Failed to save submission" }, { status: 500 });
  }

  // Return result with remaining_today
  const remaining_today = Math.max(0, 10 - (count ?? 0));

  return NextResponse.json({ ...result, remaining_today });
}
