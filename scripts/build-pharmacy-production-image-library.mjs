#!/usr/bin/env node
/**
 * Phase 6J — Build pharmacy production image library blueprint + report.
 * Production-ready metadata only — no image generation, no Ideogram calls.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-production-image-library.json");
const REPORT_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-production-image-library-report.json");

const INPUTS = {
  aiPromptLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json"),
  imageIntelligence: join(ROOT, "output/universal-image-intelligence/image-intelligence.json"),
  templateArchitecture: join(ROOT, "output/pharmacy-blueprint/template-architecture.json"),
  pharmacyImageLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json"),
};

const SLOTS = ["hero", "support", "trust", "conversion"];
const ASSET_ROOT = "assets/pharmacy-image-library";
const PROMPT_LIB = "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json";

const PACK_KEYS = [
  "core-pharmacy",
  "clinical-nhs-services",
  "vaccination-services",
  "travel-health-services",
  "private-healthcare-services",
  "weight-management-services",
];

/** Production pack definitions — exactly 8 images each */
const PRODUCTION_PACK_DEFS = {
  "core-pharmacy": {
    packName: "Core Pharmacy",
    templateFamily: "*",
    slotMappings: { hero: "hero", support: "support", trust: "trust", conversion: "conversion" },
    images: [
      { imageKey: "hero", slot: "hero", purpose: "Primary hero — community pharmacy service introduction", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "support", slot: "support", purpose: "Support — pharmacy service delivery at counter", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "trust", slot: "trust", purpose: "Trust — regulated pharmacy team and credentials", fallbackImageKey: "friendly-pharmacy-team" },
      { imageKey: "conversion", slot: "conversion", purpose: "Conversion — encourage visit or contact", fallbackImageKey: "prescription-collection" },
      { imageKey: "pharmacist-consultation", slot: "support", purpose: "Pharmacist-led confidential consultation room", fallbackImageKey: "friendly-pharmacy-team" },
      { imageKey: "prescription-collection", slot: "conversion", purpose: "Prescription collection and dispensing counter", fallbackImageKey: "community-pharmacy" },
      { imageKey: "friendly-pharmacy-team", slot: "trust", purpose: "Friendly pharmacy team welcoming patients", fallbackImageKey: "community-pharmacy" },
      { imageKey: "community-pharmacy", slot: "trust", purpose: "Community pharmacy exterior or interior — local presence", fallbackImageKey: "friendly-pharmacy-team" },
    ],
  },
  "clinical-nhs-services": {
    packName: "Clinical NHS Services",
    templateFamily: "clinical-nhs-services",
    slotMappings: {
      hero: "pharmacy-first-consultation",
      support: "minor-illness-advice",
      trust: "blood-pressure-check",
      conversion: "nhs-service-support",
    },
    images: [
      { imageKey: "pharmacy-first-consultation", slot: "hero", purpose: "NHS Pharmacy First minor illness consultation", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "minor-illness-advice", slot: "support", purpose: "Minor illness advice and self-care guidance", fallbackImageKey: "pharmacy-first-consultation" },
      { imageKey: "blood-pressure-check", slot: "trust", purpose: "NHS blood pressure screening in pharmacy", fallbackImageKey: "pharmacy-first-consultation" },
      { imageKey: "nhs-service-support", slot: "conversion", purpose: "NHS clinical service access at pharmacy counter", fallbackImageKey: "prescription-collection" },
      { imageKey: "contraception-service", slot: "support", purpose: "Pharmacy contraception consultation", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "smoking-cessation", slot: "support", purpose: "NHS smoking cessation support consultation", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "new-medicine-service", slot: "support", purpose: "NHS New Medicine Service consultation", fallbackImageKey: "pharmacy-first-consultation", promptRef: "clinical-nhs-services.pharmacy-first-consultation" },
      { imageKey: "inhaler-technique-review", slot: "trust", purpose: "Inhaler technique review for asthma and COPD", fallbackImageKey: "blood-pressure-check", promptRef: "clinical-nhs-services.blood-pressure-check" },
    ],
  },
  "vaccination-services": {
    packName: "Vaccination Services",
    templateFamily: "vaccination-services",
    slotMappings: {
      hero: "flu-vaccination",
      support: "vaccination-consultation",
      trust: "vaccination-record-review",
      conversion: "vaccine-availability",
    },
    images: [
      { imageKey: "flu-vaccination", slot: "hero", purpose: "Seasonal flu vaccination in pharmacy clinic", fallbackImageKey: "vaccination-consultation" },
      { imageKey: "vaccination-consultation", slot: "support", purpose: "Pre-vaccination suitability consultation", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "vaccination-record-review", slot: "trust", purpose: "Vaccination record and documentation review", fallbackImageKey: "vaccination-consultation" },
      { imageKey: "vaccine-availability", slot: "conversion", purpose: "Vaccine availability and booking encouragement", fallbackImageKey: "vaccination-consultation" },
      { imageKey: "shingles-vaccination", slot: "support", purpose: "Shingles vaccination appointment", fallbackImageKey: "flu-vaccination" },
      { imageKey: "aftercare-advice", slot: "conversion", purpose: "Post-vaccination aftercare guidance", fallbackImageKey: "vaccination-consultation" },
      { imageKey: "covid-vaccination", slot: "hero", purpose: "COVID-19 vaccination in pharmacy setting", fallbackImageKey: "flu-vaccination", promptRef: "vaccination-services.flu-vaccination" },
      { imageKey: "immunisation-clinic", slot: "trust", purpose: "Professional pharmacy immunisation clinic environment", fallbackImageKey: "vaccination-record-review", promptRef: "vaccination-services.vaccination-record-review" },
    ],
  },
  "travel-health-services": {
    packName: "Travel Health Services",
    templateFamily: "travel-health-services",
    slotMappings: {
      hero: "travel-consultation",
      support: "destination-advice",
      trust: "travel-vaccination",
      conversion: "travel-medicine-planning",
    },
    images: [
      { imageKey: "travel-consultation", slot: "hero", purpose: "Travel health consultation with itinerary review", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "destination-advice", slot: "support", purpose: "Destination-specific travel health advice", fallbackImageKey: "travel-consultation" },
      { imageKey: "travel-vaccination", slot: "trust", purpose: "Travel vaccination administration", fallbackImageKey: "vaccination-consultation" },
      { imageKey: "malaria-advice", slot: "support", purpose: "Malaria prophylaxis and antimalarial advice", fallbackImageKey: "destination-advice" },
      { imageKey: "travel-health-checklist", slot: "support", purpose: "Travel health checklist and preparation", fallbackImageKey: "travel-consultation" },
      { imageKey: "travel-medicine-planning", slot: "conversion", purpose: "Travel medicine planning and booking", fallbackImageKey: "travel-consultation" },
      { imageKey: "yellow-fever-centre", slot: "hero", purpose: "Yellow fever vaccination centre consultation", fallbackImageKey: "travel-consultation", promptRef: "travel-health-services.travel-consultation" },
      { imageKey: "rabies-vaccination", slot: "support", purpose: "Rabies vaccination pre-travel consultation", fallbackImageKey: "travel-vaccination", promptRef: "travel-health-services.travel-vaccination" },
    ],
  },
  "private-healthcare-services": {
    packName: "Private Healthcare Services",
    templateFamily: "private-healthcare-services",
    slotMappings: {
      hero: "ear-wax-removal",
      support: "private-consultation",
      trust: "health-screening",
      conversion: "aftercare-guidance",
    },
    images: [
      { imageKey: "ear-wax-removal", slot: "hero", purpose: "Private ear wax removal microsuction", fallbackImageKey: "private-consultation" },
      { imageKey: "private-consultation", slot: "support", purpose: "Private healthcare consultation in pharmacy", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "health-screening", slot: "trust", purpose: "Private health screening and checks", fallbackImageKey: "private-consultation" },
      { imageKey: "blood-testing", slot: "support", purpose: "Private blood testing sample collection", fallbackImageKey: "health-screening" },
      { imageKey: "b12-consultation", slot: "support", purpose: "Vitamin B12 injection consultation", fallbackImageKey: "private-consultation" },
      { imageKey: "aftercare-guidance", slot: "conversion", purpose: "Private service aftercare guidance", fallbackImageKey: "private-consultation" },
      { imageKey: "diabetes-screening", slot: "trust", purpose: "Private diabetes screening appointment", fallbackImageKey: "health-screening", promptRef: "private-healthcare-services.health-screening" },
      { imageKey: "cholesterol-testing", slot: "support", purpose: "Private cholesterol testing consultation", fallbackImageKey: "blood-testing", promptRef: "private-healthcare-services.blood-testing" },
    ],
  },
  "weight-management-services": {
    packName: "Weight Management Services",
    templateFamily: "weight-management-services",
    slotMappings: {
      hero: "weight-consultation",
      support: "bmi-review",
      trust: "progress-monitoring",
      conversion: "private-weight-support",
    },
    images: [
      { imageKey: "weight-consultation", slot: "hero", purpose: "Medically supervised weight management consultation", fallbackImageKey: "pharmacist-consultation" },
      { imageKey: "bmi-review", slot: "support", purpose: "BMI and body composition monitoring", fallbackImageKey: "weight-consultation" },
      { imageKey: "lifestyle-support", slot: "support", purpose: "Lifestyle and nutrition programme support", fallbackImageKey: "weight-consultation" },
      { imageKey: "progress-monitoring", slot: "trust", purpose: "Regular weight programme progress monitoring", fallbackImageKey: "bmi-review" },
      { imageKey: "healthy-goals-discussion", slot: "trust", purpose: "Healthy goals discussion in weight programme", fallbackImageKey: "weight-consultation" },
      { imageKey: "private-weight-support", slot: "conversion", purpose: "Private weight management booking support", fallbackImageKey: "weight-consultation" },
      { imageKey: "glp-1-consultation", slot: "hero", purpose: "GLP-1 weight management suitability consultation", fallbackImageKey: "weight-consultation", promptRef: "weight-management-services.weight-consultation" },
      { imageKey: "nutrition-advice", slot: "support", purpose: "Nutritional advice within weight management programme", fallbackImageKey: "lifestyle-support", promptRef: "weight-management-services.lifestyle-support" },
    ],
  },
};

