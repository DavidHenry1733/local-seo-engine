/**
 * Master Admin Dashboard Lite V1 — fast read-only initial load.
 * Never regenerates intelligence, imports, publishing, indexing, or ranking.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData, type PharmacyProfileData } from "./pharmacyProfileSchema.ts";
import { profilePath } from "./pharmacyContentBlueprintService.ts";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { readMasterAdminRegistry } from "./pharmacyMasterAdminService.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { listMasterAdminAudit } from "./masterAdminAuditService.ts";
import { getCachedMasterAdminSystemHealth, ensureMasterAdminHealthCache } from "./masterAdminHealthCacheService.ts";
import { listMasterAdminJobs } from "./masterAdminJobService.ts";
import { CUSTOMER_LIFECYCLE_STAGES, type CustomerLifecycleStage, type MasterAdminCustomerListRow } from "./masterAdminPlatformService.ts";
import { WORKFLOW_STAGE_DEFINITIONS, WORKFLOW_STAGE_ORDER } from "./masterAdminWorkflowModel.ts";
import { buildWizardImportFields, countImportSummary } from "./pharmacyProfileWizardEnrichment.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { buildCustomerWorkflowSummaryLite } from "./masterAdminWorkflowEngine.ts";
import { buildMasterAdminCustomerIssueSummary } from "./masterAdminIssueService.ts";
import { buildCustomerCanonicalStatuses, canonicalStatusLabel } from "./masterAdminCanonicalStatusService.ts";

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

const META_PATH = path.join(WORKSPACE_ROOT, "data", "pharmacy-master-admin", "client-meta.json");

export interface MasterAdminLoadTimings {
  totalMs: number;
  routeMs: number;
  registryReadMs: number;
  metaReadMs: number;
  auditReadMs: number;
  healthCacheReadMs: number;
  jobsReadMs: number;
  customerLoadMs: number;
  lifecycleMs: number;
  perCustomerAvgMs: number;
  customerCount: number;
}

interface ClientMeta {
  slug: string;
  suspended: boolean;
  accountManager: string;
}

interface LiteCustomerContext {
  slug: string;
  data: PharmacyProfileData;
  profileUpdatedAt: string;
  registryUpdatedAt: string;
  archived: boolean;
  suspended: boolean;
  accountManager: string;
  pharmacyName: string;
  session: { selectedServiceId: string; generationStartedAt: string | null; generationCompletedAt: string | null };
  live: { lastPublishedAt: string | null; staticOutputReady: boolean };
  indexing: { indexed: number; submitted: number; totalRegistered: number };
  rank: { status: string; keywords: number };
  contentGenerated: boolean;
}

function nowMs(): number {
  return performance.now();
}

function readMetaStore(): Record<string, ClientMeta> {
  if (!fs.existsSync(META_PATH)) return {};
  try {
    return JSON.parse(fs.readFileSync(META_PATH, "utf8")) as Record<string, ClientMeta>;
  } catch {
    return {};
  }
}

function readJsonFile<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function campaignSessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
}

function publishStatusPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-publish-status", `${slug}.json`);
}

function indexingSummaryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-indexing", `${slug}.json`);
}

function contentPackagePath(slug: string, serviceId: string): string {
  const key = resolveTenantProfileSlug(slug) || slug;
  return path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", key, `${serviceId}.json`);
}

function rankTrackingPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output", slug, "rank-tracking.json");
}

function resolvePrimaryServiceId(data: PharmacyProfileData, sessionServiceId: string): string {
  if (data.selectedServices?.length) return String(data.selectedServices[0]);
  if (sessionServiceId) return sessionServiceId;
  return "pharmacy-first";
}

function loadLiteCustomerContext(
  slug: string,
  entry: { pharmacyName: string; updatedAt: string; archived: boolean },
  meta: ClientMeta | undefined,
): LiteCustomerContext | null {
  const doc = readJsonFile<{ updatedAt?: string; data?: Record<string, unknown> }>(profilePath(slug));
  if (!doc) return null;

  const data = normalizeProfileData(doc.data || {});
  const sessionRaw = readJsonFile<{
    selectedServiceId?: string;
    generationStartedAt?: string | null;
    generationCompletedAt?: string | null;
  }>(campaignSessionPath(slug));
  const session = {
    selectedServiceId: sessionRaw?.selectedServiceId || "",
    generationStartedAt: sessionRaw?.generationStartedAt || null,
    generationCompletedAt: sessionRaw?.generationCompletedAt || null,
  };
  const serviceId = resolvePrimaryServiceId(data, session.selectedServiceId);

  const liveRaw = readJsonFile<{ lastPublishedAt?: string | null; staticOutputReady?: boolean }>(publishStatusPath(slug));
  const live = {
    lastPublishedAt: liveRaw?.lastPublishedAt || null,
    staticOutputReady: Boolean(liveRaw?.staticOutputReady),
  };

  const indexRaw = readJsonFile<{ indexed?: number; submitted?: number; totalRegistered?: number }>(indexingSummaryPath(slug));
  const indexing = {
    indexed: indexRaw?.indexed || 0,
    submitted: indexRaw?.submitted || 0,
    totalRegistered: indexRaw?.totalRegistered || 0,
  };

  let rank = { status: "not_started", keywords: 0 };
  const rankFile = rankTrackingPath(slug);
  if (fs.existsSync(rankFile)) {
    const rankRaw = readJsonFile<{ summary?: { keywordsCount?: number } }>(rankFile);
    const keywords = rankRaw?.summary?.keywordsCount || 0;
    rank = { status: keywords > 0 ? "active" : "limited", keywords };
  }

  const pkgFile = contentPackagePath(slug, serviceId);
  let contentGenerated = false;
  if (fs.existsSync(pkgFile)) {
    const pkg = readJsonFile<{ generatedAt?: string; status?: string }>(pkgFile);
    contentGenerated = Boolean(pkg?.generatedAt && pkg.status !== "missing" && pkg.status !== "error");
  }

  return {
    slug,
    data,
    profileUpdatedAt: doc.updatedAt || entry.updatedAt,
    registryUpdatedAt: entry.updatedAt,
    archived: entry.archived,
    suspended: meta?.suspended || false,
    accountManager: meta?.accountManager || "Unassigned",
    pharmacyName: data.pharmacyName || entry.pharmacyName || slug,
    session,
    live,
    indexing,
    rank,
    contentGenerated,
  };
}

function deriveLifecycleLite(ctx: LiteCustomerContext): CustomerLifecycleStage {
  if (ctx.archived) return "archived";
  if (ctx.suspended) return "suspended";

  const data = ctx.data;
  const hasWebsiteImport = Boolean(data.websiteImportSnapshot);
  const hasGoogleImport = Boolean(data.googleImportSnapshot);
  const importSummary = countImportSummary(buildWizardImportFields(data));
  const googleMatch = data.customerSetupGoogleMatchStatus || "none";
  const platformStatus = data.platformClientStatus || "setup_required";

  if (platformStatus === "setup_required" && !hasWebsiteImport && !hasGoogleImport) return "new";

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

  if (ctx.session.generationStartedAt && !ctx.session.generationCompletedAt) return "generating";

  if (!ctx.contentGenerated && (platformStatus === "active" || platformStatus === "profile_approved" || importSummary.confirmed > 0)) {
    return "generation_ready";
  }

  if (ctx.contentGenerated && !ctx.live.lastPublishedAt) return "ready_to_publish";

  if (ctx.live.lastPublishedAt) {
    const pendingIndex =
      ctx.indexing.submitted < ctx.indexing.totalRegistered && ctx.indexing.indexed < ctx.indexing.totalRegistered;
    if (pendingIndex && ctx.indexing.totalRegistered > 0) return "indexing";
    if (ctx.rank.keywords > 0) return "live_customer";
    if (ctx.indexing.indexed > 0 || ctx.indexing.submitted > 0) return "monitoring";
    return "published";
  }

  return "new";
}

function deriveHealthLite(lifecycle: CustomerLifecycleStage): { health: "healthy" | "warning" | "offline"; healthLabel: string } {
  if (lifecycle === "archived") {
    return { health: "offline", healthLabel: "Archived" };
  }
  if (lifecycle === "suspended") {
    return { health: "offline", healthLabel: "Suspended" };
  }
  if (lifecycle === "awaiting_review" || lifecycle === "import_running" || lifecycle === "new") {
    return { health: "warning", healthLabel: lifecycle === "awaiting_review" ? "Needs review" : "Setup in progress" };
  }
  if (lifecycle === "live_customer" || lifecycle === "monitoring" || lifecycle === "published") {
    return { health: "healthy", healthLabel: "Healthy" };
  }
  return { health: "healthy", healthLabel: "On track" };
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
    submitted: "Submitted",
    indexed: "Indexed",
    not_started_rank: "Not initialised",
  };
  return map[code] || code.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function buildRowFromContext(ctx: LiteCustomerContext): MasterAdminCustomerListRow {
  const lifecycle = deriveLifecycleLite(ctx);
  const health = deriveHealthLite(lifecycle);
  const completeness = computeProfileCompleteness(ctx.data);
  const workflow = buildCustomerWorkflowSummaryLite(ctx.slug);
  const issueSummary = buildMasterAdminCustomerIssueSummary(ctx.slug);
  const canonical = buildCustomerCanonicalStatuses(ctx.slug, ctx.session.selectedServiceId || "pharmacy-first");

  let generationStatus = "not_started";
  if (ctx.session.generationStartedAt && !ctx.session.generationCompletedAt) generationStatus = "in_progress";
  else if (ctx.contentGenerated) generationStatus = "complete";

  let publishingStatus = "not_started";
  if (ctx.live.lastPublishedAt) publishingStatus = "published";
  else if (ctx.live.staticOutputReady) publishingStatus = "ready";

  let indexingStatus = "not_started";
  if (ctx.indexing.indexed > 0) indexingStatus = "indexed";
  else if (ctx.indexing.submitted > 0) indexingStatus = "submitted";
  else if (ctx.indexing.totalRegistered > 0) indexingStatus = "ready";

  return {
    slug: ctx.slug,
    businessName: ctx.pharmacyName,
    website: ctx.data.website || "",
    lifecycle,
    lifecycleLabel: LIFECYCLE_LABELS[lifecycle],
    currentStage: workflow?.currentStage || lifecycle,
    currentStageLabel: workflow?.currentStageLabel || LIFECYCLE_LABELS[lifecycle],
    nextAction: workflow?.nextAction?.label || "—",
    outstandingIssues: issueSummary.openCount,
    completionPct: completeness.score,
    workflowCompletionPct: workflow?.completionPct ?? 0,
    generationStatus: canonicalStatusLabel(canonical, "generation"),
    publishingStatus: canonicalStatusLabel(canonical, "publishing"),
    indexingStatus: canonicalStatusLabel(canonical, "indexing"),
    rankingStatus: canonicalStatusLabel(canonical, "rank_tracking"),
    lastActivity: ctx.profileUpdatedAt || ctx.registryUpdatedAt,
    accountManager: ctx.accountManager,
    health: health.health,
    healthLabel: health.healthLabel,
    isDemo: ctx.slug.includes("demo") || ctx.slug.includes("test"),
    archived: ctx.archived,
    suspended: ctx.suspended,
  };
}

export function buildMasterAdminCustomerListLite(): { customers: MasterAdminCustomerListRow[]; lifecycleMs: number; customerLoadMs: number } {
  const lifecycleStart = nowMs();
  const loadStart = nowMs();

  const registry = readMasterAdminRegistry();
  const metaStore = readMetaStore();
  const customers: MasterAdminCustomerListRow[] = [];

  for (const entry of registry.clients) {
    try {
      const ctx = loadLiteCustomerContext(entry.slug, entry, metaStore[entry.slug]);
      if (!ctx) continue;
      customers.push(buildRowFromContext(ctx));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      customers.push({
        slug: entry.slug,
        businessName: entry.pharmacyName || entry.slug,
        website: "",
        lifecycle: entry.archived ? "archived" : "new",
        lifecycleLabel: entry.archived ? "Archived" : "NEW",
        currentStage: "unknown",
        currentStageLabel: "Load error",
        nextAction: "Review customer record",
        outstandingIssues: 1,
        completionPct: 0,
        workflowCompletionPct: 0,
        generationStatus: "Unknown",
        publishingStatus: "Unknown",
        indexingStatus: "Unknown",
        rankingStatus: "Unknown",
        lastActivity: entry.updatedAt,
        accountManager: metaStore[entry.slug]?.accountManager || "Unassigned",
        health: "warning",
        healthLabel: "Summary load failed",
        isDemo: entry.slug.includes("demo") || entry.slug.includes("test"),
        archived: entry.archived,
        suspended: metaStore[entry.slug]?.suspended || false,
        loadError: message,
      });
    }
  }

  customers.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

  const customerLoadMs = nowMs() - loadStart;
  const lifecycleMs = nowMs() - lifecycleStart;

  return { customers, lifecycleMs, customerLoadMs };
}

export function buildMasterAdminDashboardLite(): {
  totalCustomers: number;
  activeCustomers: number;
  suspendedCustomers: number;
  archivedCustomers: number;
  lifecycleCounts: Record<string, number>;
  workflowStageCounts: Record<string, number>;
  lifecycleStages: typeof CUSTOMER_LIFECYCLE_STAGES;
  workflowStages: Array<{ id: string; label: string }>;
  recentActivity: ReturnType<typeof listMasterAdminAudit>;
  systemHealth: ReturnType<typeof getCachedMasterAdminSystemHealth>;
  jobs: ReturnType<typeof listMasterAdminJobs>;
  customers: MasterAdminCustomerListRow[];
  timings: MasterAdminLoadTimings;
} {
  const routeStart = nowMs();
  const timings: Partial<MasterAdminLoadTimings> = {};

  const t0 = nowMs();
  const registry = readMasterAdminRegistry();
  timings.registryReadMs = nowMs() - t0;

  const t1 = nowMs();
  readMetaStore();
  timings.metaReadMs = nowMs() - t1;

  const t2 = nowMs();
  const recentActivity = listMasterAdminAudit({ limit: 20 });
  timings.auditReadMs = nowMs() - t2;

  const t3 = nowMs();
  ensureMasterAdminHealthCache();
  const systemHealth = getCachedMasterAdminSystemHealth();
  timings.healthCacheReadMs = nowMs() - t3;

  const t4 = nowMs();
  const jobs = listMasterAdminJobs({ limit: 20 });
  timings.jobsReadMs = nowMs() - t4;

  const { customers, lifecycleMs, customerLoadMs } = buildMasterAdminCustomerListLite();
  timings.customerLoadMs = customerLoadMs;
  timings.lifecycleMs = lifecycleMs;
  timings.customerCount = customers.length;
  timings.perCustomerAvgMs = customers.length ? Math.round((customerLoadMs / customers.length) * 100) / 100 : 0;

  const active = customers.filter((c) => !c.archived);
  const lifecycleCounts: Record<string, number> = {};
  const workflowStageCounts: Record<string, number> = {};
  for (const c of customers) {
    lifecycleCounts[c.lifecycle] = (lifecycleCounts[c.lifecycle] || 0) + 1;
    workflowStageCounts[c.currentStage] = (workflowStageCounts[c.currentStage] || 0) + 1;
  }

  timings.routeMs = nowMs() - routeStart;
  timings.totalMs = timings.routeMs;

  return {
    totalCustomers: customers.length,
    activeCustomers: active.length,
    suspendedCustomers: customers.filter((c) => c.suspended).length,
    archivedCustomers: customers.filter((c) => c.archived).length,
    lifecycleCounts,
    workflowStageCounts,
    lifecycleStages: CUSTOMER_LIFECYCLE_STAGES,
    workflowStages: WORKFLOW_STAGE_ORDER.filter((id) => !["resolve_import_conflicts", "approve_business_profile"].includes(id)).map(
      (id) => ({
        id,
        label: id === "business_profile_intelligence" ? "Business Profile Review" : WORKFLOW_STAGE_DEFINITIONS[id].label,
      }),
    ),
    recentActivity,
    systemHealth,
    jobs,
    customers,
    timings: timings as MasterAdminLoadTimings,
  };
}

export function profileMasterAdminDashboardLoad(): MasterAdminLoadTimings {
  return buildMasterAdminDashboardLite().timings;
}
