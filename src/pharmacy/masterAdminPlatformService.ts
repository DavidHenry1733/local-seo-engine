/**
 * Master Admin Platform V1 — commercial operational control centre.
 * Orchestrates existing services; does not modify generation/rendering engines.
 */
import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { buildPharmacyPlatformDashboard } from "./pharmacyPlatformDashboardService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { contentPackageGenerated, loadContentPackage, generateContentPackage } from "./pharmacyContentPackageService.ts";
import {
  archivePharmacyClient,
  deleteDemoPharmacyClient,
  readMasterAdminRegistry,
  restoreArchivedPharmacyClient,
  safeAdminSlug,
  type MasterAdminRegistryEntry,
} from "./pharmacyMasterAdminService.ts";
import {
  createCommercialPharmacyCustomer,
  type CommercialPharmacyCreateInput,
} from "./masterAdminCommercialOnboardingService.ts";
import {
  readSetupProfile,
  runSetupGoogleImport,
  runSetupWebsiteImport,
} from "./growthEngineCustomerSetupImportSplitService.ts";
import { runCustomerSetupConfirm } from "./growthEngineCustomerSetupConfirmService.ts";
import { buildGrowthEngineFramework } from "./growthEngineFrameworkService.ts";
import {
  campaignBuilderReadyToPublish,
  loadCampaignBuilderSession,
  selectCampaignBuilderService,
} from "./growthEngineCampaignBuilderService.ts";
import {
  buildCustomerCampaignGenerationContext,
  freezeCustomerCampaignGenerationContext,
} from "./contentEngine/customerCampaignGenerationContext.ts";
import {
  buildCanonicalEcosystemGenerationPlan,
  readCanonicalEcosystemGenerationPlan,
} from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { rebuildPharmacyProductionImageAssignments } from "./imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts";
import { persistCanonicalImageInventory } from "./pharmacyCanonicalImageInventoryService.ts";
import { runImageParityGate } from "./pharmacyImageParityGateService.ts";
import { buildCanonicalFinalRender } from "./pharmacyCanonicalFinalRenderService.ts";
import { markServicePageGenerationComplete } from "./masterAdminCoreProductRecoveryService.ts";
import { validateServicePageOutputScope } from "./masterAdminCoreProductRecoveryOutputScopeService.ts";
import {
  SERVICE_PAGE_GENERATION_SCOPE,
  validateServicePageTenantContextGate,
} from "./pharmacyServicePageTenantContextService.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import { readAuthorisedEcosystemGenerationRecord } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  deployPharmacyPublishOutput,
  getPharmacyLivePublishStatus,
  preparePharmacyPublishOutput,
} from "./pharmacyLivePublishService.ts";
import { getPharmacyPublishOutputStatus } from "./pharmacyPublishOutputService.ts";
import {
  getPharmacyIndexingBridgeStatus,
  registerPharmacyPages,
  submitReadyPharmacyPages,
} from "./pharmacyIndexingBridgeService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  listMasterAdminAudit,
  recordMasterAdminAudit,
  type MasterAdminAuditEntry,
} from "./masterAdminAuditService.ts";
import { buildWizardImportFields, countImportSummary } from "./pharmacyProfileWizardEnrichment.ts";
import { buildMasterAdminDashboardLite, buildMasterAdminCustomerListLite } from "./masterAdminDashboardLiteService.ts";
import {
  getCachedMasterAdminSystemHealth,
  writeMasterAdminHealthCache,
} from "./masterAdminHealthCacheService.ts";
import { buildMasterAdminCustomerIssueSummary } from "./masterAdminIssueService.ts";
import type { MasterAdminCustomerIssueSummary } from "./masterAdminIssueModel.ts";
import { openMasterAdminCustomerDashboardAccess } from "./masterAdminCustomerAccessService.ts";
import { buildCustomerWorkflowState, getWorkflowActionsForCustomer } from "./masterAdminWorkflowEngine.ts";
import type { CustomerWorkflowState } from "./masterAdminWorkflowModel.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { continueCustomerWorkflow } from "./masterAdminWorkflowOrchestrator.ts";
import {
  buildCustomerCanonicalStatuses,
  canonicalStatusLabel,
  type CanonicalStatusRecord,
} from "./masterAdminCanonicalStatusService.ts";
import {
  createCustomerAccount,
  disableCustomerLogin,
  getCustomerAccountSummary,
  getCustomerAccountDetail,
  prepareWelcomeCredentialsDraft,
  resetCustomerPassword,
  restoreCustomerLogin,
} from "./masterAdminAccountService.ts";
import {
  buildOnboardingSourcesSummary,
  reconcileExistingTenantOnboardingBatch,
  retryFailedOnboardingSource,
} from "./masterAdminOnboardingBatchService.ts";
import { mergeCustomerOperationalSummary } from "./masterAdminWebsiteImportWorkflowStateService.ts";
import { resolveWebsiteIntelligenceReimportState } from "./masterAdminWebsiteIntelligenceReimportState.ts";
import { resolveWorkflowIssueBlockers } from "./masterAdminWorkflowIssueBlockerService.ts";
import {
  buildPublishedReleaseVerification,
  readLatestCommercialPublishSnapshot,
  resolvePublishReviewProgressJob,
} from "./masterAdminCommercialPublishReviewService.ts";
import type { WorkflowStageId } from "./masterAdminWorkflowModel.ts";
import {
  buildWebsiteSourceSummary,
  queueRerunWebsiteImport,
  updateCanonicalWebsite,
} from "./masterAdminCanonicalWebsiteService.ts";
import {
  addOrUpdateGoogleBusinessProfile,
  assertGoogleImportAllowed,
  buildGoogleSourceSummary,
  confirmGoogleBusinessProfileIdentity,
  reconcileConfirmedGoogleImportPersistence,
  persistGoogleIntelligenceFromImport,
  queueRerunGoogleImport,
  readGoogleIntelligenceRecord,
  rejectGoogleBusinessProfileIdentity,
  searchGoogleBusinessProfileAgain,
  readGoogleIdentityRecord,
} from "./masterAdminCanonicalGoogleService.ts";
import {
  approveBusinessProfileReview,
  buildBusinessProfileReview,
  isBusinessProfileReviewApproved,
  saveBusinessProfileReview,
} from "./masterAdminBusinessProfileReviewService.ts";
import type { BusinessProfileReviewPayload } from "./masterAdminBusinessProfileReviewModel.ts";
import { resolveActiveServiceIdsForTenant } from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import { buildCommercialDeploymentReview, isCommercialDeploymentApproved } from "./masterAdminCommercialDeploymentService.ts";
import {
  buildManagedPublishingReview,
  readManagedPublishingProfile,
} from "./masterAdminManagedPublishingService.ts";
import { ensureComponentDnaPersisted } from "./masterAdminComponentDnaPersistenceService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { buildMarketScopeSummary } from "./masterAdminMarketScopeService.ts";

