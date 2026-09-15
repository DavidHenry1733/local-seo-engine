/**
 * Campaign Builder V1 — fallback campaign recommendations from import evidence.
 * Used only when Growth Plan Intelligence returns no primary campaign.
 */
import type {
  CampaignBuilderListItem,
  CampaignBuilderPriority,
  CampaignBuilderServiceContext,
} from "./growthEngineCampaignBuilderModel.ts";
import type { GrowthEngineCampaignRecommendation } from "./growthEngineCampaignModel.ts";
import { CAMPAIGN_EXPECTED_BENEFITS, authoritativeCampaignPackageItems, authoritativeCampaignPackageTotal } from "./growthEngineCampaignModel.ts";
import { estimateCampaignOutputs } from "./growthEngineCampaignRecommendationEngine.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { inferCompetitorHasService, loadCompetitorIntelligence } from "./pharmacyCompetitorIntelligence.ts";
import {
  BENCHMARK_MASTER_SERVICE_IDS,
  getServicePublishMeta,
  MASTER_PUBLISH_SERVICES,
} from "./pharmacyMasterPublishConfig.ts";
import { normalizeProfileData } from "./pharmacyProfileSchema.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import fs from "node:fs";
import path from "node:path";

export const CAMPAIGN_BUILDER_EXISTING_LABEL = "Existing service detected on your website";

export const CAMPAIGN_BUILDER_EXISTING_COPY =
  "We found this service on your website. This campaign will strengthen and expand its visibility.";

export const CAMPAIGN_BUILDER_MISSING_COPY =
  "This service does not currently appear on your website. Creating this campaign can help you promote another valuable NHS or private service.";

export const CAMPAIGN_BUILDER_EXISTING_BADGE = "Grow This Service";

export const CAMPAIGN_BUILDER_MISSING_BADGE = "New Growth Opportunity";

/** @deprecated Use CAMPAIGN_BUILDER_EXISTING_COPY — kept for validation compatibility */
export const CAMPAIGN_BUILDER_FALLBACK_REASON = CAMPAIGN_BUILDER_EXISTING_COPY;

/** @deprecated Use CAMPAIGN_BUILDER_EXISTING_LABEL — kept for validation compatibility */
export const CAMPAIGN_BUILDER_FALLBACK_OPPORTUNITY = CAMPAIGN_BUILDER_EXISTING_LABEL;

/** Fallback-only display order when Growth Plan has no recommendation. */
export const CAMPAIGN_BUILDER_FALLBACK_PREFERRED_ORDER = [
  "pharmacy-first",
  "blood-pressure-checks",
  "flu-vaccinations",
  "repeat-prescriptions",
] as const;

const FORBIDDEN_FALLBACK_CLAIMS = [
  "revenue",
  "demand",
  "Strong local demand",
  "high patient interest",
  "Good growth potential",
  "missing opportunity pending",
] as const;

const SERVICE_NAME_ALIASES: Record<string, string> = {
  "travel clinic": "travel-vaccinations",
  "flu vaccination": "flu-vaccinations",
  "flu vaccinations": "flu-vaccinations",
  "covid vaccination": "covid-vaccinations",
  "covid vaccinations": "covid-vaccinations",
  contraception: "pharmacy-contraception-service",
  vaccinations: "vaccinations",
};

function profilePath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
}

function loadProfile(slug: string) {
  const file = profilePath(slug);
  if (!fs.existsSync(file)) return normalizeProfileData({});
  const doc = JSON.parse(fs.readFileSync(file, "utf8"));
  return normalizeProfileData(doc.data || {});
}

