# Allestree evidence quality — checkpoint

Continues from `user-authorised-evidence-collection-2026-09-03T10-57Z`.
Status: preview-only, not published. No generation, approval, publication or commit.

## Demonstrated cause

The first UI collection (`runId` `c7a7c587-22f0-474a-a59a-745a5bbe34a3`, **$0.068**, 4 paid calls) did retrieve useful evidence. It was then discarded:

1. **Places GPs existed** — Park Farm Medical Centre, Park Farm Surgery and Park Lane Surgery were returned for `NHS GP surgery medical practice in Allestree, Derby, Derbyshire, UK`. All five hits were rejected as `incompatible-postcode` because the unverified demo postal **DA5** was compared with entity **DE22** before area-in-address / sublocality checks, and the recorded Allestree centroid was not used when re-validating the pack.
2. **The missing identity fact** was an **area-identity** fact from an authoritative web source (intro requires `identity >= 1` and `webPrimary >= 1`). The Derby City Council neighbourhood-ward page was fetched. The extractor only accepted `"{area} is a suburb/ward of {parent}"` in the body, so the official title `Allestree neighbourhood ward - Derby City Council` produced nothing. Wikipedia was correctly rejected; no fresh URL was required.
3. NHS Park Lane was already extracted as a healthcare fact. `verifiedGpPracticeCount` used Places-attributed count only (0), so findings said zero GPs.

Saved material was enough. No fresh paid query or URL was required.

## Fix (reusable collection path)

- Do not veto `incompatible-postcode` when the pharmacy postcode is unverified, or when the entity already names the requested area (including `sublocality` components).
- Merge the recorded area-reference centroid into pack assembly and pack validation.
- Extract a generic `.gov.uk` title identity: `{area} is a neighbourhood ward in {authority}`.
- Skip provider-named `Dr …` hits; cap verified GPs at 3; count Places and official NHS practice facts.
- Reprocess saved hits/pages without paid calls; preserve `runId`, spend, calls, SERPs and bodies.
- UI shows executed calls, `$0.068`, and `Collection finished. Evidence is READY. 3 verified GP practice(s).` — not “request accepted” or a stale “not executed” total.

## Reprocessed findings

- 3 verified GPs: Park Farm Medical Centre, Park Farm Surgery, Park Lane Surgery.
- Identity: `Allestree is a neighbourhood ward in Derby.`
- Sufficiency: **READY**. Spend still **$0.068**. OpenAI not charged.
- Generate is enabled and was **not** pressed.

## Tests

- `scripts/validate-allestree-evidence-quality-from-saved-run-v1.ts` — 15/15
- `scripts/validate-local-page-evidence-authorised-collection-v1.ts` — 14/14
- `scripts/validate-brook-derby-allestree-local-page-ui-v1.ts` — 35/35
- `src/pharmacy/contentEngine/validateLocalEvidenceGeographicDisambiguationV1.ts` — 19/19
