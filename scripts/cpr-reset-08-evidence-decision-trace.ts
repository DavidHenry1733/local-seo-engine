#!/usr/bin/env npx tsx
/**
 * CPR-RESET-08 — Read-only Product Owner evidence decision trace.
 */
import { buildServicePageEvidenceReview, traceServicePageEvidenceFieldDecisions } from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import { readProductOwnerEvidenceDecisionStore } from "../src/pharmacy/masterAdminServicePageEvidenceDecisionService.ts";

const SLUG = process.argv[2] || "welfare-pharmacy";
const FIELD_IDS = [
  "nhsPrivateStatus",
  "pricing",
  "teamReviewer",
  "yearsServing",
  "languages",
  "accreditations",
  "accessibility",
  "parkingTransport",
];

function main() {
  const store = readProductOwnerEvidenceDecisionStore(SLUG);
  const review = buildServicePageEvidenceReview(SLUG);
  const trace = traceServicePageEvidenceFieldDecisions(SLUG, FIELD_IDS);

  console.log(
    JSON.stringify(
      {
        slug: SLUG,
        existingPersistedDecisionCount: Object.keys(store.decisions).length,
        existingPersistedFieldIds: Object.keys(store.decisions),
        evidenceReviewRevision: store.evidenceReviewRevision,
        canApprove: review?.canApprove ?? false,
        blockers: review?.blockers ?? [],
        fields: trace.restored,
      },
      null,
      2,
    ),
  );
}

main();
