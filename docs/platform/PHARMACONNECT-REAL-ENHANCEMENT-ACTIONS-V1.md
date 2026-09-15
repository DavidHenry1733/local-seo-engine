# PharmaConnect Real Enhancement Actions V1

Convert selected Enhancement Workspace recommendations from test-mode-only into **real platform actions** with data validation before completion.

## Real action types implemented

| Action type | Where to complete | Storage |
|-------------|-------------------|---------|
| Professional reviewer profile | Profile Dashboard → Professional Review | `data/pharmacy-profiles/{slug}.json` |
| Clinical review date | Profile Dashboard → Professional Review | Profile JSON |
| Next review date | Profile Dashboard → Professional Review | Profile JSON |
| Image assignment | Image Library (`/api/pharmacy-image-library?slug=&service=&slot=`) | Existing image slot assignments |
| Canonical URL | Publishing Settings | `data/pharmacy-publishing-settings/{slug}.json` |
| Noindex setting | Publishing Settings | Publishing settings JSON |

**Not in V1 (test mode only):** FAQ editing, structured data editing, content rewriting.

## Files created

- `src/pharmacy/pharmacyPublishingSettingsService.ts`
- `src/pharmacy/pharmacyRealEnhancementActionsService.ts`
- `artifacts/api-server/src/routes/pharmacyPublishingSettingsPage.ts`
- `artifacts/api-server/src/routes/api/pharmacyPublishingSettings.ts`
- `scripts/validate-pharmacy-real-enhancement-actions-v1.ts`
- `docs/platform/PHARMACONNECT-REAL-ENHANCEMENT-ACTIONS-V1.md`

## Files modified

- `src/pharmacy/pharmacyProfileSchema.ts` — reviewer + review date fields
- `src/pharmacy/pharmacyAuthorityReadinessService.ts` — profile + publishing settings in audit
- `src/pharmacy/pharmacyAuthorityEnhancementService.ts` — real-data signal checks
- `src/pharmacy/pharmacyEnhancementWorkspaceService.ts` — validation before complete, progress fields
- `src/pharmacy/pharmacyCampaignControlCentreService.ts` — Campaign OS enrichment
- `artifacts/api-server/src/routes/pharmacyProfileDashboardPage.ts` — editable professional review fields
- `artifacts/api-server/src/routes/api/pharmacyProfiles.ts` — refresh chain on save
- `artifacts/api-server/src/routes/api/pharmacyEnhancementWorkspace.ts` — 400 on validation failure
- `artifacts/api-server/src/routes/pharmacyEnhancementWorkspacePage.ts` — real vs test banner
- `artifacts/api-server/src/routes/pharmacyCampaignsPage.ts` — Enhancement Progress display
- `artifacts/api-server/src/routes/index.ts` — publishing settings routes
- `package.json` — validation script

## Storage format

### Profile (`data/pharmacy-profiles/{slug}.json`)

```json
{
  "data": {
    "reviewerName": "Dr Sarah Mitchell",
    "reviewerRole": "Superintendent Pharmacist",
    "reviewerQualifications": "MPharm, MRPharmS",
    "reviewerGphcNumber": "",
    "reviewerExperienceYears": "12",
    "reviewerBio": "…",
    "reviewerSpecialisms": ["Pharmacy First"],
    "reviewerPhoto": "",
    "clinicalReviewDate": "2026-03-01",
    "nextReviewDate": "2026-09-01"
  }
}
```

### Publishing settings (`data/pharmacy-publishing-settings/{slug}.json`)

```json
{
  "version": 1,
  "slug": "pharmaconnect",
  "updatedAt": "2026-06-09T…",
  "services": [
    {
      "serviceId": "pharmacy-first",
      "canonicalUrl": "https://…",
      "noindex": false,
      "structuredDataEnabled": true,
      "updatedAt": "2026-06-09T…"
    }
  ]
}
```

## Completion validation rules

| Task type | Required before Mark Complete |
|-----------|------------------------------|
| Reviewer profile | `reviewerName` + `reviewerRole` + `reviewerBio` |
| Clinical review date | `clinicalReviewDate` |
| Next review date | `nextReviewDate` |
| Canonical | `canonicalUrl` in publishing settings |
| Noindex | `noindex === false` in publishing settings |
| Image assignment | ≥3/4 image slots assigned |

If validation fails:

> Action not complete yet — please complete the required fields first.

## Refresh chain

After profile save, publishing settings save, or real task completion:

1. Authority Audit  
2. Authority Enhancement Engine  
3. Growth Actions  
4. Campaign Launch Queue  

## Validation

```bash
pnpm pharmacy:real-enhancement:validate
```

Report: `data/validation-reports/pharmacy-real-enhancement-actions-v1.json`

**Latest run (`pharmaconnect` / `pharmacy-first`):** 14/14 checks passed. Authority score 97 after real actions; noindex critical blocker removed; publish gate remains `FAIL` only due to demo trust data (`trustDataStatus: mock`). Masters, templates and visual HTML unchanged.

## Manual test checklist

1. [ ] Open Enhancement Workspace for `pharmaconnect` / `pharmacy-first`
2. [ ] Try Mark Complete on reviewer task without profile fields → rejected
3. [ ] Open Profile Dashboard `#section-professional-review`, fill reviewer fields, Save
4. [ ] Mark Complete on reviewer task → succeeds (real mode, not test)
5. [ ] Set clinical + next review dates, save profile
6. [ ] Open Publishing Settings, set canonical URL, uncheck noindex, save
7. [ ] Authority Audit shows review dates, canonical, indexable signals
8. [ ] Campaign OS Enhancement Progress shows real completed count and publish gate
9. [ ] Confirm masters, templates and visual HTML unchanged

## Remaining recommendation types (test mode)

- FAQ editing (`/api/pharmacy-faq-workspace` placeholder)
- Structured data editing (toggle saved only; no live schema changes)
- Content rewriting / copy enhancements
- Competitor, ecosystem, AI citation, and other non-V1 signal groups
