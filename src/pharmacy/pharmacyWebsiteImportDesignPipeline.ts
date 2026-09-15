/**
 * Post-import design pipeline — Brand DNA, Component DNA, image assignments.
 */
import type { WebsiteIntelligenceImportV2 } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { extractBrandDnaFromWebsiteEvidence } from "./pharmacyBrandDnaWebsiteExtraction.ts";
import { applyDesignEvidenceToBrandDna, applyDesignEvidenceToComponentDna } from "./pharmacyDesignEvidenceApplication.ts";
import { persistComponentDnaFromBrandEvidence } from "./masterAdminComponentDnaPersistenceService.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";
import { seedImageAssignmentsFromDesignImport } from "./pharmacyWebsiteImportImageAssignments.ts";
import { assessDesignImportFallbacks } from "./pharmacyWebsiteImportDesignFallbackPolicy.ts";
import { validateBrandDnaColours } from "./pharmacyBrandDnaExtractor.ts";
import { freezeBrandDna } from "./pharmacyBrandDnaStore.ts";
import { safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import { completeWebsiteImportBrandEvidence } from "./pharmacyWebsiteImportBrandEvidenceCompletionService.ts";

export interface WebsiteImportDesignPipelineResult {
  slug: string;
  designEvidenceLoaded: boolean;
  brandDnaFrozen: boolean;
  componentDnaPersisted: boolean;
  imageAssignmentsUpdated: boolean;
  imageSlots: string[];
  fallbackAssessment: ReturnType<typeof assessDesignImportFallbacks>;
  blocked: boolean;
}

function resolveDesignEvidence(
  intelligence: WebsiteIntelligenceImportV2 | null | undefined,
  slug: string,
): WebsiteDesignEvidence | null {
  return intelligence?.designEvidence || loadWebsiteDesignEvidence(slug);
}

export async function applyWebsiteImportDesignPipeline(
  rawSlug: string,
  intelligence?: WebsiteIntelligenceImportV2 | null,
): Promise<WebsiteImportDesignPipelineResult> {
  const slug = safePharmacySlug(rawSlug);
  const designEvidence = resolveDesignEvidence(intelligence, slug);
  const fallbackAssessment = assessDesignImportFallbacks(designEvidence);

  let brandDnaFrozen = false;
  let componentDnaPersisted = false;
  let imageAssignmentsUpdated = false;
  let imageSlots: string[] = [];

  const extracted = await extractBrandDnaFromWebsiteEvidence(slug);
  if (extracted?.dna) {
    const dna = designEvidence
      ? applyDesignEvidenceToBrandDna(extracted.dna, designEvidence)
      : extracted.dna;
    freezeBrandDna(slug, validateBrandDnaColours({ ...dna, frozenAt: new Date().toISOString() }));
    brandDnaFrozen = true;

    if (designEvidence) {
      const componentDna = applyDesignEvidenceToComponentDna(dna, designEvidence);
      const persisted = persistComponentDnaFromBrandEvidence(slug, { force: true });
      componentDnaPersisted = persisted.ok && persisted.persisted;
      void componentDna;
    } else {
      const persisted = persistComponentDnaFromBrandEvidence(slug, { force: true });
      componentDnaPersisted = persisted.ok && persisted.persisted;
    }
  }

  if (designEvidence) {
    const seeded = seedImageAssignmentsFromDesignImport(slug, designEvidence);
    imageAssignmentsUpdated = seeded.updated;
    imageSlots = seeded.assignments;
  }

  completeWebsiteImportBrandEvidence(slug);

  return {
    slug,
    designEvidenceLoaded: Boolean(designEvidence),
    brandDnaFrozen,
    componentDnaPersisted,
    imageAssignmentsUpdated,
    imageSlots,
    fallbackAssessment,
    blocked: fallbackAssessment.blocked,
  };
}