export type CustomerLifecycleStage =
  | "new"
  | "import_running"
  | "awaiting_review"
  | "awaiting_confirmation"
  | "generation_ready"
  | "generating"
  | "ready_to_publish"
  | "published"
  | "indexing"
  | "monitoring"
  | "live_customer"
  | "suspended"
  | "archived";

export const CUSTOMER_LIFECYCLE_STAGES: Array<{ id: CustomerLifecycleStage; label: string }> = [
  { id: "new", label: "NEW" },
  { id: "import_running", label: "Import Running" },
  { id: "awaiting_review", label: "Awaiting Review" },
  { id: "awaiting_confirmation", label: "Awaiting Confirmation" },
  { id: "generation_ready", label: "Generation Ready" },
  { id: "generating", label: "Generating" },
  { id: "ready_to_publish", label: "Ready To Publish" },
  { id: "published", label: "Published" },
  { id: "indexing", label: "Indexing" },
  { id: "monitoring", label: "Monitoring" },
  { id: "live_customer", label: "Live Customer" },
];

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

export interface MasterAdminClientMeta {
  slug: string;
  suspended: boolean;
  suspendedAt?: string;
  accountManager: string;
  passwordResetToken?: string;
  passwordResetTokenCreatedAt?: string;
  credentials?: {
    username: string;
    password?: string;
    generatedAt: string;
    loginUrl: string;
  };
}

export interface MasterAdminCustomerListRow {
  slug: string;
  businessName: string;
  website: string;
  lifecycle: CustomerLifecycleStage;
  lifecycleLabel: string;
  currentStage: string;
  currentStageLabel: string;
  nextAction: string;
  outstandingIssues: number;
  completionPct: number;
  workflowCompletionPct: number;
  generationStatus: string;
  publishingStatus: string;
  indexingStatus: string;
  rankingStatus: string;
  lastActivity: string;
  accountManager: string;
  health: "healthy" | "warning" | "offline";
  healthLabel: string;
  isDemo: boolean;
  archived: boolean;
  suspended: boolean;
  loadError?: string;
}

export interface MasterAdminCustomerRecord {
  slug: string;
  businessName: string;
  website: string;
  lifecycle: CustomerLifecycleStage;
  lifecycleLabel: string;
  lifecycleProgress: Array<{ id: CustomerLifecycleStage; label: string; active: boolean; complete: boolean }>;
  workflow: CustomerWorkflowState | null;
  orchestration: CustomerWorkflowState["orchestration"] | null;
  completionPct: number;
  workflowCompletionPct: number;
  currentStage: string;
  currentStageLabel: string;
  nextAction: string;
  outstandingIssues: number;
  latestActivity: string;
  generationStatus: string;
  publishingStatus: string;
  indexingStatus: string;
  rankingStatus: string;
  health: "healthy" | "warning" | "offline";
  accountManager: string;
  issueSummary: MasterAdminCustomerIssueSummary;
  canonicalStatuses: CanonicalStatusRecord[];
  accountSummary: ReturnType<typeof getCustomerAccountSummary>;
  customerAccount: ReturnType<typeof getCustomerAccountDetail>;
  websiteSource: ReturnType<typeof buildWebsiteSourceSummary>;
  googleSource: ReturnType<typeof buildGoogleSourceSummary>;
  onboardingSources: ReturnType<typeof buildOnboardingSourcesSummary>;
  /** When set, Product Owner should deliberately re-run website import (existing rerun_website_import). */
  websiteIntelligenceReimport: ReturnType<typeof resolveWebsiteIntelligenceReimportState>;
  businessProfileReview: BusinessProfileReviewPayload | null;
  deploymentConfiguration: {
    summary: ReturnType<typeof buildCommercialDeploymentReview>["summary"];
    approved: boolean;
    needsConfiguration: boolean;
    publishingEnabled: boolean;
    legacyExternal: boolean;
  };
  managedPublishing: {
    summary: ReturnType<typeof buildManagedPublishingReview>["summary"];
    managedUrl: string;
    dnsStatus: string;
    sslStatus: string;
    publishStatus: string;
    ready: boolean;
  };
  operationalSummary: {
    latestEvidence: string | null;
    blockingIssues: string[];
    customerReady: boolean;
    welcomeDraftAvailable: boolean;
    jobs: ReturnType<typeof listMasterAdminJobs>;
  };
  sections: {
    businessProfile: Record<string, unknown>;
    websiteIntelligence: Record<string, unknown>;
    brandDna: Record<string, unknown>;
    componentDna: Record<string, unknown>;
    businessIntelligence: Record<string, unknown>;
    googleIntelligence: Record<string, unknown>;
    competitorIntelligence: Record<string, unknown>;
    growthIntelligence: Record<string, unknown>;
    publishing: Record<string, unknown>;
    indexing: Record<string, unknown>;
    rankTracking: Record<string, unknown>;
    reports: Record<string, unknown>;
    activityTimeline: MasterAdminAuditEntry[];
  };
  actions: MasterAdminActionDef[];
  urls: {
    customerDashboard: string;
    reviewCentre: string;
    growthEngine: string;
    importReview: string;
    reportIssue: string;
    openIssues: string;
    adminCustomerAccess: string;
    businessProfileReview: string;
    deploymentConfiguration: string;
    managedPublishing: string;
    platformInfrastructure: string;
    legacyDeploymentConfiguration: string;
  };
  generationSetup: ReturnType<typeof buildGenerationSetupState>;
  marketScope: ReturnType<typeof buildMarketScopeSummary>;
  serviceCampaigns?: Array<{
    campaignId: string;
    serviceId: string;
    serviceName: string;
    campaignName: string;
    campaignGoal: string;
    status: string;
    statusLabel: string;
    currentStage: string;
    nextAction: string;
    nextActionPanel: string | null;
    servicePageStatus: string;
    localPageStatus: string;
    publishStatus: string;
    rankingsStatus: string;
    openUrl: string;
    detailUrl: string;
    selected: boolean;
  }>;
  selectedServiceCampaign?: {
    campaignId: string;
    serviceId: string;
    serviceName: string;
    campaignName: string;
    campaignGoal: string;
    status: string;
    statusLabel: string;
    currentStage: string;
    nextAction: string;
    nextActionPanel: string | null;
    servicePageStatus: string;
    localPageStatus: string;
    publishStatus: string;
    rankingsStatus: string;
    openUrl: string;
    detailUrl: string;
    selected: boolean;
  } | null;
  selectedCampaignId?: string | null;
  growthPlatform?: "local" | "national";
  tenantServiceCatalogue?: {
    platform: "local" | "national";
    source: "project-commercial" | "pharmacy-patient-catalogue";
    services: Array<{ serviceId: string; serviceName: string; href?: string }>;
  };
}

