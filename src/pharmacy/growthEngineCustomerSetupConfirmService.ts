/**
 * Customer Setup Import Split V1 — Step 2 review view model + confirm save.
 */
import fs from "node:fs";
import {
  normalizeProfileData,
  type CustomerSetupFieldSource,
  type GoogleImportSnapshot,
  type PharmacyProfileData,
  type SetupImportSnapshotStatus,
  type WebsiteImportSnapshot,
} from "./pharmacyProfileSchema.ts";
import {
  buildGoogleDraftValues,
  buildWebsiteDraftValues,
  readAdminBaselineFields,
  readSetupProfile,
  writeSetupProfile,
} from "./growthEngineCustomerSetupImportSplitService.ts";
import { buildWebsiteImportCompletenessReport } from "./pharmacyWebsiteImportCompletenessReport.ts";
import type { WebsiteRegulatoryEvidence } from "./pharmacyWebsiteRegulatoryEvidence.ts";
import {
  buildBusinessDetailConflicts,
  resolveImportedDisplayAddress,
  type BusinessDetailConflict,
} from "./pharmacyBusinessDisplayResolver.ts";
import {
  renderPresentationPagesBatch,
  verifyPresentationOutputContains,
} from "./pharmacyPresentationRenderBatch.ts";
import { invalidatePharmacyPresentationProfileCache } from "./pharmacyPresentationProfileResolver.ts";
import { confirmTenantBrandIdentity } from "./pharmacyTenantBrandIdentityContract.ts";
import { bestWebsiteAddressCandidate, resolveCanonicalWebsiteBusinessFields } from "./canonicalWebsiteBusinessEvidence.ts";

export type ConfirmImportStatus = "imported" | "needs_review" | "not_found";

export function formatCustomerSetupSourceLabel(source: CustomerSetupFieldSource | ""): string {
  if (source === "google") return "Google Import";
  if (source === "website") return "Website Import";
  return "Manual";
}

export interface ConfirmDisplayRow {
  label: string;
  value: string;
}

export interface ConfirmImportSection {
  id: string;
  title: string;
  status: ConfirmImportStatus;
  statusLabel: string;
  rows: ConfirmDisplayRow[];
  notice?: string;
}

export interface ConfirmFieldWithSource {
  value: string;
  source: CustomerSetupFieldSource | "";
  sourceUrl?: string;
  evidenceLabel?: string;
  matchedSnippet?: string;
}

export interface CustomerSetupWebsiteBrandSummary {
  visible: boolean;
  websiteTitle: string;
  businessName: string;
  logoUrl: string;
  logoStatus: "FOUND" | "NOT FOUND";
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  cms: string;
  analytics: string;
  headerDetected: boolean;
  footerDetected: boolean;
  colourSource: string;
  totalPages: number;
}

export interface CustomerSetupWebsiteAddressEvidence {
  visible: boolean;
  importedDisplayAddress: string;
  addressLine1: string;
  town: string;
  postcode: string;
  sourceUrl: string;
  sourceType: string;
  matchedSnippet: string;
  confidence: number;
}

export interface CustomerSetupConfirmView {
  slug: string;
  googleSection: ConfirmImportSection;
  websiteSection: ConfirmImportSection;
  googleCandidates: import("./pharmacyProfileSchema.ts").CustomerSetupGoogleCandidate[];
  googleSelectorVisible: boolean;
  nationalWebsiteWarning: boolean;
  fields: {
    pharmacyName: ConfirmFieldWithSource;
    website: ConfirmFieldWithSource;
    phone: ConfirmFieldWithSource;
    email: ConfirmFieldWithSource;
    address: ConfirmFieldWithSource;
    town: ConfirmFieldWithSource;
    postcode: ConfirmFieldWithSource;
    gphcNumber: ConfirmFieldWithSource;
  };
  gphcCandidate: WebsiteRegulatoryEvidence | null;
  googleDraft: ReturnType<typeof buildGoogleDraftValues>;
  websiteDraft: ReturnType<typeof buildWebsiteDraftValues>;
  websiteBrandSummary: CustomerSetupWebsiteBrandSummary;
  websiteAddressEvidence: CustomerSetupWebsiteAddressEvidence;
  businessDetailConflicts: BusinessDetailConflict[];
  importCompletenessScore: number;
  importConfirmationGaps: string[];
  commercialReady: boolean;
  unresolvedImportantFields: string[];
  localMarketUrl: string;
  setupStartUrl: string;
}

