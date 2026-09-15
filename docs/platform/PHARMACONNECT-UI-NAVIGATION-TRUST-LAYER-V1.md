# PharmaConnect UI Navigation & Professional Trust Layer V1

Completed sprint: consistent platform navigation, profile-driven header/footer trust chrome, professional review panel on visual service pages, and non-service content image placeholder allocation.

## 1. Navigation added

Central module: `src/pharmacy/pharmacyPlatformNav.ts`

- `buildPlatformNavItems(slug, serviceId)` — 11 module links, all retain `slug`
- `renderPharmacyPlatformNavBar()` — **Back to Platform Dashboard** + full nav bar
- Primary home route: `/api/pharmacy-dashboard?slug={slug}`

Wired into authenticated module pages:

| Page | Route | Active nav id |
|------|-------|---------------|
| Platform Dashboard | `/api/pharmacy-dashboard` | platform-dashboard |
| Profile Dashboard | `/api/pharmacy-profile-dashboard` | profile |
| Campaign OS | `/api/pharmacy-campaigns` | campaign-os |
| Image Library | `/api/pharmacy-image-library` | images |
| Authority Audit | `/api/pharmacy-authority-readiness` | authority |
| Enhancement Workspace | `/api/pharmacy-enhancement-workspace` | enhancement |
| Growth Dashboard | `/api/pharmacy-growth-dashboard` | growth-dashboard |
| Publishing Settings | `/api/pharmacy-publishing-settings` | publishing |
| Growth Actions | `/api/pharmacy-growth-actions` | growth-actions |

Indexing and Visibility link to `/api/pharmacy-growth-dashboard?slug={slug}#indexing` and `#visibility`.

## 2. Profile fields (single source of truth)

Profile Dashboard (`/api/pharmacy-profile-dashboard?slug={slug}`) saves to `data/pharmacy-profiles/{slug}.json`.

Verified field groups:

- **Branding:** logoUrl, brandPrimaryColor, brandSecondaryColor, brandCtaColor
- **Header/Footer:** pharmacyName, tradingName, phone, businessEmail, website, address, openingHours, social links
- **Trust/Regulation:** gphcNumber, gphcPremisesUrl, nhsProfileUrl, superintendent, consultation/NHS/private flags
- **Professional Review:** reviewerName, reviewerRole, qualifications, bio, specialisms, photo, clinicalReviewDate, nextReviewDate

Extended `PharmacyServicePageProfile` in `pharmacyServicePageProfileContext.ts` to expose reviewer and social fields to page chrome.

## 3. Reviewed-by layer

Module: `src/pharmacy/pharmacyProfessionalReviewPanel.ts`

Inserted in `buildPharmacyServicePageMainHtml()` **before FAQ**, panel title: **Professionally reviewed by**

Rules:

1. `reviewerName` → show named reviewer
2. Else `superintendentPharmacistName` → superintendent fallback
3. Else production-safe: *Professional review details available from the pharmacy.*
4. No demo/mock values (`pharmacyProfileProductionSafety`)

## 4. Header/footer profile usage

`pharmacyServicePageDesignSystem.ts`:

- Header: logo, pharmacy name, phone, primary CTA, in-page nav
- Footer: logo, pharmacy name, address, phone, email, opening hours, GPhC safe display, NHS profile link, social links (Facebook/Instagram/LinkedIn when set)

No hardcoded Brook details — all from profile.

## 5. Placeholder image strategy

Module: `src/pharmacy/pharmacyContentImagePlaceholderService.ts`

Output: `data/pharmacy-content-image-placeholders/{slug}.json`

Resolution order per asset:

1. Service-specific image assignment
2. Service library fallback
3. Generic pharmacy fallback (benchmark services)

Asset types covered: blog posts, patient guides, local pages, FAQ pages, social previews, GBP previews, email headers, video thumbnails.

## 6. Schema / trust metadata

`enhanceTrustSchemaForSlug()` adds when reviewer profile complete:

- `reviewedBy` Person on pharmacy node
- `lastReviewed` from clinicalReviewDate
- Standalone `#clinical-reviewer` Person node (no fake credentials)

## 7. Validation result

**42/42 PASS (100%)** — run:

```bash
npx tsx scripts/validate-pharmacy-ui-trust-layer-v1.ts pharmaconnect
```

## 8. URLs to test

Replace `{slug}` with `pharmaconnect`:

| Purpose | URL |
|---------|-----|
| Platform home | `/api/pharmacy-dashboard?slug={slug}` |
| Profile | `/api/pharmacy-profile-dashboard?slug={slug}#section-professional-review` |
| Campaign OS | `/api/pharmacy-campaigns?slug={slug}` |
| Image Library | `/api/pharmacy-image-library?slug={slug}&service=blood-pressure-checks` |
| Authority Audit | `/api/pharmacy-authority-readiness?slug={slug}&service=blood-pressure-checks` |
| Enhancement Workspace | `/api/pharmacy-enhancement-workspace?slug={slug}&service=blood-pressure-checks` |
| Growth Dashboard | `/api/pharmacy-growth-dashboard?slug={slug}` |
| Publishing Settings | `/api/pharmacy-publishing-settings?slug={slug}&service=blood-pressure-checks` |
| Growth Actions | `/api/pharmacy-growth-actions?slug={slug}` |
| Visual page (rebuild) | `/api/pharmacy-visual-experience/blood-pressure-checks/?slug={slug}&rebuild=1` |

## Constraints honoured

- No new services created
- No local cluster pages
- No clinical copy rewrites
- No visual template redesign (fixed slot order preserved; review panel added as new slot before FAQ)
- No new intelligence engines

## Next step

Continue full workflow testing from **Platform Dashboard** — all modules reachable without direct URLs.
