# Customer Setup Audit V1

**Sprint:** Customer Setup Journey Reset V1  
**Status:** Audit complete — no large UI changes in this sprint  
**Date:** July 2026  
**Audience:** Product, design, engineering, commercial  

**Governed by:**

- [Product Vision V1](./GROWTH-ENGINE-PRODUCT-VISION-V1.md)
- [Product Reset V1](./GROWTH-ENGINE-PRODUCT-RESET-V1.md)
- [Commercial Launch Roadmap V1](./GROWTH-ENGINE-COMMERCIAL-LAUNCH-ROADMAP-V1.md)

**Validation:**

```bash
npx tsx scripts/validate-customer-setup-journey-v1.ts
```

---

## Executive summary

The platform has strong intelligence and generation engines, but the **customer onboarding path exposes implementation architecture** instead of guiding a busy pharmacy owner through four simple reports.

| Metric | Current (cold start) | Vision target |
|--------|-------------------|---------------|
| Estimated clicks to first campaign | **45–70+** | **12–18** |
| Estimated setup time | **45–90 min** | **< 15 min** |
| Manual field entry (minimum path) | **30+ fields across 8 wizard steps** | **5–8 confirmations** |
| Parallel navigation surfaces | **12+ modules in platform nav** | **1 guided workflow** |
| Pages with one clear next action | **4 of 14** | **All** |

**Root cause:** The Business Profile Wizard (8 steps, 30+ fields) runs *parallel* to the four commercial reports. Platform nav exposes Campaign OS, Indexing, Authority Readiness, and 8 other modules before the owner understands the journey.

---

## Step 1 — Current journey (admin → first campaign)

### Phase A — Admin creates pharmacy

| # | Page / URL | Action | Required input | Notes |
|---|------------|--------|----------------|-------|
| 1 | `/api/admin/pharmacies` | Open Client Pharmacies (admin login) | — | Admin-only |
| 2 | Same | Click **Create New Client** | — | Modal opens |
| 3 | Create modal | Submit form | Pharmacy name*, website*, town*, postcode* | Optional: contact, email, phone, Google Place ID, notes |
| 4 | Redirect | Auto-navigate | — | → `/api/growth-engine/business-intelligence?slug={slug}` ✓ |

**Admin table dead-end:** Row actions link to **Growth Dashboard** and **Profile Wizard**, not the guided setup entry (`business-intelligence`). Admin returning to a client may skip Report 1.

---

### Phase B — Your Pharmacy (Report 1)

| # | Page / URL | Action | Required input | Notes |
|---|------------|--------|----------------|-------|
| 5 | `/api/growth-engine/business-intelligence` | Read import summary | — | Shows Imported / Needs Review badges |
| 6 | Same | **Choice A:** Review & confirm in wizard | — | Primary CTA |
| 6b | Same | **Choice B:** Import website | — | Duplicate — same wizard URL |
| 7 | Same | Continue to Your Local Market | — | Nav bar next (may be premature if profile incomplete) |

**Friction:** Two equal CTAs to the same destination. Stepper shows Report 1 incomplete while wizard is separate. Platform nav offers 11 alternate modules.

---

### Phase C — Business Profile Wizard (8 steps)

| # | Step | URL | Typical actions | Est. time |
|---|------|-----|-----------------|-----------|
| 8 | 1 Import & Confirm | `/api/pharmacy-profile-wizard` | Enter website URL → Run import → Accept/Confirm each field → Continue | 5–10 min |
| 9 | 2 Business Basics | Same | Fill gaps: phone, address, email, hours | 3–5 min |
| 10 | 3 Brand & Website | Same | Confirm logo, colours, preview | 3–5 min |
| 11 | 4 Services | Same | Select services, delivery details per service (carousel) | 6–10 min |
| 12 | 5 Local Intelligence | Same | Generate areas, select competitors, GP/hospital checkboxes | 5–8 min |
| 13 | 6 Patient Groups | Same | Checkbox groups, USPs | 2–3 min |
| 14 | 7 Trust & Proof | Same | GPhC, accreditations, reviewer, team, clinical dates | 4–6 min |
| 15 | 8 Marketing & Readiness | Same | CTA, tone, booking; review score categories | 3–5 min |
| 16 | Finish | Redirect | — | → `/api/growth-engine` hub (not next report) |

**Wizard navigation:** Back / Continue only. **No** Edit Pharmacy Profile link label, **no** Return to Dashboard in wizard footer (workflow bar points to `pharmacy-dashboard`, not Growth Engine hub).

**Completion bug (fixed V1):** Imported fields stayed **Needs Review** after save because `profileFieldConfirmations` required explicit Accept/Confirm click. Server now auto-confirms populated fields on profile save (`applyAutoConfirmOnSave`).

---

