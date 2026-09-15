# FAILURE — service-to-local Wombwell workflow was not proved

This checkpoint records a controlled generation that did **not** produce a stronger live candidate.

The live Preview still serves the **14:21** Wombwell page. That URL does **not** serve the new drafts.

No approval, promotion, publication, deployment or commit.

## What was attempted

Approved master clinical content (`PHARMACY_FIRST_LOCKED_CLINICAL_FACTS_V1`) + existing Headingley local template + one coherent writing brief + reused Wombwell evidence, through the existing v3 OpenAI adapter.

One Pharmacy First / Wombwell candidate only. Yorkshire identity and the current main page were not rewritten.

Source-based decisions for every REVIEW REQUIRED finding are in `review/review-decisions.json`. Rejects were not converted to PASS. Isolated rendering was not performed.

## Why it failed / exact blocker

Draft 1 wrote connected prose but invented local character, resident habits, GP-skip and a nearby-Darfield journey. Those are unresolved clinical/factual failures.

Draft 2 forced almost every supplied fact back into a catalogue, restated clinical process, named Darfield in too many fields, and added unsupported “active community spaces” and Medical Centre “routes to healthcare”. Blocking FAIL: premises locality repeated across local context and access fields.

Neither draft is genuinely better than the 14:21 candidate. Copy was not hand-written. HTML was not assembled.

## Retrieval

Zero new retrievals (cap four). Saved bodies already had descriptive locality material:

- barnsley.gov.uk Wombwell Library, 2026-09-01T11:22:31Z
- Travel South Yorkshire station artwork, 2026-09-01T14:18:05Z
- National Rail Wombwell station, 2026-09-01T06:07:51Z (on-disk pack)

Undated ward statistics and mining history were omitted.

## Reproduction

Do not call OpenAI again for this task id (`wombwell-v3-service-to-local-2026-09-01`); the durable budget is consumed (2/2).

To inspect:

1. Read `review/review-decisions.json` and both files in `attempts/`.
2. Compare with kept copy in `copy/wombwell-kept-14-21.json`.
3. Focused tests: `npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalEditorialEvidencePilotV3.ts`

To regenerate later, use a **new** `authorizedTaskId`. Do not reset `wombwell-v3-live-page-2026-09-01.json`.
