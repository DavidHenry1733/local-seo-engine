/**
 * Campaign Builder Step 4 — image-source presentation and eligibility.
 * Does not generate images or rewrite global/stock records.
 */
import fs from "node:fs";
import path from "node:path";
import { classifyLibraryAssetFile } from "./pharmacyImageLibraryContentAssetClassifier.ts";
import { listApprovedProductionAssets } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import {
  createAiImageRequest,
  loadImageAssignments,
  type ImageMatrixSlot,
  type PharmacyAiImageRequest,
} from "./pharmacyImageOperatingSystem.ts";
import {
  loadTenantImageLibrary,
  publicTenantImageUrl,
  type TenantImageLibrary,
  type TenantImageLibraryRecord,
} from "./pharmacyTenantImageLibraryContract.ts";
import { PHARMACY_WORKSPACE_ROOT, safePharmacySlug } from "./pharmacyWorkspacePaths.ts";
import type { CampaignBuilderImageStrategy, CampaignBuilderSession } from "./growthEngineCampaignBuilderModel.ts";

export const CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID = "pharmacy-first";

const PHOTO_MIME = /^(image\/(jpeg|jpg|pjpeg|png|webp))$/i;
const SVG_MIME = /svg/i;
const UNRELATED_SERVICE_IDS = new Set([
  "travel-vaccinations",
  "flu-vaccinations",
  "blood-pressure-checks",
  "contraception",
  "emergency-contraception",
  "malaria",
  "weight-management",
  "earwax",
  "stop-smoking",
]);
const UNRELATED_PATH_MARKERS = [
  /travel-health/i,
  /travel-vaccin/i,
  /malaria/i,
  /contraception/i,
  /blood-pressure/i,
  /flu-vaccin/i,
  /weight-management/i,
  /earwax/i,
  /stop-smoking/i,
];

export interface CampaignStockImageCard {
  imageId: string;
  filename: string;
  previewUrl: string;
  altText: string;
  selected: boolean;
  approvalStatus: string;
  verified: boolean;
}

export interface CampaignUploadImageCard {
  imageId: string;
  filename: string;
  previewUrl: string;
  sourceLabel: string;
  reviewStatus: string;
  approved: boolean;
}

export interface CampaignImageStrategyView {
  stock: CampaignStockImageCard[];
  uploads: CampaignUploadImageCard[];
  pendingAi: PharmacyAiImageRequest[];
  requestAiImages: boolean;
  imageStrategy: CampaignBuilderImageStrategy;
}

function extOf(record: Pick<TenantImageLibraryRecord, "storedAssetPath" | "originalFilename" | "mimeType">): string {
  return path.extname(record.storedAssetPath || record.originalFilename || "").toLowerCase();
}

export function isGenericPlaceholderGraphic(
  record: Pick<TenantImageLibraryRecord, "storedAssetPath" | "originalFilename" | "mimeType">,
): boolean {
  const mime = String(record.mimeType || "");
  const ext = extOf(record);
  const stored = String(record.storedAssetPath || "");
  if (SVG_MIME.test(mime) || ext === ".svg" || /\.svg$/i.test(stored)) return true;
  if (!stored) return true;
  const classification = classifyLibraryAssetFile(record.storedAssetPath);
  if (classification === "approved_photograph") return false;
  if (classification === "unknown") {
    return !(PHOTO_MIME.test(mime) || [".jpg", ".jpeg", ".png", ".webp"].includes(ext));
  }
  return true;
}

export function isPhotographicCampaignAsset(
  record: Pick<TenantImageLibraryRecord, "storedAssetPath" | "originalFilename" | "mimeType">,
): boolean {
  if (isGenericPlaceholderGraphic(record)) return false;
  const classification = classifyLibraryAssetFile(record.storedAssetPath);
  if (classification === "unknown") {
    const mime = String(record.mimeType || "");
    const ext = extOf(record);
    return PHOTO_MIME.test(mime) || [".jpg", ".jpeg", ".png", ".webp"].includes(ext);
  }
  return classification === "approved_photograph";
}

