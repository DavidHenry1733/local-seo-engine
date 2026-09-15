/**
 * Pharmacy Campaign Launch Queue V1 — operational checklist from existing bridge data only.
 */
import fs from "node:fs";
import path from "node:path";
import { computeProfileCompleteness } from "./pharmacyProfileCompleteness.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readPharmacyIndexingSummary, type PharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";
import { getCampaignImageSummary } from "./pharmacyCampaignImageStatusService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import {
  readPharmacyCampaignStore,
  type PharmacyCampaign,
} from "./pharmacyCampaignService.ts";
import {
  getAuthorityPublishGateSnapshot,
  type PublishGate,
} from "./pharmacyAuthorityReadinessService.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";

export type LaunchTaskStatus = "pending" | "in_progress" | "complete" | "blocked";
export type LaunchTaskPriority = "Critical" | "High" | "Medium" | "Low";
export type LaunchTaskCategory =
  | "Profile"
  | "Content"
  | "Publishing"
  | "Indexing"
  | "Visibility"
  | "Promotion"
  | "Growth";

export interface CampaignLaunchTask {
  id: string;
  campaignId: string;
  title: string;
  category: LaunchTaskCategory;
  status: LaunchTaskStatus;
  priority: LaunchTaskPriority;
  linkedModule: string;
  linkedUrl: string;
  evidence: string[];
  blockedReason: string | null;
  createdAt: string;
  completedAt: string | null;
}

export interface CampaignLaunchQueueEntry {
  campaignId: string;
  serviceId: string;
  serviceName: string;
  totalTasks: number;
  completeTasks: number;
  blockedTasks: number;
  inProgressTasks: number;
  pendingTasks: number;
  progressPct: number;
  nextLaunchTask: CampaignLaunchTask | null;
  tasks: CampaignLaunchTask[];
  candidatePublish?: {
    ready: boolean;
    approvedCount: number;
    expectedCount: number;
    candidateVersion: string | null;
    published: boolean;
    indexed: boolean;
    publishUrl: string;
  } | null;
}

export interface PharmacyCampaignLaunchQueueStore {
  version: 1;
  slug: string;
  updatedAt: string;
  campaigns: CampaignLaunchQueueEntry[];
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function launchQueuePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-campaign-launch-queue", `${safeSlug(slug)}.json`);
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`);
}

function publishIndexPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "_publish-index.json");
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeSlug(slug)}.json`);
}

function ecosystemIndexPath(slug: string, serviceId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "_ecosystem-index.json",
  );
}

function packPath(slug: string, serviceId: string, file: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "packs",
    file,
  );
}

interface BridgeSnapshot {
  profileScore: number;
  profileComplete: boolean;
  imagesComplete: boolean;
  imagesAssignedCount: number;
  servicePageExists: boolean;
  ecosystemExists: boolean;
  pagePublished: boolean;
  publishedPages: number;
  sitemapUpdated: boolean;
  sitemapUrl: string | null;
  indexingSubmitted: boolean;
  indexingStatus: string;
  indexingRefreshed: boolean;
  visibilityRefreshed: boolean;
  visibilityStatus: string;
  gbpPackExists: boolean;
  socialPackExists: boolean;
  emailPackExists: boolean;
  growthActionsExist: boolean;
  growthActionsCount: number;
  authorityScore: number;
  authorityPublishGate: PublishGate;
  authorityTopCriticalIssues: string[];
  authorityTopMissingSignals: string[];
  authorityTopBlockers: string[];
  authorityAuditUrl: string;
  candidateReady: boolean;
  candidateApprovedCount: number;
  candidateExpectedCount: number;
  candidateVersion: string | null;
  candidatePublished: boolean;
  candidateIndexed: boolean;
}

