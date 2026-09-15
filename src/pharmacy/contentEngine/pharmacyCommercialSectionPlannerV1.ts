/**
 * Content Engine V1 — single commercial section planner.
 * Service and cluster share the same commercial sequence; only page purpose differs.
 */
import {
  LOCAL_CLUSTER_V1_CONTRACT,
  type LocalPageTypeContractSection,
} from "../pharmacyLocalPageTypeContracts.ts";

export type CommercialPagePurpose = "service" | "cluster";

/** Locked commercial narrative / section sequence shared by service + cluster pages. */
export const COMMERCIAL_NARRATIVE_SEQUENCE_V1 = [
  "hero",
  "serviceDefinition",
  "localRelevance",
  "process",
  "access",
  "preparation",
  "trust",
  "faq",
  "cta",
] as const;

export type CommercialNarrativeSlotV1 = (typeof COMMERCIAL_NARRATIVE_SEQUENCE_V1)[number];

/** Layout V3 service-page section plan (canonical service section planner). */
export const SERVICE_PAGE_SECTION_PLAN_V1: LocalPageTypeContractSection[] = [
  { sectionId: "hero-section", templateBlock: "hero", componentType: "brand-hero-split", required: true, imageRole: "hero" },
  { sectionId: "service-definition", templateBlock: "service-definition", componentType: "media-text", required: true },
  { sectionId: "local-relevance", templateBlock: "local-relevance", componentType: "media-text", required: true, imageRole: "supporting" },
  { sectionId: "process", templateBlock: "process", componentType: "process-steps", required: true },
  { sectionId: "eligibility", templateBlock: "eligibility", componentType: "card-grid", required: true },
  { sectionId: "trust", templateBlock: "trust-split", componentType: "trust-split", required: true, imageRole: "trust" },
  { sectionId: "local-access", templateBlock: "local", componentType: "split-map-details", required: true },
  { sectionId: "faq-section", templateBlock: "faq", componentType: "faq-cards", required: true },
  { sectionId: "contact", templateBlock: "final-cta", componentType: "cta-band", required: true, imageRole: "conversion" },
];

export function resolveCommercialSectionPlanV1(
  purpose: CommercialPagePurpose,
): LocalPageTypeContractSection[] {
  if (purpose === "cluster") return LOCAL_CLUSTER_V1_CONTRACT.sections;
  return SERVICE_PAGE_SECTION_PLAN_V1;
}

export function commercialNarrativeSequenceV1(): readonly CommercialNarrativeSlotV1[] {
  return COMMERCIAL_NARRATIVE_SEQUENCE_V1;
}
