# Business Profile Intelligence V2 — Phase 3C (Cluster Page Integration)

**Status:** Local cluster pages only — service pages, long-form, and dashboard unchanged.

---

## What Phase 3C adds

Cluster page content (`buildLocalClusterPageContent`) applies `BusinessProfileIntelligence` when `ContentGenerationContext` is present (already passed from the ecosystem builder).

### New / updated modules

| Path | Role |
|------|------|
| `src/pharmacy/pharmacyLocalClusterIntelligence.ts` | Cluster enrichment + FAQ merge |
| `src/pharmacy/pharmacyLocalClusterContentEngine.ts` | Calls `applyClusterIntelligence()` after variant families |
| `src/pharmacy/pharmacyLocalClusterPageRenderer.ts` | Trust cards, CTA, BPI marker on `<body>` |

### Sections enriched

| Cluster section | Intelligence used |
|-----------------|-------------------|
| Hero intro | Tagline, business description, team phrasing, consultation room, walk-in |
| Local relevance / why checks | Pricing, results process |
| Process intro & steps | Consultation room, length, walk-in, equipment |
| Access / clinical environment | Parking, wheelchair, languages, preparation |
| Trust body & trust cards | Years serving, awards, review highlights, prescriber |
| FAQs | Profile-backed booking, parking, walk-in, languages, pricing |
| CTA | Preferred CTA wording, booking intelligence |

---

## Guardrails

- Profile-first with legacy variant-family fallbacks when intelligence fields are empty.
- Area-specific copy preserved (`areaName` remains in hero, FAQs, nearby links).
- Service page and supporting content links unchanged.
- Layout, styling, schema, and approval gates unchanged.

---

## Validation

```bash
npx tsx scripts/validate-business-profile-intelligence-v2-phase3c-cluster-page-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-phase3b-service-page-v1.ts
npx tsx scripts/validate-business-profile-intelligence-v2-phase3a-long-form-v1.ts
npx tsx scripts/validate-pharmacy-long-form-supporting-content-quality-v1.ts
npx tsx scripts/validate-content-engine-contract-v1.ts
```

---

## Explicit non-goals (Phase 3C)

- ❌ Service page renderer changes
- ❌ Long-form engine changes
- ❌ Dashboard / profile schema

See also: [Phase 3B](./BUSINESS-PROFILE-INTELLIGENCE-V2-PHASE-3B.md)
