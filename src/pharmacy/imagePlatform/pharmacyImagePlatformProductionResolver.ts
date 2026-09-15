/**
 * Image Platform V1.2 — production library resolver (Pharmacy First).
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "../pharmacyWorkspacePaths.ts";
import { libraryManifestAbs, serviceCatalogAbs } from "./pharmacyImagePlatformPaths.ts";
import type { ImagePlatformPageType } from "./pharmacyImagePlatformMetadataV11.ts";
import type { ImagePlatformAssetMetadataV11 } from "./pharmacyImagePlatformMetadataV11.ts";
import type { ImagePlatformRole } from "./pharmacyImagePlatformPaths.ts";
import { readMetadataV11 } from "./pharmacyImagePlatformPharmacyFirstPopulation.ts";
import { PHARMACY_FIRST_ASSET_PLANS } from "./pharmacyImagePlatformPharmacyFirstPopulation.ts";
import { sha256Checksum } from "./pharmacyImagePlatformDuplicateService.ts";
import { evaluatePharmacyFirstHealth } from "./pharmacyImagePlatformPharmacyFirstHealth.ts";
import { isApprovedPlatformContentClass } from "./pharmacyImagePlatformTypes.ts";

export const IMAGE_PLATFORM_SCHEMA_VERSION = "1.1";

export function loadProductionLibraryRevision(): string {
  if (!fs.existsSync(libraryManifestAbs())) return "missing";
  const m = JSON.parse(fs.readFileSync(libraryManifestAbs(), "utf8")) as { platformRevision?: string };
  return m.platformRevision || "missing";
}

export function loadPharmacyFirstServiceManifestRevision(): string {
  if (!fs.existsSync(serviceCatalogAbs("pharmacy-first"))) return "missing";
  const c = JSON.parse(fs.readFileSync(serviceCatalogAbs("pharmacy-first"), "utf8")) as {
    productionManifest?: { serviceRevision?: string };
  };
  return c.productionManifest?.serviceRevision || "missing";
}

export function isPharmacyFirstProductionLibraryReady(): boolean {
  const health = evaluatePharmacyFirstHealth();
  return health.healthStatus === "READY" && health.approvedAssets >= 20;
}

function metadataComplete(m: ImagePlatformAssetMetadataV11): boolean {
  return Boolean(
    m.assetId &&
      m.filePath &&
      m.checksum &&
      m.perceptualHash &&
      m.defaultAltText &&
      m.accessibilityDescription &&
      m.licenceReference &&
      m.width &&
      m.height &&
      m.approvalStatus === "approved" &&
      isApprovedPlatformContentClass(m.classification),
  );
}

export function listApprovedProductionAssets(serviceId: string): ImagePlatformAssetMetadataV11[] {
  if (serviceId !== "pharmacy-first") return [];
  const out: ImagePlatformAssetMetadataV11[] = [];
  for (const plan of PHARMACY_FIRST_ASSET_PLANS) {
    const meta = readMetadataV11(serviceId, plan.role, plan.assetId);
    if (!meta || meta.approvalStatus !== "approved") continue;
    if (!metadataComplete(meta)) continue;
    const abs = path.join(PHARMACY_WORKSPACE_ROOT, meta.filePath.replace(/^\/+/, ""));
    if (!fs.existsSync(abs)) continue;
    if (sha256Checksum(abs) !== meta.checksum) continue;
    out.push(meta);
  }
  return out;
}

export interface ProductionSlotCriteria {
  serviceId: string;
  pageType: ImagePlatformPageType;
  slot: ImagePlatformRole;
  editorialUse?: "guide" | "blog" | null;
  minWidth: number;
  minHeight: number;
}

export function filterAssetsForSlot(
  assets: ImagePlatformAssetMetadataV11[],
  criteria: ProductionSlotCriteria,
  options?: { allowCrossServicePlatformFallback?: boolean },
): ImagePlatformAssetMetadataV11[] {
  return assets.filter((a) => {
    if (!options?.allowCrossServicePlatformFallback && a.serviceId !== criteria.serviceId) return false;
    if (a.role !== criteria.slot) return false;
    if (a.width < criteria.minWidth || a.height < criteria.minHeight) return false;
    if (criteria.editorialUse === "guide") return a.editorialUse === "guide";
    if (criteria.editorialUse === "blog") return a.editorialUse === "blog";
    if (criteria.slot === "support" && criteria.pageType !== "guide" && criteria.pageType !== "blog") {
      if (a.editorialUse) return false;
      return a.pageTypes.includes("homepage") || a.pageTypes.includes("service");
    }
    if (criteria.slot === "hero" && criteria.pageType === "guide") {
      return a.pageTypes.includes("guide") || a.pageTypes.includes("homepage") || a.pageTypes.includes("service");
    }
    if (criteria.slot === "hero" && criteria.pageType === "blog") {
      return a.pageTypes.includes("blog") || a.pageTypes.includes("homepage") || a.pageTypes.includes("service");
    }
    if (criteria.slot === "conversion") return true;
    if (criteria.slot === "trust") return true;
    if (criteria.slot === "hero") return a.pageTypes.includes(criteria.pageType) || a.pageTypes.includes("service");
    return true;
  });
}

/** Neutral photographic platform assets safe for non-Pharmacy-First service pages. */
export function isNeutralSharedPlatformFallbackAsset(asset: ImagePlatformAssetMetadataV11): boolean {
  if (asset.editorialUse) return false;
  if (!isApprovedPlatformContentClass(asset.classification)) return false;
  const probe = `${asset.assetId} ${asset.subject || ""} ${asset.defaultAltText || ""} ${asset.accessibilityDescription || ""}`;
  if (
    /pharmacy first|pharmacy-first|clinical pathway|impetigo|sore throat|otitis|sinusitis|shingles|\buti\b|insect bite|consultation room|confidential consultation|private consultation/i.test(
      probe,
    )
  ) {
    return false;
  }
  return true;
}

