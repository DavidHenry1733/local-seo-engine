/**
 * Campaign Explorer V1 — catalog builder from existing import and market evidence.
 */
import {
  CAMPAIGN_EXPLORER_ALL_SUPPORTED,
  CAMPAIGN_EXPLORER_NHS_SERVICES,
  CAMPAIGN_EXPLORER_PRIVATE_SERVICES,
  CAMPAIGN_EXPLORER_VERSION,
  CE_BADGE_EXISTING,
  CE_BADGE_GROWTH,
  CE_BADGE_NHS,
  CE_BADGE_PRIVATE,
  CE_DETECTED_ON_WEBSITE,
  CE_EXISTING_WEBSITE_NOTE,
  CE_EXPLORE_DETAIL,
  CE_EXPLORE_SUBTITLE,
  CE_EXPLORE_TITLE,
  CE_NHS_CATALOG_NOTE,
  CE_PRIVATE_CATALOG_NOTE,
  type CampaignExplorerCatalog,
  type CampaignExplorerItem,
  type CampaignExplorerServiceDef,
} from "./growthEngineCampaignExplorerModel.ts";
import {
  collectWebsiteImportCanonicalServices,
  countWebsiteImportDetectedServices,
  isWebsiteImportDetectedService,
  websiteImportServiceCountDebug,
} from "./growthEngineCampaignExplorerWebsiteServices.ts";
import { buildCampaignBuilderList } from "./growthEngineCampaignBuilderService.ts";
import { collectMissingServiceOpportunities } from "./growthEngineCampaignBuilderFallbackService.ts";
import { buildCampaignRecommendationIntelligence } from "./growthEngineCampaignRecommendationIntelligenceService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { resolveAuthoritativeCampaignPriority } from "./growthEngineGrowthPlanResolver.ts";

function resolveDef(serviceId: string): CampaignExplorerServiceDef | null {
  return CAMPAIGN_EXPLORER_ALL_SUPPORTED.find((s) => s.serviceId === serviceId) || null;
}

function descriptionFor(serviceId: string, fallback: string): string {
  return resolveDef(serviceId)?.description || fallback;
}

function toExistingItem(serviceId: string, serviceName: string): CampaignExplorerItem {
  return {
    serviceId,
    serviceName,
    description: descriptionFor(
      serviceId,
      `Strengthen how ${serviceName} is presented to local patients.`,
    ),
    badgeType: "existing",
    badgeLabel: CE_BADGE_EXISTING,
    detectedOnWebsite: true,
  };
}

function toGrowthItem(serviceId: string, serviceName: string, evidence: string): CampaignExplorerItem {
  const name = resolveDef(serviceId)?.serviceName || getServicePublishMeta(serviceId)?.serviceName || serviceName;
  return {
    serviceId,
    serviceName: name,
    description: evidence || descriptionFor(serviceId, `Promote ${name} to local patients.`),
    badgeType: "growth-opportunity",
    badgeLabel: CE_BADGE_GROWTH,
  };
}

function toCatalogItem(
  def: CampaignExplorerServiceDef,
  badgeType: "nhs" | "private",
  slug: string,
): CampaignExplorerItem {
  const detectedOnWebsite = isWebsiteImportDetectedService(slug, def.serviceId, def.serviceName);
  return {
    serviceId: def.serviceId,
    serviceName: def.serviceName,
    description: def.description,
    badgeType,
    badgeLabel: badgeType === "nhs" ? CE_BADGE_NHS : CE_BADGE_PRIVATE,
    detectedOnWebsite,
  };
}

export function resolveRecommendedCampaign(slug: string) {
  const selectedId = resolveAuthoritativeCampaignPriority(slug);
  const campaigns = buildCampaignBuilderList(slug);
  if (selectedId) {
    return campaigns.find((c) => c.serviceId === selectedId) || campaigns[0] || null;
  }
  return campaigns.find((c) => c.recommended) || campaigns[0] || null;
}

