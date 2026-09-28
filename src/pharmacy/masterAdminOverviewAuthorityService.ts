/**
 * MASTER-ADMIN-OVERVIEW-AUTHORITY-FIX-V1
 * Lightweight, selected-customer Overview status claims from existing stores only.
 * Does not create a new lifecycle engine or mutate campaign/GSC/publish data.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import {
  isBusinessProfileReviewApproved,
  readReviewStore,
} from "./masterAdminBusinessProfileReviewService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import {
  isCommercialIntelligenceApproved,
  isCommercialIntelligenceGenerated,
  isCommercialIntelligenceReadyForReview,
} from "./masterAdminCommercialIntelligenceWorkflowService.ts";
import { isNationalGrowthPlatform, resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import { readGrowthPlanIntelligenceV1 } from "./growthPlanIntelligenceV1Service.ts";
import {
  ensureGrowthPlanFromApprovedIntelligence,
  growthPlanStatusLabel,
  resolveGrowthPlanReview,
  type ApprovedGrowthPlanRecord,
  type GrowthPlanReviewState,
} from "./masterAdminGrowthPlanConnectionService.ts";
import { summariseNationalPublishV1 } from "./nationalContentPublishV1.ts";
import { summariseNationalClusterDiscoveryV1 } from "./nationalClusterDiscoveryV1.ts";
import { summariseNationalMasterHubPromptsV1 } from "./nationalMasterHubPromptStoreV1.ts";
import { listLocalCampaignSummariesV1 } from "./localCampaignGenerationV1.ts";
import { resolveNationalIntelligenceArtifactPath } from "./nationalIntelligenceStorageService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { canonicalStatusLabel, buildCustomerCanonicalStatuses } from "./masterAdminCanonicalStatusService.ts";
import { buildMasterAdminServiceCampaignSummaries } from "./masterAdminServiceCampaignSummaryService.ts";
import { buildBrookGoldenDemoOverviewAuthority } from "./brookPharmacyGoldenDemoV1.ts";

export interface OverviewAuthorityV1 {
  version: 1;
  slug: string;
  profile: string;
  importStatus: string;
  intelligence: string;
  growthPlan: string;
  campaigns: string;
  review: string;
  publishing: string;
  indexing: string;
  results: string;
  searchConsole: {
    propertyBound: boolean;
    property: string | null;
    indexedPagesAuthoritative: number | null;
    impressions: number | null;
    clicks: number | null;
    averagePosition: string | null;
  };
  growthPlanDetail?: {
    current: true;
    status: ApprovedGrowthPlanRecord["status"];
    decision: GrowthPlanReviewState;
    campaignCreationAllowed: boolean;
    generatedAt: string;
    approvedIntelligenceRevision: string;
    priorityServiceId: string | null;
    priorityServiceName: string | null;
    priorityOpportunity: string | null;
    evidenceLimitations: string[];
  } | null;
}

function readJson<T>(file: string): T | null {
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as T;
  } catch {
    return null;
  }
}

function nationalCompetitorDiscoveryStatus(slug: string): "complete" | "missing" | "incomplete" {
  const file =
    resolveNationalIntelligenceArtifactPath(slug, "competitor-discovery") ||
    path.join(WORKSPACE_ROOT, "data", "national-growth-engine", `${slug}-competitor-discovery.json`);
  const doc = readJson<{ status?: string }>(file);
  if (!doc) return "missing";
  if (String(doc.status || "").toLowerCase() === "complete") return "complete";
  return "incomplete";
}

/** Customer-scoped GSC claims only — never treat global OAuth or empty registry zeros as indexed truth. */
function readOverviewSearchConsoleClaims(slug: string): OverviewAuthorityV1["searchConsole"] {
  const outputDir = path.join(WORKSPACE_ROOT, "output", slug);
  const summary = readJson<{
    property?: string;
    indexedCount?: number | null;
    pagesWithImpressions?: number | null;
    pagesWithClicks?: number | null;
  }>(path.join(outputDir, "gsc-summary.json"));
  const indexDashboard = readJson<{
    summary?: { indexed?: number };
    statusGroups?: Record<string, Array<{ impressions?: number; clicks?: number; averagePosition?: number | null }>>;
  }>(path.join(outputDir, "index-dashboard.json"));
  const bridge = readJson<{ property?: string }>(path.join(outputDir, "indexing-bridge.json"));

  const property = String(summary?.property || bridge?.property || "").trim() || null;
  const propertyBound = Boolean(property);

  let indexedPagesAuthoritative: number | null = null;
  if (summary?.indexedCount != null && Number.isFinite(Number(summary.indexedCount))) {
    indexedPagesAuthoritative = Number(summary.indexedCount);
  } else if (indexDashboard?.summary?.indexed != null && Number.isFinite(Number(indexDashboard.summary.indexed))) {
    indexedPagesAuthoritative = Number(indexDashboard.summary.indexed);
  }

  let impressions: number | null = null;
  let clicks: number | null = null;
  let averagePosition: string | null = null;
  if (summary?.pagesWithImpressions != null) impressions = Number(summary.pagesWithImpressions);
  if (summary?.pagesWithClicks != null) clicks = Number(summary.pagesWithClicks);

  const groups = indexDashboard?.statusGroups || {};
  const all = [...(groups.INDEXED || []), ...(groups.NOT_INDEXED || []), ...(groups.OPPORTUNITY || [])];
  if (all.length) {
    let imp = 0;
    let clk = 0;
    let weighted = 0;
    let weight = 0;
    for (const row of all) {
      imp += row.impressions || 0;
      clk += row.clicks || 0;
      if (row.averagePosition != null && (row.impressions || 0) > 0) {
        weighted += row.averagePosition * (row.impressions || 0);
        weight += row.impressions || 0;
      }
    }
    if (impressions == null && imp > 0) impressions = imp;
    if (clicks == null && clk > 0) clicks = clk;
    if (weight > 0) averagePosition = (weighted / weight).toFixed(1);
  }

  return {
    propertyBound,
    property,
    indexedPagesAuthoritative,
    impressions,
    clicks,
    averagePosition,
  };
}

