/**
 * TENANT-AUTOMATIC-IMAGE-LIBRARY-43B
 *
 * Shared deterministic image selection for approved core pages.
 * Locked campaigns are not regenerated; recorded run inventory wins when present.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  listLibraryImagesFiltered,
  VISUAL_PAGE_LIBRARY_ASSIGNMENTS,
} from "./pharmacyImageOperatingSystem.ts";
import { resolveLibraryAssetPath } from "./templates/pharmacyImageLibrary.ts";
import {
  getPharmacyCampaignImageSelectionPath,
  PHARMACY_WORKSPACE_ROOT,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";
import {
  loadTenantImageLibrary,
  publicTenantImageUrl,
  sourcePriorityRank,
  type TenantImageLibrary,
  type TenantImageLibraryRecord,
  type TenantImageSemanticCategory,
  type TenantImageSourceType,
} from "./pharmacyTenantImageLibraryContract.ts";
import {
  isCampaignEligiblePlacementImage,
  isPhotographicCampaignAsset,
  listEligibleCampaignStockPhotographs,
  loadCampaignImageSelectionState,
} from "./growthEngineCampaignBuilderImageStrategyService.ts";

export const TENANT_IMAGE_SELECTION_CONTRACT_ID = "pharmaconnect-tenant-automatic-image-selection-v1";

export type TenantImagePageType = "service" | "locality";
export type TenantImageSemanticRole = "hero" | "support" | "trust" | "conversion" | "local";

export interface TenantImageSelectionRequest {
  tenantSlug: string;
  serviceId: string;
  pageType: TenantImagePageType;
  localitySlug?: string | null;
  seed: string;
  library: TenantImageLibrary;
}

export interface TenantSelectedImage {
  role: TenantImageSemanticRole;
  imageId: string;
  sourceType: TenantImageSourceType | "service-library-fallback";
  assetPath: string;
  publicUrl: string;
  checksum: string;
  fallback: boolean;
}

export interface TenantPageImageSelection {
  pageType: TenantImagePageType;
  localitySlug: string | null;
  roles: TenantSelectedImage[];
}

export interface CampaignRunImageSelectionInventory {
  version: typeof TENANT_IMAGE_SELECTION_CONTRACT_ID;
  tenantSlug: string;
  serviceId: string;
  runId: string;
  seed: string;
  recordedAt: string;
  pages: TenantPageImageSelection[];
}

const SERVICE_PAGE_ROLES: TenantImageSemanticRole[] = ["hero", "support", "trust", "conversion"];
const LOCALITY_PAGE_ROLES: TenantImageSemanticRole[] = ["hero", "support", "trust", "conversion"];
const liveInventories = new Map<string, CampaignRunImageSelectionInventory>();

const FALLBACK_REFS: Record<string, Record<TenantImageSemanticRole, string>> = {
  "pharmacy-first": {
    hero: "clinical-nhs-services/pharmacy-first",
    support: "core-pharmacy/pharmacist-consultation",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
    local: "core-pharmacy/community-pharmacy",
  },
  "blood-pressure-checks": {
    hero: "clinical-nhs-services/blood-pressure-check",
    support: "core-pharmacy/pharmacist-consultation",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
    local: "core-pharmacy/community-pharmacy",
  },
  "travel-vaccinations": {
    hero: "travel-health-services/travel-vaccination",
    support: "travel-health-services/travel-consultation",
    trust: "travel-health-services/destination-advice",
    conversion: "travel-health-services/malaria-advice",
    local: "travel-health-services/travel-consultation",
  },
  "flu-vaccinations": {
    hero: "core-pharmacy/pharmacist-consultation",
    support: "core-pharmacy/community-pharmacy",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
    local: "core-pharmacy/community-pharmacy",
  },
};

function rolesForPage(pageType: TenantImagePageType): TenantImageSemanticRole[] {
  return pageType === "locality" ? LOCALITY_PAGE_ROLES : SERVICE_PAGE_ROLES;
}

export function stableSelectionIndex(seed: string, modulo: number): number {
  if (modulo <= 0) return 0;
  const digest = crypto.createHash("sha256").update(seed).digest("hex");
  return Number.parseInt(digest.slice(0, 8), 16) % modulo;
}

function roleMatches(record: TenantImageLibraryRecord, role: TenantImageSemanticRole): boolean {
  if (!record.semanticCategories.length) return true;
  if (record.semanticCategories.includes(role as TenantImageSemanticCategory)) return true;
  if (role === "local" && record.semanticCategories.some((c) => c === "support" || c === "hero" || c === "pharmacy")) {
    return true;
  }
  return record.semanticCategories.includes("pharmacy") || record.semanticCategories.includes("clinical");
}

function eligibleForService(library: TenantImageLibrary, serviceId: string, tenantSlug?: string): TenantImageLibraryRecord[] {
  const session = tenantSlug ? loadCampaignImageSelectionState(tenantSlug) : null;
  const fromLibrary = library.images.filter((img) => {
    if (!isPhotographicCampaignAsset(img)) return false;
    if (serviceId === "pharmacy-first") return isCampaignEligiblePlacementImage(img, session);
    if (img.approvalStatus !== "approved") return false;
    if (img.licenceProvenanceStatus !== "verified") return false;
    if (img.suitableServiceIds.length && !img.suitableServiceIds.includes(serviceId)) return false;
    return Boolean(img.active);
  });
  if (serviceId === "pharmacy-first" && tenantSlug) {
    const seen = new Set(fromLibrary.map((img) => img.storedAssetPath));
    for (const img of listEligibleCampaignStockPhotographs(tenantSlug)) {
      if (!isCampaignEligiblePlacementImage(img, session)) continue;
      if (seen.has(img.storedAssetPath)) continue;
      seen.add(img.storedAssetPath);
      fromLibrary.push(img);
    }
  }
  return fromLibrary.sort((a, b) => {
    const rank = sourcePriorityRank(a.sourceType) - sourcePriorityRank(b.sourceType);
    if (rank) return rank;
    return a.imageId.localeCompare(b.imageId);
  });
}

function fallbackAsset(serviceId: string, role: TenantImageSemanticRole): { assetPath: string; libraryRef: string } | null {
  const mapped = FALLBACK_REFS[serviceId]?.[role] || VISUAL_PAGE_LIBRARY_ASSIGNMENTS[serviceId]?.[role === "local" ? "support" : role];
  const libraryRef = mapped || listLibraryImagesFiltered({ serviceId, slot: role === "local" ? "support" : role }).find((img) => img.assetExists)?.libraryRef;
  if (!libraryRef) return null;
  const listed = listLibraryImagesFiltered({ serviceId, slot: role === "local" ? "support" : role }).find((img) => img.libraryRef === libraryRef);
  const assetPath = listed?.assetPath || resolveLibraryAssetPath(`assets/pharmacy-image-library/${libraryRef}.svg`);
  const rel = String(assetPath || "").replace(/^\/+/, "");
  if (!rel.startsWith("assets/")) return null;
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  if (!fs.existsSync(abs)) return null;
  if (!isPhotographicCampaignAsset({ storedAssetPath: rel, originalFilename: path.basename(rel), mimeType: "" })) {
    return null;
  }
  return { assetPath: rel, libraryRef };
}

function pickFromPool(
  pool: TenantImageLibraryRecord[],
  seed: string,
  used: Set<string>,
): TenantImageLibraryRecord | null {
  const unused = pool.filter((img) => !used.has(img.imageId));
  for (const source of ["customer-upload", "website-import", "approved-stock", "approved-ai"] as const) {
    const band = unused.filter((img) => img.sourceType === source);
    if (band.length) return band[stableSelectionIndex(seed, band.length)] || null;
  }
  return unused[stableSelectionIndex(seed, unused.length)] || null;
}

export function selectAutomaticPageImages(input: TenantImageSelectionRequest): TenantPageImageSelection {
  const tenantSlug = safePharmacySlug(input.tenantSlug);
  const localitySlug = input.pageType === "locality" ? String(input.localitySlug || "").trim() || null : null;
  const roles = rolesForPage(input.pageType);
  const pool = eligibleForService(input.library, input.serviceId, input.tenantSlug);
  const used = new Set<string>();
  const selected: TenantSelectedImage[] = [];

  for (const role of roles) {
    const seed = [tenantSlug, input.serviceId, input.pageType, localitySlug || "", role, input.seed].join("|");
    const preferred = pool.filter((img) => roleMatches(img, role));
    const candidatePool = preferred.length ? preferred : pool;
    const unused = candidatePool.filter((img) => !used.has(img.imageId));
    const chosen =
      input.pageType === "locality" && unused.length
        ? unused[
            (stableSelectionIndex(input.seed, 997) + stableSelectionIndex(String(localitySlug || ""), unused.length)) %
              unused.length
          ]
        : pickFromPool(candidatePool, seed, used);
    if (chosen) {
      used.add(chosen.imageId);
      selected.push({
        role,
        imageId: chosen.imageId,
        sourceType: chosen.sourceType,
        assetPath: chosen.storedAssetPath,
        publicUrl: publicTenantImageUrl(chosen),
        checksum: chosen.checksum,
        fallback: false,
      });
      continue;
    }
    const fallback = fallbackAsset(input.serviceId, role);
    selected.push({
      role,
      imageId: fallback ? `fallback:${fallback.libraryRef}` : `fallback:missing:${role}`,
      sourceType: "service-library-fallback",
      assetPath: fallback?.assetPath || "",
      publicUrl: fallback?.assetPath ? `/${fallback.assetPath}` : "",
      checksum: "",
      fallback: true,
    });
  }

  return { pageType: input.pageType, localitySlug, roles: selected };
}

export function selectAutomaticCampaignImages(input: {
  tenantSlug: string;
  serviceId: string;
  seed: string;
  library: TenantImageLibrary;
  localitySlugs?: string[];
}): TenantPageImageSelection[] {
  const pages = [
    selectAutomaticPageImages({
      tenantSlug: input.tenantSlug,
      serviceId: input.serviceId,
      pageType: "service",
      seed: input.seed,
      library: input.library,
    }),
  ];
  for (const localitySlug of input.localitySlugs || []) {
    pages.push(
      selectAutomaticPageImages({
        tenantSlug: input.tenantSlug,
        serviceId: input.serviceId,
        pageType: "locality",
        localitySlug,
        seed: input.seed,
        library: input.library,
      }),
    );
  }
  return pages;
}

export function buildCampaignRunImageSelectionInventory(input: {
  tenantSlug: string;
  serviceId: string;
  runId: string;
  seed?: string;
  library: TenantImageLibrary;
  localitySlugs?: string[];
}): CampaignRunImageSelectionInventory {
  const seed = input.seed || input.runId;
  return {
    version: TENANT_IMAGE_SELECTION_CONTRACT_ID,
    tenantSlug: safePharmacySlug(input.tenantSlug),
    serviceId: input.serviceId,
    runId: input.runId,
    seed,
    recordedAt: new Date().toISOString(),
    pages: selectAutomaticCampaignImages({
      tenantSlug: input.tenantSlug,
      serviceId: input.serviceId,
      seed,
      library: input.library,
      localitySlugs: input.localitySlugs,
    }),
  };
}

export function resolveRecordedCampaignImageSelections(
  recorded: CampaignRunImageSelectionInventory | null | undefined,
  fallback: () => CampaignRunImageSelectionInventory,
): CampaignRunImageSelectionInventory {
  if (recorded?.version === TENANT_IMAGE_SELECTION_CONTRACT_ID && recorded.pages?.length) {
    return recorded;
  }
  return fallback();
}

export function loadCampaignRunImageSelectionInventory(
  slug: string,
  serviceId: string,
  runId: string,
): CampaignRunImageSelectionInventory | null {
  const file = getPharmacyCampaignImageSelectionPath(slug, serviceId, runId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CampaignRunImageSelectionInventory;
    return raw?.version === TENANT_IMAGE_SELECTION_CONTRACT_ID ? raw : null;
  } catch {
    return null;
  }
}

export function saveCampaignRunImageSelectionInventory(
  inventory: CampaignRunImageSelectionInventory,
): string {
  const file = getPharmacyCampaignImageSelectionPath(inventory.tenantSlug, inventory.serviceId, inventory.runId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(inventory, null, 2), "utf8");
  return file;
}

export function resolveReviewCentreImageSelections(
  recorded: CampaignRunImageSelectionInventory | null | undefined,
  input: Parameters<typeof buildCampaignRunImageSelectionInventory>[0],
): CampaignRunImageSelectionInventory {
  return resolveRecordedCampaignImageSelections(recorded, () => buildCampaignRunImageSelectionInventory(input));
}

export function resolveStagingImageSelections(
  recorded: CampaignRunImageSelectionInventory | null | undefined,
  input: Parameters<typeof buildCampaignRunImageSelectionInventory>[0],
): CampaignRunImageSelectionInventory {
  return resolveReviewCentreImageSelections(recorded, input);
}

export function pageHasDuplicateImageIds(page: TenantPageImageSelection): boolean {
  const ids = page.roles.filter((role) => !role.fallback).map((role) => role.imageId);
  return ids.length !== new Set(ids).size;
}

function liveInventoryKey(slug: string, serviceId: string, runId = "current"): string {
  return `${safePharmacySlug(slug)}|${serviceId}|${runId}`;
}

export function isApprovedLockedCampaign(slug: string, serviceId: string): boolean {
  const key = safePharmacySlug(slug);
  const approvalFile = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/campaign-approvals",
    key,
    `${serviceId}.json`,
  );
  if (fs.existsSync(approvalFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(approvalFile, "utf8")) as { status?: string };
      if (raw.status === "approved-locked") return true;
    } catch {
      /* ignore unreadable approval records */
    }
  }
  const packageFile = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", key, `${serviceId}.json`);
  if (fs.existsSync(packageFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(packageFile, "utf8")) as {
        status?: string;
        approvalStatus?: string;
        campaignLock?: { lockedBankHash?: string };
      };
      if (raw.status === "approved-locked" || raw.approvalStatus === "approved-locked" || raw.campaignLock?.lockedBankHash) {
        return true;
      }
    } catch {
      /* ignore unreadable packages */
    }
  }
  return false;
}

