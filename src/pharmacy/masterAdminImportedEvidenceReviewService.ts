/**
 * CPR-RESET-01 — build structured website/Google imported evidence for Master Admin review.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { buildGoogleSourceSummary, readGoogleIntelligenceRecord } from "./masterAdminCanonicalGoogleService.ts";
import { buildWebsiteSourceSummary } from "./masterAdminCanonicalWebsiteService.ts";
import { resolveGoogleProfileOnboardingState } from "./masterAdminGoogleProfileOnboardingService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import type {
  ImportedEvidenceReviewPayload,
  ImportedEvidenceRow,
  ImportedEvidenceStatus,
  WebsiteGoogleComparisonRow,
} from "./masterAdminImportedEvidenceReviewModel.ts";
import { validateImportTenantIsolationGate } from "./masterAdminImportTenantIsolationService.ts";
import { buildWebsiteBranchSelectionPayload } from "./masterAdminWebsiteBranchSelectionService.ts";
import type { WebsiteImportFieldValue } from "./growthEngineWebsiteIntelligenceImportV2Model.ts";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { resolveWebsiteIntelligenceReimportState } from "./masterAdminWebsiteIntelligenceReimportState.ts";

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
  const identity = (intel?.identity || {}) as Record<string, unknown>;
  const design = (intel?.designEvidence || null) as WebsiteDesignEvidence | null;
  const importedAt = str(snap?.importedAt);

  const rows: ImportedEvidenceRow[] = [
    rowFromField("business-name", "business", "Business name", business.businessName),
    rowFromScalar("website-url", "business", "Website URL", snap?.websiteUrl || ws.canonicalWebsite, {
      sourceUrl: str(snap?.websiteUrl || ws.canonicalWebsite),
      extractionMethod: "operator-intake",
      capturedAt: importedAt,
      status: snap?.websiteUrl ? "Confirmed" : "Not Found",
    }),
    rowFromField("address", "business", "Address", business.address),
    rowFromField("town", "business", "Town or City", business.town),
    rowFromField("postcode", "business", "Postcode", business.postcode),
    rowFromField("phone", "business", "Phone", business.phone),
    rowFromField("email", "business", "Email", business.email),
    rowFromField("opening-hours", "business", "Opening hours", business.openingHours),
    rowFromScalar("logo", "brand", "Logo", identity.logoUrl || snap?.logoUrl, {
      sourceUrl: str(identity.logoUrl || snap?.logoUrl),
      extractionMethod: "website-scrape",
      capturedAt: importedAt,
    }),
    rowFromScalar("favicon", "brand", "Favicon", identity.faviconUrl, {
      sourceUrl: str(identity.faviconUrl),
      extractionMethod: "website-scrape",
      capturedAt: importedAt,
    }),
    rowFromScalar("primary-colour", "brand", "Primary colour", identity.brandPrimaryColor || snap?.brandPrimaryColor, {
      extractionMethod: design?.colours?.[0]?.source || "css-extract",
      capturedAt: importedAt,
    }),
    rowFromScalar("secondary-colour", "brand", "Secondary colour", identity.brandSecondaryColor || snap?.brandSecondaryColor, {
      extractionMethod: design?.colours?.[1]?.source || "css-extract",
      capturedAt: importedAt,
    }),
    rowFromScalar("accent-colour", "brand", "Accent colour", identity.brandAccentColor || snap?.brandAccentColor, {
      extractionMethod: "css-extract",
      capturedAt: importedAt,
    }),
    rowFromScalar("heading-font", "brand", "Heading font", design?.typography?.heading?.fontFamily, {
      extractionMethod: "computed-style",
      capturedAt: design?.typography?.heading?.evidence?.[0]?.capturedAt || importedAt,
    }),
    rowFromScalar("body-font", "brand", "Body font", design?.typography?.body?.fontFamily, {
      extractionMethod: "computed-style",
      capturedAt: design?.typography?.body?.evidence?.[0]?.capturedAt || importedAt,
    }),
    rowFromScalar("header-design", "brand", "Header design evidence", design?.header?.logoSelector ? "Detected" : "", {
      extractionMethod: "dom-capture",
      capturedAt: importedAt,
      status: design?.header ? "Confirmed" : "Not Found",
    }),
    rowFromScalar("navigation-links", "brand", "Navigation links", (design?.header?.navItems || []).map((n) => n.label).join(" · "), {
      extractionMethod: "dom-capture",
      capturedAt: importedAt,
    }),
    rowFromScalar("footer-design", "brand", "Footer design evidence", design?.footer?.columns?.length ? "Detected" : "", {
      extractionMethod: "dom-capture",
      capturedAt: importedAt,
      status: design?.footer ? "Confirmed" : "Not Found",
    }),
    rowFromScalar("footer-links", "brand", "Footer links", (snap?.footerLinks as string[] | undefined)?.join(" · ") || (design?.footer?.linkGroups || []).flatMap((g) => g.links.map((l) => l.label)).join(" · "), {
      extractionMethod: "dom-capture",
      capturedAt: importedAt,
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

function buildComparisonRows(website: ImportedEvidenceRow[], google: ImportedEvidenceRow[]): WebsiteGoogleComparisonRow[] {
  const pairs: Array<[string, string, string]> = [
    ["business-name", "google-business-name", "Business name"],
    ["address", "google-address", "Address"],
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
    if (wOk && gOk) matchStatus = normCompare(wv) === normCompare(gv) ? "match" : "difference";
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
    summary = `Multiple pharmacy branches detected (${branchSelection.detectedBranchCount}) — select the branch being onboarded before evidence is accepted.`;
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
    summary,
  };
}
