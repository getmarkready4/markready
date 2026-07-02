# AI Exam Writing Coach — Full Business Plan
*Working brand placeholder: "MarkReady" (exam-agnostic — do not brand as IELTS-only)*

---

## 1. Executive Summary

An AI writing feedback platform that scores exam essays against official band rubrics in seconds, returning what a human tutor takes 45 minutes to produce: per-criterion scores, specific actionable feedback, vocabulary upgrades, and a model paragraph at the target band. Launch product: IELTS Writing Task 2. Expansion: Task 1 → TOEFL → Speaking → PTE → OET → GMAT AWA → professional exams.

- **Launch market:** 3.8M IELTS tests/year, writing is the lowest-scoring section for Asian test-takers
- **Urgency wedge:** the 2024 IELTS writing-only retake rule (60-day window) created a high-urgency segment no product serves
- **Business model:** freemium B2C ($15–25/mo) + prep centre B2B ($300–800/mo)
- **Total build budget to revenue: USD $4,000–9,000**
- **Year 1 revenue target: $250K/mo run-rate by month 12**
- **Critical success factor:** scoring accuracy validated against real exam results before charging

---

## 2. Product Specification

### 2.1 MVP — Free Essay Scorer (Week 1–2)

The entire MVP is one page. No accounts, no payments.

| Component | Spec |
|---|---|
| Input | Question prompt (paste or select from bank) + essay text (paste). Word count display. |
| Processing | Claude API call with engineered rubric prompt. Target response < 15 seconds. |
| Output | Overall band (0.5 increments) + 4 criterion scores (Task Response, Coherence & Cohesion, Lexical Resource, Grammatical Range & Accuracy) + 3 specific weaknesses with quoted examples from the essay + 5 vocabulary upgrades + 1 model rewrite of the weakest paragraph |
| Capture | Email gate AFTER showing the overall band, BEFORE showing detailed feedback. This is the conversion mechanic. |
| Anti-abuse | Rate limit: 1 free essay per email per week. Disposable-email blocking. |

**Scoring prompt engineering requirements (the actual product):**
- Full IELTS public band descriptors embedded per criterion
- Few-shot examples: 6–10 sample essays with known examiner scores per band level
- Calibration rule: when uncertain between two bands, score the lower (under-promising protects trust)
- Output as structured JSON for consistent rendering

### 2.2 V1 Paid Product (Month 2)

| Feature | Detail |
|---|---|
| Accounts + Stripe | Monthly + annual subscriptions |
| Unlimited essays | Both Task 1 (academic + general) and Task 2 |
| Weakness tracking | Dashboard: criterion scores over time, recurring error types, band trajectory |
| Question bank | 300+ real and AI-generated prompts by topic category |
| Timed mode | 40-min (T2) / 20-min (T1) countdown, locked editing at end |
| Model answers | Full Band 8 model answer per question after submission |
| Retake mode | "I'm retaking Writing in X days" — generates a day-by-day practice plan for the 60-day retake window |

### 2.3 V2 (Month 3–6)
- TOEFL Independent + Integrated Writing module (month 2–3)
- IELTS Speaking module: browser audio recording → Whisper/STT → same rubric engine (month 3–4)
- PTE Writing (month 4)
- OET Writing — healthcare letter rubric + clinical vocabulary layer (month 5)
- GMAT AWA + GRE (month 6)
- B2B prep centre dashboard: class management, student progress reports, white-label option

### 2.4 Build approach for a non-technical founder

| Path | Cost | Time | Notes |
|---|---|---|---|
| AI coding tools (Claude Code / Cursor / Replit) yourself | ~$100/mo tools | 2–4 weeks MVP | Viable — this product is a thin UI over an API |
| Freelance dev (Upwork, Eastern Europe/PH) | $2,000–5,000 MVP | 2–3 weeks | Recommended for V1 payments/accounts |
| No-code (Bubble + API connector) | $32–134/mo | 1–2 weeks | Fastest MVP, migrate later |

**Recommended:** Build the MVP scorer yourself with AI coding tools (it is genuinely one page + one API call), hire a freelancer for V1 accounts/billing/dashboard.

### 2.5 Scoring accuracy validation protocol (non-negotiable before paywall)
1. Beta cohort of 100+ users who have a real IELTS test booked within 60 days
2. Incentive: free lifetime premium for sharing their official result
3. Measure: AI score vs official score. Target: ≥75% within ±0.5 band; ≥95% within ±1.0 band
4. Iterate prompt/few-shots until target met. Publish the accuracy stat — it becomes the headline marketing claim ("Our scores match real examiners within half a band, 75%+ of the time")

