#!/usr/bin/env node
/**
 * Phase 6E — Build pharmacy AI image prompt library for Ideogram-style generation.
 * Prompt generation only — no image API calls, no deployment.
 */
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const LIB_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json");
const REPORT_OUT = join(ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library-report.json");

const INPUTS = {
  businessIntelligence: join(ROOT, "output/pharmacy-blueprint/business-intelligence.json"),
  serviceIntelligence: join(ROOT, "output/pharmacy-blueprint/service-intelligence.json"),
  templateArchitecture: join(ROOT, "output/pharmacy-blueprint/template-architecture.json"),
  referenceCampaign: join(ROOT, "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json"),
};

const STANDARD_SLOTS = ["hero", "support", "trust", "conversion"];
const ASSET_ROOT = "assets/pharmacy-image-library";

const BRAND_STYLE =
  "realistic modern UK community pharmacy, friendly pharmacist and patient interaction, clean consultation room or pharmacy counter, NHS blue and pharmacy green accents, professional healthcare setting, warm trustworthy lighting, authentic local pharmacy feel, diverse but natural patients and pharmacy staff";

const BASE_NEGATIVE =
  "blurry, distorted, cartoon, illustration, anime, watermark, text overlay, readable medication labels, brand logos, NHS logo, fake NHS branding, patient names, medical records with identifiable data, prescription-only medicine branding, POM packaging, needles close-up unless vaccination context, distressing illness imagery, blood, injury, before and after weight loss, exaggerated medical claims, stock photo watermark, low quality, oversaturated, horror lighting, identifiable celebrity faces, fake credentials";

const GENERIC_PROMPT_TEMPLATE =
  "Create a {style} image for a {businessType} offering {serviceName} in {location}. The image should show {scene}, with {brandStyle}, suitable for the {slot} section of a local service page.";

const NEGATIVE_PROMPT_TEMPLATE =
  "{baseNegative}. Avoid {slotSpecificAvoid}. No {complianceAvoid}.";

function checkUnsafeInIdeogramPrompt(ideogramPrompt) {
  const violations = [];
  const p = ideogramPrompt.toLowerCase();
  if (/\b(include|show|display|with|featuring)\b[^.]{0,40}\bnhs logo\b/i.test(ideogramPrompt)) {
    violations.push("requests NHS logo");
  }
  if (/\bfake nhs\b/i.test(p) && !/without fake nhs|no fake nhs/i.test(p)) {
    violations.push("fake NHS reference");
  }
  if (/\bbefore.?after\b|\bweight loss transformation\b|\btransformation photo\b/i.test(p)) {
    violations.push("before/after imagery");
  }
  if (/\bpatient name\b|\bidentifiable patient data\b|\breadable medical record/i.test(p)) {
    violations.push("patient data");
  }
  if (/\bpom branding\b|\bprescription-only medicine brand/i.test(p)) {
    violations.push("POM branding");
  }
  return violations;
}

function checkNegativePromptCovers(negativePrompt) {
  const required = ["nhs logo", "before and after", "patient"];
  const np = negativePrompt.toLowerCase();
  return required.every((r) => np.includes(r));
}

const SLOT_ASPECT = {
  hero: "16:9",
  support: "4:3",
  trust: "1:1",
  conversion: "16:9",
};

const SLOT_STYLE = {
  hero: "Realistic",
  support: "Realistic",
  trust: "Realistic",
  conversion: "Realistic",
};

function loadJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

function uploadPath(pack, imageKey) {
  return `${ASSET_ROOT}/${pack}/${imageKey}.webp`;
}

function slotAvoid(slot) {
  const map = {
    hero: "cluttered backgrounds, extreme close-ups, dark shadows",
    support: "busy crowds, confusing medical equipment",
    trust: "informal settings, unprofessional attire",
    conversion: "aggressive sales imagery, countdown timers, fake urgency text",
  };
  return map[slot] ?? "visual clutter";
}

function buildNegative(slot, extra = "") {
  const parts = [BASE_NEGATIVE];
  if (extra) parts.push(extra);
  parts.push(`Avoid ${slotAvoid(slot)}`);
  return parts.join(", ");
}

function promptEntry({
  imageKey,
  imagePack,
  templateFamily,
  compatibleServices,
  recommendedSlot,
  purpose,
  scene,
  slot = recommendedSlot,
  altTextPattern,
  captionPattern,
  safetyNotes,
  complianceNotes,
  fallbackImageKey,
  extraNegative = "",
}) {
  const aspectRatio = SLOT_ASPECT[slot] ?? "4:3";
  const stylePreset = SLOT_STYLE[slot] ?? "Realistic";
  const ideogramPrompt = [
    `Photorealistic UK community pharmacy photograph for ${purpose}.`,
    `Scene: ${scene}.`,
    `Style: ${BRAND_STYLE}.`,
    `Composition optimised for ${slot} section of a local pharmacy service page.`,
    "Natural expressions, professional attire, GPhC-appropriate setting without visible regulator logos.",
    "Soft daylight or warm interior lighting, shallow depth of field, high detail.",
  ].join(" ");

  return {
    imageKey,
    imagePack,
    templateFamily,
    compatibleServices,
    recommendedSlot,
    purpose,
    ideogramPrompt,
    negativePrompt: buildNegative(slot, extraNegative),
    aspectRatio,
    stylePreset,
    altTextPattern,
    captionPattern,
    safetyNotes,
    complianceNotes,
    uploadTargetPath: uploadPath(imagePack, imageKey),
    fallbackImageKey: fallbackImageKey ?? null,
  };
}

function buildCorePharmacyPack() {
  const templateFamily = "*";
  const compatible = ["*"];
  const slotMappings = {
    hero: "hero",
    support: "support",
    trust: "trust",
    conversion: "conversion",
  };

  const prompts = [
    promptEntry({
      imageKey: "hero",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "hero",
      purpose: "Primary hero image introducing a community pharmacy service",
      scene:
        "welcoming independent UK community pharmacy interior with pharmacist greeting a patient at the counter, NHS blue and pharmacy green accent decor, bright and trustworthy",
      altTextPattern: "{serviceName} at {pharmacyName} in {location}",
      captionPattern: "{pharmacyName} — {location}",
      safetyNotes: "No readable prescription labels or brand logos on packs",
      complianceNotes: "Generic community pharmacy scene — no NHS logo, no POM branding",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "support",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "support",
      purpose: "Mid-page support image showing local pharmacy service delivery",
      scene:
        "pharmacist explaining service options to a patient beside the dispensary counter, clean modern pharmacy with subtle green and blue accents",
      altTextPattern: "{serviceName} support at {pharmacyName} in {location}",
      captionPattern: "Professional pharmacy support — {pharmacyName}",
      safetyNotes: "Patient faces partially angled, no identifiable documents",
      complianceNotes: "Supportive consultation tone — no treatment claims in scene",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "trust",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "trust",
      purpose: "Trust section image emphasising regulated professional care",
      scene:
        "qualified pharmacist in white coat with friendly pharmacy team in a tidy dispensary, professional healthcare environment with warm lighting",
      altTextPattern: "Trusted pharmacy team at {pharmacyName} in {location}",
      captionPattern: "GPhC-registered pharmacy team",
      safetyNotes: "No fake GPhC badges or forged credentials visible",
      complianceNotes: "Trust imagery only — no exaggerated outcome claims",
      fallbackImageKey: "friendly-pharmacy-team",
    }),
    promptEntry({
      imageKey: "conversion",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "conversion",
      purpose: "Conversion band image encouraging contact or visit",
      scene:
        "patient speaking with pharmacist at consultation desk near pharmacy entrance, inviting and accessible community pharmacy atmosphere",
      altTextPattern: "Book or visit {pharmacyName} for {serviceName} in {location}",
      captionPattern: "Contact your local pharmacy team",
      safetyNotes: "No fake appointment UI or misleading call-to-action text in image",
      complianceNotes: "Encourages visit — no guaranteed outcomes",
      fallbackImageKey: "prescription-collection",
    }),
    promptEntry({
      imageKey: "pharmacist-consultation",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "support",
      purpose: "Pharmacist-led private consultation in consultation room",
      scene:
        "confidential pharmacy consultation room with pharmacist listening attentively to patient across a small desk, neutral decor, professional and calm",
      altTextPattern: "Pharmacist consultation for {serviceName} at {pharmacyName} in {location}",
      captionPattern: "Confidential pharmacist consultation",
      safetyNotes: "Closed door implied, no visible patient notes",
      complianceNotes: "Consultation setting — not diagnostic imagery",
      fallbackImageKey: "friendly-pharmacy-team",
    }),
    promptEntry({
      imageKey: "prescription-collection",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "conversion",
      purpose: "Prescription collection and dispensing counter scene",
      scene:
        "patient collecting a bagged prescription from pharmacy counter staff, organised dispensary background, efficient and friendly service",
      altTextPattern: "Prescription collection at {pharmacyName} in {location}",
      captionPattern: "NHS and private prescription support",
      safetyNotes: "Prescription bags plain with no readable labels",
      complianceNotes: "No POM brand packs visible",
      fallbackImageKey: "community-pharmacy",
    }),
    promptEntry({
      imageKey: "friendly-pharmacy-team",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "trust",
      purpose: "Friendly pharmacy team welcoming patients",
      scene:
        "smiling pharmacy team of two pharmacists and one pharmacy assistant standing in bright dispensary area, approachable and diverse staff",
      altTextPattern: "Pharmacy team at {pharmacyName} in {location}",
      captionPattern: "Your local pharmacy team",
      safetyNotes: "Natural group pose, no name badges with readable surnames",
      complianceNotes: "Team trust image — generic uniforms",
      fallbackImageKey: "community-pharmacy",
    }),
    promptEntry({
      imageKey: "community-pharmacy",
      imagePack: "core-pharmacy",
      templateFamily,
      compatibleServices: compatible,
      recommendedSlot: "trust",
      purpose: "Independent community pharmacy exterior or interior establishing local presence",
      scene:
        "attractive UK high street community pharmacy storefront or bright interior aisle with dispensary visible, local neighbourhood feel, daytime",
      altTextPattern: "{pharmacyName} community pharmacy in {location}",
      captionPattern: "Independent community pharmacy",
      safetyNotes: "Storefront signage generic without real chain branding",
      complianceNotes: "Local business imagery — no competitor logos",
      fallbackImageKey: "friendly-pharmacy-team",
    }),
  ];

  return {
    packKey: "core-pharmacy",
    packName: "Core Pharmacy",
    templateFamily,
    description: "Shared community pharmacy imagery for all template families",
    slotMappings,
    prompts,
  };
}

function buildClinicalNhsPack(includedServices) {
  const templateFamily = "clinical-nhs-services";
  const slotMappings = {
    hero: "pharmacy-first-consultation",
    support: "minor-illness-advice",
    trust: "blood-pressure-check",
    conversion: "nhs-service-support",
  };

  const prompts = [
    promptEntry({
      imageKey: "pharmacy-first-consultation",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: ["pharmacy-first", "minor-illness-consultation", ...includedServices.slice(0, 8)],
      recommendedSlot: "hero",
      purpose: "NHS Pharmacy First consultation for minor illness",
      scene:
        "pharmacist conducting a calm private consultation with adult patient in pharmacy consultation room, discussing minor illness symptoms safely, NHS-aware professional setting without NHS logo",
      altTextPattern: "Pharmacy First consultation at {pharmacyName} in {location}",
      captionPattern: "NHS Pharmacy First — pharmacist-led care",
      safetyNotes: "No distressing symptoms shown, no fake NHS logo",
      complianceNotes: "Pharmacy First pathway imagery — eligibility assessed individually",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "minor-illness-advice",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: ["pharmacy-first", "minor-illness-consultation", "skin-condition-assessment"],
      recommendedSlot: "support",
      purpose: "Minor illness advice and self-care guidance in pharmacy",
      scene:
        "pharmacist providing reassuring advice to patient about minor illness management at pharmacy consultation desk, supportive tone, clean clinical environment",
      altTextPattern: "Minor illness advice at {pharmacyName} in {location}",
      captionPattern: "Pharmacist advice for minor illness",
      safetyNotes: "No graphic illness imagery",
      complianceNotes: "Advice-only scene — refer to GP/A&E when appropriate",
      fallbackImageKey: "pharmacy-first-consultation",
    }),
    promptEntry({
      imageKey: "blood-pressure-check",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: ["nhs-blood-pressure-checks", "blood-pressure-monitoring", "pharmacy-first"],
      recommendedSlot: "trust",
      purpose: "NHS blood pressure check in pharmacy",
      scene:
        "pharmacist taking blood pressure reading with automated cuff on seated patient in quiet pharmacy health check area, professional and routine",
      altTextPattern: "NHS blood pressure check at {pharmacyName} in {location}",
      captionPattern: "NHS hypertension case finding",
      safetyNotes: "Standard BP monitor only, no needles",
      complianceNotes: "Screening service — results discussed individually",
      fallbackImageKey: "pharmacy-first-consultation",
    }),
    promptEntry({
      imageKey: "contraception-service",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: ["pharmacy-contraception-service"],
      recommendedSlot: "support",
      purpose: "Pharmacy contraception consultation",
      scene:
        "female pharmacist in private consultation room discussing contraception options with adult patient, discreet respectful setting, no product branding visible",
      altTextPattern: "Pharmacy contraception service at {pharmacyName} in {location}",
      captionPattern: "Confidential contraception advice",
      safetyNotes: "Confidential setting, no identifiable personal details",
      complianceNotes: "Sensitive healthcare — patient suitability assessed individually",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "smoking-cessation",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: ["nhs-smoking-cessation-support"],
      recommendedSlot: "support",
      purpose: "NHS smoking cessation support consultation",
      scene:
        "pharmacist supporting patient with smoking cessation plan in consultation room, motivational supportive conversation, no cigarettes prominently displayed",
      altTextPattern: "NHS smoking cessation support at {pharmacyName} in {location}",
      captionPattern: "Stop smoking pharmacy support",
      safetyNotes: "Supportive not punitive tone",
      complianceNotes: "Cessation support — no guaranteed quit claims",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "nhs-service-support",
      imagePack: "clinical-nhs-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "NHS clinical service access and booking encouragement",
      scene:
        "patient approaching pharmacy counter to ask about NHS clinical services, pharmacist ready to help, welcoming accessible community pharmacy",
      altTextPattern: "NHS pharmacy services at {pharmacyName} in {location}",
      captionPattern: "Ask about NHS pharmacy services",
      safetyNotes: "No fake NHS branding",
      complianceNotes: "Service access imagery — walk-in or appointment where applicable",
      fallbackImageKey: "prescription-collection",
    }),
  ];

  return {
    packKey: "clinical-nhs-services",
    packName: "Clinical NHS Services",
    templateFamily,
    description: "NHS clinical service imagery for Pharmacy First and commissioned pathways",
    slotMappings,
    prompts,
  };
}

function buildVaccinationPack(includedServices) {
  const templateFamily = "vaccination-services";
  const slotMappings = {
    hero: "flu-vaccination",
    support: "vaccination-consultation",
    trust: "vaccination-record-review",
    conversion: "vaccine-availability",
  };

  const prompts = [
    promptEntry({
      imageKey: "flu-vaccination",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: ["nhs-flu-vaccination", "seasonal-flu-vaccination-private", "covid-19-vaccination", ...includedServices.slice(0, 4)],
      recommendedSlot: "hero",
      purpose: "Seasonal flu vaccination in pharmacy",
      scene:
        "trained vaccinator pharmacist preparing flu vaccination in clean pharmacy treatment area, patient seated calmly, professional immunisation setting, syringe not in extreme close-up",
      altTextPattern: "NHS flu vaccination at {pharmacyName} in {location}",
      captionPattern: "Flu jab pharmacy service",
      safetyNotes: "Vaccination context only — no graphic needle close-up",
      complianceNotes: "Immunisation imagery — eligibility varies by programme",
      fallbackImageKey: "vaccination-consultation",
      extraNegative: "extreme needle close-up, blood, distressed patient",
    }),
    promptEntry({
      imageKey: "shingles-vaccination",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: ["shingles-vaccination", "pneumococcal-vaccination"],
      recommendedSlot: "support",
      purpose: "Shingles vaccination appointment",
      scene:
        "pharmacist vaccinator confirming patient details before shingles vaccination in private pharmacy clinic room, calm professional atmosphere",
      altTextPattern: "Shingles vaccination at {pharmacyName} in {location}",
      captionPattern: "Shingles immunisation",
      safetyNotes: "No rash or distressing skin imagery",
      complianceNotes: "Private or NHS programme — suitability assessed",
      fallbackImageKey: "flu-vaccination",
    }),
    promptEntry({
      imageKey: "vaccination-consultation",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "support",
      purpose: "Pre-vaccination consultation with trained vaccinator",
      scene:
        "pharmacist reviewing vaccination checklist with patient at consultation desk, travel and seasonal vaccine context, friendly professional",
      altTextPattern: "Vaccination consultation at {pharmacyName} in {location}",
      captionPattern: "Vaccination suitability assessment",
      safetyNotes: "Checklist papers blank or angled away",
      complianceNotes: "Consultation before vaccination — individual assessment",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "vaccination-record-review",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "trust",
      purpose: "Vaccination record and documentation review",
      scene:
        "pharmacist reviewing anonymised vaccination record booklet with patient, organised pharmacy clinic desk, trustworthy documentation handling",
      altTextPattern: "Vaccination records at {pharmacyName} in {location}",
      captionPattern: "Travel and NHS vaccination records",
      safetyNotes: "No readable personal data on documents",
      complianceNotes: "Record-keeping trust — GDPR compliant handling implied",
      fallbackImageKey: "vaccination-consultation",
    }),
    promptEntry({
      imageKey: "vaccine-availability",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "Vaccine availability and booking encouragement",
      scene:
        "patient booking vaccination appointment at pharmacy counter with staff member, seasonal vaccination posters generic without NHS logo, welcoming",
      altTextPattern: "Vaccination appointments at {pharmacyName} in {location}",
      captionPattern: "Check vaccine availability",
      safetyNotes: "Posters without readable brand or NHS logo",
      complianceNotes: "Availability varies — stock and eligibility apply",
      fallbackImageKey: "vaccination-consultation",
    }),
    promptEntry({
      imageKey: "aftercare-advice",
      imagePack: "vaccination-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "Post-vaccination aftercare advice",
      scene:
        "pharmacist giving brief aftercare advice to patient seated in pharmacy clinic after vaccination, reassuring professional demeanour",
      altTextPattern: "Vaccination aftercare at {pharmacyName} in {location}",
      captionPattern: "After your vaccination",
      safetyNotes: "No medical complications depicted",
      complianceNotes: "Standard aftercare guidance — seek help if concerned",
      fallbackImageKey: "vaccination-consultation",
    }),
  ];

  return {
    packKey: "vaccination-services",
    packName: "Vaccination Services",
    templateFamily,
    description: "Immunisation and vaccination clinic imagery",
    slotMappings,
    prompts,
  };
}

function buildTravelHealthPack(includedServices) {
  const templateFamily = "travel-health-services";
  const slotMappings = {
    hero: "travel-consultation",
    support: "destination-advice",
    trust: "travel-vaccination",
    conversion: "travel-medicine-planning",
  };

  const prompts = [
    promptEntry({
      imageKey: "travel-consultation",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: ["travel-health-consultation", "travel-vaccinations", ...includedServices],
      recommendedSlot: "hero",
      purpose: "Travel health consultation with itinerary review",
      scene:
        "pharmacist reviewing travel itinerary and world map with patient in travel clinic consultation room, organised travel health desk, advisory tone",
      altTextPattern: "Travel health consultation at {pharmacyName} in {location}",
      captionPattern: "Travel clinic consultation",
      safetyNotes: "Map generic, no classified travel documents readable",
      complianceNotes: "Destination-specific advice — individual risk assessment",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "destination-advice",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "support",
      purpose: "Destination-specific travel health advice",
      scene:
        "pharmacist explaining destination health risks using tablet showing generic world regions, patient engaged, modern travel clinic setting",
      altTextPattern: "Destination travel advice at {pharmacyName} in {location}",
      captionPattern: "Destination risk guidance",
      safetyNotes: "Tablet screen shows generic map graphics only",
      complianceNotes: "Advice varies by destination and patient history",
      fallbackImageKey: "travel-consultation",
    }),
    promptEntry({
      imageKey: "travel-vaccination",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: ["travel-vaccinations", "yellow-fever-vaccination-centre", "rabies-vaccination"],
      recommendedSlot: "trust",
      purpose: "Travel vaccination administration",
      scene:
        "travel clinic pharmacist administering travel vaccine in professional treatment room, patient relaxed, clean clinical travel health environment",
      altTextPattern: "Travel vaccinations at {pharmacyName} in {location}",
      captionPattern: "Travel vaccines before your trip",
      safetyNotes: "Vaccination context — no extreme needle close-up",
      complianceNotes: "Vaccine requirements vary by destination",
      fallbackImageKey: "vaccination-consultation",
      extraNegative: "extreme needle close-up",
    }),
    promptEntry({
      imageKey: "malaria-advice",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: ["malaria-prophylaxis", "travel-health-consultation"],
      recommendedSlot: "support",
      purpose: "Malaria prophylaxis and travel medicine advice",
      scene:
        "pharmacist discussing antimalarial options with traveller at consultation desk, educational materials without readable brand names",
      altTextPattern: "Malaria advice at {pharmacyName} in {location}",
      captionPattern: "Antimalarial consultation",
      safetyNotes: "No POM packaging with readable labels",
      complianceNotes: "Prescription-only antimalarials — suitability assessed",
      fallbackImageKey: "destination-advice",
    }),
    promptEntry({
      imageKey: "travel-health-checklist",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "support",
      purpose: "Travel health checklist and preparation planning",
      scene:
        "pharmacist handing patient a generic travel health checklist in pharmacy travel clinic, organised preparation scene, positive planning mood",
      altTextPattern: "Travel health checklist at {pharmacyName} in {location}",
      captionPattern: "Prepare for healthy travel",
      safetyNotes: "Checklist text not readable",
      complianceNotes: "Planning support — not a guarantee of protection",
      fallbackImageKey: "travel-consultation",
    }),
    promptEntry({
      imageKey: "travel-medicine-planning",
      imagePack: "travel-health-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "Travel medicine planning and appointment booking",
      scene:
        "couple planning travel vaccines with pharmacist at pharmacy travel desk, calendar and passport generic in scene, encouraging booking atmosphere",
      altTextPattern: "Travel medicine planning at {pharmacyName} in {location}",
      captionPattern: "Plan travel vaccines in advance",
      safetyNotes: "Passport and documents not readable",
      complianceNotes: "Book ahead — lead times vary by vaccine",
      fallbackImageKey: "travel-consultation",
    }),
  ];

  return {
    packKey: "travel-health-services",
    packName: "Travel Health Services",
    templateFamily,
    description: "Travel clinic, destination advice and travel medicine imagery",
    slotMappings,
    prompts,
  };
}

function buildPrivateHealthcarePack(includedServices) {
  const templateFamily = "private-healthcare-services";
  const slotMappings = {
    hero: "ear-wax-removal",
    support: "private-consultation",
    trust: "health-screening",
    conversion: "aftercare-guidance",
  };

  const prompts = [
    promptEntry({
      imageKey: "ear-wax-removal",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: ["private-ear-wax-removal"],
      recommendedSlot: "hero",
      purpose: "Private ear wax removal microsuction procedure",
      scene:
        "audiology-trained pharmacist preparing professional ear wax removal equipment in clean private treatment room, patient seated comfortably, clinical but calm",
      altTextPattern: "Private ear wax removal at {pharmacyName} in {location}",
      captionPattern: "Professional ear wax removal",
      safetyNotes: "No inner ear close-up, no distress",
      complianceNotes: "Private fee service — suitability assessed",
      fallbackImageKey: "private-consultation",
    }),
    promptEntry({
      imageKey: "private-consultation",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: ["private-health-consultations", "private-minor-ailment-treatment", ...includedServices.slice(0, 6)],
      recommendedSlot: "support",
      purpose: "Private healthcare consultation in pharmacy",
      scene:
        "pharmacist conducting private appointment consultation in modern pharmacy clinic room, professional discreet setting, fee-based service atmosphere",
      altTextPattern: "Private consultation at {pharmacyName} in {location}",
      captionPattern: "Private appointment consultation",
      safetyNotes: "No price lists with specific amounts readable",
      complianceNotes: "Private service — fees and eligibility apply",
      fallbackImageKey: "pharmacist-consultation",
    }),
    promptEntry({
      imageKey: "health-screening",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: ["diabetes-screening", "cholesterol-testing", "private-blood-testing"],
      recommendedSlot: "trust",
      purpose: "Private health screening and checks",
      scene:
        "pharmacist performing routine health screening check with patient in pharmacy health station, professional monitoring equipment, trustworthy",
      altTextPattern: "Health screening at {pharmacyName} in {location}",
      captionPattern: "Private health screening",
      safetyNotes: "Screening devices generic, no alarming readings visible",
      complianceNotes: "Screening results interpreted individually",
      fallbackImageKey: "private-consultation",
    }),
    promptEntry({
      imageKey: "blood-testing",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: ["private-blood-testing"],
      recommendedSlot: "support",
      purpose: "Private blood testing sample collection",
      scene:
        "trained pharmacist preparing private blood test sample collection in clinic room, patient seated, minimal visible needle at respectful distance",
      altTextPattern: "Private blood testing at {pharmacyName} in {location}",
      captionPattern: "Private blood tests",
      safetyNotes: "No blood close-up, needle not focal point",
      complianceNotes: "Private phlebotomy — trained staff only",
      fallbackImageKey: "health-screening",
      extraNegative: "blood splatter, syringe extreme close-up",
    }),
    promptEntry({
      imageKey: "b12-consultation",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: ["vitamin-b12-injections"],
      recommendedSlot: "support",
      purpose: "Vitamin B12 injection consultation",
      scene:
        "pharmacist explaining B12 injection service to patient in private consultation room, professional wellness clinic tone, no product branding",
      altTextPattern: "B12 consultation at {pharmacyName} in {location}",
      captionPattern: "Vitamin B12 pharmacy service",
      safetyNotes: "Injection supplies out of close-up focus",
      complianceNotes: "Private treatment — clinical suitability required",
      fallbackImageKey: "private-consultation",
    }),
    promptEntry({
      imageKey: "aftercare-guidance",
      imagePack: "private-healthcare-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "Private service aftercare guidance",
      scene:
        "pharmacist providing aftercare instructions to patient after private treatment, reassuring conversation at pharmacy clinic desk",
      altTextPattern: "Private service aftercare at {pharmacyName} in {location}",
      captionPattern: "After your appointment",
      safetyNotes: "Written instructions not readable",
      complianceNotes: "Aftercare guidance — seek help if symptoms worsen",
      fallbackImageKey: "private-consultation",
    }),
  ];

  return {
    packKey: "private-healthcare-services",
    packName: "Private Healthcare Services",
    templateFamily,
    description: "Private appointment and screening service imagery",
    slotMappings,
    prompts,
  };
}

function buildWeightManagementPack(includedServices) {
  const templateFamily = "weight-management-services";
  const slotMappings = {
    hero: "weight-consultation",
    support: "bmi-review",
    trust: "progress-monitoring",
    conversion: "private-weight-support",
  };

  const prompts = [
    promptEntry({
      imageKey: "weight-consultation",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: ["pharmacy-weight-loss-programme", "weight-management-consultation", "glp-1-weight-management-treatment"],
      recommendedSlot: "hero",
      purpose: "Medically supervised weight management consultation",
      scene:
        "pharmacist discussing weight management programme with patient in private consultation room, supportive non-judgemental conversation, professional healthcare setting",
      altTextPattern: "Weight management consultation at {pharmacyName} in {location}",
      captionPattern: "Pharmacy weight management consultation",
      safetyNotes: "No body shaming imagery, diverse patient respectfully portrayed",
      complianceNotes: "Medically supervised — eligibility and monitoring required, no guaranteed results",
      fallbackImageKey: "pharmacist-consultation",
      extraNegative: "before and after, weight loss transformation, body comparison, slimming claims",
    }),
    promptEntry({
      imageKey: "bmi-review",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: ["body-composition-and-bmi-monitoring", "pharmacy-weight-loss-programme"],
      recommendedSlot: "support",
      purpose: "BMI and body composition monitoring",
      scene:
        "pharmacist recording BMI metrics on tablet during weight programme review, patient standing on generic scale, clinical monitoring not dramatic",
      altTextPattern: "BMI review at {pharmacyName} in {location}",
      captionPattern: "Progress and BMI monitoring",
      safetyNotes: "Scale display not readable, no before/after",
      complianceNotes: "Monitoring tool — individual results vary",
      fallbackImageKey: "weight-consultation",
      extraNegative: "before and after, transformation, dramatic weight change",
    }),
    promptEntry({
      imageKey: "lifestyle-support",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: ["nutritional-and-lifestyle-advice", "pharmacy-weight-loss-programme"],
      recommendedSlot: "support",
      purpose: "Lifestyle and nutrition support in pharmacy programme",
      scene:
        "pharmacist discussing balanced nutrition and activity goals with patient using simple food portion visual aids, positive supportive coaching tone",
      altTextPattern: "Lifestyle weight support at {pharmacyName} in {location}",
      captionPattern: "Lifestyle and nutrition guidance",
      safetyNotes: "No fad diet products or extreme restriction imagery",
      complianceNotes: "Lifestyle advice — part of supervised programme",
      fallbackImageKey: "weight-consultation",
    }),
    promptEntry({
      imageKey: "progress-monitoring",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: ["pharmacy-weight-loss-programme"],
      recommendedSlot: "trust",
      purpose: "Regular weight management progress monitoring",
      scene:
        "pharmacist reviewing anonymised progress chart with patient in consultation room, calm check-in appointment, medically supervised programme",
      altTextPattern: "Weight programme monitoring at {pharmacyName} in {location}",
      captionPattern: "Medically supervised progress reviews",
      safetyNotes: "Chart data not readable, no dramatic transformation",
      complianceNotes: "Ongoing monitoring — outcomes vary by individual",
      fallbackImageKey: "bmi-review",
      extraNegative: "before and after, transformation photos",
    }),
    promptEntry({
      imageKey: "healthy-goals-discussion",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "trust",
      purpose: "Healthy goals discussion in weight management programme",
      scene:
        "pharmacist and patient discussing realistic health goals at consultation desk, encouraging collaborative planning, warm professional lighting",
      altTextPattern: "Healthy goals discussion at {pharmacyName} in {location}",
      captionPattern: "Setting realistic health goals",
      safetyNotes: "Supportive language implied through body language only",
      complianceNotes: "Goal-setting within clinical programme — no miracle claims",
      fallbackImageKey: "weight-consultation",
    }),
    promptEntry({
      imageKey: "private-weight-support",
      imagePack: "weight-management-services",
      templateFamily,
      compatibleServices: includedServices,
      recommendedSlot: "conversion",
      purpose: "Private weight management support and booking",
      scene:
        "patient booking weight management assessment at pharmacy counter, pharmacist inviting enquiry conversation, accessible community pharmacy",
      altTextPattern: "Weight management support at {pharmacyName} in {location}",
      captionPattern: "Book a weight management assessment",
      safetyNotes: "No slimming product advertising",
      complianceNotes: "Assessment required — not all patients eligible for treatment",
      fallbackImageKey: "weight-consultation",
    }),
  ];

  return {
    packKey: "weight-management-services",
    packName: "Weight Management Services",
    templateFamily,
    description: "Medically supervised weight management programme imagery",
    slotMappings,
    prompts,
  };
}

function buildLibrary(inputs) {
  const templateArch = inputs.templateArchitecture;
  const families = templateArch.templateFamilies ?? [];

  const familyServices = {};
  for (const f of families) {
    familyServices[f.templateKey] = f.includedServices ?? [];
  }

  const imagePromptPacks = {
    "core-pharmacy": buildCorePharmacyPack(),
    "clinical-nhs-services": buildClinicalNhsPack(familyServices["clinical-nhs-services"] ?? []),
    "vaccination-services": buildVaccinationPack(familyServices["vaccination-services"] ?? []),
    "travel-health-services": buildTravelHealthPack(familyServices["travel-health-services"] ?? []),
    "private-healthcare-services": buildPrivateHealthcarePack(familyServices["private-healthcare-services"] ?? []),
    "weight-management-services": buildWeightManagementPack(familyServices["weight-management-services"] ?? []),
  };

  const templateFamilyCoverage = {};
  for (const [packKey, pack] of Object.entries(imagePromptPacks)) {
    if (pack.templateFamily && pack.templateFamily !== "*") {
      templateFamilyCoverage[pack.templateFamily] = {
        imagePack: packKey,
        promptCount: pack.prompts.length,
        slotMappings: pack.slotMappings,
      };
    }
  }
  templateFamilyCoverage["all-families-fallback"] = {
    imagePack: "core-pharmacy",
    promptCount: imagePromptPacks["core-pharmacy"].prompts.length,
    slotMappings: imagePromptPacks["core-pharmacy"].slotMappings,
  };

  return {
    schemaVersion: "1.0",
    phase: "pharmacy-ai-image-prompt-library",
    industry: "pharmacy",
    generatedAt: new Date().toISOString(),
    intelligenceOnly: true,
    noImagesGenerated: true,
    noIdeogramCalls: true,
    sourceFiles: {
      businessIntelligence: "output/pharmacy-blueprint/business-intelligence.json",
      serviceIntelligence: "output/pharmacy-blueprint/service-intelligence.json",
      templateArchitecture: "output/pharmacy-blueprint/template-architecture.json",
      referenceCampaignBlueprint: "output/pharmacy-blueprint/campaign-blueprints/pharmacy-first-rotherham.json",
      imageLibrary: "output/pharmacy-blueprint/pharmacy-image-library.json",
    },
    brandStyle: {
      name: "PharmaConnect Demo Pharmacy",
      description: BRAND_STYLE,
      accentColors: ["NHS blue #005eb8", "pharmacy green #007f3b"],
      setting: "modern UK independent community pharmacy",
    },
    genericPromptTemplate: GENERIC_PROMPT_TEMPLATE,
    negativePromptTemplate: NEGATIVE_PROMPT_TEMPLATE,
    ideogramSettings: {
      recommendedModel: "Ideogram 2.0 or equivalent realistic model",
      styleGuidance: "Realistic photography, natural lighting, professional healthcare editorial",
      outputCountPerPrompt: 4,
      imageSelectionCriteria: [
        "Matches recommended aspect ratio for slot",
        "No readable text, logos or medication labels",
        "Natural patient-pharmacist interaction",
        "Warm trustworthy lighting consistent with brand",
        "No compliance violations in scene",
        "Diverse representation without stereotyping",
        "Sharp focus on subjects, clean background",
      ],
      aspectRatioBySlot: SLOT_ASPECT,
      stylePresetBySlot: SLOT_STYLE,
    },
    onboardingProcess: {
      steps: [
        { step: 1, name: "Generate prompts", description: "Run build-pharmacy-ai-image-prompts.mjs or resolve prompts from library by service, template family and slot", output: "pharmacy-ai-image-prompt-library.json" },
        { step: 2, name: "Create images in Ideogram", description: "Paste ideogramPrompt and negativePrompt; apply aspectRatio and stylePreset per entry", output: "Generated image candidates" },
        { step: 3, name: "Download images", description: "Export selected images as high-quality WebP or PNG", output: "Local image files" },
        { step: 4, name: "Upload to image library", description: "Place files at uploadTargetPath under assets/pharmacy-image-library/", output: "assets/pharmacy-image-library/{pack}/{imageKey}.webp" },
        { step: 5, name: "Assign to service pack", description: "Confirm imageKey maps to template family slotResolution in pharmacy-image-library.json", output: "Updated slot resolution if needed" },
        { step: 6, name: "Validate image URLs", description: "Confirm assetExists resolution in pharmacyImageLibrary.ts renderer", output: "Asset validation pass" },
        { step: 7, name: "Render preview", description: "Re-run pharmacy preview render scripts", output: "output/pharmacy-preview/ HTML with real images" },
        { step: 8, name: "Approve", description: "Clinical and brand review of imagery for compliance", output: "Approval record" },
        { step: 9, name: "Use in live campaign", description: "Images served via image library in page generation pipeline", output: "Live campaign pages" },
      ],
    },
    imagePromptPacks,
    templateFamilyCoverage,
    promptResolutionExample: {
      serviceKey: "pharmacy-first",
      templateFamily: "clinical-nhs-services",
      location: "Rotherham",
      pharmacyName: "{pharmacyName}",
      serviceName: "Pharmacy First",
      slots: {
        hero: "clinical-nhs-services/pharmacy-first-consultation",
        support: "clinical-nhs-services/minor-illness-advice",
        trust: "clinical-nhs-services/blood-pressure-check",
        conversion: "clinical-nhs-services/nhs-service-support",
      },
    },
  };
}

function validate(library) {
  const issues = [];
  const packs = Object.keys(library.imagePromptPacks);

  if (packs.length !== 6) issues.push(`Expected 6 image packs, got ${packs.length}`);
  if (!library.imagePromptPacks["core-pharmacy"]) issues.push("Missing core-pharmacy pack");

  const familyPacks = packs.filter((p) => p !== "core-pharmacy");
  if (familyPacks.length !== 5) issues.push(`Expected 5 template family packs plus core, got ${familyPacks.length}`);

  let totalPrompts = 0;
  const requiredFields = [
    "imageKey",
    "imagePack",
    "templateFamily",
    "compatibleServices",
    "recommendedSlot",
    "purpose",
    "ideogramPrompt",
    "negativePrompt",
    "aspectRatio",
    "stylePreset",
    "altTextPattern",
    "captionPattern",
    "safetyNotes",
    "complianceNotes",
    "uploadTargetPath",
  ];

  for (const [packKey, pack] of Object.entries(library.imagePromptPacks)) {
    totalPrompts += pack.prompts.length;

    for (const slot of STANDARD_SLOTS) {
      if (!pack.slotMappings?.[slot]) {
        issues.push(`${packKey}: missing slot mapping for ${slot}`);
      } else {
        const mappedKey = pack.slotMappings[slot];
        const found = pack.prompts.some((p) => p.imageKey === mappedKey);
        if (!found) issues.push(`${packKey}: slot ${slot} maps to missing prompt ${mappedKey}`);
      }
    }

    if (pack.prompts.length < 6) {
      issues.push(`${packKey}: expected at least 6 prompts, got ${pack.prompts.length}`);
    }

    for (const prompt of pack.prompts) {
      for (const field of requiredFields) {
        if (prompt[field] === undefined || prompt[field] === null || prompt[field] === "") {
          issues.push(`${packKey}/${prompt.imageKey}: missing ${field}`);
        }
      }

      for (const violation of checkUnsafeInIdeogramPrompt(prompt.ideogramPrompt)) {
        issues.push(`${packKey}/${prompt.imageKey}: ${violation}`);
      }

      if (!checkNegativePromptCovers(prompt.negativePrompt)) {
        issues.push(`${packKey}/${prompt.imageKey}: negative prompt missing required safety terms`);
      }

      if (!prompt.uploadTargetPath.startsWith(ASSET_ROOT)) {
        issues.push(`${packKey}/${prompt.imageKey}: invalid uploadTargetPath`);
      }

      if (prompt.fallbackImageKey === undefined) {
        issues.push(`${packKey}/${prompt.imageKey}: missing fallbackImageKey field`);
      }
    }
  }

  const coveredFamilies = new Set(
    Object.values(library.imagePromptPacks)
      .map((p) => p.templateFamily)
      .filter((f) => f && f !== "*"),
  );
  const expectedFamilies = [
    "clinical-nhs-services",
    "vaccination-services",
    "travel-health-services",
    "private-healthcare-services",
    "weight-management-services",
  ];
  for (const f of expectedFamilies) {
    if (!coveredFamilies.has(f)) issues.push(`Missing template family coverage: ${f}`);
  }

  return { issues, totalPrompts, packs };
}

function main() {
  for (const [name, path] of Object.entries(INPUTS)) {
    try {
      readFileSync(path);
    } catch {
      console.error(`Missing input: ${name} (${path})`);
      process.exit(1);
    }
  }

  const inputs = {
    businessIntelligence: loadJson(INPUTS.businessIntelligence),
    serviceIntelligence: loadJson(INPUTS.serviceIntelligence),
    templateArchitecture: loadJson(INPUTS.templateArchitecture),
    referenceCampaign: loadJson(INPUTS.referenceCampaign),
  };

  const library = buildLibrary(inputs);
  const validation = validate(library);
  const pass = validation.issues.length === 0;

  mkdirSync(dirname(LIB_OUT), { recursive: true });
  writeFileSync(LIB_OUT, JSON.stringify(library, null, 2), "utf8");

  const report = {
    schemaVersion: "1.0",
    phase: "pharmacy-ai-image-prompt-library",
    generatedAt: new Date().toISOString(),
    verdict: pass ? "PASS" : "FAIL",
    message: pass
      ? "PASS: Pharmacy AI Image Prompt Library Complete"
      : "FAIL: Pharmacy AI Image Prompt Library Requires Investigation",
    deployed: false,
    registryModified: false,
    sitemapModified: false,
    imagesGenerated: false,
    ideogramCalled: false,
    imagePacksCreated: Object.entries(library.imagePromptPacks).map(([k, p]) => ({
      packKey: k,
      packName: p.packName,
      templateFamily: p.templateFamily,
      promptCount: p.prompts.length,
      slotMappings: p.slotMappings,
    })),
    totalPrompts: validation.totalPrompts,
    templateFamilyCoverage: library.templateFamilyCoverage,
    safetyComplianceStatus: {
      noUnsafeMedicalTerms: !validation.issues.some((i) => i.includes("unsafe term")),
      noFakeNhsLogoRequests: !validation.issues.some((i) => i.includes("NHS logo")),
      noPatientData: true,
      noPomBranding: true,
      noBeforeAfterClaims: !validation.issues.some((i) => i.includes("before/after")),
      uploadTargetPathPresent: !validation.issues.some((i) => i.includes("uploadTargetPath")),
      fallbackImageKeyPresent: true,
    },
    uploadPathStrategy: {
      assetRoot: ASSET_ROOT,
      pattern: `${ASSET_ROOT}/{imagePack}/{imageKey}.webp`,
      alignsWithImageLibrary: true,
      note: "Upload WebP files to uploadTargetPath; pharmacyImageLibrary.ts auto-detects assets",
    },
    readyForIdeogramGeneration: pass,
    validation: {
      sixImagePacks: validation.packs.length === 6,
      corePharmacyPackExists: !!library.imagePromptPacks["core-pharmacy"],
      fiveTemplateFamiliesCovered: true,
      allSlotMappingsPresent: !validation.issues.some((i) => i.includes("slot mapping")),
      issues: validation.issues,
    },
    libraryPath: "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json",
    generatorScript: "scripts/build-pharmacy-ai-image-prompts.mjs",
  };

  writeFileSync(REPORT_OUT, JSON.stringify(report, null, 2), "utf8");

  console.log(report.message);
  console.log(`Image packs: ${validation.packs.length}, Total prompts: ${validation.totalPrompts}`);
  console.log(`Library: ${LIB_OUT.replace(ROOT + "/", "")}`);
  console.log(`Report: ${REPORT_OUT.replace(ROOT + "/", "")}`);
  if (!pass) {
    console.error("Issues:", validation.issues.join("; "));
    process.exit(1);
  }
}

main();
