/**
 * Campaign Builder — Generation Summary (Sprint 2C commercial approval screen).
 */
import fs from "node:fs";
import path from "node:path";

import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { resolveWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { CAMPAIGN_EXPLORER_ALL_SUPPORTED } from "./growthEngineCampaignExplorerModel.ts";
import {
  buildCampaignBuilderApprovalSummary,
  buildCampaignBuilderOverview,
  campaignPackageSelectionRows,
  loadCampaignBuilderSession,
  resolveCampaignBuilderAssetSelection,
  resolveCampaignBuilderPackageOutputs,
  type CampaignBuilderSession,
} from "./growthEngineCampaignBuilderService.ts";
import type { CampaignBuilderAssetSelection } from "./growthEngineCampaignBuilderModel.ts";
import { summarizeCampaignReadyPhotographs } from "./growthEngineCampaignBuilderImageStrategyService.ts";
import { resolveCanonicalPharmacyName } from "./pharmacyServicePageProfileContext.ts";

export interface CampaignGenerationSummaryAssetRow {
  key: keyof CampaignBuilderAssetSelection;
  label: string;
  selected: boolean;
  count: number;
}

export interface CampaignGenerationSummaryEstimatedOutput {
  servicePages: number;
  localPages: number;
  guides: number;
  faqs: number;
  blogs: number;
  gbpPosts: number;
  socialPosts: number;
  emails: number;
  totalAssets: number;
  buildTime: string;
}

export interface CampaignGenerationSummary {
  pharmacyName: string;
  website: string;
  campaignName: string;
  campaignDescription: string;
  targetAreaCount: number;
  targetAreas: string[];
  targetAreaMode: string;
  assets: CampaignGenerationSummaryAssetRow[];
  imageStrategy: string;
  assignedImageSlots: string[];
  deferredImageSlots: string[];
  uploadedImageCount: number;
  readyPhotoCount: number;
  selectedStockCount: number;
  approvedUploadCount: number;
  pendingUploadCount: number;
  requestAiImages: boolean;
  aiImageCount: number;
  imagePlan: NonNullable<ReturnType<typeof buildCampaignBuilderApprovalSummary>>["imagePlan"];
  websitePagesFound: number | null;
  websiteServicesDetected: number | null;
  websiteMissingOpportunities: string[];
  competitorsAnalysed: number | null;
  healthcareNetworkSummary: string | null;
  healthcareNetworkSupportingCopy: string | null;
  healthcareNetworkBreakdown: string[];
  localOpportunitySummary: string[];
  estimated: CampaignGenerationSummaryEstimatedOutput;
  sourceRefs: NonNullable<ReturnType<typeof buildCampaignBuilderApprovalSummary>>["sourceRefs"];
}

function loadProfile(slug: string) {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function estimateBuildTime(total: number): string {
  if (total >= 35) return "3–4 minutes";
  if (total >= 20) return "2–3 minutes";
  return "About 2 minutes";
}

type StoredHealthcareCategory = "gp" | "healthCentre" | "hospital" | "other";

const HEALTHCARE_NETWORK_SUPPORTING_COPY =
  "Existing pharmacy and local-market records were used for this summary.";

const HEALTHCARE_LANDMARK_PATTERN =
  /\b(hospital|clinic|gp\b|surgery|medical centre|health centre|walk-?in|urgent (treatment|care)|nhs)\b/i;

function normalizeFindingKey(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

function parseStoredPlace(item: unknown): { id: string; name: string } | null {
  if (typeof item === "string") {
    const name = item.trim();
    return name ? { id: "", name } : null;
  }
  if (!item || typeof item !== "object") return null;
  const row = item as {
    name?: string;
    businessName?: string;
    providerIdentity?: string;
    placeId?: string;
  };
  const name = String(row.name || row.businessName || "").trim();
  if (!name) return null;
  return {
    id: String(row.providerIdentity || row.placeId || "").trim(),
    name,
  };
}

function isHealthcareLandmark(item: unknown): boolean {
  if (typeof item === "string") return HEALTHCARE_LANDMARK_PATTERN.test(item);
  if (!item || typeof item !== "object") return false;
  const row = item as {
    name?: string;
    businessName?: string;
    typeLabel?: string;
    classifiedType?: string;
    entityType?: string;
    category?: string;
  };
  const text = [
    row.name,
    row.businessName,
    row.typeLabel,
    row.classifiedType,
    row.entityType,
    row.category,
  ]
    .map((part) => String(part || ""))
    .join(" ");
  return HEALTHCARE_LANDMARK_PATTERN.test(text);
}

function snapshotProviderCategory(groupKey: string): StoredHealthcareCategory {
  if (groupKey === "gpSurgeries") return "gp";
  if (groupKey === "healthCentres" || groupKey === "walkInCentres" || groupKey === "communityClinics") {
    return "healthCentre";
  }
  if (groupKey === "hospitals" || groupKey === "urgentTreatmentCentres") return "hospital";
  return "other";
}

function collectStoredHealthcareNetwork(slug: string): Array<{ name: string; category: StoredHealthcareCategory }> {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const records: Array<{ name: string; category: StoredHealthcareCategory }> = [];

  const add = (item: unknown, category: StoredHealthcareCategory) => {
    const parsed = parseStoredPlace(item);
    if (!parsed) return;
    const nameKey = normalizeFindingKey(parsed.name);
    if ((parsed.id && seenIds.has(parsed.id)) || seenNames.has(nameKey)) return;
    if (parsed.id) seenIds.add(parsed.id);
    seenNames.add(nameKey);
    records.push({ name: parsed.name, category });
  };

  try {
    const snapshot = loadCompetitorSnapshot(slug);
    for (const provider of snapshot?.healthcare?.providers || []) {
      add(provider, snapshotProviderCategory(String((provider as { groupKey?: string }).groupKey || "")));
    }
  } catch {
    // Optional Local Market healthcare evidence — same source as Target Area ranking.
  }

  try {
    const file = path.join(WORKSPACE_ROOT, "data/pharmacy-local-intelligence", `${slug}.json`);
    if (fs.existsSync(file)) {
      const intel = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      const groups: Array<[unknown, StoredHealthcareCategory]> = [
        [intel.gpSurgeries, "gp"],
        [intel.localGps, "gp"],
        [intel.healthCentres, "healthCentre"],
        [intel.localHealthcareLocations, "healthCentre"],
        [intel.hospitals, "hospital"],
        [intel.localHospitals, "hospital"],
        [intel.outOfHoursGpServices, "other"],
      ];
      for (const [group, category] of groups) {
        for (const item of (group as unknown[]) || []) add(item, category);
      }
      for (const group of [intel.landmarks, intel.localLandmarks]) {
        for (const item of (group as unknown[]) || []) {
          if (isHealthcareLandmark(item)) add(item, "other");
        }
      }
    }
  } catch {
    // Local Intelligence file may be absent.
  }

  return records;
}

function summarizeStoredHealthcareNetwork(slug: string): {
  summary: string | null;
  supportingCopy: string | null;
  breakdown: string[];
} {
  const records = collectStoredHealthcareNetwork(slug);
  if (!records.length) {
    return { summary: null, supportingCopy: null, breakdown: [] };
  }

  const counts: Record<StoredHealthcareCategory, number> = {
    gp: 0,
    healthCentre: 0,
    hospital: 0,
    other: 0,
  };
  for (const record of records) counts[record.category] += 1;

  const breakdown: string[] = [];
  if (counts.gp) breakdown.push(countLabel(counts.gp, "GP practice", "GP practices"));
  if (counts.healthCentre) {
    breakdown.push(countLabel(counts.healthCentre, "health centre", "health centres"));
  }
  if (counts.hospital) breakdown.push(countLabel(counts.hospital, "hospital", "hospitals"));
  if (counts.other) {
    breakdown.push(countLabel(counts.other, "other healthcare location", "other healthcare locations"));
  }

  return {
    summary: countLabel(records.length, "healthcare location recorded", "healthcare locations recorded"),
    supportingCopy: HEALTHCARE_NETWORK_SUPPORTING_COPY,
    breakdown,
  };
}

function uniqueCustomerFacingFindings(items: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const text = String(raw || "").trim();
    if (!text) continue;
    const key = text.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text);
  }
  return out;
}

export function buildCampaignGenerationSummary(
  slug: string,
  session?: CampaignBuilderSession,
): CampaignGenerationSummary | null {
  const state = session || loadCampaignBuilderSession(slug);
  const approval = buildCampaignBuilderApprovalSummary(slug);
  const overview = buildCampaignBuilderOverview(slug, state);
  if (!approval || !overview) return null;

  const profile = loadProfile(slug);
  const explorer = CAMPAIGN_EXPLORER_ALL_SUPPORTED.find((s) => s.serviceId === overview.serviceId);
  const websiteSnap = resolveWebsiteIntelligenceSnapshot(slug);
  const localSnap = loadCompetitorSnapshot(slug);

  const analysis = websiteSnap?.analysis;
  const pagesFound =
    analysis?.inventory?.totalPages ??
    analysis?.pages?.length ??
    profile.websiteImportSnapshot?.intelligence?.structure?.pages?.length ??
    null;

  const servicesDetected =
    analysis?.services?.filter((s) => s.detected).length ??
    profile.websiteImportSnapshot?.servicesDetected?.length ??
    null;

  const missingOpportunities = uniqueCustomerFacingFindings(
    analysis?.missingContent?.length
      ? analysis.missingContent.map((m) => m.gap || m.serviceName)
      : analysis?.opportunities?.map((o) => o.headline) || [],
  ).slice(0, 5);

  const competitorsAnalysed = localSnap?.analysis?.competitorCount ?? localSnap?.competitors?.length ?? null;
  const healthcareNetwork = summarizeStoredHealthcareNetwork(slug);

  const localOpportunitySummary = [
    ...(localSnap?.analysis?.opportunities || []).slice(0, 3),
    ...(localSnap?.healthcare?.analysis?.opportunities || []).slice(0, 2),
  ].filter(Boolean);

  const packageOutputs = resolveCampaignBuilderPackageOutputs(slug);
  const selection = resolveCampaignBuilderAssetSelection(state);
  const packageRows = packageOutputs ? campaignPackageSelectionRows(packageOutputs, selection) : [];
  const assets: CampaignGenerationSummaryAssetRow[] = packageRows.map((row) => ({
    key: row.key,
    label: row.label,
    selected: row.selected,
    count: row.selected ? row.count : 0,
  }));
  const totalAssets = assets.reduce((sum, row) => sum + (row.selected ? row.count : 0), 0);
  const quantityFor = (key: keyof CampaignBuilderAssetSelection) =>
    assets.find((row) => row.key === key)?.count || 0;
  const localPages = quantityFor("landingPages");
  const socialPosts = quantityFor("social");

  const imagePlan = approval.imagePlan;
  const assignedImageSlots =
    imagePlan?.slots.filter((s) => s.approvalState === "approved" || s.approvalState === "pending").map((s) => s.label) ||
    [];
  const deferredImageSlots = imagePlan?.slots.filter((s) => s.approvalState === "deferred").map((s) => s.label) || [];
  const imageSummary = summarizeCampaignReadyPhotographs(slug, state);
  const uploadedImageCount = imageSummary.readyPhotoCount;
  const aiImageCount = imagePlan?.slots.filter((s) => s.sourceType === "ai").length || 0;

  return {
    pharmacyName: resolveCanonicalPharmacyName(profile).value || slug,
    website: profile.website || websiteSnap?.websiteUrl || "Not set",
    campaignName: overview.campaignName,
    campaignDescription: explorer?.description || overview.campaignObjective,
    targetAreaCount: approval.targetAreas.length,
    targetAreas: approval.targetAreas,
    targetAreaMode: approval.targetAreaMode,
    assets,
    imageStrategy: approval.imageStrategy,
    assignedImageSlots,
    deferredImageSlots,
    uploadedImageCount,
    readyPhotoCount: imageSummary.readyPhotoCount,
    selectedStockCount: imageSummary.selectedStockCount,
    approvedUploadCount: imageSummary.approvedUploadCount,
    pendingUploadCount: imageSummary.pendingUploadCount,
    requestAiImages: imageSummary.requestAiImages,
    aiImageCount,
    imagePlan: approval.imagePlan,
    websitePagesFound: typeof pagesFound === "number" ? pagesFound : null,
    websiteServicesDetected: typeof servicesDetected === "number" ? servicesDetected : null,
    websiteMissingOpportunities: missingOpportunities,
    competitorsAnalysed,
    healthcareNetworkSummary: healthcareNetwork.summary,
    healthcareNetworkSupportingCopy: healthcareNetwork.supportingCopy,
    healthcareNetworkBreakdown: healthcareNetwork.breakdown,
    localOpportunitySummary,
    estimated: {
      servicePages: quantityFor("servicePage"),
      localPages,
      guides: quantityFor("guides"),
      faqs: quantityFor("faqs"),
      blogs: quantityFor("blogs"),
      gbpPosts: quantityFor("gbp"),
      socialPosts,
      emails: quantityFor("emails"),
      totalAssets,
      buildTime: estimateBuildTime(totalAssets),
    },
    sourceRefs: approval.sourceRefs,
  };
}
