/**
 * Premium Customer Dashboard — commercial product journey (presentation only).
 * Reads existing authoritative records. Does not mutate profile, campaigns, or publishing.
 */
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { computeRequiredProfileCompleteness } from "./pharmacyProfileFieldClassification.ts";
import {
  buildGrowthEngineFramework,
  type GrowthEngineFramework,
} from "./growthEngineFrameworkService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { buildLocalMarketReportView } from "./growthEngineLocalMarketReportView.ts";
import {
  loadWebsiteIntelligenceSnapshot,
  resolveWebsiteIntelligenceSnapshot,
} from "./growthEngineWebsiteIntelligenceService.ts";
import { buildGrowthPlanIntelligence } from "./growthEngineCampaignRecommendationEngine.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import {
  buildAuthoritativeCampaignProgramme,
  type AuthoritativeCampaignProgramme,
} from "./pharmacyAuthoritativeCampaignProgrammeService.ts";
import { resolveTenantBrandIdentity } from "./pharmacyTenantBrandIdentityContract.ts";
import { buildTenantImageLibraryView } from "./pharmacyTenantImageLibraryContract.ts";
import { campaignBuilderStepUrl, loadCampaignBuilderSession } from "./growthEngineCampaignBuilderService.ts";
import { reviewCentreUrl } from "./growthEngineReviewCentreService.ts";
import { isLockedCampaignApprovedForStaging } from "./pharmacyLockedCampaignStagingPublishService.ts";
import { readPharmacyIndexingSummary } from "./pharmacyIndexingBridgeService.ts";
import { readPharmacyVisibilityReport } from "./pharmacyVisibilityBridgeService.ts";
import { readPharmacyGrowthActionPlan } from "./pharmacyGrowthActionPlanService.ts";

export const COMMERCIAL_FEATURE_STATUSES = [
  "Ready",
  "In progress",
  "Complete",
  "Approved",
  "Staging ready",
  "Not configured",
  "Not tested",
  "Action required",
  "Needs confirmation",
] as const;

export type CommercialFeatureStatus = (typeof COMMERCIAL_FEATURE_STATUSES)[number];

export const HERO_SUPPORTING_TEXT =
  "Manage your pharmacy profile, market intelligence, campaigns, publishing and search performance from one place.";

export const CORE_LOCKED_CAMPAIGN_IDS = [
  "flu-vaccinations",
  "travel-vaccinations",
  "pharmacy-first",
  "blood-pressure-checks",
] as const;

export interface PremiumDashboardMetric {
  label: string;
  value: string;
}

export interface CommercialFeatureCard {
  id: string;
  number: number;
  title: string;
  benefit: string;
  status: CommercialFeatureStatus;
  actionLabel: string;
  href: string;
  actionEnabled: boolean;
}

export interface PremiumReportPreview {
  id: string;
  title: string;
  stat1Label: string;
  stat1Value: string;
  stat2Label: string;
  stat2Value: string;
  insightLabel: string;
  insight: string;
  extraLabel?: string;
  extraValue?: string;
  href: string;
}

export interface PremiumCustomerDashboardView {
  slug: string;
  pharmacyName: string;
  heroSupportingText: string;
  primaryCtaLabel: string;
  primaryCtaHref: string;
  secondaryCtaLabel: string;
  secondaryCtaHref: string;
  nextActionTitle: string;
  nextActionDetail: string;
  nextActionCtaLabel: string;
  nextActionCtaHref: string;
  coreProgrammeComplete: boolean;
  heroMetrics: PremiumDashboardMetric[];
  optionalRecommendation: string | null;
  featureJourney: CommercialFeatureCard[];
  reportPreviews: PremiumReportPreview[];
  campaignProgramme: AuthoritativeCampaignProgramme;
}

export function customerFacingPharmacyDisplayName(rawName: string, slug = ""): string {
  const stripped = String(rawName || "")
    .replace(/^Welcome to\s+/i, "")
    .trim();
  if (slug === "yorkshire-pharmacy-and-health-clinic" || /^Yorkshire Pharmacy and Health Clinic$/i.test(stripped)) {
    return "Yorkshire Pharmacy & Health Clinic";
  }
  return stripped || "your pharmacy";
}