export interface MasterAdminActionDef {
  id: string;
  label: string;
  group: string;
  enabled: boolean;
  reason?: string;
}

export type SystemHealthLevel = "healthy" | "warning" | "not_initialised" | "offline";

export interface MasterAdminSystemHealthItem {
  id: string;
  label: string;
  status: SystemHealthLevel;
  statusLabel: string;
  lastSuccessfulRun: string | null;
  lastAttemptedRun?: string | null;
  lastError?: string | null;
  evidenceSource?: string;
  detail: string;
  retryAction?: string | null;
}

const META_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "client-meta.json");

function readMetaStore(): Record<string, MasterAdminClientMeta> {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as Record<string, MasterAdminClientMeta>;
  } catch {
    return {};
  }
}

function writeMetaStore(store: Record<string, MasterAdminClientMeta>): void {
  fs.mkdirSync(path.dirname(META_PATH), { recursive: true });
  fs.writeFileSync(META_PATH, JSON.stringify(store, null, 2));
}

export function getClientMeta(slug: string): MasterAdminClientMeta {
  const safe = safeAdminSlug(slug);
  const store = readMetaStore();
  return (
    store[safe] || {
      slug: safe,
      suspended: false,
      accountManager: "Unassigned",
    }
  );
}

export function saveClientMeta(meta: MasterAdminClientMeta): MasterAdminClientMeta {
  const store = readMetaStore();
  store[meta.slug] = meta;
  writeMetaStore(store);
  return meta;
}

function readProfileDoc(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      slug?: string;
      updatedAt?: string;
      data?: Record<string, unknown>;
    };
  } catch {
    return null;
  }
}

function resolvePrimaryServiceId(slug: string, data: ReturnType<typeof normalizeProfileData>): string {
  // Campaign Manager selection wins so a newly created service campaign (e.g. Travel Clinic)
  // starts at Service Evidence without re-running website import / business profile.
  const session = loadCampaignBuilderSession(slug);
  if (session.selectedServiceId) return session.selectedServiceId;
  try {
    const active = resolveActiveServiceIdsForTenant(slug);
    if (active.length) return active[0];
  } catch {
    /* fall through */
  }
  const selected = data.selectedServices || [];
  if (selected.length) return String(selected[0]);
  return "pharmacy-first";
}

function rankTrackingSummary(slug: string): { status: string; keywords: number; generatedAt: string } {
  const file = path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
  if (!fs.existsSync(file)) return { status: "not_started", keywords: 0, generatedAt: "" };
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as {
      generatedAt?: string;
      summary?: { keywordsCount?: number };
    };
    const keywords = doc.summary?.keywordsCount || 0;
    return {
      status: keywords > 0 ? "active" : "limited",
      keywords,
      generatedAt: doc.generatedAt || "",
    };
  } catch {
    return { status: "error", keywords: 0, generatedAt: "" };
  }
}

