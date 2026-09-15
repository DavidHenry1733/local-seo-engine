/**
 * Shared evidence-quality assessment for Website Business Intelligence import.
 * Distinguishes technical crawl completion from evidence safe for Business Profile Review.
 */
import type { WebsiteImportFieldValue } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import { validateWebsitePhoneCandidate } from "./growthEngineWebsitePhoneValidation.ts";

export interface WebsiteEvidenceQualityAssessment {
  technicallyComplete: boolean;
  safeForBusinessProfileReview: boolean;
  blockers: string[];
  warnings: string[];
  contentPagesAnalysed: number;
  sitemapDocumentsExcluded: number;
  assessedAt: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

export function assessWebsiteImportEvidenceQuality(input: {
  pages: WebsitePageInventoryItem[];
  businessName: WebsiteImportFieldValue | null | undefined;
  phone: WebsiteImportFieldValue | null | undefined;
  tenantIsolationPassed?: boolean;
  skippedNonContentUrls?: string[];
  homepageHtml?: string;
}): WebsiteEvidenceQualityAssessment {
  const blockers: string[] = [];
  const warnings: string[] = [];
  const contentPages = (input.pages || []).filter((p) => p.isContentPage !== false && (p.fetchStatus || "ok") === "ok");
  const contentPagesAnalysed = contentPages.length;
  const sitemapDocumentsExcluded = (input.skippedNonContentUrls || []).filter((u) => /sitemap|\.xml/i.test(u)).length;

  const technicallyComplete = contentPagesAnalysed >= 1 && Boolean(str(input.homepageHtml) || contentPagesAnalysed > 0);

  if (contentPagesAnalysed < 1) {
    blockers.push("No meaningful HTML content pages were analysed.");
  }

  const phoneSelected = str(input.phone?.selected);
  if (phoneSelected) {
    const phoneCheck = validateWebsitePhoneCandidate(phoneSelected);
    if (!phoneCheck.valid) {
      blockers.push(`Invalid confirmed website phone evidence: "${phoneSelected}" (${phoneCheck.reason}).`);
    } else if ((input.phone?.confidence ?? 0) >= 70 && input.phone?.evidence?.detectionMethod === "profile-fallback") {
      blockers.push("Website phone evidence provenance contradiction: profile fallback presented as website import.");
    }
  }

  const nameSelected = str(input.businessName?.selected);
  const nameConfidence = input.businessName?.confidence ?? 0;
  if (nameSelected && nameConfidence >= 70) {
    const methods = str(input.businessName?.evidence?.detectionMethod);
    const weakOnly = /^(og:site_name|page-title|h1|brand-importer)$/i.test(methods);
    const reasoning = str(input.businessName?.selectionReasoning);
    if (weakOnly || /tagline=true/i.test(reasoning)) {
      blockers.push(`Unreliable high-confidence business identity: "${nameSelected}".`);
    }
  }

  // Provenance contradiction: website field filled only from admin-baseline / profile methods
  if (phoneSelected && /admin-baseline|profile/i.test(str(input.phone?.evidence?.detectionMethod))) {
    blockers.push("Website phone evidence provenance contradiction: non-website source selected as website import evidence.");
  }
  if (nameSelected && /admin-baseline|profile/i.test(str(input.businessName?.evidence?.detectionMethod))) {
    warnings.push("Business name selected from baseline/profile provenance — treat as reconciliation only.");
  }

  if (input.tenantIsolationPassed === false) {
    blockers.push("Tenant isolation failure.");
  }

  if (contentPagesAnalysed === 1) {
    warnings.push("Only one HTML content page was analysed — identity/contact corroboration may be weak.");
  }

  const safeForBusinessProfileReview = technicallyComplete && blockers.length === 0;

  return {
    technicallyComplete,
    safeForBusinessProfileReview,
    blockers,
    warnings,
    contentPagesAnalysed,
    sitemapDocumentsExcluded,
    assessedAt: new Date().toISOString(),
  };
}
