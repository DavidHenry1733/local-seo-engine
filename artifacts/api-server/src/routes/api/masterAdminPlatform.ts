import { readVerifiedNationalCompetitorIntelligence } from "../../../../../src/pharmacy/verifiedNationalCompetitorIntelligenceService.ts";
import { readMarketOpportunityIntelligenceSnapshot } from "../../../../../src/pharmacy/marketOpportunityIntelligenceService.ts";
import { readMarketUniverseV2Snapshot } from "../../../../../src/pharmacy/marketUniverseIntelligenceV2Service.ts";
import { readGrowthPlanIntelligenceV1 } from "../../../../../src/pharmacy/growthPlanIntelligenceV1Service.ts";
import { resolveNationalIntelligenceArtifactPath } from "../../../../../src/pharmacy/nationalIntelligenceStorageService.ts";
import fs from "node:fs";
import path from "node:path";
/**
 * Master Admin Platform V1 — JSON API for commercial control centre.
 */
import { publishCanonicalCampaign } from "../../../../../src/pharmacy/canonicalCampaignPublishingService.ts";
import {
  checkCanonicalCampaignIndexing,
  resolveCanonicalCampaignResults,
  submitCanonicalCampaignSearch,
} from "../../../../../src/pharmacy/canonicalCampaignSearchResultsService.ts";
import { Router } from "express";
import { requireAdmin } from "../../middlewares/requireAuth.js";
import {
  buildMasterAdminCustomerRecord,
  executeMasterAdminAction,
  getClientMeta,
  refreshMasterAdminSystemHealthCache,
} from "../../../../../src/pharmacy/masterAdminPlatformService.ts";
import {
  buildMasterAdminCustomerDetailSections,
  buildMasterAdminCustomerRecordLite,
  profileMasterAdminCustomerRecordLoad,
} from "../../../../../src/pharmacy/masterAdminCustomerRecordLiteService.ts";
import {
  clearActiveServiceCampaignSelection,
  resolveMasterAdminServiceCampaignSummary,
  selectActiveServiceCampaign,
} from "../../../../../src/pharmacy/masterAdminServiceCampaignSummaryService.ts";
import {
  buildMasterAdminCustomerWorkflowSummary,
  buildMasterAdminTechnicalLogLite,
  profileMasterAdminCustomerWorkflowSummaryLoad,
} from "../../../../../src/pharmacy/masterAdminCustomerWorkflowSummaryService.ts";
import {
  buildServicePageGenerationDashboard,
  approveServicePageReview,
  buildServicePageReview,
  buildServicePageEvidenceReview,
  approveServicePageEvidenceReview,
  decideServicePageEvidenceReviewField,
  rejectServicePageEvidenceReview,
  rejectServicePageReview,
  buildCprClusterReviewDashboard,
  approveCprClusterReview,
  decideLocalityPageReview,
  CPR_DASHBOARD_INITIATION_SOURCE,
  isCoreProductRecoveryMode,
  readServicePageFrameworkLock,
} from "../../../../../src/pharmacy/masterAdminCoreProductRecoveryService.ts";
import { isLockedCommercialSupportedService } from "../../../../../src/pharmacy/masterAdminLockedCommercialServiceCatalog.ts";
import { isNationalGrowthPlatform } from "../../../../../src/pharmacy/growthPlatformResolverService.ts";
import {
  isServiceGenerationReady,
  listLockedCommercialServicesWithGenerationReadiness,
  resolveServiceGenerationReadiness,
} from "../../../../../src/pharmacy/masterAdminServiceGenerationReadinessService.ts";
import { buildPlatformOperationsDashboard } from "../../../../../src/pharmacy/masterAdminPlatformOperationsDashboardService.ts";
import { createPharmacyCampaign } from "../../../../../src/pharmacy/pharmacyCampaignService.ts";
import {
  buildCampaignLocalitySelectionDashboard,
  confirmProductOwnerServicePageGeneration,
  queueProductOwnerLocalityGeneration,
  updatePharmacyCampaignLocalitySelection,
} from "../../../../../src/pharmacy/masterAdminProductOwnerGenerationControlService.ts";
import { buildMasterAdminDashboardLite, profileMasterAdminDashboardLoad, buildMasterAdminCustomerListLite } from "../../../../../src/pharmacy/masterAdminDashboardLiteService.ts";
import { listMasterAdminAudit } from "../../../../../src/pharmacy/masterAdminAuditService.ts";
import {
  createMasterAdminJob,
  getMasterAdminJob,
  cancelMasterAdminJob,
  retryMasterAdminJob,
  isLongRunningMasterAdminAction,
  isTerminalMasterAdminJobStatus,
  listMasterAdminJobs,
  runMasterAdminJobAsync,
} from "../../../../../src/pharmacy/masterAdminJobService.ts";
import { buildServicePageJobContract } from "../../../../../src/pharmacy/masterAdminServicePageJobService.ts";
import { acceptImportedEvidenceReview, buildImportedEvidenceReview } from "../../../../../src/pharmacy/masterAdminImportedEvidenceReviewService.ts";
import {
  buildWebsiteBranchSelectionPayload,
  confirmManualWebsiteBranch,
  isBranchSelectionBlocking,
  markNoneOfTheseBranches,
  resetCustomerBranchSelection,
  selectWebsiteBranch,
} from "../../../../../src/pharmacy/masterAdminWebsiteBranchSelectionService.ts";
import { getCachedMasterAdminSystemHealth } from "../../../../../src/pharmacy/masterAdminHealthCacheService.ts";
import { safeAdminSlug } from "../../../../../src/pharmacy/pharmacyMasterAdminService.ts";
import {
  buildCustomerWorkflowState,
} from "../../../../../src/pharmacy/masterAdminWorkflowEngine.ts";
import {
  buildOnboardingIntakeForProfile,
  persistOnboardingIntake,
} from "../../../../../src/pharmacy/masterAdminOnboardingIntakeService.ts";
import {
  getOnboardingAreaDiscoveryState,
  refreshOnboardingAreaDiscovery,
  saveOnboardingAreaSelections,
} from "../../../../../src/pharmacy/masterAdminOnboardingAreaDiscoveryService.ts";
import { runCommercialOnboardingValidation } from "../../../../../src/pharmacy/masterAdminOnboardingValidation.ts";
import { runBackgroundJobWorkerValidation } from "../../../../../src/pharmacy/masterAdminJobWorkerValidation.ts";
import { runCanonicalWebsiteValidation } from "../../../../../src/pharmacy/masterAdminCanonicalWebsiteValidation.ts";
import { runGoogleIdentityStructuralValidation } from "../../../../../src/pharmacy/masterAdminGoogleIdentityValidation.ts";
import { runUnifiedIntakeValidation } from "../../../../../src/pharmacy/masterAdminUnifiedIntakeValidation.ts";
import { runBusinessProfileReviewValidation } from "../../../../../src/pharmacy/masterAdminBusinessProfileReviewValidation.ts";
import { runPreGenerationValidation } from "../../../../../src/pharmacy/masterAdminPreGenerationValidation.ts";
import {
  nudgeMasterAdminJobQueue,
  readMasterAdminJobWorkerHealth,
  traceQueuedJob,
} from "../../../../../src/pharmacy/masterAdminJobWorkerService.ts";
import {
  finalizeCompletedWorkflowJob,
  reconcileCompletedWorkflowJob,
} from "../../../../../src/pharmacy/masterAdminWorkflowJobFinalisationService.ts";
import {
  acceptRecommendedLocalAreas,
  buildGenerationSetupState,
  buildLocalAreaRecommendations,
  prepareGenerationSetup,
  saveGenerationSetupLocalAreas,
} from "../../../../../src/pharmacy/masterAdminGenerationSetupService.ts";
import { hydrateLocalCoverageGoogleLocalities } from "../../../../../src/pharmacy/masterAdminLocalCoverageRecommendationService.ts";
import { persistComponentDnaFromBrandEvidence } from "../../../../../src/pharmacy/masterAdminComponentDnaPersistenceService.ts";
import { buildBusinessProfileReview, acceptAllSafeRecommendations, loadSupplementalGoogleOpeningHours, saveBusinessProfileReviewField } from "../../../../../src/pharmacy/masterAdminBusinessProfileReviewService.ts";
import { confirmManualOnboardingBrandSource } from "../../../../../src/pharmacy/masterAdminGoogleLaterBrandEvidence.ts";
import { runMasterAdminCapabilityAudit } from "../../../../../src/pharmacy/masterAdminCapabilityAuditService.ts";
import {
  writeMasterAdminOperationalReadinessReport,
  readMasterAdminOperationalReadinessReport,
} from "../../../../../src/pharmacy/masterAdminOperationalReadinessService.ts";
import {
  approveCommercialQualityReview,
  buildCommercialQualityQaReport,
  buildCommercialQualityReview,
} from "../../../../../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import {
  buildProductOwnerQualityAudit,
  readLatestProductOwnerQualityAudit,
} from "../../../../../src/pharmacy/masterAdminProductOwnerQualityAuditService.ts";
import {
  buildQualityReviewPageInspectionWorkspace,
  resolveQualityReviewPagePreviewRedirect,
  updateQualityReviewPageInspection,
} from "../../../../../src/pharmacy/masterAdminQualityReviewPageInspectionService.ts";
import {
  approveAndQueueCommercialPublish,
  buildCommercialPublishReview,
  getCommercialPublishJobProgress,
} from "../../../../../src/pharmacy/masterAdminCommercialPublishReviewService.ts";
import {
  assertEcosystemGenerationAllowed,
  buildCommercialEcosystemGenerationDashboard,
  confirmAuthorisedEcosystemGeneration,
} from "../../../../../src/pharmacy/masterAdminCommercialEcosystemGenerationService.ts";
import {
  buildCommercialIndexingReviewDashboard,
  requestCommercialIndexing,
} from "../../../../../src/pharmacy/masterAdminCommercialIndexingReviewService.ts";
import {
  acknowledgeCommercialPerformanceDashboard,
  buildCommercialPerformanceDashboard,
  refreshCommercialPerformanceDashboard,
} from "../../../../../src/pharmacy/masterAdminCommercialPerformanceDashboardService.ts";
import {
  buildMasterAdminIntegratedGrowthDashboard,
  enrichMasterAdminCustomerListRow,
  readMasterAdminSearchConsoleIntegration,
} from "../../../../../src/pharmacy/masterAdminPlatformIntegrationService.ts";
import { buildPharmacySearchConsoleDashboard } from "../../../../../src/pharmacy/pharmacySearchConsoleDashboardService.ts";
import {
  approveCommercialDeployment,
  buildCommercialDeploymentReview,
  runCommercialDeploymentConnectionTest,
  saveCommercialDeploymentProfile,
  updateCommercialDeploymentCredentials,
  validateCommercialDeploymentDestination,
} from "../../../../../src/pharmacy/masterAdminCommercialDeploymentService.ts";
import { runCommercialDeploymentValidation } from "../../../../../src/pharmacy/masterAdminCommercialDeploymentValidation.ts";
import {
  buildPlatformInfrastructureReview,
  refreshPlatformInfrastructureHealth,
  savePlatformConnection,
  testPlatformInfrastructureConnection,
  updatePlatformInfrastructureCredentials,
  validatePlatformPublishRoot,
} from "../../../../../src/pharmacy/masterAdminPlatformPublishingInfrastructureService.ts";
import {
  addCustomerSubdomain,
  buildManagedPublishingReview,
  changeCustomerSubdomainLabel,
  confirmCustomerDomain,
  ensureManagedPublishingTenant,
  removeCustomerSubdomain,
  rollbackTenantRelease,
  runManagedPublishingValidation,
  verifyCustomerDns,
  verifyCustomerSsl,
} from "../../../../../src/pharmacy/masterAdminManagedPublishingService.ts";
import { continueCustomerWorkflowWithOnboardingBatch } from "../../../../../src/pharmacy/masterAdminOnboardingWorkflowIntegration.ts";
import {
  buildCommercialIntelligenceDashboard,
} from "../../../../../src/pharmacy/masterAdminCommercialIntelligenceDashboardService.ts";
import {
  approveCommercialIntelligence,
  findActiveCommercialIntelligenceJob,
} from "../../../../../src/pharmacy/masterAdminCommercialIntelligenceWorkflowService.ts";
import { isCombinedCompetitorAnalysisStored } from "../../../../../src/pharmacy/pharmacyCompetitorIntelligenceService.ts";

