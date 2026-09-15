/**
 * Library health + missing asset reports.
 */
import fs from "node:fs";
import path from "node:path";
import { IMAGE_PLATFORM_ROLES, healthReportAbs, missingAssetsReportAbs } from "./pharmacyImagePlatformPaths.ts";
import { listPlatformServiceIds, buildServiceCatalog } from "./pharmacyImagePlatformRequirements.ts";
import { generateLibraryManifest, scanAllPlatformAssets } from "./pharmacyImagePlatformManifestService.ts";
import { validateImagePlatformLibrary } from "./pharmacyImagePlatformValidationService.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";

export interface LibraryHealthReport {
  schemaVersion: "1.0";
  generatedAt: string;
  platformRevision: string;
  serviceCount: number;
  totalMetadataRecords: number;
  approvedContentAssets: number;
  pendingAssets: number;
  rejectedAssets: number;
  validationValid: boolean;
  validationIssueCount: number;
  demoLibrarySuperseded: boolean;
  notes: string[];
}

export interface MissingAssetRequirement {
  serviceId: string;
  serviceName: string;
  role: string;
  minApprovedAssets: number;
  approvedCount: number;
  missingCount: number;
  minWidth: number;
  minHeight: number;
  preferredOrientation: string;
  preferredAspectRatio?: string;
  subjectHint: string;
}

export interface MissingAssetsReport {
  schemaVersion: "1.0";
  generatedAt: string;
  platformRevision: string;
  totalMissingSlots: number;
  requirements: MissingAssetRequirement[];
}

export function buildLibraryHealthReport(): LibraryHealthReport {
  const manifest = generateLibraryManifest();
  const assets = scanAllPlatformAssets();
  const validation = validateImagePlatformLibrary();

  const report: LibraryHealthReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    platformRevision: manifest.platformRevision,
    serviceCount: listPlatformServiceIds().length,
    totalMetadataRecords: assets.length,
    approvedContentAssets: assets.filter(
      (a) => a.approval.status === "approved" && isApprovedPlatformContentClass(a.contentClass),
    ).length,
    pendingAssets: assets.filter((a) => a.approval.status === "pending").length,
    rejectedAssets: assets.filter((a) => a.approval.status === "rejected").length,
    validationValid: validation.valid,
    validationIssueCount: validation.issueCount,
    demoLibrarySuperseded: true,
    notes: [
      "Production library root: assets/pharmacy-image-platform (legacy demo: assets/pharmacy-image-library)",
      "Rendering unchanged until population completes and a future integration sprint wires assignments",
    ],
  };

  fs.mkdirSync(path.dirname(healthReportAbs()), { recursive: true });
  fs.writeFileSync(healthReportAbs(), JSON.stringify(report, null, 2));
  return report;
}

export function buildMissingAssetsReport(): MissingAssetsReport {
  const manifest = generateLibraryManifest();
  const requirements: MissingAssetRequirement[] = [];

  for (const serviceId of listPlatformServiceIds()) {
    const catalog = buildServiceCatalog(serviceId);
    for (const role of IMAGE_PLATFORM_ROLES) {
      const req = catalog.roles[role];
      const approvedCount =
        manifest.services[serviceId]?.roles[role]?.approvedAssetIds.length ?? 0;
      const missingCount = Math.max(0, req.minApprovedAssets - approvedCount);
      if (missingCount > 0) {
        requirements.push({
          serviceId,
          serviceName: catalog.serviceName,
          role,
          minApprovedAssets: req.minApprovedAssets,
          approvedCount,
          missingCount,
          minWidth: req.minWidth,
          minHeight: req.minHeight,
          preferredOrientation: req.preferredOrientation,
          preferredAspectRatio: req.preferredAspectRatio,
          subjectHint: req.subjectHint,
        });
      }
    }
  }

  const report: MissingAssetsReport = {
    schemaVersion: "1.0",
    generatedAt: new Date().toISOString(),
    platformRevision: manifest.platformRevision,
    totalMissingSlots: requirements.reduce((s, r) => s + r.missingCount, 0),
    requirements,
  };

  fs.mkdirSync(path.dirname(missingAssetsReportAbs()), { recursive: true });
  fs.writeFileSync(missingAssetsReportAbs(), JSON.stringify(report, null, 2));
  return report;
}
