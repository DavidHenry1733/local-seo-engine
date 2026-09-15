/**
 * Universal Image Intelligence Engine — industry-agnostic image and prompt resolution.
 * Bridges digital-services (manifest library) and pharmacy (blueprint libraries).
 * Intelligence only — no Ideogram calls, no image generation.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assignImagePack } from "./imagePackAssignmentEngine.ts";
import { composePromptFromComponents } from "./promptComponentLibrary.ts";
import { loadImageIntelligence, IMAGE_INTELLIGENCE_PATH } from "./loadImageIntelligence.ts";
import {
  approvedImages,
  imageFilePath,
  normaliseServiceKey,
  serviceDisplayName,
  type LibraryImage,
} from "../generator/imageLibrary.ts";

import { loadPharmacyImageLibrary, resolvePharmacySlotImage } from "../pharmacy/templates/pharmacyImageLibrary.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export type UniversalImageSlot = "hero" | "support" | "trust" | "conversion";

export interface UniversalImageContext {
  industryType: string;
  serviceKey: string;
  serviceName?: string;
  businessName: string;
  location: string;
  slot: UniversalImageSlot;
  templateFamilyKey?: string;
  pageType?: "hub" | "cluster" | "area";
  brand?: string;
}

export interface UniversalPromptMetadata {
  ideogramPrompt: string;
  negativePrompt: string;
  aspectRatio: string;
  stylePreset: string;
  uploadTargetPath: string;
  fallbackImageKey?: string | null;
}

export interface ResolvedUniversalImageIntelligence {
  industryType: string;
  adapterKey: string;
  serviceKey: string;
  slot: UniversalImageSlot;
  imageKey: string;
  imagePack: string;
  libraryRef: string;
  alt: string;
  caption: string;
  assetPath: string;
  assetExists: boolean;
  schemaUsage?: string;
  source: "pharmacy-library" | "digital-manifest" | "metadata-only";
  prompt?: UniversalPromptMetadata;
}

export interface IndustryAdapter {
  adapterKey: string;
  industryType: string;
  displayName: string;
  assetRoot: string;
  libraryPaths: Record<string, string>;
  supportedSlots: UniversalImageSlot[];
  services?: string[];
  templateFamilies?: string[];
}

export interface UniversalImageIntelligenceEngine {
  schemaVersion: string;
  phase: string;
  standardSlots: UniversalImageSlot[];
  industryAdapters: Record<string, IndustryAdapter>;
  slotDefinitions: Record<UniversalImageSlot, { purpose: string; aspectRatio: string; schemaProperty: string }>;
  resolutionPipeline: { step: number; name: string; description: string }[];
  genericPromptTemplate: string;
  negativePromptTemplate: string;
  onboardingProcess: { steps: { step: number; name: string; description: string; output: string }[] };
  ideogramDefaults: Record<string, unknown>;
  promptPacks?: Record<string, { prompts: Record<string, UniversalPromptMetadata> }>;
}

function resolveWorkspaceRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../.."),
    path.resolve(__dirname, "../../.."),
    process.cwd(),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output/universal-image-intelligence/universal-image-intelligence-engine.json"))) {
      return root;
    }
  }
  return path.resolve(__dirname, "../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const ENGINE_PATH = path.join(WORKSPACE_ROOT, "output/universal-image-intelligence/universal-image-intelligence-engine.json");
const PHARMACY_PROMPT_PATH = path.join(WORKSPACE_ROOT, "output/pharmacy-blueprint/pharmacy-ai-image-prompt-library.json");

let cachedEngine: UniversalImageIntelligenceEngine | null = null;

export function loadUniversalImageIntelligenceEngine(): UniversalImageIntelligenceEngine {
  if (cachedEngine) return cachedEngine;
  if (!fs.existsSync(ENGINE_PATH)) {
    throw new Error(`Universal image intelligence engine not found: ${ENGINE_PATH}`);
  }
  cachedEngine = JSON.parse(fs.readFileSync(ENGINE_PATH, "utf8")) as UniversalImageIntelligenceEngine;
  return cachedEngine;
}

function applyPattern(pattern: string, ctx: UniversalImageContext): string {
  const serviceName = ctx.serviceName ?? serviceDisplayName(ctx.serviceKey);
  return pattern
    .replace(/\{serviceName\}/g, serviceName)
    .replace(/\{service\}/g, serviceName)
    .replace(/\{pharmacyName\}/g, ctx.businessName)
    .replace(/\{businessName\}/g, ctx.businessName)
    .replace(/\{location\}/g, ctx.location)
    .replace(/\{serviceKey\}/g, ctx.serviceKey)
    .replace(/\{slot\}/g, ctx.slot);
}

function assetExists(relativePath: string): boolean {
  return fs.existsSync(path.join(WORKSPACE_ROOT, relativePath));
}

function loadPharmacyPromptLibrary(): {
  imagePromptPacks: Record<string, { prompts: Array<{ imageKey: string } & UniversalPromptMetadata> }>;
} | null {
  if (!fs.existsSync(PHARMACY_PROMPT_PATH)) return null;
  return JSON.parse(fs.readFileSync(PHARMACY_PROMPT_PATH, "utf8"));
}

function findPharmacyPrompt(
  templateFamilyKey: string,
  slot: UniversalImageSlot,
  imageKey: string,
): UniversalPromptMetadata | undefined {
  const lib = loadPharmacyPromptLibrary();
  if (!lib) return undefined;

  const engine = loadUniversalImageIntelligenceEngine();
  const pharmacyAdapter = engine.industryAdapters["pharmacy"];
  const familyPackMap = (pharmacyAdapter as IndustryAdapter & { templateFamilyPackMap?: Record<string, string> })
    .templateFamilyPackMap;
  const packKey = familyPackMap?.[templateFamilyKey] ?? templateFamilyKey;

  for (const pack of Object.values(lib.imagePromptPacks)) {
    const match = pack.prompts.find((p) => p.imageKey === imageKey);
    if (match) {
      return {
        ideogramPrompt: match.ideogramPrompt,
        negativePrompt: match.negativePrompt,
        aspectRatio: match.aspectRatio,
        stylePreset: match.stylePreset,
        uploadTargetPath: match.uploadTargetPath,
        fallbackImageKey: match.fallbackImageKey,
      };
    }
  }

  const pack = lib.imagePromptPacks[packKey];
  const slotMapped = (engine.industryAdapters["pharmacy"] as IndustryAdapter & {
    pharmacySlotMappings?: Record<string, Record<UniversalImageSlot, string>>;
  }).pharmacySlotMappings?.[templateFamilyKey]?.[slot];

  const key = slotMapped ?? imageKey;
  const prompt = pack?.prompts.find((p) => p.imageKey === key);
  if (!prompt) return undefined;

  return {
    ideogramPrompt: prompt.ideogramPrompt,
    negativePrompt: prompt.negativePrompt,
    aspectRatio: prompt.aspectRatio,
    stylePreset: prompt.stylePreset,
    uploadTargetPath: prompt.uploadTargetPath,
    fallbackImageKey: prompt.fallbackImageKey,
  };
}

function resolveDigitalManifestImage(
  ctx: UniversalImageContext,
): { img: LibraryImage; assetPath: string; src: string } | null {
  const service = normaliseServiceKey(ctx.serviceKey);
  const candidates = approvedImages().filter((img) => img.service === service && img.slot === ctx.slot);
  if (!candidates.length) return null;

  const idx =
    [...ctx.serviceKey, ctx.location, ctx.slot].reduce((h, c) => h + c.charCodeAt(0), 0) % candidates.length;
  const img = candidates[idx]!;
  const fullPath = imageFilePath(img);
  const relative = path.relative(WORKSPACE_ROOT, fullPath).replace(/\\/g, "/");
  return { img, assetPath: relative, src: `/assets/image-library/${img.service}/${img.slot}/${img.filename}` };
}

function resolveDigitalPrompt(ctx: UniversalImageContext): UniversalPromptMetadata | undefined {
  const engine = loadUniversalImageIntelligenceEngine();
  const service = normaliseServiceKey(ctx.serviceKey);
  const pack = engine.promptPacks?.["digital-services"];
  const key = `${service}-${ctx.slot}`;
  const prompt = pack?.prompts?.[key] as UniversalPromptMetadata | undefined;
  if (!prompt) return undefined;

  return {
    ...prompt,
    ideogramPrompt: applyPattern(prompt.ideogramPrompt, ctx),
    uploadTargetPath: prompt.uploadTargetPath.replace("{service}", service).replace("{slot}", ctx.slot),
  };
}

function resolvePharmacy(ctx: UniversalImageContext): ResolvedUniversalImageIntelligence {
  const templateFamilyKey = ctx.templateFamilyKey ?? "clinical-nhs-services";
  const serviceName = ctx.serviceName ?? serviceDisplayName(ctx.serviceKey);

  const pharmacyImg = resolvePharmacySlotImage(ctx.slot, {
    templateFamilyKey,
    serviceKey: ctx.serviceKey,
    serviceName,
    pharmacyName: ctx.businessName,
    location: ctx.location,
  });

  const prompt = findPharmacyPrompt(templateFamilyKey, ctx.slot, pharmacyImg.imageKey);

  return {
    industryType: "pharmacy",
    adapterKey: "pharmacy",
    serviceKey: ctx.serviceKey,
    slot: ctx.slot,
    imageKey: pharmacyImg.imageKey,
    imagePack: pharmacyImg.imagePack,
    libraryRef: pharmacyImg.libraryRef,
    alt: pharmacyImg.alt,
    caption: pharmacyImg.caption,
    assetPath: pharmacyImg.assetPath,
    assetExists: pharmacyImg.assetExists,
    schemaUsage: pharmacyImg.schemaUsage,
    source: pharmacyImg.assetExists ? "pharmacy-library" : "metadata-only",
    prompt,
  };
}

function resolveDigital(ctx: UniversalImageContext): ResolvedUniversalImageIntelligence {
  const service = normaliseServiceKey(ctx.serviceKey);
  const serviceName = ctx.serviceName ?? serviceDisplayName(service);
  const manifestHit = resolveDigitalManifestImage(ctx);
  const prompt = resolveDigitalPrompt(ctx);

  const assetPath =
    manifestHit?.assetPath ??
    prompt?.uploadTargetPath ??
    `assets/image-library/${service}/${ctx.slot}/{generated}.webp`;
  const altTemplate = manifestHit?.img.altTemplate ?? "{{Service}} {{Location}} — professional local service";
  const alt = altTemplate
    .replace(/\{\{Service\}\}/g, serviceName)
    .replace(/\{\{service\}\}/g, serviceName)
    .replace(/\{\{Location\}\}/g, ctx.location)
    .replace(/\{\{Brand\}\}/g, ctx.businessName);

  return {
    industryType: "digital-services",
    adapterKey: "digital-services",
    serviceKey: service,
    slot: ctx.slot,
    imageKey: manifestHit?.img.id ?? `${service}-${ctx.slot}`,
    imagePack: "digital-services",
    libraryRef: manifestHit ? `${service}/${ctx.slot}/${manifestHit.img.filename}` : `${service}/${ctx.slot}`,
    alt,
    caption: `${serviceName} — ${ctx.location}`,
    assetPath,
    assetExists: manifestHit ? assetExists(manifestHit.assetPath) : false,
    source: manifestHit ? "digital-manifest" : "metadata-only",
    prompt,
  };
}

export function resolveAdapterKey(industryType: string): string {
  const normalised = industryType.toLowerCase().trim();
  if (normalised === "pharmacy") return "pharmacy";
  if (
    normalised === "digital-services" ||
    normalised === "digital" ||
    normalised === "web-design" ||
    normalised === "local-seo"
  ) {
    return "digital-services";
  }
  const engine = loadUniversalImageIntelligenceEngine();
  const adapter = Object.values(engine.industryAdapters).find(
    (a) => a.industryType === normalised || a.adapterKey === normalised,
  );
  return adapter?.adapterKey ?? "digital-services";
}

export function resolveUniversalImageIntelligence(
  ctx: UniversalImageContext,
): ResolvedUniversalImageIntelligence {
  loadUniversalImageIntelligenceEngine();
  const adapterKey = resolveAdapterKey(ctx.industryType);

  if (adapterKey === "pharmacy") {
    loadPharmacyImageLibrary();
    return resolvePharmacy(ctx);
  }

  return resolveDigital(ctx);
}

export function resolveUniversalPageImages(
  ctx: Omit<UniversalImageContext, "slot">,
): Record<UniversalImageSlot, ResolvedUniversalImageIntelligence> {
  const slots: UniversalImageSlot[] = ["hero", "support", "trust", "conversion"];
  return Object.fromEntries(
    slots.map((slot) => [slot, resolveUniversalImageIntelligence({ ...ctx, slot })]),
  ) as Record<UniversalImageSlot, ResolvedUniversalImageIntelligence>;
}

export function buildGenericPrompt(ctx: UniversalImageContext, scene: string): string {
  if (fs.existsSync(IMAGE_INTELLIGENCE_PATH)) {
    try {
      const composed = composePromptFromComponents({
        industryType: ctx.industryType,
        serviceKey: ctx.serviceKey,
        serviceName: ctx.serviceName ?? serviceDisplayName(ctx.serviceKey),
        businessName: ctx.businessName,
        location: ctx.location,
        slot: ctx.slot,
        templateFamilyKey: ctx.templateFamilyKey,
      });
      if (composed.ideogramPrompt) return composed.ideogramPrompt;
    } catch {
      /* fall through to template */
    }
  }

  const engine = loadUniversalImageIntelligenceEngine();
  const adapter = engine.industryAdapters[resolveAdapterKey(ctx.industryType)];
  const brandStyle =
    ctx.industryType === "pharmacy"
      ? "realistic modern UK community pharmacy with NHS blue and pharmacy green accents"
      : "clean professional digital business illustration with brand blues";

  return engine.genericPromptTemplate
    .replace("{style}", "photorealistic")
    .replace("{businessType}", adapter?.displayName ?? ctx.industryType)
    .replace("{serviceName}", ctx.serviceName ?? serviceDisplayName(ctx.serviceKey))
    .replace("{location}", ctx.location)
    .replace("{scene}", scene)
    .replace("{brandStyle}", brandStyle)
    .replace("{slot}", ctx.slot);
}

export function resolvePackAssignment(ctx: Omit<UniversalImageContext, "slot"> & { slot?: UniversalImageSlot }) {
  if (!fs.existsSync(IMAGE_INTELLIGENCE_PATH)) return null;
  try {
    loadImageIntelligence();
    return assignImagePack({
      industryType: ctx.industryType,
      serviceKey: ctx.serviceKey,
      templateFamilyKey: ctx.templateFamilyKey,
      slot: ctx.slot,
    });
  } catch {
    return null;
  }
}

export { loadImageIntelligence, composePromptFromComponents, assignImagePack };
