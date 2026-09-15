/**
 * Campaign Explorer V1 — browse all supported campaigns while keeping recommendation primary.
 */

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

/** Supported NHS pharmacy campaigns available in Campaign Explorer. */
export const CAMPAIGN_EXPLORER_NHS_SERVICES: CampaignExplorerServiceDef[] = [
  { serviceId: "pharmacy-first", serviceName: "Pharmacy First", description: "Help patients access NHS Pharmacy First for common conditions.", funding: "nhs" },
  { serviceId: "blood-pressure-checks", serviceName: "Hypertension Case Finding", description: "Promote NHS blood pressure screening and case-finding in your pharmacy.", funding: "nhs" },
  { serviceId: "repeat-prescriptions", serviceName: "Repeat Prescriptions", description: "Make repeat ordering and EPS nomination clearer for local patients.", funding: "nhs" },
  { serviceId: "prescription-dispensing", serviceName: "Prescription Dispensing", description: "Explain your dispensing service and how patients can collect medicines.", funding: "nhs" },
  { serviceId: "pharmacy-contraception-service", serviceName: "Contraception", description: "Promote NHS Pharmacy Contraception consultations where commissioned.", funding: "nhs" },
  { serviceId: "emergency-contraception", serviceName: "Emergency Contraception", description: "Help patients understand confidential emergency contraception access.", funding: "nhs" },
  { serviceId: "new-medicine-service", serviceName: "New Medicine Service", description: "Support patients starting new long-term medicines with NMS.", funding: "nhs" },
  { serviceId: "discharge-medicines-service", serviceName: "Discharge Medicines Service", description: "Promote support for patients leaving hospital with new medicines.", funding: "nhs" },
  { serviceId: "flu-vaccinations", serviceName: "Flu Vaccinations", description: "Help patients find seasonal flu vaccination at your pharmacy.", funding: "nhs" },
  { serviceId: "covid-vaccinations", serviceName: "Covid Vaccinations", description: "Promote covid vaccination availability and booking information.", funding: "nhs" },
  { serviceId: "smoking-cessation", serviceName: "Smoking Cessation", description: "Support patients looking for stop-smoking help at your pharmacy.", funding: "nhs" },
  { serviceId: "minor-ailments", serviceName: "Minor Ailments", description: "Help patients understand minor ailment advice and treatment options.", funding: "nhs" },
  { serviceId: "medication-reviews", serviceName: "Medication Reviews", description: "Promote structured medicines reviews and pharmacist consultations.", funding: "nhs" },
  { serviceId: "malaria-prevention", serviceName: "Malaria Prevention", description: "Share antimalarial advice where NHS or travel pathways apply.", funding: "nhs" },
];

/** Supported private pharmacy campaigns available in Campaign Explorer. */
export const CAMPAIGN_EXPLORER_PRIVATE_SERVICES: CampaignExplorerServiceDef[] = [
  { serviceId: "travel-vaccinations", serviceName: "Travel Vaccinations", description: "Promote private travel health consultations and vaccinations.", funding: "private" },
  { serviceId: "travel-health-consultations", serviceName: "Travel Health Consultations", description: "Help travellers book private travel health appointments.", funding: "private" },
  { serviceId: "weight-management", serviceName: "Weight Management", description: "Promote private weight management support at your pharmacy.", funding: "private" },
  { serviceId: "vitamin-b12-injections", serviceName: "Vitamin Services", description: "Promote vitamin B12 and related supplement services.", funding: "private" },
  { serviceId: "health-checks", serviceName: "Health Checks", description: "Help patients discover private health screening at your pharmacy.", funding: "private" },
  { serviceId: "ear-wax-removal", serviceName: "Ear Wax Removal", description: "Promote private ear wax removal and microsuction appointments.", funding: "private" },
  { serviceId: "private-prescribing", serviceName: "Private Consultations", description: "Promote private prescribing and consultation services.", funding: "private" },
  { serviceId: "independent-prescriber", serviceName: "Independent Prescriber Clinics", description: "Help patients find private prescriber-led appointments.", funding: "private" },
];

export const CAMPAIGN_EXPLORER_ALL_SUPPORTED: CampaignExplorerServiceDef[] = [
  ...CAMPAIGN_EXPLORER_NHS_SERVICES,
  ...CAMPAIGN_EXPLORER_PRIVATE_SERVICES,
];
