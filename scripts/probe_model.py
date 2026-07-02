"""
Direct-to-OpenRouter probe (bypasses the Next.js dev server entirely).
Isolates: is a model genuinely slow / non-JSON, or was the dev-server
pipeline (client timeout + route.ts internal retry) the culprit?

Usage: python -u scripts/probe_model.py <model-slug> [<model-slug> ...]
"""
import json, urllib.request, urllib.error, time, sys, re

KEY = None
with open("markready/.env.local", encoding="utf-8") as f:
    for line in f:
        if line.startswith("OPENROUTER_API_KEY="):
            KEY = line.split("=", 1)[1].strip()

URL = "https://openrouter.ai/api/v1/chat/completions"

# Compact stand-in for the real scoring prompt: same JSON-only contract.
SYSTEM = (
    "You are an IELTS Writing Task 2 examiner. Score the essay 1-9 in 0.5 steps "
    "on four criteria. Respond with ONLY valid JSON, no markdown, no preamble:\n"
    '{"task_response":{"band":N,"rationale":"..."},'
    '"coherence_cohesion":{"band":N,"rationale":"..."},'
    '"lexical_resource":{"band":N,"rationale":"..."},'
    '"grammatical_range_accuracy":{"band":N,"rationale":"..."},'
    '"overall_band":N}'
)
ESSAY = (
    "Crime is a serious problem in many societies today. While some argue that "
    "longer prison sentences are the most effective deterrent, others believe "
    "alternative approaches are more beneficial. In my opinion, a combination of "
    "both is necessary. Those who support harsher sentencing claim that the fear "
    "of spending many years behind bars discourages potential criminals. "
    "Furthermore, keeping offenders locked away protects the public. However, "
    "critics point out that long sentences do little to address the root causes "
    "of crime, such as poverty and lack of education. Rehabilitation programs, "
    "job training, and community support can help former criminals reintegrate "
    "into society and avoid reoffending. In conclusion, while prison sentences "
    "have their place, I believe that investing in prevention and rehabilitation "
    "offers a more sustainable solution to reducing crime in the long term."
)

def strip_fences(raw):
    return re.sub(r"\n?```$", "", re.sub(r"^```(?:json)?\n?", "", raw.strip())).strip()

def probe(model):
    body = json.dumps({
        "model": model,
        "max_tokens": 4000,
        "messages": [
            {"role": "system", "content": SYSTEM},
            {"role": "user", "content": f"Score this essay now:\n\n{ESSAY}"},
        ],
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://markready.app",
        "X-Title": "MarkReady",
    })
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=180) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"  HTTP {e.code}: {e.read().decode()[:300]}")
        return
    except Exception as e:
        print(f"  ERROR after {time.time()-t0:.0f}s: {e}")
        return
    dt = time.time() - t0
    content = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    finish = (data.get("choices") or [{}])[0].get("finish_reason")
    usage = data.get("usage", {})
    print(f"  latency      : {dt:.0f}s")
    print(f"  finish_reason: {finish}")
    print(f"  tokens       : {usage}")
    print(f"  content len  : {len(content)} chars")
    parsed = None
    try:
        parsed = json.loads(strip_fences(content))
        print(f"  JSON parse   : OK  overall_band={parsed.get('overall_band')}")
    except Exception as e:
        print(f"  JSON parse   : FAIL ({e})")
        print(f"  raw[:400]    : {content[:400]!r}")

def main():
    models = sys.argv[1:] or ["z-ai/glm-4.7-flash"]
    for m in models:
        print(f"\n===== {m} =====")
        probe(m)

if __name__ == "__main__":
    main()