/** Registered once — genuinely neutral assets stored under the pharmacy-first catalogue. */
export const SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS = new Set([
  "pf-hero-community-environment",
  "pf-hero-pharmacist-patient",
  "pf-support-patient-centred",
  "pf-support-advice",
  "pf-support-medication-talk",
  "pf-trust-diverse-team",
  "pf-trust-welcoming",
  "pf-conversion-reception",
]);

function pickFromPool(
  pool: ImagePlatformAssetMetadataV11[],
  assignmentKey: string,
  usedAssetIds: Set<string>,
): ImagePlatformAssetMetadataV11 | null {
  if (!pool.length) return null;
  const sorted = [...pool].sort((a, b) => a.assetId.localeCompare(b.assetId));
  let h = 0;
  for (let i = 0; i < assignmentKey.length; i++) h = (h * 31 + assignmentKey.charCodeAt(i)) >>> 0;
  for (let attempt = 0; attempt < sorted.length; attempt++) {
    const idx = (h + attempt) % sorted.length;
    const pick = sorted[idx]!;
    if (!usedAssetIds.has(pick.assetId)) return pick;
  }
  return sorted[0] || null;
}

export function selectDeterministicProductionAsset(
  criteria: ProductionSlotCriteria,
  assignmentKey: string,
  usedAssetIds: Set<string>,
): ImagePlatformAssetMetadataV11 | null {
  if (!isPharmacyFirstProductionLibraryReady()) return null;

  const servicePool = filterAssetsForSlot(listApprovedProductionAssets(criteria.serviceId), criteria).filter(
    (a) => !usedAssetIds.has(a.assetId),
  );
  const servicePick = pickFromPool(
    servicePool.length
      ? servicePool
      : filterAssetsForSlot(listApprovedProductionAssets(criteria.serviceId), criteria),
    assignmentKey,
    usedAssetIds,
  );
  if (servicePick) return servicePick;

  // Approved platform fallback: reuse neutral photographic production library when the
  // requested service has no approved assets of its own (do not use pathway-specific imagery).
  if (criteria.serviceId !== "pharmacy-first") {
    const fallbackCriteria: ProductionSlotCriteria = { ...criteria, serviceId: "pharmacy-first" };
    const fallbackPool = filterAssetsForSlot(
      listApprovedProductionAssets("pharmacy-first"),
      fallbackCriteria,
      { allowCrossServicePlatformFallback: true },
    ).filter(
      (a) =>
        isNeutralSharedPlatformFallbackAsset(a) &&
        SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS.has(a.assetId) &&
        !usedAssetIds.has(a.assetId),
    );
    const fallbackPick = pickFromPool(
      fallbackPool.length
        ? fallbackPool
        : filterAssetsForSlot(listApprovedProductionAssets("pharmacy-first"), fallbackCriteria, {
            allowCrossServicePlatformFallback: true,
          }).filter(
            (a) =>
              isNeutralSharedPlatformFallbackAsset(a) &&
              SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS.has(a.assetId),
          ),
      assignmentKey,
      usedAssetIds,
    );
    if (fallbackPick) return fallbackPick;
  }

  return null;
}

export function isLegacyDemonstrationAssetPath(assetPath: string): boolean {
  const p = assetPath.replace(/^\/+/, "");
  return p.startsWith("assets/pharmacy-image-library/") && /\.svg$/i.test(p);
}
