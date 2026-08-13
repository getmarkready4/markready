"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import type { ScoringResult, TaskType, CriterionKey } from "@/types/scoring";
import { MIN_WORDS, CRITERION_LABELS } from "@/types/scoring";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { ScoreReport } from "@/components/ScoreReport";
import { SignOutButton } from "@/components/SignOutButton";
import { SAMPLE_CHARTS } from "@/components/task1-charts";
import { svgToDataUri } from "@/components/task1-charts/svgToDataUri";

const SAMPLE_QUESTIONS: Record<TaskType, { id: string; label: string; text: string }[]> = {
  TASK2: [
    {
      id: "crime",
      label: "Crime & prison sentences",
      text: "Some people think that the best way to reduce crime is to give longer prison sentences. Others, however, believe there are better alternative ways of reducing crime. Discuss both views and give your own opinion.",
    },
    {
      id: "technology",
      label: "Technology & simpler living",
      text: "Some people believe that technology has made our lives more complex, and the solution is to lead simpler lives without modern technology. To what extent do you agree or disagree?",
    },
    {
      id: "education",
      label: "Women in the workforce",
      text: "In many countries, the traditional family model has changed, with women now forming a large part of the workforce. What are the advantages and disadvantages of this change?",
    },
    {
      id: "environment",
      label: "Population & the environment",
      text: "The increasing population is putting pressure on natural resources and the environment. What are the causes of this problem and what measures can be taken to address it?",
    },
    {
      id: "risk",
      label: "Taking risks in life (Cam 17)",
      text: "It is important for people to take risks, both in their professional lives and their personal lives. Do you think the advantages of taking risks outweigh the disadvantages? Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    },
    {
      id: "smartphones",
      label: "Children & smartphones (Cam 17)",
      text: "Some children spend hours every day on their smartphones. Why is this the case? Do you think this is a positive or a negative development? Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    },
    {
      id: "professionals",
      label: "Working where you trained (Cam 17)",
      text: "Some people believe that professionals, such as doctors and engineers, should be required to work in the country where they did their training. Others believe they should be free to work in another country if they wish. Discuss both these views and give your own opinion.",
    },
    {
      id: "alt-medicine",
      label: "Alternative medicine (Cam 17)",
      text: "Nowadays, a growing number of people with health problems are trying alternative medicines and treatments instead of visiting their usual doctor. Do you think this is a positive or a negative development? Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    },
    {
      id: "practical-skills",
      label: "Facts vs practical skills in education (Cam 11 GT)",
      text: "Some people say that in all levels of education, from primary schools to universities, too much time is spent on learning facts and not enough on learning practical skills. Do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    },
    {
      id: "clothes-culture",
      label: "Clothes, culture & character (Cam 11 GT)",
      text: "Some people say that it is possible to tell a lot about a person's culture and character from their choice of clothes. Do you agree or disagree? Give reasons for your answer and include any relevant examples from your own knowledge or experience.",
    },
  ],
  TASK1_ACADEMIC: [
    {
      id: "museum",
      label: "Ashdown Museum visitors & satisfaction (table + pies)",
      text: "The table below shows the numbers of visitors to Ashdown Museum during the year before and the year after it was refurbished. The charts show the result of surveys asking visitors how satisfied they were with their visit, during the same two periods. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "co2",
      label: "CO2 emissions per person 1967–2007 (line graph)",
      text: "The graph below shows average carbon dioxide (CO₂) emissions per person in the United Kingdom, Sweden, Italy and Portugal between 1967 and 2007. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "water",
      label: "Water use in six areas of the world (pie charts)",
      text: "The charts below show the percentage of water used for different purposes in six areas of the world. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "languages",
      label: "British students' other languages 2000/2010 (pie charts)",
      text: "The charts below show the proportions of British students at one university in England who were able to speak other languages in addition to English, in 2000 and 2010. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "nutrients",
      label: "Sodium, fat & sugar by meal, USA (pie charts)",
      text: "The charts below show the average percentages in typical meals of three types of nutrients, all of which may be unhealthy if eaten too much. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "exports",
      label: "Value of exports by category 2015/2016 (bar + table)",
      text: "The chart below shows the value of one country's exports in various categories during 2015 and 2016. The table shows the percentage change in each category of exports in 2016 compared with 2015. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "coffee",
      label: "Coffee & tea habits, 5 Australian cities (bar chart)",
      text: "The chart below shows the results of a survey about people's coffee and tea buying and drinking habits in five Australian cities. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "caribbean",
      label: "Tourists visiting a Caribbean island 2010–2017 (line)",
      text: "The graph below shows the number of tourists visiting a particular Caribbean island between 2010 and 2017. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "anthropology",
      label: "Anthropology graduate destinations & salaries (pie + table)",
      text: "The chart below shows what Anthropology graduates from one university did after finishing their undergraduate degree course. The table shows the salaries of the anthropologists in work after five years. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "urban",
      label: "Urban population in 4 Asian countries (line graph)",
      text: "The graph below gives information about the percentage of the population in four Asian countries living in cities from 1970 to 2020, with predictions for 2030 and 2040. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "households",
      label: "US households by income 2007/2011/2015 (bar chart)",
      text: "The chart below shows the number of households in the US by their annual income in 2007, 2011 and 2015. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "metals",
      label: "Monthly price change of 3 metals 2014 (line graph)",
      text: "The graph below shows the average monthly change in the prices of three metals during 2014. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "appliances",
      label: "Appliance ownership & housework hours (line graphs)",
      text: "The charts below show the changes in ownership of electrical appliances and amount of time spent doing housework in households in one country between 1920 and 2019. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "police",
      label: "Police budget 2017–2018 (table + pie charts)",
      text: "The table and charts below give information on the police budget for 2017 and 2018 in one area of Britain. The table shows where the money came from and the charts show how it was distributed. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "spending",
      label: "Weekly family spending 1968 vs 2018 (bar chart)",
      text: "The chart below gives information about how families in one country spent their weekly income in 1968 and in 2018. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
    {
      id: "shops",
      label: "Shop closures and openings 2011–2018 (line graph)",
      text: "The graph below shows the number of shops that closed and the number of new shops that opened in one country between 2011 and 2018. Summarise the information by selecting and reporting the main features, and make comparisons where relevant.",
    },
  ],
  TASK1_GENERAL: [
    {
      id: "neighbour",
      label: "Letter to a new neighbour",
      text: "You have recently moved to a new area. Write a letter to your new neighbour. In your letter: introduce yourself, describe the area you have moved from, invite your neighbour to visit you.",
    },
    {
      id: "complaint",
      label: "Complaint letter about equipment",
      text: "You recently bought a piece of equipment for your home but it did not work. Write a letter to the shop manager. In your letter: describe what you bought, explain the problem, say what you want the manager to do.",
    },
    {
      id: "college-job",
      label: "Advising a friend: college or a job (Cam 11 GT)",
      text: "You recently received a letter from a friend asking for advice about whether to go to college or to try to get a job. You think he/she should get a job. Write a letter to this friend. In your letter: say why he/she would not enjoy going to college; explain why getting a job is a good idea for him/her; suggest types of job that would be suitable for him/her. You do NOT need to write any addresses. Begin your letter as follows: Dear ...,",
    },
    {
      id: "hotel-papers",
      label: "Papers left at a hotel (Cam 11 GT)",
      text: "You recently attended a meeting at a hotel. When you returned home, you found you had left some important papers at the hotel. Write a letter to the manager of the hotel. In your letter: say where you think you left the papers; explain why they are so important; tell the manager what you want him/her to do. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,",
    },
    {
      id: "leisure-centre",
      label: "Letter to the local council: leisure centre (Cam 11 GT)",
      text: "Your local council is considering closing a sports and leisure centre that it runs, in order to save money. Write a letter to the local council. In your letter: give details of how you and your friends or family use the centre; explain why the sports and leisure centre is important for the local community; describe the possible effects on local people if the centre closes. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,",
    },
    {
      id: "training-course",
      label: "Requesting a training course (Cam 11 GT)",
      text: "You work for an international company. You have seen an advertisement for a training course which will be useful for your job. Write a letter to your manager. In your letter: describe the training course you want to do; explain what the company could do to help you; say how the course will be useful for your job. You do NOT need to write any addresses. Begin your letter as follows: Dear Sir or Madam,",
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
  // Free tests left in the founding-cohort allowance. null = staff (unlimited).
  const [remainingTests, setRemainingTests] = useState<number | null>(null);
  const [focusTip, setFocusTip] = useState<{ label: string; fix: string } | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const chartWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    createClient().auth.getUser().then(({ data: { user } }) => {
      setUserEmail(user?.email ?? null);
    });
  }, []);

  const minWords = MIN_WORDS[taskType];
  const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0;

  // Which Task 1 Academic sample (if any) is currently selected, and its chart.
  const sampleChartId =
    taskType === "TASK1_ACADEMIC" && !customQuestion
      ? SAMPLE_QUESTIONS.TASK1_ACADEMIC.find((q) => q.text === question)?.id ?? null
      : null;
  const SampleChart = sampleChartId ? SAMPLE_CHARTS[sampleChartId] ?? null : null;

  // When a sample chart is shown, rasterize it and feed it to scoring exactly
  // like an uploaded image. Leaving a sample (task-type switch or "use my own
  // question") clears imageDataUri in those handlers, not here.
  useEffect(() => {
    if (!SampleChart) return;
    let cancelled = false;
    const svg = chartWrapperRef.current?.querySelector("svg");
    if (svg) {
      svgToDataUri(svg as unknown as SVGSVGElement)
        .then((uri) => {
          if (!cancelled) setImageDataUri(uri);
        })
        .catch(() => {
          // Rasterization failed — leave the image unset; the response can
          // still be scored for structure and language without data accuracy.
        });
    }
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sampleChartId]);

  function switchTaskType(t: TaskType) {
    setTaskType(t);
    setQuestion(SAMPLE_QUESTIONS[t][0].text);
    setCustomQuestion(false);
    setEssay("");
    setResult(null);
    setError(null);
    setImageDataUri(null);
    setRemainingTests(null);
    setFocusTip(null);
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
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = await res.json();
      if (res.status === 403) {
        // Cohort and quota gates — the destination page explains each case.
        if (data.code === "quota_exhausted") {
          router.push("/upgrade");
          return;
        }
        if (data.code === "waitlist") {
          router.push("/waitlist");
          return;
        }
        if (data.code === "onboarding_incomplete") {
          router.push("/welcome");
          return;
        }
        setError(data.error ?? "You don't have access to scoring right now.");
        return;
      }
      if (res.status === 422) {
        // Wrong task type for the selected rubric — not scored, quota untouched
        const tabLabel = TASK_TABS.find((t) => t.type === data.detectedTask)?.label;
        setError(
          `${data.reason ?? "This response doesn't match the selected task."}${
            tabLabel
              ? ` Switch to the “${tabLabel}” tab and try again.`
              : " Check the task tab above and try again."
          }`
        );
        return;
      }
      if (!res.ok) {
        setError(data.error ?? "Something went wrong. Please try again.");
      } else {
        const remaining = typeof data.remaining === "number" ? data.remaining : null;
        setRemainingTests(remaining);
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
              <p className="text-sm text-[#5B6266] mt-2 leading-relaxed">
                Pick a task type below, choose or paste a question, then paste your
                written response and hit Score. You&apos;ll get an estimated band for
                each of the four IELTS criteria, specific fixes, and a Band 8 rewrite.
              </p>
            </div>

            {focusTip && (
              <div className="rounded-xl border border-[#1F5C4E]/25 bg-[#E7EFEC] px-4 py-3 flex items-start gap-3">
                <span className="text-lg leading-none mt-0.5">🎯</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-[#1F5C4E]">
                    This round, focus on {focusTip.label}
                  </p>
                  <p className="text-xs text-[#23282B] mt-0.5 leading-relaxed">
                    {focusTip.fix}
                  </p>
                </div>
                <button
                  onClick={() => setFocusTip(null)}
                  className="text-[#5B6266] hover:text-[#23282B] text-lg leading-none"
                  aria-label="Dismiss focus tip"
                >
                  ×
                </button>
              </div>
            )}

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

            <div className="-mt-4 space-y-1">
              <p className="text-xs text-[#5B6266]">{TASK_DESCRIPTIONS[taskType]}</p>
              <p className="text-xs text-[#9BA3A8]">
                <span className="font-medium text-[#5B6266]">Not sure which?</span>{" "}
                Task 2 = opinion essay · Task 1 Academic = describe a chart or graph ·
                Task 1 General = write a letter.
              </p>
            </div>

            {/* Question */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-[#23282B]">
                {taskType === "TASK1_GENERAL" ? "Letter prompt" : "Question / prompt"}
              </label>
              <select
                className="w-full border border-[#E4DFD3] rounded-xl px-4 py-3 text-sm bg-white text-[#23282B] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30"
                value={customQuestion ? "__custom__" : question}
                onChange={(e) => {
                  if (e.target.value === "__custom__") {
                    setCustomQuestion(true);
                    setQuestion("");
                    // Drop any auto-fed sample chart; custom questions use upload.
                    setImageDataUri(null);
                  } else {
                    setCustomQuestion(false);
                    setQuestion(e.target.value);
                  }
                }}
              >
                {SAMPLE_QUESTIONS[taskType].map((q) => (
                  <option key={q.id} value={q.text}>
                    {q.label}
                  </option>
                ))}
                <option value="__custom__">Use my own question</option>
              </select>
              {!customQuestion ? (
                <p className="text-sm text-[#23282B] bg-white border border-[#E4DFD3] rounded-xl px-4 py-3 leading-relaxed">
                  {question}
                </p>
              ) : (
                <textarea
                  className="w-full border border-[#E4DFD3] rounded-xl px-4 py-3 text-sm bg-white text-[#23282B] focus:outline-none focus:ring-2 focus:ring-[#1F5C4E]/30 resize-none"
                  rows={4}
                  placeholder="Paste your question or prompt here…"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
              )}
            </div>

            {/* Chart / diagram for Task 1 Academic: shown sample chart (auto-scored)
                or manual upload for a custom question. */}
            {taskType === "TASK1_ACADEMIC" &&
              (SampleChart ? (
                <div className="space-y-2 rounded-xl border border-[#E4DFD3] bg-white px-4 py-4">
                  <p className="text-sm font-medium text-[#23282B]">Chart / diagram</p>
                  <div ref={chartWrapperRef} className="overflow-x-auto">
                    <SampleChart />
                  </div>
                  <p className="text-sm text-gray-500">
                    This chart is included with your response for accurate data scoring.
                  </p>
                </div>
              ) : (
                <div className="space-y-3 rounded-xl border border-[#E4DFD3] bg-white px-4 py-4">
                  <label className="block text-sm font-medium text-[#23282B]">
                    Chart / diagram
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
              ))}

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
        {result && !loading && (() => {
          const weakestLabel =
            CRITERION_LABELS[result.weakest_criterion as CriterionKey] ??
            "your weakest area";
          const topFix = result.weaknesses[0]?.fix ?? "";
          const startNext = (focus: boolean) => {
            setResult(null);
            setError(null);
            setEssay("");
            setImageDataUri(null);
            setRemainingTests(null);
            setFocusTip(focus && topFix ? { label: weakestLabel, fix: topFix } : null);
            window.scrollTo({ top: 0, behavior: "smooth" });
          };
          return (
          <div className="space-y-8">
            <ScoreReport result={result} taskType={taskType} />

            {/* Next step — turn the report into an action */}
            <div className="space-y-3">
              {topFix && (
                <div className="rounded-2xl border border-[#1F5C4E]/20 bg-white px-6 py-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#C97B4A]">
                    Your fastest win
                  </p>
                  <p className="mt-1 text-sm text-[#23282B] leading-relaxed">
                    Your weakest area is <span className="font-semibold text-[#1F5C4E]">{weakestLabel}</span>. {topFix}
                  </p>
                </div>
              )}
              <button
                onClick={() => startNext(true)}
                className="w-full py-4 rounded-xl bg-[#1F5C4E] text-white font-semibold text-sm hover:bg-[#154136] transition-colors"
              >
                Practice again — focus on {weakestLabel}
              </button>
              <div className="flex items-center justify-center gap-4">
                <button
                  onClick={() => startNext(false)}
                  className="text-sm text-[#5B6266] hover:text-[#23282B] hover:underline"
                >
                  Score a different essay
                </button>
                <span className="text-[#E4DFD3]">·</span>
                <Link
                  href="/dashboard"
                  className="text-sm text-[#1F5C4E] hover:text-[#154136] hover:underline"
                >
                  See my progress
                </Link>
              </div>
              {remainingTests !== null && (
                <p className="text-xs text-[#5B6266] text-center">
                  {remainingTests === 0
                    ? "That was your last free test."
                    : `${remainingTests} free test${remainingTests === 1 ? "" : "s"} left.`}
                </p>
              )}
            </div>
          </div>
          );
        })()}
      </main>
    </div>
  );
}
