/**
 * CPR-02A — Evidence readiness panel and required evidence gate.
 */
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { buildGenerationSetupState } from "./masterAdminGenerationSetupService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { resolveTrustedCanonicalServiceIds } from "./growthEngineWebsiteDiscoveredServiceReconciliation.ts";
import { getPharmacyBrandDnaPath } from "./pharmacyBrandDnaStore.ts";
import { getPharmacyComponentDnaPath, hasCanonicalComponentDna } from "./masterAdminComponentDnaPersistenceService.ts";
import { loadMasterAdminCustomerContext } from "./masterAdminCustomerContextService.ts";
import { isLockedCommercialSupportedService } from "./masterAdminLockedCommercialServiceCatalog.ts";
import { loadBrandDnaV1File } from "./pharmacyBrandDnaStore.ts";
import {
  buildDesignIntelligenceSummary,
  completeWebsiteImportBrandEvidence,
  ensureDesignIntelligenceFromStoredEvidence,
} from "./pharmacyWebsiteImportBrandEvidenceCompletionService.ts";
import { loadWebsiteDesignIntelligence } from "./pharmacyWebsiteDesignCaptureService.ts";
import fs from "node:fs";
import path from "node:path";
import type { ServicePageEvidenceField, ServicePageImageSelection } from "./masterAdminCoreProductRecoveryModel.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveCustomerFacingPharmacyName } from "./pharmacyServicePageProfileContext.ts";
import {
  MANUAL_BRAND_SOURCE_PREFIX,
  readManualOnboardingBrandSource,
} from "./masterAdminGoogleLaterBrandEvidence.ts";

const OPTIONAL_PRODUCT_OWNER_EVIDENCE_FIELDS = new Set([
  "fonts",
  "teamReviewer",
  "yearsServing",
  "languages",
  "accreditations",
  "accessibility",
  "parkingTransport",
]);

export const PRIVATE_SERVICES_OFFERED_FIELD_ID = "privateServicesOffered";
export const PRIVATE_SERVICES_OFFERED_LABEL = "Private services offered?";

const REQUIRED_PRODUCT_OWNER_EVIDENCE_FIELDS = new Set([PRIVATE_SERVICES_OFFERED_FIELD_ID]);

/** Fields that never require an explicit Product Owner click. */
const SYSTEM_EVIDENCE_FIELD_IDS = new Set(["expectedDuration", "unknownEvidence"]);

/** Service Page Evidence fields that still require an explicit PO decision after Business Profile approval. */
export const SERVICE_PAGE_REQUIRES_PO_CONFIRMATION_FIELD_IDS = new Set([
  PRIVATE_SERVICES_OFFERED_FIELD_ID,
  "consultationProcess",
  "lockedService",
  "serviceOfferedConfirmation",
]);

/** Identity of the locked campaign service — already confirmed in Business Profile canonical service set. */
const CANONICAL_SERVICE_IDENTITY_EVIDENCE_FIELD_IDS = new Set(["lockedService", "serviceOfferedConfirmation"]);

export function requiresServicePageProductOwnerConfirmation(fieldId: string, group: string): boolean {
  if (SYSTEM_EVIDENCE_FIELD_IDS.has(fieldId)) return false;
  return SERVICE_PAGE_REQUIRES_PO_CONFIRMATION_FIELD_IDS.has(fieldId);
}

export function isCampaignServiceCanonicallyConfirmed(slug: string, serviceId: string): boolean {
  const want = normalizeServiceId(serviceId);
  if (!want) return false;
  const approval = readLatestApprovalSnapshot(slug);
  if (!approval?.approvedAt) {
    return resolveTrustedCanonicalServiceIds(slug).some((id) => normalizeServiceId(id) === want);
  }
  const profile = readSetupProfile(slug);
  const confirmations = (profile.profileFieldConfirmations || {}) as Record<string, unknown>;
  const approvedIds = Array.isArray(confirmations.approvedCanonicalServiceIds)
    ? confirmations.approvedCanonicalServiceIds.map((id) => normalizeServiceId(String(id)))
    : [];
  const selectedIds = (profile.selectedServices || []).map((id) => normalizeServiceId(String(id)));
  const trustedIds = resolveTrustedCanonicalServiceIds(slug).map((id) => normalizeServiceId(id));
  return new Set([...approvedIds, ...selectedIds, ...trustedIds].filter(Boolean)).has(want);
}

