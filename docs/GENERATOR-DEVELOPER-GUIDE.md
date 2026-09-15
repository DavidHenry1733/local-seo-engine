# Generator Developer Guide

## Rule 1: Context only

Every generator accepts `ContentGenerationContext` as its tenant/service input.

```typescript
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";

export function generateMyAsset(ctx: ContentGenerationContext): MyAsset {
  const { profile, serviceName, cta, masterLibrary } = ctx;
  // ...
}
```

## Rule 2: No internal loading

**Do not** call inside generators:

- `loadPharmacyProfile`
- `buildPharmacyServicePageProfile` (except legacy fallback being removed)
- `loadImageAssignments`
- `getServicePublishMeta` + master parse (use `ctx.masterLibrary`)

## Rule 3: Token replacement

```typescript
import { applyContextTokens } from "./contentEngine/contentEngineTokens.ts";

const body = applyContextTokens(masterSection.bodyMarkdown, ctx);
```

## Rule 4: Satellite enrichment

For social, email, GBP, blog, guide:

```typescript
import { enrichSatelliteText } from "./contentEngine/contentEngineAssetEnricher.ts";

const post = enrichSatelliteText(rawText, ctx, "social");
```

## Rule 5: Runtime reporting

```typescript
import { createGeneratorRuntimeReport } from "./contentEngine/contentEngineContract.ts";

const report = createGeneratorRuntimeReport("my-generator", ctx);
```

## Orchestrator pattern

```typescript
const ctx = buildContentGenerationContext(slug, serviceId);
buildBenchmarkServiceEcosystem(ctx);
// pass ctx to other generators
```

## Adding a new generator

1. Accept `ContentGenerationContext`
2. Use `applyContextTokens` / `enrichSatelliteText`
3. Register in validation script `GENERATOR_FILES`
4. Add runtime report to generation output
5. Document supported assets in `CONTENT-ENGINE-ARCHITECTURE.md`

## Validation before merge

```bash
npx tsx scripts/validate-content-engine-contract-v1.ts
```
