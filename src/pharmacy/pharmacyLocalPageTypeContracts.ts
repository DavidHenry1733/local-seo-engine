/**
 * Locked local page-type contracts — generic, versioned, tenant-agnostic.
 * Canonical locality production contract: local-cluster-v1 / local-area-v1 (RC1).
 */
export const LOCAL_HUB_CONTRACT_ID = "local-hub-v1";
export const LOCAL_CLUSTER_CONTRACT_ID = "local-cluster-v1";
export const LOCAL_AREA_CONTRACT_ID = "local-area-v1";

export type LocalPageType = "location-hub" | "location-cluster" | "location-area";

export type LocalImageRole = "hero" | "supporting" | "trust" | "conversion";

export interface LocalPageTypeContractSection {
  sectionId: string;
  templateBlock: string;
  componentType: string;
  required: boolean;
  imageRole?: LocalImageRole;
}

export interface LocalPageTypeContract {
  contractId: string;
  pageType: LocalPageType;
  requiredImageRoles: LocalImageRole[];
  sections: LocalPageTypeContractSection[];
}

export const LOCAL_HUB_V1_CONTRACT: LocalPageTypeContract = {
  contractId: LOCAL_HUB_CONTRACT_ID,
  pageType: "location-hub",
  requiredImageRoles: ["hero", "supporting", "trust", "conversion"],
  sections: [
    { sectionId: "breadcrumbs", templateBlock: "breadcrumbs", componentType: "breadcrumb-nav", required: true },
    { sectionId: "hero-section", templateBlock: "hero", componentType: "brand-hero-split", required: true, imageRole: "hero" },
    { sectionId: "hub-service-coverage", templateBlock: "service-definition", componentType: "media-text", required: true },
    { sectionId: "areas-we-support", templateBlock: "areas-we-support", componentType: "homepage-areas-we-support", required: true },
    { sectionId: "local-relevance", templateBlock: "local-relevance", componentType: "media-text", required: true, imageRole: "supporting" },
    { sectionId: "hub-trust", templateBlock: "trust-split", componentType: "trust-split", required: true, imageRole: "trust" },
    { sectionId: "local-access", templateBlock: "local", componentType: "split-map-details", required: true },
    { sectionId: "faq-section", templateBlock: "faq", componentType: "faq-cards", required: true },
    { sectionId: "conversion-image", templateBlock: "conversion-image", componentType: "full-width-conversion", required: true, imageRole: "conversion" },
    { sectionId: "contact", templateBlock: "final-cta", componentType: "cta-band", required: true },
  ],
};

/** Canonical multi-section cluster contract (Local Content Engine V1 / RC1). */
export const LOCAL_CLUSTER_V1_CONTRACT: LocalPageTypeContract = {
  contractId: LOCAL_CLUSTER_CONTRACT_ID,
  pageType: "location-cluster",
  requiredImageRoles: ["hero", "supporting"],
  sections: [
    { sectionId: "breadcrumbs", templateBlock: "breadcrumbs", componentType: "breadcrumb-nav", required: true },
    { sectionId: "hero-section", templateBlock: "hero", componentType: "brand-hero-split", required: true, imageRole: "hero" },
    { sectionId: "cluster-context", templateBlock: "service-definition", componentType: "editorial", required: true },
    { sectionId: "child-areas", templateBlock: "child-areas", componentType: "area-card-grid", required: true },
    { sectionId: "cluster-trust", templateBlock: "trust-split", componentType: "trust-split", required: true, imageRole: "supporting" },
    { sectionId: "local-access", templateBlock: "local", componentType: "split-map-details", required: true },
    { sectionId: "cluster-links", templateBlock: "parent-child-links", componentType: "internal-links", required: true },
    { sectionId: "faq-section", templateBlock: "faq", componentType: "faq-cards", required: true },
    { sectionId: "conversion-image", templateBlock: "conversion-image", componentType: "full-width-conversion", required: false },
    { sectionId: "contact", templateBlock: "final-cta", componentType: "cta-band", required: true },
  ],
};

export const LOCAL_AREA_V1_CONTRACT: LocalPageTypeContract = {
  contractId: LOCAL_AREA_CONTRACT_ID,
  pageType: "location-area",
  requiredImageRoles: ["hero", "supporting", "trust", "conversion"],
  sections: [
    { sectionId: "breadcrumbs", templateBlock: "breadcrumbs", componentType: "breadcrumb-nav", required: true },
    { sectionId: "hero-section", templateBlock: "hero", componentType: "brand-hero-split", required: true, imageRole: "hero" },
    { sectionId: "cluster-context", templateBlock: "service-definition", componentType: "editorial", required: true },
    { sectionId: "cluster-trust", templateBlock: "trust-split", componentType: "trust-split", required: true, imageRole: "trust" },
    { sectionId: "local-access", templateBlock: "local", componentType: "split-map-details", required: true },
    { sectionId: "faq-section", templateBlock: "faq", componentType: "faq-cards", required: true },
    { sectionId: "conversion-image", templateBlock: "conversion-image", componentType: "full-width-conversion", required: true, imageRole: "conversion" },
    { sectionId: "contact", templateBlock: "final-cta", componentType: "cta-band", required: true },
  ],
};

export function resolveLocalPageTypeContract(pageType: LocalPageType): LocalPageTypeContract {
  if (pageType === "location-hub") return LOCAL_HUB_V1_CONTRACT;
  if (pageType === "location-cluster") return LOCAL_CLUSTER_V1_CONTRACT;
  return LOCAL_AREA_V1_CONTRACT;
}

export function contractIdForPageType(pageType: LocalPageType): string {
  return resolveLocalPageTypeContract(pageType).contractId;
}

/** Locked Headingley local-cluster-v1 / patient-journey-led template for Pharmacy First. */
export function usesPharmacyFirstPatientJourneyLocalTemplate(serviceId: string): boolean {
  return String(serviceId || "").trim().toLowerCase() === "pharmacy-first";
}