export interface CustomerSetupConfirmInput {
  pharmacyName: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  town: string;
  postcode: string;
  gphcNumber?: string;
  gphcConfirmation?: "confirm" | "reject" | "";
  displayAddress?: string;
  displayAddressResolution?: "keep-canonical" | "use-imported" | "edit-manually" | "";
  fieldResolutions?: Record<string, "keep-canonical" | "use-imported" | "edit-manually">;
  fieldSources?: Record<string, CustomerSetupFieldSource | "">;
  brandLogoUrl?: string;
  brandPrimaryColor?: string;
  brandSecondaryColor?: string;
  brandAccentColor?: string;
  brandHeadingFont?: string;
  brandBodyFont?: string;
  confirmBrand?: boolean;
}

export interface CustomerSetupConfirmResult {
  ok: boolean;
  slug: string;
  redirectUrl: string;
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function snapshotStatusLabel(status: SetupImportSnapshotStatus): ConfirmImportStatus {
  if (status === "imported") return "imported";
  if (status === "needs_review" || status === "possible_match") return "needs_review";
  return "not_found";
}

function labelForStatus(status: ConfirmImportStatus): string {
  if (status === "imported") return "Imported";
  if (status === "needs_review") return "Needs Review";
  return "Not Found";
}

function labelForGoogleImportStatus(status: SetupImportSnapshotStatus): string {
  if (status === "imported") return "Google Profile Imported";
  if (status === "needs_review" || status === "possible_match") return "Needs Review";
  return "Not Found";
}

function formatRating(value: number | null): string {
  if (value == null) return "";
  return `${value.toFixed(1)} rating`;
}

function formatReviewCount(value: number): string {
  if (!value) return "";
  return `${value} review${value === 1 ? "" : "s"}`;
}

function row(label: string, value: string): ConfirmDisplayRow {
  return { label, value: value || "—" };
}

function buildGoogleSection(snap: GoogleImportSnapshot | null): ConfirmImportSection {
  if (!snap?.importedAt) {
    return {
      id: "google",
      title: "Google Profile Import",
      status: "not_found",
      statusLabel: labelForStatus("not_found"),
      rows: [],
      notice: "Google Business Profile not imported yet.",
    };
  }

  if (snap.status === "not_found") {
    return {
      id: "google",
      title: "Google Profile Import",
      status: "not_found",
      statusLabel: labelForStatus("not_found"),
      rows: [],
      notice: snap.message || "No Google Business Profile found. You can continue with website import only.",
    };
  }

  if (snap.status === "needs_review" || snap.status === "possible_match") {
    return {
      id: "google",
      title: "Google Profile Import",
      status: "needs_review",
      statusLabel: labelForStatus("needs_review"),
      rows: [],
      notice: snap.message || "Possible Google listings found — please select the correct one below.",
    };
  }

  const status = snapshotStatusLabel(snap.status);
  const rows = [
    row("Business name", snap.businessName),
    row("Rating", formatRating(snap.rating)),
    row("Review count", formatReviewCount(snap.reviewCount)),
    row("Photo count", snap.photoCount ? String(snap.photoCount) : ""),
    row("Category", snap.categories.join(", ")),
    row("Address", snap.address),
    row("Phone", snap.phone),
    row("Website", snap.website),
    row("Opening hours", snap.openingHours.join(" · ")),
    row("Google Maps link", snap.googleMapsUrl),
  ];

  return {
    id: "google",
    title: "Google Profile Import",
    status,
    statusLabel: labelForGoogleImportStatus(snap.status),
    rows,
    notice: snap.message || "Google Profile imported.",
  };
}

function buildWebsiteSection(snap: WebsiteImportSnapshot | null): ConfirmImportSection {
  if (!snap?.importedAt) {
    return {
      id: "website",
      title: "Website Import",
      status: "not_found",
      statusLabel: labelForStatus("not_found"),
      rows: [],
      notice: "Website not imported yet.",
    };
  }

  if (snap.status === "not_found") {
    return {
      id: "website",
      title: "Website Import",
      status: "not_found",
      statusLabel: labelForStatus("not_found"),
      rows: [],
      notice: snap.message || "Website import incomplete. You can continue with Google Profile only.",
    };
  }

  const intel = snap.intelligence;
  const status = snapshotStatusLabel(snap.status);
  const rows: ConfirmDisplayRow[] = [];

  if (intel) {
    const visibleCount = snap.customerVisibleServices?.length ?? 0;
    const servicesDetectedValue =
      visibleCount > 0
        ? String(visibleCount)
        : String(intel.services.filter((s) => s.exists).length);
    const addressCandidate = bestWebsiteAddressCandidate(intel.business) || intel.business.addressCandidates[0];
    const websiteFields = resolveCanonicalWebsiteBusinessFields(intel.business);
    rows.push(
      row("Website URL", intel.identity.websiteUrl),
      row("Resolved URL", intel.identity.resolvedUrl),
      row("Website title", intel.identity.title),
      row("Business name", websiteFields.businessName?.selected || ""),
      row("Phone", websiteFields.phone?.selected || ""),
      row("Email", websiteFields.email?.selected || ""),
      row("Address", websiteFields.address?.selected || ""),
      row("Town", websiteFields.town?.selected || ""),
      row("Postcode", websiteFields.postcode?.selected || ""),
      row("Address source", addressCandidate?.sourceUrl || ""),
      row("Address confidence", addressCandidate ? `${addressCandidate.confidence}% · ${addressCandidate.sourceType}` : ""),
      row("Opening hours", intel.business.openingHours.selected),
      row("Logo", intel.identity.logoUrl ? "Found" : ""),
      row("Brand colours", [intel.identity.brandPrimaryColor, intel.identity.brandSecondaryColor].filter(Boolean).join(" · ")),
      row("CMS", intel.identity.cmsDetected),
      row("Analytics", intel.identity.analyticsDetected.join(", ")),
      row("Total pages", String(intel.structure.totalPages)),
      row("Service pages", String(intel.structure.servicePages)),
      row("Blog articles", String(intel.structure.blogArticles)),
      row("FAQ pages", String(intel.structure.faqPages)),
      row("Services detected", servicesDetectedValue),
      row("Website completeness", `${intel.seoSnapshot.overallCompletenessPercent}%`),
    );
    if (intel.customerSummary.alreadyHas.length) {
      rows.push(row("Already on your site", intel.customerSummary.alreadyHas.slice(0, 4).join(" · ")));
    }
    if (intel.customerSummary.missing.length) {
      rows.push(row("Missing or thin", intel.customerSummary.missing.slice(0, 4).join(" · ")));
    }
  } else {
    const colours = [snap.brandPrimaryColor, snap.brandSecondaryColor, snap.brandAccentColor].filter(Boolean).join(" · ");
    rows.push(
      row("Website URL", snap.websiteUrl),
      row("Logo", snap.logoUrl ? "Found" : ""),
      row("Brand colours", colours),
      row("Phone", snap.phone),
      row("Email", snap.email),
      row("Address", snap.address),
      row("Services detected", (snap.customerVisibleServices?.length
        ? snap.customerVisibleServices.map((s) => s.serviceName)
        : snap.servicesDetected
      )
        .slice(0, 6)
        .join(", ")),
      row("Description", snap.description.slice(0, 200)),
    );
  }

  const gphcCandidate = (snap.regulatoryEvidence || []).find((item) => item.type === "gphc-premises") || null;
  if (gphcCandidate) {
    rows.push(
      row("GPhC candidate detected", gphcCandidate.detectedValue),
      row("GPhC confirmation required", gphcCandidate.verificationStatus === "customer-confirmation-required" ? "Yes" : "No"),
      row("GPhC source", gphcCandidate.sourceUrl),
      row("GPhC source context", gphcCandidate.sourceSelector || gphcCandidate.sourceContext || "—"),
      row("GPhC confidence", gphcCandidate.confidence != null ? `${gphcCandidate.confidence}%` : "—"),
    );
  }

  const completeness = buildWebsiteImportCompletenessReport(snap);
  rows.push(
    row("Import completeness score", `${completeness.overallScore}%`),
    row("Confirmation gaps", completeness.confirmationGaps.join("; ") || "None"),
  );

  return {
    id: "website",
    title: "Website Intelligence Import",
    status,
    statusLabel: status === "imported" ? "Website Intelligence Imported" : labelForStatus(status),
    rows,
    notice: snap.message || intel?.customerSummary.competitorNote || "Website data comes from your website only — not from Google.",
  };
}

function buildWebsiteBrandSummary(snap: WebsiteImportSnapshot | null): CustomerSetupWebsiteBrandSummary {
  const intel = snap?.intelligence;
  if (!snap?.importedAt || snap.status === "not_found") {
    return {
      visible: false,
      websiteTitle: "",
      businessName: "",
      logoUrl: "",
      logoStatus: "NOT FOUND",
      primaryColor: "",
      secondaryColor: "",
      accentColor: "",
      cms: "",
      analytics: "",
      headerDetected: false,
      footerDetected: false,
      colourSource: "",
      totalPages: 0,
    };
  }

  const pages = intel?.structure.pages || [];
  return {
    visible: true,
    websiteTitle: intel?.identity.title || "",
    businessName: intel?.business.businessName.selected || "",
    logoUrl: intel?.identity.logoUrl || snap.logoUrl || "",
    logoStatus: (intel?.identity.logoUrl || snap.logoUrl) ? "FOUND" : "NOT FOUND",
    primaryColor: intel?.identity.brandPrimaryColor || snap.brandPrimaryColor || "",
    secondaryColor: intel?.identity.brandSecondaryColor || snap.brandSecondaryColor || "",
    accentColor: intel?.identity.brandAccentColor || snap.brandAccentColor || "",
    cms: intel?.identity.cmsDetected || "",
    analytics: intel?.identity.analyticsDetected.join(", ") || "",
    headerDetected: pages.some((p) => p.category === "homepage") || Boolean(intel?.identity.logoUrl || snap.logoUrl),
    footerDetected: Boolean((snap.footerLinks || []).length || intel?.structure.policyPages || intel?.structure.contactPages),
    colourSource: intel ? "website identity / brand-importer" : "website snapshot",
    totalPages: intel?.structure.totalPages || 0,
  };
}

function buildWebsiteAddressEvidence(snap: WebsiteImportSnapshot | null): CustomerSetupWebsiteAddressEvidence {
  const candidate = bestWebsiteAddressCandidate(snap?.intelligence?.business);
  if (!candidate) {
    return {
      visible: false,
      importedDisplayAddress: "",
      addressLine1: "",
      town: "",
      postcode: "",
      sourceUrl: "",
      sourceType: "",
      matchedSnippet: "",
      confidence: 0,
    };
  }
  return {
    visible: true,
    importedDisplayAddress: resolveImportedDisplayAddress(snap),
    addressLine1: candidate.addressLine1,
    town: candidate.town,
    postcode: candidate.postcode,
    sourceUrl: candidate.sourceUrl,
    sourceType: candidate.sourceType,
    matchedSnippet: candidate.matchedSnippet,
    confidence: candidate.confidence,
  };
}

function valueForDraft(key: string, draft: ReturnType<typeof buildWebsiteDraftValues>): string {
  return String((draft as unknown as Record<string, string>)[key] || "");
}

function sourceFor(key: string, sources: Record<string, CustomerSetupFieldSource | "">): CustomerSetupFieldSource | "" {
  const source = sources[key];
  return source === "google" || source === "website" || source === "manual" ? source : "";
}

function addImportedKey(
  target: Set<string>,
  fieldKey: string,
  sources: Record<string, CustomerSetupFieldSource | "">,
  expectedSource: CustomerSetupFieldSource,
): void {
  if (sourceFor(fieldKey, sources) === expectedSource) target.add(fieldKey);
}

function websiteEvidence(
  snap: WebsiteImportSnapshot | null | undefined,
): Pick<ConfirmFieldWithSource, "sourceUrl" | "evidenceLabel" | "matchedSnippet"> {
  const candidate = bestWebsiteAddressCandidate(snap?.intelligence?.business);
  if (!candidate) return {};
  return {
    sourceUrl: candidate.sourceUrl,
    evidenceLabel: `Verified from website · ${candidate.confidence}% · ${candidate.sourceType}`,
    matchedSnippet: candidate.matchedSnippet,
  };
}

function resolveField(
  key: string,
  baseline: ReturnType<typeof readAdminBaselineFields>,
  sources: Record<string, CustomerSetupFieldSource>,
  websiteDraft: ReturnType<typeof buildWebsiteDraftValues>,
  googleDraft: ReturnType<typeof buildGoogleDraftValues>,
  websiteSnap?: WebsiteImportSnapshot | null,
): ConfirmFieldWithSource {
  const websiteValue = valueForDraft(key, websiteDraft);
  const googleValue = valueForDraft(key, googleDraft);
  const manualValue = key === "pharmacyName"
    ? baseline.pharmacyName
    : key === "website"
      ? baseline.website
      : key === "phone"
        ? baseline.phone
        : key === "email"
          ? baseline.email
          : key === "address"
            ? baseline.address
            : key === "town"
              ? baseline.town
              : key === "postcode"
                ? baseline.postcode
                : "";

  const picked = (value: string, source: CustomerSetupFieldSource | ""): ConfirmFieldWithSource => ({
    value,
    source,
    ...(source === "website" && (key === "address" || key === "town" || key === "postcode") ? websiteEvidence(websiteSnap) : {}),
  });

  if (key === "address") {
    if (googleValue) return picked(googleValue, "google");
    if (manualValue) return picked(manualValue, sources[key] || baseline.sources[key] || "manual");
    if (websiteValue) return picked(websiteValue, "website");
    return picked("", "");
  }
  if (key === "town" || key === "postcode") {
    if (manualValue) return picked(manualValue, sources[key] || baseline.sources[key] || "manual");
    if (googleValue) return picked(googleValue, "google");
    if (websiteValue) return picked(websiteValue, "website");
    return picked("", "");
  }

  const source = sources[key] || (websiteValue && websiteDraft.sources[key] === "website" ? "website" : baseline.sources[key] || "");
  let value = websiteValue || "";
  if (key === "pharmacyName") value = websiteValue || baseline.pharmacyName;
  if (key === "website") value = value || baseline.website;
  if (key === "phone") value = value || baseline.phone;
  if (key === "email") value = value || baseline.email;
  return { value, source };
}

export function buildCustomerSetupConfirmView(slug: string): CustomerSetupConfirmView {
  const data = readSetupProfile(slug);
  const googleSnap = data.googleImportSnapshot;
  const websiteSnap = data.websiteImportSnapshot;
  const sources = { ...(data.customerSetupFieldSources || {}) };
  const baseline = readAdminBaselineFields(data);
  const websiteDraft = buildWebsiteDraftValues(data);
  const googleDraft = buildGoogleDraftValues(data);

  const gphcCandidate =
    (websiteSnap?.regulatoryEvidence || []).find((item) => item.type === "gphc-premises") || null;
  const completeness = buildWebsiteImportCompletenessReport(websiteSnap, data);
  const businessDetailConflicts = buildBusinessDetailConflicts(data, websiteSnap);

  return {
    slug,
    googleSection: buildGoogleSection(googleSnap),
    websiteSection: buildWebsiteSection(websiteSnap),
    googleCandidates: googleSnap?.importedAt && googleSnap.candidates?.length ? googleSnap.candidates : [],
    googleSelectorVisible: Boolean(googleSnap?.importedAt && googleSnap.candidates?.length),
    nationalWebsiteWarning: Boolean(googleSnap?.nationalWebsiteDetected),
    fields: {
      pharmacyName: resolveField("pharmacyName", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      website: resolveField("website", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      phone: resolveField("phone", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      email: resolveField("email", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      address: resolveField("address", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      town: resolveField("town", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      postcode: resolveField("postcode", baseline, sources, websiteDraft, googleDraft, websiteSnap),
      gphcNumber: {
        value: str(data.gphcNumber) || gphcCandidate?.detectedValue || "",
        source: str(data.gphcNumber) ? "manual" : gphcCandidate ? "website" : "",
        evidenceLabel: gphcCandidate ? "Imported regulatory candidate" : "",
        sourceUrl: gphcCandidate?.sourceUrl || "",
        matchedSnippet: gphcCandidate?.sourceContext || gphcCandidate?.sourceSelector || "",
      },
    },
    gphcCandidate,
    importCompletenessScore: completeness.overallScore,
    importConfirmationGaps: completeness.confirmationGaps,
    businessDetailConflicts,
    commercialReady: completeness.commercialReady,
    unresolvedImportantFields: completeness.unresolvedImportantFields,
    googleDraft,
    websiteDraft,
    websiteBrandSummary: buildWebsiteBrandSummary(websiteSnap),
    websiteAddressEvidence: buildWebsiteAddressEvidence(websiteSnap),
    localMarketUrl: `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
    setupStartUrl: `/api/growth-engine/start?slug=${encodeURIComponent(slug)}`,
  };
}

export function runCustomerSetupConfirm(slug: string, input: CustomerSetupConfirmInput): CustomerSetupConfirmResult {
  const pharmacyName = str(input.pharmacyName);
  const website = str(input.website);
  const phone = str(input.phone);
  const email = str(input.email);
  const address = str(input.address);
  const town = str(input.town);
  const postcode = str(input.postcode).toUpperCase();

  const gphcNumber = str(input.gphcNumber);
  const gphcConfirmation = str(input.gphcConfirmation);
  const effectiveGphcConfirmation = gphcConfirmation || (gphcNumber ? "confirm" : "");
  const displayAddressResolution = str(input.displayAddressResolution);
  const displayAddressManual = str(input.displayAddress);
  const fieldResolutions = input.fieldResolutions || {};

  if (!pharmacyName) throw new Error("Pharmacy name is required");
  if (!website) throw new Error("Website is required");
  if (!town) throw new Error("Town is required");
  if (!postcode) throw new Error("Postcode is required");

  const existing = readSetupProfile(slug);
  const now = new Date().toISOString();
  const googleSnap = existing.googleImportSnapshot;
  const websiteSnap = existing.websiteImportSnapshot;
  const fieldSources = { ...(input.fieldSources || existing.customerSetupFieldSources || {}) };
  const normalizedSources: Record<string, CustomerSetupFieldSource> = {};
  for (const [key, value] of Object.entries(fieldSources)) {
    if (value === "google" || value === "website" || value === "manual") normalizedSources[key] = value;
  }
  const profileSourceMap: Array<[string, string]> = [
    ["pharmacyName", "pharmacyName"],
    ["tradingName", "pharmacyName"],
    ["website", "website"],
    ["phone", "phone"],
    ["businessEmail", "email"],
    ["email", "email"],
    ["addressLine1", "address"],
    ["primaryTown", "town"],
    ["primaryCity", "town"],
    ["townCity", "town"],
    ["postcode", "postcode"],
  ];
  for (const [profileKey, formKey] of profileSourceMap) {
    const source = sourceFor(formKey, normalizedSources);
    if (source) normalizedSources[profileKey] = source;
  }

  const confirmations: Record<string, string> = { ...(existing.profileFieldConfirmations || {}) };
  for (const key of ["pharmacyName", "tradingName", "website", "phone", "businessEmail", "email", "addressLine1", "primaryTown", "primaryCity", "townCity", "postcode"]) {
    confirmations[key] = now;
  }

  const normalizedWebsite = website.startsWith("http") ? website : `https://${website}`;

  const patch: Partial<PharmacyProfileData> = {
    pharmacyName,
    tradingName: pharmacyName,
    website: normalizedWebsite,
    phone,
    businessEmail: email,
    email,
    addressLine1: address,
    primaryTown: town,
    primaryCity: town,
    townCity: town,
    postcode,
    profileFieldConfirmations: confirmations,
    customerSetupFieldSources: normalizedSources,
    platformClientStatus: existing.platformClientStatus === "setup_required" ? "setup_in_progress" : existing.platformClientStatus,
  };

  if (effectiveGphcConfirmation === "confirm" && gphcNumber) {
    patch.gphcNumber = gphcNumber;
    confirmations.gphcNumber = now;
    normalizedSources.gphcNumber = "website";
    patch.profileFieldConfirmations = confirmations;
    patch.customerSetupFieldSources = normalizedSources;
    if (websiteSnap) {
      patch.websiteImportSnapshot = {
        ...websiteSnap,
        regulatoryEvidence: (websiteSnap.regulatoryEvidence || []).map((item) =>
          item.type === "gphc-premises"
            ? { ...item, verificationStatus: "confirmed", detectedValue: gphcNumber }
            : item,
        ),
      };
    }
  } else if (effectiveGphcConfirmation === "reject" && websiteSnap) {
    patch.websiteImportSnapshot = {
      ...websiteSnap,
      regulatoryEvidence: (websiteSnap.regulatoryEvidence || []).map((item) =>
        item.type === "gphc-premises" ? { ...item, verificationStatus: "rejected" } : item,
      ),
    };
  }

  const addressResolution =
    displayAddressResolution ||
    fieldResolutions.displayAddress ||
    "";
  const addressConflicts = buildBusinessDetailConflicts(existing, websiteSnap);
  const hasDisplayAddressConflict = addressConflicts.some((item) => item.field === "displayAddress");
  const effectiveAddressResolution =
    addressResolution || (hasDisplayAddressConflict ? "use-imported" : "");
  let expectedDisplayAddress = "";
  if (effectiveAddressResolution === "use-imported" && websiteSnap) {
    patch.displayAddress = resolveImportedDisplayAddress(websiteSnap);
    expectedDisplayAddress = patch.displayAddress;
    confirmations.displayAddress = now;
    patch.profileFieldConfirmations = confirmations;
  } else if (effectiveAddressResolution === "edit-manually" && displayAddressManual) {
    patch.displayAddress = displayAddressManual;
    expectedDisplayAddress = displayAddressManual;
    confirmations.displayAddress = now;
    patch.profileFieldConfirmations = confirmations;
  } else if (effectiveAddressResolution === "keep-canonical") {
    confirmations.displayAddress = now;
    patch.profileFieldConfirmations = confirmations;
  }

  const gphcCandidate =
    (websiteSnap?.regulatoryEvidence || []).find((item) => item.type === "gphc-premises") || null;
  const requiresGphcConfirm =
    Boolean(gphcCandidate && gphcCandidate.verificationStatus === "customer-confirmation-required");
  const expectedGphcNumber =
    effectiveGphcConfirmation === "confirm" ? gphcNumber : effectiveGphcConfirmation === "reject" ? "" : gphcNumber;
  if (requiresGphcConfirm && effectiveGphcConfirmation === "confirm" && !gphcNumber) {
    throw new Error("GPhC registration number confirmation requires a value");
  }
  if (requiresGphcConfirm && effectiveGphcConfirmation === "confirm" && gphcCandidate && gphcNumber !== gphcCandidate.detectedValue) {
    // Manual correction is allowed; value must still be non-empty and written canonically.
  }

  if (googleSnap?.status === "imported" && googleSnap.placeId) {
    patch.googlePlaceId = googleSnap.placeId;
    patch.googleBusinessProfileUrl = googleSnap.googleMapsUrl;
    patch.googleBusinessRating = googleSnap.rating;
    patch.googleBusinessReviewCount = googleSnap.reviewCount;
    patch.latitude = googleSnap.latitude != null ? String(googleSnap.latitude) : existing.latitude;
    patch.longitude = googleSnap.longitude != null ? String(googleSnap.longitude) : existing.longitude;
    normalizedSources.googlePlaceId = "google";
    patch.googleImportedFieldKeys = [
      "googlePlaceId",
      "googleBusinessProfileUrl",
      "googleBusinessRating",
      "googleBusinessReviewCount",
    ];
  }

  if (websiteSnap?.status === "imported" || websiteSnap?.status === "needs_review") {
    patch.logoUrl = websiteSnap.logoUrl || existing.logoUrl;
    patch.brandPrimaryColor = websiteSnap.brandPrimaryColor || existing.brandPrimaryColor;
    patch.brandSecondaryColor = websiteSnap.brandSecondaryColor || existing.brandSecondaryColor;
    patch.brandAccentColor = websiteSnap.brandAccentColor || existing.brandAccentColor;
    patch.brandBackgroundColor = websiteSnap.brandBackgroundColor || existing.brandBackgroundColor;
    patch.brandTextColor = websiteSnap.brandTextColor || existing.brandTextColor;
    patch.businessDescription = websiteSnap.description || existing.businessDescription;
    patch.openingHours = websiteSnap.openingHours || existing.openingHours;
    patch.websiteAnalysisAt = websiteSnap.importedAt || new Date().toISOString();
    patch.websiteAnalysisSourceUrl = websiteSnap.websiteUrl;
    patch.detectedWebsiteServices = websiteSnap.servicesDetected.map((serviceName, i) => ({
      serviceId: `website-${i + 1}`,
      serviceName,
      confidence: 80,
    }));
    const websiteImportedFieldKeys = new Set<string>([
      "logoUrl",
      "brandPrimaryColor",
      "brandSecondaryColor",
      "brandAccentColor",
      "businessDescription",
      "openingHours",
      "detectedWebsiteServices",
    ].filter((k) => Boolean((patch as Record<string, unknown>)[k])));
    addImportedKey(websiteImportedFieldKeys, "pharmacyName", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "website", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "phone", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "email", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "address", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "town", normalizedSources, "website");
    addImportedKey(websiteImportedFieldKeys, "postcode", normalizedSources, "website");
    patch.websiteImportedFieldKeys = [...websiteImportedFieldKeys];
  }

  const googleImportedFieldKeys = new Set<string>(patch.googleImportedFieldKeys || existing.googleImportedFieldKeys || []);
  addImportedKey(googleImportedFieldKeys, "pharmacyName", normalizedSources, "google");
  addImportedKey(googleImportedFieldKeys, "website", normalizedSources, "google");
  addImportedKey(googleImportedFieldKeys, "phone", normalizedSources, "google");
  addImportedKey(googleImportedFieldKeys, "address", normalizedSources, "google");
  addImportedKey(googleImportedFieldKeys, "town", normalizedSources, "google");
  addImportedKey(googleImportedFieldKeys, "postcode", normalizedSources, "google");
  patch.googleImportedFieldKeys = [...googleImportedFieldKeys];

  writeSetupProfile(slug, normalizeProfileData({ ...existing, ...patch }), { bumpPresentationRevision: true });
  invalidatePharmacyPresentationProfileCache(slug);

  if (input.confirmBrand || input.brandLogoUrl || input.brandPrimaryColor || input.brandHeadingFont) {
    confirmTenantBrandIdentity(slug, {
      logoUrl: str(input.brandLogoUrl),
      primaryColor: str(input.brandPrimaryColor),
      secondaryColor: str(input.brandSecondaryColor),
      accentColor: str(input.brandAccentColor),
      headingFont: str(input.brandHeadingFont),
      bodyFont: str(input.brandBodyFont),
    });
  }

  const readBack = readSetupProfile(slug);
  if (effectiveGphcConfirmation === "confirm") {
    if (!readBack.gphcNumber) {
      throw new Error("GPhC confirmation failed: canonical profile field was not persisted");
    }
    if (expectedGphcNumber && readBack.gphcNumber !== expectedGphcNumber) {
      throw new Error("GPhC confirmation failed: canonical profile value mismatch after save");
    }
  }
  if (expectedDisplayAddress) {
    if (readBack.displayAddress !== expectedDisplayAddress) {
      throw new Error("Display address confirmation failed: canonical displayAddress was not persisted");
    }
    if (!readBack.profileFieldConfirmations?.displayAddress) {
      throw new Error("Display address confirmation failed: confirmation timestamp missing");
    }
  }

  const renderBatch = renderPresentationPagesBatch({
    slug,
    serviceId: "pharmacy-first",
    localSlugs: ["wickersley", "bramley"],
  });
  const serviceProof = renderBatch.proofs.find((proof) => proof.page === "service");
  const serviceHtml = serviceProof ? fs.readFileSync(serviceProof.outputPath, "utf8") : "";
  const outputCheck = verifyPresentationOutputContains(serviceHtml, {
    gphcNumber: readBack.gphcNumber || undefined,
    displayAddress: readBack.displayAddress || undefined,
  });
  if ((readBack.gphcNumber || readBack.displayAddress) && !outputCheck.ok) {
    throw new Error(`Presentation re-render verification failed: ${outputCheck.missing.join(", ")}`);
  }

  return {
    ok: true,
    slug,
    redirectUrl: `/api/growth-engine/local-market?slug=${encodeURIComponent(slug)}`,
  };
}

export function readCustomerSetupProfile(slug: string): PharmacyProfileData {
  return readSetupProfile(slug);
}

export function customerSetupConfirmUrl(slug: string): string {
  return `/api/growth-engine/confirm-pharmacy?slug=${encodeURIComponent(slug)}`;
}
