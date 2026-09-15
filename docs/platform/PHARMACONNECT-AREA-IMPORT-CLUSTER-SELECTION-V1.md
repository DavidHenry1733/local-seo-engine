# PharmaConnect Area Import & Cluster Selection V1

Automates pharmacy service area selection using the existing Local SEO Engine area/cluster logic. This sprint adds discovery, ranking, selection and storage only — no local cluster pages are generated.

## SEO Engine logic reused

| Component | Location | Role |
|-----------|----------|------|
| `loadCityAreaData()` | `src/area/loadCityAreaData.ts` | Loads rich format (`src/area/areaData`) or simple format (`config/areas`) |
| `rankAreasFromCityData()` | `src/area/areaEngine.ts` | Scores and ranks areas by demand × competition × affluence × priority |
| `discoverPharmacyAreas()` | `src/pharmacy/pharmacyAreaDiscoveryService.ts` | Pharmacy-facing wrapper returning `ProfileAreaEntry[]` |
| Rotherham data | `config/areas/rotherham.json` | 10 priority-ranked local areas |

Scoring follows the Local SEO Engine composite model (100 pts max): search demand (30), competition opportunity (20), affluence (25), manual priority (25).

## User flow

1. Open **Profile Dashboard** → **Local Areas & Target Locations**
2. Enter **Main Town / City** (e.g. Rotherham)
3. Choose **Number of suggested areas** (5, 10, 15, 20, or 30)
4. Click **Generate Suggested Areas**
5. Review checklist — each area shows name, type, priority, confidence, source
6. Tick/untick areas, reorder with ↑/↓, remove with ×
7. Add manual areas via **Add area**
8. **Save Profile** — selected areas persist to `data/pharmacy-profiles/{slug}.json`

Campaign creation uses profile selected areas by default.

## Profile fields

Stored in `data/pharmacy-profiles/{slug}.json` (schema v4):

| Field | Type | Purpose |
|-------|------|---------|
| `primaryTown` | string | Main town/city for discovery |
| `primaryCity` | string | Normalised city name |
| `selectedAreas` | `ProfileAreaEntry[]` | Full area list with selection state |
| `manualAreas` | string[] | Manually added area names |
| `coverageAreas` | string[] | Selected + manual (legacy consumer compat) |
| `rankingAreas` | string[] | Selected area names (existing consumers) |
| `nearbyAreas` | string[] | All suggested + manual names |
| `areaDiscoverySource` | string | e.g. `local-seo-engine-area-engine` |
| `areaDiscoveryUpdatedAt` | ISO string | Last generation timestamp |

`ProfileAreaEntry` shape: `{ areaName, areaType, priority, order, selected, source, confidence?, score?, tier?, postcode? }`

## Campaign integration

Campaign store (`data/pharmacy-campaigns/{slug}.json`) saves:

```json
{
  "areaSource": "profile",
  "campaignAreas": [
    { "areaName": "Wickersley", "selected": true, "source": "engine", "priority": 1 }
  ]
}
```

- **Default:** `areaSource: "profile"` — uses profile selected areas
- **Optional:** `areaSource: "custom"` with explicit `campaignAreas` array

Campaign wizard step 4 shows profile target areas and area source selection.

## API endpoints

| Method | Path | Purpose |
|--------|------|---------|
| `POST` | `/api/pharmacy/profile/:slug/discover-areas` | `{ town, limit, preserveSelection? }` |
| `POST` | `/api/pharmacy/profile/:slug/save-areas` | Persist selected/manual areas |
| `POST` | `/api/pharmacy/profile/:slug` | Full profile save (includes area fields) |
| `POST` | `/api/pharmacy-campaigns/:slug/create` | `{ serviceId, campaignGoal, areaSource?, campaignAreas? }` |

## Validation

```bash
npx tsx scripts/validate-pharmacy-area-import-cluster-selection-v1.ts pharmaconnect
# Result: 29/29 PASS
```

Checks:

- Main town/city saves to profile
- Rotherham discovery returns ranked areas
- Area limit respected (5 and 10 tested)
- Profile stores `selectedAreas`, `coverageAreas`, `rankingAreas`, `nearbyAreas`
- Manual area merge works
- Campaign creation includes `campaignAreas` from profile
- No local cluster page generation
- No service master modifications
- Legacy comma-separated coverage UI removed (additive section only)

## Next phase: local cluster page generation

V2 will consume `campaignAreas` and `selectedAreas` to generate local service cluster pages per area, wired through the existing Local SEO Engine cluster config builder (`buildClusterConfigs`) without duplicating area intelligence.
