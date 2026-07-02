"""
Accuracy harness for the MarkReady scorer.

Runs each held-out eval example through the real /api/score endpoint and compares
the predicted overall band against the known Cambridge band. Reports:
  - MAE (mean absolute band error)
  - % within 0.5 band  (IELTS examiners themselves agree ~this often)
  - % within 1.0 band
  - per-example table and worst misses

Requires the dev server running (npm run dev) on the URL below.
Usage:  python scripts/eval_accuracy.py [eval_file.json]
"""
import json, sys, urllib.request, urllib.error, statistics

API = "http://localhost:3000/api/score"
EVAL = sys.argv[1] if len(sys.argv) > 1 else r"markready/src/data/eval-set.json"

def score(question, essay, task_type):
    body = json.dumps({"question": question, "essay": essay, "taskType": task_type}).encode()
    req = urllib.request.Request(API, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=120) as r:
        return json.load(r)

def main():
    examples = json.load(open(EVAL, encoding="utf-8"))
    rows, errors = [], []
    for i, e in enumerate(examples, 1):
        q = e.get("question") or "(question not provided)"
        try:
            res = score(q, e["answer"], e["task_type"])
            pred = float(res["overall_band"])
        except (urllib.error.URLError, KeyError, ValueError) as ex:
            print(f"  [{i}] {e['id']}: ERROR {ex}")
            continue
        actual = float(e["overall_band"])
        err = abs(pred - actual)
        errors.append(err)
        rows.append((e["id"], e["task_type"], actual, pred, err))
        print(f"  [{i}/{len(examples)}] {e['id']:<16} actual {actual} -> pred {pred}  (d{err:.1f})")

    if not errors:
        print("No results."); return
    mae = statistics.mean(errors)
    w05 = 100 * sum(x <= 0.5 for x in errors) / len(errors)
    w10 = 100 * sum(x <= 1.0 for x in errors) / len(errors)
    print("\n========== RESULTS ==========")
    print(f"  n = {len(errors)}")
    print(f"  MAE            = {mae:.2f} bands")
    print(f"  within 0.5     = {w05:.0f}%")
    print(f"  within 1.0     = {w10:.0f}%")
    print("\n  Worst misses:")
    for r in sorted(rows, key=lambda x: -x[4])[:5]:
        print(f"    {r[0]:<16} actual {r[2]} -> pred {r[3]}  (d{r[4]:.1f})")

if __name__ == "__main__":
    main()