const FUTURE_INDUSTRIES = [
  {
    industryKey: "dentist",
    displayName: "Dentist",
    adapterStatus: "planned",
    universalWorkflowLocked: true,
    requiredPacks: 1,
    imagesPerPack: 8,
    slotMappings: { hero: "01", support: "02", trust: "03", conversion: "04" },
    assetPattern: "assets/image-packs/dentist/{slot}.jpg",
    readiness: "workflow-ready",
    gaps: ["business-intelligence.json", "service-intelligence.json", "template-architecture.json", "production-image-library.json"],
  },
  {
    industryKey: "accountant",
    displayName: "Accountant",
    adapterStatus: "partial",
    universalWorkflowLocked: true,
    requiredPacks: 1,
    imagesPerPack: 8,
    slotMappings: { hero: "01", support: "02", trust: "03", conversion: "04" },
    assetPattern: "assets/image-packs/accountant/{slot}.jpg",
    existingAssets: 8,
    readiness: "asset-pack-exists",
    gaps: ["service-intelligence", "template-architecture", "production-image-library", "ai-prompt-library"],
  },
  {
    industryKey: "electrician",
    displayName: "Electrician",
    adapterStatus: "partial",
    universalWorkflowLocked: true,
    requiredPacks: 1,
    imagesPerPack: 8,
    slotMappings: { hero: "01", support: "02", trust: "03", conversion: "04" },
    assetPattern: "assets/image-packs/electrician/{slot}.jpg",
    existingAssets: 8,
    readiness: "asset-pack-exists",
    gaps: ["service-intelligence", "template-architecture", "production-image-library", "ai-prompt-library"],
  },
  {
    industryKey: "builder",
    displayName: "Builder",
    industryType: "general-builder",
    adapterStatus: "partial",
    universalWorkflowLocked: true,
    requiredPacks: 1,
    imagesPerPack: 8,
    slotMappings: { hero: "01", support: "02", trust: "03", conversion: "04" },
    assetPattern: "assets/image-packs/general-builder/{slot}.jpg",
    existingAssets: 8,
    readiness: "asset-pack-exists",
    gaps: ["service-intelligence", "template-architecture", "production-image-library", "ai-prompt-library"],
  },
  {
    industryKey: "hairdresser",
    displayName: "Hairdresser",
    adapterStatus: "partial",
    universalWorkflowLocked: true,
    requiredPacks: 1,
    imagesPerPack: 8,
    slotMappings: { hero: "01", support: "02", trust: "03", conversion: "04" },
    assetPattern: "assets/image-packs/hairdresser/{slot}.jpg",
    existingAssets: 8,
    readiness: "asset-pack-exists",
    gaps: ["service-intelligence", "template-architecture", "production-image-library", "ai-prompt-library"],
  },
];

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function promptRef(pack, imageKey) {
  return `${PROMPT_LIB}#${pack}.${imageKey}`;
}

