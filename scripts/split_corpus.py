"""
Populate questions and split the corpus into:
  - fewshot.json  : calibration anchors per task type (spanning the band scale)
  - eval-set.json : held-out examples for the accuracy harness (covers low/mid/high)

Task 2 questions: parsed from pdf_pages/q2_*.txt, assigned to tests by page order
(robust to per-book page shifts).
Task 1 questions: the chart/diagram is an image not in our text, so we use a generic
Task 1 instruction. The candidate's answer describes the data, so the writing
(CC/LR/GRA and most of Task Achievement) is still assessable. Data-accuracy is the
only criterion we cannot fully reproduce — noted as a known limitation.
"""
import json, re, os, glob

PAGES = r"C:\Users\User\Desktop\AI exam coach\pdf_pages"
DATA = r"C:\Users\User\Desktop\AI exam coach\markready\src\data"
CORPUS = os.path.join(DATA, "calibration-corpus.json")

TAG_BY_SOURCE = {
    "Cambridge IELTS 14 Academic": "b14",
    "Cambridge IELTS 15 Academic": "b15",
    "Cambridge IELTS 16 Academic": "b_unknown",
    "Cambridge IELTS 17 Academic": "b17",
}

GENERIC_T1_ACADEMIC = ("The chart/graph/table/diagram below shows the data described in the response. "
    "Summarise the information by selecting and reporting the main features, and make comparisons "
    "where relevant. Write at least 150 words. (The visual is not shown here; assess the response as written.)")
GENERIC_T1_GENERAL = ("Write a letter responding to the situation described. In your letter, address all the "
    "required points in an appropriate tone and register. Write at least 150 words. "
    "(The specific prompt is not shown here; assess the letter as written.)")

# Explicit anchors per task type (chosen to span the full band scale).
# Everything else with a usable question goes to eval, deliberately including the extremes.
ANCHORS = {
    "TASK2": {"b_unknown-t2-task2", "b14-t3-task2", "b15-t2-task2",
              "b15-t4-task2", "b14-t1-task2", "b14-t4-task2"},          # 4.5,5.5,6.0,6.5,7.0,7.5
    "TASK1_ACADEMIC": {"b_unknown-t1-task1", "b17-t3-task1", "b14-t2-task1",
                       "b15-t3-task1", "b15-t2-task1", "b17-t2-task1"}, # 5.0,5.5,6.0,6.5,7.0,7.5
    "TASK1_GENERAL": {"b11gt-t2-task1", "b11gt-t1-task1"},              # 4.5, 7.0
}

def parse_questions():
    """Return {(tag, test): question} for Task 2, assigning tests by page order per book."""
    q = {}
    for path in glob.glob(os.path.join(PAGES, "q2_*.txt")):
        tag = os.path.basename(path)[3:-4]
        text = open(path, encoding="utf-8").read()
        blocks = []
        for m in re.finditer(r"==== \S+ PDF p(\d+) ====(.*?)(?=\n==== |\Z)", text, re.S):
            page, body = int(m.group(1)), m.group(2)
            tm = re.search(r"following\s*topic\s*:?(.*?)(?:Give\s*reasons|Write\s*at\s*least|knowledge or experience|$)",
                           body, re.S | re.I)
            if tm:
                prompt = re.sub(r"\s+", " ", tm.group(1)).strip()
                if len(prompt) > 20:
                    blocks.append((page, prompt))
        blocks.sort()
        for test, (_, prompt) in enumerate(blocks, 1):   # Nth question = test N
            q[(tag, test)] = prompt
    return q

def main():
    corpus = json.load(open(CORPUS, encoding="utf-8"))
    qmap = parse_questions()

    filled = 0
    for e in corpus["examples"]:
        if e["task_type"] == "TASK2":
            key = (TAG_BY_SOURCE.get(e["source"]), e["test"])
            if key in qmap:
                e["question"] = qmap[key]; filled += 1
        elif e["task_type"] == "TASK1_ACADEMIC":
            e["question"] = GENERIC_T1_ACADEMIC
        elif e["task_type"] == "TASK1_GENERAL":
            e["question"] = GENERIC_T1_GENERAL
    print(f"Filled {filled} Task 2 questions; Task 1 use generic prompts.")

    fewshot = {"TASK2": [], "TASK1_ACADEMIC": [], "TASK1_GENERAL": []}
    eval_set = []
    for e in corpus["examples"]:
        tt = e["task_type"]
        if not e.get("question"):
            continue  # Task 2 without a parsed question — skip
        if e["id"] in ANCHORS.get(tt, set()):
            fewshot[tt].append(e)
        else:
            eval_set.append(e)

    fewshot = {k: sorted(v, key=lambda e: e["overall_band"]) for k, v in fewshot.items()}
    json.dump(fewshot, open(os.path.join(DATA, "fewshot.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    json.dump(eval_set, open(os.path.join(DATA, "eval-set.json"), "w", encoding="utf-8"), indent=2, ensure_ascii=False)

    for tt in fewshot:
        print(f"  fewshot {tt}: bands {[e['overall_band'] for e in fewshot[tt]]}")
    import collections
    ev = collections.Counter((e['task_type'], e['overall_band']) for e in eval_set)
    print(f"  eval-set: n={len(eval_set)}")
    for tt in fewshot:
        bands = sorted(b for (t, b) in ev for _ in range(ev[(t, b)]) if t == tt)
        print(f"    {tt}: bands {bands}")

if __name__ == "__main__":
    main()
