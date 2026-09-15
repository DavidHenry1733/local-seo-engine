/**
 * NT-E2E-32 — Fast customer workflow load (read persisted summaries only).
 * Heavy panel data loads via /customers/:slug/detail-sections or existing panel routes.
 */
import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { readMasterAdminRegistry, safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import { getPharmacyIndexingBridgeStatus } from "./pharmacyIndexingBridgeService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { buildCustomerWorkflowState, getWorkflowActionsForCustomer } from "./masterAdminWorkflowEngine.ts";
import { buildMasterAdminCustomerIssueSummary } from "./masterAdminIssueService.ts";
import { buildCustomerCanonicalStatuses, canonicalStatusLabel } from "./masterAdminCanonicalStatusService.ts";
import { getCustomerAccountSummary, getCustomerAccountDetail } from "./masterAdminAccountService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { buildGoogleSourceSummary } from "./masterAdminCanonicalGoogleService.ts";
import type { CustomerLifecycleStage } from "./masterAdminPlatformService.ts";
import { buildOnboardingSourcesSummary } from "./masterAdminOnboardingBatchService.ts";
import { mergeCustomerOperationalSummary } from "./masterAdminWebsiteImportWorkflowStateService.ts";
import {
  deriveCustomerLifecycle,
  getClientMeta,
  type MasterAdminCustomerRecord,
} from "./masterAdminPlatformService.ts";
import { resolveWorkflowIssueBlockers } from "./masterAdminWorkflowIssueBlockerService.ts";
import {
  buildPublishedReleaseVerification,
  readLatestCommercialPublishSnapshot,
  resolvePublishReviewProgressJob,
} from "./masterAdminCommercialPublishReviewService.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";

const LIFECYCLE_LABELS: Record<CustomerLifecycleStage, string> = {
  new: "NEW",
  import_running: "Import Running",
  awaiting_review: "Awaiting Review",
  awaiting_confirmation: "Awaiting Confirmation",
  generation_ready: "Generation Ready",
  generating: "Generating",
  ready_to_publish: "Ready To Publish",
  published: "Published",
  indexing: "Indexing",
  monitoring: "Monitoring",
  live_customer: "Live Customer",
  suspended: "Suspended",
  archived: "Archived",
};
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import {
  buildMasterAdminCustomerWorkflowSummary,
  type MasterAdminCustomerWorkflowSummary,
} from "./masterAdminCustomerWorkflowSummaryService.ts";
import {
  isCoreProductRecoveryMode,
  isServicePageEvidenceReviewApproved,
  isServicePageGeneratedForIdentity,
  isServicePageReviewApproved,
  isCprClusterGenerationEligible,
  isCprLocalClusterGenerationComplete,
  isCprClusterReviewApproved,
  isCprClusterReviewPending,
} from "./masterAdminCoreProductRecoveryService.ts";
import {
  buildMasterAdminServiceCampaignSummaries,
  readActiveServiceCampaignSelection,
  type MasterAdminServiceCampaignSummary,
} from "./masterAdminServiceCampaignSummaryService.ts";
import { buildMarketScopeSummary, isNationalMarketScope } from "./masterAdminMarketScopeService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { isNationalGrowthPlatform, resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolveTenantServiceCatalogue } from "./growthEngineTenantServiceCatalogue.ts";

export interface MasterAdminCustomerLoadTimings {
  totalMs: number;
  registryReadMs: number;
  profileReadMs: number;
  workflowMs: number;
  canonicalStatusMs: number;
  issueSummaryMs: number;
  accountMs: number;
  sourceSummariesMs: number;
  jobsMs: number;
}

function resolvePrimaryServiceId(slug: string, data: ReturnType<typeof normalizeProfileData>): string {
  if (data.selectedServices?.length) return String(data.selectedServices[0]);
  const session = loadCampaignBuilderSession(slug);
  if (session.selectedServiceId) return session.selectedServiceId;
  if (isNationalGrowthPlatform(slug)) {
    return resolveTenantServiceCatalogue(slug).services[0]?.serviceId || "";
  }
  return "pharmacy-first";
}

function deriveHealthLite(
  lifecycle: MasterAdminCustomerRecord["lifecycle"],
  openIssues: number,
): { health: MasterAdminCustomerRecord["health"]; healthLabel: string } {
  if (lifecycle === "archived") return { health: "offline", healthLabel: "Archived" };
  if (lifecycle === "suspended") return { health: "offline", healthLabel: "Suspended" };
  if (openIssues > 0) return { health: "warning", healthLabel: `${openIssues} open issue(s)` };
  if (lifecycle === "awaiting_review" || lifecycle === "import_running" || lifecycle === "new") {
    return { health: "warning", healthLabel: lifecycle === "awaiting_review" ? "Needs review" : "Setup in progress" };
  }
  return { health: "healthy", healthLabel: "Healthy" };
}

function buildLifecycleProgress(current: MasterAdminCustomerRecord["lifecycle"]): MasterAdminCustomerRecord["lifecycleProgress"] {
  const order: MasterAdminCustomerRecord["lifecycle"][] = [
    "new",
    "import_running",
    "awaiting_review",
    "awaiting_confirmation",
    "generation_ready",
    "generating",
    "ready_to_publish",
    "published",
    "indexing",
    "monitoring",
    "live_customer",
  ];
  const labels: Record<string, string> = {
    new: "NEW",
    import_running: "Import Running",
    awaiting_review: "Awaiting Review",
    awaiting_confirmation: "Awaiting Confirmation",
    generation_ready: "Generation Ready",
    generating: "Generating",
    ready_to_publish: "Ready To Publish",
    published: "Published",
    indexing: "Indexing",
    monitoring: "Monitoring",
    live_customer: "Live Customer",
  };
  const idx = order.indexOf(current);
  return order.map((id, i) => ({
    id,
    label: labels[id] || id,
    active: id === current,
    complete: idx >= 0 && i < idx,
  }));
}

export function buildMasterAdminCustomerRecordLite(slug: string): MasterAdminCustomerRecord | null {
  return buildMasterAdminCustomerRecordLiteInternal(slug);
}

function buildMasterAdminCustomerRecordLiteInternal(slug: string): MasterAdminCustomerRecord | null {
  const safe = safeAdminSlug(slug);
  const registry = readMasterAdminRegistry();
  const entry = registry.clients.find((c) => c.slug === safe);
  if (!entry) return null;

  const meta = getClientMeta(safe);
  const data = readSetupProfile(safe);
  let profileUpdatedAt = entry.updatedAt;
  try {
    const profileDoc = JSON.parse(fs.readFileSync(profilePath(safe), "utf8")) as { updatedAt?: string };
    profileUpdatedAt = profileDoc.updatedAt || profileUpdatedAt;
  } catch {
    /* use registry date */
  }

  const lifecycle = deriveCustomerLifecycle(safe, { archived: entry.archived, suspended: meta.suspended });
  const serviceId = resolvePrimaryServiceId(safe, data);
  const session = loadCampaignBuilderSession(safe);
  const live = getPharmacyLivePublishStatus(safe);
  const output = getPharmacyPublishOutputStatus(safe);
  const indexing = getPharmacyIndexingBridgeStatus(safe);
  const completeness = computeProfileCompleteness(data);
  const issueSummary = buildMasterAdminCustomerIssueSummary(safe);
  const workflow = buildCustomerWorkflowState(safe);
  const orchestration = workflow?.orchestration || null;
  const canonicalStatuses = buildCustomerCanonicalStatuses(safe, serviceId);
  const accountSummary = getCustomerAccountSummary(safe);
  const customerAccount = getCustomerAccountDetail(safe);
  const customerJobs = listMasterAdminJobs({ slug: safe, limit: 10 });
  const latestExecution = workflow?.executions?.[0];
  const health = deriveHealthLite(lifecycle, issueSummary.openCount);

  let generationStatus = "not_started";
  if (session.generationStartedAt && !session.generationCompletedAt) generationStatus = "in_progress";
  else if (canonicalStatuses.find((s) => s.id === "generation")?.status === "complete") generationStatus = "complete";

  const workflowSummary = buildMasterAdminCustomerWorkflowSummary(safe, workflow);
  const serviceCampaigns = buildMasterAdminServiceCampaignSummaries(safe);
  const activeCampaignSelection = readActiveServiceCampaignSelection(safe);
  const selectedServiceCampaign =
    serviceCampaigns.find((c) => c.selected) ||
    (activeCampaignSelection
      ? serviceCampaigns.find((c) => c.campaignId === activeCampaignSelection.campaignId) || null
      : null);
  const marketScopeSummary = buildMarketScopeSummary(safe, data);
  const growthPlatform = resolveGrowthPlatform(safe).platform;
  const tenantServiceCatalogue = resolveTenantServiceCatalogue(safe);
  const national = isNationalMarketScope(safe, data) || growthPlatform === "national";
  // National needs generationSetup on the live lite payload so Local Coverage does not fall back to town discovery.
  const generationSetup = national ? buildGenerationSetupState(safe) : (null as unknown as MasterAdminCustomerRecord["generationSetup"]);

  return {
    slug: safe,
    businessName: data.pharmacyName || entry.pharmacyName,
    website: data.website || "",
    lifecycle,
    lifecycleLabel: LIFECYCLE_LABELS[lifecycle],
    lifecycleProgress: buildLifecycleProgress(lifecycle),
    workflow,
    orchestration,
    completionPct: completeness.score,
    workflowCompletionPct: workflow?.completionPct ?? 0,
    currentStage: workflow?.currentStage || lifecycle,
    currentStageLabel: workflow?.currentStageLabel || lifecycle,
    nextAction: workflow?.nextAction?.label || "—",
    outstandingIssues: issueSummary.openCount,
    latestActivity: profileUpdatedAt || listMasterAdminAudit({ slug: safe, limit: 1 })[0]?.timestamp || "",
    generationStatus: canonicalStatusLabel(canonicalStatuses, "generation"),
    publishingStatus: canonicalStatusLabel(canonicalStatuses, "publishing"),
    indexingStatus: canonicalStatusLabel(canonicalStatuses, "indexing"),
    rankingStatus: canonicalStatusLabel(canonicalStatuses, "rank_tracking"),
    health: health.health,
    accountManager: meta.accountManager,
    issueSummary,
    canonicalStatuses,
    accountSummary,
    customerAccount,
    websiteSource: buildWebsiteSourceSummary(safe),
    googleSource: buildGoogleSourceSummary(safe),
    onboardingSources: buildOnboardingSourcesSummary(safe),
    businessProfileReview: null,
    deploymentConfiguration: {
      summary: { overallStatus: "LAZY", publishingReadiness: "Load panel for details" },
      approved: false,
      needsConfiguration: false,
      publishingEnabled: false,
      legacyExternal: false,
    },
    managedPublishing: {
      summary: { overallStatus: "LAZY", publishingReadiness: "Load panel for details" },
      managedUrl: "",
      dnsStatus: "unknown",
      sslStatus: "unknown",
      publishStatus: "unknown",
      ready: false,
    },
    operationalSummary: (() => {
      const stageId = (workflow?.currentStage || "create_customer") as import("./masterAdminWorkflowModel.ts").WorkflowStageId;
      const blockers = resolveWorkflowIssueBlockers(safe, stageId);
      let fallbackLatestEvidence =
        latestExecution?.evidence || workflow?.history?.[0]?.evidence || null;
      try {
        const managed = readManagedPublishingProfile(safe);
        const snapshot = readLatestCommercialPublishSnapshot(safe) as {
          serviceId?: string;
          completedAt?: string;
          currentRelease?: string;
        } | null;
        const progressJob = resolvePublishReviewProgressJob(safe, managed?.currentRelease || null);
        const verification = buildPublishedReleaseVerification({
          slug: safe,
          serviceId: String(snapshot?.serviceId || "").trim(),
          currentRelease: managed?.currentRelease || snapshot?.currentRelease || null,
          completedPublishJobId: progressJob?.status === "completed" ? progressJob.id : null,
        });
        if (verification.status === "PASS") {
          fallbackLatestEvidence = `${verification.label} · ${verification.publishedRelease} · ${verification.campaignPages.total} published URL(s)`;
        }
      } catch {
        /* keep prior evidence */
      }
      return mergeCustomerOperationalSummary({
        slug: safe,
        fallbackLatestEvidence,
        fallbackBlockingIssues: blockers.blocked
          ? [blockers.reason || `${blockers.blockingIssues.length} blocking issue(s)`]
          : orchestration?.blockingReason && !orchestration?.canContinue
            ? [orchestration.blockingReason]
            : [],
        customerReady: workflow?.currentStage === "live_customer",
        welcomeDraftAvailable: Boolean(customerAccount.welcomeEmailDraft),
        jobs: customerJobs,
      });
    })(),
    sections: {
      businessProfile: {
        pharmacyName: data.pharmacyName,
        website: data.website,
        phone: data.phone,
        email: data.businessEmail || data.email,
        town: data.primaryTown,
        postcode: data.postcode,
        country: data.country,
        marketScope: marketScopeSummary.marketScope,
        primaryMarket: marketScopeSummary.primaryMarket,
        platformClientStatus: data.platformClientStatus,
        completenessPct: completeness.score,
      },
      websiteIntelligence: (data.websiteImportSnapshot as Record<string, unknown>) || {},
      brandDna: {},
      componentDna: {},
      businessIntelligence: { lazy: true },
      googleIntelligence: {},
      competitorIntelligence: { lazy: true },
      growthIntelligence: { lazy: true },
      publishing: { live, output },
      indexing,
      rankTracking: { lazy: true },
      reports: { lazy: true },
      activityTimeline: [],
    },
    actions: getWorkflowActionsForCustomer(safe),
    urls: {
      customerDashboard: `/api/pharmacy-dashboard?slug=${encodeURIComponent(safe)}`,
      reviewCentre: `/api/growth-engine/review-centre?slug=${encodeURIComponent(safe)}`,
      growthEngine: `/api/growth-engine?slug=${encodeURIComponent(safe)}`,
      importReview: `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(safe)}`,
      reportIssue: `/api/admin/master/issues/new?slug=${encodeURIComponent(safe)}`,
      openIssues: `/api/admin/master/issues?slug=${encodeURIComponent(safe)}`,
      adminCustomerAccess: `/api/admin/master/customer-access/${encodeURIComponent(safe)}`,
      businessProfileReview: `/api/admin/master?customer=${encodeURIComponent(safe)}&panel=business-profile-review`,
      deploymentConfiguration: `/api/admin/master?customer=${encodeURIComponent(safe)}&panel=legacy-deployment-configuration`,
      managedPublishing: `/api/admin/master?customer=${encodeURIComponent(safe)}&panel=managed-publishing`,
      platformInfrastructure: `/api/admin/master?panel=platform-infrastructure`,
      legacyDeploymentConfiguration: `/api/admin/master?customer=${encodeURIComponent(safe)}&panel=legacy-deployment-configuration`,
    },
    generationSetup,
    marketScope: marketScopeSummary,
    workflowSummary: workflowSummary as MasterAdminCustomerWorkflowSummary | null,
    coreProductRecovery: isCoreProductRecoveryMode(safe)
      ? {
          enabled: true,
          mode: "cpr01_service_page_only",
          servicePageGenerated: isServicePageGeneratedForIdentity(
            safe,
            selectedServiceCampaign?.serviceId || serviceId,
            selectedServiceCampaign?.campaignId || null,
          ),
          evidenceReviewApproved: isServicePageEvidenceReviewApproved(
            safe,
            selectedServiceCampaign?.serviceId || serviceId,
            selectedServiceCampaign?.campaignId || null,
          ),
          servicePageReviewApproved: isServicePageReviewApproved(safe),
          clusterEligible: isCprClusterGenerationEligible(safe),
          clusterComplete: isCprLocalClusterGenerationComplete(safe),
          clusterReviewApproved: isCprClusterReviewApproved(safe),
          clusterReviewPending: isCprClusterReviewPending(safe),
        }
      : null,
    serviceCampaigns: serviceCampaigns as MasterAdminServiceCampaignSummary[],
    selectedServiceCampaign: selectedServiceCampaign as MasterAdminServiceCampaignSummary | null,
    selectedCampaignId: selectedServiceCampaign?.campaignId || null,
    growthPlatform,
    tenantServiceCatalogue: {
      platform: tenantServiceCatalogue.platform,
      source: tenantServiceCatalogue.source,
      services: tenantServiceCatalogue.services.map((s) => ({
        serviceId: s.serviceId,
        serviceName: s.serviceName,
        href: s.href,
      })),
    },
  };
}

export function buildMasterAdminCustomerDetailSections(slug: string): {
  lazy: true;
  message: string;
  workflowSummary: ReturnType<typeof buildMasterAdminCustomerWorkflowSummary>;
} | null {
  const workflowSummary = buildMasterAdminCustomerWorkflowSummary(slug);
  if (!workflowSummary) return null;
  return {
    lazy: true,
    message: "Heavy customer sections load via panel routes only — not during initial customer selection.",
    workflowSummary,
  };
}

export function profileMasterAdminCustomerRecordLoad(slug: string): MasterAdminCustomerLoadTimings {
  const totalStart = performance.now();
  const safe = safeAdminSlug(slug);

  let registryReadMs = 0;
  let profileReadMs = 0;
  let workflowMs = 0;
  let canonicalStatusMs = 0;
  let issueSummaryMs = 0;
  let accountMs = 0;
  let sourceSummariesMs = 0;
  let jobsMs = 0;

  const t0 = performance.now();
  const registry = readMasterAdminRegistry();
  registryReadMs = performance.now() - t0;
  const entry = registry.clients.find((c) => c.slug === safe);
  if (!entry) {
    return {
      totalMs: performance.now() - totalStart,
      registryReadMs,
      profileReadMs: 0,
      workflowMs: 0,
      canonicalStatusMs: 0,
      issueSummaryMs: 0,
      accountMs: 0,
      sourceSummariesMs: 0,
      jobsMs: 0,
    };
  }

  const t1 = performance.now();
  readSetupProfile(safe);
  profileReadMs = performance.now() - t1;

  const t2 = performance.now();
  buildCustomerWorkflowState(safe);
  workflowMs = performance.now() - t2;

  const data = readSetupProfile(safe);
  const serviceId = resolvePrimaryServiceId(safe, data);

  const t3 = performance.now();
  buildCustomerCanonicalStatuses(safe, serviceId);
  canonicalStatusMs = performance.now() - t3;

  const t4 = performance.now();
  buildMasterAdminCustomerIssueSummary(safe);
  issueSummaryMs = performance.now() - t4;

  const t5 = performance.now();
  getCustomerAccountSummary(safe);
  getCustomerAccountDetail(safe);
  accountMs = performance.now() - t5;

  const t6 = performance.now();
  buildWebsiteSourceSummary(safe);
  buildGoogleSourceSummary(safe);
  buildOnboardingSourcesSummary(safe);
  sourceSummariesMs = performance.now() - t6;

  const t7 = performance.now();
  listMasterAdminJobs({ slug: safe, limit: 10 });
  jobsMs = performance.now() - t7;

  return {
    totalMs: performance.now() - totalStart,
    registryReadMs,
    profileReadMs,
    workflowMs,
    canonicalStatusMs,
    issueSummaryMs,
    accountMs,
    sourceSummariesMs,
    jobsMs,
  };
}
