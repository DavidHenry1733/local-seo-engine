# Content Engine V1 — LOCKED

**Status:** LOCKED (CPR-PLATFORM-RECOVERY-02, 2026-08-04)  
**Scope:** Production service + cluster content generation  
**Rule:** Extend only. Do not replace, fork, or reintroduce quarantined legacy generators.

## Canonical production map

| Concern | Implementation |
|--------|----------------|
| Service Builder | `generateContentPackage` → `buildVisualExperiencePage` → `buildVisualServicePageMainHtml` → `buildPharmacyServicePageMainHtml` |
| Cluster Builder | `generateLocalLocationHierarchyPages` → `buildLocalClusterHubPageContent` → `composeCommercialClusterNarrativeV1` → `renderLocalClusterLocationPageHtml` |
| Narrative Planner | `pharmacyCommercialNarrativeEngineV1.ts` + `composeCommercialClusterNarrativeV1` |
| Section Planner | `resolveCommercialSectionPlanV1` (`pharmacyCommercialSectionPlannerV1.ts`) |
| Locality Engine | `pharmacyLocalityEngineV1.ts` (area resolver + local market + cluster intelligence) |
| Evidence Engine | `pharmacyServicePageIntelligence.ts` / `applyClusterIntelligence` |
| Duplicate Detection | `finalizeLocalClusterPageContent` + `scrubPublicLocalEngineTerms` |
| Service Renderer | `buildPharmacyServicePageMainHtml` |
| Cluster Renderer | `renderLocalClusterLocationPageHtml` |

Registry: `src/pharmacy/contentEngine/pharmacyContentEngineV1.ts`

## Quarantined (must not execute in production)

- `pharmacyServiceAreaPageGenerator.ts`
- `pharmacyLocalNarrativeEngine.ts`
- `pharmacyLocalWeavingV2.ts`
- `pharmacyLocalEntitySectionEngine.ts`
- `pharmacyAreaNarrativeIntelligence.ts`
- `pharmacyFirstPageSections.ts`
- `pharmacyFirstPageRecovery.ts`
- `pharmacyFirstLocalPagePolish.ts`
- `rc1ClusterPageOutputCorrectionService.ts`
- `pharmacyLocalLocationHubRenderer.renderLocalLocationClusterPage`

Offline scripts may set `ALLOW_LEGACY_CONTENT_ENGINE=1`.

## Public content rules

Generated pages must never expose: cluster, hub, page (as internal labels), location cluster, internal routing, template names, internal section IDs.

## Related locks

- `docs/platform/NARRATIVE-ENGINE-V1-LOCK.md`
- `docs/platform/RENDERER-V1-LOCK.md`
- `docs/platform/LOCAL-CONTENT-ENGINE-V1-LOCK.md`
