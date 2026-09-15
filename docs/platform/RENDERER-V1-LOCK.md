# Renderer V1 — LOCKED

**Status:** LOCKED (CPR-PLATFORM-RECOVERY-02, 2026-08-04)

## Canonical renderers

| Page type | Function | Module |
|-----------|----------|--------|
| Service page | `buildPharmacyServicePageMainHtml` | `pharmacyVisualExperienceLayoutV3.ts` |
| Service page entry | `buildVisualServicePageMainHtml` | `pharmacyVisualServicePageRenderer.ts` |
| Cluster page | `renderLocalClusterLocationPageHtml` | `pharmacyLocalClusterLocationPageRenderer.ts` |
| Cluster full page | `renderLocalLocationClusterFullPage` | `pharmacyLocalHierarchyFullPageRenderer.ts` |
| Hub page | `renderLocalHubPageHtml` | `pharmacyLocalHubPageRenderer.ts` |

## Quarantined renderer

- `renderLocalLocationClusterPage` in `pharmacyLocalLocationHubRenderer.ts`

## Prohibited

- Forking service or cluster HTML assembly outside the locked renderers
- Reintroducing Pharmacy First section/recovery renderers into production
- Exposing internal template / section IDs in public copy
