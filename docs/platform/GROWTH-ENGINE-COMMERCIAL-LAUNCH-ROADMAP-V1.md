# PharmaConnect Growth Engine — Commercial Launch Roadmap V1

**Document type:** Commercial planning · Master roadmap  
**Status:** Active planning reference  
**Audience:** Leadership, product, commercial, operations  
**Governed by:**

- [Product Vision V1](./GROWTH-ENGINE-PRODUCT-VISION-V1.md) — **LOCKED** (why we build)
- [End-to-End Validation V1](./GROWTH-ENGINE-E2E-VALIDATION-V1.md) — **LOCKED** (how ready we are)

**This document defines what we build next.**

It is not a technical roadmap. Priorities reflect **commercial value to independent pharmacy owners**, not engineering convenience. No dates are assigned — only objectives, stages, and exit criteria.

**Code policy:** This document does not authorise implementation. Work proceeds only after governance approval (Section 9).

---

## Section 1 — Current Position

### Completed

The platform has finished **feature construction** for its core capability stack:

| Area | Status |
|------|--------|
| Business Profile Intelligence | Complete (locked) |
| Business Profile Wizard V2 | Complete (locked) |
| Growth Engine six-step workflow | Complete (framework) |
| Local Market Intelligence | Complete (live Google Places) |
| Growth Intelligence | Complete (evidence-backed opportunities) |
| Service page generation | Complete (locked) |
| Cluster page generation | Complete (locked) |
| Long-form generation | Complete (locked) |
| Website import & brand import | Connected |
| Google Places integration | Connected |
| Content generation pipeline | Connected |
| Publishing infrastructure (platform-wide) | Exists |
| Indexing & visibility modules (platform-wide) | Exists |

**Commercial meaning:** We can already show real competitor insight, real opportunities, and real generated pharmacy content — when accounts are prepared.

---

### In Progress

Work is shifting from **building features** to **assembling a sellable product**:

| Area | Status | Gap |
|------|--------|-----|
| Business Intelligence (Step 1) | Partial (~65%) | Weak opening; import gaps |
| Growth Plan (Step 4) | Not ready (~50%) | Generic campaign; not wired to Step 3 |
| Generate (Step 5) | Nearly ready (~60%) | Handoff breaks journey; weak preview |
| Track Results (Step 6) | Not ready (~20%) | Placeholders; live data exists elsewhere |
| Customer journey continuity | In progress (~75%) | Multiple dashboards; hidden workflow steps |
| Commercial demo readiness | In progress | Limited demo approved; pilot not approved |

---

### Not Started

| Area | Notes |
|------|-------|
| Pilot pharmacy programme | Awaiting MVP exit criteria |
| Private beta programme | Awaiting pilot learnings |
| Public launch programme | Awaiting beta stability |
| Competitor website analysis | Promised in UI; not built |
| Own-site website analysis (full) | Placeholder only |
| Weekly reports & growth alerts | Product Vision Phase 3 |
| Self-serve onboarding (15-minute target) | Requires fast-path sprint |
| Shareable owner reports (PDF/email) | Commercial enablement |
| Multi-location / group support | Future segment |
| Review acquisition tools | Opportunity identified; no product action |

---

### Commercial readiness

| Indicator | Today |
|-----------|-------|
| **Release posture** | **READY FOR LIMITED DEMO** |
| **Paid pilot** | Not approved |
| **Private beta** | Not approved |
| **Public launch** | Not approved |
| **Subscription justification** | Partial — intelligence and generation strong; journey ending weak |
| **Confidence** | Medium — prepared demos yes; cold-start and self-serve no |

**Summary:** The engine is **built but not yet sold**. Next work is refinement, integration, and commercial packaging — not new major generators or intelligence modules.

---

## Section 2 — Launch Stages

Six stages from today through public launch. Each stage has a single commercial purpose.

---

### Stage 1 — Internal Development