function findPrompt(aiLib, pack, imageKey) {
  const packData = aiLib.imagePromptPacks?.[pack];
  return packData?.prompts?.find((p) => p.imageKey === imageKey);
}

function buildProductionImage(def, packKey, aiLib) {
  const refKey = def.promptRef ?? `${packKey}.${def.imageKey}`;
  const [refPack, refImage] = refKey.includes(".") ? refKey.split(".") : [packKey, def.imageKey];
  const prompt = findPrompt(aiLib, packKey, def.imageKey) ?? findPrompt(aiLib, refPack, refImage);

  return {
    imageKey: def.imageKey,
    pack: packKey,
    slot: def.slot,
    purpose: def.purpose,
    promptReference: promptRef(refPack, refImage),
    altTextPattern: prompt?.altTextPattern ?? "{serviceName} at {pharmacyName} in {location}",
    captionPattern: prompt?.captionPattern ?? "{pharmacyName} — {location}",
    uploadTargetPath: `${ASSET_ROOT}/${packKey}/${def.imageKey}.webp`,
    fallbackImageKey: def.fallbackImageKey,
    productionStatus: "awaiting-upload",
    aspectRatio: prompt?.aspectRatio ?? (def.slot === "hero" || def.slot === "conversion" ? "16:9" : def.slot === "trust" ? "1:1" : "4:3"),
    stylePreset: prompt?.stylePreset ?? "Realistic",
  };
}

