/**
 * Pharmacy Campaign Creation V1 — orchestration layer linking service → ecosystem → publish → index → visibility.
 * Does not generate content; reads existing master library outputs and bridge data only.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
  getBenchmarkPublishServices,
  getServicePublishMeta,
} from "./pharmacyMasterPublishConfig.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import {
  enrichCampaignsWithExecution,
  type PharmacyCampaignWithExecution,
} from "./pharmacyCampaignExecutionService.ts";
import {
  getPrimaryLaunchQueueSummary,
  readPharmacyCampaignLaunchQueue,
  refreshPharmacyCampaignLaunchQueue,
  ensureLaunchQueueForCampaign,
  type CampaignLaunchQueueEntry,
} from "./pharmacyCampaignLaunchQueueService.ts";
import { readPharmacyIndexingSummary, type PharmacyRegistry } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { resolveProfileCampaignAreas } from "./pharmacyAreaDiscoveryService.ts";
import { buildVisualExperiencePage } from "./pharmacyVisualExperience.ts";
import {
  VISUAL_EXPERIENCE_BENCHMARK_SERVICES,
  type VisualExperienceServiceId,
} from "./pharmacyVisualExperienceConfig.ts";
import { selectCampaignBuilderService } from "./growthEngineCampaignBuilderService.ts";

export type CampaignAreaSource = "profile" | "custom";

export interface CampaignAreaEntry {
  areaName: string;
  selected: boolean;
  source: string;
  priority: number;
  areaId?: string;
  areaSlug?: string;
  latitude?: number | null;
  longitude?: number | null;
  distanceKm?: number | null;
  distanceLabel?: string;
  distanceMethod?: string;
  distanceProvenance?: Record<string, unknown>;
}

export type CampaignGoal =
  | "Increase Visibility"
  | "Generate New Patients"
  | "Promote NHS Service"
  | "Promote Private Service"
  | "Seasonal Campaign"
  | "Pharmacy Growth";

export type CampaignStatus = "active" | "archived";

export const CAMPAIGN_GOALS: CampaignGoal[] = [
  "Increase Visibility",
  "Generate New Patients",
  "Promote NHS Service",
  "Promote Private Service",
  "Seasonal Campaign",
  "Pharmacy Growth",
];

export interface CampaignAssetCounts {
  servicePage: number;
  localServicePage: number;
  faqPage: number;
  patientGuide: number;
  blogPosts: number;
  socialPosts: number;
  gbpPosts: number;
  emailSequence: number;
  videoScript: number;
  publishingQueue: number;
  indexingQueue: number;
  total: number;
}

export interface CampaignBridgeStatus {
  publishedPages: number;
  indexedPages: number;
  visiblePages: number;
  publishingStatus: "published" | "partial" | "pending";
  indexingStatus: string;
  visibilityStatus: string;
}

export interface PharmacyCampaign {
  id: string;
  name: string;
  serviceId: string;
  serviceName: string;
  campaignGoal: CampaignGoal;
  createdAt: string;
  status: CampaignStatus;
  assetCounts: CampaignAssetCounts;
  publishingStatus: CampaignBridgeStatus["publishingStatus"];
  indexingStatus: string;
  visibilityStatus: string;
  publishedPages: number;
  indexedPages: number;
  visiblePages: number;
  links: {
    ecosystem: string;
    publishedPage: string;
    indexing: string;
    visibility: string;
  };
  areaSource: CampaignAreaSource;
  campaignAreas: CampaignAreaEntry[];
  regeneratedAt?: string;
}

export interface PharmacyCampaignStore {
  version: 1;
  slug: string;
  updatedAt: string;
  campaigns: PharmacyCampaign[];
}

export interface ServiceCatalogEntry {
  serviceId: string;
  serviceName: string;
  masterFile: string;
  masterReadiness: "ready" | "missing";
  ecosystemAvailability: "available" | "not_generated";
  ecosystemAssetCount: number;
  publishedStatus: "published" | "not_published";
  publishedPageCount: number;
  indexingStatus: string;
  visibilityStatus: string;
}

export interface CampaignOutputItem {
  id: string;
  label: string;
  count: number;
  available: boolean;
  source: "ecosystem" | "publish" | "registry" | "blueprint";
}

export interface CampaignCreationSummary {
  serviceId: string;
  serviceName: string;
  campaignGoal: CampaignGoal | null;
  expectedAssets: CampaignAssetCounts;
  publishedAssets: number;
  indexedAssets: number;
  visibilityAssets: number;
  outputs: CampaignOutputItem[];
  bridgeStatus: CampaignBridgeStatus;
  areaSource: CampaignAreaSource;
  profileAreas: CampaignAreaEntry[];
  campaignAreas: CampaignAreaEntry[];
}

export interface PharmacyCampaignDashboard {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  services: ServiceCatalogEntry[];
  campaigns: PharmacyCampaignWithExecution[];
  activeCampaigns: number;
  archivedCampaigns: number;
  goals: CampaignGoal[];
  primaryExecution: PharmacyCampaignWithExecution | null;
  primaryLaunchQueue: CampaignLaunchQueueEntry | null;
}

interface EcosystemIndex {
  assets: Array<{ id: string; type: string }>;
}

interface PublishIndex {
  pages: Array<{ pageType: string; serviceId: string }>;
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

function campaignsPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${safeSlug(slug)}.json`);
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

function publishIndexPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-publish", safeSlug(slug), "_publish-index.json");
}

function registryPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-registry", `${safeSlug(slug)}.json`);
}

function packCount(slug: string, serviceId: string, packFile: string, key: string): number {
  const file = path.join(
    WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    safeSlug(slug),
    serviceId,
    "packs",
    packFile,
  );
  const data = readJson<Record<string, unknown>>(file);
  if (!data) return 0;
  const items = data[key];
  return Array.isArray(items) ? items.length : 0;
}

const BLUEPRINT_COUNTS: Omit<CampaignAssetCounts, "total" | "publishingQueue" | "indexingQueue"> = {
  servicePage: 1,
  localServicePage: 1,
  faqPage: 1,
  patientGuide: 1,
  blogPosts: 3,
  socialPosts: 20,
  gbpPosts: 10,
  emailSequence: 1,
  videoScript: 1,
};

function sumAssetCounts(counts: Omit<CampaignAssetCounts, "total">): number {
  return (
    counts.servicePage +
    counts.localServicePage +
    counts.faqPage +
    counts.patientGuide +
    counts.blogPosts +
    counts.socialPosts +
    counts.gbpPosts +
    counts.emailSequence +
    counts.videoScript +
    counts.publishingQueue +
    counts.indexingQueue
  );
}

function loadProfileData(slug: string) {
  const profilePath = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${safeSlug(slug)}.json`);
  const profile = readJson<{ data?: Record<string, unknown> }>(profilePath);
  return normalizeProfileData(profile?.data || {});
}

function loadProfileBasics(slug: string): { pharmacyName: string; brandPrimaryColor: string } {
  const data = loadProfileData(slug);
  return {
    pharmacyName: String(data.pharmacyName || "Pharmacy"),
    brandPrimaryColor: String(data.brandPrimaryColor || "#003087"),
  };
}

function getPublishPages(slug: string, serviceId?: string): PublishIndex["pages"] {
  const index = readJson<PublishIndex>(publishIndexPath(slug));
  const pages = index?.pages || [];
  return serviceId ? pages.filter((p) => p.serviceId === serviceId) : pages;
}

function getRegistryRootPage(slug: string, serviceId: string) {
  const registry = readJson<PharmacyRegistry>(registryPath(slug));
  return registry?.pages.find((p) => p.serviceId === serviceId && p.pageType === "service") || null;
}

function getVisibilityService(slug: string, serviceId: string) {
  const report = readPharmacyVisibilityReport(slug);
  return report?.services.find((s) => s.serviceId === serviceId) || null;
}

function buildCampaignLinks(slug: string, serviceId: string): PharmacyCampaign["links"] {
  const s = safeSlug(slug);
  return {
    ecosystem: `/api/pharmacy-content-ecosystem-preview/${serviceId}/`,
    publishedPage: `/api/pharmacy-visual-experience/${serviceId}/`,
    indexing: `/api/pharmacy-growth-dashboard?slug=${s}#indexing`,
    visibility: `/api/pharmacy-growth-dashboard?slug=${s}#visibility`,
  };
}

function resolveAssetCounts(slug: string, serviceId: string): CampaignAssetCounts {
  const publishPages = getPublishPages(slug, serviceId);
  const publishingQueue = publishPages.length;
  const rootPage = getRegistryRootPage(slug, serviceId);
  const indexingQueue = rootPage ? 1 : 0;

  const ecoPath = ecosystemIndexPath(slug, serviceId);
  if (fs.existsSync(ecoPath)) {
    const eco = readJson<EcosystemIndex>(ecoPath);
    const assets = eco?.assets || [];
    const blogPosts = assets.filter((a) => a.type === "Blog post").length;
    const counts: Omit<CampaignAssetCounts, "total"> = {
      servicePage: assets.some((a) => a.type === "Root service page") ? 1 : 0,
      localServicePage: assets.some((a) => a.type === "Local service page") ? 1 : 0,
      faqPage: assets.some((a) => /faq/i.test(a.type)) ? 1 : 0,
      patientGuide: assets.some((a) => /patient guide/i.test(a.type)) ? 1 : 0,
      blogPosts: blogPosts || BLUEPRINT_COUNTS.blogPosts,
      socialPosts: packCount(slug, serviceId, "social-posts.json", "posts") || BLUEPRINT_COUNTS.socialPosts,
      gbpPosts: packCount(slug, serviceId, "gbp-posts.json", "posts") || BLUEPRINT_COUNTS.gbpPosts,
      emailSequence: packCount(slug, serviceId, "email-sequence.json", "emails") || BLUEPRINT_COUNTS.emailSequence,
      videoScript: assets.some((a) => /video script/i.test(a.type)) ? 1 : 0,
      publishingQueue,
      indexingQueue,
    };
    return { ...counts, total: sumAssetCounts(counts) };
  }

  const areaPages = publishPages.filter((p) => p.pageType === "service-area").length;
  const counts: Omit<CampaignAssetCounts, "total"> = {
    ...BLUEPRINT_COUNTS,
    localServicePage: areaPages > 0 ? areaPages : BLUEPRINT_COUNTS.localServicePage,
    publishingQueue,
    indexingQueue,
  };
  return { ...counts, total: sumAssetCounts(counts) };
}

function resolveBridgeStatus(slug: string, serviceId: string): CampaignBridgeStatus {
  const publishPages = getPublishPages(slug, serviceId);
  const rootPublished = publishPages.some((p) => p.pageType === "service");
  const rootPage = getRegistryRootPage(slug, serviceId);
  const visibility = getVisibilityService(slug, serviceId);

  const publishedPages = publishPages.length;
  const indexedPages = rootPage?.indexingStatus === "indexed" ? 1 : 0;
  const visiblePages = visibility?.visibilityStatus === "visible" ? 1 : 0;

  let publishingStatus: CampaignBridgeStatus["publishingStatus"] = "pending";
  if (rootPublished && publishedPages > 1) publishingStatus = "published";
  else if (rootPublished) publishingStatus = "partial";

  return {
    publishedPages,
    indexedPages,
    visiblePages,
    publishingStatus,
    indexingStatus: rootPage?.indexingStatus || "not_registered",
    visibilityStatus: visibility?.visibilityStatus || visibility?.indexedStatus || "unknown",
  };
}

export function buildOutputs(slug: string, serviceId: string): CampaignOutputItem[] {
  const counts = resolveAssetCounts(slug, serviceId);
  const ecoExists = fs.existsSync(ecosystemIndexPath(slug, serviceId));
  const source = ecoExists ? "ecosystem" : "blueprint";

  return [
    { id: "service-page", label: "Service Page", count: counts.servicePage, available: counts.servicePage > 0, source },
    {
      id: "local-service-page",
      label: "Local Service Page",
      count: counts.localServicePage,
      available: counts.localServicePage > 0,
      source: ecoExists ? "ecosystem" : "publish",
    },
    { id: "faq-page", label: "FAQ Page", count: counts.faqPage, available: counts.faqPage > 0 && ecoExists, source },
    {
      id: "patient-guide",
      label: "Patient Guide",
      count: counts.patientGuide,
      available: counts.patientGuide > 0 && ecoExists,
      source,
    },
    {
      id: "blog-posts",
      label: "Blog Posts",
      count: counts.blogPosts,
      available: ecoExists && counts.blogPosts > 0,
      source,
    },
    {
      id: "social-posts",
      label: "Social Posts",
      count: counts.socialPosts,
      available: ecoExists && counts.socialPosts > 0,
      source,
    },
    {
      id: "gbp-posts",
      label: "GBP Posts",
      count: counts.gbpPosts,
      available: ecoExists && counts.gbpPosts > 0,
      source,
    },
    {
      id: "email-sequence",
      label: "Email Sequence",
      count: counts.emailSequence,
      available: ecoExists && counts.emailSequence > 0,
      source,
    },
    {
      id: "video-script",
      label: "Video Script",
      count: counts.videoScript,
      available: counts.videoScript > 0 && ecoExists,
      source,
    },
    {
      id: "publishing-queue",
      label: "Publishing Queue",
      count: counts.publishingQueue,
      available: counts.publishingQueue > 0,
      source: "publish",
    },
    {
      id: "indexing-queue",
      label: "Indexing Queue",
      count: counts.indexingQueue,
      available: counts.indexingQueue > 0,
      source: "registry",
    },
  ];
}

export function readPharmacyCampaignStore(slug: string): PharmacyCampaignStore | null {
  return readJson<PharmacyCampaignStore>(campaignsPath(slug));
}

export function writePharmacyCampaignStore(store: PharmacyCampaignStore): string {
  const file = campaignsPath(store.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(store, null, 2));
  return file;
}

export function getServiceCatalog(slug: string): ServiceCatalogEntry[] {
  const s = safeSlug(slug);
  return getBenchmarkPublishServices().map((meta) => {
    const masterPath = path.join(WORKSPACE_ROOT, "docs/pharmacy-master-library", meta.masterFile);
    const ecoPath = ecosystemIndexPath(s, meta.serviceId);
    const eco = readJson<EcosystemIndex>(ecoPath);
    const publishPages = getPublishPages(s, meta.serviceId);
    const rootPublished = publishPages.some((p) => p.pageType === "service");
    const rootPage = getRegistryRootPage(s, meta.serviceId);
    const visibility = getVisibilityService(s, meta.serviceId);

    return {
      serviceId: meta.serviceId,
      serviceName: meta.serviceName,
      masterFile: meta.masterFile,
      masterReadiness: fs.existsSync(masterPath) ? "ready" : "missing",
      ecosystemAvailability: eco ? "available" : "not_generated",
      ecosystemAssetCount: eco?.assets.length ?? 0,
      publishedStatus: rootPublished ? "published" : "not_published",
      publishedPageCount: publishPages.length,
      indexingStatus: rootPage?.indexingStatus || "not_registered",
      visibilityStatus: visibility?.visibilityStatus || "unknown",
    };
  });
}

export function buildCampaignCreationSummary(
  slug: string,
  serviceId: string,
  campaignGoal: CampaignGoal | null = null,
): CampaignCreationSummary {
  const meta = getServicePublishMeta(serviceId);
  if (!meta) throw new Error(`Unknown service: ${serviceId}`);

  const expectedAssets = resolveAssetCounts(slug, serviceId);
  const bridgeStatus = resolveBridgeStatus(slug, serviceId);
  const profileAreas = resolveProfileCampaignAreas(loadProfileData(slug));

  return {
    serviceId,
    serviceName: meta.serviceName,
    campaignGoal,
    expectedAssets,
    publishedAssets: bridgeStatus.publishedPages,
    indexedAssets: bridgeStatus.indexedPages,
    visibilityAssets: bridgeStatus.visiblePages,
    outputs: buildOutputs(slug, serviceId),
    bridgeStatus,
    areaSource: "profile",
    profileAreas,
    campaignAreas: profileAreas,
  };
}

export function buildPharmacyCampaignDashboard(slug: string): PharmacyCampaignDashboard {
  const s = safeSlug(slug);
  const profile = loadProfileBasics(s);
  const store = readPharmacyCampaignStore(s);
  const campaigns = (store?.campaigns || []).filter((c) => c.status !== "archived");
  const archived = (store?.campaigns || []).filter((c) => c.status === "archived");
  const allCampaigns = enrichCampaignsWithExecution(
    s,
    [...campaigns, ...archived].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    ),
  );

  if (!readPharmacyCampaignLaunchQueue(s) && campaigns.length) {
    refreshPharmacyCampaignLaunchQueue(s);
  }

  return {
    slug: s,
    pharmacyName: profile.pharmacyName,
    brandPrimaryColor: profile.brandPrimaryColor,
    services: getServiceCatalog(s),
    campaigns: allCampaigns,
    activeCampaigns: campaigns.length,
    archivedCampaigns: archived.length,
    goals: CAMPAIGN_GOALS,
    primaryExecution: allCampaigns.find((c) => c.status === "active") || allCampaigns[0] || null,
    primaryLaunchQueue: getPrimaryLaunchQueueSummary(s),
  };
}

function campaignName(serviceName: string, goal: CampaignGoal): string {
  return `${serviceName} — ${goal}`;
}

export function createPharmacyCampaign(
  slug: string,
  input: {
    serviceId: string;
    campaignGoal: CampaignGoal;
    areaSource?: CampaignAreaSource;
    campaignAreas?: CampaignAreaEntry[];
  },
): { campaign: PharmacyCampaign; storePath: string } {
  const s = safeSlug(slug);
  const serviceId = String(input.serviceId || "").trim();
  if (!BENCHMARK_MASTER_SERVICE_IDS.includes(serviceId as (typeof BENCHMARK_MASTER_SERVICE_IDS)[number])) {
    throw new Error(`Service not in campaign catalog: ${serviceId}`);
  }
  if (!CAMPAIGN_GOALS.includes(input.campaignGoal)) {
    throw new Error(`Invalid campaign goal: ${input.campaignGoal}`);
  }

  const meta = getServicePublishMeta(serviceId);
  if (!meta) throw new Error(`Missing publish meta for ${serviceId}`);

  const existing = readPharmacyCampaignStore(s);
  const duplicate = (existing?.campaigns || []).find(
    (c) => c.status === "active" && c.serviceId === serviceId,
  );
  if (duplicate) {
    throw new Error(
      `An active ${meta.serviceName} campaign already exists (${duplicate.id}). Open that campaign instead of creating a duplicate.`,
    );
  }

  const summary = buildCampaignCreationSummary(s, serviceId, input.campaignGoal);
  const bridge = summary.bridgeStatus;
  const areaSource = input.areaSource === "custom" ? "custom" : "profile";
  const campaignAreas =
    areaSource === "custom" && input.campaignAreas?.length
      ? input.campaignAreas
      : summary.profileAreas;

  const campaign: PharmacyCampaign = {
    id: randomUUID(),
    name: campaignName(meta.serviceName, input.campaignGoal),
    serviceId,
    serviceName: meta.serviceName,
    campaignGoal: input.campaignGoal,
    createdAt: new Date().toISOString(),
    status: "active",
    assetCounts: summary.expectedAssets,
    publishingStatus: bridge.publishingStatus,
    indexingStatus: bridge.indexingStatus,
    visibilityStatus: bridge.visibilityStatus,
    publishedPages: bridge.publishedPages,
    indexedPages: bridge.indexedPages,
    visiblePages: bridge.visiblePages,
    links: buildCampaignLinks(s, serviceId),
    areaSource,
    campaignAreas,
  };

  const store: PharmacyCampaignStore = {
    version: 1,
    slug: s,
    updatedAt: new Date().toISOString(),
    campaigns: [...(existing?.campaigns || []), campaign],
  };

  const storePath = writePharmacyCampaignStore(store);
  ensureLaunchQueueForCampaign(s, campaign);
  refreshPharmacyCampaignLaunchQueue(s);

  // Activate this service in Campaign Builder so the next Product Owner step is Service Evidence
  // for the new campaign — not a repeat of website import / business profile.
  selectCampaignBuilderService(s, serviceId);

  return { campaign, storePath };
}

export function archivePharmacyCampaign(slug: string, campaignId: string): PharmacyCampaignStore {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  if (!store) throw new Error(`No campaigns file for slug: ${s}`);

  const idx = store.campaigns.findIndex((c) => c.id === campaignId);
  if (idx === -1) throw new Error(`Campaign not found: ${campaignId}`);

  store.campaigns[idx] = { ...store.campaigns[idx]!, status: "archived" };
  store.updatedAt = new Date().toISOString();
  writePharmacyCampaignStore(store);
  return store;
}

export interface CampaignCoverageSummary {
  enabledServiceCount: number;
  activeCampaignCount: number;
  missingServiceIds: string[];
  allCampaignsCreated: boolean;
}

export function getCampaignCoverageSummary(slug: string): CampaignCoverageSummary {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  const activeIds = new Set(
    (store?.campaigns || []).filter((c) => c.status === "active").map((c) => c.serviceId),
  );
  const enabled = [...BENCHMARK_MASTER_SERVICE_IDS];
  const missing = enabled.filter((id) => !activeIds.has(id));
  return {
    enabledServiceCount: enabled.length,
    activeCampaignCount: activeIds.size,
    missingServiceIds: missing,
    allCampaignsCreated: missing.length === 0,
  };
}

export function regeneratePharmacyCampaignPage(
  slug: string,
  campaignId: string,
): {
  campaign: PharmacyCampaign;
  visualRebuilt: boolean;
  rebuildUrl: string;
  redirectUrl: string;
} {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  if (!store) throw new Error(`No campaigns file for slug: ${s}`);

  const idx = store.campaigns.findIndex((c) => c.id === campaignId && c.status === "active");
  if (idx === -1) throw new Error(`Active campaign not found: ${campaignId}`);

  const campaign = store.campaigns[idx]!;
  const serviceId = campaign.serviceId;
  let visualRebuilt = false;

  if ((VISUAL_EXPERIENCE_BENCHMARK_SERVICES as readonly string[]).includes(serviceId)) {
    try {
      buildVisualExperiencePage(s, serviceId as VisualExperienceServiceId);
      visualRebuilt = true;
    } catch {
      visualRebuilt = false;
    }
  }

  const now = new Date().toISOString();
  const updated: PharmacyCampaign = { ...campaign, regeneratedAt: now };
  store.campaigns[idx] = updated;
  store.updatedAt = now;
  writePharmacyCampaignStore(store);

  return {
    campaign: updated,
    visualRebuilt,
    rebuildUrl: `/api/pharmacy-visual-experience/${serviceId}/?slug=${s}&rebuild=1`,
    redirectUrl: `/api/pharmacy-campaigns?slug=${s}&campaignId=${campaignId}`,
  };
}

export function getPharmacyCampaignStatus(slug: string): {
  slug: string;
  storePath: string;
  storeExists: boolean;
  campaignCount: number;
  activeCampaigns: number;
  indexingSummary: ReturnType<typeof readPharmacyIndexingSummary> | null;
} {
  const s = safeSlug(slug);
  const store = readPharmacyCampaignStore(s);
  const file = campaignsPath(s);
  return {
    slug: s,
    storePath: file,
    storeExists: Boolean(store),
    campaignCount: store?.campaigns.length ?? 0,
    activeCampaigns: store?.campaigns.filter((c) => c.status === "active").length ?? 0,
    indexingSummary: readPharmacyIndexingSummary(s),
  };
}