/** Review Centre opens the saved Campaign Builder campaign, not a global catalogue default. Locked campaigns stay on their own Review Centre URL. */
export function resolveDashboardReviewCentreCampaign(
  slug: string,
  programme: AuthoritativeCampaignProgramme,
): string {
  const approvedLocked = programme.campaigns.find((card) => card.approvedLocked)?.serviceId;
  if (approvedLocked) return approvedLocked;
  const saved = String(loadCampaignBuilderSession(slug).selectedServiceId || "").trim();
  if (saved) return saved;
  return programme.campaigns[0]?.serviceId || CORE_LOCKED_CAMPAIGN_IDS[0];
}

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function qs(slug: string, extra: Record<string, string> = {}): string {
  const params = new URLSearchParams({ slug, ...extra });
  return params.toString();
}

function confirmPharmacyUrl(slug: string, hash = ""): string {
  return `/api/growth-engine/confirm-pharmacy?${qs(slug)}${hash}`;
}

function publishingSettingsUrl(slug: string, serviceId: string): string {
  return `/api/pharmacy-publishing-settings?${qs(slug, { service: serviceId })}`;
}

function brandConnected(brand: ReturnType<typeof resolveTenantBrandIdentity>): boolean {
  if (brand.confirmationStatus === "confirmed") return true;
  const sources = [
    brand.logoUrl.source,
    brand.primaryColor.source,
    brand.secondaryColor.source,
    brand.accentColor.source,
    brand.headingFont.source,
    brand.bodyFont.source,
  ];
  return sources.some((source) => source === "brand-dna" || source === "uploaded-tenant-asset" || source === "po-confirmed");
}

function productionPublished(slug: string): boolean {
  const live = getPharmacyLivePublishStatus(slug);
  return Boolean(live.lastPublishedAt || live.pagesPublished > 0);
}

function indexingTested(slug: string): boolean {
  const summary = readPharmacyIndexingSummary(slug);
  if (!summary) return false;
  return Boolean(
    summary.totalRegistered > 0 ||
      summary.submitted > 0 ||
      summary.indexed > 0 ||
      (summary.sitemapUrl && summary.totalRegistered > 0),
  );
}

function visibilityLiveState(slug: string): CommercialFeatureStatus {
  const report = readPharmacyVisibilityReport(slug);
  if (!report) return "Not configured";
  const indexed = Number(report.indexedPageCount || 0);
  const visible = Number(report.visiblePageCount || 0);
  const score = Number(report.estimatedVisibilityScore || 0);
  if (indexed > 0 && (visible > 0 || score > 0)) return "In progress";
  if (indexed > 0) return "Ready";
  return "Not tested";
}

function resolveNextAction(input: {
  slug: string;
  features: CommercialFeatureCard[];
  stagingReady: boolean;
  published: boolean;
  coreProgrammeComplete: boolean;
}): { title: string; detail: string; href: string } {
  const publishing = input.features.find((f) => f.id === "managed-publishing");
  const indexing = input.features.find((f) => f.id === "indexing");
  const visibility = input.features.find((f) => f.id === "search-visibility");

  if (input.stagingReady && !input.published) {
    return {
      title: "Prepare production publishing",
      detail:
        "Controlled staging is ready. Production-domain publishing is not complete. Indexing starts after production approval.",
      href: publishing?.href || publishingSettingsUrl(input.slug, CORE_LOCKED_CAMPAIGN_IDS[0]),
    };
  }

  if (input.published && indexing && indexing.status !== "Complete") {
    return {
      title: "Prepare indexing after production",
      detail: "Production records are present. Sitemap and search-engine submission have not been completed.",
      href: visibility?.href || `/api/growth-engine/search-intelligence?${qs(input.slug)}`,
    };
  }

  const blocked = input.features.find(
    (f) =>
      f.actionEnabled &&
      (f.status === "Action required" || f.status === "In progress" || f.status === "Ready") &&
      f.id !== "pharmacy-profile" &&
      f.id !== "recommended-improvements",
  );
  if (blocked) {
    return {
      title: blocked.title,
      detail: blocked.benefit,
      href: blocked.href,
    };
  }

  if (input.coreProgrammeComplete) {
    return {
      title: "Prepare production publishing",
      detail: "Approved campaigns are locked. Continue from managed publishing when you are ready.",
      href: publishing?.href || publishingSettingsUrl(input.slug, CORE_LOCKED_CAMPAIGN_IDS[0]),
    };
  }

  const firstOpen = input.features.find((f) => f.actionEnabled && f.status !== "Complete" && f.status !== "Approved");
  return {
    title: firstOpen?.title || "View your programme",
    detail: firstOpen?.benefit || HERO_SUPPORTING_TEXT,
    href: firstOpen?.href || `#programme-journey`,
  };
}

