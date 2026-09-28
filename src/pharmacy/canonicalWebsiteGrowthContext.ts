/**
 * Read-only website intelligence for downstream growth.
 * Brand meaning comes only from projectCanonicalWebsiteBrandEvidence.
 * Does not crawl, write, or choose a winner when evidence conflicts.
 */
import { projectCanonicalWebsiteBrandEvidence, type WebsiteBrandEvidence, type WebsiteBrandValue } from "./canonicalWebsiteBrandEvidence.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import {
  designEvidenceHasUsableContent,
  loadWebsiteDesignEvidence,
} from "./pharmacyWebsiteDesignCaptureService.ts";

export type CanonicalEvidenceAvailability = "PRESENT" | "MISSING" | "CONFLICT" | "NOT CAPTURED";

export interface CanonicalWebsitePageRef {
  category: string;
  url: string;
  title: string;
}

export interface CanonicalImportedServiceRef {
  serviceId: string;
  serviceName: string;
  url: string;
  exists: boolean;
}

export interface CanonicalCtaDestination {
  text: string;
  destination: string;
  sourceUrl: string;
}

export interface CanonicalWebsiteGrowthContext {
  slug: string;
  sourceRevision: string;
  capturedAt: string;
  method: string;
  primaryUrl: string;
  businessProfile: {
    approved: boolean;
    pharmacyName: string;
    website: string;
    town: string;
    postcode: string;
    phone: string;
    selectedServices: string[];
  };
  website: {
    status: CanonicalEvidenceAvailability;
    canonicalUrl: string;
    pages: CanonicalWebsitePageRef[];
    servicePages: CanonicalWebsitePageRef[];
    guidePages: CanonicalWebsitePageRef[];
    blogPages: CanonicalWebsitePageRef[];
    importantPages: CanonicalWebsitePageRef[];
  };
  importedServices: CanonicalImportedServiceRef[];
  serviceCoverage: {
    status: CanonicalEvidenceAvailability;
    approvedWithoutImportedPage: string[];
  };
  navigation: {
    status: CanonicalEvidenceAvailability;
    links: string[];
  };
  cta: {
    status: CanonicalEvidenceAvailability;
    label: string;
    destination: string;
    destinations: CanonicalCtaDestination[];
  };
  footer: {
    links: string[];
    socialLinks: string[];
    contact: string[];
    legal: string[];
    contactStatus: CanonicalEvidenceAvailability;
    legalStatus: CanonicalEvidenceAvailability;
  };
  brand: WebsiteBrandEvidence;
  /** Values that are safe to treat as authoritative. Conflict and missing stay null. */
  authoritativeBrand: {
    logo: string | null;
    favicon: string | null;
    primaryColour: string | null;
    secondaryColour: string | null;
    accentColour: string | null;
    headingFont: string | null;
    bodyFont: string | null;
  };
  unresolvedBrandFields: string[];
  visualCapture: "PRESENT" | "NOT CAPTURED";
  imagery: {
    status: CanonicalEvidenceAvailability;
    hero: CanonicalEvidenceAvailability;
    assets: Array<{ role: string; url: string; alt: string }>;
  };
  style: {
    status: CanonicalEvidenceAvailability;
    value: string;
  };
}

function str(value: unknown): string {
  return String(value ?? "").trim();
}

export function authoritativeImportedValue(value: WebsiteBrandValue | null | undefined): string | null {
  if (!value || value.status !== "IMPORTED") return null;
  return str(value.value) || null;
}

function brandAvailability(value: WebsiteBrandValue): CanonicalEvidenceAvailability {
  if (value.status === "CONFLICT") return "CONFLICT";
  if (value.status === "IMPORTED" && str(value.value)) return "PRESENT";
  return "MISSING";
}

function listStatus(items: string[]): CanonicalEvidenceAvailability {
  return items.length ? "PRESENT" : "MISSING";
}

