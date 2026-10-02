/**
 * Campaign Explorer V1 — browse all supported campaigns while keeping recommendation primary.
 */

import { activeServiceRegistry, isActiveServiceStatus } from "./pharmacyServiceRegistry.ts";

export const CAMPAIGN_EXPLORER_VERSION = 1;

export type CampaignExplorerBadgeType = "existing" | "growth-opportunity" | "nhs" | "private";

export interface CampaignExplorerServiceDef {
  serviceId: string;
  serviceName: string;
  description: string;
  funding: "nhs" | "private";
}

export interface CampaignExplorerItem {
  serviceId: string;
  serviceName: string;
  description: string;
  badgeType: CampaignExplorerBadgeType;
  badgeLabel: string;
  /** True when this catalog row matches a website import detection. */
  detectedOnWebsite?: boolean;
}

export interface CampaignExplorerSection {
  id: string;
  title: string;
  badgeHint?: string;
  lead?: string;
  items: CampaignExplorerItem[];
  hiddenWhenEmpty: boolean;
}

export interface CampaignExplorerCatalog {
  version: number;
  slug: string;
  recommendedServiceId: string;
  recommendedServiceName: string;
  recommendMessage: string;
  controlMessage: string;
  exploreTitle: string;
  exploreSubtitle: string;
  existingOnWebsite: CampaignExplorerItem[];
  growthOpportunities: CampaignExplorerItem[];
  nhsServices: CampaignExplorerItem[];
  privateServices: CampaignExplorerItem[];
  websiteImportServiceCount: number;
  existingOnWebsiteNote: string;
  nhsCatalogNote: string;
  privateCatalogNote: string;
}

export const CE_EXPLORE_TITLE = "Explore Other Campaigns";

export const CE_EXPLORE_SUBTITLE =
  "Your pharmacy can create campaigns for any supported NHS or private pharmacy service.";

export const CE_EXPLORE_DETAIL =
  "Selecting another enabled campaign updates your campaign priority and the preview below.";

export const CE_CURRENTLY_SELECTED = "Currently selected";

export const CE_SELECT_CAMPAIGN = "Select Campaign";

export const CE_BADGE_EXISTING = "Existing Service";

export const CE_BADGE_GROWTH = "Growth Opportunity";

export const CE_BADGE_NHS = "NHS Service";

export const CE_BADGE_PRIVATE = "Private Service";

export const CE_EXISTING_WEBSITE_NOTE = "These are services we found on your website during import.";

export const CE_DETECTED_ON_WEBSITE = "Already detected on your website";

export const CE_NHS_CATALOG_NOTE =
  "Available NHS campaigns — choose any service to preview content. This is not evidence that you currently offer every service.";

export const CE_PRIVATE_CATALOG_NOTE =
  "Available private campaigns — choose any service to preview content. This is not evidence that you currently offer every service.";

/** Campaign dropdowns read the active registry rows only. */
export const CAMPAIGN_EXPLORER_NHS_SERVICES: CampaignExplorerServiceDef[] = activeServiceRegistry()
  .filter((entry) => isActiveServiceStatus(entry.status) && entry.funding === "nhs")
  .map((entry) => ({
    serviceId: entry.id,
    serviceName: entry.name,
    description: entry.description,
    funding: "nhs",
  }));

export const CAMPAIGN_EXPLORER_PRIVATE_SERVICES: CampaignExplorerServiceDef[] = activeServiceRegistry()
  .filter((entry) => isActiveServiceStatus(entry.status) && entry.funding === "private")
  .map((entry) => ({
    serviceId: entry.id,
    serviceName: entry.name,
    description: entry.description,
    funding: "private",
  }));

export const CAMPAIGN_EXPLORER_ALL_SUPPORTED: CampaignExplorerServiceDef[] = [
  ...CAMPAIGN_EXPLORER_NHS_SERVICES,
  ...CAMPAIGN_EXPLORER_PRIVATE_SERVICES,
];