function buildLibrary(inputs) {
  const aiLib = inputs.aiPromptLibrary;
  const imageIntel = inputs.imageIntelligence;
  const templateArch = inputs.templateArchitecture;
  const pharmacyLib = inputs.pharmacyImageLibrary;

  const imagePacks = {};
  for (const packKey of PACK_KEYS) {
    const def = PRODUCTION_PACK_DEFS[packKey];
    imagePacks[packKey] = {
      packKey,
      packName: def.packName,
      templateFamily: def.templateFamily,
      imageCount: 8,
      slotMappings: def.slotMappings,
      images: def.images.map((img) => buildProductionImage(img, packKey, aiLib)),
    };
  }

  const templateFamilies = (templateArch.templateFamilies ?? []).map((f) => f.templateKey);

  const templateFamilySlotCoverage = {};
  for (const familyKey of templateFamilies) {
    const mapping = pharmacyLib.templateFamilyMappings?.[familyKey];
    const preferredPack = mapping?.preferredImagePack;
    const secondaryPack = mapping?.secondaryImagePack ?? "core-pharmacy";
    const fallbackPack = mapping?.fallbackImagePack ?? "core-pharmacy";

    const packImages = (pk) => new Set((imagePacks[pk]?.images ?? []).map((i) => i.imageKey));
    const preferred = packImages(preferredPack);
    const secondary = packImages(secondaryPack);
    const fallback = packImages(fallbackPack);

    const slotCoverage = {};
    for (const slot of SLOTS) {
      const imageKey = imagePacks[preferredPack]?.slotMappings?.[slot] ?? mapping?.slotResolution?.[slot];
      const resolvedIn =
        preferred.has(imageKey) ? preferredPack : secondary.has(imageKey) ? secondaryPack : fallback.has(imageKey) ? fallbackPack : null;
      slotCoverage[slot] = {
        imageKey,
        resolvedInPack: resolvedIn,
        covered: !!resolvedIn,
      };
    }

    templateFamilySlotCoverage[familyKey] = {
      templateFamily: familyKey,
      preferredImagePack: preferredPack,
      secondaryImagePack: secondaryPack,
      fallbackImagePack: fallbackPack,
      slotCoverage,
      allSlotsCovered: SLOTS.every((s) => slotCoverage[s].covered),
    };
  }

  return {
    schemaVersion: "1.0",
    phase: "pharmacy-production-image-library",
    industry: "pharmacy",
    generatedAt: new Date().toISOString(),
    productionReady: true,
    intelligenceOnly: true,
    noImagesGenerated: true,
    noIdeogramCalls: true,
    assetRoot: ASSET_ROOT,
    standardSlots: SLOTS,
    imagesPerPack: 8,
    totalImages: PACK_KEYS.length * 8,
    sourceFiles: {
      aiPromptLibrary: PROMPT_LIB,
      imageIntelligence: "output/universal-image-intelligence/image-intelligence.json",
      templateArchitecture: "output/pharmacy-blueprint/template-architecture.json",
      pharmacyImageLibrary: "output/pharmacy-blueprint/pharmacy-image-library.json",
    },
    universalWorkflowLock: {
      locked: true,
      reference: "output/universal-image-intelligence/image-intelligence.json",
      standardSlots: imageIntel.standardSlots,
      resolutionPipeline: imageIntel.resolutionPipeline?.map((s) => s.name) ?? [],
      approvalWorkflow: "image-intelligence.json#imageApprovalWorkflow",
      qualityScoring: "image-intelligence.json#imageQualityScoringFramework",
    },
    onboardingWorkflow: {
      version: "1.0",
      name: "Pharmacy Production Image Onboarding",
      pipeline: [
        { step: 1, stage: "business-intelligence", name: "Business Intelligence", output: "business-intelligence.json", gate: "industryType=pharmacy" },
        { step: 2, stage: "service-intelligence", name: "Service Intelligence", output: "service-intelligence.json", gate: "all services profiled" },
        { step: 3, stage: "template-architecture", name: "Template Architecture", output: "template-architecture.json", gate: "5 template families defined" },
        { step: 4, stage: "campaign-blueprint", name: "Campaign Blueprint", output: "campaign-blueprints/*.json", gate: "hub + cluster blueprints" },
        { step: 5, stage: "image-pack-blueprint", name: "Image Pack Blueprint", output: "pharmacy-production-image-library.json", gate: "8 images per pack, slot mappings" },
        { step: 6, stage: "prompt-generation", name: "Prompt Generation", output: "pharmacy-ai-image-prompt-library.json", gate: "promptReference resolvable per image" },
        { step: 7, stage: "image-generation", name: "Image Generation", output: "Ideogram candidates (manual)", gate: "4 candidates per prompt" },
        { step: 8, stage: "upload", name: "Upload", output: "assets/pharmacy-image-library/{pack}/{imageKey}.webp", gate: "file at uploadTargetPath" },
        { step: 9, stage: "approval", name: "Approval", output: "approval record via imageApprovalWorkflow", gate: "quality score ≥ threshold AND approved stage" },
        { step: 10, stage: "preview", name: "Preview", output: "output/pharmacy-preview/", gate: "all 4 slots render with assets or library-ref" },
        { step: 11, stage: "live", name: "Live", output: "live campaign pages", gate: "deployment approval (separate phase)" },
      ],
    },
    futureIndustryWorkflow: {
      version: "1.0",
      name: "Universal Future Industry Onboarding",
      lockedBy: "pharmacy-production-image-library",
      referenceWorkflow: "onboardingWorkflow",
      industries: FUTURE_INDUSTRIES,
      universalSteps: [
        "Register industry adapter in image-intelligence.json",
        "Create business-intelligence.json",
        "Create service-intelligence.json",
        "Create template-architecture.json with template families",
        "Create {industry}-production-image-library.json (8 images × N packs)",
        "Create {industry}-ai-image-prompt-library.json",
        "Generate/upload images to industry asset root",
        "Run approval workflow + quality scoring",
        "Render preview → live",
      ],
      pharmacyIsReferenceImplementation: true,
    },
    imagePacks,
    templateFamilySlotCoverage,
    generatorScript: "scripts/build-pharmacy-production-image-library.mjs",
  };
}

