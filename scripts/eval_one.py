"""
Single-model eval: run the held-out set through /api/score for ONE model.
Simple and fair — no concurrency, nothing competing.

Change MODEL below (or pass as an argument) and re-run for each model:
    python -u scripts/eval_one.py
    python -u scripts/eval_one.py qwen/qwen3.6-flash
"""
import json, urllib.request, urllib.error, statistics, time, sys

MODEL   = "z-ai/glm-4.7-flash"      # <-- edit this between runs
API     = "http://localhost:3000/api/score"
EVAL    = r"markready/src/data/eval-set.json"
TIMEOUT = 150   # generous; only one model runs at a time so no pileup

def score(question, essay, task_type, model):
    body = json.dumps({"question": question, "essay": essay,
                       "taskType": task_type, "model": model}).encode()
    req = urllib.request.Request(API, data=body,
                                 headers={"Content-Type": "application/json"})
    t0 = time.time()
    with urllib.request.urlopen(req, timeout=TIMEOUT) as r:
        data = json.load(r)
    return float(data["overall_band"]), time.time() - t0

def metrics(errs):
    if not errs:
        return (float("nan"), 0, 0)
    return (round(statistics.mean(errs), 3),
            round(100 * sum(e <= 0.5 for e in errs) / len(errs)),
            round(100 * sum(e <= 1.0 for e in errs) / len(errs)))

def main():
    model = sys.argv[1] if len(sys.argv) > 1 else MODEL
    examples = json.load(open(EVAL, encoding="utf-8"))
    print(f"Model: {model}   ({len(examples)} essays, timeout {TIMEOUT}s)\n")
    t2, t1, fails = [], [], 0
    for i, e in enumerate(examples, 1):
        try:
            pred, dt = score(e.get("question") or "(n/a)", e["answer"],
                             e["task_type"], model)
            err = abs(pred - e["overall_band"])
            (t2 if e["task_type"] == "TASK2" else t1).append(err)
            print(f"  [{i:>2}/{len(examples)}] {e['id']:<22} "
                  f"actual {e['overall_band']} -> pred {pred}  (d{err})  [{dt:.0f}s]")
        except urllib.error.HTTPError as ex:
            fails += 1
            print(f"  [{i:>2}/{len(examples)}] {e['id']:<22} FAIL HTTP{ex.code}")
        except Exception as ex:
            fails += 1
            print(f"  [{i:>2}/{len(examples)}] {e['id']:<22} FAIL {ex}")

    ma, a5, a10 = metrics(t2 + t1)
    m2 = metrics(t2); m1 = metrics(t1)
    print(f"\n===== {model} =====")
    print(f"  scored {len(t2)+len(t1)}/{len(examples)}, {fails} failed")
    print(f"  Overall: MAE {ma}  w0.5 {a5}%  w1.0 {a10}%")
    print(f"  Task2:   MAE {m2[0]}  w0.5 {m2[1]}%  (n={len(t2)})")
    print(f"  Task1:   MAE {m1[0]}  w0.5 {m1[1]}%  (n={len(t1)})")

if __name__ == "__main__":
    main()
