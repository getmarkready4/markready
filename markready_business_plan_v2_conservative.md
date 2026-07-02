# AI Exam Writing Coach — Business Plan (v2, Conservative)
*Working brand placeholder: "MarkReady" (exam-agnostic — do not brand as IELTS-only)*

> **What changed in v2:** launch, growth, and conversion numbers have been rebuilt from conservative ground-up assumptions instead of top-down targets. The optimistic projection table from v1 (150 paying users by month 2, 90,000 free users and $200K+ MRR by month 12) is treated as a *bull case*, not a plan. All figures here align with the companion model `markready_year1_financial_model.xlsx`. Currency: USD throughout (HK compliance costs converted from HKD at the 7.8 peg).

---

## 1. Executive Summary

An AI writing feedback platform that scores exam essays against official band rubrics in seconds: per-criterion scores, specific feedback, vocabulary upgrades, and a model paragraph at the target band. Launch product: IELTS Writing Task 2. Expansion path: Task 1 → TOEFL → Speaking → PTE → OET → GMAT AWA.

- **Launch market:** Philippines-first (English comfort, OET nursing crossover, clean Stripe rails, high per-candidate stakes)
- **Urgency wedge:** the IELTS writing-only retake rule (60-day window) creates a high-urgency segment no product serves
- **Business model:** freemium B2C (regional pricing ~$7–19/mo) + later prep-centre B2B
- **Legal base:** Hong Kong private limited company (see companion cost file)
- **Year 1 reality (conservative base case):** ~6,700 cumulative free users, ~107 paying users and ~$1,284 MRR exiting month 12; Year 1 net loss ~$8,200; out-of-pocket funding need ~$8,700 at the trough
- **Critical success factor:** scoring accuracy validated against real exam results before charging

The honest framing: Year 1 is a validation-and-foundation year, not a profit year. The business reaches *operational* monthly breakeven (revenue covering recurring costs) around month 10. The case for the business is what happens in Years 2–3 once content/SEO compounding, multi-exam expansion, and B2B kick in — not Year 1 revenue.

---

## 2. Product Specification

### 2.1 MVP — Free Essay Scorer (Week 1–2)
One page. No accounts, no payments. Paste question + essay → overall band + 4 criterion scores + 3 specific weaknesses + 5 vocab upgrades + 1 model rewrite. Email gate *after* showing the overall band, *before* detailed feedback (the conversion mechanic). Rate limit: 1 free essay per email per week; disposable-email blocking.

**Scoring prompt engineering (the actual product):** full IELTS public band descriptors embedded per criterion; 6–10 few-shot essays with known examiner scores; conservative calibration (score the lower band when uncertain); structured JSON output.

### 2.2 V1 Paid Product (Month 2–3)
Accounts + Stripe; unlimited Task 1 + Task 2; weakness-tracking dashboard; 300+ question bank; timed mode; Band 8 model answers; retake-plan mode for the 60-day window.

### 2.3 V2 (Month 4–9+)
TOEFL Writing; IELTS Speaking (browser audio → STT → same rubric engine); PTE; OET (healthcare letter rubric + clinical vocab); GMAT AWA/GRE; B2B prep-centre dashboard. Sequenced behind validated accuracy and the first signs of B2C retention — not launched in parallel.

### 2.4 Build approach (non-technical founder)
Build the MVP scorer yourself with AI coding tools (it is genuinely one page + one API call); hire a freelancer (~$3,000) for V1 accounts/billing/dashboard. Total build-to-revenue tooling and dev: ~$3,750 one-off (see budget).

### 2.5 Scoring accuracy validation (non-negotiable before paywall)
Beta cohort of 100+ users with a real IELTS test booked within 60 days; incentive: free premium for sharing their official result; target ≥75% of AI scores within ±0.5 band, ≥95% within ±1.0; iterate until met; publish the stat as the headline marketing claim. **Kill criterion:** if ±0.5 accuracy can't reach 75% after 8 weeks of calibration, do not launch the paywall.

---

## 3. Pricing