| | |
|---|---|
| **Purpose** | Complete commercial sprints (1–5) to close validation gaps without expanding scope |
| **Target users** | Internal product, engineering, design |
| **Success criteria** | All Critical validation issues resolved; MVP MUST checklist materially advanced |
| **Exit criteria** | Re-validation document updated; internal walkthrough of full journey passes without placeholders in primary path |

---

### Stage 2 — Internal Validation

| | |
|---|---|
| **Purpose** | Prove the journey works end-to-end with real pharmacy data — not demo scripts |
| **Target users** | Internal team role-playing as pharmacy owners; 2–3 real profile imports |
| **Success criteria** | Setup under 15 minutes (guided); Steps 2–3 deliver vision reaction targets; Generate → Publish → Track reachable in one story |
| **Exit criteria** | Commercial MVP checklist: no **No** items; majority **Yes**; E2E Validation re-issued at **READY FOR PILOT** or higher |

---

### Stage 3 — Limited Demo

| | |
|---|---|
| **Purpose** | Controlled sales and partner demonstrations with prepared accounts |
| **Target users** | Prospective pharmacy owners; partners; investors |
| **Success criteria** | Demo playbook documented; 100% of demos use prepared tenants; no “coming soon” in demo path; positive qualitative feedback on Steps 2–3 |
| **Exit criteria** | Commercial team sign-off; at least 10 successful demos without technical rescue; Sprint 1 complete |

**Current stage:** **We are here.**

---

### Stage 4 — Pilot Pharmacies

| | |
|---|---|
| **Purpose** | Validate product value with paying or committed early customers under guided onboarding |
| **Target users** | 5–15 independent UK community pharmacies |
| **Success criteria** | Owners complete import → opportunities → generate → publish without developer intervention; qualitative “I know what to do next” and “Build it” reactions |
| **Exit criteria** | MVP exit criteria for Pilot satisfied (Section 8); retention signal from majority of pilot cohort; support playbook proven |

---

### Stage 5 — Private Beta

| | |
|---|---|
| **Purpose** | Scale onboarding with reduced hand-holding; stress-test support and data quality |
| **Target users** | 25–50 pharmacies; waitlist or invitation only |
| **Success criteria** | Self-serve or lightly guided setup; support ticket volume manageable; core KPIs measurable (Section 7) |
| **Exit criteria** | Beta exit criteria satisfied; no Critical open issues; commercial pricing validated with beta feedback |

---

### Stage 6 — Public Launch

| | |
|---|---|
| **Purpose** | Open commercial availability for independent pharmacies |
| **Target users** | Independent UK community pharmacy (primary segment) |
| **Success criteria** | Full Product Vision journey live; marketing site aligned; billing active; support scaled |
| **Exit criteria** | Public launch exit criteria satisfied (Section 8); leadership sign-off; Validation document at commercial launch readiness |

---

## Section 3 — Sprint Roadmap

Six commercial sprints. **Objectives only — no dates.** Sprints may overlap operationally but must not skip order without governance approval.

---

### Sprint 1 — Product Refinement

**Objective:** Restore trust and continuity in the customer journey. Remove anything that makes the product feel unfinished or generic.

**Commercial outcomes:**

- Owner experiences one consultant story from opportunities → plan → generate
- No visible “coming soon” in the primary path
- Single home for the journey (Growth Engine)
- Progress reflects what the owner actually completed
- Language speaks to pharmacy owners, not developers

**Key deliverables (commercial framing):**

- Personalised growth plan connected to opportunity recommendations
- Navigation fixes (wizard returns to Growth Engine; legacy labels removed from primary flow)
- Automatic step progression on primary actions
- Customer language audit on Growth Plan, Generate, and Track steps
- Honest import experience (no “not found” for fields we claim to import)
- Hide or consolidate placeholder website analysis blocks

**Unlocks:** Re-assessment for **Pilot** candidacy.

---

### Sprint 2 — Live Integrations

**Objective:** Surface existing platform capabilities inside the Growth Engine journey so owners see real connections, not empty promises.

**Commercial outcomes:**

