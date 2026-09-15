# Growth Engine — Growth Intelligence V1 (Step 3)

**Status:** Complete  
**Route:** `/api/growth-engine/growth-intelligence?slug={tenant}`  
**API:** `GET /api/growth-engine/:slug/opportunities` (optional `?persist=1`)

## Purpose

Growth Intelligence turns collected intelligence into **evidence-backed pharmacy growth recommendations**. It answers:

- What should I improve first?
- What opportunities am I missing?
- Where should I start?

This is **not** an SEO audit. No SEO, authority, content, or visibility scores are produced in this phase.

## Core principle

**Never invent opportunities.** Every recommendation must be backed by one of:

| Source | Used for |
|--------|----------|
| Google Places | Reviews, photos, categories, rating, website link (via Local Market snapshot) |
| Business Profile | Enabled services, profile gaps |
| Generated Content | Content package manifest vs selected services |
| Search Console | Indexing summary when registry exists |
| Website Analysis | Placeholders only — no analysis yet |

If evidence does not exist, the recommendation is **not created**.

## Page sections

1. **Growth Overview** — counts by priority (High / Medium / Low). Information only, no scoring.
2. **Priority Opportunities** — highest-value actions first.
3. **Evidence** — full detail per opportunity: why, current vs comparison, action, outcome, confidence.
4. **Missing Content** — profile `selectedServices` vs generated content packages.
5. **Local Visibility** — Google Places comparisons only.
6. **Website Analysis** — “Available after website analysis” placeholders.
7. **Growth Roadmap** — High / Medium / Later buckets.
8. **Ready To Build** — recommended first campaign, reason, ecosystem estimate, link to Growth Plan.

## Opportunity model

Key files:

- `src/pharmacy/growthEngineOpportunityModel.ts` — types, normalization, dedupe, roadmap helpers
- `src/pharmacy/growthEngineOpportunityEngine.ts` — evidence mapping and report builder
- `src/pharmacy/growthEngineGrowthIntelligencePage.ts` — Step 3 HTML renderer

Fields: `title`, `category`, `priority`, `evidenceSource`, `evidenceSummary`, `currentValue`, `comparisonValue`, `recommendedAction`, `expectedBenefit`, `confidence`, `futureStatus`.

Confidence (`high` / `medium` / `low`) reflects evidence quality only.

## Locked systems

Do **not** modify:

- Business Profile Intelligence, generators, service/cluster/long-form pages
- Approval gates, registry, lifecycle, health audit, deployment
- Dashboard analytics
- **Local Market Intelligence** (read snapshot only)

## Validation

```bash
npx tsx scripts/validate-growth-engine-growth-intelligence-v1.ts
npx tsx scripts/validate-growth-engine-local-market-v1.ts
npx tsx scripts/validate-growth-engine-framework-v1.ts
```

## Workflow integration

Step 3 completion in the Growth Engine framework:

- **In progress** when opportunities exist or Local Market is complete
- **Complete** when the user acknowledges via “Mark as reviewed” (redirects to Growth Plan)

Persisted report (optional): `data/growth-engine/{slug}-opportunities.json`