export function isPharmacyFirstOrGeneralPharmacyImage(
  record: Pick<TenantImageLibraryRecord, "suitableServiceIds" | "storedAssetPath" | "originalFilename">,
): boolean {
  const services = (record.suitableServiceIds || []).map((id) => String(id || "").toLowerCase()).filter(Boolean);
  if (services.includes(CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID)) return true;
  if (services.some((id) => UNRELATED_SERVICE_IDS.has(id))) return false;
  const haystack = `${record.storedAssetPath || ""} ${record.originalFilename || ""}`;
  if (/pharmacy-image-platform\/services\/pharmacy-first/i.test(haystack)) return true;
  if (UNRELATED_PATH_MARKERS.some((re) => re.test(haystack))) return false;
  if (/pharmacy-image-library\/clinical-nhs-services\//i.test(haystack) && !/pharmacy-first/i.test(haystack)) {
    return false;
  }
  return services.length === 0;
}

export function isAuthoritativeApprovedVerifiedActive(
  record: Pick<TenantImageLibraryRecord, "approvalStatus" | "licenceProvenanceStatus" | "active">,
  options?: { requireTenantActive?: boolean },
): boolean {
  if (record.approvalStatus !== "approved") return false;
  if (record.licenceProvenanceStatus !== "verified") return false;
  if (options?.requireTenantActive && !record.active) return false;
  return true;
}

export function isCampaignEligibleStockPhotograph(
  record: TenantImageLibraryRecord,
  options?: { requireTenantActive?: boolean },
): boolean {
  if (record.sourceType !== "approved-stock") return false;
  if (!isPhotographicCampaignAsset(record)) return false;
  if (!isAuthoritativeApprovedVerifiedActive(record, options)) return false;
  if (!isPharmacyFirstOrGeneralPharmacyImage(record)) return false;
  return true;
}

export function isCampaignEligiblePlacementImage(
  record: TenantImageLibraryRecord,
  session?: Pick<CampaignBuilderSession, "selectedStockImageIds"> | null,
): boolean {
  if (!isPhotographicCampaignAsset(record)) return false;
  if (record.approvalStatus !== "approved") return false;
  if (record.licenceProvenanceStatus !== "verified") return false;
  if (!isPharmacyFirstOrGeneralPharmacyImage(record)) return false;
  if (record.sourceType === "approved-stock") {
    const selected = session?.selectedStockImageIds;
    if (Array.isArray(selected)) return selected.includes(record.imageId);
    return true;
  }
  if (record.sourceType === "approved-ai") return false;
  return Boolean(record.active);
}