- “Connect your website” and “Connect Google” feel complete
- Imported brand and business data celebrated at journey start
- Search Console value visible when connected
- Setup time moves toward 15-minute Product Vision target

**Key deliverables (commercial framing):**

- Expanded “Your Pharmacy” summary on Business Intelligence (logo, brand, services detected)
- Website import extended to description and opening hours (or honest removal from import summary)
- Google Business listing connection improved (owner-friendly language)
- Search Console connect prompt in journey when indexing is relevant
- Fast-path onboarding option: import → confirm → competitors (defer non-essential wizard steps)

**Unlocks:** Cold-start demos become viable; pilot onboarding time reduced.

---

### Sprint 3 — Growth Plan

**Objective:** Make Step 4 the moment the owner says **“Build it.”**

**Commercial outcomes:**

- One clear recommended campaign — not a template list
- Plan explains **why** using evidence from Local Market and Growth Intelligence
- Effort and outcome estimates feel credible and pharmacy-specific
- Growth Intelligence executive summary reduces overload before plan

**Key deliverables (commercial framing):**

- Single campaign recommendation with evidence bullets from Steps 2–3
- Dynamic campaign naming from profile services and content gaps
- Effort estimate tied to page count and service selection (labelled as typical ranges)
- Consolidated Growth Intelligence view (executive summary + expandable detail)
- Defer heavy compliance fields to publish gate, not onboarding

**Unlocks:** Step 4 moves from **Not Ready** to **Ready** on launch scorecard.

---

### Sprint 4 — Publishing

**Objective:** Complete the journey from “generate” to “live on my website.”

**Commercial outcomes:**

- Owner sees what will be created before committing
- Preview builds confidence in AI-generated content
- Publish feels like a natural Step 5 continuation, not a separate product
- Approval gates framed as quality protection, not friction

**Key deliverables (commercial framing):**

- Generate step: asset checklist (service page, FAQs, guides, blog, local pages)
- Preview link prominent before generation handoff
- Publish confirmation inside Growth Engine workflow
- Clear “your pages are live” moment after FTP or publish action
- Unified terminology: “Create Your Content” not internal product names

**Unlocks:** Commercial MVP checklist — **Publish** moves from Partial to Yes.

---

### Sprint 5 — Tracking

**Objective:** Answer **“Is it working?”** inside the primary workflow.

**Commercial outcomes:**

- Owner sees at least one live proof point after publishing
- Track Results step delivers retention value, not empty tabs
- Opportunities refresh as new data arrives (indexing, reviews)

**Key deliverables (commercial framing):**

- Live indexing status panel (from existing platform data)
- Rankings / visibility summary when Search Console connected
- Hide empty dashboard sections until data exists
- Review count tracking from Google Places (comparison over time — when data allows)
- Link to fuller analytics without fragmenting the home experience

**Unlocks:** Commercial MVP checklist — **Track progress** moves from No to Yes; subscription retention story complete.

---

### Sprint 6 — Commercial Launch Preparation

**Objective:** Package the product for sale — demo, pilot, beta, and launch operations.

**Commercial outcomes:**

- Sales team can demo and close without engineering
- Support can onboard and resolve without developer intervention
- Pricing and packaging aligned to owner value (growth, not SEO)
- Pilot and beta programmes operational

**Key deliverables (commercial framing):**

- Demo playbook (prepared tenant checklist, scripted path, objection handling)
- Pilot onboarding playbook and success criteria
- Support FAQ and escalation paths
- Pricing and packaging proposal (tier alignment to workflow steps)
- Marketing narrative aligned to Product Vision (consultant, not tool)
- Shareable summary for owners (print-friendly local market + opportunities view)
- Re-validation and launch sign-off review

**Unlocks:** **Private Beta** and path to **Public Launch**.

---

## Section 4 — Commercial Priorities

Aligned with Product Vision V1 and E2E Validation V1.

### Must Have *(before Pilot)*

