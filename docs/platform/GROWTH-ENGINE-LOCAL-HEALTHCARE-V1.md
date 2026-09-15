# Growth Engine — Local Healthcare Intelligence V1 (Step 2)

**Status:** Complete  
**Sprint:** Product Refinement — Sprint 2  
**Route:** `/api/growth-engine/local-market?slug={tenant}`  
**API:** `POST /api/growth-engine/:slug/local-market/discover`

## Purpose

Transform Step 2 from pharmacy-only competitor intelligence into **Local Healthcare Intelligence** — a digital healthcare intelligence report showing where the pharmacy sits within its local healthcare ecosystem.

The pharmacy owner should immediately understand:

- Where they are
- Who surrounds them (GPs, hospitals, care homes, healthcare services)
- Who they compete with (grouped by ownership where identifiable)
- What opportunities exist within their local healthcare ecosystem

**No fake data. No placeholder metrics. Real Google Places intelligence only.**

## What changed from Local Market V1

| Area | V1 | V1 Healthcare (Sprint 2) |
|------|----|--------------------------|
| Scope | Pharmacy competitors only | Full healthcare ecosystem + competitors |
| Discovery | Pharmacy text search | 11 healthcare query types + pharmacy competitors |
| Grouping | Flat competitor list | 6 display groups + ownership classification |
| Summary | Pharmacy market only | Healthcare ecosystem + pharmacy summaries |
| Opportunities | GBP comparison | Ecosystem density, competition, network observations |
| Map | Per-competitor iframe only | Reusable map model with layer types |
| Snapshot version | 2 | 3 (backwards compatible) |

## Healthcare ecosystem groups

Display groups on the page:

1. **GP Surgeries**
2. **Health Centres** (includes walk-in centres)
3. **Hospitals** (includes urgent treatment centres)
4. **Care Homes**
5. **Other Pharmacies** (from competitor discovery)
6. **Healthcare Services** (dentists, opticians, physio, podiatry, mental health, community clinics)

Each group shows: **Count · Nearest · Expand · View All**

## Data collected (when Google returns it)

- Business name, category, distance, address
- Rating, review count, telephone, website
- Opening status, Google Maps link, Place ID

Values are never invented. Empty groups remain empty until discovery runs with a valid API key.

## Competitor ownership (Part 3)

Competitors are separated where identifiable **from business name only**:

| Type | Examples |
|------|----------|
| National chains | Boots, Lloyds, Superdrug, Well, Tesco, ASDA, Morrisons |
| Regional groups | Rowlands, Day Lewis, Cohens, Paydens |
| Independent | Named pharmacies with no chain pattern |
| Unclassified | No pharmacy/chain pattern matched |

We do **not** guess ownership beyond name patterns.

## Map model (Part 4)

Reusable data structure in snapshot — no UI redesign:

```typescript
HealthcareMapModel {
  center, zoom,
  markers: [{ layer: 'your-pharmacy' | 'healthcare-provider' | 'competitor', ... }],
  futureLayers: { catchmentOverlay, driveTimeAnalysis, referralRoutes, demographicLayers } // all null
}
```

## Future sections (Part 7)

Placeholders only — marked "Available in future analysis":

- Website Intelligence
- Referral Intelligence
- Population Intelligence
- Catchment Analysis
- Healthcare Network

## Key files

| File | Role |
|------|------|
| `growthEngineHealthcareModel.ts` | Types, display groups, future sections |
| `growthEngineHealthcareDiscovery.ts` | Google Places healthcare discovery |
| `growthEngineHealthcareAnalysis.ts` | Ecosystem grouping, summary, opportunities |
| `growthEngineHealthcareMapModel.ts` | Reusable map marker model |
| `growthEngineCompetitorOwnership.ts` | Chain/independent classification |
| `growthEngineLocalMarketService.ts` | Orchestration (competitors + healthcare) |
| `growthEngineLocalMarketPage.ts` | Step 2 page renderer |

## Snapshot schema (v3)

Existing `GrowthEngineCompetitorSnapshot` extended with:

```typescript
healthcare?: {
  version: 1,
  generatedAt: string,
  providers: HealthcareProviderEntity[],
  analysis: HealthcareAnalysisSnapshot | null,
  mapModel: HealthcareMapModel | null,
}
```

v2 snapshots load with empty healthcare defaults; run Discover to populate.

## Validation

```bash
npx tsx scripts/validate-growth-engine-local-healthcare-v1.ts
npx tsx scripts/validate-growth-engine-local-market-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-growth-intelligence-v1.ts
npx tsx scripts/validate-growth-engine-sprint1-bi-v1.ts
npx tsx scripts/validate-pharmacy-profile-wizard-v1.ts
```

## Locked systems (unchanged)

Do **not** modify:

- Business Profile Intelligence, generators, content engine
- Long form, service pages, cluster pages
- Growth Engine workflow structure (step IDs/routes)
- Growth Intelligence (Step 3)
- Approval gates, deployment, registry, lifecycle, health audit, dashboard analytics

## Expected result

Step 2 becomes a strong commercial feature: the owner sees their pharmacy in context of the surrounding healthcare network before progressing to Growth Intelligence.

Run **Discover local intelligence** once per tenant after Business Intelligence is complete and `GOOGLE_PLACES_API_KEY` is configured.
