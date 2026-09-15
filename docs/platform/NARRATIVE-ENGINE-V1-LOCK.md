# Narrative Engine V1 — LOCKED

**Status:** LOCKED (CPR-PLATFORM-RECOVERY-02, 2026-08-04)

## Single commercial narrative planner

- Module: `src/pharmacy/contentEngine/pharmacyCommercialNarrativeEngineV1.ts`
- Sequence: `COMMERCIAL_NARRATIVE_SEQUENCE_V1` (hero → definition → local → process → access → preparation → trust → FAQ → CTA)
- Service slots: `servicePageHeroIntro`, `servicePageProcessIntro`, `preferredServicePageCta`, `servicePageFaqEntries`, …
- Cluster composition: `composeCommercialClusterNarrativeV1` in `pharmacyLocalClusterContentEngine.ts`

## Pipeline (cluster)

1. Draft source (Pharmacy First intelligence OR variant families)
2. `applyClusterIntelligence` (evidence weaving)
3. `finalizeLocalClusterPageContent` (duplicate detection + public scrub)
4. Service-specific clean
5. Fingerprint

There is no Pharmacy First early-return bypass of the post-pipeline.

## Prohibited

- Parallel narrative planners for production generation
- Re-enabling legacy local narrative / weaving / area-intelligence injectors
- Generic town fallbacks that hardcode a different tenant's locality