- Single guided six-step workflow with Growth Engine as home
- Website import filling core business and brand fields **honestly**
- Live local competitor comparison (Google Places)
- Evidence-backed growth opportunities
- One personalised recommended campaign (wired from opportunities)
- Content generation with preview before commit
- No “coming soon” in primary customer path
- Customer-facing language throughout
- Automatic workflow progression (no hidden acknowledgement steps)
- Demo playbook for commercial team

### Should Have *(before Beta)*

- Publish path inside Growth Engine journey
- Live indexing status on Track Results step
- Search Console connection in journey
- Asset checklist on Generate step
- Fast-path onboarding (15-minute target)
- Expanded Business Intelligence opening summary
- Competitor map view
- Clinical/compliance fields deferred to publish gate
- Shareable owner summary (print or PDF)

### Nice To Have *(before Public Launch)*

- Competitor grouping (chain vs independent, distance bands)
- Review opportunity with guided next steps (non-automated)
- Rankings panel when visibility data connected
- Step icons and benefit-led step descriptions
- Full Product Vision terminology applied in UI
- Pilot-to-beta conversion playbook

### Future *(Phase 2 and beyond — not launch blockers)*

- Competitor website analysis
- Full own-site website crawl and content coverage
- Review acquisition automation
- Weekly email reports and growth alerts
- Monthly AI recommendations refresh
- Predictive opportunities
- Multi-location / pharmacy group support
- Regional chain features
- Domain authority and technical SEO scoring (only if evidence-backed)
- API marketplace / partner integrations

---

## Section 5 — Feature Backlog

Every known feature request categorised by commercial timing. Items move only via governance (Section 9).

---

### NOW *(Sprints 1–2 — trust, continuity, integrations)*

| Feature | Commercial value |
|---------|------------------|
| Wire Growth Plan to Growth Intelligence recommendation | Personalisation trust |
| Remove/hide “coming soon” website analysis in customer path | Demo confidence |
| Single Growth Engine home; fix wizard exit | Navigation clarity |
| Auto-advance workflow on primary CTA | Progress honesty |
| Customer language audit (Steps 4–6) | Professional positioning |
| Fix import summary honesty (description/hours) | “Import before ask” principle |
| Expanded Step 1 pharmacy summary (logo, brand, services) | Opening “wow” |
| Website import: description and opening hours | Less typing |
| Search Console connect prompt in journey | Retention hook |
| Fast-path onboarding (import → competitors) | 15-minute setup target |
| Demo playbook for commercial team | Limited demo scale |

---

### NEXT *(Sprints 3–5 — plan, publish, track)*

| Feature | Commercial value |
|---------|------------------|
| Evidence-led single campaign on Growth Plan | “Build it” moment |
| Dynamic campaign naming from profile | Personalisation |
| Growth Intelligence executive summary (reduce panels) | Comprehension |
| Defer clinical review to publish gate | Onboarding completion |
| Generate step asset checklist | Generation clarity |
| Preview before generate | Confidence in AI content |
| Publish confirmation inside Growth Engine | Journey completion |
| Live indexing panel on Track Results | “Is it working?” |
| Hide empty tracking tabs | Honest product |
| Competitor map (all pins) | Market landscape wow |
| Competitor grouping (chain/independent, distance) | Richer local insight |
| Shareable print/PDF summary (local market + opportunities) | Sales & staff alignment |
| Review count tracking over time (Places) | Reputation growth story |

---

### LATER *(Sprint 6 + post-pilot — launch prep & beta enrichment)*

| Feature | Commercial value |
|---------|------------------|
| Pilot programme operations | Revenue validation |
| Beta waitlist and invitation flow | Controlled scale |
| Pricing tiers aligned to workflow | Commercial packaging |
| Support playbook and FAQ | Operational scale |
| Marketing site narrative refresh | Acquisition |
| Rankings / visibility panel (full) | Retention depth |
| Review opportunity guided playbook (in-product tips) | Closes top opportunity |
| Onboarding email sequence | Activation |
| In-app help and tooltips (owner language) | Self-serve beta |
| Terminology standard applied across UI | Polish |
| Billing and subscription management | Public launch prerequisite |