---

## 3. Pricing

### B2C
| Tier | Price | Includes |
|---|---|---|
| Free | $0 | 1 essay/week, overall band + summary feedback only |
| Premium | $19/mo or $99/yr | Unlimited essays, full feedback, tracking, timed mode, model answers, retake plan |
| Premium+ (post-Speaking launch) | $29/mo or $149/yr | Everything + Speaking practice |

Regional pricing (PPP): India/PH/BD/PK at $9–12/mo equivalent via regional Stripe pricing. Volume over margin in these markets.

### Professional exams (month 5+)
OET: $49/mo. GMAT AWA + GRE bundle: $39/mo. No free tier — 1 sample scoring only.

### B2B prep centres
| Tier | Price | Includes |
|---|---|---|
| Centre Basic | $300/mo | Up to 100 active students, teacher dashboard |
| Centre Pro | $600/mo | Up to 400 students, progress reports, priority support |
| White-label | $1,000/mo | Centre's own branding, custom domain |

---

## 4. Go-To-Market

### 4.1 Phase 0 — Pre-launch (Weeks 1–2, parallel with build)
- Reddit presence: r/IELTS (180K), r/TOEFL, r/immigration, r/gradadmissions. Genuinely answer writing questions. No links yet.
- Collect 50 essays from volunteers ("free human+AI feedback") to calibrate the scorer and build before/after examples

### 4.2 Phase 1 — Free tool launch (Weeks 2–6)
1. **Reddit launch post on r/IELTS:** "I built a free tool that scores your Task 2 essay against the official band descriptors in 10 seconds — looking for feedback." Show a real scored example in the post. Mods: message first, offer the tool with zero monetisation visible.
2. **The retake segment:** posts/comments targeting "One Skill Retake" discussions in IELTS Facebook groups (IELTS Preparation groups have 1M+ combined members). Hook: "Retaking Writing only? You have 60 days. Here's a free scorer calibrated to the band descriptors."
3. **Quora + IELTS forums:** answer "why did I get 6.0 in writing" questions with genuinely useful analysis + tool link.

### 4.3 Phase 2 — Paid conversion + content engine (Months 2–6)

**YouTube (primary long-term channel):**
- "I scored 50 real IELTS essays with AI — what Band 7 actually looks like" (flagship)
- "Band 6 vs Band 7 vs Band 8: the same essay rewritten three times"
- "The 5 Task Response mistakes that cap you at 6.5"
- Weekly cadence. Each video targets a high-intent search term. Expect 6-month compounding.

**Instagram + TikTok (high-frequency, low-cost):**
- Format 1 — *Before/After carousel:* "This sentence is Band 6. Here's the Band 8 version." Side-by-side, 5 slides, ends with score reveal. Highly shareable in study communities.
- Format 2 — *Real essay teardown Reels:* 30–45s screen-record of the scorer analysing an essay, voiceover explaining the weakest criterion. Hook in first 2s: "This essay got 6.5. The fix takes one paragraph."
- Format 3 — *Vocab upgrade posts:* "Stop writing 'important.' Examiners see it 40 times a day." 5 upgrades per post.
- Format 4 — *Retake countdown content:* "Day 1 of 60: your writing retake plan."
- Cadence: 1 Reel/day, 3 carousels/week. All content generated with AI assistance from real (anonymised) essay data — near-zero production cost.
- Hashtag/community targeting: #ielts #ieltswriting #ieltspreparation (millions of posts, active study community especially India/PH/Vietnam)

**Creator partnerships:** 5 micro IELTS creators (10–100K followers) in PH, India, Vietnam at $100–300/post or affiliate (30% first-3-months rev share). IELTS study creators have extremely engaged audiences and low sponsorship rates.

**SEO:** 20 articles targeting "ielts writing band descriptors explained," "task 2 essay checker," "ielts writing retake tips," "[topic] task 2 model answer." AI-drafted, human-edited.

### 4.4 Phase 3 — B2B (Months 3–8)
- Direct outreach to IELTS prep centres in Manila, Mumbai, Dhaka, Ho Chi Minh City (highest volumes). Offer: 60 days free institutional access. Their students' results validate accuracy; their logo validates you.
- OET: Filipino nurse communities (PH Nurses Abroad FB groups, 200K+ members) + nursing review centres in Manila — these centres prep thousands of OET candidates per year.

