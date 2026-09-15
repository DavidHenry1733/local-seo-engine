/**
 * TENANT-AUTOMATIC-IMAGE-LIBRARY-43B
 *
 * Authoritative tenant image library: up to 20 active images.
 * Product Owner adds/approves; the engine selects placement.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { loadImportedDesignAssets } from "./pharmacyWebsiteDesignAssetImporter.ts";
import {
  loadImageAssignments,
  listLibraryImages,
  uploadDir,
  type PharmacyAiImageRequest,
  type PharmacyImageUpload,
} from "./pharmacyImageOperatingSystem.ts";
import { listApprovedProductionAssets } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { loadMasterStockImages } from "./pharmacyMasterStockImageService.ts";
import {
  getPharmacyTenantImageLibraryPath,
  PHARMACY_WORKSPACE_ROOT,
  safePharmacySlug,
} from "./pharmacyWorkspacePaths.ts";

export const TENANT_IMAGE_LIBRARY_CONTRACT_ID = "pharmaconnect-tenant-image-library-v1";
export const MAX_ACTIVE_TENANT_IMAGES = 20;

export type TenantImageSourceType = "customer-upload" | "website-import" | "approved-stock" | "approved-ai";
export type TenantImageApprovalStatus = "pending" | "approved" | "rejected";
export type TenantImageLicenceStatus = "verified" | "unverified" | "failed" | "pending";
export type TenantImageSemanticCategory =
  | "hero"
  | "support"
  | "trust"
  | "conversion"
  | "local"
  | "consultation"
  | "team"
  | "pharmacy"
  | "clinical";

export interface TenantImageLibraryRecord {
  imageId: string;
  tenantSlug: string;
  sourceType: TenantImageSourceType;
  storedAssetPath: string;
  originalRemoteUrl: string;
  originalFilename: string;
  mimeType: string;
  width: number;
  height: number;
  checksum: string;
  licenceProvenanceStatus: TenantImageLicenceStatus;
  approvalStatus: TenantImageApprovalStatus;
  suitableServiceIds: string[];
  semanticCategories: TenantImageSemanticCategory[];
  active: boolean;
  createdAt: string;
  approvedAt: string | null;
  legacyAssignmentKeys: string[];
}

export interface TenantImageLibrary {
  version: typeof TENANT_IMAGE_LIBRARY_CONTRACT_ID;
  slug: string;
  updatedAt: string;
  images: TenantImageLibraryRecord[];
}

export const SOURCE_PRIORITY: TenantImageSourceType[] = [
  "customer-upload",
  "website-import",
  "approved-stock",
  "approved-ai",
];

const ALLOWED_EXT = [".jpg", ".jpeg", ".png", ".webp", ".svg"];

export function sourcePriorityRank(source: TenantImageSourceType): number {
  const idx = SOURCE_PRIORITY.indexOf(source);
  return idx < 0 ? 99 : idx;
}

export function publicTenantImageUrl(record: TenantImageLibraryRecord): string {
  const stored = String(record.storedAssetPath || "").replace(/^\/+/, "");
  if (!stored || /^https?:\/\//i.test(stored)) return "";
  if (!stored.startsWith("assets/")) return "";
  return `/${stored}`;
}

export function emptyTenantImageLibrary(slug: string): TenantImageLibrary {
  return {
    version: TENANT_IMAGE_LIBRARY_CONTRACT_ID,
    slug: safePharmacySlug(slug),
    updatedAt: new Date().toISOString(),
    images: [],
  };
}

export function loadTenantImageLibrary(slug: string): TenantImageLibrary {
  const key = safePharmacySlug(slug);
  const file = getPharmacyTenantImageLibraryPath(key);
  let stored = emptyTenantImageLibrary(key);
  if (fs.existsSync(file)) {
    try {
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as TenantImageLibrary;
      if (raw?.version === TENANT_IMAGE_LIBRARY_CONTRACT_ID) {
        stored = {
          version: TENANT_IMAGE_LIBRARY_CONTRACT_ID,
          slug: key,
          updatedAt: raw.updatedAt || stored.updatedAt,
          images: Array.isArray(raw.images) ? raw.images : [],
        };
      }
    } catch {
      stored = emptyTenantImageLibrary(key);
    }
  }
  return hydrateTenantImageLibraryFromLegacy(key, stored);
}

export function saveTenantImageLibrary(library: TenantImageLibrary): string {
  const file = getPharmacyTenantImageLibraryPath(library.slug);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const payload: TenantImageLibrary = {
    ...library,
    version: TENANT_IMAGE_LIBRARY_CONTRACT_ID,
    slug: safePharmacySlug(library.slug),
    updatedAt: new Date().toISOString(),
    images: library.images.slice(),
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2), "utf8");
  return file;
}

export function listActiveTenantImages(library: TenantImageLibrary): TenantImageLibraryRecord[] {
  return library.images.filter(isSelectableTenantImage);
}

export function isSelectableTenantImage(record: TenantImageLibraryRecord): boolean {
  if (!record.active) return false;
  if (record.approvalStatus !== "approved") return false;
  if (record.licenceProvenanceStatus === "failed" || record.licenceProvenanceStatus === "pending") return false;
  if (record.licenceProvenanceStatus === "unverified" && record.sourceType === "website-import") return false;
  if (!record.storedAssetPath || /^https?:\/\//i.test(record.storedAssetPath)) return false;
  if (!record.storedAssetPath.startsWith("assets/")) return false;
  return true;
}

export function countActiveTenantImages(library: TenantImageLibrary): number {
  return library.images.filter((img) => img.active && img.approvalStatus !== "rejected").length;
}

function checksumOf(buf: Buffer): string {
  return crypto.createHash("sha256").update(buf).digest("hex");
}

function checksumFile(relPath: string): string {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, relPath.replace(/^\/+/, ""));
  if (!fs.existsSync(full)) return "";
  return checksumOf(fs.readFileSync(full));
}

function readImageSize(buf: Buffer): { width: number; height: number } {
  if (buf.length >= 24 && buf[0] === 0x89 && buf[1] === 0x50) {
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (buf.length > 10 && buf[0] === 0xff && buf[1] === 0xd8) {
    let i = 2;
    while (i + 9 < buf.length) {
      if (buf[i] !== 0xff) break;
      const marker = buf[i + 1];
      const size = buf.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { height: buf.readUInt16BE(i + 5), width: buf.readUInt16BE(i + 7) };
      }
      i += 2 + size;
    }
  }
  return { width: 0, height: 0 };
}

function mimeFromExt(filename: string, fallback = "application/octet-stream"): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".webp") return "image/webp";
  if (ext === ".svg") return "image/svg+xml";
  return fallback;
}

function imageIdFor(checksum: string, sourceType: TenantImageSourceType, pathHint: string): string {
  const material = checksum || `${sourceType}:${pathHint}`;
  return `til-${crypto.createHash("sha256").update(material).digest("hex").slice(0, 16)}`;
}

function upsertImage(library: TenantImageLibrary, record: TenantImageLibraryRecord): TenantImageLibraryRecord {
  const idx = library.images.findIndex(
    (img) => img.imageId === record.imageId || (record.checksum && img.checksum === record.checksum),
  );
  if (idx >= 0) {
    const existing = library.images[idx];
    const merged: TenantImageLibraryRecord = {
      ...existing,
      storedAssetPath: existing.storedAssetPath || record.storedAssetPath,
      originalFilename: existing.originalFilename || record.originalFilename,
      mimeType: existing.mimeType || record.mimeType,
      width: existing.width || record.width,
      height: existing.height || record.height,
      checksum: existing.checksum || record.checksum,
      suitableServiceIds: existing.suitableServiceIds.length ? existing.suitableServiceIds : record.suitableServiceIds,
      semanticCategories: existing.semanticCategories.length ? existing.semanticCategories : record.semanticCategories,
      legacyAssignmentKeys: [...new Set([...existing.legacyAssignmentKeys, ...record.legacyAssignmentKeys])],
    };
    library.images[idx] = merged;
    return merged;
  }
  library.images.push(record);
  return record;
}

function categoriesFromHint(hint: string): TenantImageSemanticCategory[] {
  const lower = hint.toLowerCase();
  const out = new Set<TenantImageSemanticCategory>();
  if (/hero/.test(lower)) out.add("hero");
  if (/support|consult/.test(lower)) out.add("support");
  if (/trust|team/.test(lower)) out.add("trust");
  if (/conversion|cta|book/.test(lower)) out.add("conversion");
  if (/local/.test(lower)) out.add("local");
  if (/team/.test(lower)) out.add("team");
  if (/consult/.test(lower)) out.add("consultation");
  if (!out.size) out.add("pharmacy");
  return [...out];
}

export function hydrateTenantImageLibraryFromLegacy(slug: string, stored: TenantImageLibrary): TenantImageLibrary {
  const key = safePharmacySlug(slug);
  const library: TenantImageLibrary = {
    version: TENANT_IMAGE_LIBRARY_CONTRACT_ID,
    slug: key,
    updatedAt: stored.updatedAt,
    images: stored.images.map((img) => ({ ...img })),
  };
  const now = stored.updatedAt || new Date().toISOString();
  const assignments = loadImageAssignments(key);

  for (const upload of assignments.uploads || []) {
    const rel = String(upload.path || "").replace(/^\/+/, "");
    if (!rel.startsWith("assets/")) continue;
    const checksum = checksumFile(rel);
    upsertImage(library, {
      imageId: imageIdFor(checksum || upload.id, "customer-upload", rel),
      tenantSlug: key,
      sourceType: "customer-upload",
      storedAssetPath: rel,
      originalRemoteUrl: "",
      originalFilename: upload.filename || path.basename(rel),
      mimeType: upload.mimeType || mimeFromExt(upload.filename || rel),
      width: 0,
      height: 0,
      checksum,
      licenceProvenanceStatus: "verified",
      approvalStatus: "approved",
      suitableServiceIds: [],
      semanticCategories: categoriesFromHint(upload.category || upload.label || ""),
      active: true,
      createdAt: upload.uploadedAt || now,
      approvedAt: upload.uploadedAt || now,
      legacyAssignmentKeys: [`upload:${upload.id}`],
    });
  }

  for (const [assignmentKey, assignment] of Object.entries(assignments.assignments || {})) {
    const source = assignment.sourceType || assignment.source;
    const rel = String(assignment.filePath || "").replace(/^\/+/, "");
    if (source === "website-import" && rel.startsWith("assets/")) {
      const approved = Boolean(
        (assignment as { websiteImportApproved?: boolean; customerOwnedApproved?: boolean }).websiteImportApproved ||
          (assignment as { customerOwnedApproved?: boolean }).customerOwnedApproved,
      );
      const checksum = checksumFile(rel);
      upsertImage(library, {
        imageId: imageIdFor(checksum || assignmentKey, "website-import", rel),
        tenantSlug: key,
        sourceType: "website-import",
        storedAssetPath: rel,
        originalRemoteUrl: "",
        originalFilename: path.basename(rel),
        mimeType: mimeFromExt(rel),
        width: 0,
        height: 0,
        checksum,
        licenceProvenanceStatus: approved ? "verified" : "unverified",
        approvalStatus: approved ? "approved" : "pending",
        suitableServiceIds: assignment.serviceId ? [assignment.serviceId] : [],
        semanticCategories: categoriesFromHint(assignment.slot || ""),
        active: approved,
        createdAt: assignment.createdAt || assignment.assignedAt || now,
        approvedAt: approved ? assignment.updatedAt || assignment.assignedAt || now : null,
        legacyAssignmentKeys: [assignmentKey],
      });
    }
  }

  for (const asset of loadImportedDesignAssets(key)) {
    const rel = String(asset.localPath || "").replace(/^\/+/, "");
    if (!rel.startsWith("assets/")) continue;
    if (asset.classification === "logo" || asset.classification === "favicon" || asset.classification === "icon") continue;
    const checksum = checksumFile(rel);
    upsertImage(library, {
      imageId: imageIdFor(checksum || rel, "website-import", rel),
      tenantSlug: key,
      sourceType: "website-import",
      storedAssetPath: rel,
      originalRemoteUrl: String(asset.originalUrl || ""),
      originalFilename: path.basename(rel),
      mimeType: mimeFromExt(rel),
      width: 0,
      height: 0,
      checksum,
      licenceProvenanceStatus: "unverified",
      approvalStatus: "pending",
      suitableServiceIds: [],
      semanticCategories: categoriesFromHint(asset.classification || "support"),
      active: false,
      createdAt: now,
      approvedAt: null,
      legacyAssignmentKeys: [`website-import:${rel}`],
    });
  }

  enforceActiveCap(library);
  return library;
}

function enforceActiveCap(library: TenantImageLibrary): void {
  const ranked = library.images
    .filter((img) => img.active && img.approvalStatus !== "rejected")
    .sort((a, b) => {
      const rank = sourcePriorityRank(a.sourceType) - sourcePriorityRank(b.sourceType);
      if (rank) return rank;
      return a.imageId.localeCompare(b.imageId);
    });
  ranked.forEach((img, index) => {
    if (index >= MAX_ACTIVE_TENANT_IMAGES) img.active = false;
  });
}

export function addTenantImageFromBuffer(
  library: TenantImageLibrary,
  input: {
    slug: string;
    sourceType: TenantImageSourceType;
    buffer: Buffer;
    originalFilename: string;
    mimeType: string;
    suitableServiceIds?: string[];
    semanticCategories?: TenantImageSemanticCategory[];
    approvalStatus?: TenantImageApprovalStatus;
    licenceProvenanceStatus?: TenantImageLicenceStatus;
    originalRemoteUrl?: string;
    storedAssetPath?: string;
  },
): { ok: boolean; record?: TenantImageLibraryRecord; error?: string; duplicate?: boolean } {
  const key = safePharmacySlug(input.slug);
  const checksum = checksumOf(input.buffer);
  const existing = library.images.find((img) => img.checksum === checksum);
  if (existing) return { ok: true, record: existing, duplicate: true };

  const ext = path.extname(input.originalFilename).toLowerCase();
  const safeExt = ALLOWED_EXT.includes(ext) ? ext : ".webp";
  const size = readImageSize(input.buffer);
  const imageId = imageIdFor(checksum, input.sourceType, input.originalFilename);
  let storedAssetPath = String(input.storedAssetPath || "").replace(/^\/+/, "");
  if (!storedAssetPath) {
    const destDir = path.join(PHARMACY_WORKSPACE_ROOT, "assets/pharmacy-uploads", key, "tenant-library");
    fs.mkdirSync(destDir, { recursive: true });
    const destAbs = path.join(destDir, `${imageId}${safeExt}`);
    fs.writeFileSync(destAbs, input.buffer);
    storedAssetPath = path.relative(PHARMACY_WORKSPACE_ROOT, destAbs).replace(/\\/g, "/");
  }

  const wantActive = (input.approvalStatus || "approved") === "approved";
  const activeCount = countActiveTenantImages(library);
  const record: TenantImageLibraryRecord = {
    imageId,
    tenantSlug: key,
    sourceType: input.sourceType,
    storedAssetPath,
    originalRemoteUrl: input.originalRemoteUrl || "",
    originalFilename: input.originalFilename,
    mimeType: input.mimeType || mimeFromExt(input.originalFilename),
    width: size.width,
    height: size.height,
    checksum,
    licenceProvenanceStatus: input.licenceProvenanceStatus || "verified",
    approvalStatus: input.approvalStatus || "approved",
    suitableServiceIds: input.suitableServiceIds || [],
    semanticCategories: input.semanticCategories || ["pharmacy"],
    active: wantActive && activeCount < MAX_ACTIVE_TENANT_IMAGES,
    createdAt: new Date().toISOString(),
    approvedAt: (input.approvalStatus || "approved") === "approved" ? new Date().toISOString() : null,
    legacyAssignmentKeys: [],
  };
  if (wantActive && activeCount >= MAX_ACTIVE_TENANT_IMAGES) {
    library.images.push(record);
    return { ok: false, record, error: `Active image library is full (${MAX_ACTIVE_TENANT_IMAGES}/${MAX_ACTIVE_TENANT_IMAGES})` };
  }
  library.images.push(record);
  return { ok: true, record };
}

export function addCustomerUploadToLibrary(
  slug: string,
  file: { filename: string; path: string; mimeType: string; originalFilename?: string },
): { ok: boolean; library: TenantImageLibrary; record?: TenantImageLibraryRecord; error?: string; duplicate?: boolean } {
  const key = safePharmacySlug(slug);
  const storedFile = getPharmacyTenantImageLibraryPath(key);
  const storedIds = new Set<string>();
  if (fs.existsSync(storedFile)) {
    try {
      const raw = JSON.parse(fs.readFileSync(storedFile, "utf8")) as TenantImageLibrary;
      for (const img of raw.images || []) storedIds.add(String(img.imageId || ""));
    } catch {
      /* stored library unreadable — treat as empty for new-upload pending */
    }
  }
  const library = loadTenantImageLibrary(slug);
  const rel = String(file.path || "").replace(/^\/+/, "");
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  if (!fs.existsSync(abs)) return { ok: false, library, error: "Uploaded file is missing on disk" };
  const buffer = fs.readFileSync(abs);
  const result = addTenantImageFromBuffer(library, {
    slug,
    sourceType: "customer-upload",
    buffer,
    originalFilename: file.originalFilename || file.filename,
    mimeType: file.mimeType,
    storedAssetPath: rel,
    approvalStatus: "pending",
    licenceProvenanceStatus: "pending",
    semanticCategories: ["pharmacy"],
  });
  if (result.record && !storedIds.has(result.record.imageId)) {
    result.record.approvalStatus = "pending";
    result.record.licenceProvenanceStatus = "pending";
    result.record.active = false;
    result.record.approvedAt = null;
  }
  saveTenantImageLibrary(library);
  return { ...result, library };
}

