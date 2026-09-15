#!/usr/bin/env node
/**
 * Build canonical image-intelligence.json — universal slot mapping, prompt components,
 * pack assignment engine, onboarding, approval, and quality scoring frameworks.
 */
import { readFileSync, mkdirSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(ROOT, "output/universal-image-intelligence/image-intelligence.json");
const REPORT = join(ROOT, "output/universal-image-intelligence/image-intelligence-report.json");

const INPUTS = {
  pharmacyImageLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json"),
  pharmacyAiPromptLibrary: join(ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json"),
  pharmacyTemplateArchitecture: join(ROOT, "output/pharmacy-blueprint/template-architecture.json"),
  pharmacyServiceIntelligence: join(ROOT, "output/pharmacy-blueprint/service-intelligence.json"),
  digitalManifest: join(ROOT, "assets/image-library/image-library.json"),
  engine: join(ROOT, "output/universal-image-intelligence/universal-image-intelligence-engine.json"),
};

const SLOTS = ["hero", "support", "trust", "conversion"];

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function comp(key, category, label, text, opts = {}) {
  return {
    componentKey: key,
    category,
    label,
    text,
    appliesTo: opts.appliesTo ?? ["*"],
    slots: opts.slots,
    polarity: opts.polarity ?? (category === "negative" ? "negative" : "positive"),
  };
}

function buildPromptComponentLibrary() {
  const components = {
    "style.realistic-photo": comp(
      "style.realistic-photo",
      "style",
      "Realistic photography",
      "Photorealistic documentary-style photograph.",
      { appliesTo: ["pharmacy"] },
    ),
    "style.digital-illustration": comp(
      "style.digital-illustration",
      "style",
      "Digital illustration",
      "Clean professional digital service illustration or premium UI mockup.",
      { appliesTo: ["digital-services"] },
    ),
    "style.premium-ui-mockup": comp(
      "style.premium-ui-mockup",
      "style",
      "Premium UI mockup",
      "High-quality premium UI mockup illustration with realistic website interface quality.",
      { appliesTo: ["digital-services"], slots: ["hero", "support"] },
    ),
    "scene.pharmacy-consultation": comp(
      "scene.pharmacy-consultation",
      "scene",
      "Pharmacy consultation",
      "Pharmacist conducting a calm private consultation with a patient in a pharmacy consultation room.",
      { appliesTo: ["pharmacy"] },
    ),
    "scene.pharmacy-counter": comp(
      "scene.pharmacy-counter",
      "scene",
      "Pharmacy counter",
      "Welcoming community pharmacy interior with pharmacist greeting a patient at the dispensary counter.",
      { appliesTo: ["pharmacy"] },
    ),
    "scene.pharmacy-team": comp(
      "scene.pharmacy-team",
      "scene",
      "Pharmacy team",
      "Friendly qualified pharmacy team in a tidy dispensary with warm professional lighting.",
      { appliesTo: ["pharmacy"], slots: ["trust", "hero"] },
    ),
    "scene.digital-consultation": comp(
      "scene.digital-consultation",
      "scene",
      "Digital consultation",
      "Consultant reviewing digital strategy with a local business owner in a modern professional setting.",
      { appliesTo: ["digital-services"], slots: ["support", "conversion"] },
    ),
    "scene.local-search-results": comp(
      "scene.local-search-results",
      "scene",
      "Local search visibility",
      "Local business ranking prominently in Google Maps and local search results visualization.",
      { appliesTo: ["digital-services"], slots: ["hero", "trust"] },
    ),
    "brand.pharmacy-nhs-green": comp(
      "brand.pharmacy-nhs-green",
      "brand",
      "Pharmacy NHS green brand",
      "NHS blue and pharmacy green accent decor, authentic UK independent community pharmacy feel.",
      { appliesTo: ["pharmacy"] },
    ),
    "brand.digital-blue": comp(
      "brand.digital-blue",
      "brand",
      "Digital brand blues",
      "Brand accent colours #005EB8 #1CA9C9 #003A6D, clean modern professional tone.",
      { appliesTo: ["digital-services"] },
    ),
    "composition.clean-professional": comp(
      "composition.clean-professional",
      "composition",
      "Clean professional composition",
      "Clean composition, shallow depth of field, sharp focus on subjects, uncluttered background.",
    ),
    "composition.hero-wide": comp(
      "composition.hero-wide",
      "composition",
      "Hero wide shot",
      "Wide shot optimised for hero section, strong visual hierarchy, space for page headline overlay.",
      { slots: ["hero"] },
    ),
    "composition.trust-portrait": comp(
      "composition.trust-portrait",
      "composition",
      "Trust portrait",
      "Balanced square-friendly composition emphasising credibility and human connection.",
      { slots: ["trust"] },
    ),
    "lighting.warm-trustworthy": comp(
      "lighting.warm-trustworthy",
      "lighting",
      "Warm trustworthy lighting",
      "Warm trustworthy natural or interior lighting, soft shadows, professional healthcare editorial tone.",
    ),
    "compliance.no-logos-text": comp(
      "compliance",
      "compliance",
      "No logos or readable text",
      "No visible brand logos, no readable text, labels, medication packaging brands, or patient identifiable data.",
    ),
    "slot-intent.hero": comp(
      "slot-intent.hero",
      "slot-intent",
      "Hero slot intent",
      "Suitable for the hero section — service introduction and immediate trust.",
      { slots: ["hero"] },
    ),
    "slot-intent.support": comp(
      "slot-intent.support",
      "slot-intent",
      "Support slot intent",
      "Suitable for the support section — service detail, process explanation, local relevance.",
      { slots: ["support"] },
    ),
    "slot-intent.trust": comp(
      "slot-intent.trust",
      "slot-intent",
      "Trust slot intent",
      "Suitable for the trust section — credentials, team, regulated care environment.",
      { slots: ["trust"] },
    ),
    "slot-intent.conversion": comp(
      "slot-intent.conversion",
      "slot-intent",
      "Conversion slot intent",
      "Suitable for the conversion section — encouraging contact, booking or visit.",
      { slots: ["conversion"] },
    ),
    "negative.base-universal": comp(
      "negative.base-universal",
      "negative",
      "Universal negative base",
      "blurry, distorted, watermark, text overlay, readable labels, brand logos, stock photo watermark, low quality, oversaturated, horror lighting, identifiable celebrity",
      { polarity: "negative" },
    ),
    "negative.pharmacy-clinical": comp(
      "negative.pharmacy-clinical",
      "negative",
      "Pharmacy clinical negative",
      "NHS logo, fake NHS branding, POM packaging, needles close-up unless vaccination, distressing illness, blood, before and after weight loss, patient names, medical records with identifiable data, exaggerated medical claims",
      { appliesTo: ["pharmacy"], polarity: "negative" },
    ),
    "negative.digital-services": comp(
      "negative.digital-services",
      "negative",
      "Digital services negative",
      "meaningless office stock photos, random bright backgrounds, generic laptops with no context, abstract charts with no meaning, photorealistic people unless specified for web-design",
      { appliesTo: ["digital-services"], polarity: "negative" },
    ),
    "negative.slot-hero-clutter": comp(
      "negative.slot-hero-clutter",
      "negative",
      "Hero clutter negative",
      "cluttered backgrounds, extreme close-ups, dark oppressive shadows",
      { slots: ["hero"], polarity: "negative" },
    ),
  };

  const industryPresets = {
    "pharmacy.clinical-nhs-services.hero": {
      positive: ["style.realistic-photo", "scene.pharmacy-consultation", "brand.pharmacy-nhs-green", "composition.hero-wide", "lighting.warm-trustworthy", "slot-intent.hero", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.pharmacy-clinical", "negative.slot-hero-clutter"],
    },
    "pharmacy.clinical-nhs-services.support": {
      positive: ["style.realistic-photo", "scene.pharmacy-consultation", "brand.pharmacy-nhs-green", "composition.clean-professional", "lighting.warm-trustworthy", "slot-intent.support", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.pharmacy-clinical"],
    },
    "pharmacy.clinical-nhs-services.trust": {
      positive: ["style.realistic-photo", "scene.pharmacy-team", "brand.pharmacy-nhs-green", "composition.trust-portrait", "lighting.warm-trustworthy", "slot-intent.trust", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.pharmacy-clinical"],
    },
    "pharmacy.clinical-nhs-services.conversion": {
      positive: ["style.realistic-photo", "scene.pharmacy-counter", "brand.pharmacy-nhs-green", "composition.clean-professional", "lighting.warm-trustworthy", "slot-intent.conversion", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.pharmacy-clinical"],
    },
    "pharmacy.default.hero": {
      positive: ["style.realistic-photo", "scene.pharmacy-counter", "brand.pharmacy-nhs-green", "composition.hero-wide", "lighting.warm-trustworthy", "slot-intent.hero", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.pharmacy-clinical"],
    },
    "digital-services.default.hero": {
      positive: ["style.premium-ui-mockup", "scene.digital-consultation", "brand.digital-blue", "composition.hero-wide", "slot-intent.hero", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.digital-services"],
    },
    "digital-services.default.support": {
      positive: ["style.digital-illustration", "scene.digital-consultation", "brand.digital-blue", "composition.clean-professional", "slot-intent.support", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.digital-services"],
    },
    "digital-services.default.trust": {
      positive: ["style.digital-illustration", "scene.local-search-results", "brand.digital-blue", "composition.trust-portrait", "slot-intent.trust", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.digital-services"],
    },
    "digital-services.default.conversion": {
      positive: ["style.digital-illustration", "scene.digital-consultation", "brand.digital-blue", "composition.clean-professional", "slot-intent.conversion", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.digital-services"],
    },
  };

  return {
    version: "1.0",
    categories: ["style", "scene", "brand", "composition", "lighting", "compliance", "slot-intent", "negative"],
    components,
    assemblyRules: {
      positive: ["style.{industryStyle}", "scene.{sceneKey}", "brand.{brandKey}", "composition.{compositionKey}", "lighting.{lightingKey}", "slot-intent.{slot}", "compliance.no-logos-text"],
      negative: ["negative.base-universal", "negative.{industryNegative}", "negative.slot-{slot}-clutter"],
    },
    industryPresets,
    totalComponents: Object.keys(components).length,
  };
}

function buildUniversalSlotMapping(pharmacyImageLib) {
  const pharmacyFamilySlots = {};
  for (const [family, mapping] of Object.entries(pharmacyImageLib.templateFamilyMappings ?? {})) {
    pharmacyFamilySlots[family] = mapping.slotResolution;
  }

  return {
    version: "1.0",
    description: "Cross-industry hero/support/trust/conversion slot standard with industry-specific imageKey resolution",
    slots: {
      hero: {
        purpose: "Primary above-the-fold visual — service introduction and trust",
        aspectRatio: "16:9",
        stylePreset: "Realistic",
        schemaProperty: "MedicalWebPage.primaryImageOfPage / WebPage.primaryImageOfPage",
        pageSectionIds: ["service-hero", "hero-section"],
        placement: "hero-media",
      },
      support: {
        purpose: "Mid-page supporting imagery — service detail, process, local relevance",
        aspectRatio: "4:3",
        stylePreset: "Realistic",
        schemaProperty: "ImageObject",
        pageSectionIds: ["service-local", "service-support", "clinical-local-service"],
        placement: "mid-page",
      },
      trust: {
        purpose: "Trust and credibility — team, credentials, evidence",
        aspectRatio: "1:1",
        stylePreset: "Realistic",
        schemaProperty: "LocalBusiness.image / ImageObject",
        pageSectionIds: ["service-trust"],
        placement: "trust-grid",
      },
      conversion: {
        purpose: "Conversion band — booking, enquiry, contact encouragement",
        aspectRatio: "16:9",
        stylePreset: "Realistic",
        schemaProperty: "ImageObject",
        pageSectionIds: ["service-cta", "clinical-cta"],
        placement: "cta-band",
      },
    },
    industryOverrides: {
      pharmacy: {
        assetRoot: "assets/pharmacy-image-library",
        slotResolutionSource: "templateFamilyMappings.slotResolution",
        familySlotMappings: pharmacyFamilySlots,
      },
      "digital-services": {
        assetRoot: "assets/image-library",
        slotResolutionSource: "manifest.service+slot",
        slotPattern: "{serviceKey}/{slot}/{filename}.webp",
      },
    },
    crossIndustryRules: [
      "All industries MUST implement hero, support, trust, and conversion slots",
      "Slot aspect ratios are consistent; style preset may vary by industry adapter",
      "Fallback chain: preferred pack → secondary pack → core/fallback pack → metadata placeholder",
    ],
  };
}

function buildImagePackAssignmentEngine(pharmacyImageLib, templateArch) {
  const templateFamilyMappings = {};
  for (const [key, mapping] of Object.entries(pharmacyImageLib.templateFamilyMappings ?? {})) {
    templateFamilyMappings[key] = {
      preferredImagePack: mapping.preferredImagePack,
      secondaryImagePack: mapping.secondaryImagePack,
      fallbackImagePack: mapping.fallbackImagePack,
      slotResolution: mapping.slotResolution,
    };
  }

  const families = (templateArch.templateFamilies ?? []).map((f) => f.templateKey);

  const rules = families.map((familyKey, i) => ({
    ruleId: `pharmacy-family-${familyKey}`,
    priority: i + 1,
    when: { industryType: "pharmacy", templateFamilyKey: familyKey },
    assign: templateFamilyMappings[familyKey],
    reason: `Pharmacy template family: ${familyKey}`,
  }));

  rules.push({
    ruleId: "digital-services-default",
    priority: 100,
    when: { industryType: "digital-services" },
    assign: {
      preferredImagePack: "digital-services",
      secondaryImagePack: "digital-services",
      fallbackImagePack: "digital-services",
      slotResolution: Object.fromEntries(SLOTS.map((s) => [s, `{serviceKey}-${s}`])),
    },
    reason: "Digital services use service+slot manifest lookup",
  });

  return {
    version: "1.0",
    coreFallbackPack: "core-pharmacy",
    resolveOrder: ["serviceOverride", "templateFamilyMapping", "assignmentRule", "industryDefault", "coreFallback"],
    industryDefaults: {
      pharmacy: { preferredImagePack: "core-pharmacy", secondaryImagePack: "core-pharmacy", fallbackImagePack: "core-pharmacy" },
      "digital-services": { preferredImagePack: "digital-services", secondaryImagePack: "digital-services", fallbackImagePack: "digital-services" },
    },
    templateFamilyMappings,
    serviceOverrides: pharmacyImageLib.serviceImageOverrides ?? {},
    rules,
    packRegistry: {
      "core-pharmacy": { industryType: "pharmacy", crossFamily: true, imageCount: pharmacyImageLib.imagePacks?.["core-pharmacy"]?.images?.length ?? 0 },
      ...Object.fromEntries(
        Object.entries(pharmacyImageLib.imagePacks ?? {})
          .filter(([k]) => k !== "core-pharmacy")
          .map(([k, p]) => [k, { industryType: "pharmacy", imageCount: p.images?.length ?? 0 }]),
      ),
      "digital-services": { industryType: "digital-services", manifestBased: true },
    },
  };
}

function buildBusinessOnboardingWorkflow() {
  return {
    version: "1.0",
    name: "Future Business Image Intelligence Onboarding",
    description: "End-to-end workflow for onboarding a new business/industry into the universal image intelligence system",
    stages: [
      { step: 1, stage: "business-discovery", name: "Business discovery", description: "Capture industryType, business model, brand style, compliance level", outputs: ["business-intelligence.json"], gate: "industryType defined" },
      { step: 2, stage: "service-intelligence", name: "Service intelligence", description: "Generate service profiles, benefits, FAQs, trust signals per service", outputs: ["service-intelligence.json"], gate: "≥1 service profile complete" },
      { step: 3, stage: "template-assignment", name: "Template assignment", description: "Map services to template families and page structures", outputs: ["template-architecture.json"], gate: "all services mapped to template family" },
      { step: 4, stage: "image-pack-design", name: "Image pack design", description: "Define image packs, slot resolution, and service compatibility per family", outputs: ["{industry}-image-library.json"], gate: "hero/support/trust/conversion mapped per family" },
      { step: 5, stage: "prompt-component-setup", name: "Prompt component setup", description: "Create or extend prompt component library presets for industry", outputs: ["image-intelligence.json promptComponentLibrary"], gate: "industry presets for all slots" },
      { step: 6, stage: "ai-prompt-generation", name: "AI prompt generation", description: "Build industry AI prompt library from components and service scenes", outputs: ["{industry}-ai-image-prompt-library.json"], gate: "prompt per imageKey with safety notes" },
      { step: 7, stage: "campaign-blueprint", name: "Campaign blueprint", description: "Hub/cluster blueprints inherit image slot resolution from pack assignment", outputs: ["campaign-blueprints/*.json"], gate: "blueprint references image pack" },
      { step: 8, stage: "image-generation", name: "Image generation", description: "Generate images via Ideogram using composed prompts (manual or automated)", outputs: ["asset files"], gate: "assets at uploadTargetPath" },
      { step: 9, stage: "quality-approval", name: "Quality & approval", description: "Score, review, approve images through approval workflow", outputs: ["approved manifest entries"], gate: "quality score ≥ threshold AND approved stage" },
      { step: 10, stage: "preview-validation", name: "Preview validation", description: "Render preview pages and validate slot placement", outputs: ["preview HTML"], gate: "all 4 slots render correctly" },
      { step: 11, stage: "live-campaign", name: "Live campaign wiring", description: "Approved images served in live page generation pipeline", outputs: ["live pages"], gate: "deployment approval (out of scope for intelligence phase)" },
    ],
    newIndustryChecklist: [
      "Register industry adapter in image-intelligence.json industryAdapters",
      "Add industryDefaults to imagePackAssignmentEngine",
      "Create prompt component presets for each template family × slot",
      "Define industry-specific negative prompt components",
      "Configure quality scoring industryModifiers",
      "Set compliance autoRejectRules for regulated industries",
    ],
  };
}

function buildImageApprovalWorkflow() {
  return {
    version: "1.0",
    name: "Universal Image Approval Workflow",
    stages: [
      { stageId: "pending-generation", name: "Pending generation", description: "Slot identified, prompt resolved, awaiting AI generation or upload", requiredRole: null, autoAdvance: false, nextStages: ["generated"] },
      { stageId: "generated", name: "Generated / uploaded", description: "Image file exists at uploadTargetPath", requiredRole: null, autoAdvance: true, nextStages: ["quality-scored", "rejected"] },
      { stageId: "quality-scored", name: "Quality scored", description: "Automated quality scoring complete", requiredRole: null, autoAdvance: true, nextStages: ["compliance-review", "rejected"] },
      { stageId: "compliance-review", name: "Compliance review", description: "Clinical/regulatory review for healthcare or regulated content", requiredRole: "compliance-reviewer", autoAdvance: false, nextStages: ["brand-review", "rejected"] },
      { stageId: "brand-review", name: "Brand review", description: "Brand consistency and visual quality sign-off", requiredRole: "brand-reviewer", autoAdvance: false, nextStages: ["approved", "rejected"] },
      { stageId: "approved", name: "Approved", description: "Image approved for campaign use", requiredRole: "approver", autoAdvance: false, nextStages: ["archived"] },
      { stageId: "rejected", name: "Rejected", description: "Image rejected — regenerate or replace", requiredRole: null, autoAdvance: false, nextStages: ["pending-generation"] },
      { stageId: "archived", name: "Archived", description: "Previously approved image retired from active use", requiredRole: "admin", autoAdvance: false, nextStages: [] },
    ],
    roles: {
      "compliance-reviewer": "Reviews healthcare/regulatory compliance (pharmacy, clinical services)",
      "brand-reviewer": "Reviews brand consistency, lighting, composition",
      approver: "Final sign-off for campaign use",
      admin: "Archive and lifecycle management",
    },
    autoTransitions: {
      "generated→quality-scored": "Automatic after quality scoring runs",
      "quality-scored→compliance-review": "When normalisedScore ≥ manualReview threshold",
      "quality-scored→rejected": "When normalisedScore < autoReject OR autoRejectRule triggered",
    },
    manifestFields: {
      approvalStage: "stage",
      approvedAt: "ISO timestamp when stage=approved",
      approvedBy: "reviewer user id",
      qualityScore: "normalisedScore from quality framework",
    },
  };
}

function buildImageQualityScoringFramework() {
  return {
    version: "1.0",
    name: "Universal Image Quality Scoring Framework",
    scale: "0-100 normalised weighted score",
    dimensions: [
      { dimensionId: "technical", label: "Technical quality", weight: 0.2, maxScore: 10, criteria: ["Sharp focus", "Correct aspect ratio for slot", "Appropriate resolution", "No compression artefacts", "Balanced exposure"], industryModifiers: { pharmacy: 1.0, "digital-services": 1.0 } },
      { dimensionId: "brand", label: "Brand alignment", weight: 0.2, maxScore: 10, criteria: ["Matches industry brand style", "Consistent with other slot images", "Appropriate colour tone", "Professional presentation"], industryModifiers: { pharmacy: 1.1, "digital-services": 1.0 } },
      { dimensionId: "compliance", label: "Compliance & safety", weight: 0.25, maxScore: 10, criteria: ["No readable text/logos", "No POM branding (pharmacy)", "No fake NHS logo", "No patient identifiable data", "No before/after claims", "No exaggerated medical claims"], industryModifiers: { pharmacy: 1.3, "digital-services": 0.9 } },
      { dimensionId: "slot-fit", label: "Slot fit", weight: 0.15, maxScore: 10, criteria: ["Appropriate for hero/support/trust/conversion intent", "Composition suits page section", "Emotional tone matches slot purpose"], industryModifiers: { pharmacy: 1.0, "digital-services": 1.0 } },
      { dimensionId: "accessibility", label: "Accessibility", weight: 0.1, maxScore: 10, criteria: ["Alt text accurately describes scene", "Sufficient contrast for overlay text areas", "No flashing/strobing elements", "Diverse representation without stereotyping"], industryModifiers: { pharmacy: 1.0, "digital-services": 1.0 } },
      { dimensionId: "seo", label: "SEO & metadata", weight: 0.1, maxScore: 10, criteria: ["Descriptive filename pattern", "Alt includes service and location tokens", "Caption supports page context", "Schema usage appropriate"], industryModifiers: { pharmacy: 1.0, "digital-services": 1.0 } },
    ],
    thresholds: {
      autoApprove: 85,
      manualReview: 70,
      autoReject: 55,
      description: "normalisedScore: ≥85 fast-track to compliance-review, 70-84 manual review, <55 auto-reject",
    },
    autoRejectRules: [
      { ruleId: "readable-text", check: "hasReadableText", message: "Readable text or labels detected in image" },
      { ruleId: "brand-logo", check: "hasBrandLogo", message: "Visible brand logo detected" },
      { ruleId: "nhs-logo", check: "hasNhsLogo", message: "NHS logo detected (pharmacy compliance violation)" },
      { ruleId: "patient-data", check: "hasPatientData", message: "Identifiable patient data detected" },
      { ruleId: "before-after", check: "hasBeforeAfter", message: "Before/after transformation imagery detected" },
      { ruleId: "wrong-aspect", check: "hasWrongAspectRatio", message: "Aspect ratio does not match slot requirement" },
    ],
    scoringNotes: [
      "Auto-checks (autoChecks map) trigger immediate reject regardless of dimension scores",
      "Pharmacy compliance dimension weighted higher via industryModifier",
      "Manual dimension scores entered during review; automated checks populate autoChecks",
    ],
  };
}

function buildManifest(inputs) {
  const pharmacyImageLib = inputs.pharmacyImageLibrary;
  const templateArch = inputs.pharmacyTemplateArchitecture;
  const engine = inputs.engine ?? null;

  return {
    schemaVersion: "1.0",
    phase: "universal-image-intelligence",
    generatedAt: new Date().toISOString(),
    intelligenceOnly: true,
    noImagesGenerated: true,
    noIdeogramCalls: true,
    standardSlots: SLOTS,
    universalSlotMapping: buildUniversalSlotMapping(pharmacyImageLib),
    promptComponentLibrary: buildPromptComponentLibrary(),
    imagePackAssignmentEngine: buildImagePackAssignmentEngine(pharmacyImageLib, templateArch),
    businessOnboardingWorkflow: buildBusinessOnboardingWorkflow(),
    imageApprovalWorkflow: buildImageApprovalWorkflow(),
    imageQualityScoringFramework: buildImageQualityScoringFramework(),
    industryAdapters: engine?.industryAdapters ?? {
      pharmacy: { adapterKey: "pharmacy", industryType: "pharmacy", assetRoot: "assets/pharmacy-image-library" },
      "digital-services": { adapterKey: "digital-services", industryType: "digital-services", assetRoot: "assets/image-library" },
    },
    runtimeModules: {
      loader: "src/image-intelligence/loadImageIntelligence.ts",
      promptComponents: "src/image-intelligence/promptComponentLibrary.ts",
      packAssignment: "src/image-intelligence/imagePackAssignmentEngine.ts",
      approval: "src/image-intelligence/imageApprovalWorkflow.ts",
      qualityScoring: "src/image-intelligence/imageQualityScoring.ts",
      universalResolver: "src/image-intelligence/universalImageIntelligenceEngine.ts",
    },
    references: {
      universalEngine: "output/universal-image-intelligence/universal-image-intelligence-engine.json",
      pharmacyImageLibrary: "output/pharmacy-blueprint/pharmacy-image-library.json",
      pharmacyAiPromptLibrary: "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
      digitalManifest: "assets/image-library/image-library.json",
    },
    generatorScript: "scripts/build-image-intelligence.mjs",
  };
}

function validate(manifest) {
  const issues = [];
  const components = Object.keys(manifest.promptComponentLibrary.components ?? {});
  if (components.length < 15) issues.push(`Expected ≥15 prompt components, got ${components.length}`);

  for (const slot of SLOTS) {
    if (!manifest.universalSlotMapping.slots[slot]) issues.push(`Missing universal slot: ${slot}`);
  }

  const presets = Object.keys(manifest.promptComponentLibrary.industryPresets ?? {});
  if (presets.length < 4) issues.push(`Expected industry presets, got ${presets.length}`);

  const rules = manifest.imagePackAssignmentEngine.rules ?? [];
  if (rules.length < 5) issues.push(`Expected ≥5 pack assignment rules, got ${rules.length}`);

  if ((manifest.businessOnboardingWorkflow.stages?.length ?? 0) < 10) issues.push("Business onboarding workflow incomplete");
  if ((manifest.imageApprovalWorkflow.stages?.length ?? 0) < 6) issues.push("Approval workflow incomplete");
  if ((manifest.imageQualityScoringFramework.dimensions?.length ?? 0) < 5) issues.push("Quality scoring dimensions incomplete");

  for (const dim of manifest.imageQualityScoringFramework.dimensions ?? []) {
    if (!dim.weight || !dim.maxScore) issues.push(`Dimension ${dim.dimensionId} missing weight/maxScore`);
  }

  return { issues, componentCount: components.length, presetCount: presets.length, ruleCount: rules.length };
}

function main() {
  for (const [name, p] of Object.entries(INPUTS)) {
    if (name === "engine" && !existsSync(p)) continue;
    if (!existsSync(p)) {
      console.error(`Missing input: ${name} (${p})`);
      process.exit(1);
    }
  }

  const inputs = {
    pharmacyImageLibrary: loadJson(INPUTS.pharmacyImageLibrary),
    pharmacyAiPromptLibrary: loadJson(INPUTS.pharmacyAiPromptLibrary),
    pharmacyTemplateArchitecture: loadJson(INPUTS.pharmacyTemplateArchitecture),
    pharmacyServiceIntelligence: loadJson(INPUTS.pharmacyServiceIntelligence),
    digitalManifest: loadJson(INPUTS.digitalManifest),
    engine: existsSync(INPUTS.engine) ? loadJson(INPUTS.engine) : null,
  };

  const manifest = buildManifest(inputs);
  const validation = validate(manifest);
  const pass = validation.issues.length === 0;

  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, JSON.stringify(manifest, null, 2), "utf8");

  const report = {
    schemaVersion: "1.0",
    phase: "universal-image-intelligence",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass ? "PASS: Image Intelligence Architecture Complete" : "FAIL: Image Intelligence Requires Investigation",
    manifestPath: "output/universal-image-intelligence/image-intelligence.json",
    promptComponentLibrary: {
      totalComponents: validation.componentCount,
      categories: manifest.promptComponentLibrary.categories,
      industryPresets: validation.presetCount,
    },
    universalSlotMapping: {
      slots: SLOTS,
      industries: Object.keys(manifest.universalSlotMapping.industryOverrides),
    },
    imagePackAssignmentEngine: {
      rules: validation.ruleCount,
      templateFamilies: Object.keys(manifest.imagePackAssignmentEngine.templateFamilyMappings ?? {}).length,
      coreFallbackPack: manifest.imagePackAssignmentEngine.coreFallbackPack,
    },
    businessOnboardingWorkflow: {
      stages: manifest.businessOnboardingWorkflow.stages.length,
    },
    imageApprovalWorkflow: {
      stages: manifest.imageApprovalWorkflow.stages.length,
      roles: Object.keys(manifest.imageApprovalWorkflow.roles).length,
    },
    imageQualityScoringFramework: {
      dimensions: manifest.imageQualityScoringFramework.dimensions.length,
      thresholds: manifest.imageQualityScoringFramework.thresholds,
      autoRejectRules: manifest.imageQualityScoringFramework.autoRejectRules.length,
    },
    runtimeModules: manifest.runtimeModules,
    validation: { pass, issues: validation.issues },
  };

  writeFileSync(REPORT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Components: ${validation.componentCount}, Presets: ${validation.presetCount}, Pack rules: ${validation.ruleCount}`);
  console.log(`Manifest: ${OUT.replace(ROOT + "/", "")}`);
  if (!pass) {
    console.error("Issues:", validation.issues.join("; "));
    process.exit(1);
  }
}

main();
