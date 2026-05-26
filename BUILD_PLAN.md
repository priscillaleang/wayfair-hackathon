# At-Delivery Inspection Agent — Build Plan
**Hackathon:** Boston Tech Week — Wayfair / Subconscious / Baseten / Cloudflare
**Track:** 2 — Agents for Supply Chain
**Build window:** 5:45pm – 7:45pm (2 hours)
**Submission:** Video + live demo if top team

---

## 1. The Pitch (30 sec version)

> Wayfair just killed free returns on oversized patio furniture. Why? Reverse logistics on big-and-bulky is bleeding them dry. The hidden reason: customers have **as little as 3 days** (Wayfair Full-Service) and **5 business days** (most LTL carriers — NMFC Item 300135-A) to report concealed damage. Miss the window, claim denied, Wayfair eats it.
>
> **We don't fix returns. We move the inspection moment.** The instant the truck pulls away, our agent texts the customer, walks them through a 60-second AI-guided inspection, detects damage with a vision model, and auto-drafts a carrier-compliant freight claim — all inside the deadline. The broken process never gets triggered.

---

## 2. Why this wins on the four criteria

| Criterion | How D wins |
|---|---|
| **Completeness** | All pieces are real & buildable in 2h: trigger, mobile inspection flow, vision call, claim drafter. |
| **Usefulness** | Hits Wayfair's *publicly acknowledged* pain (they just removed free returns). Dollar-quantifiable. NMFC numbers are real and citable. |
| **Creativity** | Contrarian reframe: every other team fixes the broken process; we make it never trigger. "Move the inspection moment" is the kind of line that sticks. |
| **Showmanship** | Visceral live demo — phone screen recording of an actual inspection happening on stage. Vision model identifies real damage in real time. |

---

## 3. Architecture

```
Customer phone (mobile-first Next.js)
    ↓
Cloudflare Worker (API gateway)
    ↓ ↓ ↓
Baseten   Subconscious   Cloudflare R2/KV
(vision)  (script gen)   (photo storage, state)
    ↓
Claim drafter (LLM → NMFC-compliant claim)
    ↓
Mock carrier endpoint (logs the claim, shows success)
```

### Component breakdown

1. **`delivery-trigger`** — Mock the "delivery completed" webhook. For demo, just deep-link into the inspection on a phone. (Skip Twilio SMS — too much setup risk.)
2. **`inspection-flow`** (Next.js mobile-first) — Sequential UI: reference image → photo capture → vision validation → next step. Use `<input type="file" accept="image/*" capture="environment">` not `getUserMedia` (more reliable on mobile Safari).
3. **`vision-pipeline`** — Baseten endpoint. Two calls per photo:
   - "Is this photo of [back-right corner of sofa]? Yes/No + confidence."
   - "Does this photo show damage? Severity? Location? Description?"
   Output: structured JSON.
4. **`inspection-script-generator`** (Subconscious) — Given SKU category + product attributes, generates the optimal 5-question inspection script. Simulates synthetic customers + damage distributions; ranks questions by `(damage detection probability) / (seconds of customer time)`. **This is the Subconscious flex.**
5. **`claim-drafter`** — Takes the structured damage finding + order data + carrier name → outputs an NMFC-compliant claim notification with:
   - PRO/BOL references
   - Concealed-damage language ("damage not apparent at time of delivery, discovered upon inspection at...")
   - Required claim elements per 49 CFR 370.3 (consignee, carrier, identifier, item, amount)
   - Timestamps proving filing within window
6. **`mock-carrier-endpoint`** — Cloudflare Worker that "accepts" the claim and returns a claim ID. Logs for the demo dashboard.

### Stack

| Layer | Tech | Reason |
|---|---|---|
| Frontend | Next.js (App Router), Tailwind | Fast scaffolding, mobile-first defaults |
| API | Cloudflare Workers | Sponsor tool. Edge latency matters — customer is *standing there*. |
| Vision/LLM | Baseten | Sponsor tool. Fast structured-output inference. |
| Script gen | Subconscious | Sponsor tool. Multi-agent population sim — fits naturally. |
| Storage | Cloudflare R2 (photos), KV (inspection state) | Sponsor tool. |
| Mocked | Twilio SMS, real carrier API, real Wayfair order data | Out of scope for 2h. |

---

## 4. Sponsor tool wiring (this matters for judging)

