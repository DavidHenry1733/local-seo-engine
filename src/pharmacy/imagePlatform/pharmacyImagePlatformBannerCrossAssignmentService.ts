/**
 * Image Platform V1.2 — Banner Cross Pharmacy First production assignments.
 * @deprecated Use rebuildPharmacyProductionImageAssignments — legacy wrapper retained for backwards compatibility.
 */
import type { PharmacyImageAssignmentsDoc } from "../pharmacyImageOperatingSystem.ts";
import { RC1_IMG1_PAGE_SLOT_PLANS } from "../pharmacyImageLibraryAssignmentService.ts";
import {
  computeProductionAssignmentRevision as computeGenericRevision,
  rebuildPharmacyProductionImageAssignments,
  previewPharmacyProductionImageAssignments,
} from "./pharmacyImagePlatformProductionAssignmentService.ts";

export function computeProductionAssignmentRevision(doc: PharmacyImageAssignmentsDoc, serviceId: string): string {
  return computeGenericRevision(doc, RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId));
}

export function rebuildBannerCrossProductionAssignments(
  slug: string,
  serviceId = "pharmacy-first",
  options?: { persist?: boolean },
): {
  revision: string;
  platformRevision: string;
  serviceManifestRevision: string;
  assignments: Record<string, unknown>;
  blocked: string[];
} {
  const result = rebuildPharmacyProductionImageAssignments({
    slug,
    serviceId,
    persist: options?.persist,
  });
  return {
    revision: result.revision,
    platformRevision: result.platformRevision,
    serviceManifestRevision: result.serviceManifestRevision,
    assignments: result.assignments,
    blocked: result.blocked,
  };
}

/** Preview assignments without persisting (cross-tenant determinism check). */
export function previewProductionAssignments(slug: string, serviceId = "pharmacy-first"): Record<string, string> {
  return previewPharmacyProductionImageAssignments(slug, serviceId);
}