export function buildCampaignExplorerCatalog(slug: string): CampaignExplorerCatalog | null {
  const recommended = resolveRecommendedCampaign(slug);
  if (!recommended) return null;

  const canonical = collectWebsiteImportCanonicalServices(slug);
  const websiteImportServiceCount = countWebsiteImportDetectedServices(slug);

  const existingOnWebsite: CampaignExplorerItem[] = canonical.map((s) => toExistingItem(s.serviceId, s.serviceName));

  const detectedIds = new Set(canonical.map((s) => s.serviceId));
  const detectedNames = new Set(canonical.map((s) => s.serviceName.toLowerCase()));

  const missingOpportunities = collectMissingServiceOpportunities(slug).filter(
    (m) =>
      !detectedIds.has(m.serviceId) &&
      !detectedNames.has(m.serviceName.toLowerCase()) &&
      (resolveDef(m.serviceId) || getServicePublishMeta(m.serviceId)),
  );

  const growthOpportunities: CampaignExplorerItem[] = missingOpportunities.map((m) =>
    toGrowthItem(m.serviceId, m.serviceName, m.evidence),
  );

  const nhsServices = CAMPAIGN_EXPLORER_NHS_SERVICES.map((def) => toCatalogItem(def, "nhs", slug));
  const privateServices = CAMPAIGN_EXPLORER_PRIVATE_SERVICES.map((def) => toCatalogItem(def, "private", slug));

  const selectedId = resolveAuthoritativeCampaignPriority(slug);
  const customerSelected = Boolean(selectedId && recommended.serviceId === selectedId);

  return {
    version: CAMPAIGN_EXPLORER_VERSION,
    slug,
    recommendedServiceId: recommended.serviceId,
    recommendedServiceName: recommended.serviceName,
    recommendMessage: customerSelected
      ? `${recommended.serviceName} is currently selected.`
      : `We recommend starting with ${recommended.serviceName} based on your pharmacy and local market.`,
    controlMessage: "You can choose another campaign at any time.",
    exploreTitle: CE_EXPLORE_TITLE,
    exploreSubtitle: CE_EXPLORE_SUBTITLE,
    existingOnWebsite,
    growthOpportunities,
    nhsServices,
    privateServices,
    websiteImportServiceCount,
    existingOnWebsiteNote: CE_EXISTING_WEBSITE_NOTE,
    nhsCatalogNote: CE_NHS_CATALOG_NOTE,
    privateCatalogNote: CE_PRIVATE_CATALOG_NOTE,
  };
}

export function explorerSections(catalog: CampaignExplorerCatalog) {
  const existingTitle =
    catalog.websiteImportServiceCount > 0
      ? `Services Already On Your Website (${catalog.websiteImportServiceCount})`
      : "Services Already On Your Website";

  return [
    {
      id: "existing",
      title: existingTitle,
      badgeHint: CE_BADGE_EXISTING,
      lead: catalog.existingOnWebsiteNote,
      items: catalog.existingOnWebsite,
      hiddenWhenEmpty: false,
    },
    {
      id: "growth",
      title: "Recommended Growth Opportunities",
      badgeHint: CE_BADGE_GROWTH,
      items: catalog.growthOpportunities,
      hiddenWhenEmpty: true,
    },
    {
      id: "nhs",
      title: "All NHS Pharmacy Services",
      badgeHint: CE_BADGE_NHS,
      lead: catalog.nhsCatalogNote,
      items: catalog.nhsServices,
      hiddenWhenEmpty: false,
    },
    {
      id: "private",
      title: "Private Services",
      badgeHint: CE_BADGE_PRIVATE,
      lead: catalog.privateCatalogNote,
      items: catalog.privateServices,
      hiddenWhenEmpty: false,
    },
  ];
}

export function isExplorerSupportedService(serviceId: string): boolean {
  return Boolean(resolveDef(serviceId) || getServicePublishMeta(serviceId));
}

export function explorerIntelligenceUpdatesForService(slug: string, serviceId: string): boolean {
  return Boolean(buildCampaignRecommendationIntelligence(slug, serviceId));
}

export function explorerExistingServiceIdsUnique(catalog: CampaignExplorerCatalog): boolean {
  const ids = catalog.existingOnWebsite.map((s) => s.serviceId);
  return ids.length === new Set(ids).size;
}

export { CE_DETECTED_ON_WEBSITE, CE_EXPLORE_DETAIL, websiteImportServiceCountDebug };
