# Extracted Task 1 chart data (verified from source PDFs)

Font for all charts: **Arial, Helvetica, sans-serif** (Arial is the real text font in both
the Goldman deck and the TechNet agenda the user pointed to; no download/embed needed).
Colours: Goldman navy #12284B / steel #8FAAC9 / plum #6E1E50 / gold #B4894A.

## Batch 1 — Cambridge 17 (CAMBRIDGE-17-TEST.pdf, vector text layer, high confidence)

### Test 1 (p28) — MAPS (not a data chart)
"The maps below show an industrial area in the town of Norbiton, and planned future
development of the site." Now: Farmland, Factory, Town, River. Planned: Farmland,
Housing, Medical centre, Playground, Town, School, Shops. → illustration, handle separately.

### Test 2 (p50) — TABLE + two PIES — "Police Budget 2017–2018 (in £m)"
Table (Sources / 2017 / 2018):
- National Government: 175.5 / 177.8
- Local Taxes: 91.2 / 102.3
- Other sources (eg grants): 38 / 38.5
- Total: 304.7 / 318.6
Pies "How the money was spent" (Salaries / Technology / Buildings and transport):
- 2017: 75 / 8 / 17
- 2018: 69 / 14 / 17

### Test 3 (p72) — GROUPED HORIZONTAL BAR — "1968 and 2018: average weekly spending by families"
X = % of weekly income (0–40). Series: 1968, 2018.
- Food: 35 / 17
- Housing: 10 / 19
- Fuel and power: 6 / 4
- Clothing and footware: 10 / 5   (book spelling: "footware")
- Household goods: 8 / 8
- Personal goods: 8 / 4
- Transport: 8 / 14
- Leisure: 9 / 22

### Test 4 (p93) — MULTI-LINE — "Number of shop closures and openings 2011–2018"
Y = 0–9,000. Series: Closures, Openings.
| Year | Closures | Openings |
| 2011 | 6400 | 8500 |
| 2012 | 5900 | 3900 |
| 2013 | 7200 | 5000 |
| 2014 | 6500 | 6200 |
| 2015 | 600  | 4000 |
| 2016 | 5200 | 4000 |
| 2017 | 5000 | 4200 |
| 2018 | 5200 | 3000 |

## Remaining books to extract (scanned images — read visually)
- Cambridge 11 Academic (has Ashdown Museum, Test 1 — validate my current numbers)
- Cambridge 14 Academic
- Cambridge 15 Academic
- Cambridge 18
- 5_6215512783409120184-1.pdf (unidentified book)

## Chart-type inventory so far
grouped bar (h/v) · multi-line · pie · table · (maps/process = illustration, TBD)
→ Plan: build reusable primitives (Bar, Line, Pie, Table) driven by data objects.