function validate(lib) {
  const issues = [];

  for (const packKey of PACK_KEYS) {
    const pack = lib.imagePacks[packKey];
    if (!pack) issues.push(`Missing pack: ${packKey}`);
    else if (pack.images.length !== 8) issues.push(`${packKey}: expected 8 images, got ${pack.images.length}`);

    for (const slot of SLOTS) {
      if (!pack?.slotMappings?.[slot]) issues.push(`${packKey}: missing slot mapping ${slot}`);
    }

    for (const img of pack?.images ?? []) {
      for (const field of ["imageKey", "pack", "slot", "purpose", "promptReference", "altTextPattern", "captionPattern", "uploadTargetPath", "fallbackImageKey"]) {
        if (!img[field]) issues.push(`${packKey}/${img.imageKey}: missing ${field}`);
      }
      if (!img.uploadTargetPath.startsWith(ASSET_ROOT)) issues.push(`${packKey}/${img.imageKey}: invalid uploadTargetPath`);
    }
  }

  const families = Object.keys(lib.templateFamilySlotCoverage ?? {});
  if (families.length !== 5) issues.push(`Expected 5 template families, got ${families.length}`);

  for (const [family, coverage] of Object.entries(lib.templateFamilySlotCoverage ?? {})) {
    if (!coverage.allSlotsCovered) {
      const missing = SLOTS.filter((s) => !coverage.slotCoverage[s]?.covered).join(", ");
      issues.push(`${family}: slots not covered: ${missing}`);
    }
  }

  if ((lib.onboardingWorkflow?.pipeline?.length ?? 0) < 10) issues.push("Onboarding workflow incomplete");
  if ((lib.futureIndustryWorkflow?.industries?.length ?? 0) !== 5) issues.push("Future industry workflow must cover 5 industries");

  return {
    issues,
    totalImages: PACK_KEYS.length * 8,
    packs: PACK_KEYS.length,
    familiesCovered: families.length,
    allFamiliesSlotComplete: Object.values(lib.templateFamilySlotCoverage ?? {}).every((c) => c.allSlotsCovered),
  };
}