---

### FUTURE *(Phase 2–3 — not on launch critical path)*

| Feature | Commercial value |
|---------|------------------|
| Competitor website analysis | Completes Local Market promise |
| Own-site website crawl (pages, blogs, schema) | Content gap evidence |
| Website content coverage scoring (evidence-backed only) | Deeper opportunities |
| Core Web Vitals monitoring | Technical owners segment |
| Review acquisition tools (QR, templates, reminders) | Closes review gap |
| Review sentiment analysis | Trust insights |
| Weekly growth reports (email) | Retention |
| Monthly recommendation refresh | Ongoing consultant value |
| Growth alerts (indexing drop, review spike) | Proactive engagement |
| Predictive opportunities | Phase 3 differentiation |
| AI chat consultant (grounded in profile + Places only) | Premium tier |
| Automation rules (auto-submit indexing, scheduled publish) | Efficiency |
| PDF branded reports (white-label) | Partner channel |
| Multi-location dashboard | Small groups segment |
| Role-based access (owner, manager, marketing) | Groups & chains |
| Regional chain onboarding | Market expansion |
| Healthcare organisation vertical | Future segment |
| Mobile app / progressive web app | Convenience |
| CRM integration (HubSpot, etc.) | Partner sales |
| WhatsApp / SMS patient engagement | Adjacent product |
| Appointment booking integration | Conversion depth |
| Pharmacy First campaign automation | Service-specific growth |
| Seasonal campaign templates (flu, travel clinic) | Timely relevance |
| A/B testing of generated content | Optimisation |
| Competitive price / service benchmarking | Market intelligence depth |

---

## Section 6 — Commercial Risks

| Risk category | Risk | Impact | Mitigation |
|---------------|------|--------|------------|
| **Product** | Journey ends weak (Track empty, Plan generic) | Subscription churn; failed demos | Sprints 1, 3, 5; re-validation before pilot |
| **Product** | “Coming soon” over-promises | Trust collapse | Hide until live; honest Phase 2 labelling |
| **Product** | Too many dashboards | Confusion; support burden | Sprint 1 — single home |
| **Market** | Owners compare to generic SEO tools | Price pressure | Lead with pharmacy-specific evidence story |
| **Market** | Time-poor owners abandon long wizard | No reach to Step 2 wow | Fast-path onboarding; Sprint 2 |
| **Market** | Regulatory caution (GPhC, clinical content) | Fear of AI content | Approval gates as trust feature; superintendent review |
| **Technical** | Google Places demo failure | Empty demo | Demo playbook; prepared tenants |
| **Technical** | Website import quality varies | Bad first impression | Honest gaps; manual confirm; extend import |
| **Technical** | Fragmented modules hard to integrate | Delayed Track/Publish | Sprints 4–5 surface existing data, not rebuild |
| **Support** | Pilot customers hit legacy paths | High touch; frustration | Playbooks; navigation fixes before pilot |
| **Support** | Owners expect full SEO suite | Expectation mismatch | Product Vision language; sales alignment |
| **Data** | Demo data mistaken for live | Credibility loss | Never show demo comparisons as live (guarded today) |
| **Data** | Competitor pool unrepresentative | Wrong advice | Owner confirms location; discovery radius tuning |

---

## Section 7 — Success Metrics

Commercial KPIs to measure at Pilot, Beta, and Launch. **Metrics only — no targets invented here.** Targets to be set when each stage begins.

### Activation & setup

| Metric | Definition |
|--------|------------|
| **Average setup time** | Minutes from first login to completing Business Intelligence + Local Market discovery |
| **Profile completion %** | Percentage of required profile fields confirmed |
| **Import success %** | Percentage of tenants where website import returns usable brand/contact data |
| **Import confirmation rate** | Percentage of imported fields confirmed without manual re-entry |
| **Wizard abandonment rate** | Percentage starting wizard who do not reach Step 8 or Growth Engine return |
| **Fast-path adoption rate** | Percentage using accelerated onboarding vs full wizard |

