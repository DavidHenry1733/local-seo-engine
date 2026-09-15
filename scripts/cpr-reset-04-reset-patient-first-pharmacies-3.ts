/**
 * CPR-RESET-04 — one-time reset for patient-first-pharmacies-3 branch selection state.
 * Preserves customer, raw import evidence, Google candidates, workflow history.
 */
import { resetCustomerBranchSelection } from "../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts";
import { buildImportedEvidenceReview } from "../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";

const SLUG = "patient-first-pharmacies-3";

async function main() {
  const result = await resetCustomerBranchSelection(SLUG, "admin");
  const review = buildImportedEvidenceReview(SLUG);
  console.log("Reset complete for", SLUG);
  console.log("Status:", result.resolution.status);
  console.log("Detected branches:", result.detectedBranchCount);
  for (const b of result.resolution.detectedBranches) {
    console.log(`- ${b.branchName} | ${b.postcode} | ${b.phone} | Google: ${b.googleBusinessName || "—"}`);
  }
  console.log("Review summary:", review.summary);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