function buildFeatureJourney(input: {
  slug: string;
  profileImported: boolean;
  brand: ReturnType<typeof resolveTenantBrandIdentity>;
  localLive: boolean;
  websiteLive: boolean;
  planReady: boolean;
  imageLibraryConnected: boolean;
  approvedCampaignCount: number;
  approvedPageCount: number;
  programme: AuthoritativeCampaignProgramme;
  stagingReady: boolean;
  published: boolean;
}): CommercialFeatureCard[] {
  const slug = input.slug;
  const reviewCampaign = resolveDashboardReviewCentreCampaign(slug, input.programme);
  const publishingCampaign =
    input.programme.campaigns.find((card) => card.approvedLocked)?.serviceId || CORE_LOCKED_CAMPAIGN_IDS[0];

  const brandStatus: CommercialFeatureStatus = input.brand.confirmationStatus === "confirmed"
    ? "Approved"
    : "Needs confirmation";

  const imageStatus: CommercialFeatureStatus = input.imageLibraryConnected ? "Complete" : "Not configured";

  const campaignStatus: CommercialFeatureStatus =
    input.approvedCampaignCount >= CORE_LOCKED_CAMPAIGN_IDS.length && input.approvedPageCount > 0
      ? "Complete"
      : input.programme.hasGeneratedCampaigns
        ? "In progress"
        : "Ready";

  const reviewStatus: CommercialFeatureStatus =
    input.approvedCampaignCount >= CORE_LOCKED_CAMPAIGN_IDS.length
      ? "Approved"
      : input.programme.campaigns.some((c) => c.pendingProductOwnerReview)
        ? "Action required"
        : input.programme.hasGeneratedCampaigns
          ? "In progress"
          : "Not configured";

  const publishingStatus: CommercialFeatureStatus = input.published
    ? "Complete"
    : input.stagingReady
      ? "Staging ready"
      : input.approvedCampaignCount > 0
        ? "Ready"
        : "Not configured";

  const indexingStatus: CommercialFeatureStatus = input.published
    ? indexingTested(slug)
      ? "In progress"
      : "Not tested"
    : "Not tested";

  const visibilityStatus = visibilityLiveState(slug);
  const growthActions = readPharmacyGrowthActionPlan(slug);
  const improvementsStatus: CommercialFeatureStatus = growthActions
    ? growthActions.pendingActions > 0 || growthActions.inProgressActions > 0
      ? "Ready"
      : growthActions.completeActions > 0
        ? "Complete"
        : "Ready"
    : "Not configured";

  return [
    {
      id: "pharmacy-profile",
      number: 1,
      title: "Pharmacy Profile & Website Import",
      benefit: "Import and confirm your pharmacy identity, services and contact details.",
      status: input.profileImported ? "Complete" : "Action required",
      actionLabel: "View profile",
      href: confirmPharmacyUrl(slug),
      actionEnabled: true,
    },
    {
      id: "brand-review",
      number: 2,
      title: "Brand Review",
      benefit: "Confirm the logo, colours and fonts used on generated pages.",
      status: brandStatus,
      actionLabel: "Review brand",
      href: `/api/growth-engine/brand-review?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "local-market",
      number: 3,
      title: "Local Market Intelligence",
      benefit: "Compare your pharmacy with nearby competitors and identify visibility gaps.",
      status: input.localLive ? "Complete" : "Ready",
      actionLabel: "View market",
      href: `/api/growth-engine/local-market?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "website-intelligence",
      number: 4,
      title: "Website Intelligence",
      benefit: "Review existing pages, content coverage and website opportunities.",
      status: input.websiteLive ? "Complete" : "Ready",
      actionLabel: "View website",
      href: `/api/growth-engine/website-intelligence?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "growth-plan",
      number: 5,
      title: "Growth Plan",
      benefit: "See the recommended service campaigns and priority actions.",
      status: input.planReady ? "Complete" : "Ready",
      actionLabel: "View plan",
      href: `/api/growth-engine/growth-plan?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "image-library",
      number: 6,
      title: "Image Library",
      benefit: "Upload or approve photographs for automatic campaign placement.",
      status: imageStatus,
      actionLabel: "Open library",
      href: `/api/pharmacy-image-library?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "campaign-generation",
      number: 7,
      title: "Campaign Generation",
      benefit: "Create service and locality pages from approved content banks.",
      status: campaignStatus,
      actionLabel: "View campaigns",
      href: campaignBuilderStepUrl(slug, "choose"),
      actionEnabled: true,
    },
    {
      id: "review-centre",
      number: 8,
      title: "Review Centre",
      benefit: "Preview, improve and approve generated campaign content.",
      status: reviewStatus,
      actionLabel: "Open Review Centre",
      href: reviewCentreUrl(slug, reviewCampaign),
      actionEnabled: true,
    },
    {
      id: "managed-publishing",
      number: 9,
      title: "Managed Publishing",
      benefit: "Publish approved campaigns to a controlled managed destination.",
      status: publishingStatus,
      actionLabel: "Open publishing",
      href: publishingSettingsUrl(slug, publishingCampaign),
      actionEnabled: true,
    },
    {
      id: "indexing",
      number: 10,
      title: "Indexing",
      benefit: "Manage sitemap and search-engine submission after production approval.",
      status: indexingStatus,
      actionLabel: "Awaiting production",
      href: "",
      actionEnabled: false,
    },
    {
      id: "search-visibility",
      number: 11,
      title: "Search Visibility & Rank Tracking",
      benefit: "Monitor indexed pages, keyword visibility and ranking movement.",
      status: visibilityStatus,
      actionLabel: "View visibility",
      href: `/api/growth-engine/search-intelligence?${qs(slug)}`,
      actionEnabled: true,
    },
    {
      id: "recommended-improvements",
      number: 12,
      title: "Recommended Improvements",
      benefit: "See the next evidence-based actions for continued growth.",
      status: improvementsStatus,
      actionLabel: "View improvements",
      href: `/api/pharmacy-growth-actions?${qs(slug)}`,
      actionEnabled: true,
    },
  ];
}

export function buildPremiumCustomerDashboardView(slug: string): PremiumCustomerDashboardView {
  const profile = loadProfile(slug);
  const pharmacyName = customerFacingPharmacyDisplayName(
    profile.pharmacyName || profile.tradingName || slug,
    slug,
  );
  const competitors = loadCompetitorSnapshot(slug);
  const localReport = buildLocalMarketReportView(competitors);
  const website = loadWebsiteIntelligenceSnapshot(slug);
  const websiteReport = resolveWebsiteIntelligenceSnapshot(slug);
  const plan = buildGrowthPlanIntelligence(slug, competitors);
  const programme = buildAuthoritativeCampaignProgramme(slug);
  const brand = resolveTenantBrandIdentity(slug);
  const imageLibrary = buildTenantImageLibraryView(slug);

  const profileImported = Boolean(
    String(profile.website || "").trim() && String(profile.pharmacyName || profile.tradingName || "").trim(),
  );
  const coreCampaigns = programme.campaigns.filter((card) =>
    (CORE_LOCKED_CAMPAIGN_IDS as readonly string[]).includes(card.serviceId),
  );
  const approvedCampaignCount = coreCampaigns.filter((card) => card.approvedLocked).length;
  const approvedPageCount = coreCampaigns.reduce((sum, card) => sum + Number(card.corePageCount || 0), 0);
  const localityCounts = coreCampaigns.map((card) => Number(card.localityPageCount || 0));
  const localAreasPerCampaign = localityCounts.length
    ? localityCounts.every((n) => n === localityCounts[0])
      ? localityCounts[0]
      : Math.min(...localityCounts)
    : 0;
  const coreProgrammeComplete = approvedCampaignCount >= CORE_LOCKED_CAMPAIGN_IDS.length;
  const stagingCandidate =
    coreCampaigns.find((card) => card.approvedLocked)?.serviceId || CORE_LOCKED_CAMPAIGN_IDS[0];
  const stagingReady = isLockedCampaignApprovedForStaging(slug, stagingCandidate);
  const published = productionPublished(slug);

  const featureJourney = buildFeatureJourney({
    slug,
    profileImported,
    brand,
    localLive: Boolean(localReport.live && (competitors?.competitors?.length || 0) > 0),
    websiteLive: Boolean(website?.analysis),
    planReady: Boolean(plan.primaryCampaign),
    imageLibraryConnected: imageLibrary.library.images.length > 0 || imageLibrary.activeCount > 0,
    approvedCampaignCount,
    approvedPageCount,
    programme,
    stagingReady,
    published,
  });

  const optionalGaps = computeRequiredProfileCompleteness(profile).optionalImprovements;
  const optionalRecommendation =
    coreProgrammeComplete && optionalGaps.length
      ? "Optional pharmacy profile details can be completed later. They do not block your approved campaigns."
      : null;

  const next = resolveNextAction({
    slug,
    features: featureJourney,
    stagingReady,
    published,
    coreProgrammeComplete,
  });

  const stagingMetric = stagingReady && !published ? "Controlled staging ready" : stagingReady ? "Controlled staging ready" : "Staging not configured";

  const heroMetrics: PremiumDashboardMetric[] = [
    { value: `${approvedCampaignCount} approved campaigns`, label: "Campaigns" },
    { value: `${approvedPageCount} approved core pages`, label: "Core pages" },
    { value: `${localAreasPerCampaign} local areas per campaign`, label: "Local coverage" },
    { value: stagingMetric, label: "Publishing" },
  ];

  const websiteAnalysis = websiteReport?.analysis;
  const websiteInventoryCount = Number(websiteAnalysis?.inventory?.totalPages || websiteAnalysis?.pages?.length || 0);
  const websiteHasInventory = Boolean(websiteAnalysis && websiteInventoryCount > 0 && websiteAnalysis.dataSource !== "unavailable");
  const websiteOpportunity = String(websiteAnalysis?.opportunities?.[0]?.headline || "").trim();
  const nextCampaign = programme.nextCampaign;
  const growthPlanPreview: PremiumReportPreview = nextCampaign
    ? {
        id: "growth-plan",
        title: "Your Growth Plan",
        stat1Label: "Next campaign",
        stat1Value: nextCampaign.serviceName,
        stat2Label: "Readiness",
        stat2Value: "Next approved campaign",
        insightLabel: "Queue",
        insight: nextCampaign.reason,
        href: `/api/growth-engine/growth-plan?${qs(slug)}`,
      }
    : {
        id: "growth-plan",
        title: "Your Growth Plan",
        stat1Label: "Approved campaigns",
        stat1Value: String(approvedCampaignCount),
        stat2Label: "Approved core pages",
        stat2Value: String(approvedPageCount),
        insightLabel: "Readiness",
        insight: coreProgrammeComplete ? "Core campaigns approved" : "Campaign programme in progress",
        extraLabel: "Next action",
        extraValue: coreProgrammeComplete && !published ? "Prepare production publishing" : next.title,
        href: `/api/growth-engine/growth-plan?${qs(slug)}`,
      };

  const reportPreviews: PremiumReportPreview[] = [
    {
      id: "local-market",
      title: "Your Local Market",
      stat1Label: "Comparison status",
      stat1Value: localReport.live ? "Live comparison" : "Not tested",
      stat2Label: "Nearby pharmacies",
      stat2Value: localReport.live ? String(localReport.overview.pharmacies) : "Not tested",
      insightLabel: "Strongest insight",
      insight: localReport.live
        ? localReport.insights[0] || "No additional insight recorded"
        : "Not tested",
      href: `/api/growth-engine/local-market?${qs(slug)}`,
    },
    {
      id: "website",
      title: "Your Website Report",
      stat1Label: "Pages found",
      stat1Value: websiteHasInventory ? String(websiteInventoryCount) : "Not tested",
      stat2Label: "Report status",
      stat2Value: websiteHasInventory ? "Inventory recorded" : "Not tested",
      insightLabel: "Strongest opportunity",
      insight: websiteHasInventory
        ? websiteOpportunity || "No additional opportunity recorded"
        : "Not tested",
      href: `/api/growth-engine/website-intelligence?${qs(slug)}`,
    },
    growthPlanPreview,
  ];

  return {
    slug,
    pharmacyName,
    heroSupportingText: HERO_SUPPORTING_TEXT,
    primaryCtaLabel: "View your programme",
    primaryCtaHref: "#programme-journey",
    secondaryCtaLabel: "Continue next action",
    secondaryCtaHref: next.href,
    nextActionTitle: next.title,
    nextActionDetail: next.detail,
    nextActionCtaLabel: "Continue next action",
    nextActionCtaHref: next.href,
    coreProgrammeComplete,
    heroMetrics,
    optionalRecommendation,
    featureJourney,
    reportPreviews,
    campaignProgramme: programme,
  };
}

/** @internal Used by validation — framework must remain reachable. */
export function premiumDashboardUsesFramework(slug: string): GrowthEngineFramework {
  return buildGrowthEngineFramework(slug);
}
