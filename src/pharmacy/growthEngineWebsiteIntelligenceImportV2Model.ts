/**
 * Website Intelligence Import V2 — setup import snapshot model (Step 1 only).
 */
import type { WebsitePageInventoryItem } from "./growthEngineWebsiteIntelligenceModel.ts";
import {
  normalizeWebsiteDesignEvidence,
  type WebsiteDesignEvidence,
} from "./growthEngineWebsiteDesignEvidenceModel.ts";

export const WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION = 2;

export interface WebsiteImportEvidence {
  sourceUrl: string;
  confidence: number;
  detectionMethod: string;
  detectedAt: string;
}

export interface WebsiteImportFieldCandidate {
  value: string;
  confidence: number;
  sourceUrl: string;
  detectionMethod: string;
}

export interface WebsiteImportFieldValue {
  selected: string;
  confidence: number;
  candidates: WebsiteImportFieldCandidate[];
  evidence: WebsiteImportEvidence | null;
  /** Why this candidate was selected (identity/contact provenance). */
  selectionReasoning?: string;
  /** Raw candidates rejected by validation (e.g. malformed phones). */
  rejectedCandidates?: Array<{ value: string; reason: string; sourceUrl?: string; detectionMethod?: string }>;
}

export interface WebsiteAddressCandidate {
  addressLine1: string;
  addressLine2: string;
  town: string;
  postcode: string;
  sourceUrl: string;
  sourceType: "schema" | "microdata" | "contact-page" | "footer" | "about-page";
  matchedSnippet: string;
  confidence: number;
}

export interface WebsiteIntelligenceIdentityV2 {
  websiteUrl: string;
  resolvedUrl: string;
  title: string;
  metaDescription: string;
  faviconUrl: string;
  logoUrl: string;
  brandPrimaryColor: string;
  brandSecondaryColor: string;
  brandAccentColor: string;
  brandBackgroundColor: string;
  brandTextColor: string;
  cmsDetected: string;
  analyticsDetected: string[];
  facebookPixelDetected: boolean;
  cookiePlatform: string;
}

export interface WebsiteIntelligenceBusinessV2 {
  businessName: WebsiteImportFieldValue;
  phone: WebsiteImportFieldValue;
  email: WebsiteImportFieldValue;
  address: WebsiteImportFieldValue;
  town: WebsiteImportFieldValue;
  postcode: WebsiteImportFieldValue;
  addressCandidates: WebsiteAddressCandidate[];
  openingHours: WebsiteImportFieldValue;
  emergencyNumber: WebsiteImportFieldValue;
  nhsLinks: string[];
  googleMapsLink: WebsiteImportFieldValue;
}

export interface WebsiteIntelligenceStructureV2 {
  totalPages: number;
  servicePages: number;
  blogArticles: number;
  guides: number;
  faqPages: number;
  newsPages: number;
  policyPages: number;
  contactPages: number;
  aboutPages: number;
  landingPages: number;
  sitemapFound: boolean;
  robotsTxtFound: boolean;
  pages: WebsitePageInventoryItem[];
}

export interface WebsiteIntelligenceServiceContentV2 {
  approximateWordCount: number;
  imageCount: number;
  hasFaqSection: boolean;
  internalLinkCount: number;
  hasCallToAction: boolean;
  bookingLink: string;
  hasNhsReferences: boolean;
  lastUpdated: string;
}