function formatWorkflowStatus(code: string): string {
  const map: Record<string, string> = {
    not_started: "Not started",
    in_progress: "In progress",
    complete: "Complete",
    active: "Active",
    limited: "Limited data",
    published: "Published",
    ready: "Ready",
    pending: "Pending",
    submitted: "Submitted",
    indexed: "Indexed",
    failed: "Failed",
    not_started_rank: "Not initialised",
  };
  return map[code] || code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function deriveCustomerLifecycle(
  slug: string,
  options?: { archived?: boolean; suspended?: boolean },
): CustomerLifecycleStage {
  if (options?.archived) return "archived";
  if (options?.suspended) return "suspended";

  const data = readSetupProfile(slug);
  const serviceId = resolvePrimaryServiceId(slug, data);
  const generated = contentPackageGenerated(slug, serviceId);
  const session = loadCampaignBuilderSession(slug);
  const live = getPharmacyLivePublishStatus(slug);
  const indexing = getPharmacyIndexingBridgeStatus(slug);
  const rank = rankTrackingSummary(slug);

  const hasWebsiteImport = Boolean(data.websiteImportSnapshot);
  const hasGoogleImport = Boolean(data.googleImportSnapshot);
  const importFields = buildWizardImportFields(data);
  const importSummary = countImportSummary(importFields);
  const googleMatch = data.customerSetupGoogleMatchStatus || "none";
  const platformStatus = data.platformClientStatus || "setup_required";

  if (platformStatus === "setup_required" && !hasWebsiteImport && !hasGoogleImport) {
    return "new";
  }

  if (
    (data.lastWebsiteImportDebug && !hasWebsiteImport) ||
    (data.lastGoogleImportDebug && !hasGoogleImport && googleMatch === "pending")
  ) {
    return "import_running";
  }

  if (hasWebsiteImport || hasGoogleImport) {
    if (importSummary.missing > 0 || googleMatch === "pending" || googleMatch === "candidates") {
      return "awaiting_review";
    }
    if (platformStatus === "setup_required" || platformStatus === "setup_in_progress") {
      return "awaiting_confirmation";
    }
  }

  if (session.generationStartedAt && !session.generationCompletedAt) {
    return "generating";
  }

  if (!generated && (platformStatus === "active" || platformStatus === "profile_approved" || importSummary.confirmed > 0)) {
    return "generation_ready";
  }

  if (generated && !live.lastPublishedAt) {
    return campaignBuilderReadyToPublish(slug) ? "ready_to_publish" : "generation_ready";
  }

  if (live.lastPublishedAt) {
    const summary = indexing.summary || {
      submitted: 0,
      totalRegistered: 0,
      indexed: 0,
    };
    const pendingIndex = summary.submitted < summary.totalRegistered && summary.indexed < summary.totalRegistered;
    if (pendingIndex && summary.totalRegistered > 0) return "indexing";
    if (rank.keywords > 0) return "live_customer";
    if (summary.indexed > 0 || summary.submitted > 0) return "monitoring";
    return "published";
  }

  return "new";
}

function deriveHealth(
  lifecycle: CustomerLifecycleStage,
  blockers: string[],
): { health: "healthy" | "warning" | "offline"; healthLabel: string } {
  if (lifecycle === "archived" || lifecycle === "suspended") {
    return { health: "offline", healthLabel: LIFECYCLE_LABELS[lifecycle] };
  }
  if (blockers.length > 0 || lifecycle === "awaiting_review") {
    return { health: "warning", healthLabel: blockers[0] || "Needs attention" };
  }
  if (lifecycle === "live_customer" || lifecycle === "monitoring" || lifecycle === "published") {
    return { health: "healthy", healthLabel: "Healthy" };
  }
  if (lifecycle === "new" || lifecycle === "import_running") {
    return { health: "warning", healthLabel: "Setup in progress" };
  }
  return { health: "healthy", healthLabel: "On track" };
}

function buildLifecycleProgress(current: CustomerLifecycleStage): MasterAdminCustomerRecord["lifecycleProgress"] {
  const order = CUSTOMER_LIFECYCLE_STAGES.map((s) => s.id);
  const idx = order.indexOf(current);
  return CUSTOMER_LIFECYCLE_STAGES.map((stage, i) => ({
    id: stage.id,
    label: stage.label,
    active: stage.id === current,
    complete: idx >= 0 && i < idx,
  }));
}

function buildCustomerActions(slug: string, lifecycle: CustomerLifecycleStage): MasterAdminActionDef[] {
  const data = readSetupProfile(slug);
  const serviceId = resolvePrimaryServiceId(slug, data);
  const generated = contentPackageGenerated(slug, serviceId);
  const live = getPharmacyLivePublishStatus(slug);
  const meta = getClientMeta(slug);

  const disabled = (reason: string): Pick<MasterAdminActionDef, "enabled" | "reason"> => ({
    enabled: false,
    reason,
  });

  return [
    { id: "import_website", label: "Import Website", group: "Import", enabled: lifecycle !== "archived" && !meta.suspended },
    { id: "import_google", label: "Import Google", group: "Import", enabled: lifecycle !== "archived" && !meta.suspended },
    { id: "launch_bpi", label: "Business Profile Intelligence", group: "Import", enabled: lifecycle !== "archived" && !meta.suspended },
    { id: "review_imports", label: "Review Import Results", group: "Review", enabled: Boolean(data.websiteImportSnapshot || data.googleImportSnapshot) },
    { id: "resolve_conflicts", label: "Resolve Import Conflicts", group: "Review", enabled: lifecycle === "awaiting_review" || lifecycle === "awaiting_confirmation" },
    { id: "approve_profile", label: "Approve Customer Profile", group: "Review", enabled: lifecycle === "awaiting_confirmation" || lifecycle === "awaiting_review" },
    { id: "generate_ecosystem", label: "Generate Ecosystem", group: "Generate", enabled: !generated && !meta.suspended, ...(generated ? disabled("Already generated") : {}) },
    { id: "publish", label: "Publish", group: "Publish", enabled: generated && !live.lastPublishedAt, ...(live.lastPublishedAt ? disabled("Already published") : {}) },
    { id: "request_indexing", label: "Request Indexing", group: "Index", enabled: Boolean(live.lastPublishedAt) },
    { id: "init_rank_tracking", label: "Initialise Rank Tracking", group: "Track", enabled: Boolean(live.lastPublishedAt) },
    { id: "open_customer_dashboard", label: "Open Customer Dashboard", group: "Support", enabled: lifecycle !== "archived" },
    { id: "report_issue", label: "Report Issue", group: "Support", enabled: true },
    { id: "view_open_issues", label: "View Open Issues", group: "Support", enabled: true },
    { id: "view_dashboard", label: "View Customer Dashboard (legacy link)", group: "Navigate", enabled: true },
    { id: "view_health", label: "View Health", group: "Navigate", enabled: true },
    { id: "view_logs", label: "View Logs", group: "Navigate", enabled: true },
    { id: "generate_credentials", label: "Generate Login Credentials", group: "Account", enabled: !meta.suspended },
    { id: "reset_password", label: "Reset Password", group: "Account", enabled: Boolean(meta.credentials), ...(meta.credentials ? {} : disabled("No credentials yet")) },
    { id: "suspend", label: "Suspend Customer", group: "Account", enabled: !meta.suspended && lifecycle !== "archived" },
    { id: "unsuspend", label: "Unsuspend Customer", group: "Account", enabled: meta.suspended },
    { id: "archive", label: "Archive Customer", group: "Account", enabled: lifecycle !== "archived" },
  ];
}

export function buildMasterAdminCustomerList(): MasterAdminCustomerListRow[] {
  return buildMasterAdminCustomerListLite().customers;
}

export function buildMasterAdminCustomerRecord(slug: string): MasterAdminCustomerRecord | null {
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
  const generated = contentPackageGenerated(safe, serviceId);
  const session = loadCampaignBuilderSession(safe);
  const live = getPharmacyLivePublishStatus(safe);
  const output = getPharmacyPublishOutputStatus(safe);
  const indexing = getPharmacyIndexingBridgeStatus(safe);
  const indexingSummary = indexing.summary;
  const rank = rankTrackingSummary(safe);
  const framework = buildGrowthEngineFramework(safe);
  const packageManifest = loadContentPackage(safe, serviceId);
  const completeness = computeProfileCompleteness(data);
  const marketScopeSummary = buildMarketScopeSummary(safe, data);
  let blockers: string[] = [];
  try {
    blockers = buildPharmacyPlatformDashboard(safe).blockers;
  } catch {
    blockers = [];
  }
  const health = deriveHealth(lifecycle, blockers);
  const issueSummary = buildMasterAdminCustomerIssueSummary(safe);
  const workflow = buildCustomerWorkflowState(safe);
  const orchestration = workflow?.orchestration || null;
  const canonicalStatuses = buildCustomerCanonicalStatuses(safe, serviceId);
  const accountSummary = getCustomerAccountSummary(safe);
  const customerAccount = getCustomerAccountDetail(safe);
  const customerJobs = listMasterAdminJobs({ slug: safe, limit: 10 });
  const latestExecution = workflow?.executions?.[0];
  const stageId = (workflow?.currentStage || "create_customer") as WorkflowStageId;
  const workflowIssueBlockers = resolveWorkflowIssueBlockers(safe, stageId);
  let fallbackLatestEvidence =
    latestExecution?.evidence || workflow?.history?.[0]?.evidence || null;
  try {
    const managed = readManagedPublishingProfile(safe);
    const snapshot = readLatestCommercialPublishSnapshot(safe) as {
      serviceId?: string;
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
  const operationalSummary = mergeCustomerOperationalSummary({
    slug: safe,
    fallbackLatestEvidence,
    fallbackBlockingIssues: workflowIssueBlockers.blocked
      ? [workflowIssueBlockers.reason || `${workflowIssueBlockers.blockingIssues.length} blocking issue(s)`]
      : orchestration?.blockingReason && !orchestration?.canContinue
        ? [orchestration.blockingReason]
        : [],
    customerReady: workflow?.currentStage === "live_customer",
    welcomeDraftAvailable: Boolean(customerAccount.welcomeEmailDraft),
    jobs: customerJobs,
  });

  const brandPath = path.join(WORKSPACE_ROOT, "config", "projects", safe, "brand", "brand-profile.json");
  let brandDna: Record<string, unknown> = {};
  if (fs.existsSync(brandPath)) {
    try {
      brandDna = JSON.parse(fs.readFileSync(brandPath, "utf8")) as Record<string, unknown>;
    } catch {
      brandDna = {};
    }
  }

  const componentDnaPath = path.join(WORKSPACE_ROOT, "data", "pharmacy-component-dna", `${safe}.json`);
  let componentDna: Record<string, unknown> = {};
  if (fs.existsSync(componentDnaPath)) {
    try {
      componentDna = JSON.parse(fs.readFileSync(componentDnaPath, "utf8")) as Record<string, unknown>;
    } catch {
      componentDna = {};
    }
  }

  let generationStatus = "not_started";
  if (session.generationStartedAt && !session.generationCompletedAt) generationStatus = "in_progress";
  else if (generated) generationStatus = "complete";

  return {
    slug: safe,
    businessName: data.pharmacyName || entry.pharmacyName,
    website: data.website || "",
    lifecycle,
    lifecycleLabel: LIFECYCLE_LABELS[lifecycle],
    lifecycleProgress: buildLifecycleProgress(lifecycle),
    workflow,
    orchestration: workflow?.orchestration || null,
    completionPct: completeness.score,
    workflowCompletionPct: workflow?.completionPct ?? 0,
    currentStage: workflow?.currentStage || lifecycle,
    currentStageLabel: workflow?.currentStageLabel || LIFECYCLE_LABELS[lifecycle],
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
    websiteIntelligenceReimport: resolveWebsiteIntelligenceReimportState(safe),
    businessProfileReview: buildBusinessProfileReview(safe),
    deploymentConfiguration: (() => {
      const deploymentReview = buildCommercialDeploymentReview(safe);
      const managed = buildManagedPublishingReview(safe);
      return {
        summary: deploymentReview.summary,
        approved: isCommercialDeploymentApproved(safe),
        needsConfiguration: false,
        publishingEnabled: deploymentReview.profile.publishingEnabled,
        legacyExternal: Boolean(managed.profile.legacyExternalProfileRef),
      };
    })(),
    managedPublishing: (() => {
      const managed = buildManagedPublishingReview(safe);
      return {
        summary: managed.summary,
        managedUrl: managed.profile.managedUrl,
        dnsStatus: managed.profile.dnsStatus,
        sslStatus: managed.profile.sslStatus,
        publishStatus: managed.profile.publishStatus,
        ready: managed.summary.publishingReadiness === "READY TO PUBLISH",
      };
    })(),
    operationalSummary,
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
      brandDna,
      componentDna,
      businessIntelligence: { frameworkStep: framework.steps.find((s) => s.id === "business-intelligence") },
      googleIntelligence:
        (readGoogleIntelligenceRecord(safe) as unknown as Record<string, unknown>) ||
        (data.googleImportSnapshot as Record<string, unknown>) ||
        {},
      competitorIntelligence: { note: "Available via Growth Engine local market module" },
      growthIntelligence: { frameworkStep: framework.steps.find((s) => s.id === "growth-intelligence") },
      publishing: { live, output },
      indexing: indexing,
      rankTracking: rank,
      reports: {
        contentPackage: packageManifest,
        growthFramework: framework,
      },
      activityTimeline: listMasterAdminAudit({ slug: safe, limit: 50 }),
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
    generationSetup: buildGenerationSetupState(safe),
    marketScope: marketScopeSummary,
  };
}

export function buildMasterAdminSystemHealth(_referenceSlug?: string): MasterAdminSystemHealthItem[] {
  return getCachedMasterAdminSystemHealth();
}

export function refreshMasterAdminSystemHealthCache(referenceSlug = "broom-lane-pharmacy"): MasterAdminSystemHealthItem[] {
  return writeMasterAdminHealthCache(referenceSlug).services;
}

function generatePassword(): string {
  return randomBytes(9).toString("base64url");
}

export async function executeMasterAdminAction(
  actionId: string,
  slug: string,
  user: string,
  body: Record<string, unknown> = {},
): Promise<{ ok: boolean; result?: unknown; error?: string; audit: MasterAdminAuditEntry }> {
  const safe = safeAdminSlug(slug);
  let result: unknown;
  let status: "success" | "warning" | "error" = "success";
  let evidence = "";
  const errors: string[] = [];

  try {
    switch (actionId) {
      case "create_customer": {
        result = await createCommercialPharmacyCustomer(body as CommercialPharmacyCreateInput, user);
        evidence = `Created commercial client ${(result as { slug: string }).slug}`;
        break;
      }
      case "import_website": {
        const data = readSetupProfile(safe);
        result = await runSetupWebsiteImport(safe, {
          websiteUrl: String(body.websiteUrl || body.website || data.website || ""),
        });
        evidence = `Website import completed for ${safe}`;
        break;
      }
      case "edit_canonical_website": {
        result = updateCanonicalWebsite(
          safe,
          String(body.websiteUrl || body.website || ""),
          user,
        );
        evidence = `Canonical website updated to ${(result as { canonicalWebsite: string }).canonicalWebsite}`;
        break;
      }
      case "rerun_website_import": {
        result = queueRerunWebsiteImport(safe, user);
        evidence = `Website import queued (${(result as { jobId: string }).jobId}) for ${(result as { canonicalWebsite: string }).canonicalWebsite}`;
        break;
      }
      case "add_google_business_profile":
      case "edit_google_business_profile": {
        result = await addOrUpdateGoogleBusinessProfile(
          safe,
          String(body.googleBusinessUrl || body.googleMapsUrl || body.url || ""),
          user,
          { invalidateImport: actionId === "edit_google_business_profile" },
        );
        evidence = `Google Business Profile URL resolved — confirmation required (${(result as { preview: { placeId: string } }).preview.placeId})`;
        break;
      }
      case "change_google_business_profile": {
        result = await addOrUpdateGoogleBusinessProfile(
          safe,
          String(body.googleBusinessUrl || body.googleMapsUrl || body.url || ""),
          user,
          { invalidateImport: true },
        );
        evidence = `Google Business Profile changed — confirmation required`;
        break;
      }
      case "confirm_google_business_profile": {
        result = confirmGoogleBusinessProfileIdentity(safe, user);
        const { resumeOnboardingBatchAfterGoogleConfirm } = await import("./masterAdminOnboardingBatchService.ts");
        await resumeOnboardingBatchAfterGoogleConfirm(safe, user);
        evidence = `Google Business Profile confirmed (${(result as { preview: { businessName: string; placeId: string } }).preview.businessName}) — batch resumed`;
        break;
      }
      case "reject_google_business_profile": {
        result = rejectGoogleBusinessProfileIdentity(safe, user);
        evidence = "Google Business Profile candidate rejected";
        break;
      }
      case "search_google_business_profile": {
        result = await searchGoogleBusinessProfileAgain(
          safe,
          body.googleBusinessUrl ? String(body.googleBusinessUrl) : undefined,
          user,
        );
        evidence = "Google Business Profile search completed — confirmation required";
        break;
      }
      case "rerun_google_import": {
        result = queueRerunGoogleImport(safe, user);
        evidence = `Google import queued (${(result as { jobId: string }).jobId})`;
        break;
      }
      case "retry_onboarding_source": {
        const source = String(body.source || "google") as "website" | "google";
        retryFailedOnboardingSource(safe, source, user);
        result = { source, retried: true };
        evidence = `Retry onboarding source: ${source}`;
        break;
      }
      case "reconcile_onboarding_batch": {
        result = reconcileExistingTenantOnboardingBatch(safe, user);
        evidence = `Onboarding batch reconciled — ${(result as { overallState: string }).overallState}`;
        break;
      }
      case "import_google": {
        assertGoogleImportAllowed(safe);
        const data = readSetupProfile(safe);
        const identity = readGoogleIdentityRecord(safe);
        const importStartedAt = Date.now();
        result = await runSetupGoogleImport(safe, {
          googleBusinessUrl: String(
            body.googleBusinessUrl ||
              identity?.originalUrl ||
              identity?.resolvedUrl ||
              data.googleBusinessProfileUrl ||
              "",
          ),
          pharmacyName: String(body.pharmacyName || data.pharmacyName || ""),
          town: String(body.town || data.primaryTown || ""),
          postcode: String(body.postcode || data.postcode || ""),
          placeId: String(body.placeId || identity?.placeId || data.googlePlaceId || ""),
        });
        reconcileConfirmedGoogleImportPersistence(safe);
        evidence = `Google import completed for ${safe} in ${Math.round((Date.now() - importStartedAt) / 1000)}s`;
        break;
      }
      case "launch_bpi":
      case "open_business_profile_review": {
        result = { panel: "business-profile-review", reviewUrl: `/api/admin/master?customer=${encodeURIComponent(safe)}&panel=business-profile-review` };
        evidence = "Business Profile Review opened";
        break;
      }
      case "save_business_profile_review": {
        result = saveBusinessProfileReview(
          safe,
          {
            decisions: (body.decisions || {}) as Record<string, { action: string; finalValue?: string; note?: string }>,
            deferredFields: Array.isArray(body.deferredFields) ? (body.deferredFields as string[]) : undefined,
          },
          user,
        );
        evidence = `Business Profile Review saved (${Object.keys((body.decisions as object) || {}).length} decisions)`;
        break;
      }
      case "approve_business_profile_review": {
        const approval = approveBusinessProfileReview(safe, user);
        result = approval;
        if (!approval.ok) {
          status = "error";
          errors.push(...approval.errors);
        }
        evidence = approval.ok
          ? `Business Profile approved revision ${approval.snapshot?.profileRevision}`
          : `Approval failed: ${approval.errors.join("; ")}`;
        break;
      }
      case "approve_profile": {
        const data = readSetupProfile(safe);
        result = runCustomerSetupConfirm(safe, {
          pharmacyName: data.pharmacyName,
          website: data.website,
          phone: data.phone,
          email: data.businessEmail || data.email,
          address: data.addressLine1,
          town: data.primaryTown || data.townCity,
          postcode: data.postcode,
          gphcNumber: data.gphcNumber,
          gphcConfirmation: data.gphcNumber ? "confirm" : "",
          fieldSources: data.customerSetupFieldSources,
        });
        evidence = `Profile approved for ${safe}`;
        break;
      }
      case "generate_ecosystem": {
        ensureComponentDnaPersisted(safe);
        const setup = buildGenerationSetupState(safe);
        if (!setup.areasConfirmed) {
          status = "error";
          errors.push("Confirm local coverage — choose and save at least 3 local areas before continuing");
          result = { ok: false, generationSetup: setup };
          evidence = "Blocked — local areas not confirmed";
          break;
        }
        const data = readSetupProfile(safe);
        const serviceId = resolvePrimaryServiceId(safe, data);
        selectCampaignBuilderService(safe, serviceId);
        const canonicalPlan = readCanonicalEcosystemGenerationPlan(safe) || buildCanonicalEcosystemGenerationPlan(safe);
        const customerContext = buildCustomerCampaignGenerationContext(safe, serviceId, undefined, {
          commercialAuthorised: true,
        });
        freezeCustomerCampaignGenerationContext(customerContext);
        const contentResult = await generateContentPackage(safe, serviceId, { customerContext });
        if (!contentResult.ok) {
          status = "error";
          errors.push(contentResult.error || "Content package generation failed");
          result = contentResult;
          evidence = `Ecosystem generation failed for ${serviceId}`;
          break;
        }
        const authorised = readAuthorisedEcosystemGenerationRecord(safe);
        const imageAssignment = rebuildPharmacyProductionImageAssignments({
          slug: safe,
          serviceId,
          canonicalPlanId: canonicalPlan.planId,
          canonicalPlanChecksum: canonicalPlan.checksum,
          authorisedGenerationJobId: authorised?.jobId || null,
          canonicalPlan,
        });
        persistCanonicalImageInventory(safe, serviceId, canonicalPlan);
        const finalRender = await buildCanonicalFinalRender(safe, serviceId);
        const imageParity = runImageParityGate(safe, serviceId, canonicalPlan);
        result = {
          ...contentResult,
          imageAssignmentRevision: imageAssignment.revision,
          imageParityOk: imageParity.ok,
          finalRenderRoot: finalRender.renderRoot,
        };
        evidence = `Ecosystem generation completed for ${serviceId} with production image assignments`;
        break;
      }
      case "generate_service_page": {
        ensureComponentDnaPersisted(safe);
        const data = readSetupProfile(safe);
        const serviceId = resolvePrimaryServiceId(safe, data);
        selectCampaignBuilderService(safe, serviceId);
        rebuildPharmacyProductionImageAssignments({
          slug: safe,
          serviceId,
          assignmentScope: "service-page-only",
          persist: true,
        });
        const customerContext = buildCustomerCampaignGenerationContext(safe, serviceId, undefined, {
          commercialAuthorised: true,
        });
        freezeCustomerCampaignGenerationContext(customerContext);
        const contentResult = await generateContentPackage(safe, serviceId, {
          customerContext,
          scope: "service-page-only",
        });
        const imageAssignment = rebuildPharmacyProductionImageAssignments({
          slug: safe,
          serviceId,
          assignmentScope: "service-page-only",
          persist: true,
        });
        const visualPath = path.join(
          WORKSPACE_ROOT,
          "output/pharmacy-visual-experience",
          safe,
          serviceId,
          "index.html",
        );
        const previewUrl = `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(safe)}`;
        if (!fs.existsSync(visualPath)) {
          status = "error";
          errors.push(contentResult.error || "Service page generation failed");
          result = contentResult;
          markServicePageGenerationComplete(safe, {
            status: "failed",
            serviceId,
            completedAt: new Date().toISOString(),
            errors: [contentResult.error || "Service page generation failed"],
          });
          evidence = `Service page generation failed for ${serviceId}`;
          break;
        }
        const { repairServicePagePostGenerationIdentity } = await import(
          "./masterAdminServicePagePostGenerationIdentityService.ts"
        );
        repairServicePagePostGenerationIdentity({
          slug: safe,
          serviceId,
          jobId: typeof body.masterAdminJobId === "string" ? body.masterAdminJobId : null,
          previewUrl,
          outputPath: visualPath,
          scope: "service-page-only",
        });
        let wordCount: number | null = null;
        const text = fs.readFileSync(visualPath, "utf8").replace(/<[^>]+>/g, " ");
        wordCount = text.split(/\s+/).filter(Boolean).length;
        const scopeCheck = validateServicePageOutputScope(safe, serviceId);
        if (!scopeCheck.ok) {
          status = "error";
          const scopeErrors = scopeCheck.forbidden.map((f) => `FAILED_SCOPE: ${f.kind} — ${f.path}`);
          errors.push(...scopeErrors);
          markServicePageGenerationComplete(safe, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errors: scopeErrors,
          });
          result = { ok: false, scope: scopeCheck, errors: scopeErrors };
          evidence = `Service page generation failed scope validation for ${serviceId}`;
          break;
        }
        const visualHtml = fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
        const tenantGate = validateServicePageTenantContextGate(safe, serviceId as VisualExperienceServiceId, visualHtml, {
          requestedSlug: safe,
          scope: SERVICE_PAGE_GENERATION_SCOPE.SERVICE_PAGE_ONLY,
          generationJobId: typeof body.masterAdminJobId === "string" ? body.masterAdminJobId : null,
          contentContext: customerContext.generationContext,
        });
        if (!tenantGate.ok) {
          status = "error";
          const tenantErrors = tenantGate.blockers.map((b) => `FAILED_TENANT_CONTEXT: ${b}`);
          errors.push(...tenantErrors);
          markServicePageGenerationComplete(safe, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errors: tenantErrors,
          });
          result = { ok: false, tenantContextGate: tenantGate, errors: tenantErrors };
          evidence = `Service page generation failed tenant-context validation for ${serviceId}`;
          break;
        }
        const { assertCommercialChecklistForGeneration } = await import(
          "./masterAdminCoreProductRecoveryCommercialChecklistService.ts"
        );
        try {
          assertCommercialChecklistForGeneration(safe, serviceId, visualHtml);
        } catch (gateErr) {
          const msg = gateErr instanceof Error ? gateErr.message : String(gateErr);
          status = "error";
          errors.push(msg);
          markServicePageGenerationComplete(safe, {
            status: "failed",
            completedAt: new Date().toISOString(),
            errors: [msg],
          });
          result = { ok: false, errors: [msg] };
          evidence = `Commercial Page Contract / Checklist blocked generation for ${serviceId}`;
          break;
        }
        markServicePageGenerationComplete(safe, {
          status: "completed",
          completedAt: new Date().toISOString(),
          jobId: typeof body.masterAdminJobId === "string" ? body.masterAdminJobId : undefined,
          outputPath: visualPath,
          previewUrl,
          wordCount,
          imageAssignmentRevision: imageAssignment.revision,
          manifestPath: path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", safe, `${serviceId}.json`),
          warnings: contentResult.manifest?.adminDiagnostics || [],
          errors: [],
        });
        result = {
          ...contentResult,
          scope: "service-page-only",
          imageAssignmentRevision: imageAssignment.revision,
          previewUrl,
          wordCount,
        };
        evidence = `CPR-01 service page generated for ${serviceId}`;
        break;
      }
      case "publish": {
        const data = readSetupProfile(safe);
        const serviceId = resolvePrimaryServiceId(safe, data);
        await preparePharmacyPublishOutput(safe, serviceId);
        result = await deployPharmacyPublishOutput(safe, { serviceId, confirm: true });
        evidence = `Published ${safe}`;
        break;
      }
      case "request_indexing": {
        const registerResult = await registerPharmacyPages(safe);
        result = await submitReadyPharmacyPages(safe, { mode: "dry-run", confirmExternal: false });
        evidence = `Indexing pre-flight for ${safe} (${registerResult.registered} registered internally, ${(result as { submitted: number }).submitted} submitted)`;
        break;
      }
      case "init_rank_tracking": {
        const rankFile = path.join(WORKSPACE_ROOT, "output", safe, "rank-tracking.json");
        result = {
          ok: fs.existsSync(rankFile),
          rankFile,
          message: fs.existsSync(rankFile)
            ? "Rank tracking file present"
            : "Rank tracking will activate when GSC data is built.",
        };
        if (!fs.existsSync(rankFile)) status = "warning";
        evidence = `Rank tracking initialised check for ${safe}`;
        break;
      }
      case "health_refresh": {
        const { writeMasterAdminHealthCache } = await import("./masterAdminHealthCacheService.ts");
        const cache = writeMasterAdminHealthCache(safe || "pharmaconnect");
        result = { ok: true, updatedAt: cache.updatedAt, services: cache.services.length };
        evidence = "System health cache refreshed by background worker";
        break;
      }
      case "generate_credentials": {
        result = await createCustomerAccount(safe, user);
        evidence = `Customer account created for ${(result as { username: string }).username}`;
        break;
      }
      case "reset_password": {
        result = await resetCustomerPassword(safe, user);
        evidence = `Password reset for ${(result as { username: string }).username}`;
        break;
      }
      case "disable_login": {
        disableCustomerLogin(safe, user);
        result = { loginDisabled: true };
        evidence = `Login disabled for ${safe}`;
        break;
      }
      case "restore_login": {
        restoreCustomerLogin(safe, user);
        result = { loginDisabled: false };
        evidence = `Login restored for ${safe}`;
        break;
      }
      case "welcome_credentials_draft": {
        result = prepareWelcomeCredentialsDraft(safe, user);
        evidence = "Welcome credentials draft prepared";
        break;
      }
      case "restore_archived": {
        result = restoreArchivedPharmacyClient(safe);
        evidence = `Restored archived customer ${safe}`;
        break;
      }
      case "suspend": {
        const meta = getClientMeta(safe);
        meta.suspended = true;
        meta.suspendedAt = new Date().toISOString();
        saveClientMeta(meta);
        result = { suspended: true };
        evidence = `Suspended ${safe}`;
        break;
      }
      case "unsuspend": {
        const meta = getClientMeta(safe);
        meta.suspended = false;
        meta.suspendedAt = undefined;
        saveClientMeta(meta);
        result = { suspended: false };
        evidence = `Unsuspended ${safe}`;
        break;
      }
      case "archive": {
        result = archivePharmacyClient(safe);
        evidence = `Archived ${safe}`;
        break;
      }
      case "delete": {
        result = deleteDemoPharmacyClient(safe);
        evidence = `Deleted demo client ${safe}`;
        break;
      }
      case "assign_manager": {
        const meta = getClientMeta(safe);
        meta.accountManager = String(body.accountManager || "Unassigned");
        saveClientMeta(meta);
        result = meta;
        evidence = `Account manager set to ${meta.accountManager}`;
        break;
      }
      case "open_customer_dashboard": {
        const access = openMasterAdminCustomerDashboardAccess(safe, user);
        result = { redirectUrl: access.accessUrl, readOnly: true };
        evidence = `Admin customer dashboard access for ${safe}`;
        break;
      }
      case "report_issue": {
        result = { redirectUrl: `/api/admin/master/issues/new?slug=${encodeURIComponent(safe)}` };
        evidence = `Navigate to report issue for ${safe}`;
        break;
      }
      case "view_review_centre": {
        result = { redirectUrl: `/api/growth-engine/review-centre?slug=${encodeURIComponent(safe)}` };
        evidence = `Review centre opened for ${safe}`;
        break;
      }
      case "review_imports":
      case "resolve_conflicts": {
        result = { redirectUrl: `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(safe)}` };
        evidence = `Import review opened for ${safe}`;
        break;
      }
      case "view_dashboard":
      case "view_health":
      case "view_logs": {
        result = { redirectUrl: `/api/pharmacy-dashboard?slug=${encodeURIComponent(safe)}` };
        evidence = `Customer dashboard opened for ${safe}`;
        break;
      }
      case "continue_workflow": {
        const outcome = await continueCustomerWorkflow(safe, user, body);
        result = outcome;
        if (!outcome.ok) {
          status = "error";
          errors.push(outcome.error || "Workflow blocked");
        }
        evidence = outcome.evidence;
        break;
      }
      case "orchestrate_bpi":
      case "orchestrate_resolve_conflicts":
      case "orchestrate_competitor_analysis":
      case "orchestrate_local_market_intelligence":
      case "orchestrate_growth_intelligence":
      case "generate_growth_intelligence":
      case "approve_commercial_intelligence":
      case "orchestrate_quality_review": {
        if (actionId === "orchestrate_growth_intelligence" || actionId === "generate_growth_intelligence") {
          const { runGrowthIntelligenceWorkflowAction } = await import(
            "./masterAdminGrowthIntelligenceWorkflowService.ts"
          );
          const gi = runGrowthIntelligenceWorkflowAction(safe, user);
          result = gi;
          if (!gi.ok) {
            status = "error";
            errors.push(...gi.errors);
          }
          evidence = gi.evidence;
          break;
        }
        if (actionId === "orchestrate_competitor_analysis") {
          const { runCompetitorAnalysisWorkflowAction } = await import(
            "./masterAdminCommercialIntelligenceWorkflowService.ts"
          );
          const executingJobId = typeof body.masterAdminJobId === "string" ? body.masterAdminJobId : null;
          const out = await runCompetitorAnalysisWorkflowAction(safe, user, executingJobId);
          result = out;
          if (!out.ok) {
            status = "error";
            errors.push(...out.errors);
          }
          evidence = out.evidence;
          break;
        }
        if (actionId === "orchestrate_local_market_intelligence") {
          const { runLocalMarketIntelligenceWorkflowAction } = await import(
            "./masterAdminCommercialIntelligenceWorkflowService.ts"
          );
          const out = await runLocalMarketIntelligenceWorkflowAction(safe, user);
          result = out;
          if (!out.ok) {
            status = "error";
            errors.push(...out.errors);
          }
          evidence = out.evidence;
          break;
        }
        if (actionId === "approve_commercial_intelligence") {
          const { approveCommercialIntelligence } = await import("./masterAdminCommercialIntelligenceWorkflowService.ts");
          const out = approveCommercialIntelligence(safe, user);
          result = out;
          if (!out.ok) {
            status = "error";
            errors.push(...out.errors);
          }
          evidence = out.evidence;
          break;
        }
        const { executeWorkflowStageAction } = await import("./masterAdminWorkflowStageExecutor.ts");
        const { resolveWorkflowStage } = await import("./masterAdminWorkflowStageExecutor.ts");
        const ctx = (await import("./masterAdminCustomerContextService.ts")).loadMasterAdminCustomerContext(safe);
        if (!ctx) throw new Error("Customer not found");
        const stageId = resolveWorkflowStage(ctx);
        const stageResult = await executeWorkflowStageAction(stageId, actionId, ctx, user, body);
        result = stageResult;
        if (!stageResult.ok) {
          status = "error";
          errors.push(...stageResult.errors);
        }
        evidence = stageResult.evidence;
        break;
      }
      case "view_open_issues": {
        result = { redirectUrl: `/api/admin/master/issues?slug=${encodeURIComponent(safe)}` };
        evidence = `Navigate to open issues for ${safe}`;
        break;
      }
      default:
        throw new Error(`Unknown action: ${actionId}`);
    }
  } catch (err) {
    status = "error";
    errors.push(err instanceof Error ? err.message : String(err));
    result = { error: errors[0] };
  }

  const audit = recordMasterAdminAudit({
    user,
    slug: safe,
    action: actionId,
    status,
    evidence,
    errors,
    meta: typeof result === "object" && result ? (result as Record<string, unknown>) : { result },
  });

  return {
    ok: status !== "error",
    result,
    error: errors[0],
    audit,
  };
}

export function buildMasterAdminDashboardSummary() {
  const lite = buildMasterAdminDashboardLite();
  return {
    totalCustomers: lite.totalCustomers,
    activeCustomers: lite.activeCustomers,
    suspendedCustomers: lite.suspendedCustomers,
    archivedCustomers: lite.archivedCustomers,
    lifecycleCounts: lite.lifecycleCounts,
    recentActivity: lite.recentActivity,
    systemHealth: lite.systemHealth,
    lifecycleStages: lite.lifecycleStages,
    jobs: lite.jobs,
    timings: lite.timings,
  };
}
