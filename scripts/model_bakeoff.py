"""
Model bake-off: run the held-out eval set through /api/score across several
OpenRouter models (via the `model` override) and compare accuracy.

FAIR MODE: models are tested ONE AT A TIME (no concurrency), so no model is
penalised by competing for the dev server / OpenRouter throughput. Each call
gets a generous timeout and one retry. Failures are CLASSIFIED (timeout vs.
parse-500 vs. upstream-502) so a slow-but-working model is never confused with
a genuinely incompatible one.

Reports per-model MAE / within-0.5 / within-1.0, split by Task 2 vs Task 1.

Usage: python -u scripts/model_bakeoff.py
"""
import json, urllib.request, urllib.error, statistics, time

API  = "http://localhost:3000/api/score"
EVAL = r"markready/src/data/eval-set.json"
OUT  = r"scripts/bakeoff_results.json"

TIMEOUT          = 90   # seconds per API call (covers slow reasoning models)
RETRIES          = 1    # extra attempts on a failed call
MAX_CONSEC_FAIL  = 4    # give up on a model after this many consecutive failures

MODELS = [
    "anthropic/claude-haiku-4.5",    # baseline (vision)
    "google/gemini-2.5-flash",       # cheap + vision
    "qwen/qwen3.6-flash",            # newer cheap + vision
    "deepseek/deepseek-v4-flash",    # cheapest (text-only)
    "z-ai/glm-4.7-flash",            # ultra-cheap (text-only)
    "z-ai/glm-5.2",                  # user-requested
    "google/gemini-2.5-pro",         # quality ceiling (vision)
]

def call_once(question, essay, task_type, model):
    """Returns (band, elapsed) on success; raises with a classified reason."""
    body = json.dumps({"question": question, "essay": essay,
                       "taskType": task_type, "model": model}).encode()
    req = urllib.request.Request(API, data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = json.load(r)
    if "overall_band" not in data:
        raise ValueError("no overall_band in response")
    return float(data["overall_band"]), time.time() - t0

def score_one(question, essay, task_type, model):
    """Try a call up to RETRIES+1 times. Returns (band, reason).
    band is None on failure; reason is a short classification string."""
    last = "unknown"
    for attempt in range(RETRIES + 1):
        try:
            band, dt = call_once(question, essay, task_type, model)
            return band, f"ok {dt:.0f}s"
        except urllib.error.HTTPError as e:
            # 500 = our route failed to parse model output (non-JSON / truncated)
            # 502 = OpenRouter upstream error
            last = f"HTTP{e.code}"
        except (urllib.error.URLError, TimeoutError, OSError):
            last = "timeout"
        except ValueError as e:
            last = str(e)
    return None, last

def metrics(errs):
    if not errs:
        return (float("nan"), 0, 0)
    return (round(statistics.mean(errs), 3),
            round(100 * sum(e <= 0.5 for e in errs) / len(errs)),
            round(100 * sum(e <= 1.0 for e in errs) / len(errs)))

def run_model(model, examples):
    t2, t1, fails, consec, reasons = [], [], 0, 0, {}
    for i, e in enumerate(examples, 1):
        if consec >= MAX_CONSEC_FAIL:
            print(f"  [{model}] ABORT after {MAX_CONSEC_FAIL} consecutive failures "
                  f"({i-1}/{len(examples)} attempted)")
            fails += len(examples) - i + 1
            break
        band, reason = score_one(e.get("question") or "(n/a)", e["answer"],
                                  e["task_type"], model)
        if band is None:
            fails += 1
            consec += 1
            reasons[reason] = reasons.get(reason, 0) + 1
            print(f"  [{model}] [{i}/{len(examples)}] FAIL {e['id']}: {reason}")
        else:
            err = abs(band - e["overall_band"])
            (t2 if e["task_type"] == "TASK2" else t1).append(err)
            consec = 0
            print(f"  [{model}] [{i}/{len(examples)}] {e['id']} "
                  f"actual {e['overall_band']} -> pred {band}  (d{err})  [{reason}]")
    return t2, t1, fails, reasons

def main():
    examples = json.load(open(EVAL, encoding="utf-8"))
    print(f"Eval set: {len(examples)} examples, {len(MODELS)} models")
    print(f"FAIR MODE: sequential, timeout={TIMEOUT}s, retries={RETRIES}\n")

    all_results = []
    for n, model in enumerate(MODELS, 1):
        print(f"\n===== [{n}/{len(MODELS)}] {model} =====")
        t0 = time.time()
        t2, t1, fails, reasons = run_model(model, examples)
        allerr = t2 + t1
        ma, a5, a10 = metrics(allerr)
        m2 = metrics(t2)
        m1 = metrics(t1)
        all_results.append({
            "model": model, "n_ok": len(allerr), "fails": fails,
            "fail_reasons": reasons,
            "mae": ma, "w05": a5, "w10": a10,
            "t2_mae": m2[0], "t2_w05": m2[1], "t2_n": len(t2),
            "t1_mae": m1[0], "t1_w05": m1[1], "t1_n": len(t1),
        })
        print(f"  -> {len(allerr)} scored, {fails} failed  ({time.time()-t0:.0f}s)")
        print(f"     Overall MAE {ma}  w0.5 {a5}%  w1.0 {a10}%")
        print(f"     Task2 MAE {m2[0]} (n={len(t2)})  |  Task1 MAE {m1[0]} (n={len(t1)})")
        if reasons:
            print(f"     fail reasons: {reasons}")

    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(all_results, f, indent=2)
    print(f"\nResults saved to {OUT}")

    # Rank by Task 2 MAE (the validated metric), nan last
    def t2key(r):
        return r["t2_mae"] if r["t2_mae"] == r["t2_mae"] else 999
    ranked = sorted(all_results, key=t2key)
    print("\n===== RANKING (by Task 2 MAE) =====")
    print(f"{'Model':<32} T2-MAE  T2-w0.5  T2-n  T1-MAE  T1-n  fails")
    print("-" * 78)
    for r in ranked:
        t2m = f"{r['t2_mae']:.2f}" if r['t2_mae'] == r['t2_mae'] else " n/a"
        t1m = f"{r['t1_mae']:.2f}" if r['t1_mae'] == r['t1_mae'] else " n/a"
        print(f"{r['model']:<32} {t2m:>5}   {r['t2_w05']:>3}%   {r['t2_n']:>3}   "
              f"{t1m:>5}   {r['t1_n']:>3}   {r['fails']}")

if __name__ == "__main__":
    main()
