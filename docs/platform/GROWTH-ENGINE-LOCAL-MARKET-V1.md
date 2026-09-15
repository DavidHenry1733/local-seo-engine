# Growth Engine — Local Market Intelligence V1

## Purpose

Step 2 of the Growth Engine workflow — answers:

- Who are my local competitors?
- How do I compare?
- What opportunities am I missing?

**Real Google Places data only.** No invented metrics. Website/SEO analysis shows honest “available after website analysis” placeholders.

## Route

`/api/growth-engine/local-market?slug={tenant}`

## Data flow

1. **Your pharmacy** — fetched from Google Places via profile `googlePlaceId`, or text search on name + postcode.
2. **Competitors** — top 10 nearby pharmacies from existing discovery + Place Details enrichment.
3. **Analysis** — computed and stored in `data/growth-engine/{slug}-competitors.json` (snapshot v2).

## Snapshot fields

- `yourPharmacy` — full Google Places entity for the tenant
- `competitors[]` — only `source: google-places` entries when live
- `analysis` — comparisons, summary paragraphs, opportunities

## Comparison panel

| Metric | Your Pharmacy | Competitor Average | Highest Competitor |
|--------|---------------|--------------------|--------------------|
| Google Reviews | live | live | live |
| Average Rating | live | live | live |
| Photos | live | live | live |
| Categories | live | live | live |

Shows `—` when data is unavailable.

## API

`POST /api/growth-engine/:slug/local-market/discover` — refresh from Google Places.

## Validation

```bash
npx tsx scripts/validate-growth-engine-local-market-v1.ts
```

## Locked (unchanged)

BPI, generators, wizard logic, dashboard analytics, approval gates.
