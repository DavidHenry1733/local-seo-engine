#!/usr/bin/env npx tsx
/** Continue CPR-GREENFIELD-V1 for an existing slug (default: commercial-validation-pharmacy). */
import fs from "node:fs";
import path from "node:path";
import {
  readOnboardingBatch,
  refreshOnboardingBatchStatus,
} from "../src/pharmacy/masterAdminOnboardingBatchService.ts";
import {
  listMasterAdminJobs,
  getMasterAdminJob,
  claimNextQueuedJob,
  executeClaimedMasterAdminJob,
  recoverStaleMasterAdminJobs,
} from "../src/pharmacy/masterAdminJobService.ts";
import {
  acceptAllSafeRecommendations,
  approveBusinessProfileReview,
  buildBusinessProfileReview,
  saveBusinessProfileReviewField,
} from "../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import {
  approveServicePageEvidenceReview,
  buildServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
  isServicePageEvidenceReviewApproved,
} from "../src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import {
  confirmServicePageGeneration,
  CPR_DASHBOARD_INITIATION_SOURCE,
  readServicePageGenerationRecord,
} from "../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { executeMasterAdminAction } from "../src/pharmacy/masterAdminPlatformService.ts";
import { validateCommercialPageContractV1 } from "../src/pharmacy/masterAdminCommercialPageContractV1Service.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { validateServicePageSeoContract } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";
import { buildMasterAdminCustomerListLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import type { OperatorDecisionAction } from "../src/pharmacy/masterAdminBusinessProfileReviewModel.ts";

const OPERATOR = "cpr-greenfield-v1";
const SERVICE = "pharmacy-first";
const slug = process.argv[2] || "commercial-validation-pharmacy";

async function runJobs(max = 40): Promise<void> {
  recoverStaleMasterAdminJobs("greenfield-continue");
  for (let i = 0; i < max; i++) {
    const queued = listMasterAdminJobs({ slug, limit: 10 }).filter((j) => j.status === "queued");
    if (!queued.length) return;
    const claimed = claimNextQueuedJob("greenfield-continue", 600_000);
    if (!claimed) return;
    const fin = await executeClaimedMasterAdminJob(claimed.id, {});
    console.log("JOB", claimed.action, fin?.status, fin?.error?.slice(0, 160));
  }
}

function ensureBpr(): { ok: boolean; detail: string } {
  for (let pass = 0; pass < 10; pass++) {
    acceptAllSafeRecommendations(slug, OPERATOR);
    const review = buildBusinessProfileReview(slug);
    if (review.loadError) return { ok: false, detail: review.loadError };
    for (const field of review.fields) {
      if (!field.requiresAction) continue;
      if (field.reviewTier !== "needs_confirmation" && field.reviewTier !== "missing") continue;
      const value =
        field.recommendedValue ||
        field.websiteValue ||
        field.canonicalValue ||
        field.finalValue ||
        "";
      const action: OperatorDecisionAction = "use_website";
      saveBusinessProfileReviewField(slug, field.id, { action, finalValue: value || "Confirmed" }, OPERATOR);
    }
    const approval = approveBusinessProfileReview(slug, OPERATOR);
    if (approval.ok) return { ok: true, detail: "approved" };
  }
  const last = buildBusinessProfileReview(slug);
  return { ok: false, detail: last.approvalDisabledReason || last.readinessDetail || "fail" };
}

function ensureEvidence(): void {
  if (isServicePageEvidenceReviewApproved(slug)) return;
  for (let pass = 0; pass < 4; pass++) {
    const review = buildServicePageEvidenceReview(slug);
    if (!review || review.approved) break;
    for (const section of review.sections) {
      for (const field of section.fields) {
        if (field.status !== "not_confirmed") continue;
        const action = field.allowNotApplicable && !field.value && field.id !== "fonts" ? "not_applicable" : "confirm";
        decideServicePageEvidenceReviewField(slug, field.id, action, OPERATOR);
      }
    }
    const next = buildServicePageEvidenceReview(slug);
    if (next?.canApprove) approveServicePageEvidenceReview(slug, OPERATOR);
  }
}

async function main() {
  refreshOnboardingBatchStatus(slug);
  console.log("BATCH", readOnboardingBatch(slug));

  const bpr = ensureBpr();
  console.log("BPR", bpr);
  if (!bpr.ok) process.exit(2);

  ensureEvidence();
  console.log("EVIDENCE", isServicePageEvidenceReviewApproved(slug));

  const recordBefore = readServicePageGenerationRecord(slug);
  if (recordBefore?.status !== "completed") {
    const gen = confirmServicePageGeneration(slug, OPERATOR, {
      operatorConfirmed: true,
      initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
    });
    console.log("GEN_CONFIRM", gen);
    if (!gen.ok) process.exit(3);
    await runJobs(50);
  }

  console.log("GEN_RECORD", readServicePageGenerationRecord(slug));
  const pub = await executeMasterAdminAction("publish", slug, OPERATOR, { confirm: true });
  console.log("PUBLISH", pub.ok, pub.error);

  const htmlPath = path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
  const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : "";
  const contract = validateCommercialPageContractV1(html);
  const checklist = evaluateCommercialServicePageChecklist(slug, SERVICE);
  const seo = validateServicePageSeoContract(slug, SERVICE, html);
  const list = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === slug);

  const report = {
    slug,
    contract: contract.passed,
    commercial: checklist.allPassed,
    seo: seo.passed,
    releaseContract: contract.passed && checklist.allPassed && seo.passed,
    contractErrors: contract.errors,
    checklistErrors: checklist.generationErrors,
    publishManifest: fs.existsSync(path.join(WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json")),
    registry: fs.existsSync(
      path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation", slug, "latest.json"),
    ),
    dashboard: Boolean(list),
  };
  console.log(JSON.stringify(report, null, 2));
  process.exit(report.releaseContract ? 0 : 4);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
