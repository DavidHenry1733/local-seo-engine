# Growth Engine — Growth Plan Intelligence V1 (Step 5)

**Status:** Complete  
**Sprint:** Sprint 4 — Growth Plan Intelligence  
**Route:** `/api/growth-engine/growth-plan?slug={tenant}`  
**JSON API:** `GET /api/growth-engine/:slug/growth-plan`

## Purpose

Growth Plan transforms Growth Intelligence into a **commercial action plan**.

It answers:

- What should we build first?
- Why?
- What impact will it have?

The engine recommends **one** priority campaign — not ten.

## Workflow position

| Step | ID | Title |
|------|-----|-------|
| 1 | business-intelligence | Business Intelligence |
| 2 | local-market | Local Healthcare Intelligence |
| 3 | website-intelligence | Website Intelligence |
| 4 | growth-intelligence | Growth Intelligence |
| 5 | **growth-plan** | **Growth Plan** |
| 6 | generate | Generate Ecosystem |
| 7 | dashboard | Growth Dashboard |

## Page sections

1. **Executive Summary** — current position, primary opportunity, why recommended, estimated business benefit  
2. **Recommended Campaign** — name, priority, reason, confidence, evidence sources  
3. **Why This Campaign?** — evidence list from genuine findings only  
4. **What Will Be Built?** — output estimates from benchmark generator configuration  
5. **Estimated Outcome** — business outcomes only (no ranking predictions)  
6. **Alternative Campaigns** — up to three alternatives with why not first  
7. **Campaign Readiness** — prerequisite checklist  
8. **Generate Campaign** — primary CTA to existing content package generator  

## Evidence sources

Every recommendation must be evidence-backed from:

- Business Profile  
- Website Intelligence  
- Local Healthcare Intelligence  
- Growth Intelligence  
- Generated Content  
- Search Console (when available)  

Never invented evidence.

## Campaign rules

Only recommend campaigns that:

- Exist in the Business Profile (`selectedServices`)  
- Exist in the benchmark generator (`BENCHMARK_MASTER_SERVICE_IDS`)  
- Are supported by evidence beyond profile enablement alone  

Never recommend disabled services or campaigns without evidence.

## Key files

| File | Role |
|------|------|
| `growthEngineCampaignModel.ts` | Campaign types and generator output constants |
| `growthEngineCampaignRecommendationEngine.ts` | Evidence-backed selection, alternatives, readiness |
| `growthEngineGrowthPlanPage.ts` | Step 5 page renderer (8 sections) |
| `growthEngineFrameworkService.ts` | Maps intelligence to legacy plan for Generate step |

## Output estimation

Counts come from `benchmarkServiceEcosystemBuilder` configuration:

- 1 service page  
- N cluster pages (selected areas, max 12)  
- 1 patient guide  
- 3 blogs  
- 1 FAQ page  
- 20 social posts  
- 10 GBP posts  
- 5 emails  
- 1 video script  
- 1 landing page  

## Validation

```bash
npx tsx scripts/validate-growth-engine-growth-plan-v1.ts
```

## Unchanged modules

This sprint does **not** modify:

- Business Profile Intelligence / Wizard  
- Generators (Long Form, Service Pages, Cluster Pages)  
- Growth Intelligence engine  
- Local Healthcare Intelligence  
- Website Intelligence  
- Approval Gates, Deployment, Registry, Lifecycle, Health Audit, Dashboard Analytics  

Generation uses the existing content package engine via `growthEngineContentPackageUrl`.
