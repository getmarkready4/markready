"""
Generate a synthetic bar chart for red-team scoring test.
Ground truth values are hardcoded here — the essay will cite wrong ones.
"""
import matplotlib.pyplot as plt
import numpy as np

# Ground truth (what the chart actually shows)
categories = ["Coffee", "Tea", "Juice", "Water", "Soda"]
year_a = [45, 30, 10, 8, 7]   # 2010 (%)
year_b = [25, 20, 22, 28, 5]  # 2023 (%)

x = np.arange(len(categories))
width = 0.35

fig, ax = plt.subplots(figsize=(8, 5))
bars_a = ax.bar(x - width/2, year_a, width, label="2010", color="#2E6FAD")
bars_b = ax.bar(x + width/2, year_b, width, label="2023", color="#E07B39")

ax.set_ylabel("% of total beverage consumption")
ax.set_title("Beverage consumption in Northland: 2010 and 2023")
ax.set_xticks(x)
ax.set_xticklabels(categories)
ax.set_ylim(0, 55)
ax.legend()
ax.bar_label(bars_a, padding=3)
ax.bar_label(bars_b, padding=3)
ax.yaxis.grid(True, linestyle="--", alpha=0.5)
ax.set_axisbelow(True)

plt.tight_layout()
out = r"C:\Users\User\Desktop\AI exam coach\scripts\redteam_chart.png"
plt.savefig(out, dpi=150)
print(f"Saved to {out}")
print("\nGROUND TRUTH:")
for c, a, b in zip(categories, year_a, year_b):
    print(f"  {c}: 2010={a}%, 2023={b}%")