export function deactivateTenantImage(slug: string, imageId: string): TenantImageLibrary {
  const library = loadTenantImageLibrary(slug);
  const rec = library.images.find((img) => img.imageId === imageId);
  if (rec) rec.active = false;
  saveTenantImageLibrary(library);
  return library;
}

export function activateTenantImage(slug: string, imageId: string): TenantImageLibrary {
  const library = loadTenantImageLibrary(slug);
  const rec = library.images.find((img) => img.imageId === imageId);
  if (
    rec &&
    rec.approvalStatus === "approved" &&
    rec.licenceProvenanceStatus !== "failed" &&
    rec.licenceProvenanceStatus !== "pending"
  ) {
    if (countActiveTenantImages(library) < MAX_ACTIVE_TENANT_IMAGES) rec.active = true;
  }
  saveTenantImageLibrary(library);
  return library;
}

export function approveTenantImage(slug: string, imageId: string): TenantImageLibrary {
  const library = loadTenantImageLibrary(slug);
  const rec = library.images.find((img) => img.imageId === imageId);
  if (rec) {
    rec.approvalStatus = "approved";
    rec.licenceProvenanceStatus = rec.licenceProvenanceStatus === "failed" ? "failed" : "verified";
    rec.approvedAt = new Date().toISOString();
    if (countActiveTenantImages(library) < MAX_ACTIVE_TENANT_IMAGES) rec.active = true;
  }
  saveTenantImageLibrary(library);
  return library;
}