export interface WebsiteIntelligenceServiceV2 {
  serviceId: string;
  serviceName: string;
  exists: boolean;
  url: string;
  contentQualityEstimate: "Strong" | "Good" | "Needs improvement" | "Unknown";
  content: WebsiteIntelligenceServiceContentV2;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceSeoSnapshotV2 {
  pagesIndexedEstimate: number | null;
  pagesWithEnoughContent: number;
  pagesNeedingImprovement: number;
  missingServicePages: string[];
  missingGuides: number;
  missingFaqs: number;
  overallCompletenessPercent: number;
  summaryLines: string[];
}

export interface WebsiteIntelligenceCustomerSummaryV2 {
  alreadyHas: string[];
  missing: string[];
  competitorNote: string;
}

export interface WebsiteIntelligenceEvidenceQualityV2 {
  technicallyComplete: boolean;
  safeForBusinessProfileReview: boolean;
  blockers: string[];
  warnings: string[];
  contentPagesAnalysed: number;
  sitemapDocumentsExcluded: number;
  assessedAt: string;
}

export interface WebsiteIntelligenceCommercialServiceEvidenceV2 {
  serviceId: string;
  serviceName: string;
  sourceUrl: string;
  pageTitle: string;
  h1: string;
  description: string;
  ctaEvidence: string;
  valueProposition: string;
  detectionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceAudienceEvidenceV2 {
  value: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  matchedSnippet: string;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligencePricingEvidenceV2 {
  kind: "price" | "package" | "discount" | "qualifier";
  value: string;
  label: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  matchedSnippet: string;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceOfferEvidenceV2 {
  offerId: string;
  offerName: string;
  offerType: "programme" | "offer" | "free_audit" | "discount" | "other";
  description: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceCtaEvidenceV2 {
  ctaText: string;
  sourceUrl: string;
  associatedPageTitle: string;
  associatedCategory: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceTrustEvidenceV2 {
  kind:
    | "about_description"
    | "founder"
    | "experience"
    | "credential"
    | "testimonial"
    | "case_study"
    | "guarantee"
    | "proof_point"
    | "trust_statement";
  value: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceSocialProfileEvidenceV2 {
  platform: "facebook" | "instagram" | "linkedin" | "x" | "youtube" | "other";
  url: string;
  sourceUrl: string;
  extractionMethod: string;
  confidence: number;
  evidence: WebsiteImportEvidence;
}

export interface WebsiteIntelligenceBusinessClassificationV2 {
  class: string;
  clinicalServiceDetectionEnabled: boolean;
  confidence: number;
  signals: string[];
  reasoning: string;
}

export interface WebsiteIntelligenceImportV2 {
  version: typeof WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION;
  importedAt: string;
  identity: WebsiteIntelligenceIdentityV2;
  business: WebsiteIntelligenceBusinessV2;
  structure: WebsiteIntelligenceStructureV2;
  services: WebsiteIntelligenceServiceV2[];
  /** Website-discovered commercial services (evidence only — not canonical library). */
  commercialServiceEvidence?: WebsiteIntelligenceCommercialServiceEvidenceV2[];
  /** Explicit target/customer audience statements from website evidence. */
  audienceEvidence?: WebsiteIntelligenceAudienceEvidenceV2[];
  /** Structured pricing/package/discount signals from commercial pages. */
  commercialPricingEvidence?: WebsiteIntelligencePricingEvidenceV2[];
  /** Offers/programmes (e.g. Founder Partner) — not core services. */
  commercialOfferEvidence?: WebsiteIntelligenceOfferEvidenceV2[];
  /** Structured CTA evidence across commercial pages. */
  ctaEvidence?: WebsiteIntelligenceCtaEvidenceV2[];
  /** About/trust/proof evidence. */
  trustEvidence?: WebsiteIntelligenceTrustEvidenceV2[];
  /** Canonical business social profiles with provenance. */
  socialProfileEvidence?: WebsiteIntelligenceSocialProfileEvidenceV2[];
  businessClassification?: WebsiteIntelligenceBusinessClassificationV2;
  evidenceQuality?: WebsiteIntelligenceEvidenceQualityV2;
  seoSnapshot: WebsiteIntelligenceSeoSnapshotV2;
  customerSummary: WebsiteIntelligenceCustomerSummaryV2;
  evidence: WebsiteImportEvidence[];
  /** Full-fidelity browser design capture (RC1-C07). */
  designEvidence?: WebsiteDesignEvidence | null;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function bool(v: unknown): boolean {
  return v === true || v === "true" || v === 1;
}

function normalizeFieldValue(raw: unknown): WebsiteImportFieldValue {
  const empty: WebsiteImportFieldValue = {
    selected: "",
    confidence: 0,
    candidates: [],
    evidence: null,
  };
  if (!raw || typeof raw !== "object") return empty;
  const item = raw as Record<string, unknown>;
  const candidates = Array.isArray(item.candidates)
    ? item.candidates.map((c) => {
        const row = c as Record<string, unknown>;
        return {
          value: str(row.value),
          confidence: num(row.confidence),
          sourceUrl: str(row.sourceUrl),
          detectionMethod: str(row.detectionMethod),
        };
      })
    : [];
  const evidenceRaw = item.evidence;
  let evidence: WebsiteImportEvidence | null = null;
  if (evidenceRaw && typeof evidenceRaw === "object") {
    const e = evidenceRaw as Record<string, unknown>;
    evidence = {
      sourceUrl: str(e.sourceUrl),
      confidence: num(e.confidence),
      detectionMethod: str(e.detectionMethod),
      detectedAt: str(e.detectedAt),
    };
  }
  const rejectedCandidates = Array.isArray(item.rejectedCandidates)
    ? item.rejectedCandidates.map((r) => {
        const row = r as Record<string, unknown>;
        return {
          value: str(row.value),
          reason: str(row.reason),
          sourceUrl: str(row.sourceUrl) || undefined,
          detectionMethod: str(row.detectionMethod) || undefined,
        };
      })
    : undefined;

  return {
    selected: str(item.selected),
    confidence: num(item.confidence),
    candidates,
    evidence,
    selectionReasoning: str(item.selectionReasoning) || undefined,
    rejectedCandidates,
  };
}

function normalizeAddressCandidates(raw: unknown): WebsiteAddressCandidate[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((c) => {
      const row = c as Record<string, unknown>;
      const sourceType = str(row.sourceType);
      if (!["schema", "microdata", "contact-page", "footer", "about-page"].includes(sourceType)) return null;
      return {
        addressLine1: str(row.addressLine1),
        addressLine2: str(row.addressLine2),
        town: str(row.town),
        postcode: str(row.postcode).toUpperCase(),
        sourceUrl: str(row.sourceUrl),
        sourceType: sourceType as WebsiteAddressCandidate["sourceType"],
        matchedSnippet: str(row.matchedSnippet),
        confidence: num(row.confidence),
      };
    })
    .filter((c): c is WebsiteAddressCandidate => Boolean(c && c.addressLine1 && c.town && c.postcode));
}

export function normalizeWebsiteIntelligenceImportV2(raw: unknown): WebsiteIntelligenceImportV2 | null {
  if (!raw || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  if (Number(item.version) !== WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION) return null;

  const identityRaw = (item.identity || {}) as Record<string, unknown>;
  const structureRaw = (item.structure || {}) as Record<string, unknown>;
  const businessRaw = (item.business || {}) as Record<string, unknown>;
  const seoRaw = (item.seoSnapshot || {}) as Record<string, unknown>;
  const summaryRaw = (item.customerSummary || {}) as Record<string, unknown>;

  const services = Array.isArray(item.services)
    ? item.services.map((s) => {
        const row = s as Record<string, unknown>;
        const content = (row.content || {}) as Record<string, unknown>;
        const evidence = (row.evidence || {}) as Record<string, unknown>;
        const quality = str(row.contentQualityEstimate);
        return {
          serviceId: str(row.serviceId),
          serviceName: str(row.serviceName),
          exists: bool(row.exists),
          url: str(row.url),
          contentQualityEstimate:
            quality === "Strong" || quality === "Good" || quality === "Needs improvement"
              ? quality
              : ("Unknown" as const),
          content: {
            approximateWordCount: num(content.approximateWordCount),
            imageCount: num(content.imageCount),
            hasFaqSection: bool(content.hasFaqSection),
            internalLinkCount: num(content.internalLinkCount),
            hasCallToAction: bool(content.hasCallToAction),
            bookingLink: str(content.bookingLink),
            hasNhsReferences: bool(content.hasNhsReferences),
            lastUpdated: str(content.lastUpdated),
          },
          evidence: {
            sourceUrl: str(evidence.sourceUrl),
            confidence: num(evidence.confidence),
            detectionMethod: str(evidence.detectionMethod),
            detectedAt: str(evidence.detectedAt),
          },
        };
      })
    : [];

  const pages = Array.isArray(structureRaw.pages)
    ? (structureRaw.pages as WebsitePageInventoryItem[])
    : [];

  const evidence = Array.isArray(item.evidence)
    ? item.evidence.map((e) => {
        const row = e as Record<string, unknown>;
        return {
          sourceUrl: str(row.sourceUrl),
          confidence: num(row.confidence),
          detectionMethod: str(row.detectionMethod),
          detectedAt: str(row.detectedAt),
        };
      })
    : [];

  return {
    version: WEBSITE_INTELLIGENCE_IMPORT_V2_VERSION,
    importedAt: str(item.importedAt) || new Date().toISOString(),
    identity: {
      websiteUrl: str(identityRaw.websiteUrl),
      resolvedUrl: str(identityRaw.resolvedUrl),
      title: str(identityRaw.title),
      metaDescription: str(identityRaw.metaDescription),
      faviconUrl: str(identityRaw.faviconUrl),
      logoUrl: str(identityRaw.logoUrl),
      brandPrimaryColor: str(identityRaw.brandPrimaryColor),
      brandSecondaryColor: str(identityRaw.brandSecondaryColor),
      brandAccentColor: str(identityRaw.brandAccentColor),
      brandBackgroundColor: str(identityRaw.brandBackgroundColor),
      brandTextColor: str(identityRaw.brandTextColor),
      cmsDetected: str(identityRaw.cmsDetected),
      analyticsDetected: Array.isArray(identityRaw.analyticsDetected)
        ? identityRaw.analyticsDetected.map(String).filter(Boolean)
        : [],
      facebookPixelDetected: bool(identityRaw.facebookPixelDetected),
      cookiePlatform: str(identityRaw.cookiePlatform),
    },
    business: {
      businessName: normalizeFieldValue(businessRaw.businessName),
      phone: normalizeFieldValue(businessRaw.phone),
      email: normalizeFieldValue(businessRaw.email),
      address: normalizeFieldValue(businessRaw.address),
      town: normalizeFieldValue(businessRaw.town),
      postcode: normalizeFieldValue(businessRaw.postcode),
      addressCandidates: normalizeAddressCandidates(businessRaw.addressCandidates),
      openingHours: normalizeFieldValue(businessRaw.openingHours),
      emergencyNumber: normalizeFieldValue(businessRaw.emergencyNumber),
      nhsLinks: Array.isArray(businessRaw.nhsLinks) ? businessRaw.nhsLinks.map(String).filter(Boolean) : [],
      googleMapsLink: normalizeFieldValue(businessRaw.googleMapsLink),
    },
    structure: {
      totalPages: num(structureRaw.totalPages),
      servicePages: num(structureRaw.servicePages),
      blogArticles: num(structureRaw.blogArticles),
      guides: num(structureRaw.guides),
      faqPages: num(structureRaw.faqPages),
      newsPages: num(structureRaw.newsPages),
      policyPages: num(structureRaw.policyPages),
      contactPages: num(structureRaw.contactPages),
      aboutPages: num(structureRaw.aboutPages),
      landingPages: num(structureRaw.landingPages),
      sitemapFound: bool(structureRaw.sitemapFound),
      robotsTxtFound: bool(structureRaw.robotsTxtFound),
      pages,
    },
    services,
    commercialServiceEvidence: Array.isArray(item.commercialServiceEvidence)
      ? item.commercialServiceEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          return {
            serviceId: str(row.serviceId),
            serviceName: str(row.serviceName),
            sourceUrl: str(row.sourceUrl),
            pageTitle: str(row.pageTitle),
            h1: str(row.h1),
            description: str(row.description),
            ctaEvidence: str(row.ctaEvidence),
            valueProposition: str(row.valueProposition),
            detectionMethod: str(row.detectionMethod),
            confidence: num(row.confidence),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || "commercial-service-page",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    audienceEvidence: Array.isArray(item.audienceEvidence)
      ? item.audienceEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          return {
            value: str(row.value),
            sourceUrl: str(row.sourceUrl),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            matchedSnippet: str(row.matchedSnippet),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "audience",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    commercialPricingEvidence: Array.isArray(item.commercialPricingEvidence)
      ? item.commercialPricingEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          const kind = str(row.kind);
          return {
            kind:
              kind === "price" || kind === "package" || kind === "discount" || kind === "qualifier"
                ? kind
                : ("package" as const),
            value: str(row.value),
            label: str(row.label),
            sourceUrl: str(row.sourceUrl),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            matchedSnippet: str(row.matchedSnippet),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "pricing",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    commercialOfferEvidence: Array.isArray(item.commercialOfferEvidence)
      ? item.commercialOfferEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          const offerType = str(row.offerType);
          return {
            offerId: str(row.offerId),
            offerName: str(row.offerName),
            offerType:
              offerType === "programme"
              || offerType === "offer"
              || offerType === "free_audit"
              || offerType === "discount"
              || offerType === "other"
                ? offerType
                : ("offer" as const),
            description: str(row.description),
            sourceUrl: str(row.sourceUrl),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "offer",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    ctaEvidence: Array.isArray(item.ctaEvidence)
      ? item.ctaEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          return {
            ctaText: str(row.ctaText),
            sourceUrl: str(row.sourceUrl),
            associatedPageTitle: str(row.associatedPageTitle),
            associatedCategory: str(row.associatedCategory),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "cta",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    trustEvidence: Array.isArray(item.trustEvidence)
      ? item.trustEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          return {
            kind: str(row.kind) as WebsiteIntelligenceTrustEvidenceV2["kind"],
            value: str(row.value),
            sourceUrl: str(row.sourceUrl),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "trust",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    socialProfileEvidence: Array.isArray(item.socialProfileEvidence)
      ? item.socialProfileEvidence.map((raw) => {
          const row = raw as Record<string, unknown>;
          const ev = (row.evidence || {}) as Record<string, unknown>;
          const platform = str(row.platform);
          return {
            platform:
              platform === "facebook"
              || platform === "instagram"
              || platform === "linkedin"
              || platform === "x"
              || platform === "youtube"
              || platform === "other"
                ? platform
                : ("other" as const),
            url: str(row.url),
            sourceUrl: str(row.sourceUrl),
            extractionMethod: str(row.extractionMethod),
            confidence: num(row.confidence),
            evidence: {
              sourceUrl: str(ev.sourceUrl) || str(row.sourceUrl),
              confidence: num(ev.confidence, num(row.confidence)),
              detectionMethod: str(ev.detectionMethod) || str(row.extractionMethod) || "social",
              detectedAt: str(ev.detectedAt) || str(item.importedAt),
            },
          };
        })
      : [],
    businessClassification: item.businessClassification && typeof item.businessClassification === "object"
      ? {
          class: str((item.businessClassification as Record<string, unknown>).class),
          clinicalServiceDetectionEnabled: bool(
            (item.businessClassification as Record<string, unknown>).clinicalServiceDetectionEnabled,
          ),
          confidence: num((item.businessClassification as Record<string, unknown>).confidence),
          signals: Array.isArray((item.businessClassification as Record<string, unknown>).signals)
            ? ((item.businessClassification as Record<string, unknown>).signals as unknown[]).map(String)
            : [],
          reasoning: str((item.businessClassification as Record<string, unknown>).reasoning),
        }
      : undefined,
    evidenceQuality: item.evidenceQuality && typeof item.evidenceQuality === "object"
      ? {
          technicallyComplete: bool((item.evidenceQuality as Record<string, unknown>).technicallyComplete),
          safeForBusinessProfileReview: bool(
            (item.evidenceQuality as Record<string, unknown>).safeForBusinessProfileReview,
          ),
          blockers: Array.isArray((item.evidenceQuality as Record<string, unknown>).blockers)
            ? ((item.evidenceQuality as Record<string, unknown>).blockers as unknown[]).map(String)
            : [],
          warnings: Array.isArray((item.evidenceQuality as Record<string, unknown>).warnings)
            ? ((item.evidenceQuality as Record<string, unknown>).warnings as unknown[]).map(String)
            : [],
          contentPagesAnalysed: num((item.evidenceQuality as Record<string, unknown>).contentPagesAnalysed),
          sitemapDocumentsExcluded: num(
            (item.evidenceQuality as Record<string, unknown>).sitemapDocumentsExcluded,
          ),
          assessedAt: str((item.evidenceQuality as Record<string, unknown>).assessedAt) || str(item.importedAt),
        }
      : undefined,
    seoSnapshot: {
      pagesIndexedEstimate:
        seoRaw.pagesIndexedEstimate == null || seoRaw.pagesIndexedEstimate === ""
          ? null
          : num(seoRaw.pagesIndexedEstimate),
      pagesWithEnoughContent: num(seoRaw.pagesWithEnoughContent),
      pagesNeedingImprovement: num(seoRaw.pagesNeedingImprovement),
      missingServicePages: Array.isArray(seoRaw.missingServicePages)
        ? seoRaw.missingServicePages.map(String).filter(Boolean)
        : [],
      missingGuides: num(seoRaw.missingGuides),
      missingFaqs: num(seoRaw.missingFaqs),
      overallCompletenessPercent: num(seoRaw.overallCompletenessPercent),
      summaryLines: Array.isArray(seoRaw.summaryLines) ? seoRaw.summaryLines.map(String).filter(Boolean) : [],
    },
    customerSummary: {
      alreadyHas: Array.isArray(summaryRaw.alreadyHas) ? summaryRaw.alreadyHas.map(String).filter(Boolean) : [],
      missing: Array.isArray(summaryRaw.missing) ? summaryRaw.missing.map(String).filter(Boolean) : [],
      competitorNote: str(summaryRaw.competitorNote),
    },
    evidence,
    designEvidence: normalizeWebsiteDesignEvidence(item.designEvidence),
  };
}