function buildProfileLabel(slug: string): string {
  const store = readReviewStore(slug);
  if (store?.approvalStatus === "approved" || isBusinessProfileReviewApproved(slug)) return "APPROVED";
  if (store?.approvalStatus) return String(store.approvalStatus).replace(/_/g, " ").toUpperCase();
  return "NOT YET RUN";
}

function buildImportLabel(slug: string): string {
  const website = buildWebsiteSourceSummary(slug);
  if (website.websiteImported || website.websiteStatus === "IMPORTED") return "IMPORTED";
  if (website.websiteStatus && website.websiteStatus !== "NOT CONFIGURED") {
    return String(website.websiteStatus).toUpperCase();
  }
  return "NOT YET RUN";
}

function buildIntelligenceLabel(slug: string): string {
  if (isCommercialIntelligenceApproved(slug)) return "APPROVED";
  if (isCommercialIntelligenceReadyForReview(slug)) return "READY FOR REVIEW";
  if (isNationalGrowthPlatform(slug)) {
    const discovery = nationalCompetitorDiscoveryStatus(slug);
    if (discovery === "complete") return "DISCOVERY COMPLETE · CIR NOT APPROVED";
    if (discovery === "incomplete") return "DISCOVERY INCOMPLETE · CIR NOT APPROVED";
    return "NOT YET RUN";
  }
  if (isCommercialIntelligenceGenerated(slug)) return "GENERATED · NOT APPROVED";
  return "NOT YET RUN";
}

function buildGrowthPlanLabel(
  slug: string,
  national: boolean,
  localPlan: ApprovedGrowthPlanRecord | null,
  reviewState: GrowthPlanReviewState,
): string {
  if (national || isNationalGrowthPlatform(slug)) {
    const plan = readGrowthPlanIntelligenceV1(slug);
    if (!plan) return "NOT YET RUN";
    const total = Number(plan.summary?.totalActions ?? plan.actions?.length ?? 0);
    if (Number.isFinite(total) && total > 0) return `${total} ACTIONS`;
    return "AVAILABLE";
  }
  return growthPlanStatusLabel(localPlan, reviewState);
}

function growthPlanDetail(
  plan: ApprovedGrowthPlanRecord | null,
  reviewState: GrowthPlanReviewState,
  campaignCreationAllowed: boolean,
): OverviewAuthorityV1["growthPlanDetail"] {
  if (!plan) return null;
  return {
    current: true,
    status: plan.status,
    decision: reviewState,
    campaignCreationAllowed,
    generatedAt: plan.generatedAt,
    approvedIntelligenceRevision: plan.approvedIntelligenceRevision,
    priorityServiceId: plan.priorityServiceId,
    priorityServiceName: plan.priorityServiceName,
    priorityOpportunity: plan.priorityOpportunity,
    evidenceLimitations: plan.evidenceLimitations,
  };
}

function buildCampaignsLabel(slug: string, national: boolean): string {
  const bits: string[] = [];
  if (national) {
    try {
      const pub = summariseNationalPublishV1(slug);
      bits.push(`National: ${pub.status || (pub.ready ? "READY TO PUBLISH" : "NOT READY")}`);
    } catch {
      bits.push("National: NOT AVAILABLE");
    }
  } else {
    try {
      const services = buildMasterAdminServiceCampaignSummaries(slug);
      if (services.length) {
        const labels = services
          .slice(0, 3)
          .map((c) => `${c.serviceName || c.campaignName || c.serviceId}: ${c.statusLabel || c.status || "UNKNOWN"}`);
        bits.push(`Service: ${labels.join("; ")}${services.length > 3 ? ` (+${services.length - 3})` : ""}`);
      }
    } catch {
      /* optional */
    }
  }
  try {
    const local = listLocalCampaignSummariesV1(slug);
    if (local.length) {
      const published = local.filter((c) => c.published).length;
      const approved = local.filter((c) => c.reviewStatus === "approved").length;
      bits.push(
        `Local: ${local.length} campaign${local.length === 1 ? "" : "s"} · ${approved} approved · ${published} published`,
      );
    } else if (!national && !bits.length) {
      bits.push("Local: NONE");
    }
  } catch {
    /* local campaign definitions may be absent */
  }
  if (!bits.length) return "NOT YET RUN";
  return bits.join(" · ");
}

