# Session brief — Task 1 Academic chart image upload

This is the implementer's full context. You have no other context from the planning session.

## Goal
Add chart/diagram image upload to the IELTS Task 1 Academic scoring flow so the vision model
can assess data accuracy instead of running in NO-VISUAL MODE. Scope: TASK1_ACADEMIC only.

## Files to change (exactly 2)

### `markready/src/app/score/page.tsx`
### `markready/src/app/api/score/route.ts`

Do NOT touch any other file.

---

## Change 1 — `markready/src/app/score/page.tsx`

Read the full file before editing. Key facts:
- It is a `"use client"` component (React 19, Next.js 16.2.9).
- State is managed with `useState`. The existing states include `taskType`, `essay`, `result`, `error`, etc.
- The "Score another" onClick is at approximately line 494:
  `() => { setResult(null); setError(null); setEssay(""); }`
- `handleScore` POSTs to `/api/score` with `{ question, essay, taskType }`.
- Three task-type tabs: TASK2, TASK1_ACADEMIC, TASK1_GENERAL.

**What to add:**

1. Add `useState` for image: `const [imageDataUri, setImageDataUri] = useState<string | null>(null);`

2. Add this helper function inside the component file (not exported, not in a shared util):
```typescript
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
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = url;
  });
}
```

3. Add an image change handler (call only from event handlers, never at module init):
```typescript
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
```

4. Render the upload control **only when `taskType === "TASK1_ACADEMIC"`**, between the question
   and essay sections. Match the existing Tailwind styling in the file:
```tsx
{taskType === "TASK1_ACADEMIC" && (
  <div className="..."> {/* match existing spacing/card style */}
    <label className="...">
      Chart / diagram (optional)
      <input
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp"
        onChange={handleImageChange}
        className="..."
      />
    </label>
    {imageDataUri && (
      <div>
        <img src={imageDataUri} alt="Attached chart" className="max-h-48 rounded" />
        <button type="button" onClick={() => setImageDataUri(null)}>Remove</button>
      </div>
    )}
    <p className="text-sm text-gray-500">Attach the chart for accurate data scoring.</p>
  </div>
)}
```

5. Clear `imageDataUri` in TWO places:
   - Wherever `taskType` is switched (the tab-switch handler).
   - The "Score another" onClick — add `setImageDataUri(null)` as a fourth setter alongside the existing three.

6. In `handleScore`, include the image in the POST body:
```typescript
image: taskType === "TASK1_ACADEMIC" ? imageDataUri : null,
```

---

## Change 2 — `markready/src/app/api/score/route.ts`

Read the full file before editing. Key facts:
- `callModel(systemPrompt, userMessage, model)` is defined at line 31. Its second param is `string`.
- The primary call is at line 68. The retry call is at line 83. BOTH must be updated.
- `systemPrompt` is assigned at line 63 from a const. Do NOT modify that line.

**What to add/change:**

1. Add this import at the top (type-only — no runtime value):
```typescript
import type { ChatCompletionContentPart } from "openai/resources/chat/completions";
```

2. Extend the destructured body:
```typescript
const { question, essay, taskType = "TASK2", model, image } = await req.json() as {
  question: string;
  essay: string;
  taskType: TaskType;
  model?: string;
  image?: string | null;
};
```

3. Add server-side image validation immediately after the existing `taskType` check:
```typescript
const ALLOWED_PREFIXES = [
  "data:image/png;base64,",
  "data:image/jpeg;base64,",
  "data:image/jpg;base64,",
  "data:image/webp;base64,",
];
const validImage: string | null =
  image && ALLOWED_PREFIXES.some((p) => image.startsWith(p)) ? image : null;
```

4. Change `callModel` signature to accept multimodal content:
```typescript
async function callModel(
  systemPrompt: string,
  userContent: string | Array<ChatCompletionContentPart>,
  model: string
): Promise<string>
```
Inside `callModel`, the user message becomes:
```typescript
{ role: "user", content: userContent }
```

5. Derive `effectiveSystemPrompt` and `userContent` ONCE, before any `callModel` call. Use these
   variables in BOTH the primary call AND the retry call:
```typescript
const effectiveSystemPrompt =
  validImage && taskType === "TASK1_ACADEMIC"
    ? systemPrompt +
      "\n\nIMAGE PROVIDED: The Task 1 chart/diagram IS attached to this message. " +
      "NO-VISUAL MODE (rule 7) does NOT apply — verify the figures and key-feature " +
      "selection against the image and assess Task Achievement (including data accuracy) normally."
    : systemPrompt;

const userContent: string | Array<ChatCompletionContentPart> =
  validImage && taskType === "TASK1_ACADEMIC"
    ? [
        { type: "text", text: userMessage },
        { type: "image_url", image_url: { url: validImage } },
      ]
    : userMessage;
```

6. Update BOTH call sites:
   - Primary (line 68): `callModel(effectiveSystemPrompt, userContent, activeModel)`
   - Retry (line 83): `callModel(effectiveSystemPrompt, userContent, activeModel)`

   The retry MUST use `effectiveSystemPrompt` and `userContent`, NOT the original `systemPrompt`
   and `userMessage`. Using the originals would silently drop the image and rule-7 override on retry.

7. Keep `max_tokens: 4000`, all error handling, and the `stripFences`/`JSON.parse` logic identical.

---

## Out of scope — do NOT touch
- `src/types/scoring.ts` — no changes needed
- `src/lib/system-prompt.ts` — no changes needed (the override is appended at runtime in route.ts)
- `next.config.*` — no changes needed (4MB body limit is sufficient)
- Task 2 or Task 1 General flows

---

## Verification checklist (manual — run the dev server after implementing)
1. Task 1 Academic tab: attach a chart PNG → thumbnail appears → score → response includes `data_accuracy_note`.
2. Task 1 Academic tab: no image attached → score → NO-VISUAL MODE behaviour unchanged.
3. Task 2 tab: no upload control visible, scoring unchanged.
4. Task 1 General tab: no upload control visible, scoring unchanged.
5. Switch from Task 1 Academic to another tab → attached image is cleared.
6. "Score another" button → attached image is cleared.