### Intelligence & insight

| Metric | Definition |
|--------|------------|
| **Competitor discovery success %** | Percentage of tenants with live Google Places competitor snapshot |
| **Local Market engagement** | Percentage of tenants viewing comparison table and summary |
| **Growth Intelligence engagement** | Percentage viewing opportunities and reaching Growth Plan |
| **Opportunity action rate** | Percentage of top-priority opportunities acted on (generate, publish, or external action) |

### Generation & publish

| Metric | Definition |
|--------|------------|
| **Generation completion %** | Percentage approving plan who complete content generation |
| **Preview-before-generate rate** | Percentage viewing preview before generating |
| **Publishing completion %** | Percentage of generated content published to live site |
| **Time to first publish** | Days from signup to first live page |

### Tracking & retention

| Metric | Definition |
|--------|------------|
| **Indexing %** | Percentage of published pages indexed (when Search Console connected) |
| **Track Results engagement** | Percentage of published tenants returning to Step 6 |
| **30-day retention** | Percentage of pilot/beta customers active at day 30 |
| **90-day retention** | Percentage active at day 90 |

### Commercial

| Metric | Definition |
|--------|------------|
| **Demo conversion** | Percentage of limited demos resulting in pilot signup or next meeting |
| **Pilot conversion** | Percentage of pilot pharmacies converting to paid subscription |
| **Beta conversion** | Percentage of beta users converting to paid at launch |
| **Net promoter / qualitative satisfaction** | Structured owner feedback at Steps 2, 3, 4 |
| **Support tickets per tenant** | Volume during pilot and beta |
| **Time to first value** | Minutes until owner sees meaningful competitor or opportunity insight |

---

## Section 8 — MVP Exit Criteria

Conditions that must be satisfied before advancing launch stage. Assessed via updated E2E Validation review — not self-declared.

---

### Exit to Pilot Pharmacies

All **Must Have** items (Section 4) satisfied:

- [ ] Single guided workflow; Growth Engine is canonical home
- [ ] Website import honest and core fields populated
- [ ] Live competitor comparison operational for pilot tenants
- [ ] Evidence-backed opportunities live
- [ ] Personalised growth plan wired to opportunities (not generic template)
- [ ] Generate step with preview and asset clarity
- [ ] No “coming soon” in primary path
- [ ] Customer language on all six steps
- [ ] Demo playbook documented
- [ ] Internal validation walkthrough passed
- [ ] E2E Validation re-issued: **READY FOR PILOT** or higher

**Pilot may still use guided onboarding** — self-serve not required.

---

### Exit to Private Beta

All Pilot criteria plus:

- [ ] Publish path reachable inside Growth Engine journey
- [ ] At least one live tracking metric on Step 6 (indexing minimum)
- [ ] Pilot cohort (minimum agreed count) completed generate → publish
- [ ] Majority pilot retention signal at 30 days
- [ ] Support playbook proven without developer escalation
- [ ] Search Console connect available in journey
- [ ] Fast-path onboarding available
- [ ] Critical and High validation issues closed
- [ ] E2E Validation re-issued: **READY FOR BETA** or higher

---

### Exit to Public Launch

All Beta criteria plus:

- [ ] Full MVP MUST and SHOULD lists (Section 4) satisfied
- [ ] Self-serve or lightly guided onboarding under 15 minutes (measured)
- [ ] Billing and subscription operational
- [ ] Marketing and sales materials aligned to Product Vision
- [ ] Support scaled for public volume
- [ ] No Critical open product issues
- [ ] Beta conversion and retention metrics reviewed by leadership
- [ ] E2E Validation re-issued: commercial launch approval
- [ ] Product Vision emotional targets verified in beta feedback:
  - Step 2: *“I didn’t realise my competitors were doing that.”*
  - Step 3: *“I know exactly what I need to do next.”*
  - Step 4: *“Build it.”*

