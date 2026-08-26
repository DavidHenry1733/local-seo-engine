/**
 * Narrative Engine V1 — single commercial narrative surface for service + cluster.
 *
 * Service narrative slots: pharmacyServicePageIntelligence (re-exported here).
 * Cluster narrative: composeCommercialClusterNarrativeV1 in pharmacyLocalClusterContentEngine.ts
 * Both share COMMERCIAL_NARRATIVE_SEQUENCE_V1 via the section planner.
 */
export type { CommercialPagePurpose } from "./pharmacyCommercialSectionPlannerV1.ts";
export {
  COMMERCIAL_NARRATIVE_SEQUENCE_V1,
  commercialNarrativeSequenceV1,
  resolveCommercialSectionPlanV1,
  SERVICE_PAGE_SECTION_PLAN_V1,
} from "./pharmacyCommercialSectionPlannerV1.ts";

export {
  appendExtrasToParagraph,
  preferredServicePageCta,
  servicePageDefinitionExtras,
  servicePageFaqEntries,
  servicePageFinalCtaBody,
  servicePageHeroEyebrow,
  servicePageHeroIntro,
  servicePageLocalExtras,
  servicePageProcessIntro,
  servicePageSupportExtras,
  servicePageTrustProseExtras,
} from "../pharmacyServicePageIntelligence.ts";