const router = Router();
router.use(requireAdmin);

function resolveUser(req: import("express").Request): string {
  const session = req.session as { username?: string; name?: string } | undefined;
  return session?.name || session?.username || "admin";
}

router.get("/master-admin-platform/dashboard", (_req, res) => {
  const start = performance.now();
  try {
    const payload = buildMasterAdminDashboardLite();
    payload.customers = payload.customers.map((row) => enrichMasterAdminCustomerListRow(row));
    payload.timings.routeMs = performance.now() - start;
    payload.timings.totalMs = payload.timings.routeMs;
    res.json({ ok: true, ...payload });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

router.get("/master-admin-platform/platform-operations", (req, res) => {
  try {
    const slug = String(req.query.slug || "").trim();
    res.json({ ok: true, dashboard: buildPlatformOperationsDashboard(slug || undefined) });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
});

router.get("/master-admin-platform/profile", (_req, res) => {
  const timings = profileMasterAdminDashboardLoad();
  res.json({
    ok: true,
    timings,
    notes: [
      "Dashboard uses read-only file/cache reads only",
      "No imports, publishing, indexing, or ranking on load",
      "Customer detail is lazy-loaded via /customers/:slug",
      "System health reads cached status only",
    ],
  });
});

router.get("/master-admin-platform/customers", (_req, res) => {
  const start = performance.now();
  const { customers, lifecycleMs, customerLoadMs } = buildMasterAdminCustomerListLite();
  res.json({
    ok: true,
    customers,
    timings: {
      totalMs: performance.now() - start,
      customerLoadMs,
      lifecycleMs,
      customerCount: customers.length,
    },
  });
});

router.get("/master-admin-platform/customers/:slug/workflow", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const workflow = buildCustomerWorkflowState(slug, resolveUser(req));
  if (!workflow) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({ ok: true, workflow });
});

router.post("/master-admin-platform/jobs/worker/validate", async (req, res) => {
  const result = await runBackgroundJobWorkerValidation(resolveUser(req));
  res.json({ ok: true, validation: result });
});

router.post("/master-admin-platform/onboarding/validate", async (req, res) => {
  const result = await runCommercialOnboardingValidation(resolveUser(req));
  res.json({ ok: true, validation: result });
});

router.post("/master-admin-platform/website-source/validate", async (req, res) => {
  const result = await runCanonicalWebsiteValidation(resolveUser(req));
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/google-identity/validate", (_req, res) => {
  const result = runGoogleIdentityStructuralValidation();
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/unified-intake/validate", (req, res) => {
  const result = runUnifiedIntakeValidation(String((req.session as { username?: string })?.username || "admin"));
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/business-profile-review/validate", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  const result = runBusinessProfileReviewValidation(slug, String((req.session as { username?: string })?.username || "admin"));
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/pre-generation/validate", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  const result = runPreGenerationValidation(slug);
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/generation-setup", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  const setup = buildGenerationSetupState(slug);
  res.json({ ok: true, setup });
});

router.get("/master-admin-platform/generation-setup/local-areas", async (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  try {
    await hydrateLocalCoverageGoogleLocalities(slug);
    const recommendations = buildLocalAreaRecommendations(slug);
    res.json({ ok: true, ...recommendations });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/generation-setup/component-dna/persist", (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || req.query.slug || "banner-cross-pharmacy"));
  const result = persistComponentDnaFromBrandEvidence(slug, { force: Boolean(req.body.force) });
  const validation = runPreGenerationValidation(slug);
  res.json({ ok: result.ok, result, validation });
});

router.post("/master-admin-platform/generation-setup/local-areas/save", (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || "banner-cross-pharmacy"));
  try {
    const setup = saveGenerationSetupLocalAreas(slug, {
      primaryTown: req.body.primaryTown ? String(req.body.primaryTown) : undefined,
      areas: Array.isArray(req.body.areas) ? req.body.areas : [],
      manualAreas: Array.isArray(req.body.manualAreas) ? req.body.manualAreas : undefined,
    });
    const validation = runPreGenerationValidation(slug);
    res.json({ ok: true, setup, validation });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/generation-setup/local-areas/accept-recommended", async (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || "banner-cross-pharmacy"));
  try {
    await hydrateLocalCoverageGoogleLocalities(slug);
    const setup = acceptRecommendedLocalAreas(slug);
    const validation = runPreGenerationValidation(slug);
    res.json({ ok: true, setup, validation });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/generation-setup/prepare", (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || "banner-cross-pharmacy"));
  const prepared = prepareGenerationSetup(slug);
  res.json({ ok: prepared.componentDna.ok, ...prepared });
});

router.get("/master-admin-platform/local-coverage", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  const setup = buildGenerationSetupState(slug);
  res.json({ ok: true, localCoverage: setup });
});

router.get("/master-admin-platform/local-coverage/areas", async (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : "banner-cross-pharmacy";
  try {
    await hydrateLocalCoverageGoogleLocalities(slug);
    const recommendations = buildLocalAreaRecommendations(slug);
    res.json({ ok: true, ...recommendations });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/local-coverage/save", (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || "banner-cross-pharmacy"));
  try {
    const setup = saveGenerationSetupLocalAreas(slug, {
      primaryTown: req.body.primaryTown ? String(req.body.primaryTown) : undefined,
      areas: Array.isArray(req.body.areas) ? req.body.areas : [],
      manualAreas: Array.isArray(req.body.manualAreas) ? req.body.manualAreas : undefined,
    });
    const validation = runPreGenerationValidation(slug);
    res.json({ ok: true, setup, validation });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/local-coverage/accept-recommended", async (req, res) => {
  const slug = safeAdminSlug(String(req.body.slug || "banner-cross-pharmacy"));
  try {
    await hydrateLocalCoverageGoogleLocalities(slug);
    const setup = acceptRecommendedLocalAreas(slug);
    const validation = runPreGenerationValidation(slug);
    res.json({ ok: true, setup, validation });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/master-admin-platform/customers/:slug/business-profile-review", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const supplementalGoogleOpeningHours = await loadSupplementalGoogleOpeningHours(slug);
  const review = buildBusinessProfileReview(slug, { supplementalGoogleOpeningHours });
  if (review.loadError) {
    return res.status(500).json({ ok: false, error: review.loadError, review });
  }
  res.json({ ok: true, review });
});

router.post("/master-admin-platform/customers/:slug/business-profile-review/save", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const outcome = await executeMasterAdminAction("save_business_profile_review", slug, user, req.body || {});
    if (!outcome.ok) return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit });
    res.json({ ok: true, review: outcome.result, customer: buildMasterAdminCustomerRecordLite(slug), audit: outcome.audit });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/business-profile-review/field", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const body = req.body || {};
  const fieldId = String(body.fieldId || "");
  if (!fieldId) return res.status(400).json({ ok: false, error: "fieldId required" });
  try {
    const review = saveBusinessProfileReviewField(
      slug,
      fieldId,
      {
        action: body.action,
        finalValue: body.finalValue,
        note: body.note,
      },
      user,
    );
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/business-profile-review/confirm-manual-brand-source", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const confirmed = confirmManualOnboardingBrandSource(slug, user);
    if (!confirmed.ok) return res.status(409).json({ ok: false, error: confirmed.error });
    const review = buildBusinessProfileReview(slug);
    res.json({ ok: true, review, value: confirmed.value, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/business-profile-review/accept-safe", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = acceptAllSafeRecommendations(slug, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/business-profile-review/approve", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const outcome = await executeMasterAdminAction("approve_business_profile_review", slug, user, req.body || {});
    const approval = outcome.result as {
      ok?: boolean;
      errors?: string[];
      snapshot?: { profileRevision?: number; approvedAt?: string | null };
      alreadyApproved?: boolean;
    } | undefined;
    if (!outcome.ok) {
      const message = outcome.error || approval?.errors?.[0] || "Business Profile approval failed.";
      return res.status(409).json({
        ok: false,
        error: "business_profile_approval_failed",
        message,
        details: {
          field: approval?.errors?.length === 1 ? "approval" : undefined,
          reason: message,
          reasons: approval?.errors || [message],
        },
        customer: buildMasterAdminCustomerRecordLite(slug),
        audit: outcome.audit,
      });
    }
    res.json({
      ok: true,
      status: "approved",
      profileRevision: approval?.snapshot?.profileRevision ?? null,
      approvedAt: approval?.snapshot?.approvedAt ?? null,
      nextStage: "competitor_analysis",
      alreadyApproved: Boolean(approval?.alreadyApproved),
      result: outcome.result,
      customer: buildMasterAdminCustomerRecordLite(slug),
      audit: outcome.audit,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: "business_profile_approval_failed",
      message: err instanceof Error ? err.message : String(err),
    });
  }
});


router.get(
  "/master-admin-platform/customers/:slug/verified-national-competitor-intelligence",
  (req, res) => {
    try {
      const slug=String(req.params.slug || "");

      if(!isNationalGrowthPlatform(slug)){
        return res.status(400).json({
          error:
            "Verified National Competitor Intelligence is available for NATIONAL Growth Platform tenants only."
        });
      }

      const intelligence=
        readVerifiedNationalCompetitorIntelligence(slug);
      if(!intelligence){
        return res.status(404).json({ error:"verified_national_competitor_intelligence_not_found" });
      }

      return res.json(intelligence);

    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ?
          error.message :
          String(error),
      });
    }
  }
);

router.get(
  "/master-admin-platform/customers/:slug/market-opportunity-intelligence",
  (req, res) => {
    try {
      const slug=String(req.params.slug || "");

      if(!isNationalGrowthPlatform(slug)){
        return res.status(400).json({
          error:
            "Market Opportunity Intelligence is available for NATIONAL Growth Platform tenants only."
        });
      }

      const intelligence=
        readMarketOpportunityIntelligenceSnapshot(slug);

      return res.json(intelligence);

    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ?
          error.message :
          String(error),
      });
    }
  }
);

router.get(
  "/master-admin-platform/customers/:slug/market-opportunity-intelligence-v2",
  (req, res) => {
    try {
      const slug=String(req.params.slug || "");

      if(!isNationalGrowthPlatform(slug)){
        return res.status(400).json({
          error:
            "Market Universe Intelligence V2 is available for NATIONAL Growth Platform tenants only."
        });
      }

      return res.json(readMarketUniverseV2Snapshot(slug));

    } catch (error) {
      return res.status(500).json({
        error:
          error instanceof Error ?
          error.message :
          String(error),
      });
    }
  }
);

router.get(
  "/master-admin-platform/customers/:slug/growth-plan-intelligence-input",
  (req, res) => {
    try {
      const slug=String(req.params.slug || "");
      if(!isNationalGrowthPlatform(slug)){
        return res.status(400).json({ error:"Growth Plan Intelligence Input is available for NATIONAL Growth Platform tenants only." });
      }
      const file=resolveNationalIntelligenceArtifactPath(slug, "growth-plan-intelligence-input-v1");
      if(!file){
        return res.status(404).json({ error:"growth_plan_intelligence_input_not_found" });
      }
      return res.json(JSON.parse(fs.readFileSync(file,"utf8")));
    } catch (error) {
      return res.status(500).json({ error:error instanceof Error ? error.message : String(error) });
    }
  }
);

router.get(
  "/master-admin-platform/customers/:slug/growth-plan-intelligence",
  (req, res) => {
    try {
      const slug=String(req.params.slug || "");
      if(!isNationalGrowthPlatform(slug)){
        return res.status(400).json({ error:"Growth Plan Intelligence is available for NATIONAL Growth Platform tenants only." });
      }
      const intelligence=readGrowthPlanIntelligenceV1(slug);
      if(!intelligence){
        return res.status(404).json({ error:"growth_plan_intelligence_not_found" });
      }
      return res.json(intelligence);
    } catch (error) {
      return res.status(500).json({ error:error instanceof Error ? error.message : String(error) });
    }
  }
);

router.get("/master-admin-platform/customers/:slug/commercial-intelligence-dashboard", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  try {
    res.json({
      ok: true,
      dashboard: buildCommercialIntelligenceDashboard(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({ ok: false, error: message });
  }
});

router.post("/master-admin-platform/customers/:slug/commercial-intelligence-dashboard/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = approveCommercialIntelligence(slug, user);
  if (!outcome.ok) {
    return res.status(409).json({ ok: false, error: outcome.evidence, customer: buildMasterAdminCustomerRecordLite(slug) });
  }
  res.json({
    ok: true,
    dashboard: buildCommercialIntelligenceDashboard(slug),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/commercial-intelligence-dashboard/generate-competitor-analysis", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const dashboard = buildCommercialIntelligenceDashboard(slug);
    const active = findActiveCommercialIntelligenceJob(slug, new Set(["orchestrate_competitor_analysis"]));
    if (active) {
      return res.json({
        ok: true,
        async: true,
        idempotent: true,
        jobId: active.id,
        evidence: `Competitor Analysis job already ${active.status}`,
        dashboard,
        customer: buildMasterAdminCustomerRecordLite(slug),
      });
    }
    if (isCombinedCompetitorAnalysisStored(slug) && !dashboard.staleCompletion?.flagged) {
      return res.json({
        ok: true,
        async: false,
        idempotent: true,
        evidence: "Competitor Analysis already stored",
        dashboard,
        customer: buildMasterAdminCustomerRecordLite(slug),
      });
    }
    const job = createMasterAdminJob({
      slug,
      action: "orchestrate_competitor_analysis",
      user,
    });
    runMasterAdminJobAsync(job.id, req.body || {});
    return res.json({
      ok: true,
      async: true,
      idempotent: false,
      jobId: job.id,
      evidence: "Competitor Analysis queued",
      dashboard: buildCommercialIntelligenceDashboard(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(500).json({
      ok: false,
      error: message,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
});

router.get("/master-admin-platform/customers/:slug/competitor-analysis-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/competitor-analysis-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = approveCommercialIntelligence(slug, user);
  if (!outcome.ok) return res.status(409).json({ ok: false, error: outcome.evidence, customer: buildMasterAdminCustomerRecordLite(slug) });
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/local-market-intelligence-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/local-market-intelligence-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = approveCommercialIntelligence(slug, user);
  if (!outcome.ok) return res.status(409).json({ ok: false, error: outcome.evidence, customer: buildMasterAdminCustomerRecordLite(slug) });
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/growth-intelligence-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/growth-intelligence-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = approveCommercialIntelligence(slug, user);
  if (!outcome.ok) return res.status(409).json({ ok: false, error: outcome.evidence, customer: buildMasterAdminCustomerRecordLite(slug) });
  res.json({ ok: true, review: buildCommercialIntelligenceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/commercial-quality-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const review = buildCommercialQualityReview(slug);
  if (review.loadError && !review.generatedAt) {
    return res.status(500).json({ ok: false, error: review.loadError, review });
  }
  res.json({ ok: true, review });
});

router.get("/master-admin-platform/customers/:slug/commercial-quality-review/pages/:pageSlug/preview", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const pageSlug = String(req.params.pageSlug || "").trim();
  const target = resolveQualityReviewPagePreviewRedirect(slug, pageSlug);
  if (!target) {
    return res.status(404).type("text/plain").send("Page preview not available");
  }
  res.redirect(302, target);
});

router.post("/master-admin-platform/customers/:slug/commercial-quality-review/pages/:pageSlug/review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const pageSlug = String(req.params.pageSlug || "").trim();
  const reviewStatus = String(req.body?.reviewStatus || "").trim() as "not_reviewed" | "approved" | "needs_changes";
  const notes = typeof req.body?.notes === "string" ? req.body.notes : undefined;
  const workspace = updateQualityReviewPageInspection(slug, pageSlug, reviewStatus, notes);
  if (!workspace) {
    return res.status(400).json({ ok: false, error: "Invalid page review update" });
  }
  res.json({ ok: true, workspace, review: buildCommercialQualityReview(slug) });
});

router.get("/master-admin-platform/customers/:slug/commercial-quality-review/qa-report", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const report = buildCommercialQualityQaReport(slug);
  res.setHeader("Content-Type", "application/json");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${slug}-qa-report.json"`,
  );
  res.send(JSON.stringify(report, null, 2));
});

router.get("/master-admin-platform/customers/:slug/product-owner-quality-audit", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const audit = buildProductOwnerQualityAudit(slug);
  if (!audit) {
    return res.status(404).json({ ok: false, error: "Customer not found" });
  }
  res.json({ ok: true, audit });
});

router.get("/master-admin-platform/customers/:slug/product-owner-quality-audit/latest", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const audit = readLatestProductOwnerQualityAudit(slug) || buildProductOwnerQualityAudit(slug);
  if (!audit) {
    return res.status(404).json({ ok: false, error: "Customer not found" });
  }
  res.json({ ok: true, audit });
});

router.post("/master-admin-platform/customers/:slug/commercial-quality-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = approveCommercialQualityReview(slug, user);
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: "quality_review_approval_failed",
      message: outcome.errors[0] || "Quality Review approval failed.",
      details: { reasons: outcome.errors },
      review: outcome.review,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({
    ok: true,
    status: "approved",
    alreadyApproved: Boolean(outcome.alreadyApproved),
    nextStage: "publish",
    workflowStage: outcome.workflowStage,
    snapshot: outcome.snapshot,
    review: outcome.review,
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/commercial-deployment-configuration", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const review = buildCommercialDeploymentReview(slug);
  res.json({ ok: true, review });
});

router.post("/master-admin-platform/customers/:slug/commercial-deployment-configuration", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const profile = saveCommercialDeploymentProfile(slug, req.body || {}, user);
    const review = buildCommercialDeploymentReview(slug);
    res.json({ ok: true, profile, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: "deployment_configuration_save_failed",
      message: err instanceof Error ? err.message : "Failed to save deployment configuration",
    });
  }
});

router.post("/master-admin-platform/customers/:slug/commercial-deployment-configuration/credentials", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const profile = updateCommercialDeploymentCredentials(slug, req.body || {}, user);
    const review = buildCommercialDeploymentReview(slug);
    res.json({ ok: true, profile, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({
      ok: false,
      error: "deployment_credentials_update_failed",
      message: err instanceof Error ? err.message : "Failed to update credentials",
    });
  }
});

router.post("/master-admin-platform/customers/:slug/commercial-deployment-configuration/test-connection", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = await runCommercialDeploymentConnectionTest(slug, user);
  res.json({
    ok: true,
    connectionOk: outcome.ok,
    checks: outcome.checks,
    review: buildCommercialDeploymentReview(slug),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/commercial-deployment-configuration/validate", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = await validateCommercialDeploymentDestination(slug, user);
  res.json({
    ok: true,
    validationOk: outcome.ok,
    checks: outcome.checks,
    warnings: outcome.warnings,
    blockers: outcome.blockers,
    review: buildCommercialDeploymentReview(slug),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/commercial-deployment-configuration/approve", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = await approveCommercialDeployment(slug, user);
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: "deployment_approval_failed",
      message: outcome.errors[0] || "Deployment approval failed",
      details: { reasons: outcome.errors },
      review: outcome.review,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({
    ok: true,
    status: "approved",
    snapshot: outcome.snapshot,
    review: outcome.review,
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/commercial-deployment-configuration/history", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const review = buildCommercialDeploymentReview(slug);
  res.json({ ok: true, history: review.publishHistory, review });
});

router.get("/master-admin-platform/platform-infrastructure", (_req, res) => {
  res.json({ ok: true, review: buildPlatformInfrastructureReview() });
});

router.post("/master-admin-platform/platform-infrastructure", (req, res) => {
  const user = resolveUser(req);
  try {
    const review = savePlatformConnection(req.body || {}, user);
    res.json({ ok: true, review, profile: review.profile });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Failed to save platform connection",
    });
  }
});

router.post("/master-admin-platform/platform-infrastructure/credentials", (req, res) => {
  const user = resolveUser(req);
  try {
    const review = updatePlatformInfrastructureCredentials(req.body || {}, user);
    res.json({ ok: true, review, profile: review.profile });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Failed to update platform credentials",
    });
  }
});

router.post("/master-admin-platform/platform-infrastructure/test-connection", async (req, res) => {
  const user = resolveUser(req);
  try {
    const review = await testPlatformInfrastructureConnection(user);
    res.json({ ok: true, review });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Connection test failed",
      review: buildPlatformInfrastructureReview(),
    });
  }
});

router.post("/master-admin-platform/platform-infrastructure/validate-publish-root", async (req, res) => {
  const user = resolveUser(req);
  try {
    const review = await validatePlatformPublishRoot(user);
    res.json({ ok: true, review });
  } catch (err) {
    res.status(400).json({
      ok: false,
      message: err instanceof Error ? err.message : "Publish root validation failed",
    });
  }
});

router.post("/master-admin-platform/platform-infrastructure/refresh-health", (req, res) => {
  const user = resolveUser(req);
  res.json({ ok: true, review: refreshPlatformInfrastructureHealth(user) });
});

router.get("/master-admin-platform/customers/:slug/managed-publishing", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  ensureManagedPublishingTenant(slug);
  res.json({ ok: true, review: buildManagedPublishingReview(slug) });
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/confirm-domain", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = confirmCustomerDomain(slug, req.body || {}, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "Failed to confirm domain" });
  }
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/change-subdomain-label", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = changeCustomerSubdomainLabel(slug, req.body || {}, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "Failed to change subdomain label" });
  }
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/subdomain", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = addCustomerSubdomain(slug, req.body || {}, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "Failed to add subdomain" });
  }
});