export function buildCanonicalWebsiteGrowthContext(slug: string): CanonicalWebsiteGrowthContext {
  const safe = str(slug);
  const profile = readSetupProfile(safe);
  const brand = projectCanonicalWebsiteBrandEvidence(safe);
  const snap = (profile.websiteImportSnapshot || null) as {
    websiteUrl?: string;
    intelligence?: {
      services?: Array<{ serviceId?: string; serviceName?: string; exists?: boolean; url?: string }>;
      ctaEvidence?: Array<{ ctaText?: string; sourceUrl?: string }>;
    };
  } | null;
  const pages = brand.structure.map((page) => ({
    category: page.category || "page",
    url: page.url,
    title: page.title,
  }));
  const servicePages = pages.filter((page) => page.category === "service-page");
  const guidePages = pages.filter((page) => page.category === "guide");
  const blogPages = pages.filter((page) => page.category === "blog");
  const importantPages = pages.filter((page) =>
    ["homepage", "about", "contact", "services"].includes(page.category),
  );
  const importedServices = (snap?.intelligence?.services || [])
    .map((service) => ({
      serviceId: str(service.serviceId),
      serviceName: str(service.serviceName),
      url: str(service.url),
      exists: Boolean(service.exists),
    }))
    .filter((service) => service.serviceId || service.url);
  const selectedServices = [...new Set((profile.selectedServices || []).map((id) => str(id)).filter(Boolean))];
  const approvedWithoutImportedPage = pages.length
    ? selectedServices.filter((serviceId) => {
        const key = serviceId.toLowerCase();
        const imported = importedServices.some(
          (service) => service.serviceId.toLowerCase() === key && service.url,
        );
        const page = servicePages.some((item) => item.url.toLowerCase().includes(key));
        return !imported && !page;
      })
    : [];
  const headerDestination = str(brand.headerCta.assetUrl);
  const destinations: CanonicalCtaDestination[] = [];
  if (str(brand.headerCta.value) || headerDestination) {
    destinations.push({
      text: str(brand.headerCta.value),
      destination: headerDestination,
      sourceUrl: brand.headerCta.sourceUrl || brand.primaryUrl,
    });
  }
  for (const cta of snap?.intelligence?.ctaEvidence || []) {
    const text = str(cta.ctaText);
    const sourceUrl = str(cta.sourceUrl);
    if (!text && !sourceUrl) continue;
    destinations.push({ text, destination: sourceUrl, sourceUrl });
  }
  const visualCapture = designEvidenceHasUsableContent(loadWebsiteDesignEvidence(safe)) ? "PRESENT" : "NOT CAPTURED";
  const assets = brand.imagery.filter((image) => image.url);
  const heroFound = assets.some((image) => image.role === "hero");
  const imageryStatus: CanonicalEvidenceAvailability = assets.length
    ? "PRESENT"
    : visualCapture === "NOT CAPTURED"
      ? "NOT CAPTURED"
      : "MISSING";
  const heroStatus: CanonicalEvidenceAvailability = heroFound
    ? "PRESENT"
    : visualCapture === "NOT CAPTURED"
      ? "NOT CAPTURED"
      : "MISSING";
  const unresolvedBrandFields = [
    brand.logo,
    brand.favicon,
    brand.primaryColour,
    brand.secondaryColour,
    brand.accentColour,
    brand.headingFont,
    brand.bodyFont,
  ]
    .filter((value) => value.status === "CONFLICT")
    .map((value) => value.id);

  return {
    slug: safe,
    sourceRevision: brand.sourceRevision,
    capturedAt: brand.capturedAt,
    method: brand.method,
    primaryUrl: brand.primaryUrl,
    businessProfile: {
      approved: isBusinessProfileReviewApproved(safe),
      pharmacyName: str(profile.pharmacyName),
      website: str(profile.website || snap?.websiteUrl || brand.primaryUrl),
      town: str(profile.townCity),
      postcode: str(profile.postcode),
      phone: str(profile.phone),
      selectedServices,
    },
    website: {
      status: pages.length ? "PRESENT" : "MISSING",
      canonicalUrl: str(profile.website || snap?.websiteUrl || brand.primaryUrl),
      pages,
      servicePages,
      guidePages,
      blogPages,
      importantPages,
    },
    importedServices,
    serviceCoverage: {
      status: pages.length ? (servicePages.length || importedServices.length ? "PRESENT" : "MISSING") : "NOT CAPTURED",
      approvedWithoutImportedPage,
    },
    navigation: {
      status: listStatus(brand.headerNavigation),
      links: brand.headerNavigation,
    },
    cta: {
      status: destinations.length ? brandAvailability(brand.headerCta) === "CONFLICT" ? "CONFLICT" : "PRESENT" : "MISSING",
      label: str(brand.headerCta.value),
      destination: headerDestination,
      destinations,
    },
    footer: {
      links: brand.footerLinks,
      socialLinks: brand.socialLinks,
      contact: brand.footerContact,
      legal: brand.footerLegal,
      contactStatus: listStatus(brand.footerContact),
      legalStatus: listStatus(brand.footerLegal),
    },
    brand,
    authoritativeBrand: {
      logo: authoritativeImportedValue(brand.logo),
      favicon: authoritativeImportedValue(brand.favicon),
      primaryColour: authoritativeImportedValue(brand.primaryColour),
      secondaryColour: authoritativeImportedValue(brand.secondaryColour),
      accentColour: authoritativeImportedValue(brand.accentColour),
      headingFont: authoritativeImportedValue(brand.headingFont),
      bodyFont: authoritativeImportedValue(brand.bodyFont),
    },
    unresolvedBrandFields,
    visualCapture,
    imagery: {
      status: imageryStatus,
      hero: heroStatus,
      assets,
    },
    style: {
      status: brandAvailability(brand.styleSummary),
      value: brand.styleSummary.status === "CONFLICT" ? "" : str(brand.styleSummary.value),
    },
  };
}

/** Production Growth Intelligence input. Same object the report builder attaches. */
export function buildGrowthIntelligenceInputContext(slug: string): CanonicalWebsiteGrowthContext {
  return buildCanonicalWebsiteGrowthContext(slug);
}
