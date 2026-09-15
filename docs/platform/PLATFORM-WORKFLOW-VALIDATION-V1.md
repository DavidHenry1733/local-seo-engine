# Platform Workflow Validation V1

**Validation campaign:** Brook Pharmacy · Blood Pressure Checks  
**Slug:** `pharmaconnect` · **Service:** `blood-pressure-checks` · **Campaign ID:** `2e5cf653-7df3-4918-96f8-c99d687b764b`  
**Validated:** 2026-06-26  
**Mode:** Feature freeze — validate only, repair issues discovered during testing  

**Machine-readable report:** `data/platform-validation/pharmaconnect-workflow.json`  
**Re-run:** `pnpm pharmacy:platform:workflow:validate`

---

## Executive summary

| Metric | Result |
|--------|--------|
| **Overall status** | **FAIL** (not publish-ready for live customer demo) |
| Stages PASS | 3 / 8 |
| Stages WARNING | 3 / 8 |
| Stages FAIL | 2 / 8 |
| Authority score (Blood Pressure) | 95 (after publishing settings applied in Stage 6) |
| Publish gate | **FAIL** — demo trust data blocker remains |
| Publish ready | **No** |

**What works end-to-end:** Profile, campaign storage, image assignment (4/4 slots), visual page generation with Brook branding and localisation, QA engines, real enhancement action plumbing, indexing/visibility flags on campaign record.

**What blocks publish-ready:** Demo/mock trust profile (`demoMode`, placeholder superintendent). Secondary: missing logo, duplicate support image on visual page, campaign OS noise from duplicate test campaigns.

---

## Stage gate results

Stages must **PASS** before proceeding in a strict operator run. This validation continued through all stages for full documentation.

| Stage | Name | Status | Gate |
|-------|------|--------|------|
| 1 | Business Profile | **WARNING** | Open |
| 2 | Campaign Creation | **PASS** | Open |
| 3 | Image Workflow | **PASS** | Open |
| 4 | Visual Page | **WARNING** | Open |
| 5 | Quality Assurance | **FAIL** | **Blocked** |
| 6 | Real Enhancement Actions | **PASS** | Open (run after fixing Stage 5 blockers in production) |
| 7 | Publish Readiness | **FAIL** | **Blocked** |
| 8 | Operator Experience | **WARNING** | UX review only |

---

## Stage 1 — Business Profile

**Status: WARNING**

| Check | Result | Detail |
|-------|--------|--------|
| Profile loads | PASS | Brook Pharmacy |
| Required fields save | PASS | 10/10 audit checks |
| Professional Review saves | PASS | Dr Sarah Mitchell, dates set |
| Trust Signals save | PASS | GPhC 9012345, accreditations |
| Brand colours save | PASS | #005eb8 |
| Logo loads | **WARNING** | `logoUrl` empty |
| Contact details | PASS | 01709 210731 · support@inboxingproweb.com |

**Screenshot:** Not captured (dashboard requires login). Profile data verified via `data/pharmacy-profiles/pharmaconnect.json`.

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| Medium | No pharmacy logo uploaded | Upload logo via Profile Dashboard |
| High | Profile `demoMode` + `trustDataStatus: mock` | Switch to live credentials before customer demo |
| High | Superintendent name is demo placeholder | Replace with verified superintendent name |

---

## Stage 2 — Campaign Creation

**Status: PASS**

| Check | Result | Detail |
|-------|--------|--------|
| Campaign stored | PASS | Blood Pressure Checks — Increase Visibility |
| Service selection | PASS | `blood-pressure-checks` |
| Area selection | PASS | Brinsworth, Parkgate, Rawmarsh |
| Campaign OS | PASS | Enriched in control centre |

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| Medium | 5 active Pharmacy First campaigns | Archive duplicates; one validation campaign per service |
| Medium | 10 active campaigns — primary may not be Blood Pressure | Default Campaign OS to validation campaign or archive others |

---

## Stage 3 — Image Workflow

**Status: PASS**

| Check | Result | Detail |
|-------|--------|--------|
| Image Library data | PASS | Assignments doc loaded |
| Library images display | PASS | Library refs assigned |
| Upload works | PASS | 13 upload records |
| AI request records | PASS | Platform records AI requests (0 for BP) |
| Slot assignment | PASS | 4/4 slots |
| Assignment persists | PASS | 4 keys in `data/pharmacy-image-assignments/pharmaconnect.json` |
| Images on preview | PASS | Visual HTML has slot markers |
| Campaign Image Centre | PASS | 4/4 in Campaign OS |

**Screenshot:** Not captured (Image Library requires login).

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| Medium | Alt text contains `undefined` in stored assignments | Regenerate alt text with profile context on assign |

---

## Stage 4 — Visual Page

**Status: WARNING**

| Check | Result | Detail |
|-------|--------|--------|
| Approved template | PASS | Visual experience template |
| Brook branding | PASS | Brook Pharmacy + NHS blue |
| Brook localisation | PASS | Rotherham, Brinsworth, Parkgate, Rawmarsh |
| Images render | PASS | No `data-image-missing` |
| No placeholders | PASS | No visible v3-placeholder blocks |
| No duplicate sections | **WARNING** | Support slot image appears twice |
| CTA | PASS | Speak To A Pharmacist + tel link |
| Map | PASS | Google Maps embed |
| Footer | PASS | `#site-footer` |
| Mobile layout | PASS | Viewport meta present |

