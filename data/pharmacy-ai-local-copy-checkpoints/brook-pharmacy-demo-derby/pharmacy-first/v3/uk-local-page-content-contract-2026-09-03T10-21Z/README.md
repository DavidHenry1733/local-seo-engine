# UK local-page content contract v1 — checkpoint

Continues from `one-local-page-evidence-prep-2026-09-03T09-46Z`.
Status: preview-only, not published. No paid calls, generation, approval or commit.

## What this step did

Connected one versioned UK local-page content contract to the existing evidence planner and V3 AI writer. Allestree is the first acceptance case. The same roles apply to other pharmacies and areas; there is no Allestree-only generator.

## Discoverable contract

- Source: `src/pharmacy/contentEngine/pharmacyUkLocalPageContentContractV1.ts`
- Artifact: `data/pharmacy-uk-local-page-content-contracts/v1/uk-local-page-content-contract.json`

## Required vs optional

Required factual foundations:

- Canonical pharmacy identity, premises and contact (profile; $0).
- Verified local GP practices in or around the area (Places Text Search Pro for GP practices + DataForSEO official NHS/GP search + dated page body).
- Location and access: canonical pharmacy coordinates + a recorded area reference point + one labelled approximate straight-line distance. If the area reference is missing, one Places locality search is required. The displayed demo postal address / DA5 postcode must not be the origin and is not marked verified.
- Renderer-owned clinical content (not an AI supplemental field).

Optional enrichment:

- Recognisable local context: one official-locality search and page body. Two or three useful sourced details when they exist; no forced minimum.
- Optional local questions: only useful supported questions not answered elsewhere. Omission must not produce filler. No extra paid search.

Not searched unless a content role requires them: schools, community inventories, landmarks, retail, transport. Places names/categories and search snippets are not descriptive evidence.

## Revised Allestree research plan

Previous plan (preserved): `data/pharmacy-local-page-evidence-plans/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.before-uk-content-contract-v1.json` — 12 calls, **$0.198**.

Current plan: `data/pharmacy-local-page-evidence-plans/brook-pharmacy-demo-derby/pharmacy-first/v1/allestree.json`

| Call | Provider | Required | Est. USD | Cache |
|---|---|---|---|---|
| GP practices text search | Places `searchText` Pro field mask | yes | 0.032 | none |
| Area reference point | Places `searchText` Pro | yes (centroid missing) | 0.032 | none |
| Official GP/NHS sources | DataForSEO organic live advanced | yes | 0.002 | none |
| Descriptive locality | DataForSEO organic live advanced | yes (single attempt) | 0.002 | none |
| GP official page body | safe HTML fetch | yes | 0 | after search |
| Locality page body | safe HTML fetch | yes | 0 | after search |
| Straight-line distance | local haversine | yes | 0 | blocked until area reference exists |

**Required paid estimate: $0.068.** Optional extra searches: none proposed ($0.000).

Cost basis:

- Places: configured endpoint `https://places.googleapis.com/v1/places:searchText` with Pro fields (`displayName`, `formattedAddress`, `types`, `location`, `addressComponents`, `googleMapsUri`). Public list price Text Search Pro $32/1,000 = $0.032 after the published 5,000 monthly free Pro requests. **This project’s remaining free quota and billed Cloud SKU are unverified** (no billing API or test call).
- DataForSEO: configured endpoint `https://api.dataforseo.com/v3/serp/google/organic/live/advanced`. Estimate uses this project’s recorded live task cost **$0.002/search**. Current public list price was not independently fetched.
- The previous $0.198 figure assumed six Places category searches and is not the current plan.

## Remaining blocker

Allestree has no saved Places pack, no editorial pack, and no recorded area reference point. Paid collection remains disabled until explicitly authorised. Generate remains disabled. Fixtures do not prove UK-wide reliability.

## Tests

- `scripts/validate-uk-local-page-content-contract-v1.ts` — 13/13 (two pharmacies, two areas)
- `scripts/validate-brook-derby-allestree-local-page-ui-v1.ts` — 33/33
- `git diff --check` — clean

## Browser

Authenticated Target Areas for Brook Derby / pharmacy-first. Evidence panel shows contract v1, targeted GP/locality/distance calls, about $0.068, demo map-pin warning, Start paid collection disabled, Generate disabled. Save preparation plan was clicked. Generate and Start paid collection were not pressed.

## Next authorised run

URL: `https://app.pharmaconnect.uk/api/growth-engine/campaign-builder?slug=brook-pharmacy-demo-derby&step=areas&campaign=pharmacy-first`

Clicks after explicit authorisation:

1. Target Areas (already the working step).
2. Review the Evidence preparation — Allestree table (required vs optional, $0.068, cache none).
3. Tick “I have reviewed the providers, proposed calls and estimated cost…”.
4. Save preparation plan (not a paid call).
5. Only after a later change that authorises collection: Start paid collection.
6. Do not press Generate until local + editorial evidence is READY.

Do not use Rotherham/Brook live content for this Derby demo. No service-page changes.

## Rollback

Restore files from `source/`. Keep or revert `allestree.json` using `plans/allestree.before.json`. Do not delete Yorkshire packs or Brook outputs.
