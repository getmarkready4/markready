import base64, json, urllib.request

with open(r"C:\Users\User\Desktop\AI exam coach\scripts\redteam_chart.png", "rb") as f:
    image = "data:image/png;base64," + base64.b64encode(f.read()).decode()

question = (
    "The bar chart below shows the percentage of total beverage consumption in Northland "
    "in 2010 and 2023. Summarise the information by selecting and reporting the main features, "
    "and make comparisons where relevant."
)

essay = (
    "The bar chart illustrates the proportion of five types of beverages consumed in Northland "
    "in 2010 and 2023.\n\n"
    "Coffee was the most popular drink in 2010, accounting for 35% of total consumption, "
    "followed by tea at 30%. In 2023, coffee's share fell to 25%, while tea also declined "
    "slightly to 20%. These two beverages remained the top two choices across both years.\n\n"
    "In contrast, water experienced the most dramatic increase, rising from 15% in 2010 to "
    "28% in 2023, making it the second most consumed beverage by the end of the period. "
    "Juice also grew considerably, from 10% to 22%. Soda, meanwhile, was the least popular "
    "in both years and declined marginally from 7% to 5%.\n\n"
    "Overall, the data suggests that Northland residents should drink more water and less coffee "
    "for better health outcomes. The government should consider taxing sugary sodas to accelerate "
    "this trend."
)

payload = json.dumps({
    "question": question,
    "essay": essay,
    "taskType": "TASK1_ACADEMIC",
    "image": image,
}).encode()

req = urllib.request.Request(
    "http://localhost:3000/api/score",
    data=payload,
    headers={"Content-Type": "application/json"},
    method="POST",
)

print("Sending request...")
with urllib.request.urlopen(req, timeout=120) as resp:
    result = json.loads(resp.read())

print("overall_band:", result.get("overall_band"))
print("overview_present:", result.get("overview_present"))
print("data_accuracy_note:", result.get("data_accuracy_note"))
print()
for k, v in result.get("criteria", {}).items():
    print(f"{k}: band={v['band']}")
    print(f"  rationale: {v['rationale'][:150]}")
print()
print("weaknesses:")
for w in result.get("weaknesses", []):
    print(" -", w.get("issue", "")[:120])