**Preview URL (public):** `/api/pharmacy-visual-experience/blood-pressure-checks/?slug=pharmaconnect`  
**Static HTML:** `output/pharmacy-visual-experience/pharmaconnect/blood-pressure-checks/index.html`

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| Medium | Support image rendered twice | Fix template block deduplication |
| Low | HTML contains `noindex` meta (preview) | Expected for preview; Publishing Settings + live publish for production |

---

## Stage 5 — Quality Assurance

**Status: FAIL** — **Do not proceed to publish until resolved**

| Check | Result | Detail |
|-------|--------|--------|
| Authority Audit | PASS | Score 93, gate FAIL |
| Enhancement Engine | PASS | 33 recommendations |
| Publish Gate | **FAIL** | FAIL |
| Launch Queue | PASS | 13 tasks |
| Growth Actions | PASS | 28 pending |

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| Critical | Page marked noindex (HTML) | Set `noindex=false` in Publishing Settings — **fixed during Stage 6 validation** |
| Critical | Demo/mock trust data | Clear `demoMode`, verify GPhC/NHS/superintendent before live publish |

---

## Stage 6 — Real Enhancement Actions

**Status: PASS**

| Action | Result |
|--------|--------|
| Reviewer profile | PASS |
| Clinical review date | PASS |
| Next review date | PASS |
| Images (≥3/4 slots) | PASS |
| Canonical URL | PASS (configured during validation) |
| Noindex setting | PASS (`noindex: false` saved) |
| Refresh chain | PASS | Score 93 → 95 |
| Campaign OS update | PASS | Gate reflected |

### Issues

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| High | Publishing settings were not pre-configured for blood-pressure-checks | Include Publishing Settings step in standard campaign checklist |

---

## Stage 7 — Publish Readiness

**Status: FAIL**

| Check | Result | Detail |
|-------|--------|--------|
| Publish gate | **FAIL** | FAIL (demo trust only after noindex fix) |
| Launch queue | WARNING | 3 blocked / 13 tasks |
| Publishing workflow | PASS | Workflow engine responds |
| Indexing readiness | PASS | Campaign marked indexed |
| Visibility readiness | PASS | Campaign marked visible |
| Remaining blockers | **FAIL** | Demo trust data |

### Remaining blocker (Critical)

> Profile trust data still marked demo/mock — verify live credentials before publish

**Path to PASS:** Set `demoMode: false`, replace demo superintendent with verified name, upload real logo, complete launch queue authority sign-off.

---

## Stage 8 — Operator Experience (UX only)

**Status: WARNING**

| Area | Result | Notes |
|------|--------|-------|
| Confusing wording | WARNING | Multiple identical "Increase Visibility" campaign names |
| Broken navigation | PASS | Routes resolve; dashboards need login |
| Missing buttons | PASS | Primary actions in Campaign OS / Workspace |
| Duplicate information | WARNING | Authority + Enhancement + Growth overlap on Campaign OS |
| Click depth | WARNING | 6+ pages for full workflow |
| Dead links | PASS | Visual preview public |
| Layout | PASS | Structured Campaign OS panels |

### UX issues (no code changes in this validation pass)

| Priority | Issue | Recommended fix |
|----------|-------|-----------------|
| High | Auth wall on all `/api/*` dashboards | Document demo credentials on Executive Dashboard |
| Medium | Campaign OS primary not Blood Pressure | Archive test campaigns; default to validation campaign |
| Medium | 6+ page workflow | Single-page validation checklist for operators |
| Medium | 33 enhancement tasks overwhelming | Filter workspace to real-action types during validation |
| Low | No demo banner on visual preview | Show "Demo preview" when `demoMode=true` |
| Low | Dual Image Library URLs | Standardise on `/api/pharmacy-image-library` |

---

## Critical path to publish-ready (repair only)

These are **fixes**, not new features. Re-test after each:

1. **Clear demo trust** — Profile Dashboard: set live superintendent, clear demo flags (**Critical**)
2. **Upload logo** — Profile Dashboard logo upload (**Medium**)
3. **Archive duplicate campaigns** — Keep Brook / Blood Pressure as sole active validation campaign (**Medium**)
4. **Fix duplicate support image** — Visual template deduplication (**Medium**)
5. **Fix alt text `undefined`** — Image assignment alt generation (**Medium**)
6. **Re-run validation** — `pnpm pharmacy:platform:workflow:validate`

Expected outcome after steps 1–6: Publish gate moves toward **PASS_WITH_RECOMMENDATIONS** or **PASS**; Stage 7 passes.

---

## Files created

| File | Purpose |
|------|---------|
| `docs/platform/PLATFORM-WORKFLOW-VALIDATION-V1.md` | This report |
| `data/platform-validation/pharmaconnect-workflow.json` | Machine-readable stage results |
| `scripts/validate-platform-workflow-v1.ts` | Repeatable validation runner |

---

## Freeze rules (active)

- No new engines, dashboards, or intelligence layers
- Only repair issues discovered during real workflow testing
- Re-test after every fix before proceeding
- Validation campaign: **Brook Pharmacy / Blood Pressure Checks**