export function includeApprovedStockImages(slug: string, serviceId = "pharmacy-first"): TenantImageLibrary {
  const library = loadTenantImageLibrary(slug);
  const key = safePharmacySlug(slug);
  const now = new Date().toISOString();
  for (const asset of listApprovedProductionAssets(serviceId)) {
    const rel = String(asset.filePath || "").replace(/^\/+/, "");
    if (!rel.startsWith("assets/")) continue;
    const checksum = String(asset.checksum || checksumFile(rel));
    upsertImage(library, {
      imageId: imageIdFor(checksum, "approved-stock", rel),
      tenantSlug: key,
      sourceType: "approved-stock",
      storedAssetPath: rel,
      originalRemoteUrl: "",
      originalFilename: path.basename(rel),
      mimeType: mimeFromExt(rel),
      width: Number(asset.width || 0),
      height: Number(asset.height || 0),
      checksum,
      licenceProvenanceStatus: "verified",
      approvalStatus: "approved",
      suitableServiceIds: [serviceId],
      semanticCategories: categoriesFromHint(asset.role || "support"),
      active: true,
      createdAt: now,
      approvedAt: now,
      legacyAssignmentKeys: [`stock:${asset.assetId}`],
    });
  }
  for (const img of listLibraryImages().filter((item) => item.assetExists)) {
    const rel = String(img.assetPath || "").replace(/^\/+/, "");
    if (!rel.startsWith("assets/")) continue;
    const checksum = checksumFile(rel);
    upsertImage(library, {
      imageId: imageIdFor(checksum || img.libraryRef, "approved-stock", rel),
      tenantSlug: key,
      sourceType: "approved-stock",
      storedAssetPath: rel,
      originalRemoteUrl: "",
      originalFilename: path.basename(rel),
      mimeType: mimeFromExt(rel),
      width: 0,
      height: 0,
      checksum,
      licenceProvenanceStatus: "verified",
      approvalStatus: "approved",
      suitableServiceIds: [],
      semanticCategories: categoriesFromHint(img.category || img.imageKey),
      active: true,
      createdAt: now,
      approvedAt: now,
      legacyAssignmentKeys: [`library:${img.libraryRef}`],
    });
  }
  for (const stock of loadMasterStockImages(slug).images) {
    const rel = String(stock.path || "").replace(/^\/+/, "");
    if (!rel.startsWith("assets/")) continue;
    const checksum = checksumFile(rel);
    upsertImage(library, {
      imageId: imageIdFor(checksum || stock.id, "approved-stock", rel),
      tenantSlug: key,
      sourceType: "approved-stock",
      storedAssetPath: rel,
      originalRemoteUrl: "",
      originalFilename: stock.filename,
      mimeType: mimeFromExt(stock.filename),
      width: 0,
      height: 0,
      checksum,
      licenceProvenanceStatus: "verified",
      approvalStatus: "approved",
      suitableServiceIds: [],
      semanticCategories: categoriesFromHint((stock.types || []).join(" ")),
      active: true,
      createdAt: stock.uploadedAt || now,
      approvedAt: stock.uploadedAt || now,
      legacyAssignmentKeys: [`master-stock:${stock.id}`],
    });
  }
  enforceActiveCap(library);
  saveTenantImageLibrary(library);
  return library;
}