/** Marks non–service-specific evidence confirmed when Business Profile is approved (canonical store). */
export function applyBusinessProfileApprovalEvidenceInheritance(
  slug: string,
  fields: ServicePageEvidenceField[],
  serviceId?: string,
): ServicePageEvidenceField[] {
  const approval = readLatestApprovalSnapshot(slug);
  if (!approval?.approvedAt) return fields;
  const campaignServiceConfirmed = Boolean(serviceId && isCampaignServiceCanonicallyConfirmed(slug, serviceId));

  for (const field of fields) {
    if (field.productOwnerDecided) continue;
    if (field.status === "not_applicable") continue;
    if (SYSTEM_EVIDENCE_FIELD_IDS.has(field.id)) continue;
    if (
      campaignServiceConfirmed &&
      CANONICAL_SERVICE_IDENTITY_EVIDENCE_FIELD_IDS.has(field.id) &&
      text(field.value)
    ) {
      field.status = "confirmed";
      field.productOwnerDecided = true;
      continue;
    }
    if (requiresServicePageProductOwnerConfirmation(field.id, String(field.group))) continue;

    if (text(field.value)) {
      field.status = "confirmed";
      field.productOwnerDecided = true;
    }
  }
  return fields;
}

/** Evidence Review field contract used by the publication quality gate. Read-only. */
export function buildPublicationQualityApprovedEvidence(
  slug: string,
  serviceId: string,
): Record<string, { value: string; status: string }> {
  const fields = applyBusinessProfileApprovalEvidenceInheritance(
    slug,
    buildCprEvidenceFields(slug, serviceId),
    serviceId,
  );
  const approvedEvidence: Record<string, { value: string; status: string }> = {};
  for (const field of fields) {
    approvedEvidence[field.id] = { value: String(field.value || ""), status: field.status };
  }
  return approvedEvidence;
}

export type EvidenceDisplayStatus = "confirmed" | "not_confirmed" | "not_applicable";

function text(value: unknown): string | null {
  const v = String(value ?? "").trim();
  return v || null;
}

function evidenceField(
  id: string,
  label: string,
  group: ServicePageEvidenceField["group"],
  value: string | null | undefined,
  options: { required?: boolean; source?: string | null; notApplicable?: boolean; deferConfirmation?: boolean } = {},
): ServicePageEvidenceField {
  let status: EvidenceDisplayStatus;
  if (options.notApplicable) status = "not_applicable";
  else if (options.deferConfirmation && text(value)) status = "not_confirmed";
  else if (text(value)) status = "confirmed";
  else status = "not_confirmed";
  return {
    id,
    label,
    group,
    value: text(value),
    status,
    required: Boolean(options.required),
    source: options.source || null,
  };
}

function serviceOffered(slug: string, profile: ReturnType<typeof readSetupProfile>, serviceId: string): string | null {
  const selected = (profile.selectedServices || []).map(String);
  if (selected.includes(serviceId)) return "Confirmed in customer service selection";
  const ctx = loadMasterAdminCustomerContext(slug);
  if (ctx?.serviceId === serviceId) return "Confirmed as primary campaign service";
  return null;
}

function walkInAppointmentState(profile: ReturnType<typeof readSetupProfile>, approved: Record<string, string>): string | null {
  const walkIn = text(profile.walkInAvailable ?? profile.pharmacyFirstAvailability ?? approved.pharmacyFirstAvailability);
  const appointment = text(approved.appointmentMethod || profile.appointmentMethod);
  if (walkIn && appointment) return `Walk-in: ${walkIn}; Appointment: ${appointment}`;
  if (walkIn) return `Walk-in: ${walkIn}`;
  if (appointment) return `Appointment: ${appointment}`;
  return null;
}