---

## Section 9 — Product Governance

Future work is approved through a **commercial gate**, not ad-hoc requests.

### Approval flow

1. **Proposal** — one-page description: owner problem, proposed solution, stage (NOW/NEXT/LATER/FUTURE)
2. **Vision check** — against Product Vision V1 principles and journey
3. **Validation check** — does not contradict E2E Validation honesty standards
4. **Commercial value** — which launch stage does it unlock or protect?
5. **Decision** — approve, defer, or reject

### Feature checklist

Every proposed feature must be evaluated against:

| Criterion | Question |
|-----------|----------|
| **Product Vision** | Does it support understand → improve → generate → grow? |
| **Validation** | Does it close a documented gap or introduce new placeholder risk? |
| **Commercial value** | Will an owner pay for this or stay because of it? |
| **Customer benefit** | Can we explain it in one sentence to a pharmacy owner? |
| **Evidence** | Will displayed data be real or honestly labelled unavailable? |
| **Complexity** | Does it simplify the journey or add another screen? |
| **Maintenance cost** | Can support and operations sustain it at scale? |

**Reject by default** if:

- It adds a vanity score without evidence
- It duplicates an existing step or dashboard
- It is technically interesting but does not help owners understand, improve, generate, or grow
- It requires inventing data or metrics
- It expands scope before Pilot exit criteria are met (unless Critical fix)

### Document hierarchy

| Document | Role |
|----------|------|
| Product Vision V1 | Why — LOCKED |
| E2E Validation V1 | Readiness — LOCKED; re-issued at stage gates |
| **Commercial Launch Roadmap V1** | What next — this document |
| Technical phase docs | How — subordinate to all above |

---

## Section 10 — Roadmap Principles

1. **No feature because it is technically interesting.** Every item must earn its place through owner value.

2. **Every feature must help pharmacies:**
   - **Understand** — their business and local market  
   - **Improve** — evidence-backed priorities  
   - **Generate** — high-quality marketing assets  
   - **Grow** — visibility, patients, trust, appointments  

3. **Commercial value over engineering effort.** Prefer wiring existing capabilities into the journey over building new backend modules.

4. **Honest product over impressive demo.** Hide or defer rather than placeholder.

5. **One workflow, one home.** Resist parallel dashboards and duplicate intelligence surfaces.

6. **Import before ask; APIs before typing; checkboxes before text.**

7. **Refinement before expansion.** Pilot is blocked until Sprints 1–3 complete; Beta until Sprints 4–5 complete.

8. **Stage gates are real.** No pilot customers until Validation says so. No public launch until Beta proves retention.

9. **Independent pharmacy first.** Groups, chains, and healthcare orgs wait until core journey wins.

10. **Re-validate at every stage.** Update E2E Validation; do not advance on optimism alone.

---

## Summary — Path from today to launch

```
TODAY ─────────────► Limited Demo (prepared accounts)
         Sprint 1–2
              │
              ▼
         Pilot Pharmacies (guided, 5–15)
         Sprint 3–4
              │
              ▼
         Private Beta (25–50, reduced hand-holding)
         Sprint 5
              │
              ▼
         Launch Preparation
         Sprint 6
              │
              ▼
         Public Launch
```

**Current focus:** Sprint 1 (Product Refinement) and Sprint 2 (Live Integrations) in parallel where safe — both required before Pilot approval.

**Do not onboard paying pilot customers until Sprint 1 is complete and E2E Validation is re-reviewed.**

---

## Document governance

| Rule | Detail |
|------|--------|
| **Owner** | Product leadership |
| **Updates** | New version (V2+) when stage advances or priorities shift materially |
| **Review trigger** | Pilot approval, Beta approval, launch approval, quarterly planning |
| **Relationship to Vision** | Vision = north star; Validation = readiness truth; Roadmap = ordered action |

---

*Commercial Launch Roadmap V1 · Master commercial planning document · Drives development priority over ad-hoc requests*
