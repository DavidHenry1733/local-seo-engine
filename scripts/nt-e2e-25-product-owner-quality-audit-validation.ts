/**
 * NT-E2E-25 — Product Owner Quality Audit validation.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import { buildProductOwnerQualityAudit } from "../src/pharmacy/masterAdminProductOwnerQualityAuditService.ts";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";

const SLUG = "reliable-direct-pharmacy";

function main() {
  const audit = buildProductOwnerQualityAudit(SLUG);
  if (!audit) throw new Error("Audit failed — customer not found");

  const review = buildCommercialQualityReview(SLUG);
  const report = {
    defect: "NT-E2E-25",
    pagesAudited: audit.pagesAudited,
    overallQualityScore: audit.overallQualityScore,
    criticalIssues: audit.criticalIssueCount,
    majorIssues: audit.majorIssueCount,
    minorIssues: audit.minorIssueCount,
    categoryScores: audit.categoryScores,
    readyForQualityReview: audit.readyForQualityReviewApproval,
    qualityReviewCanApprove: review.canApprove,
    status: audit.status,
    recommendedFixes: audit.recommendedFixes,
    pageSummaries: audit.pages.map((p) => ({
      label: p.pageLabel,
      slug: p.pageSlug,
      verdict: p.overallVerdict,
      score: p.overallScore,
    })),
  };

  const outFile = path.join(WORKSPACE_ROOT, "data/validation-reports/nt-e2e-25-product-owner-quality-audit.json");
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  fs.writeFileSync(outFile, JSON.stringify(report, null, 2));

  console.log("\n=== NT-E2E-25 PRODUCT OWNER QUALITY AUDIT ===");
  console.log(JSON.stringify(report, null, 2));
  console.log(`Report: ${outFile}`);

  if (audit.pagesAudited < 16 || audit.status !== "READY FOR PRODUCT OWNER PAGE REVIEW") {
    process.exit(1);
  }
}

main();