function resolveBrandSource(slug: string): string | null {
  const brand = loadBrandDnaV1File(slug);
  if (brand?.source === "website-import" || fs.existsSync(getPharmacyBrandDnaPath(slug))) {
    const website = text(brand?.sourceUrl);
    const revision = text(brand?.sourceImportRevision);
    const capturedAt = text(brand?.frozenAt || brand?.generatedAt);
    return [
      "website-import-brand-dna",
      website ? `website=${website}` : null,
      revision ? `revision=${revision}` : null,
      capturedAt ? `capturedAt=${capturedAt}` : null,
    ]
      .filter(Boolean)
      .join(" · ");
  }
  const componentPath = getPharmacyComponentDnaPath(slug);
  if (fs.existsSync(componentPath)) {
    return "website-import-component-dna";
  }
  return readManualOnboardingBrandSource(slug);
}

export interface CprBrandEvidenceResolution {
  value: string | null;
  source: string | null;
  confidence: number | null;
  capturedAt: string | null;
}

function resolveCprBrandEvidence(slug: string): {
  logo: CprBrandEvidenceResolution;
  footer: CprBrandEvidenceResolution;
  navigation: CprBrandEvidenceResolution;
  buttons: CprBrandEvidenceResolution;
  brandSource: CprBrandEvidenceResolution;
  designIntelligence: CprBrandEvidenceResolution;
} {
  const profile = readSetupProfile(slug);
  const approval = readLatestApprovalSnapshot(slug);
  const approved = approval?.finalValues || {};
  const brand = loadBrandDnaV1File(slug);
  const componentDna = loadComponentDna(slug);
  const header = (componentDna?.header || {}) as Record<string, unknown>;
  const footer = (componentDna?.footer || {}) as Record<string, unknown>;
  const cta = (componentDna?.cta || {}) as Record<string, unknown>;
  const snap = profile.websiteImportSnapshot as
    | { logoUrl?: string; importedAt?: string; intelligence?: { identity?: { logoUrl?: string }; importedAt?: string } }
    | undefined;
  const capturedAt = text(brand?.frozenAt || brand?.generatedAt || snap?.importedAt || snap?.intelligence?.importedAt);

  const logoValue =
    text(approved.logo || profile.logoUrl) ||
    text(brand?.logoUrl) ||
    text(snap?.logoUrl) ||
    text(snap?.intelligence?.identity?.logoUrl);
  const logoSource = text(approved.logo || profile.logoUrl)
    ? "business-profile"
    : text(brand?.logoUrl)
      ? "brand-dna"
      : text(snap?.logoUrl || snap?.intelligence?.identity?.logoUrl)
        ? "website-import"
        : null;

  const footerParts = [
    text(footer.variant),
    brand?.footerEvidence?.columnCount ? `${brand.footerEvidence.columnCount} columns` : null,
    brand?.footerEvidence?.hasCopyrightRow ? "copyright row" : null,
    brand?.footerEvidence?.hasContactBlock ? "contact block" : null,
  ].filter(Boolean);
  const footerValue = footerParts.length ? footerParts.join(" · ") : text(footer.variant);

  const navLinks = (brand?.navigationLinks || []).filter((l) => text(l.label)).slice(0, 6);
  const navigationParts = [
    text(header.navigationVariant),
    navLinks.length ? `${navLinks.length} links (${navLinks.map((l) => l.label).join(", ")})` : null,
    text(header.mobileHeaderVariant) ? `mobile=${text(header.mobileHeaderVariant)}` : null,
  ].filter(Boolean);
  const navigationValue = navigationParts.length ? navigationParts.join(" · ") : text(header.navigationVariant);

  const buttonPrimary = (cta.headerPrimary || {}) as Record<string, unknown>;
  const buttonParts = [
    text(cta.variant),
    text(cta.buttonRadius || buttonPrimary.radius) ? `radius ${text(cta.buttonRadius || buttonPrimary.radius)}` : null,
    text(buttonPrimary.style) ? `style ${text(buttonPrimary.style)}` : null,
    text(buttonPrimary.background) ? `bg ${text(buttonPrimary.background)}` : null,
    text(buttonPrimary.foreground) ? `text ${text(buttonPrimary.foreground)}` : null,
  ].filter(Boolean);
  const buttonsValue = buttonParts.length ? buttonParts.join(" · ") : text(cta.variant);

  ensureDesignIntelligenceFromStoredEvidence(slug);
  const designManifest = loadWebsiteDesignIntelligence(slug);
  const designSummary = buildDesignIntelligenceSummary(designManifest);
  const brandSourceValue = resolveBrandSource(slug);

  return {
    logo: {
      value: logoValue,
      source: logoSource,
      confidence: brand?.confidence?.logo ?? (logoSource === "website-import" ? 85 : null),
      capturedAt,
    },
    footer: {
      value: footerValue,
      source: footerValue ? "component-dna" : null,
      confidence: brand?.footerEvidence ? 80 : componentDna ? 70 : null,
      capturedAt,
    },
    navigation: {
      value: navigationValue,
      source: navigationValue ? "component-dna" : null,
      confidence: navLinks.length ? 85 : text(header.navigationVariant) ? 75 : null,
      capturedAt,
    },
    buttons: {
      value: buttonsValue,
      source: buttonsValue ? "component-dna" : null,
      confidence: text(cta.variant) ? 80 : null,
      capturedAt,
    },
    brandSource: {
      value: brandSourceValue,
      source: brandSourceValue?.startsWith(MANUAL_BRAND_SOURCE_PREFIX)
        ? "onboarding-business-information"
        : brandSourceValue?.startsWith("website-import-brand-dna")
          ? "brand-dna"
          : brandSourceValue
            ? "component-dna"
            : null,
      confidence: brandSourceValue ? 90 : null,
      capturedAt,
    },
    designIntelligence: {
      value: designSummary,
      source: designSummary ? "design-intelligence" : null,
      confidence: designSummary ? ((designManifest as { summary?: { evidenceCompleteness?: number } } | null)?.summary?.evidenceCompleteness ?? 70) : null,
      capturedAt,
    },
  };
}

