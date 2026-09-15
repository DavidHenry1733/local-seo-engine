/**
 * Image Pack Assignment Engine — resolves preferred/secondary/fallback packs and slot keys.
 */
import { loadImageIntelligence, type UniversalImageSlot } from "./loadImageIntelligence.ts";

export interface PackAssignmentContext {
  industryType: string;
  serviceKey: string;
  templateFamilyKey?: string;
  slot?: UniversalImageSlot;
}

export interface ImagePackAssignmentResult {
  preferredImagePack: string;
  secondaryImagePack: string;
  fallbackImagePack: string;
  imageKey?: string;
  ruleId: string;
  reason: string;
}

interface AssignmentRule {
  ruleId: string;
  priority: number;
  when: {
    industryType?: string;
    templateFamilyKey?: string;
    serviceKey?: string;
  };
  assign: {
    preferredImagePack: string;
    secondaryImagePack: string;
    fallbackImagePack: string;
    slotResolution?: Partial<Record<UniversalImageSlot, string>>;
  };
  reason: string;
}

export function assignImagePack(ctx: PackAssignmentContext): ImagePackAssignmentResult {
  const engine = loadImageIntelligence().imagePackAssignmentEngine as {
    rules: AssignmentRule[];
    coreFallbackPack: string;
    industryDefaults: Record<
      string,
      { preferredImagePack: string; secondaryImagePack: string; fallbackImagePack: string }
    >;
    serviceOverrides?: Record<string, Partial<AssignmentRule["assign"]> & { imagePack?: string }>;
    templateFamilyMappings?: Record<string, AssignmentRule["assign"] & { slotResolution: Record<string, string> }>;
  };

  const serviceOverride = engine.serviceOverrides?.[ctx.serviceKey];
  if (serviceOverride) {
    const familyMapping = ctx.templateFamilyKey ? engine.templateFamilyMappings?.[ctx.templateFamilyKey] : undefined;
    return {
      preferredImagePack: serviceOverride.preferredImagePack ?? serviceOverride.imagePack ?? familyMapping?.preferredImagePack ?? "core-pharmacy",
      secondaryImagePack: serviceOverride.secondaryImagePack ?? familyMapping?.secondaryImagePack ?? "core-pharmacy",
      fallbackImagePack: serviceOverride.fallbackImagePack ?? familyMapping?.fallbackImagePack ?? engine.coreFallbackPack,
      imageKey: ctx.slot ? serviceOverride.slotResolution?.[ctx.slot] ?? familyMapping?.slotResolution?.[ctx.slot] : undefined,
      ruleId: "service-override",
      reason: `Service override for ${ctx.serviceKey}`,
    };
  }

  if (ctx.templateFamilyKey && engine.templateFamilyMappings?.[ctx.templateFamilyKey]) {
    const mapping = engine.templateFamilyMappings[ctx.templateFamilyKey];
    return {
      preferredImagePack: mapping.preferredImagePack,
      secondaryImagePack: mapping.secondaryImagePack,
      fallbackImagePack: mapping.fallbackImagePack,
      imageKey: ctx.slot ? mapping.slotResolution[ctx.slot] : undefined,
      ruleId: "template-family",
      reason: `Template family mapping: ${ctx.templateFamilyKey}`,
    };
  }

  const sortedRules = [...(engine.rules ?? [])].sort((a, b) => a.priority - b.priority);
  for (const rule of sortedRules) {
    const w = rule.when;
    if (w.industryType && w.industryType !== ctx.industryType) continue;
    if (w.templateFamilyKey && w.templateFamilyKey !== ctx.templateFamilyKey) continue;
    if (w.serviceKey && w.serviceKey !== ctx.serviceKey) continue;

    return {
      ...rule.assign,
      imageKey: ctx.slot ? rule.assign.slotResolution?.[ctx.slot] : undefined,
      ruleId: rule.ruleId,
      reason: rule.reason,
    };
  }

  const industryDefault = engine.industryDefaults[ctx.industryType] ?? engine.industryDefaults["digital-services"];
  return {
    preferredImagePack: industryDefault?.preferredImagePack ?? "digital-services",
    secondaryImagePack: industryDefault?.secondaryImagePack ?? "digital-services",
    fallbackImagePack: industryDefault?.fallbackImagePack ?? engine.coreFallbackPack,
    ruleId: "industry-default",
    reason: `Industry default for ${ctx.industryType}`,
  };
}

export function assignPageImagePacks(ctx: Omit<PackAssignmentContext, "slot">): Record<UniversalImageSlot, ImagePackAssignmentResult> {
  const slots: UniversalImageSlot[] = ["hero", "support", "trust", "conversion"];
  return Object.fromEntries(
    slots.map((slot) => [slot, assignImagePack({ ...ctx, slot })]),
  ) as Record<UniversalImageSlot, ImagePackAssignmentResult>;
}