function normalizeServiceName(name: string): string {
  return String(name || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function resolveServiceIdFromName(name: string): string | null {
  const norm = normalizeServiceName(name);
  if (!norm) return null;
  if (SERVICE_NAME_ALIASES[norm]) return SERVICE_NAME_ALIASES[norm];
  for (const meta of MASTER_PUBLISH_SERVICES) {
    if (normalizeServiceName(meta.serviceName) === norm) return meta.serviceId;
  }
  const slugLike = norm.replace(/\s+/g, "-");
  if (getServicePublishMeta(slugLike)) return slugLike;
  return null;
}

function resolveCanonicalServiceId(serviceId: string, serviceName: string): string | null {
  if (serviceId && !serviceId.startsWith("website-") && getServicePublishMeta(serviceId)) return serviceId;
  return resolveServiceIdFromName(serviceName) || (serviceId.startsWith("website-") ? null : serviceId);
}

interface DetectedService {
  serviceId: string;
  serviceName: string;
  source: string;
}

function addDetected(map: Map<string, DetectedService>, serviceId: string, serviceName: string, source: string): void {
  const canonical = resolveCanonicalServiceId(serviceId, serviceName);
  if (!canonical) return;
  if (map.has(canonical)) return;
  map.set(canonical, {
    serviceId: canonical,
    serviceName: serviceName || getServicePublishMeta(canonical)?.serviceName || canonical.replace(/-/g, " "),
    source,
  });
}

/** Services confirmed present on the customer's website — never includes missing/gap rows. */
export function collectExistingWebsiteServices(slug: string): DetectedService[] {
  const profile = loadProfile(slug);
  const detected = new Map<string, DetectedService>();

  const intelligenceServices = profile.websiteImportSnapshot?.intelligence?.services;
  if (Array.isArray(intelligenceServices)) {
    for (const row of intelligenceServices) {
      if (!row?.serviceId || row.exists !== true) continue;
      addDetected(detected, row.serviceId, row.serviceName, "website-intelligence-v2");
    }
  }

  for (const name of profile.websiteImportSnapshot?.servicesDetected || []) {
    const serviceId = resolveServiceIdFromName(name);
    if (serviceId) addDetected(detected, serviceId, name, "website-import-snapshot");
  }

  for (const row of profile.detectedWebsiteServices || []) {
    const fromName = resolveServiceIdFromName(row.serviceName);
    const serviceId = fromName || (row.serviceId.startsWith("website-") ? null : row.serviceId);
    if (serviceId) addDetected(detected, serviceId, row.serviceName, "detected-website-services");
  }

  const websiteIntel = loadWebsiteIntelligenceSnapshot(slug);
  if (websiteIntel?.analysis?.coverage) {
    for (const row of websiteIntel.analysis.coverage) {
      if (!row.serviceId || !row.websiteDetected) continue;
      addDetected(detected, row.serviceId, row.serviceName || "", "website-report-coverage");
    }
  }

  return [...detected.values()];
}

/** @deprecated Use collectExistingWebsiteServices */
export function collectDetectedCampaignServices(slug: string): DetectedService[] {
  return collectExistingWebsiteServices(slug);
}

interface MissingServiceOpportunity {
  serviceId: string;
  serviceName: string;
  source: "profile" | "google" | "competitor";
  evidence: string;
}

function addMissing(
  map: Map<string, MissingServiceOpportunity>,
  serviceId: string,
  serviceName: string,
  source: MissingServiceOpportunity["source"],
  evidence: string,
  existingIds: Set<string>,
): void {
  const canonical = resolveCanonicalServiceId(serviceId, serviceName);
  if (!canonical || existingIds.has(canonical) || map.has(canonical)) return;
  map.set(canonical, {
    serviceId: canonical,
    serviceName: serviceName || getServicePublishMeta(canonical)?.serviceName || canonical.replace(/-/g, " "),
    source,
    evidence,
  });
}

export function collectMissingServiceOpportunities(slug: string): MissingServiceOpportunity[] {
  const profile = loadProfile(slug);
  const existingIds = new Set(collectExistingWebsiteServices(slug).map((s) => s.serviceId));
  const missing = new Map<string, MissingServiceOpportunity>();

  for (const serviceId of profile.selectedServices || []) {
    if (!serviceId || existingIds.has(serviceId)) continue;
    const serviceName = getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ");
    addMissing(
      missing,
      serviceId,
      serviceName,
      "profile",
      `${serviceName} is enabled on your Business Profile but was not found on your website.`,
      existingIds,
    );
  }

  for (const name of profile.priorityServices || []) {
    const serviceId = resolveServiceIdFromName(name);
    if (!serviceId) continue;
    addMissing(
      missing,
      serviceId,
      name,
      "google",
      `${name} is listed on your Google Business Profile but was not found on your website.`,
      existingIds,
    );
  }

  const websiteIntel = loadWebsiteIntelligenceSnapshot(slug);
  if (websiteIntel?.analysis?.coverage) {
    for (const row of websiteIntel.analysis.coverage) {
      if (!row.profileEnabled || row.websiteDetected) continue;
      const serviceId = resolveCanonicalServiceId(row.serviceId, row.serviceName);
      if (!serviceId) continue;
      addMissing(
        missing,
        serviceId,
        row.serviceName,
        "profile",
        row.serviceName + " is enabled in your profile but was not found on your website.",
        existingIds,
      );
    }
  }

  const competitorIntel = loadCompetitorIntelligence(slug);
  if (competitorIntel?.competitors?.length) {
    const competitors = competitorIntel.competitors;
    const threshold = Math.max(2, Math.ceil(competitors.length * 0.3));
    for (const serviceId of BENCHMARK_MASTER_SERVICE_IDS) {
      if (existingIds.has(serviceId)) continue;
      const withService = competitors.filter((c) => inferCompetitorHasService(c, serviceId));
      if (withService.length < threshold) continue;
      const serviceName = getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ");
      addMissing(
        missing,
        serviceId,
        serviceName,
        "competitor",
        `${withService.length} local competitors promote ${serviceName}, but it was not found on your website.`,
        existingIds,
      );
    }
  }

  return [...missing.values()];
}

function countAssets(outputs: ReturnType<typeof estimateCampaignOutputs>): number {
  return authoritativeCampaignPackageTotal(outputs);
}

function estimateCompletionTime(assetCount: number): string {
  if (assetCount >= 45) return "45–90 minutes";
  if (assetCount >= 30) return "30–60 minutes";
  return "20–45 minutes";
}

function orderFallbackServices(detected: DetectedService[]): DetectedService[] {
  const byId = new Map(detected.map((d) => [d.serviceId, d]));
  const preferred = CAMPAIGN_BUILDER_FALLBACK_PREFERRED_ORDER.filter((id) => byId.has(id)).map(
    (id) => byId.get(id)!,
  );
  if (preferred.length) return preferred;

  const benchmarkSet = new Set<string>(BENCHMARK_MASTER_SERVICE_IDS);
  return detected
    .filter((d) => benchmarkSet.has(d.serviceId))
    .sort((a, b) => a.serviceName.localeCompare(b.serviceName));
}

function buildListItem(
  service: { serviceId: string; serviceName: string },
  context: CampaignBuilderServiceContext,
  profile: ReturnType<typeof loadProfile>,
  index: number,
  recommended: boolean,
  missingEvidence?: string,
): CampaignBuilderListItem {
  const outputs = estimateCampaignOutputs(profile);
  const assetCount = countAssets(outputs);
  const isExisting = context === "existing";

  return {
    serviceId: service.serviceId,
    serviceName: service.serviceName,
    priority: "Medium" as CampaignBuilderPriority,
    reason: isExisting ? CAMPAIGN_BUILDER_EXISTING_COPY : CAMPAIGN_BUILDER_MISSING_COPY,
    estimatedOpportunity: isExisting ? CAMPAIGN_BUILDER_EXISTING_LABEL : CAMPAIGN_BUILDER_MISSING_COPY,
    estimatedCompletionTime: estimateCompletionTime(assetCount),
    expectedAssetCount: assetCount,
    packageItems: authoritativeCampaignPackageItems(outputs),
    recommended,
    score: isExisting ? 50 : 40,
    isFallback: true,
    serviceContext: context,
    contextBadge: isExisting ? CAMPAIGN_BUILDER_EXISTING_BADGE : CAMPAIGN_BUILDER_MISSING_BADGE,
    contextLabel: isExisting ? CAMPAIGN_BUILDER_EXISTING_LABEL : missingEvidence || "Missing service opportunity",
  };
}

export function buildFallbackCampaignBuilderList(slug: string): CampaignBuilderListItem[] {
  const profile = loadProfile(slug);
  const existing = orderFallbackServices(collectExistingWebsiteServices(slug));
  const missing = collectMissingServiceOpportunities(slug);

  const items: CampaignBuilderListItem[] = existing.map((service, index) =>
    buildListItem(service, "existing", profile, index, index === 0),
  );

  for (const gap of missing) {
    if (items.some((item) => item.serviceId === gap.serviceId)) continue;
    items.push(
      buildListItem(gap, "missing", profile, items.length, false, gap.evidence),
    );
  }

  return items;
}

export function buildFallbackCampaignSections(slug: string): {
  existing: CampaignBuilderListItem[];
  missing: CampaignBuilderListItem[];
} {
  const all = buildFallbackCampaignBuilderList(slug);
  return {
    existing: all.filter((item) => item.serviceContext === "existing"),
    missing: all.filter((item) => item.serviceContext === "missing"),
  };
}

export function findFallbackCampaignRecommendation(
  slug: string,
  serviceId: string,
): GrowthEngineCampaignRecommendation | null {
  const existing = collectExistingWebsiteServices(slug).find((d) => d.serviceId === serviceId);
  const missing = collectMissingServiceOpportunities(slug).find((d) => d.serviceId === serviceId);
  const match = existing || missing;
  if (!match) return null;

  const profile = loadProfile(slug);
  const isExisting = Boolean(existing);
  const missingDetail = missing?.evidence || CAMPAIGN_BUILDER_MISSING_COPY;
  return {
    serviceId: match.serviceId,
    campaignName: match.serviceName,
    priority: "medium",
    confidence: "medium",
    reason: isExisting ? CAMPAIGN_BUILDER_EXISTING_COPY : CAMPAIGN_BUILDER_MISSING_COPY,
    evidence: [
      {
        source: "Website Intelligence",
        headline: isExisting
          ? `${match.serviceName} detected on your website`
          : `${match.serviceName} not found on your website`,
        detail: isExisting ? CAMPAIGN_BUILDER_EXISTING_COPY : missingDetail,
      },
    ],
    evidenceSources: ["Website Intelligence"],
    estimatedOutputs: estimateCampaignOutputs(profile),
    expectedBenefits: [...CAMPAIGN_EXPECTED_BENEFITS],
    score: isExisting ? 50 : 40,
  };
}

export function fallbackClaimsAreSafe(text: string): boolean {
  const lower = text.toLowerCase();
  return !FORBIDDEN_FALLBACK_CLAIMS.some((phrase) => lower.includes(phrase.toLowerCase()));
}

export function existingServiceCopyIsSafe(text: string): boolean {
  const lower = text.toLowerCase();
  if (lower.includes("not found") || lower.includes("missing") || lower.includes("not detected")) return false;
  return fallbackClaimsAreSafe(text);
}