function loadBridgeSnapshot(slug: string, serviceId: string): BridgeSnapshot {
  const s = safeSlug(slug);
  const profileDoc = readJson<{ data?: Record<string, unknown> } & Record<string, unknown>>(profilePath(s));
  const profileData = (profileDoc?.data || profileDoc || {}) as Record<string, unknown>;
  const completeness = computeProfileCompleteness(profileData, s);

  const publishIndex = readJson<{ pages: Array<{ serviceId: string; pageType: string }> }>(publishIndexPath(s));
  const publishPages = (publishIndex?.pages || []).filter((p) => p.serviceId === serviceId);
  const visualServicePageExists = Boolean(resolveVisualExperienceHtmlPath(serviceId, s));
  const publishedServicePage = publishPages.some((p) => p.pageType === "service");
  const pagePublished = publishedServicePage && publishPages.length > 0;

  const registry = readJson<PharmacyRegistry>(registryPath(s));
  const rootPage = registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service") || null;
  const indexingSummary = readPharmacyIndexingSummary(s);
  const visibility = readPharmacyVisibilityReport(s);
  const visibilityService = visibility?.services.find((svc) => svc.serviceId === serviceId);
  const growthPlan = readPharmacyGrowthActionPlan(s);

  const ecoPath = ecosystemIndexPath(s, serviceId);
  const ecosystemExists = fs.existsSync(ecoPath);
  const gbpPackExists = fs.existsSync(packPath(s, serviceId, "gbp-posts.json"));
  const socialPackExists = fs.existsSync(packPath(s, serviceId, "social-posts.json"));
  const emailPackExists = fs.existsSync(packPath(s, serviceId, "email-sequence.json"));

  const indexingStatus = rootPage?.indexingStatus || "not_registered";
  const indexingSubmitted = indexingStatus === "submitted" || indexingStatus === "indexed";
  const indexingRefreshed = Boolean(rootPage?.lastCheckedAt);
  const imageSummary = getCampaignImageSummary(s, serviceId);

  const authority = getAuthorityPublishGateSnapshot(s, serviceId);
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(s, serviceId);

  return {
    profileScore: completeness.score,
    profileComplete: completeness.score >= 80,
    imagesComplete: imageSummary.allAssigned,
    imagesAssignedCount: imageSummary.assignedCount,
    servicePageExists: candidates?.active ? candidates.approvedServicePage : visualServicePageExists,
    ecosystemExists,
    pagePublished: candidates?.active ? candidates.published : pagePublished,
    publishedPages: publishPages.length,
    sitemapUpdated: candidates?.active && !candidates.published ? false : Boolean(indexingSummary?.sitemapUrl),
    sitemapUrl: candidates?.active && !candidates.published ? null : indexingSummary?.sitemapUrl || null,
    indexingSubmitted: candidates?.active && !candidates.published ? false : indexingSubmitted,
    indexingStatus: candidates?.active && !candidates.published ? "not_registered" : indexingStatus,
    indexingRefreshed: indexingRefreshed && indexingSubmitted,
    visibilityRefreshed: Boolean(visibility?.lastCheckedAt),
    visibilityStatus: visibilityService?.visibilityStatus || "unknown",
    gbpPackExists,
    socialPackExists,
    emailPackExists,
    growthActionsExist: (growthPlan?.totalActions ?? 0) > 0,
    growthActionsCount: growthPlan?.totalActions ?? 0,
    authorityScore: authority.overallScore,
    authorityPublishGate: authority.publishGate,
    authorityTopCriticalIssues: authority.topCriticalIssues,
    authorityTopMissingSignals: authority.topMissingSignals,
    authorityTopBlockers: authority.topBlockers,
    authorityAuditUrl: authority.auditUrl,
    candidateReady: Boolean(candidates?.ready),
    candidateApprovedCount: candidates?.approvedCount || 0,
    candidateExpectedCount: candidates?.expectedCount || 0,
    candidateVersion: candidates?.candidateVersion || null,
    candidatePublished: Boolean(candidates?.published),
    candidateIndexed: Boolean(candidates?.indexed),
  };
}

