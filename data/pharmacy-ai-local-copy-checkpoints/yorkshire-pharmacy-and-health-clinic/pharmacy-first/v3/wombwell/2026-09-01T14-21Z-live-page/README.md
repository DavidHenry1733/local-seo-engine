# README — 2026-09-01T14-21Z Wombwell v3 live local page

Isolated Wombwell Pharmacy First v3 candidate. Not approved. Not published. No commit.

## What this is

One live local Preview page for Wombwell, generated with the existing OpenAI adapter, v3 structure and Headingley renderer. Darfield, campaign builder, Review Centre, approvals and the on-disk editorial pack were not changed.

Authenticated Preview (serves this new copy):

https://app.pharmaconnect.uk/api/growth-engine/yorkshire-pharmacy-and-health-clinic/review-preview?campaign=pharmacy-first&asset=ai-local-area-page-pilot-v3&area=wombwell

## Retrieval

1. Reused the saved Barnsley Council Wombwell Library body (2026-09-01T11:22:31Z). That body is not a bare place name: it states local history sessions run by Wombwell Heritage Group, and Citizens Advice drop-in sessions.
2. Two geographically disambiguated DataForSEO searches ($0.002 each) for official heritage/history and Wombwell Park.
3. Four new page fetches (cap):
   - barnsley.gov.uk car-park news (usable body; village identity omitted — the page talks about Barnsley's towns and villages generally)
   - Companies House officers page (not used for copy)
   - Travel South Yorkshire “Artwork at Wombwell Station” (used)
   - Historic England NHLE search for Wombwell (403 / “Just a moment…” — unusable, same class of block as the earlier Barnsley hub)
4. Undated ward-profile statistics and South Area Council padding were not used. No colliery/mining fact was accepted, because no official usable heritage body supported it.

## Writing

- Task id: `wombwell-v3-live-page-2026-09-01`
- One draft + one corrective retry. Durable budget was not reset.
- Attempt 1 failed (convenience claim + invented “familiar landmarks”).
- Attempt 2 had no FAIL. Two REVIEW REQUIRED leftover-token findings were resolved against source passages in `review/review-decisions.json`. Prose was not edited. No word list was added.
- Hero is service-led. Local account is in the renderer heading “Why Wombwell patients start with the pharmacist”. Pharmacy premises remain Darfield.

## Reproduction

From the workspace root, with DataForSEO and OpenAI already configured in the process environment (do not copy secrets into this folder):

1. Extract facts from saved library and Travel South Yorkshire bodies using `extractEditorialFactDrafts` in `source/pharmacyLocalEditorialEvidenceContractV3.ts`.
2. Merge those facts in memory with the on-disk pack. Do not write the pack file.
3. Call `generateAiLocalCopyPilotV3` once with `authorizedTaskId=wombwell-v3-live-page-2026-09-01`, `maxAttempts=2`, `maxProviderCalls=2`, `writeRecord` only after operator review.
4. If automated validation has reviews and no failures, record source-passage decisions. Do not silently rewrite the model output.
5. Assemble only `["wombwell"]` via `assemblePharmacyAiLocalPagePilotsV3`. `preserveAuthoredLocalCopy` still splits `%%CONSULTATION%%` markers so renderer-owned clinical sections render; it does not rewrite the authored overlay.
6. Run `npx tsx src/pharmacy/contentEngine/validatePharmacyAiLocalEditorialEvidencePilotV3.ts`, API build, `git diff --check`.
7. Preview reads the assembled HTML from disk. Restart the Growth Engine only if `/health` is not JSON `{status:"ok"}`.

## Cost

- DataForSEO: $0.004 (2 searches)
- OpenAI: $0.02599 (2 calls; 7083 prompt + 1478 completion tokens combined)
- Combined: $0.02999 of the $1 cap

## Tests

Focused tests PASS 110/110. API build PASS. `git diff --check` PASS. Authenticated local and public Preview 200, new copy, no South Area Council, no marker leak, no desktop/mobile overflow. No screenshots.

AWAITING PRODUCT OWNER VISUAL REVIEW.