export function registerLiveCampaignImageInventory(inventory: CampaignRunImageSelectionInventory): void {
  liveInventories.set(liveInventoryKey(inventory.tenantSlug, inventory.serviceId, inventory.runId), inventory);
  liveInventories.set(liveInventoryKey(inventory.tenantSlug, inventory.serviceId), inventory);
}

export function clearLiveCampaignImageInventory(slug: string, serviceId: string, runId?: string): void {
  if (runId) liveInventories.delete(liveInventoryKey(slug, serviceId, runId));
  liveInventories.delete(liveInventoryKey(slug, serviceId));
}

export function getLiveCampaignImageInventory(
  slug: string,
  serviceId: string,
  runId?: string | null,
): CampaignRunImageSelectionInventory | null {
  if (runId) {
    const exact = liveInventories.get(liveInventoryKey(slug, serviceId, runId));
    if (exact) return exact;
  }
  return liveInventories.get(liveInventoryKey(slug, serviceId)) || null;
}

export function prepareCampaignRunImageSelections(input: {
  tenantSlug: string;
  serviceId: string;
  runId: string;
  seed?: string;
  localitySlugs?: string[];
  explicitImprovement?: boolean;
}): CampaignRunImageSelectionInventory | null {
  if (isApprovedLockedCampaign(input.tenantSlug, input.serviceId) && !input.explicitImprovement) {
    return null;
  }
  const inventory = buildCampaignRunImageSelectionInventory({
    tenantSlug: input.tenantSlug,
    serviceId: input.serviceId,
    runId: input.runId,
    seed: input.seed || input.runId,
    library: loadTenantImageLibrary(input.tenantSlug),
    localitySlugs: input.localitySlugs,
  });
  saveCampaignRunImageSelectionInventory(inventory);
  registerLiveCampaignImageInventory(inventory);
  return inventory;
}

