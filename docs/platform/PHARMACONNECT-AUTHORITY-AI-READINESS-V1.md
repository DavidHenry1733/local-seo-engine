# PharmaConnect Authority & AI Readiness V1

Publish-readiness audit layer for service campaigns — identifies E-E-A-T, local authority, information gain and AI citation signals before live publication.

## Purpose

Every visual service page is audited against eight categories using **existing data only** (profile, visual HTML, ecosystem index, image assignments, campaigns). No content is modified. No external AI APIs are called.

This is the final quality gate before publishing and indexing.

## Files created

| File | Role |
|------|------|
| `src/pharmacy/pharmacyAuthorityReadinessService.ts` | Core audit engine, scoring, persistence |
| `artifacts/api-server/src/routes/api/pharmacyAuthorityReadiness.ts` | JSON API |
| `artifacts/api-server/src/routes/pharmacyAuthorityReadinessPage.ts` | Full audit dashboard HTML |
| `scripts/validate-pharmacy-authority-readiness-v1.ts` | End-to-end validation |
| `data/pharmacy-authority-readiness/{slug}.json` | Audit output (generated) |

## Files modified

| File | Change |
|------|--------|
| `artifacts/api-server/src/routes/index.ts` | Route registration |
| `src/pharmacy/pharmacyCampaignControlCentreService.ts` | Authority summary on campaigns + checklist item |
| `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` | Authority & AI Readiness section on Campaign OS |
| `package.json` | Validation script |

**Not modified:** service masters, clinical content, visual page template, published copy.

## Scoring model

Eight categories, each scored **0–100** from signal presence:

1. Human Expertise  
2. Pharmacy Local Authority  
3. Clinical Trust  
4. Information Gain  
5. AI Citation Readiness  
6. Structured Data Readiness  
7. Content Ecosystem Support  
8. Technical Publish Readiness  

**Overall score** = average of category scores.

| Score | Label |
|-------|-------|
| 90–100 | Excellent |
| 75–89 | Strong |
| 60–74 | Needs Enhancement |
| Below 60 | Not Ready |

**Publish gate:**

| Gate | Condition |
|------|-----------|
| `PASS` | Score ≥ 90 and no critical issues |
| `PASS_WITH_RECOMMENDATIONS` | Score 60–89 or non-blocking gaps |
| `FAIL` | Score &lt; 60 or critical issues (missing H1, noindex, placeholders, demo trust data, etc.) |

## Services audited (V1)

- `pharmacy-first`
- `blood-pressure-checks`
- `travel-vaccinations`
- `emergency-contraception`

Input HTML: `output/pharmacy-visual-experience/{slug}/{serviceId}/index.html`

## Dashboard integration

### Campaign OS (`/api/pharmacy-campaigns?slug=pharmaconnect`)

Compact **Authority & AI Readiness** table per service:

- Authority score  
- AI readiness label  
- Publish gate  
- Top 3 missing signals  
- Link to full audit  

Also shown on active campaign control panel and asset checklist.

### Full audit page

`/api/pharmacy-authority-readiness?slug=pharmaconnect&service=pharmacy-first`

- Service selector  
- Overall + category scores  
- Missing signals & recommended enhancements  
- Evidence breakdown per category  
- Refresh audit button  

## API routes

| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/pharmacy-authority-readiness?slug=&service=` | Full audit HTML |
| GET | `/api/pharmacy-authority-readiness/:slug` | JSON audit document |
| POST | `/api/pharmacy-authority-readiness/:slug/refresh` | Re-run audit and save |

## Example missing signals

- Human Expertise: Review date  
- Human Expertise: Next review date  
- Technical Publish Readiness: Canonical  
- Structured Data Readiness: BreadcrumbList  
- Information Gain: What patients should bring  

## Example critical issues (demo profile)

- Page marked noindex — remove before live publish  
- Profile trust data still marked demo/mock — verify live credentials before publish  

## Validation

```bash
pnpm run pharmacy:authority:validate
# or
pnpm exec tsx scripts/validate-pharmacy-authority-readiness-v1.ts pharmaconnect
```

Report: `data/validation-reports/pharmacy-authority-readiness-v1.json`

## Recommended next phase

1. Add canonical URLs and remove noindex when entering publish pipeline  
2. Replace demo superintendent / mock trust flags with verified profile data  
3. Add clinical review date + next review date to trust layer  
4. Wire publish gate into launch queue blockers (block indexing when `FAIL`)  
5. Extend audit to remaining benchmark services beyond visual four  