export function approveExistingAiAsset(
  slug: string,
  aiRequest: Pick<PharmacyAiImageRequest, "id" | "status" | "resultPath" | "serviceId" | "slot" | "createdAt">,
): { ok: boolean; record?: TenantImageLibraryRecord; error?: string } {
  if (aiRequest.status !== "complete" || !aiRequest.resultPath) {
    return { ok: false, error: "Pending AI requests cannot enter the active library" };
  }
  const rel = String(aiRequest.resultPath).replace(/^\/+/, "");
  if (!rel.startsWith("assets/")) return { ok: false, error: "AI asset is missing a stored path" };
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  if (!fs.existsSync(abs)) return { ok: false, error: "AI asset file does not exist" };
  const library = loadTenantImageLibrary(slug);
  const buffer = fs.readFileSync(abs);
  const result = addTenantImageFromBuffer(library, {
    slug,
    sourceType: "approved-ai",
    buffer,
    originalFilename: path.basename(rel),
    mimeType: mimeFromExt(rel),
    storedAssetPath: rel,
    approvalStatus: "approved",
    licenceProvenanceStatus: "verified",
    suitableServiceIds: aiRequest.serviceId ? [aiRequest.serviceId] : [],
    semanticCategories: categoriesFromHint(aiRequest.slot || "support"),
  });
  saveTenantImageLibrary(library);
  return result;
}

export function pendingAiRequestsForLibrary(slug: string): PharmacyAiImageRequest[] {
  return (loadImageAssignments(slug).aiRequests || []).filter(
    (req) => req.status === "pending" || req.status === "processing",
  );
}

export function buildTenantImageLibraryView(slug: string): {
  library: TenantImageLibrary;
  activeCount: number;
  maxActive: number;
  pendingWebsite: TenantImageLibraryRecord[];
  pendingAi: PharmacyAiImageRequest[];
  selectable: TenantImageLibraryRecord[];
} {
  const library = loadTenantImageLibrary(slug);
  return {
    library,
    activeCount: countActiveTenantImages(library),
    maxActive: MAX_ACTIVE_TENANT_IMAGES,
    pendingWebsite: library.images.filter(
      (img) => img.sourceType === "website-import" && img.approvalStatus !== "approved",
    ),
    pendingAi: pendingAiRequestsForLibrary(slug),
    selectable: listActiveTenantImages(library),
  };
}

export { uploadDir };
export type { PharmacyImageUpload };
