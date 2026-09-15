/**
 * Prompt Component Library — composes Ideogram prompts from reusable components.
 */
import { loadImageIntelligence, type PromptComponent, type UniversalImageSlot } from "./loadImageIntelligence.ts";

export interface PromptAssemblyContext {
  industryType: string;
  serviceKey: string;
  serviceName: string;
  businessName: string;
  location: string;
  slot: UniversalImageSlot;
  templateFamilyKey?: string;
  sceneKey?: string;
}

export interface ComposedPrompt {
  ideogramPrompt: string;
  negativePrompt: string;
  componentsUsed: { positive: string[]; negative: string[] };
  aspectRatio: string;
  stylePreset: string;
}

function applyTokens(text: string, ctx: PromptAssemblyContext): string {
  return text
    .replace(/\{serviceName\}/g, ctx.serviceName)
    .replace(/\{serviceKey\}/g, ctx.serviceKey)
    .replace(/\{businessName\}/g, ctx.businessName)
    .replace(/\{pharmacyName\}/g, ctx.businessName)
    .replace(/\{location\}/g, ctx.location)
    .replace(/\{slot\}/g, ctx.slot)
    .replace(/\{industryType\}/g, ctx.industryType);
}

function getComponent(key: string): PromptComponent | undefined {
  return loadImageIntelligence().promptComponentLibrary.components[key];
}

function resolvePresetKey(ctx: PromptAssemblyContext): string {
  const family = ctx.templateFamilyKey ?? ctx.industryType;
  return `${ctx.industryType}.${family}.${ctx.slot}`;
}

function resolveComponents(ctx: PromptAssemblyContext): { positive: string[]; negative: string[] } {
  const lib = loadImageIntelligence().promptComponentLibrary;
  const presetKey = resolvePresetKey(ctx);
  const preset = lib.industryPresets[presetKey];

  if (preset) {
    return { positive: [...preset.positive], negative: [...preset.negative] };
  }

  const industryPreset = lib.industryPresets[`${ctx.industryType}.default.${ctx.slot}`];
  if (industryPreset) {
    return { positive: [...industryPreset.positive], negative: [...industryPreset.negative] };
  }

  const positive = [
    ctx.industryType === "pharmacy" ? "style.realistic-photo" : "style.digital-illustration",
    `slot-intent.${ctx.slot}`,
    "composition.clean-professional",
    "lighting.warm-trustworthy",
    ctx.industryType === "pharmacy" ? "brand.pharmacy-nhs-green" : "brand.digital-blue",
    "compliance.no-logos-text",
  ];
  const negative = ["negative.base-universal", ctx.industryType === "pharmacy" ? "negative.pharmacy-clinical" : "negative.digital-services"];

  if (ctx.sceneKey) positive.splice(1, 0, ctx.sceneKey);

  return { positive, negative };
}

function assembleSide(keys: string[], ctx: PromptAssemblyContext): string {
  const parts: string[] = [];
  for (const key of keys) {
    const comp = getComponent(key);
    if (!comp) continue;
    if (comp.appliesTo.includes("*") || comp.appliesTo.includes(ctx.industryType)) {
      if (!comp.slots || comp.slots.includes(ctx.slot)) {
        parts.push(applyTokens(comp.text, ctx));
      }
    }
  }
  return parts.join(" ");
}

export function composePromptFromComponents(ctx: PromptAssemblyContext): ComposedPrompt {
  const intel = loadImageIntelligence();
  const slots = intel.universalSlotMapping as {
    slots: Record<UniversalImageSlot, { aspectRatio: string; stylePreset?: string }>;
  };
  const slotDef = slots.slots[ctx.slot];
  const componentsUsed = resolveComponents(ctx);

  return {
    ideogramPrompt: assembleSide(componentsUsed.positive, ctx).trim(),
    negativePrompt: assembleSide(componentsUsed.negative, ctx).trim(),
    componentsUsed,
    aspectRatio: slotDef?.aspectRatio ?? "16:9",
    stylePreset: slotDef?.stylePreset ?? "Realistic",
  };
}

export function listPromptComponents(category?: string): PromptComponent[] {
  const components = Object.values(loadImageIntelligence().promptComponentLibrary.components);
  return category ? components.filter((c) => c.category === category) : components;
}

export function getPromptComponent(componentKey: string): PromptComponent | undefined {
  return getComponent(componentKey);
}