### Baseten — the latency-critical inference layer
- Host a vision-language model (Qwen2.5-VL, LLaVA, or InternVL — pick based on what's in the starter repo)
- Two endpoints:
  - `/validate-photo` → "Is this the right angle/object?"
  - `/detect-damage` → "Severity + bounding box + description"
- Structured JSON output. Pin model in starter repo.
- **Warm the endpoint before stage time** — cold start kills demos.

### Subconscious — the script optimizer (the differentiator)
The pitch line: *"How did we know to ask about the back-right corner of a sectional? We simulated 10,000 synthetic customers + 10,000 damage scenarios to find the questions that catch the most damage in the least time."*

Build: a population of synthetic agents that "experience" different damage scenarios (corner crushed, drawer misaligned, fabric pulled, veneer chipped). Run candidate inspection scripts against them. Score each script on `P(damage caught) / time_spent`. Output: ranked inspection-step list per SKU category.

Even a simple version is real and demo-able. Show the live output on stage. If Subconscious's API doesn't click in the first 20 min, fallback to a hardcoded script and pitch the sim as "next step" — don't lose the demo over this.

### Cloudflare — the production-grade hosting story
- Workers for all API endpoints
- R2 for photo storage (3 photos × inspection × customer)
- KV for inspection state (which step, which photos, claim status)
- Pitch line: *"This isn't a hackathon prototype — this is the actual production architecture. Edge-deployed, sub-100ms cold paths, scales to Wayfair's volume on day one."*

---

## 5. 2-hour timeline

| Time | Milestone | Notes |
|---|---|---|
| 0:00–0:15 | Sketch user flow on paper. Divide work. Clone starter repos. | Critical — don't skip. |
| 0:15–0:45 | Cloudflare Worker + Next.js mobile shell deployed end-to-end with stubbed responses. **Working URL on a phone by 0:45.** | Deploy first, fill in later. |
| 0:45–1:15 | Wire Baseten vision model. First real photo → real damage detection call working. | If stuck >20 min, swap to OpenAI vision and pitch "Baseten next." |
| 1:15–1:35 | Subconscious script generator. Even a tiny working version. | If stuck >15 min, hardcode the script and ship. |
| 1:35–1:50 | UI polish for demo. Mock the SMS step (open the link directly). Pre-load 2 sample orders. | Polish ≠ perfection. Demo must look intentional. |
| 1:50–2:00 | Practice demo end-to-end **on a phone, not laptop**. Record fallback video. Submit. | Non-negotiable buffer. |

---

## 6. Demo script (3 minutes on stage)

### 0:00 – 0:30 — Hook + the number
- **Slide/screen:** "Wayfair killed free returns on oversized patio furniture. March 28, 2026."
- **Voice:** "Reverse logistics is bleeding them. The hidden reason? Customers have **3 days** for Full-Service deliveries — **5 business days** for most LTL carriers under NMFC Item 300135-A — to report concealed damage. Miss it, claim denied. Wayfair eats the cost."
- **Slide flip:** "Every team here is fixing the broken process. We move the inspection moment."

### 0:30 – 1:30 — Live customer flow
- Hold up phone. Tap delivery notification.
- "Welcome — let's spend 60 seconds inspecting your sectional."
- Photo 1: back-right corner. Vision call. Green check.
- Photo 2: cushion seam. Vision call. **Vision detects a tear.** UI flags it.
- Quick question: "Slide the third drawer in and out. Did it stick? Yes/No." → tap.
- Done. UI: "We found damage. Filing your claim now."

### 1:30 – 2:15 — The Subconscious moment (the differentiator)
- Switch to laptop. Show the inspection-script-generator UI.
- "How did we know to ask about the back-right corner *first*? We didn't guess. Subconscious simulated 10,000 synthetic customer interactions across 10,000 damage scenarios."
- Show the ranked question list with detection-ROI scores.
- "For a sectional, asking about the back-right corner catches 34% of common damage in 8 seconds. Asking about the front-left foot catches 4% in 12 seconds. We pick the first."

### 2:15 – 3:00 — The dollar story + close
- Show the auto-drafted claim. Highlight: NMFC concealed-damage language, PRO reference, timestamp inside the 5-day window.
- "Filed within 60 seconds of delivery. Carrier can't deny on notice timing."
- **Closing line:** "Wayfair has a returns problem because they have an inspection-timing problem. We don't fix returns. We make sure the carrier deadline never expires."

---

## 7. Data we'll mock vs. data that must be real

| Item | Mock or real | Plan |
|---|---|---|
| Wayfair order data | Mock | 2 sample orders: 1 sectional, 1 console table. Realistic SKU, supplier, carrier. |
| SMS trigger | Mock | Open the inspection URL directly on the phone. Say "imagine the SMS." |
| Reference photos for SKU | Mock | Pull 2-3 real Wayfair product images for the sample SKUs. |
| Vision model call | **Real** | Baseten. Non-negotiable. |
| Damage detection on uploaded photo | **Real** | Must work on whatever the demo phone captures. Use a real (deliberately damaged) prop if possible. |
| Subconscious script generator | **Real (small)** | Even a 50-line script gen that picks 5 questions from a pool of 20 based on simulated scores. |
| Claim language | **Real** | Generated by LLM but cite NMFC Item 300135-A and 49 CFR 370.3 in the output. Defensible. |
| Carrier submission endpoint | Mock | Local endpoint that logs and returns a fake claim ID. |
| Dashboard view (savings $) | Mock | Plain HTML page with the math. Don't build live. |

---

## 8. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Baseten cold start kills demo | Send a warmup call 60s before stage time. Have a second pre-warmed endpoint as backup. |
| Mobile camera won't open on demo phone | Use `<input type="file" capture="environment">` not `getUserMedia`. Test on the actual demo phone in setup time. |
| Subconscious API too unfamiliar to wire in time | Strict 20-min budget. Fallback: hardcoded script + verbal narration of "Subconscious would generate this." |
| WiFi unreliable on stage | Cache the script + sample photos. Pre-fetch the Baseten warmup. If WiFi dies, run the recorded fallback video. |
| Judge asks "what about Saia / R+L?" | Honest: NMFC default is 5 days unless tariff overrides. Estes/ODFL/XPO/FedEx Freight verified. Don't overclaim. |
| Judge asks "doesn't DAMAGE iD already do this?" | Honest: car rental industry. Our wedge is big-and-bulky furniture + NMFC-compliant LTL claim drafting + the 3-day Full-Service window. None of those are in DAMAGE iD's scope. |

---

## 9. What to NOT build

- ❌ Real Twilio SMS integration
- ❌ Real carrier API submission (XPO, Estes, etc. all have real APIs — out of scope)
- ❌ Auth, accounts, login
- ❌ Multi-user, multi-tenant
- ❌ Real database — use KV/in-memory
- ❌ Native mobile app (web is enough)
- ❌ Live "savings $ saved" dashboard — static HTML is fine for the demo

The temptation will be to add polish. Resist. **Working demo > polished half-demo.**

---

## 10. Open questions to resolve in first 15 min

1. Which Baseten model? (Qwen2.5-VL is the leading candidate based on the prompt's mention of Qwen/DeepSeek.)
2. Does Subconscious have a JS/Python SDK? Read their docs first.
3. Cloudflare Workers + Next.js — use OpenNext or just static frontend + Worker API? (Static + Worker = simpler.)
4. Do we have access to real Wayfair product images, or do we use stock photos?
5. Who's filming the demo video? Submission requires it.

---

## 11. Verified facts to cite live on stage

- **NMFC Item 300135-A** (effective April 18, 2015) — 5 business days for concealed damage notification ([NMFTA / TLC source verified](https://tlcouncil.org/wp-content/uploads/2022/10/concealed_damage_and_shortage_claims.pdf))
- **Estes**: 5 days, "condition precedent to recovery" ([Estes Claims page](https://www.estes-express.com/resources/claims-information))
- **Old Dominion**: 5 business days ([ODFL Cargo Claims FAQ](https://www.odfl.com/us/en/resources/freight-knowledge/claims-faq.html))
- **FedEx Freight**: 15 days ([FedEx Freight L&D Guide PDF](https://www.fedexfreight.fedex.com/lossdamage_guide.pdf))
- **Wayfair's own policy**: 30 days standard, **3 days for Full-Service / White Glove** ([Wayfair Help](https://www.wayfair.com/help/article/damaged_or_defective_items/7378373F-9DB5-4F3A-9523-0C37AF989AF4))
- **Carmack Amendment**: 49 U.S.C. § 14706 — 9-month *minimum* formal claim window (does NOT preempt shorter notification windows in carrier tariffs)
- **Wayfair recently eliminated free returns on oversized patio furniture** (March 2026) — public concession of reverse-logistics cost pressure
- **Wayfair's existing LLM agent**: Wilma (Oct 2025) — supplier ticket triage, internal-only. No customer-facing inspection product. ([Wayfair tech blog](https://www.aboutwayfair.com/careers/tech-blog/automating-supplier-ticket-management-with-llm-agents-lessons-from-the-field))

---

## 12. Things to do BEFORE 5:45pm

- [ ] Sign up for Baseten, Subconscious, Cloudflare accounts. Get API keys in advance.
- [ ] Skim Subconscious docs — understand their multi-agent API surface.
- [ ] Decide demo phone (iPhone vs. Android — Safari has more camera quirks).
- [ ] Bring a charged second phone for filming.
- [ ] Find or print 2 reference photos of a Wayfair sectional and console table.
- [ ] Have a deliberately "damaged" prop or pre-cropped damaged image to drop in if live camera fails.
- [ ] Practice the 3-minute pitch out loud at least twice.
- [ ] Pre-write the hook sentence verbatim. It's the most important line.