function readRawProfileData(slug: string): Record<string, unknown> {
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return {};
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: Record<string, unknown> };
    return doc.data && typeof doc.data === "object" ? doc.data : {};
  } catch {
    return {};
  }
}

function explicitPrivateServicesToken(value: unknown): "Yes" | "No" | null {
  const token = String(value ?? "").trim().toLowerCase();
  if (token === "yes" || token === "true" || token === "offered") return "Yes";
  if (token === "no" || token === "false" || token === "not offered" || token === "not available") return "No";
  return null;
}

/**
 * Pharmacy-level Yes/No only. Schema default privateServicesAvailable=false is not a No.
 * A Yes does not name which individual services are private.
 */
export function resolvePrivateServicesOfferedAnswer(raw: Record<string, unknown>): "Yes" | "No" | null {
  const fromText = explicitPrivateServicesToken(raw.privateServicesOffered);
  if (fromText) return fromText;
  if (raw.privateServicesAvailable === true) return "Yes";
  if (raw.privateServicesAvailable !== false) return null;
  const sources = raw.customerSetupFieldSources;
  const sourced =
    Boolean(sources) &&
    typeof sources === "object" &&
    "privateServicesAvailable" in (sources as Record<string, unknown>);
  const importedKeys = [
    ...(Array.isArray(raw.websiteImportedFieldKeys) ? raw.websiteImportedFieldKeys : []),
    ...(Array.isArray(raw.googleImportedFieldKeys) ? raw.googleImportedFieldKeys : []),
  ].map((key) => String(key));
  if (sourced || importedKeys.includes("privateServicesAvailable")) return "No";
  return null;
}

