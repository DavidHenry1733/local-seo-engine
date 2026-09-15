/**
 * NT-E2E-19 — Canonical Ecosystem Generation Plan (single source for readiness + scheduler).
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { readCommercialIntelligenceApprovalExtended } from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { PAGE_IMAGE_SLOTS, loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import { RC1_IMG1_PAGE_SLOT_PLANS } from "./pharmacyImageLibraryAssignmentService.ts";
import { buildProductionPageSlotInventory } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import { slugifyArea } from "./pharmacyAreaNarrativeProfiles.ts";
import {
  resolveClusterPageSlug,
  resolveClusterPageUrlPath,
  resolveClusterPageFilesystemRelativePath,
} from "./pharmacyClusterPageUrlResolver.ts";
import type { ProfileAreaEntry } from "./pharmacyProfileSchema.ts";
import { readAuthorisedEcosystemGenerationRecord } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import { buildCommercialIntelligenceDashboard } from "./masterAdminCommercialIntelligenceDashboardService.ts";

export const CANONICAL_PLAN_VERSION = 2;
export const RC1_CLUSTER_PAGE_ARCHITECTURE = true;
export const V1_GUIDE_COUNT = 1;
export const V1_FAQ_COUNT = 1;
export const V1_BLOG_COUNT = 3;
export const V1_SUPPORTING_COUNT = 1;
export const MIN_CLUSTER_FALLBACK = 2;
export const MIN_AREA_FALLBACK = 4;

export type CanonicalAreaClassification = "cluster-page" | "excluded";
export type CanonicalRecommendationClass =
  | "required_v1_generation"
  | "optional_recommendation"
  | "post_launch_opportunity"
  | "unsupported_recommendation";

export interface CanonicalAreaPlanEntry {
  areaName: string;
  areaSlug: string;
  areaType: string;
  classification: CanonicalAreaClassification;
  parentServiceHub: string | null;
  pageType: "cluster-page" | null;
  inclusionStatus: "included" | "excluded";
  exclusionReason: string | null;
  generationEligible: boolean;
  serviceRelevance: string[];
  expectedUrlPath: string | null;
  source: string;
}

export interface CanonicalPagePlanEntry {
  inventoryId: string;
  pageType: string;
  slug: string;
  title: string;
  inclusionStatus: "included" | "excluded";
  exclusionReason: string | null;
  expectedUrlPath: string;
  source: string;
  countedInTotal: boolean;
}

export interface CanonicalInventoryReconciliation {
  inventoryTotal: number;
  categorySum: number;
  schedulerTotal: number;
  dashboardTotal: number;
  reconciled: boolean;
  totalCalculation: string;
  uncategorizedPageTypes: string[];
}

export interface CanonicalImagePlanEntry {
  pageType: string;
  slot: string;
  role: string;
  serviceId: string;
  orientation: string;
  minimumDimensions: string;
  selectedAsset: string | null;
  assignmentStatus: "assigned" | "missing" | "optional";
  source: string;
}

export interface CanonicalRecommendationEntry {
  title: string;
  source: "competitor" | "local_market" | "growth_intelligence" | "commercial_intelligence";
  classification: CanonicalRecommendationClass;
  detail: string;
}

export interface CanonicalEcosystemGenerationPlan {
  version: typeof CANONICAL_PLAN_VERSION;
  planId: string;
  planRevision: string;
  createdAt: string;
  slug: string;
  frozen: boolean;
  frozenAt: string | null;
  sourceRevisions: {
    businessProfileRevision: string | null;
    commercialIntelligenceRevision: string | null;
    engineRevision: string;
    campaignMode: string;
  };
  primaryService: string;
  additionalServices: string[];
  confirmedTown: string;
  campaignMode: string;
  areaEntries: CanonicalAreaPlanEntry[];
  pageInventory: CanonicalPagePlanEntry[];
  imageInventory: CanonicalImagePlanEntry[];
  inventoryReconciliation: CanonicalInventoryReconciliation;
  coreEcosystem: {
    homepage: number;
    serviceHubs: number;
    clusterPages: number;
    blogs: number;
    guides: number;
    faqs: number;
    supportingPages: number;
    images: number;
    requiredImageRoles: number;
    totalPages: number;
    inventoryTotal: number;
    categorySum: number;
    approvedAreas: number;
  };
  recommendedFutureContent: CanonicalRecommendationEntry[];
  exclusions: string[];
  warnings: string[];
  blockers: string[];
  expectedDurationMinutes: number;
  checksum: string;
}

const PLAN_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/canonical-ecosystem-plans");
const ENGINE_REVISION = "rc1-cluster-page-architecture-v1";
const COUNTED_PAGE_TYPES = new Set([
  "homepage",
  "service-hub",
  "cluster-page",
  "blog",
  "guide",
  "faq",
  "supporting",
]);

function finalizePageInventory(pages: Omit<CanonicalPagePlanEntry, "inventoryId" | "countedInTotal">[]): CanonicalPagePlanEntry[] {
  return pages.map((page, index) => ({
    ...page,
    inventoryId: `page-${String(index + 1).padStart(3, "0")}:${page.pageType}:${page.slug}`,
    countedInTotal: page.inclusionStatus === "included" && COUNTED_PAGE_TYPES.has(page.pageType),
  }));
}

export function reconcileCoreEcosystemFromInventory(
  pageInventory: CanonicalPagePlanEntry[],
): {
  coreEcosystem: CanonicalEcosystemGenerationPlan["coreEcosystem"];
  inventoryReconciliation: CanonicalInventoryReconciliation;
} {
  const counted = pageInventory.filter((p) => p.countedInTotal);
  const byType = (type: string) => counted.filter((p) => p.pageType === type).length;
  const homepage = byType("homepage");
  const serviceHubs = byType("service-hub");
  const clusterPages = byType("cluster-page");
  const blogs = byType("blog");
  const guides = byType("guide");
  const faqs = byType("faq");
  const supportingPages = byType("supporting");
  const categorySum = homepage + serviceHubs + clusterPages + blogs + guides + faqs + supportingPages;
  const inventoryTotal = counted.length;
  const uncategorizedPageTypes = [
    ...new Set(
      counted.filter((p) => !COUNTED_PAGE_TYPES.has(p.pageType)).map((p) => p.pageType),
    ),
  ];
  const totalCalculation = [
    `homepage(${homepage})`,
    `serviceHubs(${serviceHubs})`,
    `clusterPages(${clusterPages})`,
    `blogs(${blogs})`,
    `guides(${guides})`,
    `faqs(${faqs})`,
    `supportingPages(${supportingPages})`,
  ].join(" + ");
  const inventoryReconciliation: CanonicalInventoryReconciliation = {
    inventoryTotal,
    categorySum,
    schedulerTotal: inventoryTotal,
    dashboardTotal: inventoryTotal,
    reconciled: categorySum === inventoryTotal && uncategorizedPageTypes.length === 0,
    totalCalculation: `${totalCalculation} = ${categorySum}`,
    uncategorizedPageTypes,
  };
  const coreEcosystem = {
    homepage,
    serviceHubs,
    clusterPages,
    blogs,
    guides,
    faqs,
    supportingPages,
    images: 0,
    requiredImageRoles: PAGE_IMAGE_SLOTS.length,
    totalPages: inventoryTotal,
    inventoryTotal,
    categorySum,
    approvedAreas: clusterPages,
  };
  return { coreEcosystem, inventoryReconciliation };
}

function hydratePageInventory(pages: CanonicalPagePlanEntry[]): CanonicalPagePlanEntry[] {
  if (pages.length > 0 && pages.every((p) => p.inventoryId && typeof p.countedInTotal === "boolean")) {
    return pages;
  }
  return finalizePageInventory(
    pages.map(({ inventoryId: _id, countedInTotal: _counted, ...page }) => page),
  );
}

export function normalizeCanonicalPlanInventory(
  plan: CanonicalEcosystemGenerationPlan,
): CanonicalEcosystemGenerationPlan {
  const pageInventory = hydratePageInventory(plan.pageInventory);
  const { coreEcosystem: coreFromInventory, inventoryReconciliation } =
    reconcileCoreEcosystemFromInventory(pageInventory);
  const coreEcosystem = {
    ...coreFromInventory,
    images: plan.coreEcosystem?.images ?? 0,
    requiredImageRoles: plan.coreEcosystem?.requiredImageRoles ?? PAGE_IMAGE_SLOTS.length,
    approvedAreas: plan.coreEcosystem?.approvedAreas ?? coreFromInventory.approvedAreas,
  };
  inventoryReconciliation.dashboardTotal = coreEcosystem.totalPages;
  inventoryReconciliation.schedulerTotal = coreEcosystem.totalPages;
  inventoryReconciliation.reconciled =
    inventoryReconciliation.reconciled &&
    coreEcosystem.categorySum === coreEcosystem.inventoryTotal &&
    coreEcosystem.inventoryTotal === coreEcosystem.totalPages;
  return {
    ...plan,
    pageInventory,
    coreEcosystem,
    inventoryReconciliation,
  };
}

export function deriveCanonicalPlanReadinessCounts(plan: CanonicalEcosystemGenerationPlan) {
  const normalized = normalizeCanonicalPlanInventory(plan);
  const { coreEcosystem, inventoryReconciliation } = normalized;
  const total = coreEcosystem.inventoryTotal;
  return {
    expectedHomepageCount: coreEcosystem.homepage,
    expectedServiceHubCount: coreEcosystem.serviceHubs,
    approvedAreaCount: coreEcosystem.approvedAreas,
    clusterPagesToGenerate: coreEcosystem.clusterPages,
    expectedGuideCount: coreEcosystem.guides,
    expectedBlogCount: coreEcosystem.blogs,
    expectedFaqCount: coreEcosystem.faqs,
    expectedSupportingPageCount: coreEcosystem.supportingPages,
    expectedTotalPageCount: total,
    schedulerPageCount: total,
    inventoryReconciliation,
    coreEcosystemInventory: coreEcosystem,
  };
}

function planPath(slug: string, revision?: string): string {
  if (revision) return path.join(PLAN_DIR, slug, `${revision}.json`);
  return path.join(PLAN_DIR, slug, "latest.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function hashPlan(plan: Omit<CanonicalEcosystemGenerationPlan, "checksum">): string {
  return createHash("sha256").update(JSON.stringify(plan)).digest("hex");
}

export function resolveConfirmedProfileAreas(profile: ReturnType<typeof readSetupProfile>): ProfileAreaEntry[] {
  const fromSelected = (profile.selectedAreas || []).filter((a) => a.selected !== false);
  if (fromSelected.length) return fromSelected;
  const legacy = (profile.selectedLocalAreas || profile.localAreas || profile.nearbyAreas || []) as Array<
    string | ProfileAreaEntry
  >;
  return legacy.map((a, i) =>
    typeof a === "string"
      ? { areaName: a, selected: true, order: i + 1, priority: i + 1, areaType: "neighbourhood", source: "legacy" }
      : a,
  );
}

export function resolveCommercialAuthorisedTargetAreaNames(slug: string): {
  mode: string;
  primaryTown: string;
  areas: string[];
} {
  const profile = readSetupProfile(slug);
  const session = loadCampaignBuilderSession(slug);
  const primaryTown = String(profile.primaryTown || profile.townCity || "").trim();
  const confirmed = resolveConfirmedProfileAreas(profile).map((a) => a.areaName).filter(Boolean);
  if (!confirmed.length) {
    throw new Error("Confirmed Business Profile local areas are required before authorised commercial generation.");
  }
  return {
    mode: session.targetAreaMode || "selectedAreas",
    primaryTown,
    areas: confirmed,
  };
}

function buildAreaEntries(
  serviceId: string,
  profile: ReturnType<typeof readSetupProfile>,
): CanonicalAreaPlanEntry[] {
  const entries: CanonicalAreaPlanEntry[] = [];
  const confirmed = resolveConfirmedProfileAreas(profile);

  for (const entry of confirmed) {
    const pageSlug = resolveClusterPageSlug(entry.areaName);
    entries.push({
      areaName: entry.areaName,
      areaSlug: pageSlug,
      areaType: entry.areaType || "cluster",
      classification: "cluster-page",
      parentServiceHub: serviceId,
      pageType: "cluster-page",
      inclusionStatus: "included",
      exclusionReason: null,
      generationEligible: true,
      serviceRelevance: [serviceId],
      expectedUrlPath: resolveClusterPageUrlPath(entry.areaName),
      source: "operator-confirmed:profile.selectedAreas",
    });
  }

  return entries;
}

function buildPageInventory(
  slug: string,
  serviceId: string,
  serviceName: string,
  services: string[],
  areaEntries: CanonicalAreaPlanEntry[],
): CanonicalPagePlanEntry[] {
  const pages: Omit<CanonicalPagePlanEntry, "inventoryId" | "countedInTotal">[] = [
    {
      pageType: "homepage",
      slug: "index",
      title: "Homepage",
      inclusionStatus: "included",
      exclusionReason: null,
      expectedUrlPath: `/`,
      source: "v1-core-contract",
    },
    {
      pageType: "service-hub",
      slug: serviceId,
      title: serviceName,
      inclusionStatus: "included",
      exclusionReason: null,
      expectedUrlPath: `/${serviceId}/`,
      source: "approved-business-profile:primary-service-hub",
    },
  ];

  for (const svc of services.slice(1)) {
    pages.push({
      pageType: "service-hub",
      slug: svc,
      title: svc,
      inclusionStatus: "included",
      exclusionReason: null,
      expectedUrlPath: `/${svc}/`,
      source: "approved-business-profile:additional-service-hub",
    });
  }

  for (const area of areaEntries) {
    if (area.inclusionStatus !== "included" || !area.pageType || !area.expectedUrlPath) continue;
    pages.push({
      pageType: area.pageType,
      slug: area.areaSlug,
      title: area.areaName,
      inclusionStatus: "included",
      exclusionReason: null,
      expectedUrlPath: area.expectedUrlPath,
      source: area.source,
    });
  }

  pages.push({
    pageType: "guide",
    slug: `${serviceId}-guide`,
    title: `${serviceName} patient guide`,
    inclusionStatus: "included",
    exclusionReason: null,
    expectedUrlPath: `/${serviceId}-guide/`,
    source: "v1-engine-contract:1-guide",
  });

  const blogSlugs = [`what-is-${serviceId}`, `who-should-consider-${serviceId}`, `${serviceId}-what-you-need-to-know`];
  for (const blogSlug of blogSlugs.slice(0, V1_BLOG_COUNT)) {
    pages.push({
      pageType: "blog",
      slug: blogSlug,
      title: blogSlug,
      inclusionStatus: "included",
      exclusionReason: null,
      expectedUrlPath: `/${blogSlug}/`,
      source: "v1-engine-contract:3-blogs",
    });
  }

  pages.push({
    pageType: "faq",
    slug: `${serviceId}-faqs`,
    title: `${serviceName} FAQs`,
    inclusionStatus: "included",
    exclusionReason: null,
    expectedUrlPath: `/${serviceId}-faqs/`,
    source: "v1-engine-contract:1-faq",
  });

  pages.push({
    pageType: "supporting",
    slug: `${serviceId}-content-ecosystem`,
    title: "Content ecosystem summary",
    inclusionStatus: "included",
    exclusionReason: null,
    expectedUrlPath: `/${serviceId}-content-ecosystem/`,
    source: "v1-engine-contract:1-supporting",
  });

  return finalizePageInventory(pages);
}

function buildImageInventory(slug: string, serviceId: string, plan?: CanonicalEcosystemGenerationPlan): CanonicalImagePlanEntry[] {
  const assignments = loadImageAssignments(slug);
  const inventory: CanonicalImagePlanEntry[] = [];
  const slotPlans = plan
    ? buildProductionPageSlotInventory(slug, serviceId, plan)
    : RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId);
  for (const slotPlan of slotPlans) {
    const key = `${slotPlan.pageSlug}:${slotPlan.serviceId}:${slotPlan.slot}`;
    const assigned = assignments.assignments?.[key];
    inventory.push({
      pageType: slotPlan.pageType === "homepage" && slotPlan.pageSlug.startsWith("local-cluster-")
        ? "cluster-page"
        : slotPlan.pageType,
      slot: slotPlan.slot,
      role: slotPlan.role,
      serviceId,
      orientation: slotPlan.slot === "hero" ? "landscape" : "landscape",
      minimumDimensions: slotPlan.slot === "hero" ? "1200x675" : "800x600",
      selectedAsset: (assigned as { assetId?: string })?.assetId || assigned?.libraryRef || null,
      assignmentStatus:
        assigned?.sourceType === "image-platform" || assigned?.sourceType === "upload" ? "assigned" : "missing",
      source: "image-platform:v1-four-role-contract",
    });
  }
  return inventory;
}

function classifyCiRecommendations(slug: string): CanonicalRecommendationEntry[] {
  const ci = buildCommercialIntelligenceDashboard(slug);
  const out: CanonicalRecommendationEntry[] = [];
  for (const opp of ci.recommendations || []) {
    out.push({
      title: opp.title,
      source: "commercial_intelligence",
      classification: "optional_recommendation",
      detail: opp.detail || opp.impact || "",
    });
  }
  for (const opp of ci.growthIntelligence?.opportunities || []) {
    out.push({
      title: opp.title,
      source: "growth_intelligence",
      classification: "post_launch_opportunity",
      detail: opp.evidence || opp.impact || "",
    });
  }
  return out;
}

export function buildCanonicalEcosystemGenerationPlan(slug: string): CanonicalEcosystemGenerationPlan {
  const ctx = loadMasterAdminCustomerContext(slug);
  const profile = readSetupProfile(slug);
  const setup = buildGenerationSetupState(slug);
  const bpr = readLatestApprovalSnapshot(slug);
  const ci = readCommercialIntelligenceApprovalExtended(slug);
  const session = loadCampaignBuilderSession(slug);
  const serviceId = ctx?.serviceId || "pharmacy-first";
  const services = (profile.selectedServices || [serviceId]).map(String);
  const primaryTown = setup.primaryTown || profile.primaryTown || profile.townCity || "Not confirmed";
  const target = resolveCommercialAuthorisedTargetAreaNames(slug);
  const areaEntries = buildAreaEntries(serviceId, profile);
  const serviceName = ctx?.displayName || profile.pharmacyName || serviceId;
  const pageInventory = buildPageInventory(slug, serviceId, serviceName, services, areaEntries);
  const imageInventory = buildImageInventory(slug, serviceId, plan);
  const { coreEcosystem: coreFromInventory, inventoryReconciliation } = reconcileCoreEcosystemFromInventory(pageInventory);
  const coreEcosystem = {
    ...coreFromInventory,
    images: imageInventory.filter((i) => i.assignmentStatus === "assigned").length,
    requiredImageRoles: PAGE_IMAGE_SLOTS.length,
    approvedAreas: areaEntries.filter((a) => a.inclusionStatus === "included").length,
  };
  inventoryReconciliation.dashboardTotal = coreEcosystem.totalPages;
  inventoryReconciliation.schedulerTotal = coreEcosystem.totalPages;
  inventoryReconciliation.reconciled =
    inventoryReconciliation.reconciled &&
    coreEcosystem.categorySum === coreEcosystem.inventoryTotal &&
    coreEcosystem.inventoryTotal === coreEcosystem.totalPages;

  const planRevision = new Date().toISOString();
  const planId = createHash("sha256")
    .update(`${slug}:${planRevision}:${ci?.approvedVersion || ""}:${bpr?.approvedAt || ""}`)
    .digest("hex")
    .slice(0, 16);

  const withoutChecksum: Omit<CanonicalEcosystemGenerationPlan, "checksum"> = {
    version: CANONICAL_PLAN_VERSION,
    planId,
    planRevision,
    createdAt: planRevision,
    slug,
    frozen: false,
    frozenAt: null,
    sourceRevisions: {
      businessProfileRevision: bpr?.approvedAt || bpr?.revisionId || null,
      commercialIntelligenceRevision: ci?.approvedVersion || null,
      engineRevision: ENGINE_REVISION,
      campaignMode: session.targetAreaMode || "selectedAreas",
    },
    primaryService: serviceId,
    additionalServices: services.slice(1),
    confirmedTown: primaryTown,
    campaignMode: target.mode,
    areaEntries,
    pageInventory,
    imageInventory,
    inventoryReconciliation,
    coreEcosystem,
    recommendedFutureContent: classifyCiRecommendations(slug),
    exclusions: [],
    warnings: [
      ...(session.targetAreaMode === "wholeTown"
        ? ["Campaign Builder wholeTown mode aligned to hub + all confirmed profile areas"]
        : []),
      ...(imageInventory.some((i) => i.assignmentStatus === "missing")
        ? ["Some V1 image roles are not yet assigned"]
        : []),
    ],
    blockers: inventoryReconciliation.reconciled ? [] : ["Canonical page inventory reconciliation failed"],
    expectedDurationMinutes: 30,
  };

  const plan: CanonicalEcosystemGenerationPlan = { ...withoutChecksum, checksum: hashPlan(withoutChecksum) };
  writeJsonAtomic(planPath(slug), plan);
  writeJsonAtomic(planPath(slug, planRevision), plan);
  return plan;
}

export function readCanonicalEcosystemGenerationPlan(slug: string): CanonicalEcosystemGenerationPlan | null {
  const file = planPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CanonicalEcosystemGenerationPlan;
    return normalizeCanonicalPlanInventory(raw);
  } catch {
    return null;
  }
}

export function freezeCanonicalEcosystemGenerationPlan(slug: string, planId: string): CanonicalEcosystemGenerationPlan | null {
  const plan = readCanonicalEcosystemGenerationPlan(slug);
  if (!plan || plan.planId !== planId) return null;
  const frozen: CanonicalEcosystemGenerationPlan = {
    ...plan,
    frozen: true,
    frozenAt: new Date().toISOString(),
  };
  frozen.checksum = hashPlan({ ...frozen, checksum: undefined } as Omit<CanonicalEcosystemGenerationPlan, "checksum">);
  writeJsonAtomic(planPath(slug), frozen);
  writeJsonAtomic(planPath(slug, frozen.planRevision), frozen);
  return frozen;
}

export function getCanonicalPlanSchedulerPageCount(plan: CanonicalEcosystemGenerationPlan): number {
  return normalizeCanonicalPlanInventory(plan).inventoryReconciliation.schedulerTotal;
}

export interface PlanOutputParityResult {
  ok: boolean;
  plannedCount: number;
  generatedCount: number;
  missingPages: string[];
  unexpectedPages: string[];
  imageGaps: string[];
  failures: string[];
}

export function compareCanonicalPlanOutputParity(
  slug: string,
  serviceId: string,
  plan: CanonicalEcosystemGenerationPlan,
): PlanOutputParityResult {
  const ecoRoot = path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
  const failures: string[] = [];
  const missingPages: string[] = [];
  const unexpectedPages: string[] = [];
  const imageGaps = plan.imageInventory
    .filter((i) => i.assignmentStatus === "missing")
    .map((i) => `${i.role}:${i.slot}`);

  let generatedCount = 0;
  for (const page of plan.pageInventory.filter((p) => p.inclusionStatus === "included")) {
    let exists = false;
    if (page.pageType === "homepage") {
      exists = fs.existsSync(
        path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html"),
      );
    } else if (page.pageType === "service-hub" || page.pageType === "service") {
      exists = fs.existsSync(path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, page.slug, "index.html"))
        || fs.existsSync(path.join(ecoRoot, "pages", page.slug, "index.html"));
    } else if (page.pageType === "cluster-page" || page.pageType.startsWith("location-")) {
      exists = fs.existsSync(
        path.join(ecoRoot, resolveClusterPageFilesystemRelativePath(page.slug)),
      );
    } else {
      exists = fs.existsSync(path.join(ecoRoot, "pages", page.slug, "index.html"));
    }
    if (exists) generatedCount += 1;
    else missingPages.push(`${page.pageType}:${page.slug}`);
  }

  const ok = missingPages.length === 0 && failures.length === 0;
  return {
    ok,
    plannedCount: plan.inventoryReconciliation?.inventoryTotal ?? plan.coreEcosystem.inventoryTotal,
    generatedCount,
    missingPages,
    unexpectedPages,
    imageGaps,
    failures,
  };
}

export function markAuthorisedGenerationIncompleteAgainstPlan(
  slug: string,
  jobId: string,
  plan: CanonicalEcosystemGenerationPlan,
): void {
  const authPath = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/authorised-ecosystem-generation", slug, "latest.json");
  if (!fs.existsSync(authPath)) return;
  try {
    const raw = JSON.parse(fs.readFileSync(authPath, "utf8")) as Record<string, unknown>;
    if (raw.jobId !== jobId) return;
    raw.status = "completed";
    raw.completenessStatus = "SUPERSEDED_INCOMPLETE_RC1";
    raw.completenessLabel = "Superseded — Incomplete Against RC1 Content Architecture V1";
    raw.canonicalPlanId = plan.planId;
    raw.canonicalPlanRevision = plan.planRevision;
    raw.canonicalPlanChecksum = plan.checksum;
    raw.expectedPageCount = plan.inventoryReconciliation?.inventoryTotal ?? plan.coreEcosystem.inventoryTotal;
    raw.qualityReviewReady = false;
    writeJsonAtomic(authPath, raw);
  } catch {
    /* preserve */
  }
}

export function ensureCanonicalPlanAndMarkExistingIncomplete(slug: string): CanonicalEcosystemGenerationPlan {
  const plan = buildCanonicalEcosystemGenerationPlan(slug);
  const auth = readAuthorisedEcosystemGenerationRecord(slug);
  if (auth?.jobId && auth.status === "completed") {
    markAuthorisedGenerationIncompleteAgainstPlan(slug, auth.jobId, plan);
  }
  return plan;
}
