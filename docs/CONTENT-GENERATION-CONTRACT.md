# Content Generation Contract v1.0.0

## Required fields

| Field | Description |
|-------|-------------|
| `slug` / `resolvedSlug` | Tenant identifier |
| `serviceId` / `serviceName` | Service being generated |
| `profile.pharmacyName` | Business name — **no Brook/pharmaconnect fallbacks** |
| `profile.phone` | Primary contact phone |
| `masterLibrary.sections` | Parsed master library content |
| `masterLibrary.ownerVariables` | Token replacement map |
| `selectedAreas` | Local cluster areas |
| `localArea` | Primary town/area for service page |
| `tokens.pharmacy` | Canonical pharmacy token |

## Optional fields

| Field | Description |
|-------|-------------|
| `profile.bookingUrl` | Online booking link |
| `reviewer.photoUrl` | Reviewer image |
| `map.resolvedEmbedUrl` | Business map embed |
| `variantPack` | Service FAQ/copy variants |
| `images.assignmentPath` | Image assignment JSON path |

## Validation

`validateContentGenerationContext(ctx)` returns `{ ok, errors, warnings, missingRequired }`.

Context build **throws** if:

- Profile not found
- Pharmacy name missing
- Master library file missing
- Required validation fails

## Generator runtime report

Each generator should call `createGeneratorRuntimeReport(generatorId, ctx)` and record:

- `receivedContext`
- `tenantValidation` / `serviceValidation` / `brandValidation`
- `linksValidation` / `imageValidation`

## Token rules

- Use `applyContextTokens(text, ctx)` — never `injectOwnerVariables` with self-loaded profile data
- Unresolved `{{token}}` patterns fail validation

## Upgrade path

| Version | Change |
|---------|--------|
| 1.0.0 | Initial unified context; ecosystem builder context-only |
| 1.1.0 | Planned: legacy blueprint JSON stack fully migrated |
| 2.0.0 | Planned: multi-vertical context builders sharing contract |

## Extension

Add new fields to `ContentGenerationContext` and document them here. Generators must not add parallel context objects.