function localitySlugFromPageSlug(pageSlug: string | undefined, inventory: CampaignRunImageSelectionInventory): string | null {
  const raw = String(pageSlug || "").toLowerCase();
  if (!raw) return null;
  for (const page of inventory.pages) {
    if (page.pageType === "locality" && page.localitySlug && (raw === page.localitySlug || raw.includes(page.localitySlug))) {
      return page.localitySlug;
    }
  }
  return null;
}

export function recordedImageForSlot(
  inventory: CampaignRunImageSelectionInventory,
  slot: string,
  pageSlug?: string,
): TenantSelectedImage | null {
  const localitySlug = localitySlugFromPageSlug(pageSlug, inventory);
  const page =
    (localitySlug
      ? inventory.pages.find((item) => item.pageType === "locality" && item.localitySlug === localitySlug)
      : inventory.pages.find((item) => item.pageType === "service")) ||
    inventory.pages.find((item) => item.pageType === "service");
  if (!page) return null;
  const role = slot === "local" || slot === "supporting" ? "hero" : slot;
  return page.roles.find((item) => item.role === role) || page.roles[0] || null;
}

export function resolveRecordedTenantImageForSlot(input: {
  tenantSlug: string;
  serviceId: string;
  slot: string;
  pageSlug?: string;
  campaignRunId?: string | null;
}): TenantSelectedImage | null {
  const live = getLiveCampaignImageInventory(input.tenantSlug, input.serviceId, input.campaignRunId);
  const saved = input.campaignRunId
    ? loadCampaignRunImageSelectionInventory(input.tenantSlug, input.serviceId, input.campaignRunId)
    : null;
  const inventory = live || saved;
  if (!inventory) return null;
  if (!live && isApprovedLockedCampaign(input.tenantSlug, input.serviceId)) return null;
  return recordedImageForSlot(inventory, input.slot, input.pageSlug);
}
