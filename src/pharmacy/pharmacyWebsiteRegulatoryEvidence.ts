/**
 * Regulatory identifier extraction from imported website evidence.
 * Detected values are candidates until confirmed against canonical Business Profile.
 */
import * as cheerio from "cheerio";

export type WebsiteRegulatoryEvidenceType = "gphc-premises" | "gphc-superintendent" | "other";

export type WebsiteRegulatoryVerificationStatus =
  | "detected"
  | "customer-confirmation-required"
  | "confirmed"
  | "rejected"
  | "mismatch";

export interface WebsiteRegulatoryEvidence {
  type: WebsiteRegulatoryEvidenceType;
  detectedValue: string;
  sourceUrl: string;
  sourceSelector: string;
  sourceContext: string;
  extractionMethod: string;
  confidence: number;
  importedAt: string;
  verificationStatus: WebsiteRegulatoryVerificationStatus;
}

const GPHC_PREMISES_RE =
  /GPhC\s*(?:registration|register(?:ed)?|premises)?\s*(?:number|no\.?|#)?\s*:?\s*(\d{5,7})/i;

export function isValidGphcPremisesNumber(value: string): boolean {
  return /^\d{5,7}$/.test(String(value || "").trim());
}

export function extractGphcPremisesFromText(text: string): string {
  const match = String(text || "").match(GPHC_PREMISES_RE);
  return match?.[1]?.trim() || "";
}

export function extractWebsiteRegulatoryEvidence(
  html: string,
  sourceUrl: string,
  importedAt = new Date().toISOString(),
): WebsiteRegulatoryEvidence[] {
  if (!html.trim()) return [];
  const $ = cheerio.load(html);
  const out: WebsiteRegulatoryEvidence[] = [];
  const seen = new Set<string>();

  $("footer, .footer, .default-footer, .site-footer, body").each((_, el) => {
    const text = $(el).text().replace(/\s+/g, " ").trim();
    const value = extractGphcPremisesFromText(text);
    if (!value || seen.has(value)) return;
    seen.add(value);
    out.push({
      type: "gphc-premises",
      detectedValue: value,
      sourceUrl,
      sourceSelector: "footer",
      sourceContext: text.slice(0, 240),
      extractionMethod: "footer-text-pattern",
      confidence: 92,
      importedAt,
      verificationStatus: "customer-confirmation-required",
    });
  });

  return out;
}

export interface RegulatoryCandidateResolution {
  candidate: WebsiteRegulatoryEvidence | null;
  canonicalValue: string;
  confirmationRequired: boolean;
  canonicalUpdated: boolean;
  verificationStatus: WebsiteRegulatoryVerificationStatus;
}

/** Compare detected regulatory evidence with canonical profile — never auto-write unverified values. */
export function resolveGphcRegulatoryCandidate(
  evidence: WebsiteRegulatoryEvidence[] | undefined,
  canonicalGphcNumber: string,
  alternateConfirmedSources: string[] = [],
): RegulatoryCandidateResolution {
  const candidate = (evidence || []).find(
    (item) => item.type === "gphc-premises" && isValidGphcPremisesNumber(item.detectedValue),
  );
  const canonical = String(canonicalGphcNumber || "").trim();
  const confirmedAlternate = alternateConfirmedSources.map((v) => String(v || "").trim()).find(isValidGphcPremisesNumber);

  if (canonical && candidate && canonical !== candidate.detectedValue) {
    return {
      candidate,
      canonicalValue: canonical,
      confirmationRequired: true,
      canonicalUpdated: false,
      verificationStatus: "mismatch",
    };
  }

  if (canonical) {
    return {
      candidate: candidate || null,
      canonicalValue: canonical,
      confirmationRequired: false,
      canonicalUpdated: false,
      verificationStatus: "confirmed",
    };
  }

  if (confirmedAlternate) {
    return {
      candidate: candidate || null,
      canonicalValue: confirmedAlternate,
      confirmationRequired: false,
      canonicalUpdated: true,
      verificationStatus: "confirmed",
    };
  }

  if (candidate) {
    return {
      candidate,
      canonicalValue: "",
      confirmationRequired: true,
      canonicalUpdated: false,
      verificationStatus: "customer-confirmation-required",
    };
  }

  return {
    candidate: null,
    canonicalValue: "",
    confirmationRequired: false,
    canonicalUpdated: false,
    verificationStatus: "detected",
  };
}