### B2C (regional-first)
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 essay/week, overall band + summary only |
| Regional (PH launch) | ~$12/mo | Unlimited essays, full feedback, tracking, timed mode, model answers, retake plan |
| Standard (other markets) | ~$19/mo | Same feature set |
| Emerging (BD/NP/PK) | ~$7/mo | Same feature set, lowest-income markets |

**Blended ARPU assumed in the model: $12** (Philippines-first means regional pricing dominates the early mix — *not* the $16 used in v1).

### Professional & B2B (Year 2+)
OET ~$49/mo; GMAT/GRE bundle ~$39/mo. Prep-centre tiers from ~$300/mo. **Excluded from Year 1 revenue projections — treated as upside.**

---

## 4. Go-To-Market (Realistic)

### 4.1 The honest launch curve
A product launching from a standing start with no existing audience does not pull thousands of signups in week one. A *good* r/IELTS launch yields a few hundred signups, not a few thousand, and depends heavily on whether one post happens to catch. The base case assumes a slow ramp:

| | M1 | M2 | M3 | M6 | M9 | M12 |
|---|---|---|---|---|---|---|
| New free signups/mo | 60 | 120 | 200 | 500 | 800 | 1,100 |
| Cumulative free users | 60 | 180 | 380 | 1,580 | 3,680 | 6,680 |

### 4.2 Phase 0 — Pre-launch (Weeks 1–2)
Genuine presence in r/IELTS, r/TOEFL, IELTS Facebook groups. Answer writing questions, no links. Collect ~50 calibration essays from volunteers.

### 4.3 Phase 1 — Free tool launch (Weeks 2–6)
Reddit launch post on r/IELTS showing a *real* scored example (message mods first, zero monetisation visible). Target the "One Skill Retake" segment in IELTS FB groups ("Retaking Writing only? You have 60 days. Here's a free scorer calibrated to the band descriptors"). Answer high-intent Quora/forum questions with genuine analysis + tool link.

### 4.4 Phase 2 — Conversion + content engine (Months 2–9)
This is a **6-month compounding bet**, not a month-2 switch. YouTube (flagship "I scored 50 real IELTS essays with AI"), Instagram/TikTok before-after carousels and teardown reels (near-zero production cost from anonymised essay data), 5 micro-creators in PH/Vietnam at $100–300/post, SEO articles targeting high-intent terms. Expect the first genuinely encouraging MRR month around month 4–6, not month 2.

### 4.5 Phase 3 — B2B (Months 6–12, upside)
Direct outreach to Manila/HCMC prep centres; 60 days free institutional access; their results validate accuracy, their logos validate you. OET via Filipino nurse communities and Manila review centres. Long sales cycles — modelled as $0 in the base case.

### 4.6 Conversion reality
Freemium free-to-paid typically sits at 2–5%; the base case uses **2.5%**. Exam products churn hard on test completion; the base case uses **15% monthly churn**. Retake plans, annual pricing, and multi-exam cross-sell are the levers to pull churn down over time.

---

## 5. Budget — Build to Revenue

### One-off (Year 1)
| Item | Cost (USD) |
|---|---|
| HK incorporation (bundled setup) | ~1,300 |
| Freelance dev — V1 accounts/billing/dashboard | ~3,000 |
| Legal — ToS / privacy (template + review) | ~400 |
| Brand / logo | ~150 |
| Domain & initial setup | ~100 |
| **Total one-off** | **~4,950** |

### Recurring (monthly, ramping)
| Item | Monthly |
|---|---|
| Hosting & infrastructure | $0 → $100 |
| AI coding tools | ~$100 |
| Marketing (content, creators, tools) | $150 → $300 |
| HK compliance (recurring, amortized incl. audit accrual) | ~$320 |
| API / scoring (variable, usage-driven) | scales with users |
| Payment processing (~5% of revenue) | scales with revenue |

Ongoing fixed recurring settles around **$700–900/month** by mid-year. Note: HK's first statutory audit/PTR is not due until ~18 months after incorporation, so part of the ~$320/mo compliance line is an *accrual* you set aside rather than a Year 1 cash outflow — conservatively included anyway.

---

## 6. Financial Projection — Year 1 (Conservative Base Case)

Full monthly model with formulas: `markready_year1_financial_model.xlsx`. Headline shape:

| Month | Cum. free | Paying | MRR | Net month | Cumulative cash |
|---|---|---|---|---|---|
| M1 | 60 | 0 | $0 | ($4,022) | ($4,022) |
| M2 | 180 | 5 | $60 | ($2,019) | ($6,041) |
| M3 | 380 | 9 | $108 | ($477) | ($6,518) |
| M4 | 680 | 16 | $192 | ($602) | ($7,120) |
| M6 | 1,580 | 33 | $396 | ($419) | ($8,055) |
| M8 | 2,980 | 55 | $660 | ($230) | ($8,646) |
| M9 | 3,680 | 67 | $804 | ($99) | ($8,745) |
| M10 | 4,580 | 80 | $960 | $43 | ($8,702) |
| M12 | 6,680 | 107 | $1,284 | $339 | ($8,178) |

**Year 1 totals:** revenue ~$6,384 · costs ~$14,562 · **net ~($8,178)**.

Reading it: you fund roughly **$8,700 out of pocket** at the trough (around months 8–9), driven mostly by the front-loaded one-off build + setup costs. The business turns **operationally profitable month-to-month around month 10**, but Year 1 still closes at a cumulative loss because those one-offs are never "earned back" within twelve months at conservative volumes. This is normal and healthy for an indie SaaS in year one — the model's purpose is to show the funding need and the breakeven *timing*, not to promise Year 1 profit.

### Scenario sensitivity
- **Bear case** (conversion 1.5%, churn 18%, half the signups): ~$600–700 MRR exiting M12; cumulative loss ~$10–11K. Still survivable on this cost base.
- **Bull case** (conversion 4%, ARPU $16, churn 12%, ~2x signups): ~$4–6K MRR exiting M12, approaching cumulative breakeven within Year 1. This is roughly where v1's plan sat — possible, but should be earned, not assumed.

---

## 7. KPIs

**North star:** weekly scored essays (usage = value delivered = conversion + retention driver).

| KPI | Conservative target |
|---|---|
| % AI scores within ±0.5 of official | ≥75% before paywall |
| Free signups/week | 100–250 by month 3 |
| Free → paid conversion | ≥2.5% (measure weekly cohorts) |
| Month-1 paid retention | ≥85% (i.e. churn ≤15%) |
| Essays/paying user/week | ≥2 |
| Operational (monthly) breakeven | by ~month 10 |
| API cost per paying user | <$1.50/mo |

**Kill/pivot criterion:** if ±0.5 accuracy can't reach 75% after 8 weeks of calibration, do not launch the paywall — pivot to "feedback without band prediction" or stop.

---

## 8. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Launch under-performs (likely vs v1 hopes) | Conservative base case already assumes this; cost base survives the bear case |
| Scoring accuracy below promise | Validation protocol before paywall; conservative scoring bias; publish stats |
| Churn on test completion | Retake plans, multi-exam cross-sell, annual pricing |
| Bigger player builds this | Speed + niche depth (retake mode, OET) + accuracy reputation |
| HK compliance cost/timing surprise | Audit deferred to ~month 18; accrued monthly anyway; see cost file |
| Running out of patience before compounding | Treat Year 1 as foundation; the return is Years 2–3 |

---

## 9. 90-Day Action Plan
| Week | Action |
|---|---|
| 1–2 | Build MVP scorer. Begin Reddit/FB presence. Collect 50 calibration essays. |
| 3 | Launch free tool on r/IELTS + FB groups. Start beta accuracy cohort. |
| 4–6 | Iterate scoring to ±0.5 / 75% target. Start daily IG/TikTok content. |
| 7–8 | Register HK company. Launch paywall + Task 1. Hire freelancer for V1. |
| 9–10 | First creator partnerships. TOEFL module build begins. |
| 11–12 | Publish accuracy stats. Flagship YouTube video. Review KPIs vs conservative targets. |

> Incorporate the HK company at the point you flip the paywall on (weeks 7–8), not before — registration is required within 30 days of carrying on business, and breakeven on the incremental HK cost is only ~38 paying users, so there's no funding reason to delay or to incorporate early.