### Phase D — Your Local Market (Report 2)

| # | Page / URL | Action | Required input | Notes |
|---|------------|--------|----------------|-------|
| 17 | `/api/growth-engine/local-market` | Click **Discover local market** | — | Requires branch coordinates / Google Places |
| 18 | Same | Wait for reload | — | API: `POST /api/growth-engine/{slug}/local-market/discover` |
| 19 | Same | Read 7 sections | — | Section labels expose internal structure |
| 20 | Same | Continue to Your Website Report | — | CTA at bottom + nav bar ✓ |

**Friction:** Without discovery click, report is empty. Branch location requirement unclear on first visit. **Two CTAs** (nav bar + bottom CTA) — acceptable if same destination.

---

### Phase E — Your Website Report (Report 3)

| # | Page / URL | Action | Notes |
|---|------------|--------|-------|
| 21 | `/api/growth-engine/website-intelligence` | View inventory / gaps | Skips Growth Intelligence ✓ (Product Reset) |
| 22 | Same | Continue to Your Growth Plan | Nav goes to `growth-plan` not hidden GI step ✓ |

**Friction:** Website analysis may be placeholder if crawl not run. Owner may not know analysis is automatic vs manual.

---

### Phase F — Your Growth Plan (Report 4)

| # | Page / URL | Action | Notes |
|---|------------|--------|-------|
| 23 | `/api/growth-engine/growth-plan` | Read executive summary + campaign | One recommended campaign ✓ |
| 24 | Same | **Choice A:** Generate This Campaign | Primary when ready |
| 24b | Same | **Choice B:** Review Campaign Details | Anchor link — secondary |
| 24c | Same | **Choice C:** Approve plan & continue | Form POST acknowledge |
| 25 | Same | View Alternative Campaigns | Up to 3 alternatives — conflicts with "one campaign" principle |

**Friction:** Three competing actions on one page. Campaign Readiness shows **incomplete** items with ○ even when profile is functionally complete. Alternatives section invites decision paralysis.

---

### Phase G — Create Content (Step 6)

| # | Page / URL | Action | Notes |
|---|------------|--------|-------|
| 26 | `/api/growth-engine/generate` | Create content / View recreate | Links to content package |
| 27 | `/api/pharmacy-content-package` | Click **Create Content Package** | Technical title — not customer language |
| 28 | Same | Wait for generation | API: `POST /api/pharmacy/content-package/{slug}/{service}/generate` |
| 29 | Redirect | Auto → asset review | `/api/pharmacy-asset-review` |

**Friction:** Generate page offers **Create** + **Review content** when package exists. Content package page exposes "Technical details (admin)" and uses **Content Package** terminology.

---

### Phase H — Dashboard (Step 7) — optional in setup path

| # | Page / URL | Action | Notes |
|---|------------|--------|-------|
| 30 | `/api/growth-engine/dashboard` | Operational home, Founder Partner workflow | Multiple task panels |
| 31 | `/api/pharmacy-dashboard` | Legacy platform dashboard | Parallel dashboard |
| 32 | `/api/pharmacy-growth-dashboard` | Growth analytics | Third dashboard surface |

---

## Step 2 — Vision comparison (drift analysis)

| Vision / Reset expectation | Current state | Drift severity |
|----------------------------|---------------|----------------|
| One guided workflow, no parallel dashboards | 12 platform nav modules + 3 dashboards | **Critical** |
| Setup under 15 minutes | 8-step wizard alone exceeds 15 min | **Critical** |
| Import before ask; minimal typing | Admin captures 4 fields; wizard still requires 30+ interactions | **High** |
| Four reports then Create Content | Correct step order in Growth Engine stepper | **Low** (fixed in Product Reset) |
| Growth Intelligence hidden from customer | Hidden from stepper ✓; still reachable via URL | **Medium** |
| One clear campaign on Growth Plan | Primary campaign + 3 alternatives + 3 CTAs | **High** |
| Business language, no SEO jargon | Largely fixed; "Content Package", "Growth Engine", "Campaign OS" remain | **Medium** |
| Every screen → obvious next action | BI (2 CTAs), Growth Plan (3 CTAs), Generate (2 CTAs) | **High** |
| Self-serve onboarding | Admin-only create; no owner signup | **Expected** (Stage 3 Limited Demo) |
| Track Results with live data | Dashboard placeholders / bridge data | **High** (Roadmap Stage 1) |

---

## Step 3 — Per-page friction analysis

For each page: *Where am I? · Why am I here? · What do I do? · How long? · What's next?*