router.delete("/master-admin-platform/customers/:slug/managed-publishing/subdomain", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const review = removeCustomerSubdomain(slug, user);
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/verify-dns", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = await verifyCustomerDns(slug, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "DNS verification failed" });
  }
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/recheck-dns", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = await verifyCustomerDns(slug, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "DNS recheck failed" });
  }
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/verify-ssl", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const review = await verifyCustomerSsl(slug, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "SSL verification failed" });
  }
});

router.post("/master-admin-platform/customers/:slug/managed-publishing/rollback", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const releaseId = String(req.body?.releaseId || "");
  try {
    const review = rollbackTenantRelease(slug, releaseId, user);
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(400).json({ ok: false, message: err instanceof Error ? err.message : "Rollback failed" });
  }
});

router.post("/master-admin-platform/managed-publishing/validate", (req, res) => {
  const slug = safeAdminSlug(String(req.body?.slug || "banner-cross-pharmacy"));
  ensureManagedPublishingTenant(slug);
  res.json({
    ok: true,
    report: runManagedPublishingValidation(slug),
    review: buildManagedPublishingReview(slug),
    infrastructure: buildPlatformInfrastructureReview(),
  });
});

router.post("/master-admin-platform/commercial-deployment/validate", async (req, res) => {
  const result = await runCommercialDeploymentValidation(resolveUser(req));
  res.json({ ok: true, validation: result });
});

