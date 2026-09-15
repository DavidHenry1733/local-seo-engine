# PHARMACONNECT Website Analysis & Profile Import V1

Standard onboarding workflow for every new pharmacy. Reuses the Local SEO Engine website fetcher and brand importer — no duplicate analysis engine.

## 1. Analysis workflow

1. Pharmacy owner opens **Profile Dashboard → Website Analysis & Profile Import**.
2. Enters existing website URL (e.g. `https://www.theirpharmacy.co.uk`).
3. Clicks **Analyse Existing Website**.
4. `POST /api/pharmacy/profile/:slug/analyze-website` runs `analyzeWebsiteForPharmacy()`:
   - Phase 1: `importBrandFromUrl()` — identity, logo, favicon
   - Phase 2: Brand colours, fonts, button style
   - Phase 3: Header/footer nav, primary CTA
   - Phase 4: Phone, email, social links, Google Maps
   - Phase 5: Town, city, county, postcode (schema.org + UK postcode; blank if confidence &lt; 50%)
   - Phase 6: Service keyword detection with confidence (not auto-enabled)
   - Phase 7: Profile patch + merge preview + completion projection
5. Dashboard shows **Imported Successfully — Review Before Saving** with phase status, checklist and merge preview.
6. Owner edits values in the panel, then clicks **Apply to Profile**.
7. `POST /api/pharmacy/profile/:slug/apply-brand-import` merges via `mergeWebsiteAnalysisIntoProfile()` — empty fields only unless `overwrite: true`.
8. Owner clicks **Save Profile** to persist and trigger authority/platform refresh.

## 2. Imported data

| Phase | Fields |
|-------|--------|
| Identity | `pharmacyName`, `tradingName`, `website`, `logoUrl`, `faviconUrl` |
| Branding | `brandPrimaryColor` … `brandMutedTextColor`, `fontHeading`, `fontBody`, `buttonStyle` |
| Navigation | `headerNavLinks`, `footerLinks`, `headerCtaText`, `headerCtaUrl`, `preferredCta` |
| Contact | `phone`, `businessEmail`, `socialFacebook` … `socialYouTube`, `googleMapsEmbedUrl` |
| Location | `primaryTown`, `primaryCity`, `townCity`, `county`, `postcode`, `addressLine1` |
| Services | `detectedWebsiteServices[]` (confidence only — not `selectedServices`) |
| Metadata | `websiteAnalysisAt`, `websiteAnalysisSourceUrl` |

## 3. Remaining manual tasks

After analysis, the checklist highlights items such as:

- ✓ Logo imported
- ✓ Brand colours imported
- ⚠ Opening hours need confirmation
- ● GPhC registration required
- ● Superintendent pharmacist required
- ● Reviewer biography required

Detected services are shown for review — they are **never** automatically enabled in the service library.

## 4. Profile completion calculation

`computeProfileCompleteness()` scores nine sections (≈11% each):

1. Business Identity  
2. Branding  
3. Navigation  
4. Contact Details  
5. Location  
6. Professional Review  
7. Opening Hours  
8. GPhC Details  
9. Reviewer  

Each section reports `complete`, `partial`, or `needs_completion`. Overall score = weighted sum capped at 100%.

Analysis also returns **projected completeness** after applying the import patch to empty fields.

## 5. Dashboard integration

- Section renamed: **Website Analysis & Profile Import**
- Panel: `src/generator/brandImportPanel.ts` (pharmacy mode)
- Section: `renderWebsiteBrandingSection()` in `pharmacyProfileDashboardSections.ts`
- Completeness panel updates live after Apply via `updateDashboardCompleteness()`

## 6. Authority engine integration

Apply and Save call `refreshPlatformAfterEnhancementComplete(slug)`, which refreshes:

- Authority Audit / Readiness  
- Enhancement Engine  
- Campaign OS / Publish Readiness  
- Platform Dashboard  

Imported profile values feed `buildPharmacyServicePageProfile()` and theme engine immediately after save.

## 7. Validation

```bash
pnpm exec tsx scripts/validate-pharmacy-website-analysis-profile-import-v1.ts pharmaconnect
```

Checks: analysis succeeds, profile populated, no duplicate importer, UI/API wiring, smart merge, checklist, completion, authority gate readable, documentation present.

## 8. Key files

| File | Role |
|------|------|
| `src/generator/brandImporter.ts` | LSE fetch + extract (reused) |
| `src/pharmacy/pharmacyWebsiteAnalysisService.ts` | Pharmacy orchestration + merge |
| `src/pharmacy/pharmacyBrandProfileMapper.ts` | Brand → profile mapping |
| `src/pharmacy/pharmacyProfileCompleteness.ts` | Completion + checklist |
| `src/generator/brandImportPanel.ts` | Dashboard UI + client script |
| `artifacts/api-server/src/routes/api/pharmacyProfiles.ts` | API routes |

## 9. Future enhancements

- Single HTML fetch shared between brand importer and extensions (avoid double fetch)
- Logo download to `assets/pharmacy-logos/` during analysis
- Opening hours extraction from schema.org `OpeningHoursSpecification`
- Superintendent pharmacist detection from About pages
- Campaign setup hook: auto-trigger analysis when `existingWebsiteUrl` is set at onboarding
- Service detection → suggested enable list in Service Library UI