| Page | Where | Why | What to do | How long | What's next | Issue |
|------|-------|-----|------------|----------|-------------|-------|
| Admin Client Pharmacies | ✓ | ✓ | Create client | 2 min | BI redirect ✓ | Table links skip setup path |
| Growth Engine Hub | ◐ | ✓ | Pick report or continue | 1 min | Unclear which report | Competing cards |
| Your Pharmacy (BI) | ✓ | ◐ | Import or review wizard | 5–30 min | Local Market | Dual CTAs; wizard disconnected |
| Profile Wizard (×8) | ◐ | ◐ | Many fields per step | 30–60 min | Hub not Report 2 | Too long; technical step names |
| Your Local Market | ✓ | ✓ | Discover competitors | 2–5 min | Website Report | Must know to click Discover |
| Your Website Report | ✓ | ✓ | Read gaps | 3 min | Growth Plan | Empty if no crawl |
| Your Growth Plan | ✓ | ✓ | Approve one campaign | 5 min | Create Content | 3 CTAs; alternatives |
| Create Content | ◐ | ✓ | Generate package | 5–15 min | Review | Technical naming |
| Content Package | ✗ | ◐ | Create package | 5–15 min | Review | Developer-facing page title |
| Growth Engine Dashboard | ◐ | ◐ | Many tasks | open-ended | Unclear | Founder Partner + ops panels |

---

## Step 4 — Business profile field audit

### Minimum first setup (should require manual entry)

| Field | Current | Recommendation |
|-------|---------|----------------|
| Pharmacy name | Admin + import | **Confirm only** (admin pre-fills) |
| Website URL | Admin | **Confirm only** |
| Town / postcode | Admin | **Confirm only** |
| Phone | Optional admin | **Confirm** if imported, else enter |
| Primary contact / reviewer name | Optional | **Required once** before content generation |
| Clinical review dates | Wizard step 7 | **Move to Advanced** until publishing |

### Should always be imported (never typed first)

Website: business name, description, logo, colours, nav links, footer links, opening hours, detected services, social links, contact email, address (when on site).

Google: Place ID, rating, listing URL, competitor pharmacies, nearby healthcare providers.

### Should be optional (Advanced Settings)

Trading name, company number, GPhC (if on website), reviewer photo/bio, fonts, patient groups, USPs, accreditations presets, service delivery micro-details, footer extra links, lat/long.

### Should move to Advanced Settings

- Service delivery profiles (funding model, equipment, consultation length) — default sensible presets
- Local entity checkbox pools (GP surgeries, landmarks) — auto-select top 5
- Content tone / booking method — default "Book appointment" + professional tone
- Marketing readiness score categories — internal only

### Current required fields blocking "complete" (9)

1. Pharmacy name  
2. Website URL or brand import  
3. Phone  
4. Address + town + postcode  
5. Primary town  
6. At least one target area  
7. Reviewer / superintendent name  
8. Clinical review date  
9. Next review date  

**Recommendation:** Reduce blocking required set to **5**: name, website, phone, address+postcode, one service OR one area. Defer clinical dates and reviewer to pre-publish checkpoint.

---

## Step 5 — Next action audit (one obvious action)

| Page | Current primary actions | Recommended single action |
|------|------------------------|---------------------------|
| Admin create | Submit form | **Start Setup** (unchanged) |
| Your Pharmacy | Review wizard / Import website | **Confirm Pharmacy Details** |
| Wizard each step | Continue | **Continue** (merge steps 1–3) |
| Your Local Market | Discover + Continue | **Discover Local Market** (then auto-advance) |
| Your Website Report | Continue | **Review Website** |
| Your Growth Plan | Generate / Review / Approve | **Create First Campaign** |
| Create Content | Create / Review | **Create Your Content** |
| Content Package | Create package | **Build My Pages** |
| Dashboard | Multiple tasks | **Publish** or **Continue Setup** |

---

## Step 6 — Completion logic

### Issues found

| Symptom | Root cause | Fix status |
|---------|------------|------------|
| **Needs Review** after save | `resolveFieldStatus` requires `profileFieldConfirmations` key; autosave did not auto-confirm | **Fixed** — `applyAutoConfirmOnSave` on profile POST |
| Wizard categories ◐ partial | Quality score counts optional brand/services fields | Document — defer to Advanced |
| Campaign Readiness ○ incomplete | `growthEngineCampaignRecommendationEngine` checks GI/website ack flags | Needs redesign — not blocking save |
| Stepper % stuck below 100 | BI complete requires all 9 required fields including clinical dates | Reduce required set (future sprint) |
| Local Market incomplete | Requires ≥5 live competitors | Correct — user must run Discover |

### Fix implemented (V1)

```typescript
// pharmacyProfileWizardEnrichment.ts — applyAutoConfirmOnSave()
// Called from POST /api/pharmacy/profile/:slug before persist
```

---

## Step 7 — Navigation audit

