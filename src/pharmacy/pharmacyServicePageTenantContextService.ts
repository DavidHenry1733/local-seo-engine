/**
 * CPR-12 — Generic service-page tenant-context binding, section evidence, and quality gate.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { readLatestApprovalSnapshot } from "./masterAdminBusinessProfileReviewService.ts";
import { readServicePageGenerationRecord, writeServicePageGenerationRecord, readCoreProductRecoveryContract } from "./masterAdminCoreProductRecoveryService.ts";
import { buildCprEvidenceFields, buildPublicationQualityApprovedEvidence } from "./masterAdminCoreProductRecoveryEvidenceService.ts";
import { readEvidenceReviewApprovedForPublicationQuality } from "./pharmacyServicePagePublicationQualityGate.ts";
import { isInvalidPharmacyIdentityValue, isKeywordStuffedPharmacyListingName, resolvePublicationPharmacyIdentity } from "./pharmacyServicePagePublicationQuality.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { resolveBrandDna } from "./pharmacyBrandDnaEngine.ts";
import { resolveServicePageTemplateId } from "./pharmacyTenantDnaRenderActivation.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolvePharmacyImageWithAssignments } from "./pharmacyImageAssignmentResolver.ts";
import type { PharmacyImageSlot } from "./templates/pharmacyImageLibrary.ts";
import { buildImageRenderContext } from "./pharmacyVisualExperience.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import type { ServicePageEvidenceField } from "./masterAdminCoreProductRecoveryModel.ts";

export const SERVICE_PAGE_GENERATION_SCOPE = {
  SERVICE_PAGE_ONLY: "service-page-only",
  FULL_ECOSYSTEM: "full-ecosystem",
} as const;

export type ServicePageGenerationScope = (typeof SERVICE_PAGE_GENERATION_SCOPE)[keyof typeof SERVICE_PAGE_GENERATION_SCOPE];

export interface BrandResolutionAudit {
  templateSource: string;
  colourSource: string;
  fontSource: string;
  logoSource: string;
  headerSource: string;
  footerSource: string;
  fallbackReason: string | null;
}

export interface SectionEvidenceBundle {
  sectionId: string;
  templateBlock: string;
  evidenceFieldIds: string[];
  evidenceFactsSupplied: string[];
  pharmacyFactsUsed: string[];
  localFactsUsed: string[];
  unsupportedFactsOmitted: string[];
  generatedCopyChecksum: string | null;
}

export interface TenantContextBinding {
  requestedSlug: string;
  resolvedSlug: string;
  businessProfileRevision: number;
  evidenceReviewRevision: number;
  generationJobId: string | null;
  imageAssignmentRevision: string | null;
  scope: ServicePageGenerationScope;
  resolvedBusinessName: string;
  resolvedServiceId: string;
  resolvedTownCity: string;
  brandResolution: BrandResolutionAudit;
  sectionEvidenceBundles: SectionEvidenceBundle[];
  approvedEvidence: Record<string, { value: string; status: string }>;
  evidenceReviewApproved: boolean;
}

export interface TenantContextQualityGateResult {
  ok: boolean;
  status: "PASS" | "FAILED_TENANT_CONTEXT";
  checks: Array<{ id: string; passed: boolean; detail: string }>;
  blockers: string[];
}

const FORBIDDEN_CROSS_TENANT_NAMES = [
  /\bBrook Pharmacy\b/i,
  /\bRowlands Pharmacy\b/i,
  /\bReliable Direct Pharmacy\b/i,
  /\bBanner Cross Pharmacy\b/i,
  /\bPharmacy Delivered\b/i,
];

const DEMO_TENANT_SLUGS = new Set(["pharmaconnect", "brook-pharmacy"]);

const SECTION_EVIDENCE_MAP: Array<{
  sectionId: string;
  templateBlock: string;
  evidenceFieldIds: string[];
}> = [
  { sectionId: "hero", templateBlock: "hero", evidenceFieldIds: ["pharmacyName", "townCity", "accessMethod", "ctaRoute", "phone"] },
  { sectionId: "service-overview", templateBlock: "service-definition", evidenceFieldIds: ["serviceName", "nhsPrivateStatus", "consultationRoom"] },
  { sectionId: "conditions", templateBlock: "conditions", evidenceFieldIds: ["serviceName"] },
  { sectionId: "how-it-works", templateBlock: "process", evidenceFieldIds: ["accessMethod", "bookingMethod", "consultationRoom"] },
  { sectionId: "access-preparation", templateBlock: "eligibility", evidenceFieldIds: ["accessMethod", "bookingMethod", "openingHours"] },
  { sectionId: "why-choose", templateBlock: "trust-split", evidenceFieldIds: ["pharmacyName", "townCity", "trustSignals"] },
  { sectionId: "local-relevance", templateBlock: "local", evidenceFieldIds: ["townCity", "postcode", "addressLine1", "localAreas"] },
  { sectionId: "faq", templateBlock: "faq", evidenceFieldIds: ["accessMethod", "phone", "bookingMethod"] },
  { sectionId: "final-cta", templateBlock: "final-cta", evidenceFieldIds: ["phone", "ctaRoute", "bookingMethod"] },
];

const PAGE_IMAGE_SLOTS: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];

function readEvidenceReviewRevision(slug: string): number {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/service-page-evidence-review",
    slug,
    "field-decisions.json",
  );
  if (!fs.existsSync(file)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { evidenceReviewRevision?: number };
    return raw.evidenceReviewRevision || 0;
  } catch {
    return 0;
  }
}

function checksum(text: string): string {
  return crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
}

function decodeHtmlEntities(value: string): string {
  return String(value || "")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function resolveTenantFacingBusinessName(
  slug: string,
  contentContext: ContentGenerationContext | undefined,
  evidencePharmacyName: string,
): string {
  const publication = resolvePublicationPharmacyIdentity(
    contentContext?.rawProfile || readSetupProfile(slug),
  ).pharmacyName;
  const fromContext = String(contentContext?.profile.pharmacyName || "").trim();
  const candidates = [publication, fromContext, evidencePharmacyName];
  for (const candidate of candidates) {
    const text = String(candidate || "").trim();
    if (text && !isInvalidPharmacyIdentityValue(text) && !isKeywordStuffedPharmacyListingName(text)) {
      return text;
    }
  }
  return publication;
}

function fieldValue(fields: ServicePageEvidenceField[], id: string): string {
  const f = fields.find((x) => x.id === id);
  if (!f || f.status === "not_applicable") return "";
  return String(f.value || "").trim();
}

export function resolveBrandResolutionAudit(slug: string): BrandResolutionAudit {
  const key = resolveTenantProfileSlug(slug) || slug;
  const resolution = resolveBrandDna(key);
  const { dna, provenance } = resolution;
  const colourSource = provenance.websiteImport
    ? "website-import-brand-dna"
    : provenance.customerOverrides
      ? "customer-brand-dna-overrides"
      : "pharmaconnect-neutral-default";
  const typography = dna.typography as { headingFont?: string; bodyFont?: string; headingFontFamily?: string; bodyFontFamily?: string } | undefined;
  const hasTenantFonts = Boolean(
    typography?.headingFont ||
      typography?.bodyFont ||
      typography?.headingFontFamily ||
      typography?.bodyFontFamily,
  );
  const fontSource = hasTenantFonts ? colourSource : "pharmaconnect-neutral-default";
  const logoSource = dna.logoUrl ? colourSource : "pharmaconnect-neutral-default";
  const headerSource = dna.navigationLinks?.length ? `${colourSource}:navigation` : `${colourSource}:component-dna`;
  const footerSource = dna.footerLinks?.length ? `${colourSource}:footer` : `${colourSource}:component-dna`;
  const fallbackReason =
    provenance.websiteImport || provenance.customerOverrides
      ? null
      : "No tenant website-import or customer override — neutral PharmaConnect default theme applied";

  return {
    templateSource: resolveServicePageTemplateId(key),
    colourSource,
    fontSource,
    logoSource,
    headerSource,
    footerSource,
    fallbackReason,
  };
}

export function buildSectionEvidenceBundles(
  slug: string,
  serviceId: string,
  html?: string,
): SectionEvidenceBundle[] {
  const fields = buildCprEvidenceFields(slug, serviceId);
  const pharmacyName = fieldValue(fields, "pharmacyName");
  const town = fieldValue(fields, "townCity");

  return SECTION_EVIDENCE_MAP.map((def) => {
    const supplied: string[] = [];
    const pharmacyFacts: string[] = [];
    const localFacts: string[] = [];
    const omitted: string[] = [];

    for (const id of def.evidenceFieldIds) {
      const f = fields.find((x) => x.id === id);
      if (!f) continue;
      if (f.status === "not_applicable") {
        omitted.push(id);
        continue;
      }
      const val = String(f.value || "").trim();
      if (!val) {
        omitted.push(id);
        continue;
      }
      supplied.push(`${id}=${val}`);
      if (["pharmacyName", "phone", "consultationRoom", "trustSignals", "openingHours", "bookingMethod", "accessMethod", "ctaRoute", "addressLine1", "postcode"].includes(id)) {
        pharmacyFacts.push(val);
      }
      if (["townCity", "localAreas", "postcode"].includes(id)) {
        localFacts.push(val);
      }
    }

    let blockChecksum: string | null = null;
    if (html) {
      const blockMatch = html.match(new RegExp(`data-template-block="${def.templateBlock}"[\\s\\S]*?(?=data-template-block=|<\\/main>|$)`, "i"));
      if (blockMatch) blockChecksum = checksum(blockMatch[0]);
    }

    if (pharmacyName && !pharmacyFacts.includes(pharmacyName) && def.sectionId === "hero") {
      pharmacyFacts.push(pharmacyName);
    }
    if (town && !localFacts.includes(town) && def.sectionId === "local-relevance") {
      localFacts.push(town);
    }

    return {
      sectionId: def.sectionId,
      templateBlock: def.templateBlock,
      evidenceFieldIds: def.evidenceFieldIds,
      evidenceFactsSupplied: supplied,
      pharmacyFactsUsed: pharmacyFacts,
      localFactsUsed: localFacts,
      unsupportedFactsOmitted: omitted,
      generatedCopyChecksum: blockChecksum,
    };
  });
}

export function buildTenantContextBinding(
  slug: string,
  serviceId: string,
  options: {
    scope?: ServicePageGenerationScope;
    generationJobId?: string | null;
    contentContext?: ContentGenerationContext;
    html?: string;
  } = {},
): TenantContextBinding {
  const resolvedSlug = resolveTenantProfileSlug(slug) || slug;
  const approval = readLatestApprovalSnapshot(resolvedSlug);
  const record = readServicePageGenerationRecord(resolvedSlug, serviceId);
  const fields = buildCprEvidenceFields(resolvedSlug, serviceId);
  const approvedEvidence = buildPublicationQualityApprovedEvidence(resolvedSlug, serviceId);
  const evidenceReviewApproved = readEvidenceReviewApprovedForPublicationQuality(resolvedSlug, serviceId);

  return {
    requestedSlug: slug,
    resolvedSlug,
    businessProfileRevision: approval?.profileRevision || 0,
    evidenceReviewRevision: readEvidenceReviewRevision(resolvedSlug),
    generationJobId: options.generationJobId ?? record?.jobId ?? null,
    imageAssignmentRevision: record?.imageAssignmentRevision ?? null,
    scope: options.scope || SERVICE_PAGE_GENERATION_SCOPE.SERVICE_PAGE_ONLY,
    resolvedBusinessName: resolveTenantFacingBusinessName(
      resolvedSlug,
      options.contentContext,
      fieldValue(fields, "pharmacyName"),
    ),
    resolvedServiceId: serviceId,
    resolvedTownCity: options.contentContext?.primaryTown || fieldValue(fields, "townCity"),
    brandResolution: resolveBrandResolutionAudit(resolvedSlug),
    sectionEvidenceBundles: buildSectionEvidenceBundles(resolvedSlug, serviceId, options.html),
    approvedEvidence,
    evidenceReviewApproved,
  };
}

export function planImageSlotBindings(slug: string, serviceId: VisualExperienceServiceId): Array<{
  slot: PharmacyImageSlot;
  assignmentId: string | null;
  role: string;
  assetId: string | null;
  source: string | null;
  filePath: string | null;
  altText: string | null;
  renderedSlot: string;
}> {
  const ctx = buildImageRenderContext(slug, serviceId);
  return PAGE_IMAGE_SLOTS.map((slot) => {
    const resolved = resolvePharmacyImageWithAssignments(slug, slot, ctx);
    const libraryRef = resolved.libraryRef || "";
    const assetId = libraryRef.includes("/") ? libraryRef.split("/").pop() || null : resolved.imageKey;
    return {
      slot,
      assignmentId: `${serviceId}:${serviceId}:${slot}`,
      role: slot,
      assetId,
      source: resolved.source || null,
      filePath: resolved.assetPath || null,
      altText: resolved.alt || null,
      renderedSlot: slot,
    };
  });
}

export function validateServicePageTenantContextGate(
  slug: string,
  serviceId: VisualExperienceServiceId,
  html: string,
  options: {
    requestedSlug?: string;
    scope?: ServicePageGenerationScope;
    generationJobId?: string | null;
    contentContext?: ContentGenerationContext;
  } = {},
): TenantContextQualityGateResult {
  const binding = buildTenantContextBinding(slug, serviceId, {
    scope: options.scope,
    generationJobId: options.generationJobId,
    contentContext: options.contentContext,
    html,
  });
  const checks: TenantContextQualityGateResult["checks"] = [];
  const blockers: string[] = [];
  const pharmacyName = binding.resolvedBusinessName;
  const town = binding.resolvedTownCity;
  const key = binding.resolvedSlug;

  const slugOk = !options.requestedSlug || resolveTenantProfileSlug(options.requestedSlug) === key;
  checks.push({ id: "generation-customer", passed: slugOk, detail: `requested=${options.requestedSlug || key} resolved=${key}` });
  if (!slugOk) blockers.push("Generation customer does not match requested customer slug");

  const revisionOk = binding.businessProfileRevision > 0;
  checks.push({ id: "business-profile-revision", passed: revisionOk, detail: `revision=${binding.businessProfileRevision}` });
  if (!revisionOk) blockers.push("Approved Business Profile revision not loaded");

  const nameCount = pharmacyName
    ? (decodeHtmlEntities(html).match(new RegExp(pharmacyName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi")) || []).length
    : 0;
  const nameOk = nameCount >= 3;
  checks.push({ id: "business-name-coverage", passed: nameOk, detail: `occurrences=${nameCount}` });
  if (!nameOk) blockers.push("Business name not used meaningfully in generated page");

  const townOk = !town || new RegExp(town.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").test(decodeHtmlEntities(html));
  checks.push({ id: "town-coverage", passed: townOk, detail: town || "missing" });
  if (!townOk) blockers.push("Town/city not reflected in generated page");

  let crossTenantBranding = false;
  if (!DEMO_TENANT_SLUGS.has(key)) {
    for (const pattern of FORBIDDEN_CROSS_TENANT_NAMES) {
      if (pattern.test(html)) {
        crossTenantBranding = true;
        blockers.push(`Cross-tenant branding detected: ${pattern.source}`);
        break;
      }
    }
  }
  checks.push({ id: "cross-tenant-branding", passed: !crossTenantBranding, detail: crossTenantBranding ? "forbidden name found" : "clean" });

  const brandOk =
    binding.brandResolution.colourSource !== "brook-pharmacy" &&
    binding.brandResolution.colourSource !== "reliable-direct-pharmacy" &&
    binding.brandResolution.colourSource !== "banner-cross-pharmacy";
  checks.push({ id: "brand-resolution", passed: brandOk, detail: binding.brandResolution.colourSource });
  if (!brandOk) blockers.push("Brand colours resolved from another tenant");

  const imageBindings = planImageSlotBindings(key, serviceId);
  // Only real production/library assignments count — placeholder "missing" sources do not.
  const assignmentsAvailable = imageBindings.filter(
    (b) => b.filePath && b.source && b.source !== "missing",
  ).length;
  // Campaign-scoped services without assigned production images must not be blocked
  // by Pharmacy First's four-slot assignment contract.
  const imageInventoryRequired = assignmentsAvailable > 0 || serviceId === "pharmacy-first";
  checks.push({
    id: "image-assignments-available",
    passed: !imageInventoryRequired || assignmentsAvailable >= 4,
    detail: imageInventoryRequired ? `${assignmentsAvailable}/4` : "no production inventory for service",
  });
  if (imageInventoryRequired && assignmentsAvailable < 4) {
    blockers.push("Four image assignments not available");
  }

  for (const slot of PAGE_IMAGE_SLOTS) {
    const rendered = (html.match(new RegExp(`data-image-slot="${slot}"`, "g")) || []).length;
    const slotMissing = html.includes(`data-image-slot="${slot}" data-image-missing="true"`);
    const slotOk = !imageInventoryRequired
      ? true
      : rendered >= 1 && !slotMissing;
    checks.push({
      id: `image-render-${slot}`,
      passed: slotOk,
      detail: imageInventoryRequired ? `occurrences=${rendered}` : "deferred — no production inventory",
    });
    if (!slotOk) blockers.push(`Image slot not rendered: ${slot}`);
  }

  const bundlesOk = binding.sectionEvidenceBundles.filter((b) => b.evidenceFactsSupplied.length > 0).length >= 5;
  checks.push({ id: "section-evidence-bundles", passed: bundlesOk, detail: `${binding.sectionEvidenceBundles.filter((b) => b.evidenceFactsSupplied.length).length} sections with evidence` });
  if (!bundlesOk) blockers.push("Insufficient section evidence bundles");

  const wordCount = html.replace(/<[^>]+>/g, " ").split(/\s+/).filter(Boolean).length;
  const contentOk = wordCount >= 400;
  checks.push({ id: "content-depth", passed: contentOk, detail: `words=${wordCount}` });
  if (!contentOk) blockers.push("Insufficient evidence-driven body copy");

  return {
    ok: blockers.length === 0,
    status: blockers.length === 0 ? "PASS" : "FAILED_TENANT_CONTEXT",
    checks,
    blockers,
  };
}

export function markServicePageFailedFrameworkValidation(
  slug: string,
  reasons: string[],
  serviceId?: string,
): void {
  const record = readServicePageGenerationRecord(slug, serviceId);
  if (!record) return;
  writeServicePageGenerationRecord({
    ...record,
    status: "failed",
    errors: [...new Set([...(record.errors || []), "FAILED_FRAMEWORK_VALIDATION", ...reasons])],
    warnings: [...(record.warnings || []), "framework-validation-failed"],
  });
  // Tenant contract flag is Pharmacy First compatibility only.
  const sid = record.serviceId || serviceId || "pharmacy-first";
  if (sid !== "pharmacy-first") return;
  const contract = readCoreProductRecoveryContract(slug);
  if (contract) {
    contract.servicePageGenerated = false;
    fs.writeFileSync(
      path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-master-admin/core-product-recovery", slug, "contract.json"),
      JSON.stringify(contract, null, 2),
    );
  }
}

export function enrichContentGenerationContextWithTenantBinding(
  ctx: ContentGenerationContext,
  binding: TenantContextBinding,
): ContentGenerationContext {
  return {
    ...ctx,
    tenantContext: binding,
  };
}