export function resolveCprFontsEvidence(slug: string): { value: string | null; source: string | null } {
  const profile = readSetupProfile(slug);
  const profileFont = text((profile as { brandFontFamily?: string }).brandFontFamily);
  if (profileFont) return { value: profileFont, source: "business-profile" };
  const brand = loadBrandDnaV1File(slug);
  const heading = text(brand?.typography?.headingFont);
  const body = text(brand?.typography?.bodyFont);
  if (heading || body) {
    return {
      value: [heading ? `Heading: ${heading}` : null, body ? `Body: ${body}` : null].filter(Boolean).join("; "),
      source: "brand-dna",
    };
  }
  const brandSource = resolveBrandSource(slug);
  if (brandSource) {
    return { value: "Platform default typography stack (sans-serif)", source: "platform-default" };
  }
  return { value: null, source: "brand-dna" };
}

export function enrichReviewableEvidenceFields(
  slug: string,
  fields: ServicePageEvidenceField[],
  serviceId?: string,
): ServicePageEvidenceField[] {
  completeWebsiteImportBrandEvidence(slug);
  const brandEvidence = resolveCprBrandEvidence(slug);
  const campaignServiceConfirmed = Boolean(serviceId && isCampaignServiceCanonicallyConfirmed(slug, serviceId));
  const patchBrandField = (id: string, resolved: CprBrandEvidenceResolution) => {
    const field = fields.find((f) => f.id === id);
    if (!field || !resolved.value) return;
    field.value = resolved.value;
    field.source = resolved.source;
    field.confidence = resolved.confidence ?? null;
    field.capturedAt = resolved.capturedAt ?? null;
  };

  for (const field of fields) {
    if (field.id === "fonts" && !text(field.value)) {
      const resolved = resolveCprFontsEvidence(slug);
      if (resolved.value) {
        field.value = resolved.value;
        field.source = resolved.source;
      }
    }
    patchBrandField("logo", brandEvidence.logo);
    patchBrandField("footer", brandEvidence.footer);
    patchBrandField("navigation", brandEvidence.navigation);
    patchBrandField("buttons", brandEvidence.buttons);
    patchBrandField("brandSource", brandEvidence.brandSource);
    patchBrandField("designIntelligence", brandEvidence.designIntelligence);
    field.required = field.required || REQUIRED_PRODUCT_OWNER_EVIDENCE_FIELDS.has(field.id);
    field.allowNotApplicable = OPTIONAL_PRODUCT_OWNER_EVIDENCE_FIELDS.has(field.id);
    if (campaignServiceConfirmed && CANONICAL_SERVICE_IDENTITY_EVIDENCE_FIELD_IDS.has(field.id)) {
      continue;
    }
    if (
      !field.productOwnerDecided &&
      !SYSTEM_EVIDENCE_FIELD_IDS.has(field.id) &&
      field.status !== "not_applicable" &&
      field.status === "confirmed" &&
      requiresServicePageProductOwnerConfirmation(field.id, String(field.group))
    ) {
      field.status = "not_confirmed";
    }
    field.requiresBusinessProfile =
      field.id !== PRIVATE_SERVICES_OFFERED_FIELD_ID &&
      field.status === "not_confirmed" &&
      field.required &&
      !text(field.value) &&
      !field.allowNotApplicable;
  }
  return fields;
}

export function isOptionalProductOwnerEvidenceField(fieldId: string): boolean {
  return OPTIONAL_PRODUCT_OWNER_EVIDENCE_FIELDS.has(fieldId);
}

