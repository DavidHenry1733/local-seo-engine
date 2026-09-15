# Growth Engine — Growth Cycle Manager V1 (Sprint 5)

**Status:** Complete  
**Sprint:** Sprint 5 — Growth Cycle Manager  
**Dashboard route:** `/api/growth-engine/dashboard?slug={tenant}`  
**JSON APIs:**
- `GET /api/growth-engine/:slug/cycles`
- `GET /api/growth-engine/:slug/cycle-memory`
- `GET /api/growth-engine/:slug/cycle-recommendation`
- `POST /api/growth-engine/:slug/cycle-recommendation/decision`
- `GET /api/growth-engine/:slug/launch-plan/:serviceId`

## Purpose

Transform PharmaConnect from a content generation platform into a **continuous pharmacy growth platform**.

The system thinks in **Growth Cycles**, not one-off campaigns:

Recommendation → Generation → Review → Approval → Launch → Monitoring → Completion → Next Recommendation

Every completed Growth Cycle becomes evidence for future recommendations.

## Architecture

### New modules (additive only)

| File | Role |
|------|------|
| `growthEngineCycleModel.ts` | Growth Cycle, stages, memory, launch plan types |
| `growthEngineCycleMemoryService.ts` | Permanent growth history (`{slug}-memory.json`, `{slug}-launch-plans.json`) |
| `growthEngineCycleManagerService.ts` | Cycle sync, timeline, journey view (`{slug}-cycles.json`) |
| `growthEngineLaunchManagerService.ts` | Adaptive launch plans (after generation + review + approval only) |
| `growthEngineCycleLearningEngine.ts` | Next recommendation considering previous cycles |
| `growthEngineGrowthJourneyDashboardPage.ts` | Growth Journey dashboard (Step 7) |

### Unchanged (locked)

- Business Profile Intelligence / Wizard  
- Generators / Content Engine  
- Growth Intelligence engine  
- Growth Plan engine  
- Approval gates, deployment, registry lifecycle  

Cycle Manager **reads** bridges and plan intelligence — never writes to locked modules.

## Growth Cycle model

Each cycle stores:

- Cycle number, recommended service, status, reason, evidence sources  
- Start / launch / completion dates, duration  
- Current stage + timestamped stage history (12 stages)  
- Generated / published / indexed asset counts  
- Ranking and review summaries  
- Lessons learned, next recommendation  

## Growth Timeline

Centrepiece of the Growth Dashboard:

1. Foundation steps (BI → Local Healthcare → Website → Growth Intelligence → Growth Plan)  
2. Growth Cycle 1, 2, 3… with status (Completed / In Progress / Recommended)  

## Launch Manager

Launch plan created **only when**:

1. Generation complete  
2. Content reviewed  
3. Quality approved  

### Adaptive launch logic

| Website profile | Typical duration | Rationale |
|-----------------|------------------|-----------|
| Small (&lt;8 pages analysed) | ~4 weeks | Large first ecosystem on small site — structured weekly publishing and monitoring |
| Established (8–25 pages) | ~3 weeks | Existing crawl history allows shorter staggered launch |
| Mature (25+ pages) | ~2 weeks | Long-established site — priority URLs first, structured monitoring |

Rationale explains **PharmaConnect publishing strategy** — not Google requirements.

Launch plan includes: publishing schedule, sitemap updates, Search Console plan, priority URL review, GBP/social/email schedules, progress reviews.

## Growth Memory

Permanent event log in `data/growth-engine/{slug}-memory.json`:

- Recommendations (created / accepted / rejected / postponed)  
- Generation, review, approval  
- Published pages, submitted URLs, indexed pages  
- Launch and cycle completion  

Nothing is forgotten.

## Learning Engine

`buildCycleAwareRecommendation()` reads Growth Plan Intelligence and:

- Skips completed services (unless expansion candidate)  
- Skips rejected services  
- Adds evidence from growth memory and previous cycles  
- Never asks "what would you like to generate?"  

## Growth Journey Dashboard

Sections:

1. Consultant message — "Based on everything we know about your pharmacy, we recommend…"  
2. **Growth Timeline** (centrepiece)  
3. Current Growth Cycle + stage progress  
4. Launch Plan (when eligible)  
5. Completed Growth Cycles + lessons learned  
6. Recommended Next Growth Cycle  
7. Monitoring (indexing / visibility from bridges)  
8. Monthly Growth Programme loop  

## Validation

```bash
npx tsx scripts/validate-growth-engine-cycle-manager-v1.ts
```

Regression:

```bash
npx tsx scripts/validate-growth-engine-framework-v1.ts
npx tsx scripts/validate-growth-engine-growth-plan-v1.ts
```

## Expected result

PharmaConnect behaves like an **AI Pharmacy Growth Consultant** managing an ongoing programme. The platform becomes more valuable the longer a pharmacy remains a customer because growth memory and learning accumulate with every cycle.
