/**
 * RC1-IMG1 — Content vs brand image source policy.
 */
import type { ImageMatrixSlot } from "./pharmacyImageOperatingSystem.ts";
import type { SlotAssignment } from "./pharmacyImageOperatingSystem.ts";

export const CONTENT_IMAGE_SLOTS = new Set<ImageMatrixSlot>(["hero", "support", "trust", "conversion", "local"]);

export function assignmentSourceType(a: SlotAssignment): string {
  return a.sourceType || a.source;
}

export function isWebsiteImportContentAssignment(assignment: SlotAssignment): boolean {
  return assignmentSourceType(assignment) === "website-import";
}

export function isWebsiteImportExplicitlyApproved(assignment: SlotAssignment): boolean {
  return Boolean(
    (assignment as SlotAssignment & { customerOwnedApproved?: boolean; websiteImportApproved?: boolean })
      .customerOwnedApproved ||
    (assignment as SlotAssignment & { customerOwnedApproved?: boolean; websiteImportApproved?: boolean })
      .websiteImportApproved,
  );
}

export function shouldUseWebsiteImportAssignment(assignment: SlotAssignment, slot: ImageMatrixSlot): boolean {
  if (!isWebsiteImportContentAssignment(assignment)) return true;
  if (!CONTENT_IMAGE_SLOTS.has(slot)) return true;
  return isWebsiteImportExplicitlyApproved(assignment);
}