router.get("/master-admin-platform/customers/:slug/commercial-publish-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const review = buildCommercialPublishReview(slug);
  if (review.loadError) {
    return res.status(500).json({ ok: false, error: review.loadError, review });
  }
  res.json({ ok: true, review });
});

router.post("/master-admin-platform/customers/:slug/campaigns/:campaignId/canonical-publish", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  const result = publishCanonicalCampaign({ tenantSlug: slug, campaignId });
  if (!result.ok) {
    return res.status(409).json({
      ok: false,
      error: result.blockers.join("; ") || "Canonical publication blocked",
      message: result.blockers.join("; ") || "Canonical publication blocked",
      blockers: result.blockers,
      publication: result.publication,
    });
  }
  res.json({ ok: true, idempotent: result.idempotent, publication: result.publication, uiState: result.uiState });
});

router.get("/master-admin-platform/customers/:slug/campaigns/:campaignId/canonical-results", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  res.json({ ok: true, results: resolveCanonicalCampaignResults({ tenantSlug: slug, campaignId }) });
});

router.post("/master-admin-platform/customers/:slug/campaigns/:campaignId/canonical-search/submit", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  const result = await submitCanonicalCampaignSearch({ tenantSlug: slug, campaignId });
  if (!result.ok) {
    return res.status(409).json({ ok: false, error: result.blockers.join("; ") || "Canonical search submission blocked", blockers: result.blockers });
  }
  res.json({ ok: true, submittedUrls: result.submittedUrls, results: resolveCanonicalCampaignResults({ tenantSlug: slug, campaignId }) });
});

