/**
 * CPR-RESET-01 — build structured website/Google imported evidence for Master Admin review.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { buildGoogleSourceSummary, readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import type {
  ImportedEvidenceReviewAcceptance,
  ImportedEvidenceReviewPayload,
  ImportedEvidenceRow,
  ImportedEvidenceStatus,
  WebsiteGoogleComparisonRow,
} from "./masterAdminImportedEvidenceReviewModel.ts";
import {
  readImportedEvidenceReviewDecision,
  writeImportedEvidenceReviewDecision,
} from "./masterAdminWorkflowAckService.ts";
import { validateImportTenantIsolationGate } from "./masterAdminImportTenantIsolationService.ts";
import { buildWebsiteBranchSelectionPayload } from "./masterAdminWebsiteBranchSelectionService.ts";
import type { WebsiteImportFieldValue } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { resolveWebsiteIntelligenceReimportState } from "./masterAdminWebsiteIntelligenceReimportState.ts";
import { resolveCanonicalWebsiteBusinessFields } from "./canonicalWebsiteBusinessEvidence.ts";
import { projectCanonicalWebsiteBrandEvidence } from "./canonicalWebsiteBrandEvidence.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function evidenceStatus(value: string, confidence: number | null): ImportedEvidenceStatus {
  if (!value) return "Not Found";
  if (confidence != null && confidence >= 70) return "Confirmed";
  return "Needs Review";
}

function rowFromField(
  id: string,
  group: ImportedEvidenceRow["group"],
  label: string,
  field: WebsiteImportFieldValue | null | undefined,
): ImportedEvidenceRow {
  const value = str(field?.selected);
  const ev = field?.evidence;
  return {
    id,
    group,
    label,
    value: value || "Not Found",
    sourceUrl: str(ev?.sourceUrl) || "—",
    extractionMethod: str(ev?.detectionMethod) || "—",
    confidence: field?.confidence ?? ev?.confidence ?? null,
    capturedAt: str(ev?.detectedAt) || null,
    status: evidenceStatus(value, field?.confidence ?? ev?.confidence ?? null),
  };
}

function rowFromScalar(
  id: string,
  group: ImportedEvidenceRow["group"],
  label: string,
  value: unknown,
  meta: Partial<ImportedEvidenceRow> = {},
): ImportedEvidenceRow {
  const v = str(value);
  return {
    id,
    group,
    label,
    value: v || "Not Found",
    sourceUrl: meta.sourceUrl || "—",
    extractionMethod: meta.extractionMethod || "—",
    confidence: meta.confidence ?? null,
    capturedAt: meta.capturedAt ?? null,
    status: v ? (meta.status || "Confirmed") : "Not Found",
  };
}

function buildWebsiteEvidenceRows(slug: string): ImportedEvidenceRow[] {
  const ws = buildWebsiteSourceSummary(slug);
  const snap = ws.importedEvidence as Record<string, unknown> | null;
  const intel = (snap?.intelligence || null) as Record<string, unknown> | null;
  const business = (intel?.business || {}) as Record<string, WebsiteImportFieldValue>;
  const websiteFields = resolveCanonicalWebsiteBusinessFields(business);
  const design = (intel?.designEvidence || null) as WebsiteDesignEvidence | null;
  const brand = projectCanonicalWebsiteBrandEvidence(slug);
  const importedAt = str(snap?.importedAt);

  const rows: ImportedEvidenceRow[] = [
    rowFromField("business-name", "business", "Business name", websiteFields.businessName),
    rowFromScalar("website-url", "business", "Website URL", snap?.websiteUrl || ws.canonicalWebsite, {
      sourceUrl: str(snap?.websiteUrl || ws.canonicalWebsite),
      extractionMethod: "operator-intake",
      capturedAt: importedAt,
      status: snap?.websiteUrl ? "Confirmed" : "Not Found",
    }),
    rowFromField("address", "business", "Address", websiteFields.address),
    rowFromField("town", "business", "Town or City", websiteFields.town),
    rowFromField("postcode", "business", "Postcode", websiteFields.postcode),
    rowFromField("phone", "business", "Phone", websiteFields.phone),
    rowFromField("email", "business", "Email", websiteFields.email),
    rowFromField("opening-hours", "business", "Opening hours", business.openingHours),
    rowFromScalar("logo", "brand", "Logo", brand.logo.value, {
      sourceUrl: brand.logo.assetUrl || brand.logo.sourceUrl,
      extractionMethod: brand.logo.method || "website-import",
      capturedAt: brand.capturedAt || importedAt,
      confidence: brand.logo.confidence,
      status: brand.logo.status === "CONFLICT" ? "Needs Review" : undefined,
    }),
    rowFromScalar("favicon", "brand", "Favicon", brand.favicon.value, {
      sourceUrl: brand.favicon.assetUrl || brand.favicon.sourceUrl,
      extractionMethod: brand.favicon.method || "website-import",
      capturedAt: brand.capturedAt || importedAt,
      status: brand.favicon.status === "CONFLICT" ? "Needs Review" : undefined,
    }),
    rowFromScalar("primary-colour", "brand", "Primary colour", brand.primaryColour.value, {
      extractionMethod: brand.primaryColour.method || "css-extract",
      capturedAt: brand.capturedAt || importedAt,
      status: brand.primaryColour.status === "CONFLICT" ? "Needs Review" : undefined,
    }),
    rowFromScalar("secondary-colour", "brand", "Secondary colour", brand.secondaryColour.value, {
      extractionMethod: brand.secondaryColour.method || "css-extract",
      capturedAt: brand.capturedAt || importedAt,
      status: brand.secondaryColour.status === "CONFLICT" ? "Needs Review" : undefined,
    }),
    rowFromScalar("accent-colour", "brand", "Accent colour", brand.accentColour.value, {
      extractionMethod: brand.accentColour.method || "css-extract",
      capturedAt: brand.capturedAt || importedAt,
      status: brand.accentColour.status === "CONFLICT" ? "Needs Review" : undefined,
    }),
    rowFromScalar("heading-font", "brand", "Heading font", brand.headingFont.value, {
      extractionMethod: brand.headingFont.method || "brand-dna-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("body-font", "brand", "Body font", brand.bodyFont.value, {
      extractionMethod: brand.bodyFont.method || "brand-dna-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("header-design", "brand", "Header design evidence", brand.headerSummary.value, {
      extractionMethod: brand.headerSummary.method || "design-intelligence-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("navigation-links", "brand", "Navigation links", brand.headerNavigation.join(" · "), {
      extractionMethod: brand.method || "design-intelligence-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("footer-design", "brand", "Footer design evidence", brand.footerSummary.value, {
      extractionMethod: brand.footerSummary.method || "design-intelligence-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("footer-links", "brand", "Footer links", brand.footerLinks.join(" · "), {
      extractionMethod: brand.method || "design-intelligence-v1",
      capturedAt: brand.capturedAt || importedAt,
    }),
    rowFromScalar("button-style", "brand", "Button style", design?.components?.buttons?.[0]?.backgroundColour, {
      extractionMethod: "computed-style",
      capturedAt: importedAt,
    }),
  ];

  const clinicalServices = Array.isArray(intel?.services)
    ? (intel.services as Array<{ serviceName?: string; exists?: boolean }>).filter((s) => s.exists === true)
    : [];
  const commercialServices = Array.isArray(intel?.commercialServiceEvidence)
    ? (intel.commercialServiceEvidence as Array<{ serviceName?: string; sourceUrl?: string }>)
    : [];
  const serviceNames = [
    ...clinicalServices.map((s) => s.serviceName).filter(Boolean),
    ...commercialServices.map((s) => s.serviceName).filter(Boolean),
  ];
  rows.push(
    rowFromScalar("service-names", "content", "Service names", serviceNames.join(" · "), {
      extractionMethod: commercialServices.length ? "commercial-service-page+clinical-scoped" : "page-inventory",
      capturedAt: importedAt,
      sourceUrl: commercialServices[0]?.sourceUrl || "—",
      status: serviceNames.length ? "Needs Review" : "Not Found",
    }),
  );

  const audience = Array.isArray(intel?.audienceEvidence)
    ? (intel.audienceEvidence as Array<{ value?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  rows.push(
    rowFromScalar("audience", "content", "Audience / customers", audience.map((a) => a.value).filter(Boolean).join(" · "), {
      extractionMethod: audience[0]?.extractionMethod || "audience-positioning",
      capturedAt: importedAt,
      sourceUrl: audience[0]?.sourceUrl || "—",
      confidence: audience[0]?.confidence ?? null,
      status: audience.length ? "Needs Review" : "Not Found",
    }),
  );

  const pricing = Array.isArray(intel?.commercialPricingEvidence)
    ? (intel.commercialPricingEvidence as Array<{ value?: string; kind?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  rows.push(
    rowFromScalar(
      "pricing-offers",
      "content",
      "Pricing / packages",
      pricing.map((p) => `${p.kind || "item"}: ${p.value}`).filter((v) => !v.endsWith(": ")).join(" · "),
      {
        extractionMethod: pricing[0]?.extractionMethod || "commercial-pricing",
        capturedAt: importedAt,
        sourceUrl: pricing[0]?.sourceUrl || "—",
        confidence: pricing[0]?.confidence ?? null,
        status: pricing.length ? "Needs Review" : "Not Found",
      },
    ),
  );

  const offers = Array.isArray(intel?.commercialOfferEvidence)
    ? (intel.commercialOfferEvidence as Array<{ offerName?: string; offerType?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  rows.push(
    rowFromScalar(
      "commercial-offers",
      "content",
      "Offers / programmes",
      offers.map((o) => `${o.offerName}${o.offerType ? ` (${o.offerType})` : ""}`).filter(Boolean).join(" · "),
      {
        extractionMethod: offers[0]?.extractionMethod || "commercial-offer",
        capturedAt: importedAt,
        sourceUrl: offers[0]?.sourceUrl || "—",
        confidence: offers[0]?.confidence ?? null,
        status: offers.length ? "Needs Review" : "Not Found",
      },
    ),
  );

  const ctas = Array.isArray(intel?.ctaEvidence)
    ? (intel.ctaEvidence as Array<{ ctaText?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  rows.push(
    rowFromScalar("cta-evidence", "content", "Calls to action", [...new Set(ctas.map((c) => c.ctaText).filter(Boolean))].join(" · "), {
      extractionMethod: ctas[0]?.extractionMethod || "clickable-cta",
      capturedAt: importedAt,
      sourceUrl: ctas[0]?.sourceUrl || "—",
      confidence: ctas[0]?.confidence ?? null,
      status: ctas.length ? "Needs Review" : "Not Found",
    }),
  );

  const trust = Array.isArray(intel?.trustEvidence)
    ? (intel.trustEvidence as Array<{ kind?: string; value?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  rows.push(
    rowFromScalar(
      "trust-evidence",
      "content",
      "About / trust evidence",
      trust.map((t) => `${t.kind || "trust"}: ${String(t.value || "").slice(0, 80)}`).filter((v) => !v.endsWith(": ")).join(" · "),
      {
        extractionMethod: trust[0]?.extractionMethod || "about-trust",
        capturedAt: importedAt,
        sourceUrl: trust[0]?.sourceUrl || "—",
        confidence: trust[0]?.confidence ?? null,
        status: trust.length ? "Needs Review" : "Not Found",
      },
    ),
  );

  const socialProfiles = Array.isArray(intel?.socialProfileEvidence)
    ? (intel.socialProfileEvidence as Array<{ platform?: string; url?: string; sourceUrl?: string; extractionMethod?: string; confidence?: number }>)
    : [];
  const socialLegacy = Array.isArray(snap?.socialLinks) ? (snap.socialLinks as string[]) : [];
  const socialValue = socialProfiles.length
    ? socialProfiles.map((s) => `${s.platform}: ${s.url}`).join(" · ")
    : socialLegacy.join(" · ");
  rows.push(
    rowFromScalar("social-profiles", "content", "Social profiles", socialValue, {
      extractionMethod: socialProfiles[0]?.extractionMethod || "external-social-link",
      capturedAt: importedAt,
      sourceUrl: socialProfiles[0]?.sourceUrl || socialLegacy[0] || "—",
      confidence: socialProfiles[0]?.confidence ?? null,
      status: socialValue ? "Needs Review" : "Not Found",
    }),
  );

  const nameField = business.businessName;
  if (nameField?.selectionReasoning) {
    rows.push(
      rowFromScalar("business-name-reasoning", "business", "Business name selection reasoning", nameField.selectionReasoning, {
        extractionMethod: "identity-corroboration",
        capturedAt: importedAt,
        status: "Needs Review",
        confidence: nameField.confidence ?? null,
      }),
    );
  }
  if (business.phone?.rejectedCandidates?.length) {
    rows.push(
      rowFromScalar(
        "phone-rejected",
        "business",
        "Rejected phone candidates",
        business.phone.rejectedCandidates.map((r) => `${r.value} (${r.reason})`).join(" · "),
        {
          extractionMethod: "phone-validation",
          capturedAt: importedAt,
          status: "Needs Review",
        },
      ),
    );
  }

  const structure = (intel?.structure || {}) as Record<string, number>;
  rows.push(
    rowFromScalar("contact-page", "content", "Contact page", structure.contactPages ? `${structure.contactPages} page(s)` : "", {
      extractionMethod: "page-inventory",
      capturedAt: importedAt,
    }),
    rowFromScalar("about-page", "content", "About page", structure.aboutPages ? `${structure.aboutPages} page(s)` : "", {
      extractionMethod: "page-inventory",
      capturedAt: importedAt,
    }),
    rowFromScalar("booking-links", "content", "Booking links", (Array.isArray(intel?.services) ? intel.services as Array<{ content?: { bookingLink?: string } }> : []).find((s) => s.content?.bookingLink)?.content?.bookingLink || "", {
      extractionMethod: "service-page-scrape",
      capturedAt: importedAt,
    }),
    rowFromScalar("trust-content", "content", "Trust / team content", structure.aboutPages ? "About page detected" : "", {
      extractionMethod: "page-inventory",
      capturedAt: importedAt,
    }),
    rowFromScalar("accessibility", "content", "Accessibility information", (snap?.regulatoryEvidence as unknown[])?.length ? "Regulatory evidence captured" : "", {
      extractionMethod: "regulatory-scan",
      capturedAt: importedAt,
    }),
    rowFromScalar("parking-transport", "content", "Parking or transport", "", {
      extractionMethod: "page-scrape",
      capturedAt: importedAt,
    }),
  );

  return rows;
}

function buildGoogleEvidenceRows(slug: string): ImportedEvidenceRow[] {
  const gs = buildGoogleSourceSummary(slug);
  const snap = gs.importedEvidence as Record<string, unknown> | null;
  const intel = gs.googleImported ? (gs.googleIntelligence || readGoogleIntelligenceRecord(slug)) : null;
  const importedAt = str(snap?.importedAt || intel?.importedAt);

  // Only real Google import snapshot evidence — never profile/onboarding fallbacks.
  if (!gs.googleImported || !snap) {
    return [
      rowFromScalar("google-import-state", "google", "Google import", "NOT IMPORTED", {
        extractionMethod: "google-import-gate",
        status: "Not Found",
        capturedAt: null,
      }),
    ];
  }

  const pick = (...vals: unknown[]): string => {
    for (const v of vals) {
      const s = str(v);
      if (s) return s;
    }
    return "";
  };

  const categories = (snap?.categories as string[] | undefined) || intel?.categories || [];
  const photos = snap?.photos as unknown[] | undefined;

  return [
    rowFromScalar("google-business-name", "google", "Business name", pick(snap?.businessName, intel?.businessName), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-address", "google", "Address", pick(snap?.address), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-town", "google", "Town or City", pick(snap?.town), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-postcode", "google", "Postcode", pick(snap?.postcode), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-phone", "google", "Phone", pick(snap?.phone), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-website", "google", "Website", pick(snap?.website), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-primary-category", "google", "Primary category", pick((snap?.categories as string[] | undefined)?.[0]), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-additional-categories", "google", "Additional categories", categories.slice(1).join(" · "), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-rating", "google", "Rating", snap?.rating != null ? String(snap.rating) : intel?.rating != null ? String(intel.rating) : "", { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-review-count", "google", "Review count", snap?.reviewCount != null ? String(snap.reviewCount) : intel?.reviewCount ? String(intel.reviewCount) : "", { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-photos", "google", "Photos", photos?.length ? `${photos.length} photo(s)` : intel?.photoCount ? `${intel.photoCount} photo(s)` : "", { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-opening-hours", "google", "Opening hours", pick(snap?.openingHours, intel?.openingHours), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-maps-url", "google", "Google Maps URL", pick(snap?.googleMapsUrl), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-place-id", "google", "Place ID", pick(snap?.placeId, intel?.placeId), { extractionMethod: "google-places", capturedAt: importedAt }),
    rowFromScalar("google-services", "google", "Services / attributes", pick(snap?.services, intel?.attributes?.join(" · ")), { extractionMethod: "google-places", capturedAt: importedAt }),
  ];
}

function buildGoogleProfileReconciliationRows(slug: string): ImportedEvidenceRow[] {
  const data = readSetupProfile(safeAdminSlug(slug));
  const gs = buildGoogleSourceSummary(slug);
  if (gs.googleImported) return [];
  const rows: ImportedEvidenceRow[] = [];
  if (str(data.pharmacyName)) {
    rows.push(
      rowFromScalar("profile-business-name", "google", "Profile business name (not Google import)", data.pharmacyName, {
        extractionMethod: "profile-onboarding",
        status: "Needs Review",
      }),
    );
  }
  if (str(data.googleBusinessProfileUrl)) {
    rows.push(
      rowFromScalar("profile-gbp-url", "google", "Declared Google Business Profile URL (not imported)", data.googleBusinessProfileUrl, {
        extractionMethod: "profile-onboarding",
        status: "Needs Review",
      }),
    );
  }
  return rows;
}

function buildCrawlCoverage(slug: string) {
  const ws = buildWebsiteSourceSummary(slug);
  const snap = ws.importedEvidence as Record<string, unknown> | null;
  const intel = (snap?.intelligence || null) as Record<string, unknown> | null;
  const structure = (intel?.structure || {}) as Record<string, unknown>;
  const pages = Array.isArray(structure.pages) ? structure.pages : [];
  return {
    contentPagesAnalysed: Number(structure.totalPages) || pages.length,
    sitemapFound: Boolean(structure.sitemapFound),
    pages: pages.slice(0, 40).map((p: Record<string, unknown>) => ({
      url: str(p.url),
      discoverySource: str(p.discoverySource) || "—",
      category: str(p.category) || "other",
      fetchStatus: str(p.fetchStatus) || "ok",
      title: str(p.title),
      h1: str(p.h1),
    })),
  };
}

function buildEvidenceQualityStatus(slug: string) {
  const ws = buildWebsiteSourceSummary(slug);
  const snap = ws.importedEvidence as Record<string, unknown> | null;
  const intel = (intelFromSnap(snap));
  const eq = (intel?.evidenceQuality || null) as Record<string, unknown> | null;
  if (!eq) {
    return {
      technicallyComplete: Boolean(ws.websiteImported),
      safeForBusinessProfileReview: false,
      blockers: ws.websiteImported ? ["Evidence quality assessment missing from import snapshot — re-import required."] : ["Website not imported."],
      warnings: [] as string[],
      contentPagesAnalysed: 0,
      sitemapDocumentsExcluded: 0,
      assessedAt: null as string | null,
    };
  }
  return {
    technicallyComplete: Boolean(eq.technicallyComplete),
    safeForBusinessProfileReview: Boolean(eq.safeForBusinessProfileReview),
    blockers: Array.isArray(eq.blockers) ? eq.blockers.map(String) : [],
    warnings: Array.isArray(eq.warnings) ? eq.warnings.map(String) : [],
    contentPagesAnalysed: Number(eq.contentPagesAnalysed) || 0,
    sitemapDocumentsExcluded: Number(eq.sitemapDocumentsExcluded) || 0,
    assessedAt: str(eq.assessedAt) || null,
  };
}

function intelFromSnap(snap: Record<string, unknown> | null): Record<string, unknown> | null {
  return (snap?.intelligence || null) as Record<string, unknown> | null;
}

function normCompare(v: string): string {
  return v.toLowerCase().replace(/\s+/g, " ").trim();
}

function hostKey(value: string): string {
  try {
    const url = new URL(value.startsWith("http") ? value : `https://${value}`);
    return url.hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return normCompare(value).replace(/^https?:\/\//, "").replace(/^www\./, "").replace(/\/$/, "");
  }
}

function phoneKey(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("44")) digits = `0${digits.slice(2)}`;
  return digits;
}

function postcodeKey(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function streetKey(value: string): string {
  return normCompare(value)
    .replace(/[.,]/g, " ")
    .replace(/\broad\b/g, "rd")
    .replace(/\bstreet\b/g, "st")
    .replace(/\s+/g, " ")
    .trim();
}

function equivalentEvidence(label: string, website: string, google: string): boolean {
  if (label === "Website") return hostKey(website) === hostKey(google);
  if (label === "Postcode") return postcodeKey(website) === postcodeKey(google);
  if (label === "Phone") return phoneKey(website) === phoneKey(google);
  if (label === "Address") {
    const left = streetKey(website);
    const right = streetKey(google);
    return left === right || right.startsWith(left) || left.startsWith(right);
  }
  const left = normCompare(website);
  const right = normCompare(google);
  return left === right || left.startsWith(`${right} `) || right.startsWith(`${left} `);
}

function buildComparisonRows(website: ImportedEvidenceRow[], google: ImportedEvidenceRow[]): WebsiteGoogleComparisonRow[] {
  const pairs: Array<[string, string, string]> = [
    ["business-name", "google-business-name", "Business name"],
    ["address", "google-address", "Address"],
    ["town", "google-town", "Town or City"],
    ["postcode", "google-postcode", "Postcode"],
    ["phone", "google-phone", "Phone"],
    ["website-url", "google-website", "Website"],
    ["opening-hours", "google-opening-hours", "Opening hours"],
  ];
  const wMap = new Map(website.map((r) => [r.id, r]));
  const gMap = new Map(google.map((r) => [r.id, r]));

  return pairs.map(([wid, gid, label]) => {
    const wv = wMap.get(wid)?.value || "";
    const gv = gMap.get(gid)?.value || "";
    const wOk = wv && wv !== "Not Found";
    const gOk = gv && gv !== "Not Found";
    let matchStatus: WebsiteGoogleComparisonRow["matchStatus"] = "both_missing";
    if (wOk && gOk) matchStatus = equivalentEvidence(label, wv, gv) ? "match" : "difference";
    else if (wOk) matchStatus = "website_only";
    else if (gOk) matchStatus = "google_only";
    return {
      id: `${wid}-vs-${gid}`,
      label,
      websiteValue: wOk ? wv : "—",
      googleValue: gOk ? gv : "—",
      matchStatus,
      productOwnerDecision: null,
    };
  });
}

export function importedEvidenceSourceRevision(slug: string): string {
  const data = readSetupProfile(safeAdminSlug(slug));
  const websiteAt = str(data.websiteImportSnapshot?.importedAt);
  const googleAt = str(data.googleImportSnapshot?.importedAt);
  const googleState = resolveGoogleProfileOnboardingState(data);
  return `${websiteAt}|${googleState}|${googleAt}`;
}

export function assessImportedEvidenceReviewAcceptance(slug: string): ImportedEvidenceReviewAcceptance {
  const safe = safeAdminSlug(slug);
  const review = buildImportedEvidenceReview(safe);
  return review.acceptance;
}

function acceptanceForReview(
  slug: string,
  input: {
    websiteImported: boolean;
    googleImported: boolean;
    googleProfileState: string;
    isolationPassed: boolean;
    safeForReview: boolean;
    branchSelectionRequired: boolean;
  },
): ImportedEvidenceReviewAcceptance {
  const googleComplete = input.googleImported || input.googleProfileState === "no_profile" || input.googleProfileState === "deferred";
  let unavailableReason: string | null = null;
  if (!input.websiteImported) unavailableReason = "Website Import is not complete.";
  else if (!googleComplete) unavailableReason = "Google evidence is not complete.";
  else if (!input.isolationPassed) unavailableReason = "Tenant isolation has not passed.";
  else if (!input.safeForReview) unavailableReason = "Evidence quality is not safe for review.";
  else if (input.branchSelectionRequired) unavailableReason = "Branch selection is still required.";
  const ready = unavailableReason == null;
  const decision = readImportedEvidenceReviewDecision(slug);
  const accepted = Boolean(ready && decision && decision.sourceRevision === importedEvidenceSourceRevision(slug));
  return {
    ready,
    accepted,
    businessProfileReviewAvailable: accepted,
    actionId: ready && !accepted ? "accept_imported_evidence_review" : null,
    actionLabel: ready && !accepted ? "Accept Imported Evidence" : null,
    unavailableReason,
    decidedAt: accepted ? decision?.decidedAt || null : null,
    decidedBy: accepted ? decision?.decidedBy || null : null,
  };
}

export function acceptImportedEvidenceReview(slug: string, operator: string): ImportedEvidenceReviewAcceptance {
  const safe = safeAdminSlug(slug);
  const current = assessImportedEvidenceReviewAcceptance(safe);
  if (!current.ready) {
    throw new Error(current.unavailableReason || "Imported evidence is not ready for acceptance.");
  }
  if (!current.accepted) {
    writeImportedEvidenceReviewDecision(safe, operator || "master-admin", importedEvidenceSourceRevision(safe));
  }
  return assessImportedEvidenceReviewAcceptance(safe);
}

export function buildImportedEvidenceReview(slug: string): ImportedEvidenceReviewPayload {
  const safe = safeAdminSlug(slug);
  const data = readSetupProfile(safe);
  const ws = buildWebsiteSourceSummary(safe);
  const gs = buildGoogleSourceSummary(safe);
  const googleState = resolveGoogleProfileOnboardingState(data);

  const branchSelection = buildWebsiteBranchSelectionPayload(safe);
  const requiresBranchSelection = branchSelection.requiresSelection;

  const websiteEvidence = requiresBranchSelection
    ? buildWebsiteEvidenceRows(safe).map((row) =>
        row.group === "business" && row.value !== "Not Found"
          ? { ...row, value: "Pending branch selection", status: "Needs Review" as const }
          : row,
      )
    : buildWebsiteEvidenceRows(safe);
  const googleEvidence = buildGoogleEvidenceRows(safe);
  const googleProfileReconciliation = buildGoogleProfileReconciliationRows(safe);
  const googleImportedFlag = Boolean(gs.googleImported);
  const googleStateEarly = googleState;
  const comparisonState: "available" | "suppressed" | "not_applicable" = !googleImportedFlag
    ? googleStateEarly.state === "no_profile"
      ? "not_applicable"
      : "suppressed"
    : requiresBranchSelection
      ? "suppressed"
      : "available";
  const comparison =
    comparisonState === "available" ? buildComparisonRows(websiteEvidence, googleEvidence) : [];
  const tenantIsolation = validateImportTenantIsolationGate(safe);
  const crawlCoverage = buildCrawlCoverage(safe);
  const evidenceQuality = buildEvidenceQualityStatus(safe);

  const candidates = (data.customerSetupGoogleCandidates || []).map((c) => ({
    placeId: c.placeId,
    businessName: c.businessName,
    address: c.address,
    postcode: c.postcode,
    phone: c.phone,
    website: c.website,
    rating: c.rating,
    reviewCount: c.reviewCount,
    primaryCategory: c.primaryCategory,
    googleMapsUrl: c.googleMapsUrl,
    confidence: c.confidence,
  }));

  const websiteImported = Boolean(ws.websiteImported) && !requiresBranchSelection;
  const acceptance = acceptanceForReview(safe, {
    websiteImported,
    googleImported: googleImportedFlag,
    googleProfileState: googleState.state,
    isolationPassed: Boolean(tenantIsolation.passed),
    safeForReview: Boolean(evidenceQuality?.safeForBusinessProfileReview),
    branchSelectionRequired: requiresBranchSelection,
  });
  const googleImported = googleImportedFlag;
  const websiteUrl = str(data.website || ws.canonicalWebsite);
  const reimportState = resolveWebsiteIntelligenceReimportState(safe);
  const websiteReimportRequired = Boolean(reimportState.required && !requiresBranchSelection);
  // Persistent optional control: any website-imported tenant with a canonical URL may re-import.
  const websiteReimportAvailable = Boolean(
    !requiresBranchSelection && websiteUrl && (websiteImported || ws.websiteImported),
  );

  let summary = "Awaiting Website Import and Google Profile Import.";
  if (requiresBranchSelection) {
    summary = branchSelection.resolution.googleBranchMatchNotes.some((note) => /ambiguous/i.test(note))
      ? `Branch evidence is ambiguous (${branchSelection.detectedBranchCount}) — review is required before evidence is accepted.`
      : `Multiple pharmacy branches detected (${branchSelection.detectedBranchCount}) — select the branch being onboarded before evidence is accepted.`;
  } else if (branchSelection.detectedBranchCount === 1 && branchSelection.resolution.status === "none") {
    summary = "One physical pharmacy branch identified from the website evidence. Shared parent branding is preserved separately.";
  } else if (branchSelection.resolution.status === "branch_selected") {
    summary = `Branch selected: ${branchSelection.resolution.selectedBranch?.branchName || "—"} — review website and Google evidence before Business Profile approval.`;
  } else if (websiteReimportRequired) {
    summary = reimportState.summary;
  } else if (websiteImported && evidenceQuality && !evidenceQuality.safeForBusinessProfileReview) {
    summary = `Website import technically complete but evidence quality blocked (${evidenceQuality.blockers[0] || "see blockers"}) — not safe for Business Profile Review yet.`;
  } else if (websiteImported && googleImported) {
    summary = "Website and Google imports complete — review evidence before Business Profile approval.";
  } else if (websiteImported) {
    summary = "Website Import complete — Google Import not executed (comparison suppressed).";
  } else if (googleState.state === "no_profile") {
    summary = "No Google Business Profile declared — complete Website Import review.";
  } else if (googleImported) {
    summary = "Google Import complete — Website Import pending.";
  }

  return {
    slug: safe,
    pharmacyName: str(data.pharmacyName),
    websiteUrl,
    websiteImported,
    googleImported,
    googleProfileState: googleState.state,
    websiteEvidence,
    googleEvidence,
    googleProfileReconciliation,
    comparison,
    comparisonState,
    crawlCoverage,
    evidenceQuality,
    websiteReimportRequired,
    websiteReimportAvailable,
    websiteReimportActionId: websiteReimportAvailable ? "rerun_website_import" : null,
    websiteReimportTargetUrl: websiteReimportAvailable
      ? reimportState.targetUrl || websiteUrl
      : undefined,
    tenantIsolation,
    googleCandidates: candidates,
    branchSelection,
    websiteBrand: projectCanonicalWebsiteBrandEvidence(safe),
    summary,
    acceptance,
  };
}
