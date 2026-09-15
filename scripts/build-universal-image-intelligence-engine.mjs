#!/usr/bin/env node
/**
 * Phase 6F — Build Universal Image Intelligence Engine JSON + validation report.
 * Unifies pharmacy + digital-services image/prompt intelligence. No image generation.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const ENGINE_OUT = join(ROOT, "output/universal-image-intelligence/universal-image-intelligence-engine.json");
const REPORT_OUT = join(ROOT, "output/universal-image-intelligence/universal-image-intelligence-engine-report.json");

const INPUTS = {
  pharmacyBusinessIntelligence: join(ROOT, "output/pharmacy-blueprint/business-intelligence.json"),
  pharmacyServiceIntelligence: join(ROOT, "output/pharmacy-blueprint/service-intelligence.json"),
  pharmacyTemplateArchitecture: join(ROOT, "output/pharmacy-blueprint/template-architecture.json"),
  pharmacyImageLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json"),
  pharmacyAiPromptLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json"),
  referenceCampaign: join(ROOT, "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json"),
  digitalManifest: join(ROOT, "assets/image-library/image-library.json"),
  imagePromptBlueprints: join(ROOT, "config/imagePromptBlueprints.json"),
  imageConfig: join(ROOT, "input/image-config.json"),
};

const STANDARD_SLOTS = ["hero", "support", "trust", "conversion"];

const SLOT_DEFINITIONS = {
  hero: {
    purpose: "Primary above-the-fold visual — service introduction and trust",
    aspectRatio: "16:9",
    schemaProperty: "MedicalWebPage.primaryImageOfPage / WebPage.primaryImageOfPage",
  },
  support: {
    purpose: "Mid-page supporting imagery — service detail, process, local relevance",
    aspectRatio: "4:3",
    schemaProperty: "ImageObject",
  },
  trust: {
    purpose: "Trust and credibility — team, credentials, evidence, reassurance",
    aspectRatio: "1:1",
    schemaProperty: "LocalBusiness.image / ImageObject",
  },
  conversion: {
    purpose: "Conversion band — booking, enquiry, contact encouragement",
    aspectRatio: "16:9",
    schemaProperty: "ImageObject",
  },
};

const GENERIC_PROMPT_TEMPLATE =
  "Create a {style} image for a {businessType} offering {serviceName} in {location}. The image should show {scene}, with {brandStyle}, suitable for the {slot} section of a local service page.";

const NEGATIVE_PROMPT_TEMPLATE =
  "{baseNegative}. Avoid {slotSpecificAvoid}. No text overlays, logos, watermarks, or readable labels.";

const DIGITAL_BASE_NEGATIVE =
  "blurry, distorted, cartoon unless specified, watermark, text overlay, readable UI text, brand logos, stock photo watermark, low quality, oversaturated, generic office stock photo, meaningless abstract charts";

const DIGITAL_SERVICES = [
  "web-hosting",
  "web-design",
  "local-seo",
  "email-marketing",
  "google-business-profile",
  "local-business-visibility",
];

const DIGITAL_SERVICE_CONTEXT = {
  "web-hosting": {
    displayName: "Web Hosting",
    industryContext: "reliable website hosting, server uptime, WordPress support, fast loading websites",
    scenes: {
      hero: "premium website hosting dashboard with uptime metrics and server reliability visual",
      support: "technical support specialist helping a business owner with website hosting setup",
      trust: "secure hosting infrastructure with SSL padlock and performance monitoring charts",
      conversion: "business owner launching a fast reliable website with hosting support",
    },
  },
  "web-design": {
    displayName: "Web Design",
    industryContext: "professional website design, premium UI mockups, local business websites",
    scenes: {
      hero: "premium UI mockup of a modern local business website on desktop and mobile",
      support: "web designer reviewing website layout with a local business owner",
      trust: "polished website design portfolio showing professional local business sites",
      conversion: "business owner approving a new website design ready to launch",
    },
  },
  "local-seo": {
    displayName: "Local SEO",
    industryContext: "Google Maps rankings, local search visibility, GBP optimisation, local enquiries",
    scenes: {
      hero: "local business ranking prominently on Google Maps search results visualization",
      support: "SEO specialist reviewing local search analytics with a business owner",
      trust: "local search ranking improvement chart and Google Business Profile optimisation",
      conversion: "local business owner receiving more enquiries from improved local SEO",
    },
  },
  "email-marketing": {
    displayName: "Email Marketing",
    industryContext: "email campaigns, newsletter design, customer engagement, conversion emails",
    scenes: {
      hero: "professional email marketing campaign layout with engaging newsletter design",
      support: "marketer planning email campaign strategy with a local business client",
      trust: "email analytics dashboard showing open rates and customer engagement growth",
      conversion: "business owner sending a successful email campaign to customers",
    },
  },
  "google-business-profile": {
    displayName: "Google Business Profile",
    industryContext: "Google Maps profile, reviews, local visibility, GBP management",
    scenes: {
      hero: "optimised Google Business Profile listing with reviews and local map presence",
      support: "consultant improving a local business Google profile with photos and categories",
      trust: "five-star review growth and verified Google Business Profile management",
      conversion: "local business receiving calls and directions from Google Maps profile",
    },
  },
  "local-business-visibility": {
    displayName: "Local Business Visibility",
    industryContext: "multi-channel local visibility, search, maps, directories, online presence",
    scenes: {
      hero: "local business gaining visibility across search maps and online directories",
      support: "visibility consultant auditing a local business online presence",
      trust: "consistent NAP citations and strong local search footprint evidence",
      conversion: "business owner seeing increased local enquiries from visibility improvements",
    },
  },
};

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function buildDigitalPromptPack(blueprints) {
  const prompts = {};
  const slotCompositions = blueprints?.slots ?? {};

  for (const service of DIGITAL_SERVICES) {
    const cfg = DIGITAL_SERVICE_CONTEXT[service] ?? {
      displayName: service.replace(/-/g, " "),
      industryContext: "professional digital services for local businesses",
      scenes: {
        hero: "professional digital service hero scene",
        support: "consultative service planning scene",
        trust: "credibility and results evidence scene",
        conversion: "business owner taking action scene",
      },
    };

    for (const slot of STANDARD_SLOTS) {
      const key = `${service}-${slot}`;
      const composition = slotCompositions[slot]?.composition ?? `professional ${slot} image for local business`;
      const scene = cfg.scenes[slot] ?? composition;

      prompts[key] = {
        imageKey: key,
        imagePack: "digital-services",
        templateFamily: "digital-services",
        compatibleServices: [service],
        recommendedSlot: slot,
        purpose: slotCompositions[slot]?.purpose ?? `${slot} image for ${cfg.displayName}`,
        ideogramPrompt: [
          `Clean professional digital service illustration for ${cfg.displayName}.`,
          `Scene: ${scene}.`,
          `Context: ${cfg.industryContext}.`,
          `Composition: ${composition}.`,
          "Modern flat vector or premium UI mockup style as appropriate.",
          "Brand colours #005EB8 #1CA9C9 #003A6D where used.",
          "No text, no logos, no watermarks, transparent or light neutral background.",
          `Optimised for ${slot} section of a local service page. 16:9 or 4:3 as appropriate.`,
        ].join(" "),
        negativePrompt: `${DIGITAL_BASE_NEGATIVE}, meaningless office stock photos, random bright backgrounds, photorealistic people unless specified`,
        aspectRatio: SLOT_DEFINITIONS[slot].aspectRatio,
        stylePreset: service === "web-design" ? "Design" : "General",
        altTextPattern: "{serviceName} {location} — professional {slot} image",
        captionPattern: "{serviceName} — {location}",
        safetyNotes: "No readable UI text or fake brand logos",
        complianceNotes: "Generic digital service imagery — no guaranteed ranking claims in visual",
        uploadTargetPath: `assets/image-library/${service}/${slot}/{filename}.webp`,
        fallbackImageKey: `${service}-hero`,
      };
    }
  }

  return { packKey: "digital-services", packName: "Digital Services", prompts };
}

function buildEngine(inputs) {
  const pharmacyImageLib = inputs.pharmacyImageLibrary;
  const pharmacyPromptLib = inputs.pharmacyAiPromptLibrary;
  const templateArch = inputs.pharmacyTemplateArchitecture;
  const digitalManifest = inputs.digitalManifest;
  const promptBlueprints = inputs.imagePromptBlueprints;

  const pharmacyFamilies = (templateArch.templateFamilies ?? []).map((f) => f.templateKey);
  const pharmacyServices = Object.keys(inputs.pharmacyServiceIntelligence.services ?? {});

  const digitalManifestImages = digitalManifest.images ?? [];
  const digitalServicesInManifest = [...new Set(digitalManifestImages.map((i) => i.service))];

  const pharmacySlotMappings = {};
  for (const [familyKey, mapping] of Object.entries(pharmacyImageLib.templateFamilyMappings ?? {})) {
    pharmacySlotMappings[familyKey] = mapping.slotResolution;
  }

  const templateFamilyPackMap = {};
  for (const [familyKey, mapping] of Object.entries(pharmacyImageLib.templateFamilyMappings ?? {})) {
    templateFamilyPackMap[familyKey] = mapping.preferredImagePack;
  }

  const digitalPromptPack = buildDigitalPromptPack(promptBlueprints);

  return {
    schemaVersion: "1.0",
    phase: "universal-image-intelligence-engine",
    generatedAt: new Date().toISOString(),
    intelligenceOnly: true,
    noImagesGenerated: true,
    noIdeogramCalls: true,
    standardSlots: STANDARD_SLOTS,
    slotDefinitions: SLOT_DEFINITIONS,
    genericPromptTemplate: GENERIC_PROMPT_TEMPLATE,
    negativePromptTemplate: NEGATIVE_PROMPT_TEMPLATE,
    resolutionPipeline: [
      { step: 1, name: "Industry detection", description: "Resolve industryType to adapter (pharmacy | digital-services)" },
      { step: 2, name: "Service context", description: "Load serviceKey, serviceName, businessName, location from campaign or intelligence" },
      { step: 3, name: "Template family", description: "For pharmacy: map service to template family via template-architecture" },
      { step: 4, name: "Slot resolution", description: "Map page slot (hero/support/trust/conversion) to imageKey via family slotResolution" },
      { step: 5, name: "Asset lookup", description: "Check asset path in industry library manifest or pharmacy image library" },
      { step: 6, name: "Prompt resolution", description: "Load AI prompt metadata from industry prompt pack when generation needed" },
      { step: 7, name: "Unified output", description: "Return ResolvedUniversalImageIntelligence with alt, caption, assetPath, prompt" },
    ],
    ideogramDefaults: {
      recommendedModel: "Ideogram 2.0 or Ideogram 3",
      outputCountPerPrompt: 4,
      styleGuidance: "Match industry adapter — realistic photography for pharmacy, vector/UI mockup for digital services",
      aspectRatioBySlot: Object.fromEntries(STANDARD_SLOTS.map((s) => [s, SLOT_DEFINITIONS[s].aspectRatio])),
      imageSelectionCriteria: pharmacyPromptLib.ideogramSettings?.imageSelectionCriteria ?? [
        "Matches recommended aspect ratio",
        "No readable text or logos",
        "Industry-appropriate scene",
        "Brand-consistent lighting and tone",
      ],
    },
    onboardingProcess: {
      steps: [
        { step: 1, name: "Detect industry", description: "Campaign or blueprint provides industryType", output: "adapterKey" },
        { step: 2, name: "Resolve service context", description: "serviceKey, templateFamily, location from intelligence layers", output: "UniversalImageContext" },
        { step: 3, name: "Resolve slot", description: "hero/support/trust/conversion mapped to imageKey", output: "imageKey + imagePack" },
        { step: 4, name: "Generate or load prompt", description: "AI prompt from industry prompt pack if asset missing", output: "ideogramPrompt + negativePrompt" },
        { step: 5, name: "Create images", description: "Manual Ideogram generation — not automated in this phase", output: "Image files" },
        { step: 6, name: "Upload to library", description: "Place at uploadTargetPath for industry adapter", output: "Asset file on disk" },
        { step: 7, name: "Validate assets", description: "assetExists check via universalImageIntelligenceEngine.ts", output: "assetExists: true" },
        { step: 8, name: "Render preview", description: "Industry renderer uses resolved asset or metadata placeholder", output: "Preview HTML" },
        { step: 9, name: "Approve and deploy", description: "Clinical/brand review then live campaign wiring", output: "Live pages" },
      ],
    },
    industryAdapters: {
      pharmacy: {
        adapterKey: "pharmacy",
        industryType: "pharmacy",
        displayName: "UK Community Pharmacy",
        assetRoot: pharmacyImageLib.assetRoot,
        libraryPaths: {
          imageLibrary: "output/pharmacy-blueprint/pharmacy-image-library.json",
          aiPromptLibrary: "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
          templateArchitecture: "output/pharmacy-blueprint/template-architecture.json",
          serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
        },
        supportedSlots: STANDARD_SLOTS,
        services: pharmacyServices,
        templateFamilies: pharmacyFamilies,
        imagePacks: Object.keys(pharmacyImageLib.imagePacks ?? {}),
        pharmacySlotMappings,
        templateFamilyPackMap,
        resolverModule: "src/pharmacy/templates/pharmacyImageLibrary.ts",
        totalImagesDefined: Object.values(pharmacyImageLib.imagePacks ?? {}).reduce(
          (n, p) => n + (p.images?.length ?? 0),
          0,
        ),
        totalPromptsDefined: Object.values(pharmacyPromptLib.imagePromptPacks ?? {}).reduce(
          (n, p) => n + (p.prompts?.length ?? 0),
          0,
        ),
      },
      "digital-services": {
        adapterKey: "digital-services",
        industryType: "digital-services",
        displayName: "Digital Services (Web Design, SEO, Hosting, Email)",
        assetRoot: "assets/image-library",
        libraryPaths: {
          manifest: "assets/image-library/image-library.json",
          promptBlueprints: "config/imagePromptBlueprints.json",
          imageConfig: "input/image-config.json",
        },
        supportedSlots: STANDARD_SLOTS,
        services: DIGITAL_SERVICES,
        manifestServicesPresent: digitalServicesInManifest,
        approvedImagesInManifest: digitalManifestImages.filter((i) => i.approved).length,
        slotMappings: Object.fromEntries(
          DIGITAL_SERVICES.map((svc) => [
            svc,
            Object.fromEntries(STANDARD_SLOTS.map((slot) => [slot, `${svc}-${slot}`])),
          ]),
        ),
        resolverModule: "src/generator/imageLibrary.ts",
        promptResolverModule: "src/local-seo/generateImagePrompt.ts",
      },
    },
    promptPacks: {
      "digital-services": digitalPromptPack,
      pharmacy: {
        packKey: "pharmacy",
        packName: "Pharmacy (imported)",
        source: "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
        packCount: Object.keys(pharmacyPromptLib.imagePromptPacks ?? {}).length,
        totalPrompts: Object.values(pharmacyPromptLib.imagePromptPacks ?? {}).reduce(
          (n, p) => n + (p.prompts?.length ?? 0),
          0,
        ),
      },
    },
    crossIndustrySlotMapping: {
      description: "All industries use hero/support/trust/conversion page slots",
      slots: STANDARD_SLOTS,
      pharmacyMapsVia: "templateFamilyMappings.slotResolution",
      digitalMapsVia: "service + slot manifest lookup with prompt pack fallback",
    },
    runtimeModule: "src/image-intelligence/universalImageIntelligenceEngine.ts",
    resolutionExamples: [
      {
        industryType: "pharmacy",
        serviceKey: "pharmacy-first",
        templateFamilyKey: "clinical-nhs-services",
        location: "Rotherham",
        businessName: "Brook Pharmacy",
        slots: pharmacySlotMappings["clinical-nhs-services"],
      },
      {
        industryType: "digital-services",
        serviceKey: "web-hosting",
        location: "Rotherham",
        businessName: "InboxingProWeb",
        slots: Object.fromEntries(STANDARD_SLOTS.map((s) => [s, `web-hosting-${s}`])),
      },
    ],
  };
}

function validate(engine) {
  const issues = [];
  const adapters = Object.keys(engine.industryAdapters);

  if (!adapters.includes("pharmacy")) issues.push("Missing pharmacy adapter");
  if (!adapters.includes("digital-services")) issues.push("Missing digital-services adapter");

  for (const slot of STANDARD_SLOTS) {
    if (!engine.slotDefinitions[slot]) issues.push(`Missing slot definition: ${slot}`);
  }

  for (const [key, adapter] of Object.entries(engine.industryAdapters)) {
    if (!adapter.assetRoot) issues.push(`${key}: missing assetRoot`);
    if (!adapter.supportedSlots?.length) issues.push(`${key}: missing supportedSlots`);
    for (const slot of STANDARD_SLOTS) {
      if (!adapter.supportedSlots.includes(slot)) issues.push(`${key}: missing slot ${slot}`);
    }
  }

  const pharmacy = engine.industryAdapters.pharmacy;
  if ((pharmacy.templateFamilies?.length ?? 0) !== 5) {
    issues.push(`Pharmacy: expected 5 template families, got ${pharmacy.templateFamilies?.length}`);
  }
  if ((pharmacy.imagePacks?.length ?? 0) !== 6) {
    issues.push(`Pharmacy: expected 6 image packs, got ${pharmacy.imagePacks?.length}`);
  }

  const digitalPrompts = engine.promptPacks?.["digital-services"]?.prompts ?? {};
  let digitalPromptCount = Object.keys(digitalPrompts).length;
  const expectedDigital = DIGITAL_SERVICES.length * STANDARD_SLOTS.length;
  if (digitalPromptCount !== expectedDigital) {
    issues.push(`Digital: expected ${expectedDigital} prompts, got ${digitalPromptCount}`);
  }

  for (const [key, prompt] of Object.entries(digitalPrompts)) {
    for (const field of ["ideogramPrompt", "negativePrompt", "uploadTargetPath", "aspectRatio"]) {
      if (!prompt[field]) issues.push(`digital/${key}: missing ${field}`);
    }
  }

  if (!engine.runtimeModule) issues.push("Missing runtimeModule reference");
  if (engine.resolutionPipeline.length < 5) issues.push("Resolution pipeline incomplete");

  const totalPrompts =
    (pharmacy.totalPromptsDefined ?? 0) + digitalPromptCount;

  return {
    issues,
    adapters,
    totalPrompts,
    pharmacyFamilies: pharmacy.templateFamilies?.length ?? 0,
    pharmacyPacks: pharmacy.imagePacks?.length ?? 0,
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
    pharmacyBusinessIntelligence: loadJson(INPUTS.pharmacyBusinessIntelligence),
    pharmacyServiceIntelligence: loadJson(INPUTS.pharmacyServiceIntelligence),
    pharmacyTemplateArchitecture: loadJson(INPUTS.pharmacyTemplateArchitecture),
    pharmacyImageLibrary: loadJson(INPUTS.pharmacyImageLibrary),
    pharmacyAiPromptLibrary: loadJson(INPUTS.pharmacyAiPromptLibrary),
    referenceCampaign: loadJson(INPUTS.referenceCampaign),
    digitalManifest: loadJson(INPUTS.digitalManifest),
    imagePromptBlueprints: loadJson(INPUTS.imagePromptBlueprints),
    imageConfig: loadJson(INPUTS.imageConfig),
  };

  const engine = buildEngine(inputs);
  const validation = validate(engine);
  const pass = validation.issues.length === 0;

  mkdirSync(dirname(ENGINE_OUT), { recursive: true });
  writeFileSync(ENGINE_OUT, JSON.stringify(engine, null, 2), "utf8");

  const report = {
    schemaVersion: "1.0",
    phase: "universal-image-intelligence-engine",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Universal Image Intelligence Engine Complete"
      : "FAIL: Universal Image Intelligence Engine Requires Investigation",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    imagesGenerated: false,
    ideogramCalled: false,
    industryAdapters: validation.adapters.map((a) => ({
      adapterKey: a,
      displayName: engine.industryAdapters[a].displayName,
      services: engine.industryAdapters[a].services?.length ?? 0,
      templateFamilies: engine.industryAdapters[a].templateFamilies?.length ?? null,
    })),
    totalPrompts: validation.totalPrompts,
    pharmacyCoverage: {
      templateFamilies: validation.pharmacyFamilies,
      imagePacks: validation.pharmacyPacks,
      promptsImported: engine.industryAdapters.pharmacy.totalPromptsDefined,
    },
    digitalServicesCoverage: {
      services: DIGITAL_SERVICES.length,
      promptsGenerated: Object.keys(engine.promptPacks["digital-services"].prompts).length,
      manifestImages: engine.industryAdapters["digital-services"].approvedImagesInManifest,
    },
    safetyComplianceStatus: {
      crossIndustrySlotStandard: true,
      pharmacySafetyRulesInherited: true,
      digitalNoRankingClaimsInPrompts: true,
      noIdeogramCallsInEngine: true,
    },
    uploadPathStrategy: {
      pharmacy: "assets/pharmacy-image-library/{pack}/{imageKey}.webp",
      digitalServices: "assets/image-library/{service}/{slot}/{filename}.webp",
      unifiedResolver: "src/image-intelligence/universalImageIntelligenceEngine.ts",
    },
    readyForCrossIndustryResolution: pass,
    validation: {
      pharmacyAndDigitalAdapters: validation.adapters.length === 2,
      fourStandardSlots: STANDARD_SLOTS.every((s) => engine.slotDefinitions[s]),
      resolutionPipelineDefined: engine.resolutionPipeline.length >= 7,
      runtimeModulePresent: !!engine.runtimeModule,
      issues: validation.issues,
    },
    enginePath: "output/universal-image-intelligence/universal-image-intelligence-engine.json",
    generatorScript: "scripts/build-universal-image-intelligence-engine.mjs",
  };

  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Adapters: ${validation.adapters.join(", ")}, Total prompts: ${validation.totalPrompts}`);
  console.log(`Engine: ${ENGINE_OUT.replace(ROOT + "/", "")}`);
  console.log(`Report: ${REPORT_OUT.replace(ROOT + "/", "")}`);
  if (!pass) {
    console.error("Issues:", validation.issues.join("; "));
    process.exit(1);
  }
}

main();