| Page | Previous | Next | Edit profile | Return to dashboard |
|------|----------|------|--------------|---------------------|
| Growth Engine Hub | — | Continue | Via nav | Via nav (Dashboard) |
| Your Pharmacy | — | Local Market ✓ | Wizard link ✓ | Platform nav ✓ |
| Profile Wizard | Back ✓ | Continue ✓ | — | Workflow bar → pharmacy-dashboard |
| Your Local Market | BI ✓ | Website ✓ | Platform nav ✓ | Platform nav ✓ |
| Your Website Report | Local Market ✓ | Growth Plan ✓ | Platform nav ✓ | Platform nav ✓ |
| Your Growth Plan | Website ✓ | Generate ✓ | Platform nav ✓ | Platform nav ✓ |
| Create Content | Growth Plan ✓ | Dashboard ✓ | Platform nav ✓ | Platform nav ✓ |
| Content Package | — | Review (if generated) | Platform nav ✓ | Workflow bar ✓ |
| Asset Review | — | — | — | Partial |
| Growth Engine Dashboard | Generate ✓ | — | Platform nav ✓ | — |

**Gaps:** Wizard lacks labelled "Edit Pharmacy Profile" / "Return to Dashboard" matching spec wording. Content Package and Asset Review are dead ends without unified workflow bar. Platform nav creates **12 exit ramps** from the guided journey.

---

## Step 8 — Language review (customer-facing)

### Terms to replace

| Current (customer-visible) | Replace with |
|---------------------------|--------------|
| Growth Engine | Your Growth Programme |
| Business Profile Wizard | Pharmacy Profile Setup |
| Create Content Package | Create Your Content |
| Content package | Your content set |
| Campaign OS | Your Campaign |
| Indexing | Google visibility |
| Authority Readiness / Content Review | Review Your Content |
| Growth Dashboard | Track Results |
| Technical details (admin) | Remove from customer view |
| Section N · … | Remove section numbers |
| Generator available | Ready to create content |
| Evidence synthesis | Based on your reports |
| Service intelligence | Your services |
| Import & Confirm (wizard step) | Confirm Your Details |
| Local Intelligence (wizard step) | Your Local Area |

### Banned terms audit

Product Reset validation bans: schema, canonical, breadcrumb, meta titles, entity (in SEO context). **Still present:** "Growth Engine", "Content Package", "Profile Wizard", internal step IDs in URLs (acceptable if not displayed).

---

## Step 9 — Recommended corrected journey

```
Admin creates client
    ↓
Confirm Pharmacy Details (import website — one combined step, ~3 min)
    ↓
Discover Local Market (one click, ~2 min)
    ↓
Review Website Report (read-only, ~2 min)
    ↓
View Growth Plan (one campaign — accept, ~2 min)
    ↓
Create First Campaign (~5 min wait)
    ↓
Review Content → Publish
```

### Estimated metrics (corrected journey)

| Metric | Target |
|--------|--------|
| Clicks (minimum path) | **14–18** |
| Setup time | **12–15 min** |
| Manual fields | **5 confirmations** |
| Auto-imported | **15–25 fields** |
| Wizard steps | **3** (Confirm → Services → Done) |

---

## Pages requiring redesign (priority order)

| Priority | Page | Change | Effort |
|----------|------|--------|--------|
| P0 | Profile Wizard | Collapse 8 steps → 3; Advanced Settings drawer | Large |
| P0 | Platform nav | Hide non-journey modules until dashboard stage | Medium |
| P1 | Your Pharmacy (BI) | Single CTA; inline import without leaving report | Medium |
| P1 | Growth Plan | Remove alternatives from default view; one CTA | Small |
| P1 | Content Package page | Rename; remove technical details | Small |
| P2 | Admin client table | Primary link → Your Pharmacy not Dashboard | Tiny |
| P2 | Wizard / BI nav | Standardise Previous · Next · Edit Profile · Dashboard | Small |
| P2 | Local Market | Auto-run discover when coords available | Medium |
| P3 | Dashboard consolidation | Single Track Results surface | Large |
| P3 | Required field set | Reduce to 5 for "complete" status | Small |

---

## What we did NOT change (this sprint)

- Business Intelligence / Local Market / Website / Growth Plan **engines**
- Content generators, publishing, FTP, registry, lifecycle
- Dashboard analytics, approval engine, data models
- Large UI redesign (documented only)

---

## Validation checklist

- [x] Customer journey documented end-to-end  
- [x] Vision / Reset / Roadmap drift identified  
- [x] Per-page friction recorded  
- [x] Profile field classification audited  
- [x] One-next-action gaps listed  
- [x] Completion logic investigated and server-side fix applied  
- [x] Navigation gaps documented  
- [x] Language review recorded  
- [x] Automated validation script added  

---

*Document version: CUSTOMER-SETUP-AUDIT-V1 · Evidence-based journey map for redesign sprint*
