#!/usr/bin/env npx tsx
/**
 * CPR-GREENFIELD-V1 — True greenfield commercial onboarding orchestration (validation run).
 */
import fs from "node:fs";
import path from "node:path";
import { createCommercialPharmacyCustomer } from "../src/pharmacy/masterAdminCommercialOnboardingService.ts";
import {
  readOnboardingBatch,
  refreshOnboardingBatchStatus,
} from "../src/pharmacy/masterAdminOnboardingBatchService.ts";
import { nudgeMasterAdminJobQueue, startMasterAdminJobWorker } from "../src/pharmacy/masterAdminJobWorkerService.ts";
import { listMasterAdminJobs, getMasterAdminJob, recoverStaleMasterAdminJobs } from "../src/pharmacy/masterAdminJobService.ts";
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
import { buildMasterAdminCustomerListLite } from "../src/pharmacy/masterAdminDashboardLiteService.ts";
import { validateCommercialPageContractV1 } from "../src/pharmacy/masterAdminCommercialPageContractV1Service.ts";
import { evaluateCommercialServicePageChecklist } from "../src/pharmacy/masterAdminCoreProductRecoveryCommercialChecklistService.ts";
import { validateServicePageSeoContract } from "../src/pharmacy/masterAdminCoreProductRecoverySeoService.ts";
import { WORKSPACE_ROOT } from "../src/pharmacy/pharmacyExecutiveDashboardService.ts";
import type { OperatorDecisionAction } from "../src/pharmacy/masterAdminBusinessProfileReviewModel.ts";

const OPERATOR = "cpr-greenfield-v1";
const SERVICE = "pharmacy-first";
const PHARMACY_NAME = "Commercial Validation Pharmacy";
const WEBSITE = "https://www.jhootspharmacy.co.uk";
const EMAIL = "commercial-validation@pharmaconnect.uk";

async function drainJobQueue(slug: string, maxRounds = 40): Promise<void> {
  startMasterAdminJobWorker();
  for (let i = 0; i < maxRounds; i++) {
    refreshOnboardingBatchStatus(slug);
    const queued = listMasterAdminJobs({ slug, limit: 20 }).filter((j) => j.status === "queued");
    if (!queued.length) break;
    await nudgeMasterAdminJobQueue();
    await new Promise((r) => setTimeout(r, 1500));
  }
}

function ensureBprApproved(slug: string): { ok: boolean; detail: string } {
  for (let pass = 0; pass < 8; pass++) {
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
        field.googleValue ||
        "";
      const action: OperatorDecisionAction = value ? "use_website" : "defer";
      try {
        saveBusinessProfileReviewField(slug, field.id, { action, finalValue: value }, OPERATOR);
      } catch {
        saveBusinessProfileReviewField(slug, field.id, { action: "use_website", finalValue: value || "Confirmed" }, OPERATOR);
      }
    }
    const approval = approveBusinessProfileReview(slug, OPERATOR);
    if (approval.ok) return { ok: true, detail: "Business profile approved" };
  }
  const last = buildBusinessProfileReview(slug);
  return {
    ok: false,
    detail: last.approvalDisabledReason || last.readinessDetail || "BPR not approvable",
  };
}

