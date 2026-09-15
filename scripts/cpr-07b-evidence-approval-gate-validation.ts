#!/usr/bin/env npx tsx
/**
 * CPR-07B — Evidence Review approval gate validation.
 */
import { buildServicePageEvidenceReview } from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";

const SLUG = process.argv[2] || "cpa01r-clean-journey-pharmacy";

function main() {
  const review = buildServicePageEvidenceReview(SLUG);
  if (!review) {
    console.log(JSON.stringify({ ok: false, error: "review_unavailable" }, null, 2));
    process.exit(1);
  }

  const fields = review.sections.flatMap((section) => section.fields);
  const trace = fields.map((field) => {
    const blocking = !(field.status === "confirmed" || field.status === "not_applicable");
    return {
      field: field.id,
      required: Boolean(field.required),
      status: field.status,
      blockingApproval: blocking ? "YES" : "NO",
    };
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        slug: SLUG,
        canApprove: review.canApprove,
        approved: review.approved,
        blockers: review.blockers,
        sections: review.sections.map((s) => ({
          id: s.id,
          ready: s.ready,
          confirmed: s.confirmedCount,
          total: s.totalCount,
        })),
        trace,
      },
      null,
      2,
    ),
  );

  process.exit(review.canApprove ? 0 : 1);
}

main();
