#!/usr/bin/env npx tsx
/**
 * Business Profile Intelligence V2 — Phase 3A long-form integration validation.
 * Confirms intelligence is built into context, consumed by long-form engine,
 * fallback behaviour, no invented claims, and locked V1 quality checks still pass.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import {
  buildPatientGuideBodyHtml,
  buildTenantFaqEntries,
  intelligenceSupportsClaim,
  longFormPlainText,
} from "../src/pharmacy/contentEngine/pharmacyLongFormContentEngine.ts";
import {
  intelligenceFromContext,
  phraseParking,
  phraseConsultationRoom,
} from "../src/pharmacy/contentEngine/pharmacyLongFormIntelligencePhrases.ts";
import { validateLongFormQuality } from "../src/pharmacy/contentEngine/pharmacyLongFormQualityValidation.ts";
import { generateContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { buildBusinessProfileIntelligenceFromProfile } from "../src/pharmacy/businessProfileIntelligence/buildBusinessProfileIntelligence.ts";
import { normalizeProfileData, PROFILE_SCHEMA_VERSION } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { defaultProfileServiceDelivery } from "../src/pharmacy/pharmacyProfileV2Fields.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function readPage(slug: string, serviceId: string, pageSlug: string): string {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "pages",
    pageSlug,
    "index.html",
  );
  return fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
}

function scanNoInventedClaims(ctx: ReturnType<typeof buildContentGenerationContext>, html: string, label: string) {
  const text = longFormPlainText(html);
  record(`${label}:intelligence-supports-claims`, intelligenceSupportsClaim(ctx, text), "no unsupported invented claims");
}

async function validateSlug(slug: string, serviceId: string) {
  const prefix = `${slug}/${serviceId}`;
  console.log(`\n=== ${prefix} ===\n`);

  const ctx = buildContentGenerationContext(slug, serviceId);
  record(`${prefix}:context-has-intelligence`, Boolean(ctx.businessProfileIntelligence?.slug), ctx.businessProfileIntelligence.slug);
  record(
    `${prefix}:intelligence-identity-name`,
    ctx.businessProfileIntelligence.identity.businessName === ctx.profile.pharmacyName,
    ctx.businessProfileIntelligence.identity.businessName,
  );

  await generateContentPackage(slug, serviceId);

  const quality = validateLongFormQuality(ctx);
  record(`${prefix}:long-form-quality-v1`, quality.ok, quality.detail);

  const guideHtml = readPage(ctx.resolvedSlug, serviceId, `${serviceId}-guide`);
  const guideText = longFormPlainText(guideHtml);
  record(`${prefix}:guide-generated`, Boolean(guideHtml), `${guideText.split(/\s+/).length} words`);

  if (phraseConsultationRoom(ctx)) {
    record(
      `${prefix}:guide-uses-consultation-room`,
      guideText.toLowerCase().includes("private consultation room"),
      "profile-backed consultation room",
    );
  }

  scanNoInventedClaims(ctx, guideHtml, `${prefix}:guide`);

  for (const pageSlug of [
    `what-is-${serviceId}`,
    `who-should-consider-${serviceId}`,
    `${serviceId}-what-you-need-to-know`,
    `${serviceId}-faqs`,
  ]) {
    const html = readPage(ctx.resolvedSlug, serviceId, pageSlug);
    record(`${prefix}:page-${pageSlug}`, Boolean(html), pageSlug);
    if (html) scanNoInventedClaims(ctx, html, `${prefix}:${pageSlug}`);
  }

  // Fallback: parking phrase absent when profile has no parking data
  const parkingBefore = phraseParking(ctx);
  record(`${prefix}:fallback-no-parking-phrase`, !parkingBefore, parkingBefore || "none");

  // Enriched in-memory profile (not saved) — parking appears in guide body
  const enrichedRaw = normalizeProfileData({
    ...ctx.rawProfile,
    parkingInfo: "Free parking is available on site",
    serviceDeliveryProfiles: {
      [serviceId]: {
        ...defaultProfileServiceDelivery(serviceId, ctx.serviceName),
        walkInAvailable: true,
        consultationLengthMinutes: 15,
        pricing: "Free NHS service",
        resultsProcess: "Results are explained immediately after measurement",
      },
    },
  });
  const baseDelivery =
    ctx.businessProfileIntelligence.services.byServiceId[serviceId] || {
      serviceId,
      serviceName: ctx.serviceName,
      fundingModel: "unknown" as const,
      appointmentRequired: null,
      walkInAvailable: null,
      consultationLengthMinutes: null,
      equipmentUsed: [],
      preparation: [],
      aftercare: [],
      resultsProcess: "",
      referralProcess: "",
      pricing: "",
      ageRestrictions: "",
      priority: false,
      detectedFromWebsite: false,
    };
  const enrichedCtx = {
    ...ctx,
    rawProfile: enrichedRaw,
    businessProfileIntelligence: {
      ...ctx.businessProfileIntelligence,
      location: { ...ctx.businessProfileIntelligence.location, parking: ["Free parking is available on site"] },
      services: {
        ...ctx.businessProfileIntelligence.services,
        byServiceId: {
          ...ctx.businessProfileIntelligence.services.byServiceId,
          [serviceId]: {
            ...baseDelivery,
            walkInAvailable: true,
            consultationLengthMinutes: 15,
            pricing: "Free NHS service",
            resultsProcess: "Results are explained immediately after measurement",
          },
        },
      },
    },
  };
  const enrichedGuide = buildPatientGuideBodyHtml(enrichedCtx);
  record(
    `${prefix}:enriched-parking-in-guide`,
    enrichedGuide.toLowerCase().includes("free parking"),
    "parking from profile",
  );
  record(
    `${prefix}:enriched-walk-in-in-guide`,
    enrichedGuide.toLowerCase().includes("walk-in"),
    "walk-in from service delivery",
  );

  const faqs = buildTenantFaqEntries(enrichedCtx);
  record(
    `${prefix}:enriched-faq-pricing`,
    faqs.some((f) => f.answer.toLowerCase().includes("free nhs")),
    "pricing FAQ from profile",
  );

  // Legacy fallback body unchanged when no optional phrases
  const minimalRaw = normalizeProfileData({
      pharmacyName: ctx.profile.pharmacyName,
      phone: ctx.profile.phone,
      primaryTown: ctx.primaryTown,
      townCity: ctx.primaryTown,
      selectedServices: ctx.rawProfile.selectedServices,
      openingHours: ctx.cta.openingHours,
      addressLine1: ctx.profile.fullAddress,
      superintendentPharmacistName: ctx.profile.superintendentPharmacistName,
      reviewerName: ctx.profile.reviewerName,
      consultationRoomAvailable: false,
      yearsServingCommunity: "",
      parkingInfo: "",
      serviceDeliveryProfiles: {},
    });
  const minimalCtx = {
    ...ctx,
    rawProfile: minimalRaw,
    businessProfileIntelligence: buildBusinessProfileIntelligenceFromProfile(
      ctx.resolvedSlug,
      minimalRaw,
      ctx.businessProfileIntelligence.provenance.profileUpdatedAt,
      PROFILE_SCHEMA_VERSION,
    ),
  };
  const minimalGuide = buildPatientGuideBodyHtml(minimalCtx);
  record(
    `${prefix}:fallback-minimal-no-parking`,
    !minimalGuide.toLowerCase().includes("free parking"),
    "minimal profile has no parking claim",
  );
}

async function main() {
  console.log("\n=== Business Profile Intelligence V2 — Phase 3A Long-Form ===\n");

  const ctx = buildContentGenerationContext("dhmdigital", "blood-pressure-checks");
  record("intelligence-built-in-context", intelligenceFromContext(ctx).slug === "dhmdigital", "dhmdigital");

  await validateSlug("dhmdigital", "blood-pressure-checks");
  await validateSlug("pharmaconnect", "blood-pressure-checks");

  const passed = checks.filter((c) => c.pass).length;
  console.log(`\n${passed}/${checks.length} checks passed\n`);
  if (checks.some((c) => !c.pass)) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
