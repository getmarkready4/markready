"""
Vision capability probe for an OpenRouter model.
Generates a test chart image with a secret number + bars, sends it as a
base64 data-URI, and checks whether the model can actually read the image.

Usage: python -u scripts/probe_vision.py [model-slug]
"""
import json, urllib.request, urllib.error, base64, io, sys

MODEL = sys.argv[1] if len(sys.argv) > 1 else "qwen/qwen3.6-flash"

KEY = None
with open("markready/.env.local", encoding="utf-8") as f:
    for line in f:
        if line.startswith("OPENROUTER_API_KEY="):
            KEY = line.split("=", 1)[1].strip()

URL = "https://openrouter.ai/api/v1/chat/completions"
SECRET = "7392"

def make_image():
    """Draw a simple bar chart with a secret code. Requires Pillow."""
    from PIL import Image, ImageDraw
    img = Image.new("RGB", (400, 300), "white")
    d = ImageDraw.Draw(img)
    d.text((20, 10), f"SECRET CODE: {SECRET}", fill="black")
    bars = [("A", 60), ("B", 140), ("C", 90), ("D", 200)]
    for i, (label, h) in enumerate(bars):
        x = 40 + i * 80
        d.rectangle([x, 280 - h, x + 50, 280], fill="steelblue")
        d.text((x + 15, 282), label, fill="black")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return base64.b64encode(buf.getvalue()).decode()

def main():
    try:
        b64 = make_image()
    except ImportError:
        print("Pillow not installed; run: pip install pillow")
        return

    body = json.dumps({
        "model": MODEL,
        "max_tokens": 300,
        "messages": [{
            "role": "user",
            "content": [
                {"type": "text", "text":
                    "Look at this image. (1) What is the SECRET CODE printed at the top? "
                    "(2) Which labelled bar (A-D) is the tallest? Answer concisely."},
                {"type": "image_url",
                 "image_url": {"url": f"data:image/png;base64,{b64}"}},
            ],
        }],
    }).encode()
    req = urllib.request.Request(URL, data=body, headers={
        "Authorization": f"Bearer {KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": "https://markready.app",
        "X-Title": "MarkReady",
    })
    print(f"Model: {MODEL}")
    print(f"Expected: secret code {SECRET}, tallest bar = D\n")
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.load(r)
    except urllib.error.HTTPError as e:
        print(f"HTTP {e.code}: {e.read().decode()[:500]}")
        print("\n=> Likely NOT vision-capable (model rejected image input).")
        return
    except Exception as e:
        print(f"ERROR: {e}")
        return

    answer = (data.get("choices") or [{}])[0].get("message", {}).get("content", "")
    print("Model answer:")
    print(answer)
    print()
    saw_code = SECRET in answer
    saw_bar  = "D" in answer.upper()
    if saw_code:
        print("=> VISION CONFIRMED: model read the secret code from the image.")
    elif saw_bar:
        print("=> PARTIAL: identified the bar but missed the code (weak OCR).")
    else:
        print("=> NO VISION: model could not read the image content.")

if __name__ == "__main__":
    main()
