/**
 * Local Pharmacy Search Intelligence — compose existing DataForSEO artifacts.
 *
 * Demand: Keywords Data Google Ads search_volume (confirmed selectedServices).
 * Organic: Google Organic Live rows, classified as evidence only.
 * Google Places remains the only source of nearby physical competitors.
 * Unclassified SERP domains are never promoted as direct commercial competitors.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { loadCompetitorSnapshot } from "./growthEngineLocalMarketService.ts";
import { resolveTenantLocality } from "./masterAdminPrimaryLocalityService.ts";
import {
  hasReliableOrganicSearchResults,
  readOrganicSearchRun,
  runOrganicSearchCompetitorDiscovery,
  type OrganicSearchProviderResult,
} from "./competitorAnalysisOrganicSearchService.ts";
import {
  collectServiceSearchDemand,
  readConfirmedServiceIds,
  type ServiceSearchDemandCollectResult,
} from "./serviceSearchDemandService.ts";
import { readServiceSearchDemandArtifact } from "./serviceSearchDemandStorage.ts";
import type { ServiceSearchDemandArtifact, ServiceSearchDemandQueryRow } from "./serviceSearchDemandModel.ts";
import type { OrganicSearchCompetitorRun } from "./nationalCompetitorDiscoveryModel.ts";
import {
  classifyOrganicSearchEvidence,
  type OrganicSearchEvidenceClassification,
} from "./organicSearchEvidenceClassification.ts";
import { hydrateDataForSeoEnvIfNeeded } from "./contentEngine/pharmacyLocalEditorialEvidenceCollectorV3.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";

export type LocalSearchIntelligenceView = {
  platform: "local";
  slug: string;
  pharmacyName: string;
  town: string;
  website: string;
  collected: boolean;
  demand: ServiceSearchDemandArtifact | null;
  demandRows: ServiceSearchDemandQueryRow[];
  organic: OrganicSearchCompetitorRun | null;
  classified: OrganicSearchEvidenceClassification;
  note: string;
};

export type LocalSearchIntelligenceCollectResult = {
  demand: ServiceSearchDemandCollectResult;
  organic: OrganicSearchProviderResult | null;
  organicSkipped: boolean;
  view: LocalSearchIntelligenceView;
};

const LOCAL_SEARCH_NOTE =
  "Organic search rows are supporting evidence. Google Places remains the only source of nearby physical competitors. Directory, regulator, NHS, publisher and other landscape results are not promoted as direct commercial competitors.";

function resolveSearchIntelligenceServiceId(slug: string): string | null {
  return readActiveServiceCampaignSelection(slug)?.serviceId || readConfirmedServiceIds(slug)[0] || null;
}

function flattenDemandRows(artifact: ServiceSearchDemandArtifact | null): ServiceSearchDemandQueryRow[] {
  if (!artifact?.demandByService) return [];
  const rows: ServiceSearchDemandQueryRow[] = [];
  for (const serviceId of artifact.confirmedServiceIds || Object.keys(artifact.demandByService)) {
    const entry = artifact.demandByService[serviceId];
    if (!entry?.queries?.length) continue;
    rows.push(...entry.queries);
  }
  return rows;
}

export function buildLocalSearchIntelligenceView(slug: string): LocalSearchIntelligenceView {
  const profile = readSetupProfile(slug);
  const locality = resolveTenantLocality(profile);
  const snapshot = loadCompetitorSnapshot(slug);
  const demand = readServiceSearchDemandArtifact(slug);
  const organic =
    readOrganicSearchRun(slug, resolveSearchIntelligenceServiceId(slug)) || readOrganicSearchRun(slug);
  const classified = classifyOrganicSearchEvidence({
    tenantWebsiteUrls: [snapshot?.yourPharmacy?.website, profile.website],
    pharmacyName: String(profile.tradingName || profile.pharmacyName || snapshot?.yourPharmacy?.businessName || "").trim(),
    verifiedGoogleCompetitorWebsites: (snapshot?.competitors || []).map((competitor) => ({
      name: competitor.businessName,
      website: competitor.website,
      placeId: competitor.placeId,
      source: competitor.source,
    })),
    rows: (organic?.competitors || []).map((row) => ({
      name: row.title,
      domain: row.domain,
      host: row.host,
      url: row.url,
      position: row.position,
      matchedQuery: row.matchedQuery,
      title: row.title,
      description: row.description,
      overlapEvidence: row.overlapEvidence,
      source: row.provider,
      provider: row.provider,
      capturedAt: row.capturedAt,
      taskId: row.taskId,
    })),
  });

  return {
    platform: "local",
    slug,
    pharmacyName: String(profile.tradingName || profile.pharmacyName || "").trim(),
    town: String(locality.value || profile.primaryTown || profile.townCity || "").trim(),
    website: String(profile.website || snapshot?.yourPharmacy?.website || "").trim(),
    collected: Boolean(demand || organic?.generated),
    demand,
    demandRows: flattenDemandRows(demand),
    organic,
    classified,
    note: LOCAL_SEARCH_NOTE,
  };
}

export async function collectLocalSearchIntelligence(
  slug: string,
  options: { force?: boolean } = {},
): Promise<LocalSearchIntelligenceCollectResult> {
  const force = options.force === true;
  hydrateDataForSeoEnvIfNeeded();
  const demand = await collectServiceSearchDemand(slug, { force });
  const skipOrganic = !force && hasReliableOrganicSearchResults(slug);
  const organic = skipOrganic ? null : await runOrganicSearchCompetitorDiscovery(slug);
  return {
    demand,
    organic,
    organicSkipped: skipOrganic,
    view: buildLocalSearchIntelligenceView(slug),
  };
}
