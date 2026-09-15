# PharmaConnect Growth Engine Framework V1

## Overview

The Growth Engine Framework is the end-to-end product workflow for the platform. It does **not** change generators, BPI, wizard logic, or dashboard analytics — it orchestrates existing systems into one guided journey.

## Workflow (6 steps)

| Step | Route | Purpose |
|------|-------|---------|
| 1 Business Intelligence | `/api/growth-engine/business-intelligence?slug=` | Import completion summary → links to Profile Wizard V2 |
| 2 Local Market Intelligence | `/api/growth-engine/local-market?slug=` | Top 10 pharmacy competitors from Google Places — see [Local Market V1](./GROWTH-ENGINE-LOCAL-MARKET-V1.md) |
| 3 Growth Intelligence | `/api/growth-engine/growth-intelligence?slug=` | Evidence-backed opportunities (Growth Intelligence V1) |
| 4 Growth Plan | `/api/growth-engine/growth-plan?slug=` | Recommended campaign, page estimates, timelines |
| 5 Generate Ecosystem | `/api/growth-engine/generate?slug=` | Links to existing content package generation |
| 6 Growth Dashboard | `/api/growth-engine/dashboard?slug=` | Framework nav + links to existing growth dashboard |

**Hub:** `/api/growth-engine?slug=`

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/growth-engine/:slug/status` | Full workflow state JSON |
| GET | `/api/growth-engine/:slug/competitors` | Saved competitor snapshot |
| POST | `/api/growth-engine/:slug/local-market/discover` | Run Google Places discovery + enrichment |
| POST | `/api/growth-engine/:slug/acknowledge/{step}` | Mark framework step reviewed |

## Data

| Path | Content |
|------|---------|
| `data/growth-engine/{slug}-competitors.json` | Local market competitor snapshot |
| `data/growth-engine/{slug}-workflow.json` | Step acknowledgements |

## Competitor model

See `src/pharmacy/growthEngineCompetitorModel.ts` — Google Places fields plus future placeholder metrics (indexed pages, DA, scores).

## Locked systems (unchanged)

- BusinessProfileIntelligence, generators, long form, service/cluster pages
- Dashboard analytics, approval gates, registry, lifecycle, health audit, deployment

## Validation

```bash
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-pharmacy-profile-wizard-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-phase2-profile-fields-v1.ts
```