function dashUrl(slug: string, hash: string): string {
  return `/api/pharmacy-growth-dashboard?slug=${safeSlug(slug)}${hash}`;
}

function buildTaskDrafts(
  slug: string,
  campaign: PharmacyCampaign,
  bridge: BridgeSnapshot,
  now: string,
): Omit<CampaignLaunchTask, "status" | "completedAt" | "blockedReason">[] {
  const s = safeSlug(slug);
  const { serviceId, serviceName } = campaign;

  return [
    {
      id: `${campaign.id}-confirm-profile`,
      campaignId: campaign.id,
      title: "Confirm profile",
      category: "Profile",
      priority: "Critical",
      linkedModule: "Profile Dashboard",
      linkedUrl: `/api/pharmacy-profile-dashboard?slug=${s}`,
      evidence: [`Profile completeness: ${bridge.profileScore}%`],
      createdAt: now,
    },
    {
      id: `${campaign.id}-confirm-images`,
      campaignId: campaign.id,
      title: "Confirm images",
      category: "Images",
      priority: "Critical",
      linkedModule: "Visual Experience",
      linkedUrl: `/api/pharmacy-visual-experience/${serviceId}/`,
      evidence: bridge.imagesComplete
        ? ["All 4 image slots assigned (Hero, Support, Trust, Conversion)"]
        : [`${bridge.imagesAssignedCount}/4 image slots assigned — review library assignments`],
      createdAt: now,
    },
    {
      id: `${campaign.id}-confirm-service-page`,
      campaignId: campaign.id,
      title: "Confirm service page",
      category: "Content",
      priority: "Critical",
      linkedModule: "Visual Experience",
      linkedUrl: `/api/pharmacy-visual-experience/${serviceId}/`,
      evidence: bridge.candidateExpectedCount
        ? bridge.servicePageExists
          ? [
              `Approved ${bridge.candidateVersion || "current"} service-page candidate`,
              `${bridge.candidateApprovedCount} of ${bridge.candidateExpectedCount} approved candidates ready to publish`,
            ]
          : [`Approved ${bridge.candidateVersion || "current"} service-page candidate is missing`]
        : bridge.servicePageExists
          ? [`Service page exists for ${serviceName}`]
          : [`No published service page found for ${serviceId}`],
      createdAt: now,
    },
    {
      id: `${campaign.id}-confirm-ecosystem`,
      campaignId: campaign.id,
      title: "Confirm ecosystem",
      category: "Content",
      priority: "High",
      linkedModule: "Content Ecosystem",
      linkedUrl: `/api/pharmacy-content-ecosystem-preview/${serviceId}/`,
      evidence: bridge.candidateExpectedCount
        ? [
            `${bridge.candidateApprovedCount} of ${bridge.candidateExpectedCount} approved ${bridge.candidateVersion || "current"} candidates are the publish authority`,
            "Ecosystem package is not required for current-run candidate publication",
          ]
        : bridge.ecosystemExists
          ? [`Content ecosystem available for ${serviceName}`]
          : [`No ecosystem generated for ${serviceId}`],
      createdAt: now,
    },
    {
      id: `${campaign.id}-authority-readiness-approved`,
      campaignId: campaign.id,
      title: "Authority & AI Readiness approved",
      category: "Publishing",
      priority: "Critical",
      linkedModule: "Authority Audit",
      linkedUrl: bridge.authorityAuditUrl,
      evidence: [
        `Authority score: ${bridge.authorityScore}/100`,
        `Publish gate: ${bridge.authorityPublishGate.replace(/_/g, " ")}`,
        ...bridge.authorityTopCriticalIssues.map((i) => `Critical: ${i}`),
        ...bridge.authorityTopMissingSignals.map((m) => `Missing: ${m}`),
        `Audit: ${bridge.authorityAuditUrl}`,
      ],
      createdAt: now,
    },
    {
      id: `${campaign.id}-publish-page`,
      campaignId: campaign.id,
      title: "Publish page",
      category: "Publishing",
      priority: "Critical",
      linkedModule: "Publishing",
      linkedUrl: bridge.candidateExpectedCount
        ? `/api/admin/master?customer=${encodeURIComponent(s)}&panel=commercial-publish-review`
        : `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(s)}&service=${encodeURIComponent(serviceId)}`,
      evidence: bridge.candidateExpectedCount
        ? bridge.pagePublished
          ? [`${bridge.publishedPages} published pages for ${serviceName}`]
          : [
              `${bridge.candidateApprovedCount} of ${bridge.candidateExpectedCount} approved ${bridge.candidateVersion || "current"} candidates ready to publish`,
              "First publication does not require a live page to already exist",
            ]
        : bridge.pagePublished
          ? [`${bridge.publishedPages} published pages for ${serviceName}`]
          : ["Service page not yet published"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-update-sitemap`,
      campaignId: campaign.id,
      title: "Update sitemap",
      category: "Publishing",
      priority: "High",
      linkedModule: "Indexing Bridge",
      linkedUrl: dashUrl(s, "#indexing"),
      evidence: bridge.sitemapUpdated
        ? [`Sitemap registered: ${bridge.sitemapUrl}`]
        : ["Sitemap not registered"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-submit-indexing`,
      campaignId: campaign.id,
      title: "Submit indexing",
      category: "Indexing",
      priority: "Critical",
      linkedModule: "Indexing Bridge",
      linkedUrl: dashUrl(s, "#indexing"),
      evidence: bridge.indexingSubmitted
        ? [`Indexing status: ${bridge.indexingStatus}`]
        : [`Indexing status: ${bridge.indexingStatus} — submit required`],
      createdAt: now,
    },
    {
      id: `${campaign.id}-refresh-visibility`,
      campaignId: campaign.id,
      title: "Refresh visibility",
      category: "Visibility",
      priority: "High",
      linkedModule: "Visibility Bridge",
      linkedUrl: dashUrl(s, "#visibility"),
      evidence: bridge.visibilityRefreshed
        ? [`Visibility status: ${bridge.visibilityStatus}`]
        : ["Visibility tracking not yet refreshed"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-prepare-gbp-posts`,
      campaignId: campaign.id,
      title: "Prepare GBP posts",
      category: "Promotion",
      priority: "Medium",
      linkedModule: "Content Ecosystem",
      linkedUrl: `/api/pharmacy-content-ecosystem-preview/${serviceId}/`,
      evidence: bridge.gbpPackExists
        ? ["GBP post pack available in content ecosystem"]
        : ["GBP post pack not available — generate ecosystem first"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-prepare-social-posts`,
      campaignId: campaign.id,
      title: "Prepare social posts",
      category: "Promotion",
      priority: "Medium",
      linkedModule: "Content Ecosystem",
      linkedUrl: `/api/pharmacy-content-ecosystem-preview/${serviceId}/`,
      evidence: bridge.socialPackExists
        ? ["Social post pack available in content ecosystem"]
        : ["Social post pack not available — generate ecosystem first"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-prepare-email-sequence`,
      campaignId: campaign.id,
      title: "Prepare email sequence",
      category: "Promotion",
      priority: "Medium",
      linkedModule: "Content Ecosystem",
      linkedUrl: `/api/pharmacy-content-ecosystem-preview/${serviceId}/`,
      evidence: bridge.emailPackExists
        ? ["Email sequence pack available in content ecosystem"]
        : ["Email sequence not available — generate ecosystem first"],
      createdAt: now,
    },
    {
      id: `${campaign.id}-review-growth-actions`,
      campaignId: campaign.id,
      title: "Review growth actions",
      category: "Growth",
      priority: "High",
      linkedModule: "Growth Actions",
      linkedUrl: `/api/pharmacy-growth-actions?slug=${s}`,
      evidence: bridge.growthActionsExist
        ? [`${bridge.growthActionsCount} growth actions available`]
        : ["Growth action plan not yet generated"],
      createdAt: now,
    },
  ];
}

function autoDetectStatus(
  draft: Omit<CampaignLaunchTask, "status" | "completedAt" | "blockedReason">,
  bridge: BridgeSnapshot,
): Pick<CampaignLaunchTask, "status" | "completedAt" | "blockedReason"> {
  const taskKey = draft.id.replace(`${draft.campaignId}-`, "");

  let complete = false;
  let blocked = false;
  let inProgress = false;
  let blockedReason: string | null = null;

  switch (taskKey) {
    case "confirm-profile":
      complete = bridge.profileComplete;
      break;
    case "confirm-images":
      complete = bridge.imagesComplete;
      blocked = !bridge.profileComplete;
      blockedReason = blocked ? "Confirm profile before assigning images" : null;
      break;
    case "confirm-service-page":
      complete = bridge.servicePageExists;
      if (bridge.candidateExpectedCount) {
        blocked = false;
        blockedReason = null;
      } else {
        blocked = !bridge.imagesComplete;
        blockedReason = blocked ? "Confirm image assignments before service page review" : null;
      }
      break;
    case "confirm-ecosystem":
      if (bridge.candidateExpectedCount) {
        complete = true;
        blocked = false;
        blockedReason = null;
      } else {
        complete = bridge.ecosystemExists;
      }
      break;
    case "authority-readiness-approved":
      if (bridge.authorityPublishGate === "PASS") {
        complete = true;
      } else if (bridge.authorityPublishGate === "PASS_WITH_RECOMMENDATIONS") {
        inProgress = true;
        blockedReason = "Address recommendations before final authority sign-off";
      } else {
        blocked = true;
        blockedReason =
          bridge.authorityTopBlockers.length > 0
            ? bridge.authorityTopBlockers.join(" · ")
            : "Authority & AI Readiness publish gate failed";
      }
      break;
    case "publish-page":
      complete = bridge.pagePublished;
      if (bridge.candidateExpectedCount) {
        blocked = !bridge.candidateReady;
        blockedReason = blocked
          ? `Approve all ${bridge.candidateExpectedCount} current-run candidates before publishing`
          : null;
      } else {
        blocked = !bridge.servicePageExists || bridge.authorityPublishGate === "FAIL";
        blockedReason = bridge.authorityPublishGate === "FAIL"
          ? "Authority & AI Readiness blockers must be resolved before live publish"
          : blocked
            ? "Service page must exist before publishing"
            : null;
      }
      break;
    case "update-sitemap":
      complete = bridge.sitemapUpdated;
      blocked = !bridge.pagePublished;
      blockedReason = blocked ? "Pages must be published before sitemap update" : null;
      break;
    case "submit-indexing":
      complete = bridge.indexingSubmitted;
      blocked = !bridge.sitemapUpdated || bridge.authorityPublishGate === "FAIL";
      blockedReason = bridge.authorityPublishGate === "FAIL"
        ? "Authority & AI Readiness has unresolved blockers — indexing submission blocked"
        : !bridge.sitemapUpdated
          ? "Sitemap must be updated before indexing submission"
          : null;
      break;
    case "refresh-visibility":
      complete = bridge.visibilityRefreshed && bridge.visibilityStatus === "visible";
      blocked = !bridge.indexingSubmitted;
      blockedReason = blocked ? "Submit pages for indexing before visibility tracking" : null;
      break;
    case "prepare-gbp-posts":
      complete = bridge.gbpPackExists;
      blocked = !bridge.ecosystemExists;
      blockedReason = blocked ? "Content ecosystem required for GBP posts" : null;
      break;
    case "prepare-social-posts":
      complete = bridge.socialPackExists;
      blocked = !bridge.ecosystemExists;
      blockedReason = blocked ? "Content ecosystem required for social posts" : null;
      break;
    case "prepare-email-sequence":
      complete = bridge.emailPackExists;
      blocked = !bridge.ecosystemExists;
      blockedReason = blocked ? "Content ecosystem required for email sequence" : null;
      break;
    case "review-growth-actions":
      complete = bridge.growthActionsExist;
      break;
    default:
      break;
  }

  if (blocked) {
    return { status: "blocked", completedAt: null, blockedReason };
  }
  if (complete) {
    return { status: "complete", completedAt: new Date().toISOString(), blockedReason: null };
  }
  if (inProgress) {
    return { status: "in_progress", completedAt: null, blockedReason };
  }
  return { status: "pending", completedAt: null, blockedReason: null };
}

function mergeManualStatus(
  detected: CampaignLaunchTask,
  existing: CampaignLaunchTask | undefined,
): CampaignLaunchTask {
  if (!existing) return detected;
  if (detected.status === "complete") return detected;
  if (detected.status === "blocked") return detected;
  if (existing.status === "in_progress") {
    return { ...detected, status: "in_progress", completedAt: null };
  }
  if (existing.status === "complete" && detected.status === "pending") {
    return {
      ...detected,
      status: "complete",
      completedAt: existing.completedAt || new Date().toISOString(),
    };
  }
  return detected;
}

function buildCampaignQueueEntry(
  slug: string,
  campaign: PharmacyCampaign,
  existingTasks: CampaignLaunchTask[] = [],
): CampaignLaunchQueueEntry {
  const bridge = loadBridgeSnapshot(slug, campaign.serviceId);
  const now = new Date().toISOString();
  const drafts = buildTaskDrafts(slug, campaign, bridge, now);
  const existingById = new Map(existingTasks.map((t) => [t.id, t]));

  const tasks: CampaignLaunchTask[] = drafts.map((draft) => {
    const detected = {
      ...draft,
      ...autoDetectStatus(draft, bridge),
    };
    if (bridge.candidateExpectedCount) return detected;
    return mergeManualStatus(detected, existingById.get(draft.id));
  });

  const completeTasks = tasks.filter((t) => t.status === "complete").length;
  const blockedTasks = tasks.filter((t) => t.status === "blocked").length;
  const inProgressTasks = tasks.filter((t) => t.status === "in_progress").length;
  const pendingTasks = tasks.filter((t) => t.status === "pending").length;
  const nextLaunchTask =
    tasks.find((t) => t.status === "in_progress") ||
    tasks.find((t) => t.status === "pending") ||
    tasks.find((t) => t.status === "blocked") ||
    null;

  return {
    campaignId: campaign.id,
    serviceId: campaign.serviceId,
    serviceName: campaign.serviceName,
    totalTasks: tasks.length,
    completeTasks,
    blockedTasks,
    inProgressTasks,
    pendingTasks,
    progressPct: tasks.length ? Math.round((completeTasks / tasks.length) * 100) : 0,
    nextLaunchTask,
    tasks,
    candidatePublish: bridge.candidateExpectedCount
      ? {
          ready: bridge.candidateReady,
          approvedCount: bridge.candidateApprovedCount,
          expectedCount: bridge.candidateExpectedCount,
          candidateVersion: bridge.candidateVersion,
          published: bridge.candidatePublished,
          indexed: bridge.candidateIndexed,
          publishUrl: `/api/admin/master?customer=${encodeURIComponent(slug)}&panel=commercial-publish-review`,
        }
      : null,
  };
}

export function getPharmacyCampaignLaunchQueuePath(slug: string): string {
  return launchQueuePath(slug);
}

export function readPharmacyCampaignLaunchQueue(slug: string): PharmacyCampaignLaunchQueueStore | null {
  return readJson<PharmacyCampaignLaunchQueueStore>(launchQueuePath(slug));
}

export function writePharmacyCampaignLaunchQueue(store: PharmacyCampaignLaunchQueueStore): string {
  const file = launchQueuePath(store.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

export function refreshPharmacyCampaignLaunchQueue(slug: string): {
  store: PharmacyCampaignLaunchQueueStore;
  storePath: string;
} {
  const s = safeSlug(slug);
  const campaignStore = readPharmacyCampaignStore(s);
  const existing = readPharmacyCampaignLaunchQueue(s);
  const existingTasksByCampaign = new Map(
    (existing?.campaigns || []).map((c) => [c.campaignId, c.tasks]),
  );

  const campaigns = (campaignStore?.campaigns || [])
    .filter((c) => c.status === "active")
    .map((c) => buildCampaignQueueEntry(s, c, existingTasksByCampaign.get(c.id) || []));

  const store: PharmacyCampaignLaunchQueueStore = {
    version: 1,
    slug: s,
    updatedAt: new Date().toISOString(),
    campaigns,
  };

  const storePath = writePharmacyCampaignLaunchQueue(store);
  return { store, storePath };
}

export function getCampaignLaunchQueueSummary(
  slug: string,
  campaignId: string,
): CampaignLaunchQueueEntry | null {
  const queue = readPharmacyCampaignLaunchQueue(slug);
  return queue?.campaigns.find((c) => c.campaignId === campaignId) || null;
}

export function getPrimaryLaunchQueueSummary(slug: string): CampaignLaunchQueueEntry | null {
  const queue = readPharmacyCampaignLaunchQueue(slug);
  if (queue?.campaigns.length) return queue.campaigns[0]!;
  return null;
}

export function updateLaunchTaskStatus(
  slug: string,
  taskId: string,
  status: LaunchTaskStatus,
): PharmacyCampaignLaunchQueueStore {
  const s = safeSlug(slug);
  let store = readPharmacyCampaignLaunchQueue(s);
  if (!store) {
    store = refreshPharmacyCampaignLaunchQueue(s).store;
  }

  let found = false;
  store.campaigns = store.campaigns.map((entry) => {
    const tasks = entry.tasks.map((task) => {
      if (task.id !== taskId) return task;
      found = true;
      return {
        ...task,
        status,
        completedAt: status === "complete" ? new Date().toISOString() : null,
        blockedReason: status === "blocked" ? task.blockedReason || "Marked blocked manually" : null,
      };
    });
    const completeTasks = tasks.filter((t) => t.status === "complete").length;
    return {
      ...entry,
      tasks,
      completeTasks,
      blockedTasks: tasks.filter((t) => t.status === "blocked").length,
      inProgressTasks: tasks.filter((t) => t.status === "in_progress").length,
      pendingTasks: tasks.filter((t) => t.status === "pending").length,
      progressPct: tasks.length ? Math.round((completeTasks / tasks.length) * 100) : 0,
      nextLaunchTask:
        tasks.find((t) => t.status === "in_progress") ||
        tasks.find((t) => t.status === "pending") ||
        tasks.find((t) => t.status === "blocked") ||
        null,
    };
  });

  if (!found) throw new Error(`Launch task not found: ${taskId}`);
  store.updatedAt = new Date().toISOString();
  writePharmacyCampaignLaunchQueue(store);
  return store;
}

export function ensureLaunchQueueForCampaign(slug: string, campaign: PharmacyCampaign): void {
  const s = safeSlug(slug);
  const existing = readPharmacyCampaignLaunchQueue(s);
  const campaigns = existing?.campaigns || [];
  if (campaigns.some((c) => c.campaignId === campaign.id)) return;
  const entry = buildCampaignQueueEntry(s, campaign);
  const store: PharmacyCampaignLaunchQueueStore = {
    version: 1,
    slug: s,
    updatedAt: new Date().toISOString(),
    campaigns: [entry, ...campaigns.filter((c) => c.campaignId !== campaign.id)],
  };
  writePharmacyCampaignLaunchQueue(store);
}
