/**
 * Pharmacy First service manifest + library health (V1.1).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { serviceCatalogAbs } from "./pharmacyImagePlatformPaths.ts";
import { libraryManifestAbs, platformRevisionAbs } from "./pharmacyImagePlatformPaths.ts";
import type { PharmacyFirstServiceManifest } from "./pharmacyImagePlatformMetadataV11.ts";
import {
  listPharmacyFirstMetadataV11,
  PHARMACY_FIRST_ASSET_PLANS,
} from "./pharmacyImagePlatformPharmacyFirstPopulation.ts";
import { scanDuplicates } from "./pharmacyImagePlatformDuplicateService.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";

const SERVICE_ID = "pharmacy-first";

function metadataComplete(m: ReturnType<typeof listPharmacyFirstMetadataV11>[number]): boolean {
  const required = [
    m.assetId,
    m.serviceId,
    m.role,
    m.filePath,
    m.checksum,
    m.perceptualHash,
    m.defaultAltText,
    m.accessibilityDescription,
    m.licenceReference,
    m.width,
    m.height,
  ];
  return required.every((v) => v != null && String(v).length > 0);
}

export function evaluatePharmacyFirstHealth(): PharmacyFirstServiceManifest {
  const all = listPharmacyFirstMetadataV11();
  const approved = all.filter((a) => a.approvalStatus === "approved");
  const pending = all.filter((a) => a.approvalStatus === "pending");
  const rejected = all.filter((a) => a.approvalStatus === "rejected");

  const assetsByRole: Record<string, number> = {};
  const assetsByOrientation: Record<string, number> = {};
  const assetsByClassification: Record<string, number> = {};
  for (const a of approved) {
    assetsByRole[a.role] = (assetsByRole[a.role] || 0) + 1;
    assetsByOrientation[a.orientation] = (assetsByOrientation[a.orientation] || 0) + 1;
    assetsByClassification[a.classification] = (assetsByClassification[a.classification] || 0) + 1;
  }

  const guideEditorialAssets = approved.filter((a) => a.editorialUse === "guide").length;
  const blogEditorialAssets = approved.filter((a) => a.editorialUse === "blog").length;

  const roleCoverage: PharmacyFirstServiceManifest["roleCoverage"] = {
    hero: { required: 4, approved: assetsByRole.hero || 0, complete: (assetsByRole.hero || 0) >= 4 },
    support: { required: 4, approved: (assetsByRole.support || 0) - guideEditorialAssets - blogEditorialAssets, complete: false },
    trust: { required: 4, approved: assetsByRole.trust || 0, complete: (assetsByRole.trust || 0) >= 4 },
    conversion: { required: 4, approved: assetsByRole.conversion || 0, complete: (assetsByRole.conversion || 0) >= 4 },
    guideEditorial: { required: 2, approved: guideEditorialAssets, complete: guideEditorialAssets >= 2 },
    blogEditorial: { required: 2, approved: blogEditorialAssets, complete: blogEditorialAssets >= 2 },
  };
  const supportGeneral =
    approved.filter((a) => a.role === "support" && !a.editorialUse).length;
  roleCoverage.support = {
    required: 4,
    approved: supportGeneral,
    complete: supportGeneral >= 4,
  };

  const metaScores = approved.map(metadataComplete);
  const metadataCompleteness = approved.length
    ? Math.round((metaScores.filter(Boolean).length / approved.length) * 100)
    : 0;
  const licenceCompleteness = approved.length
    ? Math.round(
        (approved.filter((a) => a.licenceReference && a.licensing?.holder).length / approved.length) * 100,
      )
    : 0;
  const accessibilityCompleteness = approved.length
    ? Math.round(
        (approved.filter((a) => a.defaultAltText && a.accessibilityDescription).length / approved.length) * 100,
      )
    : 0;

  const withVariants = approved.filter((a) => a.responsiveVariants.length > 0).length;
  const totalVariants = approved.reduce((s, a) => s + a.responsiveVariants.length, 0);

  const distinctApproved = approved.filter((a) => isApprovedPlatformContentClass(a.classification)).length;

  const missingFiles = approved.filter((a) => !fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, a.filePath))).length;

  const duplicateCount = 0;

  const checks = [
    distinctApproved >= 20,
    roleCoverage.hero.complete,
    roleCoverage.support.complete,
    roleCoverage.trust.complete,
    roleCoverage.conversion.complete,
    roleCoverage.guideEditorial.complete,
    roleCoverage.blogEditorial.complete,
    metadataCompleteness === 100,
    licenceCompleteness === 100,
    accessibilityCompleteness === 100,
    missingFiles === 0,
    approved.every((a) => a.classification !== "decorative" && a.classification !== "placeholder"),
  ];

  const healthStatus: PharmacyFirstServiceManifest["healthStatus"] = checks.every(Boolean)
    ? "READY"
    : distinctApproved >= 15
      ? "WARNING"
      : "BLOCKED";

  const serviceRevision = crypto
    .createHash("sha256")
    .update(
      approved.map((a) => `${a.assetId}:${a.revision}:${a.approvalStatus}`).join("\n"),
    )
    .digest("hex")
    .slice(0, 16);

  const manifest: PharmacyFirstServiceManifest = {
    schemaVersion: "1.1",
    serviceId: "pharmacy-first",
    serviceRevision,
    generatedAt: new Date().toISOString(),
    totalAssets: all.length,
    approvedAssets: approved.length,
    pendingAssets: pending.length,
    rejectedAssets: rejected.length,
    assetsByRole,
    assetsByOrientation,
    assetsByClassification,
    guideEditorialAssets,
    blogEditorialAssets,
    roleCoverage,
    variantCoverage: { assetsWithVariants: withVariants, totalVariants },
    metadataCompleteness,
    licenceCompleteness,
    accessibilityCompleteness,
    duplicateCount,
    healthStatus,
  };

  return manifest;
}

export async function finalizePharmacyFirstManifests(): Promise<{
  serviceManifest: PharmacyFirstServiceManifest;
  globalRevisionBefore: string;
  globalRevisionAfter: string;
}> {
  const globalRevisionBefore = fs.existsSync(platformRevisionAbs())
    ? JSON.parse(fs.readFileSync(platformRevisionAbs(), "utf8")).platformRevision
    : "e3b0c44298fc1c14";

  const serviceManifest = evaluatePharmacyFirstHealth();
  const dup = await scanDuplicates(
    listPharmacyFirstMetadataV11()
      .filter((a) => a.approvalStatus === "approved")
      .map((a) => ({
        assetId: a.assetId,
        filePath: path.join(PHARMACY_WORKSPACE_ROOT, a.filePath.replace(/^\/+/, "")),
      })),
  );
  serviceManifest.duplicateCount = dup.exactDuplicates.length + dup.nearDuplicates.length;

  const catalogPath = serviceCatalogAbs(SERVICE_ID);
  const catalog = fs.existsSync(catalogPath)
    ? JSON.parse(fs.readFileSync(catalogPath, "utf8"))
    : { schemaVersion: "1.0", serviceId: SERVICE_ID };
  catalog.schemaVersion = "1.1";
  catalog.productionManifest = serviceManifest;
  fs.writeFileSync(catalogPath, JSON.stringify(catalog, null, 2));

  const approved = listPharmacyFirstMetadataV11().filter((a) => a.approvalStatus === "approved");
  const platformRevision = crypto
    .createHash("sha256")
    .update(approved.map((a) => `${a.assetId}|${a.checksum}`).join("\n"))
    .digest("hex")
    .slice(0, 16);

  const libraryManifest = {
    schemaVersion: "1.1",
    platformRevision,
    generatedAt: new Date().toISOString(),
    assetRoot: "assets/pharmacy-image-platform",
    validationResult: serviceManifest.healthStatus,
    missingRequirements:
      serviceManifest.healthStatus === "READY"
        ? []
        : PHARMACY_FIRST_ASSET_PLANS.filter(
            (p) =>
              !approved.some((a) => a.assetId === p.assetId && a.approvalStatus === "approved"),
          ).map((p) => p.assetId),
    services: {
      [SERVICE_ID]: {
        serviceId: SERVICE_ID,
        approvedAssetCount: approved.length,
        roles: Object.fromEntries(
          ["hero", "support", "trust", "conversion"].map((role) => [
            role,
            {
              approvedAssetIds: approved.filter((a) => a.role === role).map((a) => a.assetId),
            },
          ]),
        ),
      },
    },
  };

  fs.writeFileSync(libraryManifestAbs(), JSON.stringify(libraryManifest, null, 2));
  fs.writeFileSync(
    platformRevisionAbs(),
    JSON.stringify(
      {
        schemaVersion: "1.1",
        platformRevision,
        updatedAt: new Date().toISOString(),
        assetCount: listPharmacyFirstMetadataV11().length,
        approvedAssetCount: approved.length,
      },
      null,
      2,
    ),
  );

  return { serviceManifest, globalRevisionBefore, globalRevisionAfter: platformRevision };
}

export function computeImageVarietyScore(): number {
  const approved = listPharmacyFirstMetadataV11().filter((a) => a.approvalStatus === "approved");
  if (approved.length < 2) return 0;
  const uniqueSubjects = new Set(approved.map((a) => a.subject)).size;
  const uniqueHashes = new Set(approved.map((a) => a.perceptualHash)).size;
  return Math.min(100, Math.round(((uniqueSubjects + uniqueHashes) / (approved.length * 2)) * 100));
}
