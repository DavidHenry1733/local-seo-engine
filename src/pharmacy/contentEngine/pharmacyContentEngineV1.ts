/**
 * Content Engine V1 LOCKED — CPR-PLATFORM-RECOVERY-02
 * Sole production content architecture. Extend only; do not replace or fork.
 */
import { finalizeLocalClusterPageContent, scrubPublicLocalEngineTerms } from "../pharmacyLocalClusterCompositionDedupe.ts";
import { resolveCommercialSectionPlanV1, COMMERCIAL_NARRATIVE_SEQUENCE_V1 } from "./pharmacyCommercialSectionPlannerV1.ts";

export const CONTENT_ENGINE_V1_STATUS = "LOCKED" as const;
export const NARRATIVE_ENGINE_V1_STATUS = "LOCKED" as const;
export const RENDERER_V1_STATUS = "LOCKED" as const;

export const CONTENT_ENGINE_V1 = {
  status: CONTENT_ENGINE_V1_STATUS,
  lockedAt: "2026-08-04",
  recovery: "CPR-PLATFORM-RECOVERY-02",
  serviceBuilder: {
    module: "pharmacyVisualExperienceLayoutV3.ts",
    entry: "buildPharmacyServicePageMainHtml",
    orchestrator: "generateContentPackage → ensureServiceMasterPublish → buildVisualExperiencePage → buildVisualServicePageMainHtml",
  },
  clusterBuilder: {
    module: "pharmacyLocalLocationGenerationService.ts",
    entry: "generateLocalLocationHierarchyPages",
    content: "buildLocalClusterHubPageContent → composeCommercialClusterNarrativeV1 → verified evidence + allocator → service variant pack or Pharmacy First locality narrative",
    renderer: "renderLocalClusterLocationPageHtml (local-cluster-v1)",
  },
  narrativePlanner: {
    module: "pharmacyCommercialNarrativeEngineV1.ts",
    service: "servicePageHeroIntro / servicePageProcessIntro / preferredServicePageCta / servicePageFaqEntries",
    cluster: "composeCommercialClusterNarrativeV1",
    sequence: COMMERCIAL_NARRATIVE_SEQUENCE_V1,
  },
  sectionPlanner: {
    module: "pharmacyCommercialSectionPlannerV1.ts",
    entry: "resolveCommercialSectionPlanV1",
  },
  localityEngine: {
    module: "pharmacyLocalityEngineV1.ts",
    stack: [
      "pharmacyLocalAreaResolver.ts",
      "pharmacyLocalMarketSnapshot.ts",
      "pharmacyLocalClusterIntelligence.ts",
      "pharmacyLocalMarketIntelligencePhrases.ts",
    ],
  },
  evidenceEngine: {
    service: "pharmacyServicePageIntelligence.ts",
    cluster: "applyClusterIntelligence",
  },
  duplicateDetection: {
    module: "pharmacyLocalClusterCompositionDedupe.ts",
    entry: "finalizeLocalClusterPageContent",
    publicScrub: "scrubPublicLocalEngineTerms",
  },
  renderer: {
    service: "buildPharmacyServicePageMainHtml",
    cluster: "renderLocalClusterLocationPageHtml",
  },
  quarantinedLegacy: [
    "pharmacyServiceAreaPageGenerator.ts",
    "pharmacyLocalNarrativeEngine.ts",
    "pharmacyLocalWeavingV2.ts",
    "pharmacyLocalEntitySectionEngine.ts",
    "pharmacyAreaNarrativeIntelligence.ts",
    "pharmacyFirstPageSections.ts",
    "pharmacyFirstPageRecovery.ts",
    "pharmacyFirstLocalPagePolish.ts",
    "rc1ClusterPageOutputCorrectionService.ts",
    "pharmacyLocalLocationHubRenderer.renderLocalLocationClusterPage",
  ],
} as const;

export function assertContentEngineV1Locked(): void {
  if (CONTENT_ENGINE_V1.status !== "LOCKED") {
    throw new Error("Content Engine V1 is not locked");
  }
}

export function finalizeCommercialContentV1<T extends Parameters<typeof finalizeLocalClusterPageContent>[0]>(
  content: T,
): T {
  return finalizeLocalClusterPageContent(content) as T;
}

export function scrubPublicContentEngineTermsV1(text: string): string {
  return scrubPublicLocalEngineTerms(text);
}

export { resolveCommercialSectionPlanV1, COMMERCIAL_NARRATIVE_SEQUENCE_V1 };
