# Local Page Contract V1 — Lock Record

**Status:** LOCKED (RC1-L7, 2026-07-23)  
**Tenant acceptance:** `banner-cross-pharmacy` / `pharmacy-first`  
**Product Owner:** browser validation pending on locked URLs below (automated gate PASS)

## Page-type contract IDs

| Page type | Contract ID |
|-----------|-------------|
| Location hub | `local-hub-v1` |
| Location cluster | `local-cluster-v1` |
| Location area | `local-area-v1` |

## Shared components

| Component | ID | Renderer |
|-----------|-----|----------|
| Homepage areas we support | `homepage-areas-we-support` | `renderHomepageAreasWeSupportSection()` — `pharmacyServicePageTrustInjection.ts` |
| Homepage location / map / access | `homepage-location-map-access` | `renderProfileLocalAccessSectionHtml()` — `pharmacyServicePageTrustInjection.ts` |
| Coverage tags (shared markup) | (inline) | `renderHomepageCoverageTagsHtml()` — `pharmacyServicePageTrustInjection.ts` |

Hub and cluster pages MUST use the above IDs and renderers; no forked access markup.

## Image-slot contract (hub / cluster)

Four roles required: `hero`, `supporting`, `trust`, `conversion` — enforced by `pharmacyLocalPageContractValidation.ts` / `LOCAL_*_V1_CONTRACT`.

## Typography contract

`localPageTypeTypographyStyleBlock()` — `--local-page-body-size: 17px`; hub/cluster contract attributes on `<body>`.

## FAQ heading contract

`resolveLocalFaqSectionHeading()` — `pharmacyLocalFaqHeadingResolver.ts`  
Forbidden visible labels: Location hub questions, Cluster questions, Hub questions, Local page questions, Area questions.

## Map / access contract

Single `#local-access` with `data-component-id="homepage-location-map-access"`, `data-component-variant="split-map-details"`. Exactly one access section per hub/cluster page.

## URL / link contract

`pharmacyLocalPageUrlResolver.ts`:

- **Public:** `resolveLocalPagePublicPath()` from stored page type + local segment (via `_internal-link-map.json` + hierarchy).
- **Authenticated preview:** `resolveLocalPagePreviewPath()` and `rewriteCanonicalHtmlLinksForAuthenticatedPreview()` in `sendCanonicalPreviewPage()`.
- **Supported areas:** `resolveTenantSupportedAreaLinks()` uses `rawProfile.coverageAreas` (operator-selected), link-map + hierarchy targets, span-only chips when no canonical page exists.

## Browser acceptance (automated RC1-L7)

| Viewport | Hub | Ecclesall cluster | Fulwood cluster |
|----------|-----|-------------------|-----------------|
| Desktop | PASS | PASS | PASS |
| Mobile | PASS | PASS | PASS |

Evidence: `data/pharmacy-master-admin/commercial-publish/banner-cross-pharmacy/rc1-l7-local-page-final-polish/`

## Prohibited fallbacks

- Tenant- or city-specific strings in resolver/renderer logic
- Duplicate `#local-access` / `#pharmacy-map-contact` blocks
- Internal FAQ template headings
- Legacy customer website URLs for local internal navigation (canonical HTML uses public paths; preview rewrites to visual-experience)
- Publishing or indexing as part of contract lock verification

## Regression test command

```bash
cd /home/inboxingproweb/pharmaconnect-growth-engine
pnpm exec tsx scripts/rc1-l7-local-page-final-polish-validation.ts
```

Requires PM2 `pharmaconnect-growth-engine` online and Playwright chromium.

## Preview URLs (authenticated)

- Hub: `https://app.pharmaconnect.uk/api/pharmacy-visual-experience/local-hub/?slug=banner-cross-pharmacy`
- Ecclesall: `https://app.pharmaconnect.uk/api/pharmacy-visual-experience/local-cluster-ecclesall/?slug=banner-cross-pharmacy`
- Fulwood: `https://app.pharmaconnect.uk/api/pharmacy-visual-experience/local-cluster-fulwood/?slug=banner-cross-pharmacy`