router.post("/master-admin-platform/customers/:slug/campaigns/:campaignId/canonical-search/indexing-check", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  const result = await checkCanonicalCampaignIndexing({ tenantSlug: slug, campaignId });
  if (!result.ok) {
    return res.status(409).json({ ok: false, error: result.blockers.join("; ") || "Indexing check was not executed", blockers: result.blockers });
  }
  res.json({ ok: true, results: resolveCanonicalCampaignResults({ tenantSlug: slug, campaignId }) });
});

router.post("/master-admin-platform/customers/:slug/commercial-publish-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const operatorConfirmed = Boolean(req.body?.operatorConfirmed);
  const outcome = approveAndQueueCommercialPublish(slug, user, { operatorConfirmed });
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: "publish_approval_failed",
      message: outcome.errors[0] || "Publish approval failed",
      details: { reasons: outcome.errors },
      review: outcome.review,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({
    ok: true,
    jobId: outcome.jobId,
    review: outcome.review,
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/commercial-ecosystem-generation", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  if (isCoreProductRecoveryMode(slug)) {
    return res.status(409).json({
      ok: false,
      error: "core_product_recovery_mode",
      message: "Generate Ecosystem is disabled for CPR-01 acceptance tenants. Use Generate Service Page Only.",
      dashboard: buildServicePageGenerationDashboard(slug),
    });
  }
  res.json({ ok: true, dashboard: buildCommercialEcosystemGenerationDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/locked-commercial-services", (_req, res) => {
  const services = listLockedCommercialServicesWithGenerationReadiness().map((s) => ({
    serviceId: s.serviceId,
    serviceName: s.serviceName,
    status: s.status,
    generationReady: s.generationReady,
    selectable: s.selectable,
    missingComponents: s.missingComponents,
  }));
  res.json({ ok: true, services });
});

router.get("/master-admin-platform/customers/:slug/imported-evidence-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, review: buildImportedEvidenceReview(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/imported-evidence-review/accept", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const acceptance = acceptImportedEvidenceReview(slug, user);
    res.json({
      ok: true,
      acceptance,
      review: buildImportedEvidenceReview(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
      workflow: buildCustomerWorkflowState(slug, user),
    });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/google-candidates/search", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const { searchGoogleCandidatesForCustomer } = await import("../../../../../src/pharmacy/masterAdminCanonicalGoogleService.ts");
    const result = await searchGoogleCandidatesForCustomer(slug, req.body?.googleBusinessUrl ? String(req.body.googleBusinessUrl) : undefined, user);
    res.json({ ok: true, ...result, review: buildImportedEvidenceReview(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/google-candidates/select", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const placeId = String(req.body?.placeId || "").trim();
  if (!placeId) return res.status(400).json({ ok: false, error: "placeId required" });
  if (isBranchSelectionBlocking(slug)) {
    return res.status(409).json({
      ok: false,
      error: "Website branch selection is required before Google listing selection.",
    });
  }
  try {
    const { selectGoogleCandidateByPlaceId } = await import("../../../../../src/pharmacy/masterAdminCanonicalGoogleService.ts");
    const result = await selectGoogleCandidateByPlaceId(slug, placeId, user);
    res.json({ ok: true, ...result, review: buildImportedEvidenceReview(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/website-branches/select", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const branchId = String(req.body?.branchId || "").trim();
  if (!branchId) return res.status(400).json({ ok: false, error: "branchId required" });
  try {
    const branchSelection = selectWebsiteBranch(slug, branchId, user);
    res.json({
      ok: true,
      branchSelection,
      review: buildImportedEvidenceReview(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
      workflow: buildCustomerWorkflowState(slug, user),
    });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/website-branches/none", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const branchSelection = markNoneOfTheseBranches(slug, user);
    res.json({
      ok: true,
      branchSelection,
      review: buildImportedEvidenceReview(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/customers/:slug/website-branches/manual-confirm", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const branchSelection = confirmManualWebsiteBranch(
      slug,
      {
        branchName: String(req.body?.branchName || ""),
        addressLine1: String(req.body?.addressLine1 || ""),
        town: String(req.body?.town || ""),
        postcode: String(req.body?.postcode || ""),
        phone: String(req.body?.phone || ""),
        branchUrl: String(req.body?.branchUrl || ""),
        email: req.body?.email ? String(req.body.email) : undefined,
      },
      user,
    );
    res.json({
      ok: true,
      branchSelection,
      review: buildImportedEvidenceReview(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
      workflow: buildCustomerWorkflowState(slug, user),
    });
  } catch (err) {
    res.status(409).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-admin-platform/customers/:slug/website-branches", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, branchSelection: buildWebsiteBranchSelectionPayload(slug) });
});

router.get("/master-admin-platform/customers/:slug/service-page-evidence-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const review = buildServicePageEvidenceReview(slug);
  if (!review) return res.status(404).json({ ok: false, error: "CPR-01 mode not enabled for this customer" });
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-evidence-review/field", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const fieldId = String(req.body?.fieldId || "").trim();
  const actionRaw = String(req.body?.action || "").trim();
  const action =
    actionRaw === "not_applicable"
      ? "not_applicable"
      : actionRaw === "confirm"
        ? "confirm"
        : actionRaw === "edit_value"
          ? "edit_value"
          : null;
  const editedValue = req.body?.value != null ? String(req.body.value) : undefined;
  if (!fieldId || !action) return res.status(400).json({ ok: false, error: "invalid_field_action" });
  const review = decideServicePageEvidenceReviewField(slug, fieldId, action, user, editedValue);
  if (!review) return res.status(409).json({ ok: false, error: "field_decision_blocked", review: buildServicePageEvidenceReview(slug) });
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-evidence-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) return res.status(409).json({ ok: false, error: "confirmation_required" });
  const review = approveServicePageEvidenceReview(slug, user);
  if (!review) return res.status(409).json({ ok: false, error: "approval_blocked", review: buildServicePageEvidenceReview(slug) });
  res.json({ ok: true, review, dashboard: buildServicePageGenerationDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-evidence-review/reject", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const notes = String(req.body?.notes || "").trim();
  const review = rejectServicePageEvidenceReview(slug, user, notes);
  if (!review) return res.status(404).json({ ok: false, error: "review_not_available" });
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/service-page-framework-lock", (_req, res) => {
  res.json({ ok: true, lock: readServicePageFrameworkLock() });
});

router.get("/master-admin-platform/customers/:slug/service-page-generation", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const dashboard = buildServicePageGenerationDashboard(slug);
  if (!dashboard) return res.status(404).json({ ok: false, error: "CPR-01 mode not enabled for this customer" });
  res.json({ ok: true, dashboard, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-generation/confirm", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required", message: "Confirm service page generation before continuing." });
  }
  const outcome = confirmProductOwnerServicePageGeneration(slug, user, {
    operatorConfirmed: Boolean(req.body?.operatorConfirmed),
    initiationSource: req.body?.initiationSource === CPR_DASHBOARD_INITIATION_SOURCE ? CPR_DASHBOARD_INITIATION_SOURCE : String(req.body?.initiationSource || ""),
    regenerate: Boolean(req.body?.regenerate),
  });
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: outcome.error,
      blockers: outcome.blockers,
      dashboard: buildServicePageGenerationDashboard(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({
    ok: true,
    async: true,
    jobId: outcome.jobId,
    regenerate: Boolean(outcome.regenerate),
    dashboard: buildServicePageGenerationDashboard(slug),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/campaigns/:campaignId/locality-selection", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  const dashboard = buildCampaignLocalitySelectionDashboard(slug, campaignId);
  if (!dashboard.ok) return res.status(404).json({ ok: false, error: dashboard.error });
  res.json({ ok: true, selection: dashboard, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/campaigns/:campaignId/locality-selection", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "").trim();
  const areas = Array.isArray(req.body?.areas) ? req.body.areas : [];
  const outcome = updatePharmacyCampaignLocalitySelection(slug, campaignId, areas);
  if (!outcome.ok) return res.status(409).json({ ok: false, error: outcome.error });
  res.json({
    ok: true,
    campaign: outcome.campaign,
    selection: buildCampaignLocalitySelectionDashboard(slug, campaignId),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/locality-pages/generate", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required" });
  }
  const outcome = queueProductOwnerLocalityGeneration(slug, user, {
    operatorConfirmed: true,
    initiationSource:
      req.body?.initiationSource === CPR_DASHBOARD_INITIATION_SOURCE
        ? CPR_DASHBOARD_INITIATION_SOURCE
        : String(req.body?.initiationSource || ""),
    mode: "generate_all",
    campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
    serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
  });
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: outcome.error,
      blockers: outcome.blockers,
      jobId: outcome.jobId,
      selectedCount: outcome.selectedCount,
    });
  }
  res.json({
    ok: true,
    async: true,
    jobId: outcome.jobId,
    selectedCount: outcome.selectedCount,
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/locality-pages/regenerate-all", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required" });
  }
  const outcome = queueProductOwnerLocalityGeneration(slug, user, {
    operatorConfirmed: true,
    initiationSource:
      req.body?.initiationSource === CPR_DASHBOARD_INITIATION_SOURCE
        ? CPR_DASHBOARD_INITIATION_SOURCE
        : String(req.body?.initiationSource || ""),
    mode: "regenerate_all",
    campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
    serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
  });
  if (!outcome.ok) {
    return res.status(409).json({ ok: false, error: outcome.error, blockers: outcome.blockers, jobId: outcome.jobId });
  }
  res.json({ ok: true, async: true, jobId: outcome.jobId, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/locality-pages/regenerate-one", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required" });
  }
  const areaSlug = String(req.body?.areaSlug || "").trim();
  if (!areaSlug) return res.status(409).json({ ok: false, error: "area_slug_required" });
  const outcome = queueProductOwnerLocalityGeneration(slug, user, {
    operatorConfirmed: true,
    initiationSource:
      req.body?.initiationSource === CPR_DASHBOARD_INITIATION_SOURCE
        ? CPR_DASHBOARD_INITIATION_SOURCE
        : String(req.body?.initiationSource || ""),
    mode: "regenerate_one",
    areaSlug,
    campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
    serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
  });
  if (!outcome.ok) {
    return res.status(409).json({ ok: false, error: outcome.error, blockers: outcome.blockers, jobId: outcome.jobId });
  }
  res.json({ ok: true, async: true, jobId: outcome.jobId, areaSlug, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) return res.status(409).json({ ok: false, error: "confirmation_required" });
  const scope = {
    campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
    serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
  };
  const review = approveServicePageReview(slug, user, scope);
  if (!review) {
    return res.status(409).json({
      ok: false,
      error: "approval_blocked",
      review: buildServicePageReview(slug, scope),
    });
  }
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/service-page-review/reject", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const notes = String(req.body?.notes || "").trim();
  const review = rejectServicePageReview(slug, user, notes);
  if (!review) return res.status(404).json({ ok: false, error: "review_not_available" });
  res.json({ ok: true, review });
});

router.get("/master-admin-platform/customers/:slug/service-page-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const scope = {
    campaignId: req.query.campaignId ? String(req.query.campaignId) : undefined,
    serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
  };
  const review = buildServicePageReview(slug, scope);
  if (!review) return res.status(404).json({ ok: false, error: "Service page review not available yet" });
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/cluster-page-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const scope = {
    campaignId: req.query.campaignId ? String(req.query.campaignId) : undefined,
    serviceId: req.query.serviceId ? String(req.query.serviceId) : undefined,
  };
  const review = buildCprClusterReviewDashboard(slug, scope);
  if (!review) return res.status(404).json({ ok: false, error: "Cluster page review not available yet" });
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/cluster-page-review/approve", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) return res.status(409).json({ ok: false, error: "confirmation_required" });
  const scope = {
    campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
    serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
  };
  const review = approveCprClusterReview(slug, user, scope);
  if (!review || review.reviewStatus !== "approved") {
    return res.status(409).json({
      ok: false,
      error: "approval_blocked",
      review: buildCprClusterReviewDashboard(slug, scope),
    });
  }
  res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post(
  "/master-admin-platform/customers/:slug/cluster-page-review/localities/:areaSlug/decide",
  (req, res) => {
    const slug = safeAdminSlug(req.params.slug);
    const user = resolveUser(req);
    const areaSlug = String(req.params.areaSlug || "").trim();
    const decisionRaw = String(req.body?.decision || "").trim();
    const decision = decisionRaw === "rejected" ? "rejected" : decisionRaw === "approved" ? "approved" : "";
    if (!req.body?.operatorConfirmed) {
      return res.status(409).json({ ok: false, error: "confirmation_required" });
    }
    if (!areaSlug || !decision) {
      return res.status(409).json({ ok: false, error: "decision_required" });
    }
    const scope = {
      campaignId: req.body?.campaignId ? String(req.body.campaignId) : undefined,
      serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
    };
    const review = decideLocalityPageReview(slug, areaSlug, decision, user, scope);
    if (!review) {
      return res.status(404).json({
        ok: false,
        error: "locality_decision_unavailable",
        review: buildCprClusterReviewDashboard(slug, scope),
      });
    }
    res.json({ ok: true, review, customer: buildMasterAdminCustomerRecordLite(slug) });
  },
);

router.post("/master-admin-platform/customers/:slug/commercial-ecosystem-generation/confirm", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required", message: "Confirm ecosystem generation before continuing." });
  }
  if (isCoreProductRecoveryMode(slug)) {
    return res.status(409).json({ ok: false, error: "core_product_recovery_mode", message: "Generate Ecosystem is disabled for CPR-01 tenants." });
  }
  const outcome = confirmAuthorisedEcosystemGeneration(slug, user);
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: outcome.error,
      blockers: outcome.blockers,
      dashboard: buildCommercialEcosystemGenerationDashboard(slug),
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({
    ok: true,
    async: true,
    jobId: outcome.jobId,
    dashboard: buildCommercialEcosystemGenerationDashboard(slug),
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/search-console-dashboard", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, dashboard: buildPharmacySearchConsoleDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/commercial-indexing-review", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const dashboard = buildCommercialIndexingReviewDashboard(slug);
  const searchConsoleIntegration = buildPharmacySearchConsoleDashboard(slug);
  res.json({
    ok: true,
    dashboard: { ...dashboard, searchConsoleIntegration },
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/growth-dashboard", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, dashboard: buildMasterAdminIntegratedGrowthDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/commercial-indexing-review/request", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = await requestCommercialIndexing(slug, user, {
    operatorConfirmed: Boolean(req.body?.operatorConfirmed),
    campaignId: String(req.body?.campaignId || ""),
  });
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: "indexing_request_failed",
      message: outcome.errors[0] || "Indexing request failed",
      dashboard: outcome.dashboard,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({ ok: true, dashboard: outcome.dashboard, snapshot: outcome.snapshot, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/customers/:slug/commercial-performance-dashboard", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const dashboard = buildCommercialPerformanceDashboard(slug);
  const campaignId = String(req.query.campaignId || "").trim();
  const canonicalResults = campaignId ? resolveCanonicalCampaignResults({ tenantSlug: slug, campaignId }) : null;
  const searchConsoleIntegration = buildPharmacySearchConsoleDashboard(slug);
  res.json({
    ok: true,
    dashboard: { ...dashboard, searchConsoleIntegration, canonicalResults },
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/commercial-performance-dashboard/refresh", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  res.json({ ok: true, dashboard: refreshCommercialPerformanceDashboard(slug), customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.post("/master-admin-platform/customers/:slug/commercial-performance-dashboard/complete", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = acknowledgeCommercialPerformanceDashboard(slug, user);
  if (!outcome.ok) {
    return res.status(409).json({
      ok: false,
      error: "performance_dashboard_incomplete",
      message: outcome.errors[0] || "Performance Dashboard cannot be completed yet",
      dashboard: outcome.dashboard,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }
  res.json({ ok: true, dashboard: outcome.dashboard, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.get("/master-admin-platform/jobs/:jobId/publish-progress", (req, res) => {
  const progress = getCommercialPublishJobProgress(String(req.params.jobId));
  if (!progress) return res.status(404).json({ ok: false, error: "Job not found" });
  res.json({ ok: true, progress });
});

router.post("/master-admin-platform/workflow/validate", async (req, res) => {
  const result = await runCommercialOnboardingValidation(resolveUser(req));
  res.json({ ok: true, validation: result });
});

router.post("/master-admin-platform/customers/:slug/continue-workflow", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  const outcome = await continueCustomerWorkflowWithOnboardingBatch(slug, user, req.body || {});

  if (outcome.async && outcome.jobId) {
    return res.json({
      ok: true,
      async: true,
      jobId: outcome.jobId,
      outcome,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }

  if (!outcome.ok) {
    return res.status(outcome.blocked ? 409 : 400).json({
      ok: false,
      blocked: outcome.blocked,
      confirmationRequired: outcome.confirmationRequired,
      googleConfirmation: outcome.googleConfirmation,
      error: outcome.error,
      outcome,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }

  res.json({
    ok: true,
    outcome,
    customer: buildMasterAdminCustomerRecordLite(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/workflow-summary", (req, res) => {
  const start = performance.now();
  const slug = safeAdminSlug(req.params.slug);
  const summary = buildMasterAdminCustomerWorkflowSummary(slug);
  if (!summary) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({
    ok: true,
    slug,
    summary,
    timings: {
      routeMs: performance.now() - start,
      profileMs: profileMasterAdminCustomerWorkflowSummaryLoad(slug).totalMs,
    },
  });
});

router.get("/master-admin-platform/customers/:slug/technical-log", (req, res) => {
  const start = performance.now();
  const slug = safeAdminSlug(req.params.slug);
  const log = buildMasterAdminTechnicalLogLite(slug);
  if (!log) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({ ok: true, log, timings: { routeMs: performance.now() - start } });
});

router.get("/master-admin-platform/customers/:slug", (req, res) => {
  const start = performance.now();
  const slug = safeAdminSlug(req.params.slug);
  const full = req.query.full === "1" || req.query.full === "true";
  const profile = req.query.profile === "1" || req.query.profile === "true";
  const record = full ? buildMasterAdminCustomerRecord(slug) : buildMasterAdminCustomerRecordLite(slug);
  if (!record) return res.status(404).json({ ok: false, error: "Customer not found" });
  const loadTimings = profile ? profileMasterAdminCustomerRecordLoad(slug) : undefined;
  res.json({
    ok: true,
    customer: record,
    workflowSummary: (record as { workflowSummary?: unknown }).workflowSummary || buildMasterAdminCustomerWorkflowSummary(slug),
    meta: getClientMeta(slug),
    lite: !full,
    timings: {
      detailLoadMs: performance.now() - start,
      ...(loadTimings || {}),
    },
  });
});

router.post("/master-admin-platform/customers/:slug/campaigns/create", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const serviceId = String(req.body?.serviceId || "").trim();
  if (!serviceId) return res.status(400).json({ ok: false, error: "serviceId required" });
  if (!req.body?.operatorConfirmed) {
    return res.status(409).json({ ok: false, error: "confirmation_required" });
  }
  if (req.body?.initiationSource !== CPR_DASHBOARD_INITIATION_SOURCE) {
    return res.status(409).json({
      ok: false,
      error: "dashboard_only_required",
      message: "Campaign creation must be initiated from the Product Owner Master Dashboard",
    });
  }
  if (isNationalGrowthPlatform(slug)) {
    return res.status(409).json({
      ok: false,
      error: "national_patient_generator_not_applicable",
      message: "National commercial content generation is not implemented. Patient-service campaign creation is not used for NATIONAL tenants.",
    });
  }
  if (!isLockedCommercialSupportedService(serviceId)) {
    return res.status(409).json({
      ok: false,
      error: "service_not_in_locked_catalogue",
      message: "Select a service from the locked commercial service catalogue",
    });
  }
  if (!isServiceGenerationReady(serviceId)) {
    const readiness = resolveServiceGenerationReadiness(serviceId);
    return res.status(409).json({
      ok: false,
      error: "service_not_generation_ready",
      message: "This service is not generation-ready. Complete shared service setup before creating a campaign.",
      status: readiness?.status || "Setup Required",
      missingComponents: readiness?.missingComponents || [],
    });
  }
  try {
    const result = createPharmacyCampaign(slug, {
      serviceId,
      campaignGoal: "Promote NHS Service",
      areaSource: "profile",
    });
    const selection = selectActiveServiceCampaign(slug, result.campaign.id);
    if (!selection) {
      return res.status(500).json({ ok: false, error: "campaign_created_but_not_selectable" });
    }
    const campaign = resolveMasterAdminServiceCampaignSummary(slug, result.campaign.id);
    const customer = buildMasterAdminCustomerRecordLite(slug);
    if (!customer) return res.status(404).json({ ok: false, error: "Customer not found" });
    res.json({
      ok: true,
      created: true,
      campaign: {
        ...result.campaign,
        campaignId: result.campaign.id,
        ...(campaign || {}),
      },
      selection,
      customer,
      workflowSummary: customer.workflowSummary || buildMasterAdminCustomerWorkflowSummary(slug),
      autoGenerated: false,
      autoApproved: false,
      autoPublished: false,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return res.status(409).json({ ok: false, error: message });
  }
});

router.post("/master-admin-platform/customers/:slug/select-campaign", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const campaignId = String(req.body?.campaignId || "").trim();
  if (!campaignId) return res.status(400).json({ ok: false, error: "campaignId required" });
  const selection = selectActiveServiceCampaign(slug, campaignId);
  if (!selection) return res.status(404).json({ ok: false, error: "Active campaign not found" });
  const campaign = resolveMasterAdminServiceCampaignSummary(slug, campaignId);
  const customer = buildMasterAdminCustomerRecordLite(slug);
  if (!customer) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({
    ok: true,
    selection,
    campaign,
    customer,
    workflowSummary: customer.workflowSummary || buildMasterAdminCustomerWorkflowSummary(slug),
  });
});

router.post("/master-admin-platform/customers/:slug/clear-campaign", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  clearActiveServiceCampaignSelection(slug);
  const customer = buildMasterAdminCustomerRecordLite(slug);
  if (!customer) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({
    ok: true,
    customer,
    workflowSummary: customer.workflowSummary || buildMasterAdminCustomerWorkflowSummary(slug),
  });
});

router.get("/master-admin-platform/customers/:slug/detail-sections", (req, res) => {
  const start = performance.now();
  const slug = safeAdminSlug(req.params.slug);
  const sections = buildMasterAdminCustomerDetailSections(slug);
  if (!sections) return res.status(404).json({ ok: false, error: "Customer not found" });
  res.json({
    ok: true,
    slug,
    ...sections,
    timings: { detailSectionsMs: performance.now() - start },
  });
});

router.get("/master-admin-platform/system-health", (_req, res) => {
  res.json({ ok: true, health: getCachedMasterAdminSystemHealth(), cached: true });
});

router.post("/master-admin-platform/system-health/refresh", (req, res) => {
  const slug = req.body?.slug ? safeAdminSlug(String(req.body.slug)) : "broom-lane-pharmacy";
  const health = refreshMasterAdminSystemHealthCache(slug);
  res.json({ ok: true, health, cached: true });
});

router.get("/master-admin-platform/jobs", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : undefined;
  res.json({ ok: true, jobs: listMasterAdminJobs({ slug, limit: 50 }) });
});

router.get("/master-admin-platform/jobs/:jobId", (req, res) => {
  const job = getMasterAdminJob(String(req.params.jobId));
  if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
  const servicePageContract = buildServicePageJobContract(job);
  res.json({
    ok: true,
    job,
    servicePageContract,
    terminal: isTerminalMasterAdminJobStatus(job.status),
  });
});

router.get("/master-admin-platform/jobs/:jobId/trace", (req, res) => {
  const trace = traceQueuedJob(String(req.params.jobId));
  if (!trace) return res.status(404).json({ ok: false, error: "Job not found" });
  res.json({ ok: true, trace, workerHealth: readMasterAdminJobWorkerHealth() });
});

router.post("/master-admin-platform/jobs/queue/nudge", async (_req, res) => {
  const result = await nudgeMasterAdminJobQueue();
  res.json({ ok: true, ...result, workerHealth: readMasterAdminJobWorkerHealth() });
});

router.post("/master-admin-platform/jobs/:jobId/finalise-workflow", (req, res) => {
  const jobId = String(req.params.jobId);
  const reconcile = req.query.reconcile === "1" || req.body?.reconcile === true;
  const operator = resolveUser(req);
  const result = reconcile
    ? reconcileCompletedWorkflowJob(jobId, operator)
    : finalizeCompletedWorkflowJob(jobId, { operator });
  res.json({ ok: result.ok, result });
});

router.post("/master-admin-platform/jobs/:jobId/retry", (req, res) => {
  try {
    const job = retryMasterAdminJob(String(req.params.jobId), resolveUser(req), req.body || {});
    res.json({ ok: true, job });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/master-admin-platform/jobs/:jobId/cancel", (req, res) => {
  try {
    const job = cancelMasterAdminJob(String(req.params.jobId), resolveUser(req));
    if (!job) return res.status(404).json({ ok: false, error: "Job not found" });
    res.json({ ok: true, job });
  } catch (err) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.get("/master-admin-platform/capability-audit", (_req, res) => {
  res.json({ ok: true, capabilities: runMasterAdminCapabilityAudit() });
});

router.get("/master-admin-platform/operational-readiness", (_req, res) => {
  const report = readMasterAdminOperationalReadinessReport() || writeMasterAdminOperationalReadinessReport();
  res.json({ ok: true, report });
});

router.post("/master-admin-platform/operational-readiness/refresh", (_req, res) => {
  const report = writeMasterAdminOperationalReadinessReport();
  res.json({ ok: true, report });
});

router.get("/master-admin-platform/audit-log", (req, res) => {
  const slug = req.query.slug ? safeAdminSlug(String(req.query.slug)) : undefined;
  const limit = Number(req.query.limit || 100);
  res.json({ ok: true, entries: listMasterAdminAudit({ slug, limit }) });
});

router.get("/master-admin-platform/customers/:slug/onboarding-intake", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  try {
    res.json({ ok: true, intake: buildOnboardingIntakeForProfile(slug) });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/customers/:slug/onboarding-intake", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const user = resolveUser(req);
  try {
    const result = persistOnboardingIntake(slug, req.body || {}, user);
    res.json({ ok: true, ...result, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.get("/master-admin-platform/customers/:slug/onboarding-area-discovery", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  try {
    const discovery = getOnboardingAreaDiscoveryState(slug);
    res.json({ ok: true, discovery });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/customers/:slug/onboarding-area-discovery/refresh", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  try {
    const discovery = refreshOnboardingAreaDiscovery(slug);
    res.json({ ok: true, discovery });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/customers/:slug/onboarding-area-discovery/save", (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  try {
    const discovery = saveOnboardingAreaSelections(slug, {
      primaryTown: req.body.primaryTown ? String(req.body.primaryTown) : undefined,
      areas: Array.isArray(req.body.areas) ? req.body.areas : [],
      manualAreas: Array.isArray(req.body.manualAreas) ? req.body.manualAreas : undefined,
    });
    res.json({ ok: true, discovery, customer: buildMasterAdminCustomerRecordLite(slug) });
  } catch (error) {
    res.status(400).json({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});

router.post("/master-admin-platform/customers", async (req, res) => {
  const outcome = await executeMasterAdminAction("create_customer", "", resolveUser(req), req.body || {});
  if (!outcome.ok) return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit });
  const result = outcome.result as {
    slug: string;
    redirectUrl: string;
    username: string;
    temporaryPassword: string;
  };
  res.json({
    ok: true,
    ...result,
    customer: buildMasterAdminCustomerRecord(result.slug),
    audit: outcome.audit,
  });
});

router.post("/master-admin-platform/customers/:slug/actions/:actionId", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const actionId = String(req.params.actionId || "");
  const user = resolveUser(req);
  const body = req.body || {};

  if (actionId === "continue_workflow") {
    const outcome = await continueCustomerWorkflowWithOnboardingBatch(slug, user, body);
    if (outcome.async && outcome.jobId) {
      return res.json({ ok: true, async: true, job: getMasterAdminJob(outcome.jobId), outcome, customer: buildMasterAdminCustomerRecordLite(slug) });
    }
    if (!outcome.ok) {
      return res.status(outcome.blocked ? 409 : 400).json({
        ok: false,
        error: outcome.error,
        confirmationRequired: outcome.confirmationRequired,
        googleConfirmation: outcome.googleConfirmation,
        outcome,
        customer: buildMasterAdminCustomerRecordLite(slug),
      });
    }
    return res.json({ ok: true, outcome, customer: buildMasterAdminCustomerRecordLite(slug) });
  }

  if (actionId === "rerun_google_import") {
    const outcome = await executeMasterAdminAction(actionId, slug, user, body);
    if (!outcome.ok) {
      return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit, customer: buildMasterAdminCustomerRecordLite(slug) });
    }
    const jobId = (outcome.result as { jobId?: string })?.jobId;
    return res.json({
      ok: true,
      async: true,
      job: jobId ? getMasterAdminJob(jobId) : undefined,
      jobId,
      result: outcome.result,
      audit: outcome.audit,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }

  if (actionId === "rerun_website_import") {
    const outcome = await executeMasterAdminAction(actionId, slug, user, body);
    if (!outcome.ok) {
      return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit, customer: buildMasterAdminCustomerRecordLite(slug) });
    }
    const jobId = (outcome.result as { jobId?: string })?.jobId;
    return res.json({
      ok: true,
      async: true,
      job: jobId ? getMasterAdminJob(jobId) : undefined,
      jobId,
      result: outcome.result,
      audit: outcome.audit,
      customer: buildMasterAdminCustomerRecordLite(slug),
    });
  }

  if (isLongRunningMasterAdminAction(actionId)) {
    const job = createMasterAdminJob({ slug, action: actionId, user });
    runMasterAdminJobAsync(job.id, body);
    return res.json({ ok: true, async: true, job, message: `${actionId} queued as background job` });
  }

  const outcome = await executeMasterAdminAction(actionId, slug, user, body);

  if (actionId === "launch_bpi" && outcome.ok) {
    const redirectUrl = (outcome.result as { redirectUrl?: string })?.redirectUrl;
    if (redirectUrl && !req.headers.accept?.includes("application/json")) {
      return res.redirect(302, redirectUrl);
    }
  }

  if (actionId === "review_imports" || actionId === "resolve_conflicts" || actionId === "view_review_centre") {
    const record = buildMasterAdminCustomerRecord(slug);
    const redirectUrl = record?.urls.importReview;
    if (redirectUrl && !req.headers.accept?.includes("application/json")) {
      return res.redirect(302, redirectUrl);
    }
    if (redirectUrl) {
      return res.json({ ok: true, redirectUrl, audit: outcome.audit });
    }
  }

  if (actionId === "view_dashboard") {
    const record = buildMasterAdminCustomerRecord(slug);
    const url = record?.urls.customerDashboard;
    if (url && !req.headers.accept?.includes("application/json")) return res.redirect(302, url);
    return res.json({ ok: true, redirectUrl: url, audit: outcome.audit });
  }

  if (["open_customer_dashboard", "report_issue", "view_open_issues"].includes(actionId) && outcome.ok) {
    const redirectUrl = (outcome.result as { redirectUrl?: string })?.redirectUrl;
    if (redirectUrl && !req.headers.accept?.includes("application/json")) return res.redirect(302, redirectUrl);
    if (redirectUrl) return res.json({ ok: true, redirectUrl, audit: outcome.audit });
  }

  if (!outcome.ok) return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit });
  res.json({ ok: true, result: outcome.result, audit: outcome.audit, customer: buildMasterAdminCustomerRecordLite(slug) });
});

router.delete("/master-admin-platform/customers/:slug", async (req, res) => {
  const slug = safeAdminSlug(req.params.slug);
  const outcome = await executeMasterAdminAction("delete", slug, resolveUser(req));
  if (!outcome.ok) return res.status(400).json({ ok: false, error: outcome.error, audit: outcome.audit });
  res.json({ ok: true, audit: outcome.audit });
});

export default router;