export function loadCampaignImageSelectionState(slug: string): Pick<CampaignBuilderSession, "selectedStockImageIds"> {
  const key = safePharmacySlug(slug);
  const file = path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${key}-campaign-builder.json`);
  if (!fs.existsSync(file)) return { selectedStockImageIds: null };
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Partial<CampaignBuilderSession>;
    return {
      selectedStockImageIds: Array.isArray(raw.selectedStockImageIds) ? raw.selectedStockImageIds.map(String) : null,
    };
  } catch {
    return { selectedStockImageIds: null };
  }
}

function mimeFromPath(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return "";
}

function productionRecordToTenantShape(
  asset: ReturnType<typeof listApprovedProductionAssets>[number],
): TenantImageLibraryRecord {
  const rel = String(asset.filePath || "").replace(/^\/+/, "");
  return {
    imageId: `stock:${asset.assetId}`,
    tenantSlug: "",
    sourceType: "approved-stock",
    storedAssetPath: rel,
    originalRemoteUrl: "",
    originalFilename: path.basename(rel),
    mimeType: mimeFromPath(rel),
    width: Number(asset.width || 0),
    height: Number(asset.height || 0),
    checksum: String(asset.checksum || ""),
    licenceProvenanceStatus: "verified",
    approvalStatus: "approved",
    suitableServiceIds: [CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID],
    semanticCategories: [],
    active: true,
    createdAt: "",
    approvedAt: "",
    legacyAssignmentKeys: [`stock:${asset.assetId}`],
  };
}

export function listEligibleCampaignStockPhotographs(slug: string): TenantImageLibraryRecord[] {
  const library = loadTenantImageLibrary(slug);
  const tenantStock = library.images.filter((img) => img.sourceType === "approved-stock");
  const out: TenantImageLibraryRecord[] = [];
  const seen = new Set<string>();

  for (const asset of listApprovedProductionAssets(CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID)) {
    const rel = String(asset.filePath || "").replace(/^\/+/, "");
    const tenant =
      tenantStock.find((img) => img.storedAssetPath === rel || (asset.checksum && img.checksum === asset.checksum)) ||
      null;
    const record = tenant
      ? {
          ...tenant,
          approvalStatus: "approved" as const,
          licenceProvenanceStatus: "verified" as const,
          suitableServiceIds: tenant.suitableServiceIds.includes(CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID)
            ? tenant.suitableServiceIds
            : [CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID],
          active: true,
        }
      : productionRecordToTenantShape(asset);
    if (!isCampaignEligibleStockPhotograph(record)) continue;
    out.push(record);
    seen.add(rel);
    seen.add(record.imageId);
  }

  for (const img of tenantStock) {
    if (seen.has(img.storedAssetPath) || seen.has(img.imageId)) continue;
    if (!isCampaignEligibleStockPhotograph(img, { requireTenantActive: true })) continue;
    out.push(img);
  }
  return out;
}

export function listCampaignPharmacyPhotographs(slug: string): TenantImageLibraryRecord[] {
  return loadTenantImageLibrary(slug).images.filter(
    (img) => img.sourceType === "customer-upload" || img.sourceType === "website-import",
  );
}

function uploadReviewStatus(img: TenantImageLibraryRecord): string {
  if (img.approvalStatus === "rejected") return "Not approved";
  if (img.approvalStatus === "approved") {
    return img.licenceProvenanceStatus === "verified" ? "Approved" : "Approved · licence review outstanding";
  }
  return "Pending review";
}

function isStockSelected(imageId: string, session: CampaignBuilderSession): boolean {
  const selected = session.selectedStockImageIds;
  if (!Array.isArray(selected)) return true;
  return selected.includes(imageId);
}

function stockPhotographAltText(record: TenantImageLibraryRecord): string {
  const rel = String(record.storedAssetPath || "").replace(/^\/+/, "");
  const asset = listApprovedProductionAssets(CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID).find(
    (item) => String(item.filePath || "").replace(/^\/+/, "") === rel,
  );
  const alt = String(asset?.defaultAltText || "").trim();
  return alt || "Approved pharmacy stock photograph";
}

export function buildCampaignImageStrategyView(slug: string, session: CampaignBuilderSession): CampaignImageStrategyView {
  const stockRecords = listEligibleCampaignStockPhotographs(slug);
  const stock: CampaignStockImageCard[] = stockRecords.map((img) => ({
    imageId: img.imageId,
    filename: img.originalFilename || img.imageId,
    previewUrl: publicTenantImageUrl(img),
    altText: stockPhotographAltText(img),
    selected: isStockSelected(img.imageId, session),
    approvalStatus: img.approvalStatus,
    verified: img.licenceProvenanceStatus === "verified",
  }));
  const uploads: CampaignUploadImageCard[] = listCampaignPharmacyPhotographs(slug).map((img) => ({
    imageId: img.imageId,
    filename: img.originalFilename || img.imageId,
    previewUrl: publicTenantImageUrl(img),
    sourceLabel: img.sourceType === "website-import" ? "Customer-provided · website import" : "Customer-provided",
    reviewStatus: uploadReviewStatus(img),
    approved: img.approvalStatus === "approved",
  }));
  const pendingAi = (loadImageAssignments(slug).aiRequests || []).filter(
    (req) =>
      req.serviceId === (session.selectedServiceId || CAMPAIGN_IMAGE_STRATEGY_SERVICE_ID) &&
      (req.status === "pending" || req.status === "processing"),
  );
  const requestAiImages = session.requestAiImages === true;
  return {
    stock,
    uploads,
    pendingAi,
    requestAiImages,
    imageStrategy: session.imageStrategy || "existing",
  };
}

export function deriveCampaignImageStrategy(input: {
  selectedStockCount: number;
  uploadCount: number;
  requestAiImages: boolean;
}): CampaignBuilderImageStrategy {
  const sources = [
    input.selectedStockCount > 0,
    input.uploadCount > 0,
    input.requestAiImages,
  ].filter(Boolean).length;
  if (input.requestAiImages && sources === 1) return "ai";
  if (input.uploadCount > 0 && sources === 1) return "upload";
  if (input.selectedStockCount > 0 && sources === 1) return "existing";
  if (sources === 0) return "existing";
  return "mixed";
}

export function filterTenantLibraryForCampaignPlacement(
  library: TenantImageLibrary,
  session?: Pick<CampaignBuilderSession, "selectedStockImageIds"> | null,
): TenantImageLibrary {
  return {
    ...library,
    images: library.images.filter((img) => isCampaignEligiblePlacementImage(img, session)),
  };
}

export interface CampaignReadyPhotographSummary {
  readyPhotoCount: number;
  selectedStockCount: number;
  approvedUploadCount: number;
  pendingUploadCount: number;
  requestAiImages: boolean;
}

export function summarizeCampaignReadyPhotographs(
  slug: string,
  session?: Pick<CampaignBuilderSession, "selectedStockImageIds" | "requestAiImages"> | null,
): CampaignReadyPhotographSummary {
  const selection = session ?? loadCampaignImageSelectionState(slug);
  const requestAiImages = session?.requestAiImages === true;
  const selectedStock = listEligibleCampaignStockPhotographs(slug).filter((img) =>
    isCampaignEligiblePlacementImage(img, selection),
  );
  const uploads = listCampaignPharmacyPhotographs(slug);
  const approvedUploads = uploads.filter((img) => isCampaignEligiblePlacementImage(img, selection));
  const pendingUploads = uploads.filter(
    (img) => img.approvalStatus !== "approved" && img.approvalStatus !== "rejected",
  );
  const seen = new Set<string>();
  let readyPhotoCount = 0;
  for (const img of [...selectedStock, ...approvedUploads]) {
    const key = img.storedAssetPath || img.imageId;
    if (seen.has(key)) continue;
    seen.add(key);
    readyPhotoCount += 1;
  }
  return {
    readyPhotoCount,
    selectedStockCount: selectedStock.length,
    approvedUploadCount: approvedUploads.length,
    pendingUploadCount: pendingUploads.length,
    requestAiImages,
  };
}

const AI_REQUEST_SLOTS: ImageMatrixSlot[] = ["hero", "support", "trust", "conversion", "local"];

export function recordCampaignAiImageRequests(
  slug: string,
  serviceId: string,
): PharmacyAiImageRequest[] {
  const doc = loadImageAssignments(slug);
  const created: PharmacyAiImageRequest[] = [];
  for (const slot of AI_REQUEST_SLOTS) {
    const existing = (doc.aiRequests || []).find(
      (req) => req.serviceId === serviceId && req.slot === slot && (req.status === "pending" || req.status === "processing"),
    );
    if (existing) continue;
    created.push(
      createAiImageRequest(slug, serviceId, slot, slot === "local" ? "local" : slot, undefined, {
        assignToSlot: false,
        campaignId: serviceId,
      }),
    );
  }
  return created;
}
