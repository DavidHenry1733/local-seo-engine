import fs from "node:fs";
import path from "node:path";

import { buildContentGenerationContext } from "../src/pharmacy/contentEngine/buildContentGenerationContext.ts";
import { validateContentGenerationContext } from "../src/pharmacy/contentEngine/contentEngineContract.ts";
import {
  computeCommercialPublishingReadiness,
  computeTechnicalGenerationReadiness,
} from "../src/pharmacy/pharmacyCommercialReadinessGate.ts";
import { normalizeProfileData } from "../src/pharmacy/pharmacyProfileSchema.ts";
import { renderProfileWizardHtml } from "../src/pharmacy/pharmacyProfileWizardPage.ts";

const ROOT = process.env.WORKSPACE_ROOT || "/home/inboxingproweb/pharmaconnect-growth-engine";
const APP_DOMAIN = process.env.APP_DOMAIN || "https://app.pharmaconnect.uk";
const SLUG = "pharmacy-delivered-4u-test";
const CAMPAIGN_ID = "pharmacy-first";
const CANONICAL_GPHC_FIELD = "gphcNumber";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const WIZARD_SECTIONS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardSections.ts");
const WIZARD_PAGE_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardPage.ts");
const SAVE_ROUTE_SOURCE = path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts");
const SCHEMA_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileSchema.ts");
const READINESS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyCommercialReadinessGate.ts");
const CONTEXT_SOURCE = path.join(ROOT, "src/pharmacy/contentEngine/buildContentGenerationContext.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
const BANNED = /brook|rowlands|\bdhm\b|pharmacy\.inboxingproweb|default pharmacy|fallback profile|demo superintendent|mock pharmacy/i;

function read(file: string): string {
  return fs.readFileSync(file, "utf8");
}

function readJson<T>(file: string, fallback: T): T {
  if (!fs.existsSync(file)) return fallback;
  return JSON.parse(read(file)) as T;
}

function mtimeMs(file: string): number | null {
  return fs.existsSync(file) ? fs.statSync(file).mtimeMs : null;
}

function demoLeakageContext(ctx: ReturnType<typeof buildContentGenerationContext>): boolean {
  return BANNED.test(JSON.stringify({
    slug: ctx.slug,
    resolvedSlug: ctx.resolvedSlug,
    serviceId: ctx.serviceId,
    profile: ctx.profile,
    rawProfile: ctx.rawProfile,
    brand: ctx.brand,
    reviewer: ctx.reviewer,
    cta: ctx.cta,
    map: ctx.map,
    selectedAreas: ctx.selectedAreas,
    primaryTown: ctx.primaryTown,
    localArea: ctx.localArea,
    coverageAreas: ctx.coverageAreas,
    tokens: ctx.tokens,
    businessProfileIntelligence: ctx.businessProfileIntelligence,
  }));
}

function collectGphcFields(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (/gphc/i.test(key)) result[pathKey] = child;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, collectGphcFields(child, pathKey));
    }
  }
  return result;
}

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const savedValue = profile.gphcNumber;
  const outputMtimeBefore = mtimeMs(OUTPUT_ROOT);
  const ctx = buildContentGenerationContext(SLUG, CAMPAIGN_ID);
  const outputMtimeAfter = mtimeMs(OUTPUT_ROOT);
  const technical = computeTechnicalGenerationReadiness(validateContentGenerationContext(ctx), demoLeakageContext(ctx));
  const commercial = computeCommercialPublishingReadiness(profile);
  const wizardSectionsSource = read(WIZARD_SECTIONS_SOURCE);
  const wizardPageSource = read(WIZARD_PAGE_SOURCE);
  const saveRouteSource = read(SAVE_ROUTE_SOURCE);
  const schemaSource = read(SCHEMA_SOURCE);
  const readinessSource = read(READINESS_SOURCE);
  const contextSource = read(CONTEXT_SOURCE);
  const renderedWizard = renderProfileWizardHtml(SLUG, profile);
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizard-trust-professional-review`;
  const gphcInputMatch = renderedWizard.match(/<input[^>]+id="gphcNumber"[^>]*>/);
  const gphcInput = gphcInputMatch?.[0] || "";
  const inputNameMatch = gphcInput.match(/\sname="([^"]+)"/);

  const output = {
    canonicalGphcField: CANONICAL_GPHC_FIELD,
    savedValue,
    wizardSource: `${WIZARD_SECTIONS_SOURCE} -> input id/data-field gphcNumber`,
    readinessSource: `${READINESS_SOURCE} -> profile.gphcNumber`,
    technicalGenerationReadiness: technical.status,
    commercialPublishingReadiness: commercial.status,
    exactBrowserUrl: browserUrl,
    trace: {
      htmlInputName: inputNameMatch?.[1] || "(none; wizard uses data-field)",
      htmlInputId: "gphcNumber",
      htmlInputDataField: gphcInput.includes('data-field="gphcNumber"') ? "gphcNumber" : "",
      submittedPostField: "gphcNumber",
      saveHandler: `${SAVE_ROUTE_SOURCE} router.post("/pharmacy/profile/:slug")`,
      profileJsonKeyWritten: "data.gphcNumber",
      exactSavedValue: savedValue,
      readinessCalculatorKeyRead: "profile.gphcNumber",
      generationContextKeyRead: "ctx.profile.gphcNumber",
      reviewerGphcKey: "ctx.reviewer.gphcNumber / data.reviewerGphcNumber",
    },
    liveProfileGphcFields: collectGphcFields(profileDoc.data || {}),
    validationChecks: {
      wizardInputUsesCanonicalKey:
        gphcInput.includes('id="gphcNumber"') &&
        gphcInput.includes('data-field="gphcNumber"') &&
        wizardSectionsSource.includes('fieldRow("GPhC premises number", "gphcNumber", data.gphcNumber)'),
      wizardDoesNotShowRequiredCopyWhenCanonicalValuePresent:
        Boolean(savedValue) &&
        !renderedWizard.includes("GPhC premises number is required before commercial publishing."),
      postSubmissionUsesCanonicalKey:
        wizardPageSource.includes("document.querySelectorAll('[data-field]')") &&
        wizardPageSource.includes("el.getAttribute('data-field')") &&
        wizardPageSource.includes("data[key] = el.value.trim()"),
      saveWritesCanonicalKey:
        saveRouteSource.includes("...(req.body || {})") &&
        saveRouteSource.includes("normalizeProfileData(autoPopulated)") &&
        schemaSource.includes("gphcNumber: str(merged.gphcNumber)"),
      liveTenantValueIsPresent: savedValue === "2068838",
      readinessReadsCanonicalKey:
        readinessSource.includes('field("gphcNumber", "GPhC premises number", profile.gphcNumber)') &&
        !readinessSource.includes("profile.gphcPremisesNumber") &&
        !readinessSource.includes("profile.pharmacyGphcNumber"),
      generationContextReadsCanonicalKey:
        ctx.profile.gphcNumber === savedValue &&
        contextSource.includes("profile,") &&
        schemaSource.includes("gphcNumber: str(merged.gphcNumber)"),
      reviewerGphcRemainsSeparate:
        ctx.reviewer.gphcNumber === profile.reviewerGphcNumber &&
        contextSource.includes("gphcNumber: profile.reviewerGphcNumber"),
      commercialReadinessIsReady: commercial.status === "READY",
      noRegenerationOccurred: outputMtimeBefore === outputMtimeAfter,
    },
  };

  console.log(JSON.stringify(output, null, 2));

  if (!Object.values(output.validationChecks).every(Boolean)) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
