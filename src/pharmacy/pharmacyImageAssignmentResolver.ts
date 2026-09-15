/**
 * Unified pharmacy image resolution — assignment → upload → AI → library fallback.
 */
import {
  resolvePharmacyImageForSlot,
  type ImageMatrixSlot,
} from "./pharmacyImageOperatingSystem.ts";
import { isPharmacyFirstProductionLibraryReady } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import {
  resolvePharmacySlotImage,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
  type ResolvedPharmacyImage,
} from "./templates/pharmacyImageLibrary.ts";
import { resolveRecordedTenantImageForSlot } from "./pharmacyTenantAutomaticImageSelectionService.ts";

export function resolvePharmacyImageWithAssignments(
  slug: string,
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
  assignmentSlot: ImageMatrixSlot = slot as ImageMatrixSlot,
  options?: { assignmentOnly?: boolean },
): ResolvedPharmacyImage {
  const recorded = resolveRecordedTenantImageForSlot({
    tenantSlug: slug,
    serviceId: ctx.serviceKey,
    slot: assignmentSlot || slot,
    pageSlug: ctx.pageSlug,
    campaignRunId: ctx.campaignRunId,
  });
  if (recorded?.assetPath) {
    const source =
      recorded.fallback
        ? "library"
        : recorded.sourceType === "customer-upload"
          ? "upload"
          : recorded.sourceType === "approved-ai"
            ? "ai"
            : "library";
    return {
      imageKey: recorded.imageId,
      imagePack: recorded.sourceType,
      slot,
      alt: `${ctx.serviceName} at ${ctx.pharmacyName} in ${ctx.location}`,
      caption: ctx.serviceName,
      assetPath: recorded.assetPath,
      assetExists: true,
      schemaUsage: "tenant-image-library",
      libraryRef: recorded.imageId,
      displayMode: "approved",
      approvalStatus: recorded.fallback ? "service-fallback" : "approved",
      source,
    };
  }
  const assignmentOnly =
    options?.assignmentOnly ??
    (ctx.serviceKey === "pharmacy-first" && isPharmacyFirstProductionLibraryReady() && !ctx.visualDemoMode);
  const resolved = resolvePharmacyImageForSlot(slug, ctx.serviceKey, assignmentSlot, ctx, { assignmentOnly });
  return { ...resolved, slot };
}

export function resolvePharmacyPageSlotImages(
  slug: string,
  ctx: PharmacyImageRenderContext,
): Record<PharmacyImageSlot, ResolvedPharmacyImage> {
  const slots: PharmacyImageSlot[] = ["hero", "support", "trust", "conversion"];
  return Object.fromEntries(
    slots.map((s) => [s, resolvePharmacyImageWithAssignments(slug, s, ctx)]),
  ) as Record<PharmacyImageSlot, ResolvedPharmacyImage>;
}

/** Library-only resolution (no per-pharmacy assignments). */
export function resolvePharmacyLibrarySlotImage(
  slot: PharmacyImageSlot,
  ctx: PharmacyImageRenderContext,
): ResolvedPharmacyImage {
  return resolvePharmacySlotImage(slot, ctx);
}