function loadComponentDna(slug: string): Record<string, unknown> | null {
  const p = getPharmacyComponentDnaPath(slug);
  if (!fs.existsSync(p)) return null;
  try {
    return JSON.parse(fs.readFileSync(p, "utf8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function buildCprEvidenceFields(slug: string, serviceId: string): ServicePageEvidenceField[] {
  const profile = readSetupProfile(slug);
  const approval = readLatestApprovalSnapshot(slug);
  const approved = approval?.finalValues || {};
  const setup = buildGenerationSetupState(slug);
  const meta = getServicePublishMeta(serviceId);
  const componentDna = loadComponentDna(slug);
  const header = (componentDna?.header || {}) as Record<string, unknown>;
  const footer = (componentDna?.footer || {}) as Record<string, unknown>;
  const cta = (componentDna?.cta || {}) as Record<string, unknown>;

  const fullAddress = [approved.address || profile.addressLine1, profile.addressLine2, approved.postcode || profile.postcode]
    .filter(Boolean)
    .join(", ");

  return [
    evidenceField(
      "pharmacyName",
      "Pharmacy name",
      "business",
      resolveCustomerFacingPharmacyName(profile, approved),
      { required: true, source: "business-profile" },
    ),
    evidenceField("fullAddress", "Full address", "business", fullAddress, { source: "business-profile" }),
    evidenceField("townOrCity", "Town or City", "business", approved.town || profile.primaryTown || profile.townCity, { required: true, source: "business-profile" }),
    evidenceField("postcode", "Postcode", "business", approved.postcode || profile.postcode, { required: true, source: "business-profile" }),
    evidenceField("telephone", "Telephone", "business", approved.telephone || profile.phone, { source: "business-profile" }),
    evidenceField("email", "Email", "business", approved.email || profile.businessEmail || profile.email, { source: "business-profile" }),
    evidenceField("website", "Website", "business", approved.website || profile.website, { source: "business-profile" }),
    evidenceField("openingHours", "Opening hours", "business", approved.openingHoursSummary || profile.openingHoursSummary, { source: "business-profile" }),
    evidenceField("bookingRoute", "Booking route", "business", approved.appointmentMethod || profile.appointmentMethod || profile.bookingUrl, { source: "business-profile" }),
    evidenceField("walkInPolicy", "Walk-in policy", "business", profile.pharmacyFirstAvailability || approved.pharmacyFirstAvailability, { source: "business-profile" }),
    evidenceField("appointmentPolicy", "Appointment policy", "business", approved.appointmentMethod || profile.appointmentMethod, { source: "business-profile" }),
    evidenceField("lockedService", "Selected locked service", "service", meta?.serviceName || serviceId, { required: true, source: "locked-catalogue" }),
    evidenceField("serviceOfferedConfirmation", "Service offered confirmation", "service", serviceOffered(slug, profile, serviceId), { required: true, source: "campaign" }),
    evidenceField(
      PRIVATE_SERVICES_OFFERED_FIELD_ID,
      PRIVATE_SERVICES_OFFERED_LABEL,
      "service",
      resolvePrivateServicesOfferedAnswer(readRawProfileData(slug)),
      {
        required: true,
        source: "business-profile",
        deferConfirmation: true,
      },
    ),
    evidenceField("accessMethod", "Access method", "service", approved.appointmentMethod || profile.appointmentMethod, { required: true, source: "business-profile" }),
    evidenceField("consultationProcess", "Consultation process", "service", approved.consultationRoom ? "Private consultation room confirmed" : null, { source: "business-profile" }),
    evidenceField("consultationRoom", "Consultation room", "service", approved.consultationRoom || profile.consultationRoom, { source: "business-profile" }),
    evidenceField("expectedDuration", "Expected duration", "service", null, { notApplicable: true, source: "business-profile" }),
    evidenceField("primaryCta", "CTA", "service", approved.primaryCtaDestination || profile.primaryCtaDestination || profile.headerCtaUrl, { required: true, source: "business-profile" }),
    evidenceField("unknownEvidence", "Unknown evidence", "service", null, { notApplicable: true }),
    evidenceField("teamReviewer", "Team/reviewer", "trust", profile.reviewerName || approved.superintendent, { source: "profile" }),
    evidenceField("yearsServing", "Years serving", "trust", (profile as { yearsServingCommunity?: string }).yearsServingCommunity, { source: "profile" }),
    evidenceField("languages", "Languages", "trust", approved.languagesSpoken || profile.languagesSpoken, { source: "business-profile" }),
    evidenceField("accreditations", "Accreditations", "trust", approved.gphcNumber || profile.gphcPremisesNumber, { source: "business-profile" }),
    evidenceField("accessibility", "Accessibility", "trust", approved.accessibilityFeatures || profile.accessibilityFeatures, { source: "business-profile" }),
    evidenceField("parkingTransport", "Parking/transport", "trust", approved.parkingAvailable || profile.parkingAvailable, { source: "business-profile" }),
    evidenceField("template", "Template", "brand", setup.componentDnaReady ? "Component DNA template" : null, { source: "generation-setup" }),
    evidenceField("logo", "Logo", "brand", approved.logo || profile.logoUrl, { source: "business-profile" }),
    evidenceField("colours", "Colours", "brand", approved.brandPrimaryColor || profile.brandPrimaryColor, { source: "business-profile" }),
    evidenceField("fonts", "Fonts", "brand", null, { source: "brand-dna" }),
    evidenceField("header", "Header", "brand", text(header.navigationVariant), { source: "component-dna" }),
    evidenceField("footer", "Footer", "brand", text(footer.variant), { source: "component-dna" }),
    evidenceField("navigation", "Navigation", "brand", text(header.navigationVariant), { source: "component-dna" }),
    evidenceField("buttons", "Buttons", "brand", text(cta.variant), { source: "component-dna" }),
    evidenceField("brandSource", "Resolved brand source", "brand", resolveBrandSource(slug), { required: true, source: "brand-dna" }),
    evidenceField("designIntelligence", "Design Intelligence", "brand", setup.componentDnaReady ? "Ready" : null, { source: "generation-setup" }),
    evidenceField("seoPlannedTitle", "Planned title", "seo", null, { source: "seo-plan" }),
    evidenceField("seoMetaDescription", "Meta description", "seo", null, { source: "seo-plan" }),
    evidenceField("seoCanonical", "Canonical", "seo", null, { source: "seo-plan" }),
    evidenceField("seoSchemaTypes", "Schema types", "seo", null, { source: "seo-plan" }),
    evidenceField("seoValidLinks", "Valid links", "seo", null, { source: "seo-plan" }),
    evidenceField("seoFutureLinkPlan", "Future-link plan", "seo", null, { source: "future-link-plan" }),
  ];
}

export function enrichEvidenceFieldsWithSeo(
  fields: ServicePageEvidenceField[],
  seo: { title: string; metaDescription: string; canonicalUrl: string; schemaTypes: string[]; validLinks: boolean; futureLinkPlanReady: boolean },
): ServicePageEvidenceField[] {
  const patch = (id: string, value: string | null, confirmed = false) => {
    const f = fields.find((x) => x.id === id);
    if (f) {
      f.value = value;
      if (!f.productOwnerDecided) {
        f.status = confirmed ? "confirmed" : "not_confirmed";
      }
    }
  };
  patch("seoPlannedTitle", seo.title);
  patch("seoMetaDescription", seo.metaDescription);
  patch("seoCanonical", seo.canonicalUrl);
  patch("seoSchemaTypes", seo.schemaTypes.join(", "));
  patch("seoValidLinks", seo.validLinks ? "All planned links valid" : "Link validation pending");
  patch("seoFutureLinkPlan", seo.futureLinkPlanReady ? "Future cluster-link plan persisted" : "Future cluster-link plan not ready", seo.futureLinkPlanReady);
  return fields;
}

export function enrichImageEvidenceFields(
  fields: ServicePageEvidenceField[],
  selections: ServicePageImageSelection[],
): ServicePageEvidenceField[] {
  const roles = ["hero", "supporting", "trust", "conversion"] as const;
  const slotMap: Record<string, string> = {
    hero: "service-hero",
    supporting: "service-supporting",
    trust: "service-trust",
    conversion: "service-conversion",
  };
  for (const role of roles) {
    const sel =
      selections.find((s) => s.role === slotMap[role]) ||
      selections.find((s) => s.slot === role) ||
      selections.find((s) => s.role.includes(role));
    fields.push(
      evidenceField(`image_${role}`, `${role.charAt(0).toUpperCase()}${role.slice(1)} image`, "images", sel?.filePath || null, { source: "image-platform" }),
      evidenceField(`image_${role}_source`, `${role} source`, "images", sel?.sourceType || (sel?.approvedAssetId ? "image-platform" : null), { source: "image-platform" }),
      evidenceField(`image_${role}_reason`, `${role} reason`, "images", sel?.selectionReason || null, { source: "image-platform" }),
      evidenceField(`image_${role}_alt`, `${role} alt text`, "images", sel?.altText || null, { source: "image-platform" }),
      evidenceField(`image_${role}_dimensions`, `${role} dimensions`, "images", sel?.dimensions || null, { source: "image-platform" }),
    );
  }
  return fields;
}

export interface RequiredEvidenceGateResult {
  passed: boolean;
  blockers: string[];
}

export function evaluateRequiredEvidenceGate(input: {
  slug: string;
  serviceId: string;
  evidenceFields: ServicePageEvidenceField[];
  imageSelections: ServicePageImageSelection[];
  canonicalUrl: string | null;
}): RequiredEvidenceGateResult {
  const blockers: string[] = [];
  const field = (id: string) => input.evidenceFields.find((f) => f.id === id);

  if (field("pharmacyName")?.status !== "confirmed") blockers.push("Business name is required before service page generation.");
  if (field("townOrCity")?.status !== "confirmed") blockers.push("Town or City is required before service page generation.");
  if (field("postcode")?.status !== "confirmed") blockers.push("Postcode is required before service page generation.");
  if (!isLockedCommercialSupportedService(input.serviceId)) {
    blockers.push("Selected service is not in the locked commercial supported service catalogue.");
  }
  const privateServices = field(PRIVATE_SERVICES_OFFERED_FIELD_ID);
  if (
    privateServices?.status !== "confirmed" ||
    (privateServices.value !== "Yes" && privateServices.value !== "No")
  ) {
    blockers.push("Private services offered must be confirmed as Yes or No before service page generation.");
  }
  if (field("serviceOfferedConfirmation")?.status !== "confirmed") {
    blockers.push("Service offered confirmation is required — confirm the locked service is offered by this pharmacy.");
  }
  if (field("accessMethod")?.status !== "confirmed") {
    blockers.push("Service access method is required — confirm booking or walk-in access in Business Profile.");
  }
  if (field("walkInPolicy")?.status !== "confirmed" && field("appointmentPolicy")?.status !== "confirmed") {
    blockers.push("Walk-in or appointment policy must be confirmed before generation.");
  }
  const cta = field("primaryCta");
  if (cta?.status !== "confirmed" || !/^https?:\/\//i.test(cta.value || "") && !/^tel:/i.test(cta.value || "") && !/^mailto:/i.test(cta.value || "")) {
    if (cta?.status !== "confirmed") blockers.push("Valid CTA destination is required before generation.");
    else blockers.push("CTA must be a valid URL, telephone, or email link.");
  }
  if (field("brandSource")?.status !== "confirmed" && !hasCanonicalComponentDna(input.slug) && !fs.existsSync(getPharmacyBrandDnaPath(input.slug))) {
    blockers.push("Resolved brand source is required — import website intelligence or confirm Brand DNA.");
  }
  // Image-platform slot inventory is Pharmacy First–complete today. Other locked
  // services may have zero production selections; image evidence is then optional
  // and may be confirmed or marked Not Applicable by Product Owner review.
  const assigned = input.imageSelections.filter((i) => i.status === "assigned" && i.filePath);
  const distinctAssets = new Set(assigned.map((i) => i.approvedAssetId || i.filePath).filter(Boolean));
  if (input.imageSelections.length > 0) {
    if (assigned.length < 4 || distinctAssets.size < 4) {
      blockers.push("Four valid distinct image assignments are required (hero, supporting, trust, conversion).");
    }
  } else {
    const imageRoles = ["image_hero", "image_supporting", "image_trust", "image_conversion"] as const;
    const unresolvedImageRole = imageRoles.some((id) => {
      const status = field(id)?.status;
      return status !== "confirmed" && status !== "not_applicable";
    });
    if (unresolvedImageRole) {
      blockers.push("Four valid distinct image assignments are required (hero, supporting, trust, conversion).");
    }
  }
  if (!input.canonicalUrl || !/^https?:\/\//i.test(input.canonicalUrl)) {
    blockers.push("Canonical URL is required — confirm website and service path in Business Profile.");
  }

  return { passed: blockers.length === 0, blockers };
}