### 4.5 Marketing hooks (tested angles)
- "45 minutes of tutor feedback. 8 seconds." (speed)
- "Find out your band score before the examiner does." (certainty/anxiety)
- "Your Writing retake is in 60 days. Every essay you write should be scored." (retake urgency)
- "Scored within ±0.5 of real examiners, 75% of the time." (accuracy — once validated)
- "Your tutor charges $50/hour. This is $19/month. Unlimited." (price anchor)

---

## 5. Budget — Total Build to Revenue

| Item | Cost (USD) |
|---|---|
| Domain + hosting (Vercel/Supabase free tiers → paid) | $50–200 |
| AI coding tools (Claude Code/Cursor, 3 months) | $300 |
| Freelance dev — V1 accounts/billing/dashboard | $2,000–4,000 |
| Claude API costs (beta + first 1,000 free users) | $300–800 |
| Stripe setup | $0 (per-transaction fees only) |
| Logo/brand (Fiverr/AI) | $50–150 |
| Creator partnerships (5 micro-creators) | $500–1,500 |
| Paid social testing budget (IG/TikTok, optional month 3+) | $500–1,500 |
| Legal: ToS/privacy (template + review) | $300–500 |
| **Total to first revenue** | **$4,000–9,000** |

Ongoing monthly at 1,000 paying users: API ~$800–1,500, hosting ~$100, tools ~$150. Gross margin ≥ 85%.

---

## 6. Revenue Projections

Assumptions: free→paid conversion 4–6%; monthly churn 12–15% (exam products churn on test completion — retake plans and multi-exam expansion offset); B2C ARPU $16 blended (regional pricing).

| Month | Free users (cum.) | Paying B2C | B2B centres | MRR |
|---|---|---|---|---|
| 1 | 1,000 | 0 (validation) | 0 | $0 |
| 2 | 3,000 | 150 | 2 | $3.8K |
| 4 | 10,000 | 800 | 10 | $17K |
| 6 | 25,000 | 2,500 | 30 | $55K |
| 9 | 50,000 | 5,000 | 55 | $105K |
| 12 | 90,000 | 9,500 | 80 | $200–250K |
| 24 | 250,000 | 25,000 | 150 | $700K+ |

Sensitivity: at 3% conversion and 18% churn, month 12 MRR ≈ $90–110K — still strongly profitable on this cost base.

---

## 7. KPIs

**North star:** weekly scored essays (usage = value delivered = conversion + retention driver)

| Category | KPI | Target |
|---|---|---|
| Accuracy | % AI scores within ±0.5 of official results | ≥75% before paywall; ≥80% by month 6 |
| Acquisition | Free signups/week | 500+ by month 3 |
| Acquisition | CAC (blended) | <$5 organic-led; <$15 with paid |
| Activation | % new users scoring ≥2 essays in week 1 | ≥40% |
| Conversion | Free → paid | ≥4% (watch weekly cohorts) |
| Retention | Month-1 paid retention | ≥75% |
| Retention | Essays/paying user/week | ≥3 |
| Revenue | MRR growth MoM | ≥25% months 2–12 |
| B2B | Centre student activation rate | ≥50% of seats active monthly |
| Unit economics | LTV:CAC | ≥4:1 |
| Cost | API cost per paying user | <$1.50/mo |

**Kill/pivot criteria:** if scoring accuracy cannot reach 75% within ±0.5 after 8 weeks of calibration, do not launch the paywall — the product promise fails. Pivot to "feedback without band prediction" positioning or stop.

---

## 8. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Scoring accuracy below promise | Validation protocol before paywall; conservative scoring bias; publish accuracy stats |
| Duolingo/British Council builds this | Speed + niche depth (retake mode, OET) + accuracy reputation; 2–3 yr window |
| Churn on test completion | Retake plans, multi-exam cross-sell (IELTS→OET→GMAT), annual pricing |
| API cost blowout on free tier | 1 free essay/week cap, email gate, disposable-email blocking |
| Reddit/community backlash to monetisation | Free tier stays genuinely useful forever; transparent founder posting |

---

## 9. 90-Day Action Plan

| Week | Action |
|---|---|
| 1–2 | Build MVP scorer (AI coding tools). Begin Reddit presence. Collect 50 calibration essays. |
| 3 | Launch free tool on r/IELTS + FB groups. Start beta accuracy cohort. |
| 4–6 | Iterate scoring to accuracy target. Hire freelancer for V1. Start IG/TikTok daily content. |
| 7–8 | Launch paywall + Task 1. First creator partnerships. |
| 9–10 | First 3 prep centre pilots (Manila/Mumbai outreach). TOEFL module build. |
| 11–12 | Publish accuracy stats. Flagship YouTube video. Review KPIs vs targets; decide Speaking module timing. |
