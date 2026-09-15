# Growth Engine — Sprint 1 Business Intelligence Optimisation V1

**Status:** Complete  
**Sprint:** Product Refinement — Sprint 1  
**Scope:** Business Intelligence stage and Business Profile Wizard only

## Objective

Reduce setup time, manual typing, and first-time friction so a pharmacy owner can complete Business Intelligence in **under five minutes**. The majority of information should come from imports; typing is the exception.

## What changed

### 1. Profile field audit (internal)

Master classification lives in `src/pharmacy/pharmacyProfileFieldAudit.ts`:

| Input type | Purpose |
|------------|---------|
| `website-import` | Auto-filled from website analysis |
| `google-places` / `google-business-profile` | Google listing data |
| `checkbox` / `dropdown` / `toggle` / `multi-select` | Typing reduction |
| `manual` | Genuinely owner-specific (reviewer, clinical dates) |
| `remove` | Deprecated fields (e.g. legacy `email`) |

### 2. Expanded website import

`pharmacyWebsiteAnalysisService.ts` now extracts when present in HTML (never invented):

- **Business description** — meta description, `og:description`, schema `description`
- **Opening hours** — schema.org `openingHoursSpecification` per day; compact text fallback

Applied fields are tracked in `websiteImportedFieldKeys` on apply-brand-import.

### 3. Smart confirmation flow

Each imported wizard field shows status:

| Status | UI label | Owner action |
|--------|----------|--------------|
| `review` | Imported | Accept or Edit |
| `confirmed` | Confirmed | Read-only |
| `missing` | Not found | Enter manually |
| `manual` | Manual | Edit |

Confirmations persist in `profileFieldConfirmations` (ISO timestamp per field key).

### 4. Service quick setup (Wizard step 4)

Free-text delivery cards replaced with preset-driven controls where services exist:

- Funding dropdown
- Consultation length presets
- Appointment / walk-in toggles
- Equipment checkboxes

Full V2 delivery editor remains as fallback when quick setup is unavailable.

### 5. Local intelligence preview (Wizard step 1 + Growth Engine step 1)

During onboarding, owners see counts to confirm later in step 5:

- Google Place linked
- Competitors
- GP surgeries, health centres, hospitals, landmarks

### 6. Profile quality score

`pharmacyProfileWizardScoring.ts` rewards:

- Website import completed
- Imported fields confirmed (≥3 or no missing import fields)
- Brand elements from import
- Service delivery presets started

Does **not** reward unnecessary free-text (testimonials/awards removed from trust checks).

### 7. Help system

Long explanatory copy replaced with `?` help icons (`wizard-help`) and short tooltips on wizard subheads.

### 8. Completion UX

Wizard step 8 and progress bar show:

- Completion %
- Estimated minutes remaining
- Missing required items vs **Ready to Generate**
- Finish redirects to `/api/growth-engine?slug={tenant}`

### 9. Growth Engine Business Intelligence page

Step 1 (`renderBusinessIntelligencePage`) now shows:

- Import / confirm / not-found summary
- Brand import hero (logo, detected services, nav, social)
- Imported business information rows with badges
- Local intelligence preview
- CTA to review in wizard

## Schema additions (backwards compatible)

```typescript
websiteImportedFieldKeys: string[]      // default []
profileFieldConfirmations: Record<string, string>  // default {}
```

Existing profiles load without migration.

## Key files

| File | Role |
|------|------|
| `pharmacyProfileFieldAudit.ts` | Internal field classification |
| `pharmacyProfileWizardEnrichment.ts` | Import status, local preview, brand summary |
| `pharmacyProfileWizardSections.ts` | Wizard UI, help icons, accept/edit cards |
| `pharmacyProfileWizardPage.ts` | Client: accept/confirm, service sync, finish redirect |
| `pharmacyProfileWizardScoring.ts` | Quality score aligned to imports |
| `pharmacyWebsiteAnalysisService.ts` | Description + hours extraction |
| `growthEnginePageRenderers.ts` | BI step 1 page |
| `artifacts/api-server/.../pharmacyProfiles.ts` | Persists `websiteImportedFieldKeys` on apply |

## Validation

```bash
npx tsx scripts/validate-growth-engine-sprint1-bi-v1.ts
npx tsx scripts/validate-pharmacy-profile-wizard-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
```

## Locked systems (unchanged)

Do **not** modify in this sprint:

- Business Profile Intelligence, generators, content engine
- Long form, service pages, cluster pages
- Growth Engine workflow (steps 2–6 logic), approval gates, deployment
- Registry, lifecycle, health audit, dashboard analytics

## Expected result

A pharmacy owner opens the wizard, runs website import, accepts imported values, confirms local intelligence, selects service presets, and completes required trust fields — with typing limited to gaps the system could not import.
