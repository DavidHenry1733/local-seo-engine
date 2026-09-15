/**
 * Shared service-page image panel — canonical markup for all image slots.
 * Locked service page uses equivalent logic in pharmacyVisualExperienceLayoutV3.
 */
import { resolvePharmacyImageWithAssignments, resolvePharmacyLibrarySlotImage } from "./pharmacyImageAssignmentResolver.ts";
import {
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
} from "./templates/pharmacyImageLibrary.ts";
import { isAssetBlockedForVisualSlot } from "./pharmacyBusinessFieldSanitizer.ts";
import { renderResolvedImageSlotHtml } from "./pharmacyImageSlotRenderHelpers.ts";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function renderServicePageImagePanel(
  ctx: PharmacyImageRenderContext,
  slot: PharmacyImageSlot,
  panelClass: string,
): string {
  let resolved = ctx.slug
    ? resolvePharmacyImageWithAssignments(ctx.slug, slot, ctx)
    : resolvePharmacyLibrarySlotImage(slot, ctx);

  if (
    !resolved.assetExists ||
    !resolved.assetPath ||
    isAssetBlockedForVisualSlot(slot, resolved.assetPath, resolved.assetPath)
  ) {
    // Shared resolver must fill every page slot — retry without assignment-only constraints.
    if (ctx.slug) {
      const shared = resolvePharmacyImageWithAssignments(ctx.slug, slot, {
        ...ctx,
        visualDemoMode: true,
      });
      if (
        shared.assetExists &&
        shared.assetPath &&
        !isAssetBlockedForVisualSlot(slot, shared.assetPath, shared.assetPath)
      ) {
        resolved = { ...shared, slot };
      }
    }
  }

  if (!resolved.assetExists || !resolved.assetPath) {
    return `<div class="${panelClass}" data-image-slot="${esc(slot)}" data-image-missing="true" aria-hidden="true"></div>`;
  }

  return renderResolvedImageSlotHtml({ ...resolved, slot }, slot, panelClass);
}
