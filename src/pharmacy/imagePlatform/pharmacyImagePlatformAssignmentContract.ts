/**
 * Deterministic assignment contract (platform layer — not wired to render).
 */
import type { ImagePlatformRole } from "./pharmacyImagePlatformPaths.ts";
import type { ImagePlatformAssignmentContract, ImagePlatformSelectionRule } from "./pharmacyImagePlatformTypes.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";
import { loadPlatformRevision, scanAllPlatformAssets } from "./pharmacyImagePlatformManifestService.ts";

export const DEFAULT_SELECTION_RULE: ImagePlatformSelectionRule = {
  mode: "deterministic_approved_rank",
  rankKey: "assetId.asc.version.desc",
  minContentClass: [
    "approved_photograph",
    "approved_editorial_illustration",
    "approved_tenant_generated",
    "approved_operator_selected",
  ],
};

export interface DeterministicAssignmentRequest {
  serviceId: string;
  pageType: ImagePlatformAssignmentContract["pageType"];
  pageSlug: string;
  slot: ImagePlatformRole;
  /** Stable tie-breaker when multiple assets match (e.g. page slug hash). */
  seed?: string;
}

function rankAssets(
  assets: ReturnType<typeof scanAllPlatformAssets>,
  rule: ImagePlatformSelectionRule,
): typeof assets {
  const allowed = new Set(rule.minContentClass);
  return assets
    .filter(
      (a) =>
        a.approval.status === "approved" &&
        isApprovedPlatformContentClass(a.contentClass) &&
        allowed.has(a.contentClass as (typeof rule.minContentClass)[number]),
    )
    .sort((a, b) => {
      if (b.version !== a.version) return b.version - a.version;
      return a.assetId.localeCompare(b.assetId);
    });
}

export function resolveDeterministicPlatformAssignment(
  req: DeterministicAssignmentRequest,
  rule: ImagePlatformSelectionRule = DEFAULT_SELECTION_RULE,
): ImagePlatformAssignmentContract | null {
  const pool = rankAssets(
    scanAllPlatformAssets().filter((a) => a.serviceId === req.serviceId && a.role === req.slot),
    rule,
  );
  if (!pool.length) return null;

  let index = 0;
  if (req.seed && pool.length > 1) {
    let h = 0;
    for (let i = 0; i < req.seed.length; i++) h = (h * 31 + req.seed.charCodeAt(i)) >>> 0;
    index = h % pool.length;
  }

  const chosen = pool[index];
  const platformRevision = loadPlatformRevision();

  return {
    schemaVersion: "1.0",
    platformRevision,
    serviceId: req.serviceId,
    pageType: req.pageType,
    pageSlug: req.pageSlug,
    slot: req.slot,
    selectionRule: rule,
    assetRef: {
      assetId: chosen.assetId,
      revision: chosen.revision,
      relativePath: chosen.relativePath,
    },
    assignedAt: new Date().toISOString(),
    assignmentReason: `image-platform-v1:${rule.mode}:${req.pageSlug}:${req.slot}`,
  };
}

export function buildAssignmentContractKey(contract: ImagePlatformAssignmentContract): string {
  return `${contract.pageSlug}:${contract.serviceId}:${contract.slot}`;
}
