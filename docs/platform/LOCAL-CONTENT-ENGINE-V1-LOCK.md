# Local Content Engine V1 — Lock Record

**Status:** LOCKED (RC1-L8, 2026-07-23)  
**Scope:** Generic local hub, cluster, and area generation (tenant-agnostic)  
**Product Owner:** browser validation pending (automated gate PASS)

## Shared renderers

| Concern | Module / function |
|---------|-------------------|
| Location hub page | `renderLocalHubPageHtml()` — `pharmacyLocalHubPageRenderer.ts` |
| Location cluster page | `renderLocalClusterLocationPageHtml()` — `pharmacyLocalClusterLocationPageRenderer.ts` |
| Location area page | `renderLocalAreaPageHtml()` — `pharmacyLocalAreaPageRenderer.ts` (`local-area-v1`) |
| Map / contact / coverage | `renderProfileLocalAccessSectionHtml()` — `pharmacyServicePageTrustInjection.ts` |
| Areas we support block | `renderHomepageAreasWeSupportSection()` + `renderHomepageCoverageTagsHtml()` |
| Final CTA | `buildProfileFinalCtaHtml()` / `buildLocalPageFinalCtaHtml()` |
| Generation orchestration | `pharmacyLocalLocationGenerationService.ts` |

## Shared components (IDs)

- `homepage-location-map-access` — single `#local-access` map/contact block  
- `homepage-areas-we-support` — `#areas-we-support` coverage section  

## Heading resolver

- `pharmacyLocalSectionHeadingResolver.ts` — customer-facing section titles (FAQ, areas, nearby, related locations, child-area cards)  
- `pharmacyLocalFaqHeadingResolver.ts` — FAQ wrapper; forbids internal engine labels  

## URL resolver

- `pharmacyLocalPageUrlResolver.ts` — public paths, preview paths, supported-area links, authenticated preview rewrite  

## Area resolver

- `pharmacyLocalAreaResolver.ts` — `resolveLocalLocationHierarchy()`, `hierarchyToContentGenerationAreas()`  
- Supported-area chips — `resolveTenantSupportedAreaLinks()` (operator `rawProfile.coverageAreas` + link map + hierarchy)  

## Regression commands

```bash
cd /home/inboxingproweb/pharmaconnect-growth-engine
pnpm exec tsx scripts/rc1-l8-local-content-engine-lockdown-validation.ts
pnpm exec tsx scripts/rc1-l7-local-page-final-polish-validation.ts
```

## Regression evidence

`data/pharmacy-master-admin/commercial-publish/banner-cross-pharmacy/rc1-l8-local-content-engine-lockdown/`

Multi-tenant in-memory hub render: `banner-cross-pharmacy`, `broom-lane-pharmacy`, `pharmaconnect` (no publish overwrite for B/C).

## Prohibited future changes

- Tenant- or city-specific branches in local renderers or resolvers  
- Duplicate map/access sections per page  
- Internal template headings (hub/cluster/area FAQ, child-area pages, parent links, etc.)  
- Static preview/ecosystem hrefs in generated local HTML (use `resolveLocalPagePublicPath`)  
- Forking homepage location markup outside `pharmacyServicePageTrustInjection.ts`  
- Deploy or indexing as part of engine lock verification  

## Browser acceptance (automated RC1-L8)

Homepage, hub, Ecclesall cluster, Sheffield City Centre area — desktop, tablet (homepage), mobile. All PASS.
