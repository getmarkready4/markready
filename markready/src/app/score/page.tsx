"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { ScoringResult, TaskType } from "@/types/scoring";
import { MIN_WORDS } from "@/types/scoring";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ScoreReport } from "@/components/ScoreReport";
import { SignOutButton } from "@/components/SignOutButton";

const SAMPLE_QUESTIONS: Record<TaskType, { id: string; text: string }[]> = {
  TASK2: [
    {
      id: "crime",
      text: "Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your own opinion.",
    },
    {
      id: "technology",
      text: "Some people believe that technology has made our lives more complex, and the solution is to lead simpler lives without modern technology. To what extent do you agree or disagree?",
    },
    {
      id: "education",
      text: "In many countries, the traditional family model has changed, with women now forming a large part of the workforce. What are the advantages and disadvantages of this change?",
    },
    {
      id: "environment",
      text: "The increasing population is putting pressure on natural resources and the environment. What are the causes of this problem and what measures can be taken to address it?",
    },
  ],
  TASK1_ACADEMIC: [
    {
      id: "museum",
      text: "The table below shows the numbers of visitors to Ashdown Museum during the year before and the year after it was refurbished. The charts show the result of surveys asking visitors how satisfied they were with their visit. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "co2",
      text: "The graph below shows the changes in the emission of carbon dioxide in four European countries between 1967 and 2007. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "water",
      text: "The diagrams below show the percentage of water used for different purposes in six areas of the world. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
  ],
  TASK1_GENERAL: [
    {
      id: "neighbour",
      text: "You have recently moved to a new area. Write a letter to your new neighbour. In your letter: introduce yourself, describe the area you have moved from, invite your neighbour to visit you.",
    },
    {
      id: "complaint",
      text: "You recently bought a piece of equipment for your home but it did not work. Write a letter to the shop manager. In your letter: describe what you bought, explain the problem, say what you want the manager to do.",
    },
  ],
};

const TASK_DESCRIPTIONS: Record<TaskType, string> = {
  TASK2: "Write an essay of at least 250 words responding to the prompt.",
  TASK1_ACADEMIC: "Describe a graph, chart, table or diagram in at least 150 words. Include an overview of the main trends.",
  TASK1_GENERAL: "Write a letter of at least 150 words addressing all bullet points in the prompt.",
};

const LOADING_MESSAGES = [
  "Reading your response the way an examiner would…",
  "Assessing task requirements and key features…",
  "Checking coherence, paragraphing, and cohesive devices…",
  "Evaluating vocabulary range and precision…",
  "Analysing grammatical range and accuracy…",
  "Generating your personalised feedback…",
];

const TASK_TABS: { type: TaskType; label: string }[] = [
  { type: "TASK2", label: "Task 2" },
  { type: "TASK1_ACADEMIC", label: "Task 1 — Academic" },
  { type: "TASK1_GENERAL", label: "Task 1 — General" },
];

async function downscaleImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX = 1024;
      const scale = Math.min(1, MAX / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}

export default function ScorePage() {
  const router = useRouter();
  const [taskType, setTaskType] = useState<TaskType>("TASK2");
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS.TASK2[0].text);
  const [customQuestion, setCustomQuestion] = useState(false);
  const [essay, setEssay] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(0);
  const [result, setResult] = useState<ScoringResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [imageDataUri, setImageDataUri] = useState<string | null>(null);
  const [remainingToday, setRemainingToday] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const minWords = MIN_WORDS[taskType];
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  function switchTaskType(t: TaskType) {
    setTaskType(t);
    setQuestion(SAMPLE_QUESTIONS[t][0].text);
    setCustomQuestion(false);
    setResult(null);
    setError(null);
    setImageDataUri(null);
    setRemainingToday(null);
  }

  async function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const ALLOWED = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!ALLOWED.includes(file.type)) {
      setError("Please attach a PNG, JPEG, or WebP image.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("Image must be under 10 MB.");
      return;
    }
    try {
      const dataUri = await downscaleImage(file);
      setImageDataUri(dataUri);
    } catch {
      setError("Could not process image. Please try another file.");
    }
  }

  async function handleScore() {
    setError(null);
    setResult(null);
    setLoading(true);
    setLoadingMsg(0);

    intervalRef.current = setInterval(() => {
      setLoadingMsg((m) => Math.min(m + 1, LOADING_MESSAGES.length - 1));
    }, 2500);

    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question, essay, taskType, image: taskType === "TASK1_ACADEMIC" ? imageDataUri : null }),
      });
      if (res.status === 429) {
        setError("You've reached today's limit of 10 evaluations. Resets at midnight UTC.");
        return;
      }
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        const remainingToday = typeof data.remaining_today === "number" ? data.remaining_today : null;
        setRemainingToday(remainingToday);
        setResult(data);
      }
    } catch {
      setError("Network error. Please check your connection and try again.");
    } finally {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#FAF8F3]">
      {/* Header */}
      <header className="border-b border-[#E4DFD3] bg-[#FAF8F3]/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <span className="font-serif text-xl font-semibold text-[#23282B]">MarkReady</span>
          <div className="flex items-center gap-4">
            {userEmail && <span className="text-sm text-gray-500">{userEmail}</span>}
            <Link href="/dashboard" className="text-sm text-[#1F5C4E] hover:text-[#154136]">
              My progress
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-10 space-y-8">
        {/* Input */}
        {!result && !loading && (
          <>
            <div>
              <h1 className="font-serif text-3xl font-semibold text-[#23282B] mb-2">
                Score my essay
              </h1>
              <p className="text-[#5B6266]">
                Examiner-level feedback in under 15 seconds.
              </p>
            </div>

            {/* Task type tabs */}
            <div className="flex gap-1 p-1 bg-[#F2EEE5] rounded-xl">
              {TASK_TABS.map((tab) => (
                <button
                  key={tab.type}
                  onClick={() => switchTaskType(tab.type)}
                  className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium transition-colors ${
                    taskType === tab.type
                      ? "bg-white text-[#23282B] shadow-sm"
                      : "text-[#5B6266] hover:text-[#23282B]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <p className="text-xs text-[#5B6266] -mt-4">{TASK_DESCRIPTIONS[taskType]}</p>

            {/* Question */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#23282B]">
                {taskType === "TASK1_GENERAL" ? "Letter prompt" : "Question / prompt"}
              </label>
              {!customQuestion ? (
                <>
                  <select
                    className="w-full border border-[#E4DFD3] rounded-xl px-4 py-3 text-sm bg-white text-[#23282B] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  >
                    {SAMPLE_QUESTIONS[taskType].map((q) => (
                      <option key={q.id} value={q.text}>
                        {q.text.length > 85 ? q.text.slice(0, 85) + "…" : q.text}
                      </option>
                    ))}
                  </select>
                  <button
                    className="text-xs text-[#1F5C4E] hover:underline"
                    onClick={() => { setCustomQuestion(true); setQuestion(""); }}
                  >
                    Use my own question instead
                  </button>
                </>
              ) : (
                <>
                  <textarea
                    className="w-full border border-[#E4DFD3] rounded-xl px-4 py-3 text-sm bg-white text-[#23282B] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30 resize-none"
                    rows={4}
                    placeholder="Paste your question or prompt here…"
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                  />
                  <button
                    className="text-xs text-[#5B6266] hover:underline"
                    onClick={() => { setCustomQuestion(false); setQuestion(SAMPLE_QUESTIONS[taskType][0].text); }}
                  >
                    Use a sample question instead
                  </button>
                </>
              )}
            </div>

            {/* Image upload for Task 1 Academic */}
            {taskType === "TASK1_ACADEMIC" && (
              <div className="space-y-3 rounded-xl border border-[#E4DFD3] bg-white px-4 py-4">
                <label className="block text-sm font-medium text-[#23282B]">
                  Chart / diagram (optional)
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={handleImageChange}
                    className="block w-full mt-2 text-sm text-[#5B6266] border border-[#E4DFD3] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30"
                  />
                </label>
                {imageDataUri && (
                  <div className="space-y-2">
                    {/* eslint-disable-next-line @next/next/no-img-element -- inline data URI; next/image has nothing to optimize */}
                    <img src={imageDataUri} alt="Attached chart" className="max-h-48 rounded" />
                    <button
                      type="button"
                      onClick={() => setImageDataUri(null)}
                      className="text-sm px-3 py-2 rounded-lg border border-[#E4DFD3] text-[#23282B] hover:bg-[#F2EEE5] transition-colors"
                    >
                      Remove
                    </button>
                  </div>
                )}
                <p className="text-sm text-gray-500">Attach the chart for accurate data scoring.</p>
              </div>
            )}

            {/* Essay / response */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#23282B]">
                  Your {taskType === "TASK1_GENERAL" ? "letter" : "response"}
                </label>
                <span
                  className={`text-xs font-medium ${
                    wordCount > 0 && wordCount < minWords - 20
                      ? "text-red-500"
                      : wordCount > 0 && wordCount < minWords
                        ? "text-amber-500"
                        : "text-[#5B6266]"
                  }`}
                >
                  {wordCount} words
                  {wordCount > 0 && wordCount < minWords && (
                    <span className="ml-1">
                      — minimum {minWords} required
                      {wordCount < minWords - 30 ? " (significant penalty)" : ""}
                    </span>
                  )}
                </span>
              </div>
              <textarea
                className="w-full border border-[#E4DFD3] rounded-xl px-4 py-3 text-sm bg-white text-[#23282B] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30 resize-none leading-relaxed"
                rows={16}
                placeholder={
                  taskType === "TASK1_GENERAL"
                    ? "Write your letter here…"
                    : taskType === "TASK1_ACADEMIC"
                      ? "Write your Task 1 response here…"
                      : "Paste or type your essay here…"
                }
                value={essay}
                onChange={(e) => setEssay(e.target.value)}
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              onClick={handleScore}
              disabled={!essay.trim() || !question.trim()}
              className="w-full py-4 rounded-xl bg-[#1F5C4E] text-white font-semibold text-base hover:bg-[#154136] transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Get my band score
            </button>
          </>
        )}

        {/* Loading */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 space-y-6">
            <div className="w-12 h-12 border-4 border-[#E4DFD3] border-t-[#1F5C4E] rounded-full animate-spin" />
            <p className="text-[#5B6266] text-sm text-center max-w-xs">
              {LOADING_MESSAGES[loadingMsg]}
            </p>
          </div>
        )}

        {/* Results */}
        {result && !loading && (
          <div className="space-y-8">
            <ScoreReport result={result} taskType={taskType} />

            {/* Score another */}
            <div className="space-y-3">
              <button
                onClick={() => { setResult(null); setError(null); setEssay(""); setImageDataUri(null); setRemainingToday(null); }}
                className="w-full py-4 rounded-xl border border-[#E4DFD3] bg-white text-[#23282B] font-semibold text-sm hover:border-[#1F5C4E] transition-colors"
              >
                Score another essay
              </button>
              {remainingToday !== null && remainingToday <= 3 && (
                <p className="text-xs text-[#5B6266] text-center">
                  {remainingToday} evaluation{remainingToday === 1 ? "" : "s"} left today — resets at midnight UTC.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
