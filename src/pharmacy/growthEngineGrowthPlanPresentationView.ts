/**
 * Growth Plan — customer-facing commercial presentation (read-only).
 * Distinguishes recorded evidence, customer selection, proposed deliverables and expected benefits.
 */
import type { GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import type { GrowthEngineCompetitorSnapshot } from "./growthEngineCompetitorModel.ts";
import type { GrowthEngineWebsiteIntelligenceSnapshot, WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import type { GrowthOpportunity } from "./growthEngineOpportunityModel.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { buildGrowthOpportunityReport } from "./growthEngineOpportunityEngine.ts";

export interface GrowthPlanEvidenceCard {
  category: string;
  headline: string;
  detail: string;
}

export interface GrowthPlanPackageItem {
  count: number;
  label: string;
}

export interface GrowthPlanCommercialView {
  serviceName: string;
  facts: Array<{ value: string; label: string }>;
  selectedPriority: string;
  selectedSupportCopy: string;
  evidenceCards: GrowthPlanEvidenceCard[];
  packageCopy: string;
  packageItems: GrowthPlanPackageItem[];
  benefitsCopy: string;
  benefits: string[];
}

function pagePathFromUrl(url: string | null | undefined): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    return (parsed.pathname || "/").replace(/\/+$/, "") || "/";
  } catch {
    const raw = String(url).replace(/^https?:\/\/[^/]+/i, "").split(/[?#]/)[0];
    const normalized = raw.replace(/\/+$/, "") || "/";
    return normalized.startsWith("/") ? normalized : `/${normalized}`;
  }
}

function isGeneralServicesPath(path: string): boolean {
  return /^\/(our-)?services?$/i.test(path);
}

function classifyServicePagePlacement(
  sourceUrl: string | null | undefined,
  pages: WebsitePageInventoryItem[],
  visibleSourceUrls: Array<string | null | undefined>,
  customerVisible: boolean,
  coverageStatus?: string,
): "dedicated" | "general-services" | "mentioned" | "not-found" {
  const path = pagePathFromUrl(sourceUrl);
  if (!path) {
    if (coverageStatus === "mentioned-only") return "mentioned";
    return "not-found";
  }
  const page = pages.find((p) => pagePathFromUrl(p.url) === path || (p.path || "").replace(/\/+$/, "") === path);
  if (isGeneralServicesPath(path) || page?.category === "services") {
    return customerVisible ? "general-services" : "mentioned";
  }
  const sharedCount = visibleSourceUrls.filter((url) => pagePathFromUrl(url) === path).length;
  if (sharedCount > 1) return "general-services";
  if (page?.category === "service-page" || /^\/services?\/.+/i.test(path)) return "dedicated";
  if (coverageStatus === "not-found") return "not-found";
  return "mentioned";
}

function formatCount(n: number): string {
  return n.toLocaleString("en-GB");
}

function unitLabel(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function parseRecordedDemand(summary: string): string[] {
  const lines: string[] = [];
  const highest = /Highest query volume:\s*([\d,]+)/i.exec(summary);
  const pharmacy = /Pharmacy-intent volume:\s*([\d,]+)/i.exec(summary);
  const nearMe = /Near-me volume:\s*([\d,]+)/i.exec(summary);
  if (highest) lines.push(`Highest recorded query volume: ${highest[1]}`);
  if (pharmacy) lines.push(`Pharmacy-intent volume: ${pharmacy[1]}`);
  if (nearMe) lines.push(`Near-me volume: ${nearMe[1]}`);
  return lines;
}

function websitePresenceCopy(
  serviceName: string,
  placement: "dedicated" | "general-services" | "mentioned" | "not-found",
): { headline: string; detail: string } {
  if (placement === "general-services") {
    return {
      headline: `${serviceName} is shown on your general services page but does not have its own service-specific page.`,
      detail: "Patients can see the service in your general listing, but there is no distinct page that explains it in full.",
    };
  }
  if (placement === "dedicated") {
    return {
      headline: `${serviceName} has its own service-specific page.`,
      detail: "Patients can already open a dedicated page for this service.",
    };
  }
  if (placement === "mentioned") {
    return {
      headline: `${serviceName} is mentioned on your website but does not have its own service-specific page.`,
      detail: "Patients may miss the service unless it is given a clear page of its own.",
    };
  }
  return {
    headline: `${serviceName} was not found as a distinct page on your website.`,
    detail: "Patients looking for this service may not be able to find it from your current pages.",
  };
}

function supportingContentGap(
  serviceName: string,
  supporting?: { faqs: number; blogs: number; guides: number; localPages: number } | null,
): string | null {
  if (!supporting) return null;
  const missing: string[] = [];
  if (!supporting.guides) missing.push("patient guides");
  if (!supporting.blogs) missing.push("blogs");
  if (!supporting.faqs) missing.push("FAQs");
  if (!supporting.localPages) missing.push("local area pages");
  if (!missing.length) return null;
  if (missing.length === 4) {
    return `Your website does not yet have ${serviceName} patient guides, blogs, FAQs or local area pages to help people understand and find this service.`;
  }
  return `Supporting ${serviceName} content is still thin: ${missing.join(", ")} were not found.`;
}

export function buildGrowthPlanCommercialView(
  slug: string,
  campaign: GrowthEngineCampaignRecommendation,
): GrowthPlanCommercialView {
  const profile = readSetupProfile(slug);
  const website: GrowthEngineWebsiteIntelligenceSnapshot | null = resolveWebsiteIntelligenceSnapshot(slug);
  const snapshot: GrowthEngineCompetitorSnapshot | null = loadCompetitorSnapshot(slug);
  const analysis = website?.analysis;
  const enabledCount = (profile.selectedServices || []).filter(Boolean).length;
  const pagesFound =
    analysis?.canonicalCounts?.contentPages ||
    analysis?.inventory?.totalPages ||
    analysis?.pages?.length ||
    0;
  const nearby = snapshot?.competitors?.length || 0;
  const serviceName = campaign.campaignName;
  const serviceId = campaign.serviceId;

  const facts: Array<{ value: string; label: string }> = [];
  if (enabledCount) facts.push({ value: formatCount(enabledCount), label: "Enabled services" });
  if (pagesFound) facts.push({ value: formatCount(pagesFound), label: "Website pages analysed" });
  if (nearby) facts.push({ value: formatCount(nearby), label: "Nearby pharmacies mapped" });

  const pages = analysis?.pages || [];
  const canonical = analysis?.canonicalServices || [];
  const visibleUrls = canonical.filter((s) => s.customerVisible).map((s) => s.sourceUrl);
  const matched = canonical.find((s) => s.serviceId === serviceId);
  const coverage = analysis?.coverage?.find((c) => c.serviceId === serviceId);
  const placement = classifyServicePagePlacement(
    matched?.sourceUrl || coverage?.mainPageUrl,
    pages,
    visibleUrls,
    Boolean(matched?.customerVisible),
    coverage?.coverageStatus || matched?.coverageStatus,
  );
  const presence = websitePresenceCopy(serviceName, placement);
  const gap = supportingContentGap(serviceName, matched?.supportingContent || coverage?.supportingContent);

  const report = buildGrowthOpportunityReport(slug, snapshot);
  const demandOpp: GrowthOpportunity | undefined = report.opportunities.find((o) => o.serviceId === serviceId);
  const demandLines = demandOpp?.evidenceSummary ? parseRecordedDemand(demandOpp.evidenceSummary) : [];

  const evidenceCards: GrowthPlanEvidenceCard[] = [
    {
      category: "Website presence",
      headline: presence.headline,
      detail: presence.detail,
    },
  ];
  if (gap) {
    evidenceCards.push({
      category: "Patient information gap",
      headline: "Supporting patient information is missing",
      detail: gap,
    });
  }
  if (demandLines.length) {
    evidenceCards.push({
      category: "Search demand",
      headline: "Recorded search demand",
      detail: `${demandLines.join(". ")}. These figures come from recorded search-demand evidence, not from your website or Google Business Profile.`,
    });
  }
  if (nearby) {
    evidenceCards.push({
      category: "Local market",
      headline: `${formatCount(nearby)} nearby pharmacies mapped`,
      detail: `This is the recorded local-market result. A focused ${serviceName} campaign can help patients recognise your service among nearby pharmacies.`,
    });
  }

  const outputs = campaign.estimatedOutputs;
  const packageItems: GrowthPlanPackageItem[] = [
    { count: outputs.servicePage, label: unitLabel(outputs.servicePage, "Service page", "Service pages") },
    { count: outputs.clusterPages, label: unitLabel(outputs.clusterPages, "Local area page", "Local area pages") },
    { count: outputs.patientGuides, label: unitLabel(outputs.patientGuides, "Patient guide", "Patient guides") },
    { count: outputs.blogs, label: unitLabel(outputs.blogs, "Blog", "Blogs") },
    { count: outputs.faqs, label: unitLabel(outputs.faqs, "FAQ", "FAQs") },
    {
      count: outputs.gbpPosts,
      label: unitLabel(outputs.gbpPosts, "Google Business Profile post", "Google Business Profile posts"),
    },
    { count: outputs.socialPosts, label: unitLabel(outputs.socialPosts, "Social post", "Social posts") },
    { count: outputs.emails, label: unitLabel(outputs.emails, "Email", "Emails") },
    { count: outputs.videos, label: unitLabel(outputs.videos, "Video", "Videos") },
    { count: outputs.landingPages, label: unitLabel(outputs.landingPages, "Landing page", "Landing pages") },
  ];

  return {
    serviceName,
    facts,
    selectedPriority: serviceName,
    selectedSupportCopy: `You selected ${serviceName} as the service to prioritise. PharmaConnect has used your recorded website, search and local-market evidence to prepare this campaign plan.`,
    evidenceCards: evidenceCards.slice(0, 4),
    packageCopy: `A coordinated content package designed around ${serviceName}, your selected target areas and the PharmaConnect campaign framework.`,
    packageItems,
    benefitsCopy: "These are the intended benefits of the proposed campaign. They are not guaranteed traffic or ranking predictions.",
    benefits: [
      `Clearer ${serviceName} information for patients`,
      "Stronger service discovery",
      "Improved local content coverage",
      "Consistent promotion across the website and Google Business Profile",
      "More useful patient education",
    ],
  };
}
