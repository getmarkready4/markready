"""
Assemble the IELTS calibration corpus from extracted sources.

Sources:
  - Cambridge 17: native PDF text layer (clean).
  - Cambridge 14, 15, 16, 18, 11 Academic, 11 General Training: OCR text files
    produced by RapidOCR (ocr_*.txt in pdf_pages/).

Output: markready/src/data/calibration-corpus.json

Records with a candidate band score are kept. Examiner-written "MODEL ANSWER"
exemplars (no band) are kept separately under `model_answers` for reference,
not used as band anchors.
"""
import re, json, os

PAGES = r"C:\Users\User\Desktop\AI exam coach\pdf_pages"
OUT = r"C:\Users\User\Desktop\AI exam coach\markready\src\data\calibration-corpus.json"

# book tag -> (source label, Task 1 type)
BOOKS = {
    "b11gt":     ("Cambridge IELTS 11 GeneralTraining", "TASK1_GENERAL"),
    "b11ac":     ("Cambridge IELTS 11 Academic", "TASK1_ACADEMIC"),
    "b14":       ("Cambridge IELTS 14 Academic", "TASK1_ACADEMIC"),
    "b15":       ("Cambridge IELTS 15 Academic", "TASK1_ACADEMIC"),
    "b_unknown": ("Cambridge IELTS 16 Academic", "TASK1_ACADEMIC"),
    "b17":       ("Cambridge IELTS 17 Academic", "TASK1_ACADEMIC"),
    "b18":       ("Cambridge IELTS 18 Academic", "TASK1_ACADEMIC"),
}

HEADER = re.compile(r"TEST\s*(\d)\D{0,4}WRITING\s*TASK\s*(\d)", re.I)
BAND = re.compile(r"achieved a\s*Band\s*([0-9](?:\.[05])?)", re.I)
COMMENT = re.compile(r"Here\s*(?:is\s*the|are\s*comments?\s*from\s*another)\s*examiner.?s?\s*comments?\s*:?", re.I)
MODEL = re.compile(r"MODEL\s*ANSWER|prepared by an examiner", re.I)
LETTER = re.compile(r"\bDear\b", re.I)

def clean(s):
    s = re.sub(r"==== .*? ====", "", s)
    s = re.sub(r"\b\d{1,3}\b\s*$", "", s)  # trailing page numbers
    s = re.sub(r"Sample answers? for Writing tasks", "", s, flags=re.I)
    s = re.sub(r"Sample Writing answers", "", s, flags=re.I)
    s = re.sub(r"9IELTS\.COM", "", s, flags=re.I)
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()

def parse_ocr(path, source, t1type, tag):
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"==== .*? ====", "\n", text)
    matches = list(HEADER.finditer(text))
    out = []
    for i, m in enumerate(matches):
        block = text[m.start(): matches[i+1].start() if i+1 < len(matches) else len(text)]
        test_no, task_no = int(m.group(1)), int(m.group(2))
        bm = BAND.search(block)
        band = float(bm.group(1)) if bm else None
        cm = COMMENT.search(block)
        # Two layouts: answer-first (IELTSPOP books) vs comment-first (Cambridge 11).
        # Comment-first = the comment marker appears right after the band line (<140 chars in).
        comment_first = bool(cm) and bm and (cm.start() - bm.end()) < 140 and cm.start() - bm.end() >= 0
        if cm and comment_first:
            rest = block[cm.end():]
            lm = LETTER.search(rest)
            if lm:                       # letter: answer begins at "Dear"
                comment = rest[:lm.start()]
                answer = rest[lm.start():]
            else:                        # essay, comment-first: boundary undetectable
                comment = rest
                answer = ""
        elif cm:                         # answer-first
            answer = block[:cm.start()]
            comment = block[cm.end():]
        else:
            answer, comment = block, ""
        answer = re.sub(r"This is an answer written by a candidate who achieved a Band[^\n]*", "", answer)
        answer = re.sub(r"This model has been prepared[^\n]*", "", answer)
        answer = re.sub(HEADER, "", answer)
        answer = re.sub(r"SAMPLE\s*ANSWER|MODEL\s*ANSWER", "", answer, flags=re.I)
        rec = {
            "id": f"{tag}-t{test_no}-task{task_no}",
            "source": source,
            "task_type": t1type if task_no == 1 else "TASK2",
            "test": test_no, "task": task_no,
            "overall_band": band,
            "question": "",  # filled separately where available
            "answer": clean(answer),
            "examiner_comment": clean(comment),
            "is_model_answer": bool(MODEL.search(block)) and band is None,
            "ocr_source": True,
        }
        out.append(rec)
    return out

def main():
    examples, models, review = [], [], []
    for tag, (source, t1type) in BOOKS.items():
        path = os.path.join(PAGES, f"ocr_{tag}.txt")
        if not os.path.exists(path):
            print(f"  skip {tag} (no OCR file)")
            continue
        for rec in parse_ocr(path, source, t1type, tag):
            if rec["is_model_answer"] or rec["overall_band"] is None:
                models.append(rec)
            elif len(rec["answer"]) < 80 or len(rec["examiner_comment"]) < 40:
                review.append(rec)        # parsed band but answer/comment incomplete
            else:
                examples.append(rec)
        print(f"  parsed {tag}")
    corpus = {
        "version": "1",
        "note": "IELTS calibration corpus from Cambridge IELTS books. Cambridge 17 = clean PDF text layer; 14/15/16/18/11 = RapidOCR (may contain minor transcription gaps or number misreads). 'examples' = candidate answers with a band score and clean answer+comment. 'model_answers' = examiner exemplars (no band, not calibration anchors). 'needs_review' = band captured but answer/comment extraction incomplete (mostly Cambridge 11 comment-first essays).",
        "examples": examples,
        "model_answers": models,
        "needs_review": review,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    json.dump(corpus, open(OUT, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    bands = sorted(e["overall_band"] for e in examples)
    print(f"\nWrote {len(examples)} clean examples + {len(models)} model answers + {len(review)} needs-review")
    print("Clean band spread:", bands)

if __name__ == "__main__":
    main()
