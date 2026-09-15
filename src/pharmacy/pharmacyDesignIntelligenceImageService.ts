/**
 * RC1-IMG1 — Content image slots resolve via library assignments (not DI website-import paths).
 */
import type { PharmacyImageRenderContext, PharmacyImageSlot, ResolvedPharmacyImage } from "./templates/pharmacyImageLibrary.ts";
import {
  requireDesignIntelligence,
  resolveDesignIntelligenceImageSlots,
  type DesignIntelligenceImageSlotRecord,
} from "./pharmacyDesignIntelligenceResolver.ts";
import { hasActivatedTenantDesignDna } from "./pharmacyTenantDnaRenderActivation.ts";
import { resolvePharmacyImageWithAssignments } from "./pharmacyImageAssignmentResolver.ts";

export function shouldUseDesignIntelligenceImages(slug: string): boolean {
  return hasActivatedTenantDesignDna(slug);
}

export function loadDesignIntelligenceImageSlotRecords(slug: string): DesignIntelligenceImageSlotRecord[] {
  const manifest = requireDesignIntelligence(slug);
  return resolveDesignIntelligenceImageSlots(slug, manifest);
}

export function resolveDesignIntelligenceSlotImage(
  slug: string,
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
): ResolvedPharmacyImage {
  return resolvePharmacyImageWithAssignments(slug, slot, ctx);
}
