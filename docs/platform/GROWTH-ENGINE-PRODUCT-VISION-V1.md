# PharmaConnect Growth Engine — Product Vision V1

**Status:** Master reference · LOCKED as product direction  
**Audience:** Product, engineering, design, commercial, support  
**Scope:** Entire PharmaConnect Growth Engine platform  
**Code policy:** This document does not authorise code changes by itself — it governs what should be built and why.

---

## Document purpose

The Growth Engine has reached a major milestone. Individual feature phases are complete:

| Capability | Status |
|------------|--------|
| Business Profile Intelligence | Complete |
| Business Profile Wizard | Complete |
| Growth Engine workflow | Complete |
| Local Market Intelligence | Complete |
| Growth Intelligence | Complete |
| Long-form generation | Complete (locked) |
| Service generation | Complete (locked) |
| Cluster generation | Complete (locked) |

From this point forward we are **no longer building individual features in isolation**. We are building a **commercial SaaS platform**.

**This document is the master product vision.** Every future feature, workflow, screen, prompt, and development decision must support it. If a proposed change does not help fulfil this vision, it should not be built.

**Related technical docs (implementation detail, not vision):**

- [Growth Engine Framework V1](./GROWTH-ENGINE-FRAMEWORK-V1.md)
- [Local Market Intelligence V1](./GROWTH-ENGINE-LOCAL-MARKET-V1.md)
- [Growth Intelligence V1](./GROWTH-ENGINE-GROWTH-INTELLIGENCE-V1.md)

---

## Mission

PharmaConnect helps community pharmacies **understand their local market**, **identify their biggest growth opportunities**, and **automatically create high-quality digital marketing assets** that improve online visibility, patient engagement, and business growth.

The platform should feel like **employing a specialist digital growth consultant** — not using another marketing tool.

---

## Who it is for

| Segment | Priority | Notes |
|---------|----------|-------|
| **Independent UK community pharmacy** | Primary | Owner-operated, time-poor, needs clarity not complexity |
| Small pharmacy groups | Secondary | Multi-site with shared brand, local variation |
| Regional chains | Future | Higher volume, role-based access |
| Healthcare organisations | Future | Broader scope beyond single pharmacy |

---

## Core promise

A pharmacy owner should be able to:

1. **Connect** their website  
2. **Review** automatically imported information  
3. **See** their local competitors  
4. **Understand** their biggest growth opportunities  
5. **Approve** an AI-generated growth plan  
6. **Generate** a complete marketing ecosystem  
7. **Publish** it  
8. **Track** results  

**Everything should happen through one guided workflow.**

No dead ends. No parallel dashboards that compete for attention. No technical concepts exposed unless they help the owner decide.

---

## The customer journey

Each step answers **exactly one question**. Every screen must create value, explain why, and lead naturally to the next.

### Step 1 — Business Intelligence

**Question answered:** *Who are you?*

| | |
|---|---|
| **Data sources** | Website import · Business Profile · Brand import · Google Business Profile · Google Places · Manual confirmation |
| **Goal** | Understand the pharmacy — with minimum typing |

The owner should feel: *“It already knows my business.”*

---

### Step 2 — Local Market Intelligence

**Question answered:** *Who are your competitors?*

| | |
|---|---|
| **Data sources** | Google Places · Google Maps · Future: website analysis |
| **Goal** | Understand the local market |

The owner should feel: *“I didn’t realise my competitors were doing that.”*

---

### Step 3 — Growth Intelligence

**Question answered:** *What should you improve first?*

| | |
|---|---|
| **Data sources** | Business Profile · Competitor comparison · Generated content · Search Console · Future: website analysis |
| **Goal** | Identify opportunities — evidence-backed, prioritised |

The owner should feel: *“I know exactly what I need to do next.”*

---

### Step 4 — Growth Plan

**Question answered:** *What should we build?*

| | |
|---|---|
| **Goal** | Present **one clear recommended campaign** — not a list of options |

Must explain **why**, estimate **effort**, and estimate **outcome**.

The owner should feel: *“Build it.”*

---

### Step 5 — Generate

**Question answered:** *Shall we build it?*

| | |
|---|---|
| **Goal** | Generate the complete ecosystem · Preview · Approve · Publish |

The owner should feel: *“This is my pharmacy — and it’s ready to go live.”*

---

### Step 6 — Track Results

**Question answered:** *Is it working?*

| | |
|---|---|
| **Goal** | Monitor indexing · visibility · reviews · rankings · growth · opportunities |

The owner should feel: *“I can see it working — and I know what to do next month.”*

---

## Product principles

These are non-negotiable. Every feature must pass all ten.

| # | Principle | Meaning |
|---|-----------|---------|
| 1 | **Import before asking** | Never ask for information that can be imported |
| 2 | **APIs before manual input** | Google, website crawl, Search Console first |
| 3 | **Prefer checkboxes over typing** | Selection, confirmation, toggles — not free text |
| 4 | **Every page answers one question** | Single purpose per screen; no kitchen-sink panels |
| 5 | **Never invent data** | Real sources only; honest gaps when unavailable |
| 6 | **Never display meaningless scores** | No vanity SEO/authority/content scores without evidence |
| 7 | **Every recommendation must be evidence-backed** | Current value, comparison, source — always |
| 8 | **Always explain WHY** | Consultant tone: what matters, why, what to do |
| 9 | **Every screen leads to the next** | Clear primary CTA; no orphan pages |
| 10 | **Everything saves automatically** | No “Save” anxiety; progress is never lost |

---

## Commercial principles

**Users are not buying SEO. Users are buying growth.**

