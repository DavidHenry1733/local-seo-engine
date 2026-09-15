/**
 * PharmaConnect Image Platform V1 — canonical paths and directory layout.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";

export const IMAGE_PLATFORM_SCHEMA_VERSION = "1.0" as const;
export const IMAGE_PLATFORM_ASSET_ROOT = "assets/pharmacy-image-platform";
export const IMAGE_PLATFORM_DATA_ROOT = "data/pharmacy-image-platform";

export const IMAGE_PLATFORM_ROLES = ["hero", "support", "trust", "conversion"] as const;
export type ImagePlatformRole = (typeof IMAGE_PLATFORM_ROLES)[number];

export const IMAGE_PLATFORM_APPROVAL_STATES = ["pending", "approved", "rejected", "archived"] as const;
export type ImagePlatformApprovalStatus = (typeof IMAGE_PLATFORM_APPROVAL_STATES)[number];

export function imagePlatformAssetRootAbs(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, IMAGE_PLATFORM_ASSET_ROOT);
}

export function imagePlatformDataRootAbs(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, IMAGE_PLATFORM_DATA_ROOT);
}

export function imagePlatformSchemasRootAbs(): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "schemas/pharmacy-image-platform");
}

export function servicePlatformRootAbs(serviceId: string): string {
  return path.join(imagePlatformAssetRootAbs(), "services", serviceId);
}

export function rolePlatformRootAbs(serviceId: string, role: ImagePlatformRole): string {
  return path.join(servicePlatformRootAbs(serviceId), "roles", role);
}

export function roleBucketAbs(
  serviceId: string,
  role: ImagePlatformRole,
  bucket: ImagePlatformApprovalStatus,
): string {
  return path.join(rolePlatformRootAbs(serviceId, role), bucket);
}

export function assetMetaPathAbs(serviceId: string, role: ImagePlatformRole, assetId: string): string {
  return path.join(rolePlatformRootAbs(serviceId, role), `${assetId}.meta.json`);
}

export function libraryManifestAbs(): string {
  return path.join(imagePlatformAssetRootAbs(), "library-manifest.json");
}

export function platformRevisionAbs(): string {
  return path.join(imagePlatformAssetRootAbs(), "revision.json");
}

export function serviceCatalogAbs(serviceId: string): string {
  return path.join(servicePlatformRootAbs(serviceId), "service-catalog.json");
}

export function approvalQueueAbs(): string {
  return path.join(imagePlatformDataRootAbs(), "approvals", "queue.json");
}

export function healthReportAbs(): string {
  return path.join(imagePlatformDataRootAbs(), "reports", "library-health.json");
}

export function missingAssetsReportAbs(): string {
  return path.join(imagePlatformDataRootAbs(), "reports", "missing-assets.json");
}

export function browserValidationPlanAbs(): string {
  return path.join(imagePlatformDataRootAbs(), "reports", "browser-validation-plan.json");
}

/** Expected on-disk tree (production library). */
export const IMAGE_PLATFORM_DIRECTORY_STRUCTURE = `
assets/pharmacy-image-platform/
  library-manifest.json
  revision.json
  services/
    {serviceId}/
      service-catalog.json
      roles/
        hero/
          pending/
          approved/
          rejected/
          archived/
        support/
          pending|approved|rejected|archived/
        trust/
          pending|approved|rejected|archived/
        conversion/
          pending|approved|rejected|archived/
        {assetId}.meta.json
data/pharmacy-image-platform/
  approvals/
    queue.json
  reports/
    library-health.json
    missing-assets.json
    browser-validation-plan.json
schemas/pharmacy-image-platform/
  asset-metadata.schema.json
  assignment-contract.schema.json
  library-manifest.schema.json
src/pharmacy/imagePlatform/
  (platform services — no render coupling)
`.trim();

export function ensureImagePlatformDirectories(serviceIds: string[]): void {
  const roots = [
    imagePlatformAssetRootAbs(),
    path.join(imagePlatformAssetRootAbs(), "services"),
    imagePlatformDataRootAbs(),
    path.join(imagePlatformDataRootAbs(), "approvals"),
    path.join(imagePlatformDataRootAbs(), "reports"),
    imagePlatformSchemasRootAbs(),
  ];
  for (const r of roots) fs.mkdirSync(r, { recursive: true });

  for (const serviceId of serviceIds) {
    fs.mkdirSync(servicePlatformRootAbs(serviceId), { recursive: true });
    for (const role of IMAGE_PLATFORM_ROLES) {
      for (const bucket of IMAGE_PLATFORM_APPROVAL_STATES) {
        fs.mkdirSync(roleBucketAbs(serviceId, role, bucket), { recursive: true });
      }
    }
  }
}
