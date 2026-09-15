# Content Engine Architecture

## Overview

PharmaConnect generates every marketing and service asset from **one unified `ContentGenerationContext`**. Generators do not load profiles, brands, services, or images independently.

```
Profile + Service + Master Library + Images
              │
              ▼
   buildContentGenerationContext()
              │
              ▼
     ContentGenerationContext
              │
    ┌─────────┼─────────┬─────────┬─────────┐
    ▼         ▼         ▼         ▼         ▼
 Service   Local     Blog/     Social/    Email/
  Page    Cluster    Guide     GBP       Video
```

## Contract version

Current: **1.0.0** (`CONTENT_ENGINE_CONTRACT_VERSION`)

## Single loader rule

Only `src/pharmacy/contentEngine/buildContentGenerationContext.ts` may:

- Call `loadPharmacyProfile`
- Load image assignments
- Parse master library markdown
- Build owner-variable token maps
- Resolve map embed URLs

## Orchestrator

`pharmacyContentPackageService.ts` builds context once per package generation and passes it to all generators.

## Generator modules

| Asset | Generator | Input |
|-------|-----------|-------|
| Service page (master) | `pharmacyMasterPublishRenderer` | `MasterPublishInput.contentContext` |
| Visual service page | `pharmacyVisualExperience` | Profile from orchestrator path |
| Local cluster | `pharmacyLocalClusterPageRenderer` | `LocalClusterPageInput.contentContext` |
| FAQ / Guide / Blog | `benchmarkServiceEcosystemBuilder` | `ContentGenerationContext` |
| Social / GBP / Email / Video | `benchmarkServiceEcosystemBuilder` | `ContentGenerationContext` + enricher |

## Satellite asset enrichment

Blog, guide, social, GBP, and email packs pass through `contentEngineAssetEnricher.ts` to ensure every asset mentions:

- Correct pharmacy name
- Phone / CTA
- Service name
- Reviewer (guides/blogs)

## Future verticals

The `vertical` field on context supports pharmacy, dentist, optician, solicitor, etc. Generators remain vertical-agnostic; only the context builder changes per sector.

## Validation

Run: `npx tsx scripts/validate-content-engine-contract-v1.ts`
