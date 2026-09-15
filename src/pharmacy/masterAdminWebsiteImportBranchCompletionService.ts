/**
 * Shared side effects after Product Owner confirms a website branch —
 * batch sync, workflow advance, canonical import evidence.
 */
import { refreshOnboardingBatchStatus } from "./masterAdminOnboardingBatchService.ts";
import { advanceWebsiteImportAfterBranchResolution } from "./masterAdminOnboardingWorkflowIntegration.ts";
import type { WebsiteImportSnapshot } from "./pharmacyProfileSchema.ts";
import type { PharmacyProfileData } from "./pharmacyProfileSchema.ts";

export function applyWebsiteImportDebugAfterBranchSelection(
  data: PharmacyProfileData,
  snapshot: WebsiteImportSnapshot,
): PharmacyProfileData {
  const prior = (data.lastWebsiteImportDebug || {}) as Record<string, unknown>;
  return {
    ...data,
    lastWebsiteImportDebug: {
      ...prior,
      at: new Date().toISOString(),
      snapshotStatus: snapshot.status,
      snapshotWritten: true,
      message: snapshot.message || "Website branch confirmed — import complete.",
    },
  };
}

export function finalizeWebsiteImportAfterBranchSelection(slug: string, operator: string): void {
  refreshOnboardingBatchStatus(slug);
  advanceWebsiteImportAfterBranchResolution(slug, operator);
}