| Prefer (business language) | Avoid (technical language) |
|----------------------------|----------------------------|
| Patients | Schema |
| Visibility | Authority |
| Growth | Manifest |
| Appointments | Registry |
| Reviews | Pipeline |
| Trust | Internal generator |
| Local reputation | Content package (customer-facing) |
| Your marketing pages | Ecosystem (customer-facing) |

If a screen reads like documentation for developers, rewrite it for a pharmacy owner.

---

## User experience principles

The product should feel:

- **Simple** — one question per step, minimal choices where possible  
- **Professional** — NHS-adjacent trust; suitable for GPhC-regulated businesses  
- **Trustworthy** — evidence visible; no black-box recommendations  
- **Modern** — fast, clean, mobile-tolerant  
- **Helpful** — consultant voice, not tool voice  

**Every screen should create a “wow” moment** — or honestly say what is not available yet. Empty placeholders that promise future value erode trust faster than silence.

---

## Data principles

**Real data only.**

When data is unavailable, show one of:

- *Not analysed yet*  
- *Available after website analysis*  
- *Google account not connected*  

**Never fabricate metrics.** Em-dashes and honest empty states are better than invented numbers. This applies to competitor comparisons, timelines, scores, and outcomes.

---

## AI principles

AI should:

- **Explain** — translate data into plain language  
- **Recommend** — one clear next action where possible  
- **Summarise** — respect the owner’s time  
- **Compare** — you vs local market  
- **Prioritise** — what first, what later  

AI must **never hallucinate** and **never invent evidence**. If the model cannot cite a source (profile, Places, generated content, Search Console), it must not produce a recommendation.

---

## Roadmap

Roadmap phases describe **product maturity**, not permission to bypass principles in earlier phases.

### Phase 1 — Foundation *(current)*

Business Intelligence · Local Market · Growth Intelligence · Growth Plan · Generate · Track

**Focus:** Complete the guided workflow, wire existing capabilities, refine UX to vision standard. Refinement and integration — not new major modules.

### Phase 2 — Depth

- Website analysis (own site)  
- Competitor website analysis  
- Search Console automation  
- Publishing workflow integration  
- Growth monitoring (live dashboard panels)  

**Focus:** Replace placeholders with live data; close the promise made in Steps 2, 3, and 6.

### Phase 3 — Automation

- Weekly reports  
- Growth alerts  
- Monthly recommendations  
- Predictive opportunities  

**Focus:** Retention and ongoing consultant value — the platform works between logins.

---

## Definition of success

| Metric | Target |
|--------|--------|
| Setup time | Pharmacy owner completes setup in **under 15 minutes** |
| Typing | **Minimal** — most fields from website import, Google APIs, Business Profile |
| Step 2 reaction | *“I didn’t realise my competitors were doing that.”* |
| Step 3 reaction | *“I know exactly what I need to do next.”* |
| Step 4 reaction | *“Build it.”* |
| Step 5 reaction | *“This looks like my pharmacy — publish it.”* |
| Step 6 reaction | *“It’s working — here’s what improved.”* |

Success is measured by **owner comprehension and action**, not feature count.

---

## Feature decision checklist

Before any feature, screen, or prompt is approved, answer **yes** to all that apply:

1. Does it support the **core promise** (connect → track in one workflow)?  
2. Does it answer **one clear question** for the owner?  
3. Does it follow **import before ask** and **APIs before manual**?  
4. Is every displayed value **real or honestly labelled** as unavailable?  
5. Does every recommendation include **evidence and why**?  
6. Is the language **business-facing**, not technical?  
7. Does the screen **lead to the next step** with an obvious primary action?  
8. Does it create a **wow moment** or honest gap — not a fake placeholder?  
9. Would an **independent pharmacy owner** understand it without training?  
10. If removed, would the **journey break** — or is it duplicate/noise?

**If any answer is no**, refine or reject before build.

---

## Terminology standard (customer-facing)

| Internal / legacy | Customer-facing |
|-------------------|-----------------|
| Business Intelligence | Your Pharmacy Profile |
| Local Market Intelligence | Local Competitors |
| Growth Intelligence | Your Opportunities |
| Growth Plan | Your Growth Plan |
| Generate Ecosystem | Create Your Content |
| Growth Dashboard | Track Results |
| Content package | Your content set |
| Acknowledge step | *(Remove — auto-advance on primary CTA)* |
| Place ID | Google Business listing |
| Search Console registry | Google Search performance |

Engineering may retain internal names in code; **UI and commercial materials use the right column**.

---

## Governance

| Role | Responsibility |
|------|----------------|
| Product | Vision adherence; prioritisation against checklist |
| Engineering | Implementation within locked generator/BPI boundaries unless explicitly unlocked |
| Design | One-question-per-screen; business language; wow or honest gap |
| Commercial | Demo paths that reflect vision (prepared tenants, no empty promise screens) |
| Support | Escalate feature requests that fail the checklist |

**Change control:** Updates to this vision require explicit product sign-off. Technical phase docs may detail *how*; this doc defines *what* and *why*.

---

## What we are not building

Unless the vision is formally amended:

- Generic SEO audit products detached from pharmacy context  
- Vanity scores without evidence (SEO score, authority score, content score)  
- Parallel workflows that compete with the six-step journey  
- Features that require pharmacy owners to understand internal architecture  
- Recommendations or metrics with no traceable data source  
- Major new generator capabilities without commercial workflow integration  

---

## Summary

PharmaConnect Growth Engine is a **guided commercial platform** that turns real pharmacy and market data into **evidence-backed growth actions** and **publishable marketing assets**.

The product wins when a busy independent owner, in under fifteen minutes, moves from *“Who are my competitors?”* to *“Build it”* — without typing their life story, without mistrusting the numbers, and without wondering which dashboard is the real one.

**This Product Vision V1 is the master reference.** Check every decision against it.

---

*Document version: V1 · Growth Engine Product Vision · Documentation only*
