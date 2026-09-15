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
const CANONICAL_REVIEW_DATE_FIELD = "nextReviewDate";
const PROFILE_PATH = path.join(ROOT, "data/pharmacy-profiles", `${SLUG}.json`);
const WIZARD_SECTIONS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardSections.ts");
const WIZARD_PAGE_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardPage.ts");
const SAVE_ROUTE_SOURCE = path.join(ROOT, "artifacts/api-server/src/routes/api/pharmacyProfiles.ts");
const SCHEMA_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileSchema.ts");
const READINESS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyCommercialReadinessGate.ts");
const CONTEXT_SOURCE = path.join(ROOT, "src/pharmacy/contentEngine/buildContentGenerationContext.ts");
const FIELD_CLASSIFICATION_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileFieldClassification.ts");
const WIZARD_STEPS_SOURCE = path.join(ROOT, "src/pharmacy/pharmacyProfileWizardSteps.ts");
const OUTPUT_ROOT = path.join(ROOT, "output/pharmacy-content-ecosystem", SLUG, CAMPAIGN_ID);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
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

function collectReviewDateFields(value: unknown, prefix = ""): Record<string, unknown> {
  if (!value || typeof value !== "object") return {};
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    const pathKey = prefix ? `${prefix}.${key}` : key;
    if (/review.*date|date.*review/i.test(key)) result[pathKey] = child;
    if (child && typeof child === "object" && !Array.isArray(child)) {
      Object.assign(result, collectReviewDateFields(child, pathKey));
    }
  }
  return result;
}

async function main(): Promise<void> {
  const profileDoc = readJson<{ data?: Record<string, unknown> }>(PROFILE_PATH, {});
  const profile = normalizeProfileData(profileDoc.data || {});
  const savedValue = profile.nextReviewDate;
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
  const fieldClassificationSource = read(FIELD_CLASSIFICATION_SOURCE);
  const wizardStepsSource = read(WIZARD_STEPS_SOURCE);
  const renderedWizard = renderProfileWizardHtml(SLUG, profile);
  const browserUrl = `${APP_DOMAIN.replace(/\/$/, "")}/api/pharmacy-profile-wizard?slug=${encodeURIComponent(SLUG)}#wizard-trust-professional-review`;
  const nextReviewInputMatch = renderedWizard.match(/<input[^>]+id="nextReviewDate"[^>]*>/);
  const nextReviewInput = nextReviewInputMatch?.[0] || "";
  const inputNameMatch = nextReviewInput.match(/\sname="([^"]+)"/);

  const output = {
    canonicalReviewDateField: CANONICAL_REVIEW_DATE_FIELD,
    savedValue,
    wizardSource: `${WIZARD_SECTIONS_SOURCE} -> input id/data-field nextReviewDate`,
    readinessSource: `${READINESS_SOURCE} -> optional field profile.nextReviewDate`,
    technicalGenerationReadiness: technical.status,
    commercialPublishingReadiness: commercial.status,
    exactBrowserUrl: browserUrl,
    trace: {
      htmlInputName: inputNameMatch?.[1] || "(none; wizard uses data-field)",
      htmlInputId: "nextReviewDate",
      htmlInputDataField: nextReviewInput.includes('data-field="nextReviewDate"') ? "nextReviewDate" : "",
      submittedPostField: "nextReviewDate",
      saveHandler: `${SAVE_ROUTE_SOURCE} router.post("/pharmacy/profile/:slug")`,
      profileJsonKeyWritten: "data.nextReviewDate",
      exactSavedValue: savedValue,
      readinessCalculatorKeyRead: "profile.nextReviewDate",
      generationContextKeyRead: "ctx.reviewer.nextReviewDate",
      dateFormatExpected: {
        htmlInput: "YYYY-MM-DD",
        submittedPostField: "YYYY-MM-DD",
        profileJson: "YYYY-MM-DD",
        readinessCalculator: "YYYY-MM-DD",
        generationContext: "YYYY-MM-DD",
      },
    },
    liveProfileReviewDateFields: collectReviewDateFields(profileDoc.data || {}),
    validationChecks: {
      wizardInputUsesCanonicalKey:
        nextReviewInput.includes('id="nextReviewDate"') &&
        nextReviewInput.includes('data-field="nextReviewDate"') &&
        wizardSectionsSource.includes('fieldRow("Next Review Date", "nextReviewDate", data.nextReviewDate, "date", false)'),
      saveWritesCanonicalKey:
        saveRouteSource.includes("...(req.body || {})") &&
        saveRouteSource.includes("normalizeProfileData(autoPopulated)") &&
        schemaSource.includes("nextReviewDate: dateOnly(merged.nextReviewDate)"),
      liveTenantValueIsPresent: Boolean(savedValue),
      dateFormatIsYyyyMmDd: DATE_RE.test(savedValue),
      readinessReadsCanonicalKey:
        readinessSource.includes('field("nextReviewDate", "Next Review Date", profile.nextReviewDate, false)') &&
        !readinessSource.includes("profile.reviewDate") &&
        !readinessSource.includes("profile.reviewerReviewDate") &&
        !readinessSource.includes("profile.professionalReviewDate"),
      generationContextReceivesSameValue:
        ctx.reviewer.nextReviewDate === savedValue &&
        contextSource.includes("nextReviewDate: profile.nextReviewDate"),
      noDuplicateDateFieldControlsReadiness:
        fieldClassificationSource.includes('{ id: "nextReviewDate", label: "Next review date", tier: "optional"') &&
        !wizardStepsSource.includes("Next review date is required"),
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
