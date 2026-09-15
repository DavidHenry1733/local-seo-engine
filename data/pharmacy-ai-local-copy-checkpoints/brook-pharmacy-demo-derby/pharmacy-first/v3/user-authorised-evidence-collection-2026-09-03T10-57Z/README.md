# User-authorised evidence collection — checkpoint

Continues from `uk-local-page-content-contract-2026-09-03T10-21Z`.
Status: preview-only, not published. No live paid calls, generation, approval or commit.

## What this step did

Finished the existing evidence-preparation workflow. The Target Areas Start paid collection button now starts collection only after authenticated, tenant-scoped authorisation of the exact saved plan plus an evidence-only spending cap. The blanket `EVIDENCE_PREP_PAID_AUTHORISED` flag remains false. Evidence spend is stored separately from the OpenAI generation budget.

## Persistence

- Authorisation: `data/pharmacy-local-page-evidence-authorisations/{slug}/{serviceId}/v1/{areaSlug}.json`
- Run: `data/pharmacy-local-page-evidence-runs/{slug}/{serviceId}/v1/{areaSlug}.json`
- Evidence budget: `data/pharmacy-local-page-evidence-budget/{slug}/{serviceId}/v1/{areaSlug}.json`
- Recorded area reference: `data/pharmacy-local-page-evidence-area-reference/{slug}/{areaSlug}.json`

No live Allestree packs or authorisation records were written during this task. Tests used fixture adapters and a temporary storage root.

## Server rules

- Authorise the exact plan fingerprint and a positive evidence-only cap.
- Before each paid call, reserve a safe cost bound against remaining cap.
- Places bound: public list $0.032. DataForSEO bound: recorded live $0.002.
- If a bound is unavailable or cost/outcome is uncertain, stop before retrying.
- Double-submit, reload and resume skip consumed calls and do not reset spend.
- Zero verified GP practices is a valid research outcome when locality and access evidence is adequate.
- `POST .../local-page-evidence-plan` with `execute: true` remains 403.

## Tests

- `scripts/validate-local-page-evidence-authorised-collection-v1.ts` — 14/14 (success, insufficient budget, duplicate, interrupted resume, cross-tenant, zero GP)
- `scripts/validate-brook-derby-allestree-local-page-ui-v1.ts` — 34/34
- `scripts/validate-uk-local-page-content-contract-v1.ts` — 13/13
- `git diff --check` — clean

## Browser

Authenticated Target Areas for Brook Derby / pharmacy-first.

Clicks this session:

1. Target Areas (already the working step).
2. Reviewed Evidence preparation — Allestree (providers, calls, $0.068, pricing uncertainty).
3. Save preparation plan.
4. Did **not** tick the authorise checkbox, enter a cap, press Authorise this plan, Start paid collection, or Generate.

Start paid collection remained disabled. Generate remained disabled. Ten Derby areas remained selected.

## Remaining blockers

Allestree still has no saved Places pack, no editorial pack, and no recorded area reference. Collection is wired but not live-authorised. Generate stays disabled until stored evidence is READY. Fixtures do not prove UK-wide provider reliability or remaining Google free-quota.

## Next authorised run

URL: `https://app.pharmaconnect.uk/api/growth-engine/campaign-builder?slug=brook-pharmacy-demo-derby&step=areas&campaign=pharmacy-first`

Clicks after explicit spend authorisation:

1. Target Areas.
2. Review the Evidence preparation table.
3. Tick the review checkbox (still not spend authorisation).
4. Enter an evidence-only spending cap.
5. Tick “I authorise this exact evidence plan…”.
6. Authorise this plan.
7. Start paid collection.
8. Do not press Generate until local + editorial evidence is READY.