function ensureEvidenceApproved(slug: string): void {
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

async function waitForWebsiteImport(slug: string): Promise<void> {
  for (let i = 0; i < 60; i++) {
    refreshOnboardingBatchStatus(slug);
    const batch = readOnboardingBatch(slug);
    recoverStaleMasterAdminJobs("greenfield-wait");
    const stuck = listMasterAdminJobs({ slug, limit: 5 }).find(
      (j) => j.action === "import_website" && (j.status === "claimed" || j.status === "running"),
    );
    if (stuck && i > 3) {
      const { claimNextQueuedJob, executeClaimedMasterAdminJob, updateMasterAdminJob } = await import(
        "./masterAdminJobService.ts"
      );
      if (stuck.status === "claimed") {
        updateMasterAdminJob(stuck.id, {
          status: "queued",
          claimedBy: undefined,
          claimedAt: undefined,
          leaseExpiresAt: undefined,
        });
      }
      const claimed = claimNextQueuedJob("greenfield-manual", 600_000);
      if (claimed) await executeClaimedMasterAdminJob(claimed.id, {});
    }
    await drainJobQueue(slug, 3);
    if (batch?.website.importState === "completed") return;
    await new Promise((r) => setTimeout(r, 2000));
  }
}

async function main() {
  const created = await createCommercialPharmacyCustomer(
    {
      pharmacyName: PHARMACY_NAME,
      website: WEBSITE,
      contactEmail: EMAIL,
      phone: "0114 555 0199",
      googleProfileState: "no_profile",
      addressLine1: "1 Validation Street",
      townOrCity: "Sheffield",
      postcode: "S11 8TP",
      country: "United Kingdom",
      notes: "CPR-GREENFIELD-V1 true greenfield validation tenant",
    } as Parameters<typeof createCommercialPharmacyCustomer>[0] & {
      googleProfileState: string;
      addressLine1: string;
      townOrCity: string;
      country: string;
    },
    OPERATOR,
  );

  const slug = created.slug;
  console.log("CREATED", slug);

  await waitForWebsiteImport(slug);
  refreshOnboardingBatchStatus(slug);
  const batch = readOnboardingBatch(slug);
  console.log("BATCH", batch?.website.importState, batch?.google.importState, batch?.overallState);

  const bpr = ensureBprApproved(slug);
  console.log("BPR", bpr);
  if (!bpr.ok) process.exit(2);

  ensureEvidenceApproved(slug);
  console.log("EVIDENCE", isServicePageEvidenceReviewApproved(slug));

  const genConfirm = confirmServicePageGeneration(slug, OPERATOR, {
    operatorConfirmed: true,
    initiationSource: CPR_DASHBOARD_INITIATION_SOURCE,
  });
  console.log("GEN_CONFIRM", genConfirm);
  if (!genConfirm.ok) process.exit(3);

  await drainJobQueue(slug, 60);
  const genJob = genConfirm.jobId ? getMasterAdminJob(genConfirm.jobId) : null;
  console.log("GEN_JOB", genJob?.status, genJob?.error);

  const record = readServicePageGenerationRecord(slug);
  console.log("GEN_RECORD", record?.status, record?.errors?.slice(0, 3));

  const pub = await executeMasterAdminAction("publish", slug, OPERATOR, { confirm: true });
  console.log("PUBLISH", pub.ok, pub.error);

  const visualPath = path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, SERVICE, "index.html");
  const html = fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
  const contract = validateCommercialPageContractV1(html);
  const checklist = evaluateCommercialServicePageChecklist(slug, SERVICE);
  const seo = validateServicePageSeoContract(slug, SERVICE, html);
  const list = buildMasterAdminCustomerListLite().customers.find((c) => c.slug === slug);

  const report = {
    slug,
    journey: {
      websiteImport: batch?.website.importState,
      googleImport: batch?.google.importState,
      googleSkipReason: batch?.google.progressLabel,
      bpr: bpr.ok,
      evidence: isServicePageEvidenceReviewApproved(slug),
      generation: record?.status,
      publish: pub.ok,
      publishManifest: fs.existsSync(path.join(WORKSPACE_ROOT, "output/pharmacy-publish", slug, "_publish-index.json")),
      registry: fs.existsSync(
        path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-generation", slug, "latest.json"),
      ),
      dashboard: Boolean(list),
    },
    qa: {
      contract: contract.passed,
      commercial: checklist.allPassed,
      seo: seo.passed,
      contractErrors: contract.errors.slice(0, 8),
      checklistErrors: checklist.generationErrors.slice(0, 8),
    },
  };

  const out = path.join(WORKSPACE_ROOT, "data/validation-reports/cpr-greenfield-v1.json");
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