function main() {
  for (const [name, p] of Object.entries(INPUTS)) {
    if (!existsSync(p)) {
      console.error(`Missing input: ${name} (${p})`);
      process.exit(1);
    }
  }

  const inputs = {
    aiPromptLibrary: loadJson(INPUTS.aiPromptLibrary),
    imageIntelligence: loadJson(INPUTS.imageIntelligence),
    templateArchitecture: loadJson(INPUTS.templateArchitecture),
    pharmacyImageLibrary: loadJson(INPUTS.pharmacyImageLibrary),
  };

  const library = buildLibrary(inputs);
  const validation = validate(library);
  const pass = validation.issues.length === 0;

  mkdirSync(dirname(LIB_OUT), { recursive: true });
  writeFileSync(LIB_OUT, JSON.stringify(library, null, 2), "utf8");

  const slotCoverageReport = Object.fromEntries(
    Object.entries(library.templateFamilySlotCoverage).map(([k, v]) => [
      k,
      {
        allSlotsCovered: v.allSlotsCovered,
        slots: Object.fromEntries(SLOTS.map((s) => [s, v.slotCoverage[s]])),
      },
    ]),
  );

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-production-image-library",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass ? "PASS: Pharmacy Production Image Library Complete" : "FAIL: Pharmacy Production Image Library Requires Investigation",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    imagesGenerated: false,
    ideogramCalled: false,
    packsCreated: PACK_KEYS.map((k) => ({
      packKey: k,
      packName: library.imagePacks[k].packName,
      imageCount: library.imagePacks[k].images.length,
      slotMappings: library.imagePacks[k].slotMappings,
    })),
    imageCount: validation.totalImages,
    slotCoverage: slotCoverageReport,
    slotCoverageSummary: {
      allFiveFamiliesComplete: validation.allFamiliesSlotComplete,
      hero: Object.values(slotCoverageReport).every((f) => f.slots.hero?.covered !== false),
      support: Object.values(slotCoverageReport).every((f) => f.slots.support?.covered !== false),
      trust: Object.values(slotCoverageReport).every((f) => f.slots.trust?.covered !== false),
      conversion: Object.values(slotCoverageReport).every((f) => f.slots.conversion?.covered !== false),
    },
    onboardingWorkflow: library.onboardingWorkflow,
    futureIndustryReadiness: {
      workflowLocked: library.universalWorkflowLock.locked,
      industriesValidated: library.futureIndustryWorkflow.industries.map((i) => ({
        industry: i.industryKey,
        readiness: i.readiness,
        existingAssets: i.existingAssets ?? 0,
        gaps: i.gaps,
      })),
      allFiveIndustriesOnboardable: library.futureIndustryWorkflow.industries.length === 5,
    },
    readyForIdeogramGeneration: pass,
    validation: { issues: validation.issues },
    libraryPath: "output/pharmacy-blueprint/pharmacy-production-image-library.json",
  };

  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Packs: ${validation.packs}, Images: ${validation.totalImages}, Families: ${validation.familiesCovered}`);
  console.log(`Slot coverage complete: ${validation.allFamiliesSlotComplete}`);
  console.log(`Library: ${LIB_OUT.replace(ROOT + "/", "")}`);
  console.log(`Report: ${REPORT_OUT.replace(ROOT + "/", "")}`);
  if (!pass) {
    console.error("Issues:", validation.issues.join("; "));
    process.exit(1);
  }
}

main();
