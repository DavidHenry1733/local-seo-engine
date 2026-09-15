#!/usr/bin/env node
/**
 * Phase 6E — Build pharmacy image library architecture JSON + validation report.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json");
const REPORT_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-image-library-report.json");

const STANDARD_SLOTS = ["hero", "support", "trust", "conversion"];

function img(
  imageKey,
  imagePack,
  purpose,
  recommendedPlacement,
  altTextPattern,
  captionPattern,
  schemaUsage,
  serviceCompatibility,
  fallbackRules,
) {
  return {
    imageKey,
    imagePack,
    purpose,
    recommendedPlacement,
    altTextPattern,
    captionPattern,
    schemaUsage,
    serviceCompatibility,
    fallbackRules,
    assetPath: `assets/pharmacy-image-library/${imagePack}/${imageKey}.webp`,
  };
}

function buildLibrary() {
  const coreImages = [
    ...STANDARD_SLOTS.map((slot) =>
      img(
        slot,
        "core-pharmacy",
        `Core pharmacy ${slot} image for community pharmacy pages`,
        [slot],
        `{serviceName} at {pharmacyName} in {location}`,
        `{pharmacyName} — {location}`,
        slot === "hero" ? "MedicalWebPage.primaryImageOfPage" : "ImageObject",
        ["*"],
        ["pharmacist-consultation", "community-pharmacy"],
      ),
    ),
    img(
      "pharmacist-consultation",
      "core-pharmacy",
      "Pharmacist-led private consultation in pharmacy consultation room",
      ["support", "trust"],
      "Pharmacist consultation for {serviceName} at {pharmacyName} in {location}",
      "Confidential pharmacist consultation",
      "ImageObject",
      ["*"],
      ["friendly-pharmacy-team"],
    ),
    img(
      "prescription-collection",
      "core-pharmacy",
      "Prescription collection and dispensing counter scene",
      ["conversion", "support"],
      "Prescription collection at {pharmacyName} in {location}",
      "NHS and private prescription support",
      "ImageObject",
      ["*"],
      ["community-pharmacy"],
    ),
    img(
      "friendly-pharmacy-team",
      "core-pharmacy",
      "Friendly pharmacy team welcoming patients",
      ["trust", "hero"],
      "Pharmacy team at {pharmacyName} in {location}",
      "Your local pharmacy team",
      "ImageObject",
      ["*"],
      ["community-pharmacy"],
    ),
    img(
      "community-pharmacy",
      "core-pharmacy",
      "Independent community pharmacy exterior or interior",
      ["trust", "hero"],
      "{pharmacyName} community pharmacy in {location}",
      "Independent community pharmacy",
      "LocalBusiness.image",
      ["*"],
      ["friendly-pharmacy-team"],
    ),
  ];

  const clinicalImages = [
    img(
      "pharmacy-first",
      "clinical-nhs-services",
      "NHS Pharmacy First consultation for minor illness",
      ["hero"],
      "Pharmacy First consultation at {pharmacyName} in {location}",
      "NHS Pharmacy First — pharmacist-led care",
      "Service.image",
      ["pharmacy-first", "nhs-blood-pressure-checks", "nhs-new-medicine-service-nms", "pharmacy-contraception-service", "nhs-smoking-cessation-support"],
      ["pharmacist-consultation", "hero"],
    ),
    img(
      "blood-pressure-check",
      "clinical-nhs-services",
      "NHS blood pressure check in pharmacy",
      ["support", "hero"],
      "NHS blood pressure check at {pharmacyName} in {location}",
      "NHS hypertension case finding",
      "Service.image",
      ["nhs-blood-pressure-checks", "pharmacy-first"],
      ["pharmacy-first", "pharmacist-consultation"],
    ),
    img(
      "contraception-service",
      "clinical-nhs-services",
      "Pharmacy contraception consultation",
      ["support"],
      "Pharmacy contraception service at {pharmacyName} in {location}",
      "Confidential contraception advice",
      "Service.image",
      ["pharmacy-contraception-service"],
      ["pharmacist-consultation"],
    ),
    img(
      "smoking-cessation",
      "clinical-nhs-services",
      "NHS smoking cessation support consultation",
      ["support", "conversion"],
      "NHS smoking cessation support at {pharmacyName} in {location}",
      "Stop smoking pharmacy support",
      "Service.image",
      ["nhs-smoking-cessation-support"],
      ["pharmacist-consultation"],
    ),
  ];

  const vaccinationImages = [
    img(
      "flu-vaccination",
      "vaccination-services",
      "Seasonal flu vaccination in pharmacy",
      ["hero"],
      "NHS flu vaccination at {pharmacyName} in {location}",
      "Flu jab pharmacy service",
      "Service.image",
      ["nhs-flu-vaccination", "seasonal-flu-vaccination-private", "covid-19-vaccination"],
      ["vaccination-consultation", "hero"],
    ),
    img(
      "shingles-vaccination",
      "vaccination-services",
      "Shingles vaccination appointment",
      ["support", "hero"],
      "Shingles vaccination at {pharmacyName} in {location}",
      "Shingles immunisation",
      "Service.image",
      ["shingles-vaccination", "pneumococcal-vaccination"],
      ["flu-vaccination"],
    ),
    img(
      "vaccination-consultation",
      "vaccination-services",
      "Pre-vaccination consultation with trained vaccinator",
      ["support", "trust"],
      "Vaccination consultation at {pharmacyName} in {location}",
      "Vaccination suitability assessment",
      "ImageObject",
      ["*"],
      ["pharmacist-consultation"],
    ),
    img(
      "vaccination-record-review",
      "vaccination-services",
      "Vaccination record and documentation review",
      ["trust", "conversion"],
      "Vaccination records at {pharmacyName} in {location}",
      "Travel and NHS vaccination records",
      "ImageObject",
      ["*"],
      ["vaccination-consultation"],
    ),
  ];

  const travelImages = [
    img(
      "travel-consultation",
      "travel-health-services",
      "Travel health consultation with itinerary review",
      ["hero"],
      "Travel health consultation at {pharmacyName} in {location}",
      "Travel clinic consultation",
      "Service.image",
      ["travel-health-consultation", "travel-vaccinations", "malaria-prophylaxis"],
      ["destination-advice", "hero"],
    ),
    img(
      "destination-advice",
      "travel-health-services",
      "Destination-specific travel health advice",
      ["support", "hero"],
      "Destination travel advice at {pharmacyName} in {location}",
      "Destination risk guidance",
      "ImageObject",
      ["travel-vaccinations", "travel-health-consultation"],
      ["travel-consultation"],
    ),
    img(
      "travel-vaccination",
      "travel-health-services",
      "Travel vaccination administration",
      ["hero", "support"],
      "Travel vaccinations at {pharmacyName} in {location}",
      "Travel vaccines before your trip",
      "Service.image",
      ["travel-vaccinations", "yellow-fever-vaccination-centre", "rabies-vaccination"],
      ["vaccination-consultation"],
    ),
    img(
      "malaria-advice",
      "travel-health-services",
      "Malaria prophylaxis and travel medicine advice",
      ["support", "conversion"],
      "Malaria advice at {pharmacyName} in {location}",
      "Antimalarial consultation",
      "ImageObject",
      ["malaria-prophylaxis", "travel-health-consultation"],
      ["destination-advice"],
    ),
  ];

  const privateImages = [
    img(
      "ear-wax-removal",
      "private-healthcare-services",
      "Private ear wax removal microsuction procedure",
      ["hero"],
      "Private ear wax removal at {pharmacyName} in {location}",
      "Professional ear wax removal",
      "Service.image",
      ["private-ear-wax-removal"],
      ["private-consultation", "hero"],
    ),
    img(
      "private-consultation",
      "private-healthcare-services",
      "Private healthcare consultation in pharmacy",
      ["support", "trust"],
      "Private consultation at {pharmacyName} in {location}",
      "Private appointment consultation",
      "ImageObject",
      ["*"],
      ["pharmacist-consultation"],
    ),
    img(
      "health-screening",
      "private-healthcare-services",
      "Private health screening and checks",
      ["support", "hero"],
      "Health screening at {pharmacyName} in {location}",
      "Private health screening",
      "Service.image",
      ["private-blood-testing", "diabetes-screening", "cholesterol-testing"],
      ["private-consultation"],
    ),
    img(
      "blood-testing",
      "private-healthcare-services",
      "Private blood testing sample collection",
      ["support", "conversion"],
      "Private blood testing at {pharmacyName} in {location}",
      "Private blood tests",
      "Service.image",
      ["private-blood-testing"],
      ["health-screening"],
    ),
  ];

  const weightImages = [
    img(
      "weight-consultation",
      "weight-management-services",
      "Medically supervised weight management consultation",
      ["hero"],
      "Weight management consultation at {pharmacyName} in {location}",
      "Pharmacy weight management consultation",
      "Service.image",
      ["pharmacy-weight-loss-programme", "weight-management-consultation", "glp-1-weight-management-treatment"],
      ["bmi-review", "hero"],
    ),
    img(
      "bmi-review",
      "weight-management-services",
      "BMI and body composition monitoring",
      ["support", "trust"],
      "BMI review at {pharmacyName} in {location}",
      "Progress and BMI monitoring",
      "ImageObject",
      ["body-composition-and-bmi-monitoring", "pharmacy-weight-loss-programme"],
      ["weight-consultation"],
    ),
    img(
      "lifestyle-support",
      "weight-management-services",
      "Lifestyle and nutrition support in pharmacy programme",
      ["support", "conversion"],
      "Lifestyle weight support at {pharmacyName} in {location}",
      "Lifestyle and nutrition guidance",
      "ImageObject",
      ["nutritional-and-lifestyle-advice", "pharmacy-weight-loss-programme"],
      ["weight-consultation"],
    ),
    img(
      "progress-monitoring",
      "weight-management-services",
      "Regular weight management progress monitoring",
      ["trust", "conversion"],
      "Weight programme monitoring at {pharmacyName} in {location}",
      "Medically supervised progress reviews",
      "ImageObject",
      ["pharmacy-weight-loss-programme"],
      ["bmi-review"],
    ),
  ];

  const imagePacks = {
    "core-pharmacy": {
      packKey: "core-pharmacy",
      packName: "Core Pharmacy",
      description: "Shared community pharmacy imagery for all template families",
      images: coreImages,
    },
    "clinical-nhs-services": {
      packKey: "clinical-nhs-services",
      packName: "Clinical NHS Services",
      description: "NHS clinical service imagery for Pharmacy First and commissioned pathways",
      images: clinicalImages,
    },
    "vaccination-services": {
      packKey: "vaccination-services",
      packName: "Vaccination Services",
      description: "Immunisation and vaccination clinic imagery",
      images: vaccinationImages,
    },
    "travel-health-services": {
      packKey: "travel-health-services",
      packName: "Travel Health Services",
      description: "Travel clinic, destination advice and travel medicine imagery",
      images: travelImages,
    },
    "private-healthcare-services": {
      packKey: "private-healthcare-services",
      packName: "Private Healthcare Services",
      description: "Private appointment and screening service imagery",
      images: privateImages,
    },
    "weight-management-services": {
      packKey: "weight-management-services",
      packName: "Weight Management Services",
      description: "Medically supervised weight management programme imagery",
      images: weightImages,
    },
  };

  const templateFamilyMappings = {
    "clinical-nhs-services": {
      templateKey: "clinical-nhs-services",
      preferredImagePack: "clinical-nhs-services",
      secondaryImagePack: "core-pharmacy",
      fallbackImagePack: "core-pharmacy",
      slotResolution: {
        hero: "pharmacy-first",
        support: "blood-pressure-check",
        trust: "community-pharmacy",
        conversion: "prescription-collection",
      },
    },
    "vaccination-services": {
      templateKey: "vaccination-services",
      preferredImagePack: "vaccination-services",
      secondaryImagePack: "core-pharmacy",
      fallbackImagePack: "core-pharmacy",
      slotResolution: {
        hero: "flu-vaccination",
        support: "vaccination-consultation",
        trust: "vaccination-record-review",
        conversion: "vaccination-consultation",
      },
    },
    "private-healthcare-services": {
      templateKey: "private-healthcare-services",
      preferredImagePack: "private-healthcare-services",
      secondaryImagePack: "core-pharmacy",
      fallbackImagePack: "core-pharmacy",
      slotResolution: {
        hero: "ear-wax-removal",
        support: "private-consultation",
        trust: "health-screening",
        conversion: "private-consultation",
      },
    },
    "travel-health-services": {
      templateKey: "travel-health-services",
      preferredImagePack: "travel-health-services",
      secondaryImagePack: "core-pharmacy",
      fallbackImagePack: "core-pharmacy",
      slotResolution: {
        hero: "travel-consultation",
        support: "destination-advice",
        trust: "travel-vaccination",
        conversion: "malaria-advice",
      },
    },
    "weight-management-services": {
      templateKey: "weight-management-services",
      preferredImagePack: "weight-management-services",
      secondaryImagePack: "core-pharmacy",
      fallbackImagePack: "core-pharmacy",
      slotResolution: {
        hero: "weight-consultation",
        support: "bmi-review",
        trust: "progress-monitoring",
        conversion: "lifestyle-support",
      },
    },
  };

  const slotMappings = {
    hero: {
      description: "Primary page hero — service introduction and emotional trust",
      schemaProperty: "MedicalWebPage.primaryImageOfPage / Service.image",
    },
    support: {
      description: "Mid-page support imagery — service detail, process or local relevance",
      schemaProperty: "ImageObject",
    },
    trust: {
      description: "Trust section — credentials, team, regulated care environment",
      schemaProperty: "LocalBusiness.image / ImageObject",
    },
    conversion: {
      description: "Conversion band — booking, consultation or contact encouragement",
      schemaProperty: "ImageObject",
    },
  };

  const onboardingProcess = {
    steps: [
      { step: 1, name: "New service", description: "Service added to pharmacy catalogue or intelligence pipeline", output: "service-intelligence.json entry" },
      { step: 2, name: "Service intelligence", description: "Profile, benefits, FAQs and trust signals generated", output: "service-intelligence.json" },
      { step: 3, name: "Template assignment", description: "Service mapped to one of five template families", output: "template-architecture.json serviceTemplateMap" },
      { step: 4, name: "Image pack assignment", description: "Preferred, secondary and fallback packs plus slot resolution assigned", output: "pharmacy-image-library.json templateFamilyMappings" },
      { step: 5, name: "Campaign blueprint", description: "Hub/cluster blueprints inherit image slot resolution from family mapping", output: "campaign blueprint JSON" },
      { step: 6, name: "Page generation", description: "Renderer resolves hero/support/trust/conversion from image library metadata or uploaded assets", output: "HTML with pharmacy-image figures" },
    ],
  };

  return {
    schemaVersion: "1.0",
    phase: "pharmacy-image-library-architecture",
    industry: "pharmacy",
    assetRoot: "assets/pharmacy-image-library",
    standardSlots: STANDARD_SLOTS,
    imagePacks,
    templateFamilyMappings,
    slotMappings,
    onboardingProcess,
    serviceImageOverrides: {
      "pharmacy-first": { hero: "pharmacy-first", pack: "clinical-nhs-services" },
      "nhs-flu-vaccination": { hero: "flu-vaccination", pack: "vaccination-services" },
      "private-ear-wax-removal": { hero: "ear-wax-removal", pack: "private-healthcare-services" },
      "travel-vaccinations": { hero: "travel-vaccination", pack: "travel-health-services" },
      "pharmacy-weight-loss-programme": { hero: "weight-consultation", pack: "weight-management-services" },
    },
  };
}

function validate(library) {
  const issues = [];
  const families = Object.keys(library.templateFamilyMappings);
  const packs = Object.keys(library.imagePacks);

  if (families.length !== 5) issues.push(`template families: expected 5, got ${families.length}`);
  if (packs.length !== 6) issues.push(`image packs: expected 6, got ${packs.length}`);

  for (const slot of STANDARD_SLOTS) {
    if (!library.slotMappings[slot]) issues.push(`missing slot mapping: ${slot}`);
  }

  for (const [key, mapping] of Object.entries(library.templateFamilyMappings)) {
    for (const slot of STANDARD_SLOTS) {
      if (!mapping.slotResolution[slot]) issues.push(`${key}: missing slot ${slot}`);
      const imageKey = mapping.slotResolution[slot];
      const pack = library.imagePacks[mapping.preferredImagePack];
      const found = pack?.images.some((i) => i.imageKey === imageKey);
      const coreFound = library.imagePacks["core-pharmacy"]?.images.some((i) => i.imageKey === imageKey);
      if (!found && !coreFound) issues.push(`${key}.${slot}: imageKey ${imageKey} not in preferred or core pack`);
    }
  }

  let totalImages = 0;
  for (const pack of Object.values(library.imagePacks)) {
    totalImages += pack.images.length;
    for (const image of pack.images) {
      for (const field of ["imageKey", "imagePack", "purpose", "altTextPattern", "captionPattern", "schemaUsage"]) {
        if (!image[field]) issues.push(`missing ${field} on ${image.imageKey}`);
      }
      if (!Array.isArray(image.recommendedPlacement) || !image.recommendedPlacement.length) {
        issues.push(`${image.imageKey}: missing recommendedPlacement`);
      }
      if (!Array.isArray(image.fallbackRules)) issues.push(`${image.imageKey}: missing fallbackRules`);
    }
  }

  return { issues, totalImages, families, packs };
}

function main() {
  const library = buildLibrary();
  const validation = validate(library);
  const pass = validation.issues.length === 0;

  mkdirSync(dirname(LIB_OUT), { recursive: true });
  writeFileSync(LIB_OUT, JSON.stringify(library, null, 2), "utf8");

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-image-library-architecture",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Pharmacy Image Library Architecture Complete"
      : "FAIL: Pharmacy Image Library Architecture Requires Investigation",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    imagePacksCreated: Object.keys(library.imagePacks).map((k) => ({
      packKey: k,
      packName: library.imagePacks[k].packName,
      imageCount: library.imagePacks[k].images.length,
    })),
    totalImagesDefined: validation.totalImages,
    templateMappings: library.templateFamilyMappings,
    slotMappings: library.slotMappings,
    futureOnboardingProcess: library.onboardingProcess,
    rendererIntegrationStatus: {
      module: "src/pharmacy/templates/pharmacyImageLibrary.ts",
      integratedInto: [
        "src/pharmacy/templates/pharmacyBrandSystem.ts",
        "src/pharmacy/templates/pharmacyTemplateCore.ts",
        "src/pharmacy/templates/renderClinicalNhsService.ts",
      ],
      metadataOnly: true,
      uploadsRequiredForLiveAssets: true,
    },
    readyForImageUpload: true,
    validation: {
      allFiveTemplateFamiliesMapped: validation.families.length === 5,
      allImagePacksMapped: validation.packs.length === 6,
      allImageSlotsMapped: STANDARD_SLOTS.every((s) => library.slotMappings[s]),
      issues: validation.issues,
    },
    libraryPath: "output/pharmacy-blueprint/pharmacy-image-library.json",
  };

  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Image packs: ${validation.packs.length}, Images defined: ${validation.totalImages}, Template families: ${validation.families.length}`);
  console.log(`Library: ${LIB_OUT.replace(ROOT + "/", "")}`);
  console.log(`Report: ${REPORT_OUT.replace(ROOT + "/", "")}`);
  if (!pass) {
    console.error("Issues:", validation.issues.join("; "));
    process.exit(1);
  }
}

main();