function buildReviewLabel(slug: string, national: boolean): string {
  const bits: string[] = [];
  bits.push(`Profile ${buildProfileLabel(slug)}`);
  if (national) {
    try {
      const clusters = summariseNationalClusterDiscoveryV1(slug);
      if (clusters.exists) {
        bits.push(`National clusters ${clusters.approvedCount}/${clusters.candidateCount}`);
      } else {
        bits.push("National clusters NOT YET RUN");
      }
    } catch {
      bits.push("National clusters NOT AVAILABLE");
    }
    try {
      const prompts = summariseNationalMasterHubPromptsV1(slug);
      const approved = prompts.filter((p) => p.status === "approved").length;
      const present = prompts.filter((p) => p.exists).length;
      if (prompts.length) bits.push(`Hub prompts ${approved}/${present} approved`);
    } catch {
      /* optional */
    }
  }
  try {
    const local = listLocalCampaignSummariesV1(slug);
    if (local.length) {
      const approvedPages = local.reduce((n, c) => n + (c.approvedCount || 0), 0);
      bits.push(`Local campaigns ${approvedPages} pages approved`);
    }
  } catch {
    /* optional */
  }
  return bits.join(" · ");
}

function buildPublishingLabel(slug: string, national: boolean): string {
  const bits: string[] = [];
  if (national) {
    try {
      const pub = summariseNationalPublishV1(slug);
      bits.push(`National: ${pub.status || "NOT AVAILABLE"}`);
      const index = readJson<{ liveCopy?: boolean }>(
        path.join(WORKSPACE_ROOT, "output", "national-publish", slug, "_publish-index.json"),
      );
      bits.push(`Live: ${index?.liveCopy ? "LIVE" : "NOT LIVE"}`);
    } catch {
      bits.push("National: NOT AVAILABLE");
    }
  } else {
    const canonical = canonicalStatusLabel(buildCustomerCanonicalStatuses(slug), "publishing");
    const live = getPharmacyLivePublishStatus(slug);
    bits.push(`Commercial: ${canonical}`);
    bits.push(`Live: ${live.lastPublishedAt ? "LIVE" : "NOT LIVE"}`);
  }
  try {
    const local = listLocalCampaignSummariesV1(slug);
    if (local.length) {
      const published = local.filter((c) => c.published).length;
      bits.push(`Local: ${published}/${local.length} published`);
    }
  } catch {
    /* optional */
  }
  try {
    const managed = readManagedPublishingProfile(slug);
    if (managed?.publishStatus && managed.publishStatus !== "unknown") {
      bits.push(`Managed: ${String(managed.publishStatus).replace(/_/g, " ").toUpperCase()}`);
    }
  } catch {
    /* optional */
  }
  return bits.length ? bits.join(" · ") : "NOT YET RUN";
}

function buildIndexingLabel(scm: OverviewAuthorityV1["searchConsole"]): string {
  const connection = scm.propertyBound ? "CONNECTED" : "NOT CONNECTED";
  const indexing =
    scm.indexedPagesAuthoritative != null
      ? `${scm.indexedPagesAuthoritative} indexed`
      : "INDEXING NOT YET MEASURED";
  return `${connection} · ${indexing}`;
}

function buildResultsLabel(scm: OverviewAuthorityV1["searchConsole"]): string {
  if (scm.impressions != null || scm.clicks != null || scm.averagePosition) {
    return `Imp ${scm.impressions ?? "—"} · Clicks ${scm.clicks ?? "—"} · Pos ${scm.averagePosition || "—"}`;
  }
  return "NOT YET MEASURED";
}

export function buildOverviewAuthorityV1(slug: string): OverviewAuthorityV1 {
  const safe = safeAdminSlug(slug);
  const golden = buildBrookGoldenDemoOverviewAuthority(safe);
  if (golden) return golden;
  const national = isNationalGrowthPlatform(safe) || resolveGrowthPlatform(safe).platform === "national";
  const localPlan = national ? null : ensureGrowthPlanFromApprovedIntelligence(safe);
  const localReview = national ? null : resolveGrowthPlanReview(safe, localPlan);
  const searchConsole = readOverviewSearchConsoleClaims(safe);
  return {
    version: 1,
    slug: safe,
    profile: buildProfileLabel(safe),
    importStatus: buildImportLabel(safe),
    intelligence: buildIntelligenceLabel(safe),
    growthPlan: buildGrowthPlanLabel(safe, national, localPlan, localReview?.state || "unavailable"),
    growthPlanDetail: growthPlanDetail(localPlan, localReview?.state || "ready_for_review", Boolean(localReview?.campaignCreationAllowed)),
    campaigns: buildCampaignsLabel(safe, national),
    review: buildReviewLabel(safe, national),
    publishing: buildPublishingLabel(safe, national),
    indexing: buildIndexingLabel(searchConsole),
    results: buildResultsLabel(searchConsole),
    searchConsole,
  };
}
