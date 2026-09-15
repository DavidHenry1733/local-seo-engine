/**
 * PharmaConnect Image Operating System V1 — per-pharmacy slot assignments,
 * uploads, AI requests, and resolution priority (assignment → upload → AI → library).
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import {
  loadPharmacyImageLibrary,
  resolveLibraryAssetPath,
  resolvePharmacySlotImage,
  type PharmacyImageRenderContext,
  type PharmacyImageSlot,
  type ResolvedPharmacyImage,
  sanitizePharmacyImageAltText,
} from "./templates/pharmacyImageLibrary.ts";
import { VISUAL_EXPERIENCE_BENCHMARK_SERVICES, VISUAL_EXPERIENCE_SERVICE_CONFIG } from "./pharmacyVisualExperienceConfig.ts";
import { BENCHMARK_MASTER_SERVICE_IDS } from "./pharmacyMasterPublishConfig.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { shouldUseWebsiteImportAssignment } from "./pharmacyImageSourcePolicy.ts";
import {
  isLegacyDemonstrationAssetPath,
  isNeutralSharedPlatformFallbackAsset,
  isPharmacyFirstProductionLibraryReady,
  listApprovedProductionAssets,
  selectDeterministicProductionAsset,
  SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS,
} from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { isAssetBlockedForVisualSlot } from "./pharmacyBusinessFieldSanitizer.ts";
import {
  classifyLibraryAssetFile,
  isApprovedContentImage,
} from "./pharmacyImageLibraryContentAssetClassifier.ts";

export const WORKSPACE_ROOT = PHARMACY_WORKSPACE_ROOT;
export const UPLOAD_ROOT = path.join(WORKSPACE_ROOT, "assets/pharmacy-uploads");
export const LIBRARY_ASSET_ROOT = path.join(WORKSPACE_ROOT, "assets/pharmacy-image-library");
export const BRAND_SAFE_ASSET_ROOT = path.join(WORKSPACE_ROOT, "assets/pharmacy-brand-safe");
export const ASSIGNMENTS_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-image-assignments");

/** Matrix columns shown on the service matrix dashboard */
export const IMAGE_MATRIX_SLOTS = [
  "hero",
  "support",
  "trust",
  "conversion",
  "local",
  "guide",
  "blog",
  "social",
  "GBP",
] as const;

export type ImageMatrixSlot = (typeof IMAGE_MATRIX_SLOTS)[number];

/** Required slots for service page launch */
export const PAGE_IMAGE_SLOTS = ["hero", "support", "trust", "conversion"] as const;

export type PageImageSlot = (typeof PAGE_IMAGE_SLOTS)[number];

/** All supported image categories (matrix + extended) */
export const IMAGE_CATEGORIES = [
  "hero",
  "support",
  "trust",
  "conversion",
  "guide",
  "blog",
  "social",
  "GBP",
  "local",
  "team",
  "pharmacy exterior",
  "consultation room",
] as const;

export type ImageCategory = (typeof IMAGE_CATEGORIES)[number];

export type ImageSource = "assignment" | "upload" | "ai" | "library" | "website-import" | "image-platform" | "missing";

export type AiRequestStatus = "pending" | "processing" | "complete" | "failed";

export interface PharmacyImageUpload {
  id: string;
  filename: string;
  path: string;
  category: ImageCategory;
  mimeType: string;
  uploadedAt: string;
  label?: string;
}

export interface PharmacyAiImageRequest {
  id: string;
  serviceId: string;
  slot: ImageMatrixSlot;
  category: ImageCategory;
  prompt: string;
  status: AiRequestStatus;
  resultPath: string | null;
  createdAt: string;
  updatedAt: string;
  error?: string;
}

export type AssignmentSourceType = "library" | "upload" | "ai" | "website-import" | "image-platform";

export interface SlotAssignment {
  serviceId: string;
  slot: ImageMatrixSlot;
  /** @deprecated use sourceType — kept for backward compatibility */
  source: AssignmentSourceType;
  sourceType?: AssignmentSourceType;
  campaignId?: string;
  assetType?: ImageCategory;
  filePath?: string;
  previewUrl?: string;
  libraryRef?: string;
  uploadId?: string;
  aiRequestId?: string;
  altText?: string;
  title?: string;
  status?: "assigned" | "pending" | "missing";
  createdAt?: string;
  updatedAt?: string;
  assignedAt: string;
}

export interface PharmacyImageAssignmentsDoc {
  slug: string;
  updatedAt: string;
  version: number;
  assignments: Record<string, SlotAssignment>;
  uploads: PharmacyImageUpload[];
  aiRequests: PharmacyAiImageRequest[];
}

export interface LibraryImageOption {
  libraryRef: string;
  imagePack: string;
  imageKey: string;
  category: string;
  assetPath: string;
  assetExists: boolean;
  altPattern: string;
}

export interface MatrixCellStatus {
  serviceId: string;
  serviceName: string;
  slot: ImageMatrixSlot;
  assigned: boolean;
  source: ImageSource;
  previewUrl: string | null;
  assetPath: string | null;
  libraryRef: string | null;
}

export interface ImageOperatingSystemOverview {
  totalSlots: number;
  assigned: number;
  missing: number;
  uploadCount: number;
  aiImageCount: number;
  libraryImageCount: number;
  aiPendingCount: number;
}

export interface PageSlotCard {
  serviceId: string;
  slot: PageImageSlot;
  assigned: boolean;
  sourceType: AssignmentSourceType | "missing" | null;
  previewUrl: string | null;
  filePath: string | null;
  libraryRef: string | null;
  uploadId: string | null;
  aiRequestId: string | null;
  status: "assigned" | "pending" | "missing";
  altText: string;
  title: string;
}

export interface ImageSourceBreakdown {
  library: number;
  upload: number;
  ai: number;
  pending: number;
  missing: number;
  missingSlots: PageImageSlot[];
}

export interface ServiceCatalogEntry {
  serviceId: string;
  serviceName: string;
}

export interface ImageOperatingSystemDashboard {
  slug: string;
  pharmacyName: string;
  brandPrimaryColor: string;
  overview: ImageOperatingSystemOverview;
  matrix: MatrixCellStatus[];
  pageSlots: PageSlotCard[];
  sourceBreakdown: ImageSourceBreakdown;
  libraryImages: LibraryImageOption[];
  uploads: PharmacyImageUpload[];
  aiRequests: PharmacyAiImageRequest[];
  benchmarkServices: string[];
  serviceCatalog: ServiceCatalogEntry[];
  matrixSlots: ImageMatrixSlot[];
  selectedServiceId: string;
  selectedCampaignId: string | null;
}

function safeSlug(slug: string): string {
  return (
    String(slug || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function slotKey(serviceId: string, slot: string): string {
  return `${serviceId}:${slot}`;
}

function campaignSlotKey(campaignId: string, serviceId: string, slot: string): string {
  return `${campaignId}:${serviceId}:${slot}`;
}

function assignmentSourceType(a: SlotAssignment): AssignmentSourceType {
  return a.sourceType || a.source;
}

function enrichAssignmentFields(
  assignment: SlotAssignment,
  doc: PharmacyImageAssignmentsDoc,
  renderCtx?: Partial<PharmacyImageRenderContext>,
): SlotAssignment {
  const sourceType = assignmentSourceType(assignment);
  const now = new Date().toISOString();
  let filePath = assignment.filePath || "";
  let previewUrl = assignment.previewUrl || "";
  let altText = assignment.altText || "";
  let title = assignment.title || "";
  let status: SlotAssignment["status"] = assignment.status || "assigned";

  if (sourceType === "library" && assignment.libraryRef) {
    const lib = resolveFromLibraryRef(assignment.libraryRef, renderCtx || {}, assignment.slot as PharmacyImageSlot);
    if (lib) {
      filePath = lib.assetPath;
      previewUrl = lib.assetExists ? publicUrl(lib.assetPath) : "";
      altText = altText || lib.alt;
      if (/\bundefined\b/i.test(altText)) altText = lib.alt;
      title = title || lib.caption;
      if (!lib.assetExists) status = "missing";
    }
  } else if (sourceType === "upload" && assignment.uploadId) {
    const upload = resolveUploadPath(doc, assignment.uploadId);
    if (upload) {
      filePath = upload.path;
      previewUrl = assetExists(upload.path) ? publicUrl(upload.path) : "";
      altText = altText || upload.label || upload.filename;
      title = title || upload.filename;
      if (!assetExists(upload.path)) status = "missing";
    }
  } else if (sourceType === "ai" && assignment.aiRequestId) {
    const ai = doc.aiRequests.find((r) => r.id === assignment.aiRequestId);
    if (ai) {
      title = title || `${ai.serviceId} ${ai.slot}`;
      altText = altText || ai.prompt.slice(0, 120);
      if (ai.status === "pending" || ai.status === "processing") {
        status = "pending";
      } else if (ai.status === "complete" && ai.resultPath && assetExists(ai.resultPath)) {
        filePath = ai.resultPath;
        previewUrl = publicUrl(ai.resultPath);
      } else if (ai.status === "failed") {
        status = "missing";
      }
    }
  }

  if (/\bundefined\b/i.test(altText) && renderCtx) {
    altText = sanitizePharmacyImageAltText(altText, renderCtx, assignment.slot);
  }

  return {
    ...assignment,
    source: sourceType,
    sourceType,
    filePath: filePath || assignment.filePath,
    previewUrl: previewUrl || assignment.previewUrl,
    altText,
    title,
    status,
    createdAt: assignment.createdAt || assignment.assignedAt,
    updatedAt: assignment.updatedAt || now,
  };
}

function buildAssignmentRenderCtx(slug: string, serviceId: string): Partial<PharmacyImageRenderContext> {
  const profile = buildPharmacyServicePageProfile(slug);
  const meta = getServicePublishMeta(serviceId);
  return {
    serviceName: meta?.serviceName || serviceId,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    serviceKey: serviceId,
  };
}

function migrateAssignmentsDoc(doc: PharmacyImageAssignmentsDoc): PharmacyImageAssignmentsDoc {
  let changed = false;
  const assignments: Record<string, SlotAssignment> = {};
  for (const [key, raw] of Object.entries(doc.assignments || {})) {
    const needsMigrate = !raw.sourceType || !raw.createdAt || raw.filePath === undefined;
    const normalized: SlotAssignment = {
      ...raw,
      source: raw.sourceType || raw.source,
      sourceType: raw.sourceType || raw.source,
      assignedAt: raw.assignedAt || raw.createdAt || doc.updatedAt,
      createdAt: raw.createdAt || raw.assignedAt,
      updatedAt: raw.updatedAt || raw.assignedAt,
    };
    const renderCtx = buildAssignmentRenderCtx(doc.slug, normalized.serviceId);
    const needsAltRepair = /\bundefined\b/i.test(normalized.altText || "");
    assignments[key] = needsMigrate || needsAltRepair
      ? enrichAssignmentFields(normalized, doc, renderCtx)
      : normalized;
    if (needsMigrate || needsAltRepair) changed = true;
  }
  doc.assignments = assignments;
  if (changed) saveImageAssignments(doc.slug, doc);
  return doc;
}

function isStaleProductionContentFallback(assignment: SlotAssignment | undefined, serviceId: string): boolean {
  if (!assignment) return false;
  if (serviceId !== "pharmacy-first" || !isPharmacyFirstProductionLibraryReady()) return false;
  if (assignment.sourceType === "image-platform" || assignment.sourceType === "upload") return false;
  const fp = String(assignment.filePath || "");
  return assignment.sourceType === "library" || isLegacyDemonstrationAssetPath(fp);
}

function acceptProductionAssignment(assignment: SlotAssignment | undefined, serviceId: string): SlotAssignment | undefined {
  if (!assignment || isStaleProductionContentFallback(assignment, serviceId)) return undefined;
  return assignment;
}

function getStoredAssignment(
  doc: PharmacyImageAssignmentsDoc,
  serviceId: string,
  slot: ImageMatrixSlot,
  campaignId?: string,
  pageId?: string,
): SlotAssignment | undefined {
  if (pageId) {
    const pageScoped = acceptProductionAssignment(
      doc.assignments[campaignSlotKey(pageId, serviceId, slot)],
      serviceId,
    );
    if (pageScoped) return pageScoped;
  }
  if (campaignId) {
    const campaignAssignment = acceptProductionAssignment(
      doc.assignments[campaignSlotKey(campaignId, serviceId, slot)],
      serviceId,
    );
    if (campaignAssignment) return campaignAssignment;
  }
  const serviceScoped = acceptProductionAssignment(
    doc.assignments[campaignSlotKey(serviceId, serviceId, slot)],
    serviceId,
  );
  if (serviceScoped) return serviceScoped;
  const legacy = acceptProductionAssignment(doc.assignments[slotKey(serviceId, slot)], serviceId);
  if (legacy) return legacy;
  const suffix = `:${serviceId}:${slot}`;
  const matchedKey = Object.keys(doc.assignments).find((key) => key.endsWith(suffix));
  return matchedKey ? acceptProductionAssignment(doc.assignments[matchedKey], serviceId) : undefined;
}

function assetExists(relativePath: string): boolean {
  const full = path.join(WORKSPACE_ROOT, relativePath);
  if (fs.existsSync(full)) return true;
  const base = relativePath.replace(/\.(webp|jpg|jpeg|png|svg)$/i, "");
  for (const ext of [".webp", ".svg", ".jpg", ".jpeg", ".png"]) {
    if (fs.existsSync(path.join(WORKSPACE_ROOT, base + ext))) return true;
  }
  return false;
}

function publicUrl(assetPath: string): string {
  if (!assetPath) return "";
  return assetPath.startsWith("/") ? assetPath : `/${assetPath}`;
}

export function assignmentsPath(slug: string): string {
  fs.mkdirSync(ASSIGNMENTS_DIR, { recursive: true });
  return path.join(ASSIGNMENTS_DIR, `${safeSlug(slug)}.json`);
}

export function uploadDir(slug: string): string {
  const dir = path.join(UPLOAD_ROOT, safeSlug(slug));
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function emptyAssignmentsDoc(slug: string): PharmacyImageAssignmentsDoc {
  return {
    slug: safeSlug(slug),
    updatedAt: new Date().toISOString(),
    version: 1,
    assignments: {},
    uploads: [],
    aiRequests: [],
  };
}

export function loadImageAssignments(slug: string): PharmacyImageAssignmentsDoc {
  const file = assignmentsPath(slug);
  if (!fs.existsSync(file)) return emptyAssignmentsDoc(slug);
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as PharmacyImageAssignmentsDoc;
    const doc: PharmacyImageAssignmentsDoc = {
      ...emptyAssignmentsDoc(slug),
      ...raw,
      slug: safeSlug(slug),
      assignments: raw.assignments || {},
      uploads: raw.uploads || [],
      aiRequests: raw.aiRequests || [],
    };
    return migrateAssignmentsDoc(doc);
  } catch {
    return emptyAssignmentsDoc(slug);
  }
}

export function saveImageAssignments(slug: string, doc: PharmacyImageAssignmentsDoc): string {
  const file = assignmentsPath(slug);
  const payload: PharmacyImageAssignmentsDoc = {
    ...doc,
    slug: safeSlug(slug),
    updatedAt: new Date().toISOString(),
    version: 1,
  };
  fs.writeFileSync(file, JSON.stringify(payload, null, 2));
  return file;
}

export function listLibraryImages(): LibraryImageOption[] {
  const library = loadPharmacyImageLibrary();
  const options: LibraryImageOption[] = [];
  for (const [packKey, pack] of Object.entries(library.imagePacks)) {
    for (const img of pack.images) {
      const assetPath = img.assetPath || `assets/pharmacy-image-library/${packKey}/${img.imageKey}.webp`;
      const resolvedPath = resolveLibraryAssetPath(assetPath);
      options.push({
        libraryRef: `${packKey}/${img.imageKey}`,
        imagePack: packKey,
        imageKey: img.imageKey,
        category: img.purpose || img.recommendedPlacement?.[0] || "support",
        assetPath: resolvedPath,
        assetExists: assetExists(resolvedPath),
        altPattern: img.altTextPattern,
      });
    }
  }
  return options;
}

export function listLibraryImagesFiltered(filters?: {
  serviceId?: string;
  slot?: string;
  category?: string;
}): LibraryImageOption[] {
  const all = listLibraryImages().filter((l) => l.assetExists);
  if (!filters) return all;

  const library = loadPharmacyImageLibrary();
  const slot = filters.slot?.toLowerCase();
  const category = filters.category?.toLowerCase();
  const serviceId = filters.serviceId;

  return all.filter((img) => {
    if (slot && img.category.toLowerCase() !== slot && !img.imageKey.toLowerCase().includes(slot)) {
      const pack = library.imagePacks[img.imagePack];
      const meta = pack?.images.find((i) => i.imageKey === img.imageKey);
      const placements = meta?.recommendedPlacement || [];
      if (!placements.map((p) => p.toLowerCase()).includes(slot)) return false;
    }
    if (category && img.category.toLowerCase() !== category) return false;
    if (serviceId) {
      const mapping = library.serviceSlotMappings?.[serviceId];
      const mappedRef = slot && mapping?.[slot as PharmacyImageSlot];
      if (mappedRef && `${mappedRef.imagePack}/${mappedRef.imageKey}` === img.libraryRef) return true;
      const pack = library.imagePacks[img.imagePack];
      const meta = pack?.images.find((i) => i.imageKey === img.imageKey);
      const compat = meta?.serviceCompatibility || [];
      if (compat.includes("*") || compat.includes(serviceId)) return true;
      if (img.imagePack.includes(serviceId.replace(/-/g, ""))) return true;
      if (serviceId.includes("travel") && img.imagePack.includes("travel")) return true;
      if (serviceId.includes("blood") && img.imagePack.includes("clinical")) return true;
      if (serviceId.includes("contraception") && img.imagePack.includes("clinical")) return true;
      if (serviceId.includes("pharmacy-first") && img.imagePack.includes("clinical")) return true;
      return compat.length === 0;
    }
    return true;
  });
}

const VALID_IMAGE_LIBRARY_SERVICE_IDS = new Set<string>([
  ...BENCHMARK_MASTER_SERVICE_IDS,
  ...VISUAL_EXPERIENCE_BENCHMARK_SERVICES,
]);

const PAGE_SLOT_IDS = new Set<string>(PAGE_IMAGE_SLOTS);

function imageLibraryPackKeys(): Set<string> {
  const library = loadPharmacyImageLibrary();
  return new Set(Object.keys(library.imagePacks || {}));
}

/** True when id is an image pack key (e.g. travel-health-services), not a service id. */
export function isImageLibraryPackKey(id: string): boolean {
  const normalized = normalizeServiceId(id);
  return normalized ? imageLibraryPackKeys().has(normalized) : false;
}

function templateFamilyForService(serviceId: string): string {
  const cfg = VISUAL_EXPERIENCE_SERVICE_CONFIG[serviceId as keyof typeof VISUAL_EXPERIENCE_SERVICE_CONFIG];
  return cfg?.templateFamilyKey || "clinical-nhs-services";
}

/** Normalise and validate a service id for image library routing. Returns null if invalid. */
export function normalizeImageLibraryServiceId(raw: string): string | null {
  const normalized = normalizeServiceId(raw);
  if (!normalized || !VALID_IMAGE_LIBRARY_SERVICE_IDS.has(normalized)) return null;
  if (imageLibraryPackKeys().has(normalized)) return null;
  if (PAGE_SLOT_IDS.has(normalized)) return null;
  return normalized;
}

/** Resolve selected service for image library — falls back to first catalog entry. */
export function resolveImageLibraryServiceId(raw?: string): string {
  const catalog = buildServiceCatalog();
  const fallback = catalog[0]?.serviceId || "pharmacy-first";
  if (!raw) return fallback;
  return normalizeImageLibraryServiceId(raw) || fallback;
}

export function buildServiceCatalog(): ServiceCatalogEntry[] {
  return BENCHMARK_MASTER_SERVICE_IDS.map((serviceId) => {
    const meta = getServicePublishMeta(serviceId);
    return { serviceId, serviceName: meta?.serviceName || serviceId };
  });
}

function defaultLibraryRefForSlot(serviceId: string, slot: ImageMatrixSlot): string | null {
  const library = loadPharmacyImageLibrary();
  const mapping = library.serviceSlotMappings?.[serviceId];
  if (mapping && slot in mapping && mapping[slot as PharmacyImageSlot]) {
    const m = mapping[slot as PharmacyImageSlot];
    return `${m.imagePack}/${m.imageKey}`;
  }
  const coreSlot = slot === "GBP" ? "trust" : slot === "blog" || slot === "social" || slot === "guide" ? "support" : slot;
  if (["hero", "support", "trust", "conversion"].includes(coreSlot)) {
    const core = library.imagePacks["core-pharmacy"];
    const img = core?.images.find((i) => i.imageKey === coreSlot || i.purpose === coreSlot);
    if (img) return `core-pharmacy/${img.imageKey}`;
  }
  return null;
}

function resolveFromLibraryRef(
  libraryRef: string,
  ctx: PharmacyImageRenderContext,
  slot: PharmacyImageSlot,
): ResolvedPharmacyImage | null {
  const library = loadPharmacyImageLibrary();
  const [packKey, imageKey] = libraryRef.split("/");
  const pack = library.imagePacks[packKey];
  const meta = pack?.images.find((i) => i.imageKey === imageKey);
  if (!meta) return null;

  const rawPath = meta.assetPath || `assets/pharmacy-image-library/${packKey}/${imageKey}.webp`;
  let assetPath = resolveLibraryAssetPath(rawPath);
  let exists = assetExists(assetPath);
  // Existing Travel (and other) library packs ship SVG masters; accept SVG when WEBP is absent.
  if (!exists && /\.webp$/i.test(assetPath)) {
    const svgPath = assetPath.replace(/\.webp$/i, ".svg");
    if (assetExists(svgPath)) {
      assetPath = svgPath;
      exists = true;
    }
  }

  const applyPattern = (pattern: string) =>
    sanitizePharmacyImageAltText(pattern, ctx, slot);

  return {
    imageKey,
    imagePack: packKey,
    slot,
    alt: applyPattern(meta.altTextPattern),
    caption: applyPattern(meta.captionPattern),
    assetPath,
    assetExists: exists,
    schemaUsage: meta.schemaUsage,
    libraryRef,
    displayMode: exists ? "approved" : "placeholder",
    approvalStatus: exists ? "library" : "awaiting-upload",
    source: "library",
  };
}

function resolveUploadPath(doc: PharmacyImageAssignmentsDoc, uploadId: string): PharmacyImageUpload | undefined {
  return doc.uploads.find((u) => u.id === uploadId);
}

function resolveAiPath(doc: PharmacyImageAssignmentsDoc, aiRequestId: string): PharmacyAiImageRequest | undefined {
  return doc.aiRequests.find((r) => r.id === aiRequestId && r.status === "complete" && r.resultPath);
}

function isPublicationUnsafeImageAsset(assetPath: string): boolean {
  const normalized = String(assetPath || "")
    .trim()
    .replace(/^\/+/, "")
    .replace(/\\/g, "/");
  if (!normalized) return true;
  if (isLegacyDemonstrationAssetPath(normalized)) return true;
  // Quarantined Task-20 placeholders must never fill production slots.
  if (normalized.startsWith("assets/pharmacy-brand-safe/")) return true;
  if (normalized.includes("pharmacy-image-library/")) {
    const classification = classifyLibraryAssetFile(normalized);
    if (!isApprovedContentImage(classification)) return true;
  }
  if (/\.svg$/i.test(normalized)) {
    const full = path.join(WORKSPACE_ROOT, normalized);
    if (fs.existsSync(full)) {
      const svg = fs.readFileSync(full, "utf8");
      if (/Brook Pharmacy|Visual Experience demo asset|<text[\s>]/i.test(svg)) return true;
    }
  }
  return false;
}

function assignmentAssetAllowed(slot: ImageMatrixSlot, assetPath: string): boolean {
  return (
    Boolean(String(assetPath || "").trim()) &&
    !isAssetBlockedForVisualSlot(slot, assetPath) &&
    !isPublicationUnsafeImageAsset(assetPath)
  );
}

function resolveBrandSafeSlotFallback(
  slot: PharmacyImageSlot,
  renderCtx: PharmacyImageRenderContext,
): ResolvedPharmacyImage & { source: ImageSource } {
  const assetPath = `assets/pharmacy-brand-safe/slot-${slot}.svg`;
  const exists = assetExists(assetPath);
  return {
    imageKey: `brand-safe-${slot}`,
    imagePack: "pharmacy-brand-safe",
    slot,
    alt: sanitizePharmacyImageAltText(
      `${renderCtx.serviceName} at ${renderCtx.pharmacyName}${renderCtx.location ? ` in ${renderCtx.location}` : ""}`,
      renderCtx,
      slot,
    ),
    caption: renderCtx.serviceName,
    assetPath: exists ? assetPath : "",
    assetExists: exists,
    schemaUsage: "brand-safe-fallback",
    libraryRef: `brand-safe/${slot}`,
    displayMode: exists ? "approved" : "placeholder",
    approvalStatus: exists ? "brand-safe" : "missing",
    source: exists ? "library" : "missing",
  };
}

/**
 * Resolve image for a slot using priority: assignment → upload → AI → library fallback.
 */
export function resolvePharmacyImageForSlot(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  ctx?: Partial<PharmacyImageRenderContext & { campaignId?: string }>,
  options?: { assignmentOnly?: boolean },
): ResolvedPharmacyImage & { source: ImageSource } {
  const s = safeSlug(slug);
  const doc = loadImageAssignments(s);
  const profile = buildPharmacyServicePageProfile(s);
  const meta = getServicePublishMeta(serviceId);

  const renderCtx: PharmacyImageRenderContext = {
    slug: s,
    templateFamilyKey: ctx?.templateFamilyKey || "clinical-nhs-services",
    serviceKey: serviceId,
    serviceName: meta?.serviceName || serviceId,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    previewBasePath: "/assets",
    visualDemoMode: ctx?.visualDemoMode ?? false,
    previewMode: ctx?.previewMode ?? false,
    ...ctx,
  };

  const pageSlot = (["hero", "support", "trust", "conversion"].includes(slot) ? slot : "support") as PharmacyImageSlot;
  const assignment = getStoredAssignment(doc, serviceId, slot, ctx?.campaignId || serviceId, ctx?.pageSlug);

  if (assignment) {
    const sourceType = assignmentSourceType(assignment);
    if (sourceType === "upload" && assignment.uploadId) {
      const upload = resolveUploadPath(doc, assignment.uploadId);
      const registered = doc.uploads.some((u) => u.id === assignment.uploadId);
      if (upload && registered && assetExists(upload.path) && assignmentAssetAllowed(slot, upload.path)) {
        return {
          imageKey: upload.filename,
          imagePack: "pharmacy-upload",
          slot: pageSlot,
          alt: `${renderCtx.serviceName} at ${renderCtx.pharmacyName} in ${renderCtx.location}`,
          caption: upload.label || renderCtx.serviceName,
          assetPath: upload.path,
          assetExists: true,
          schemaUsage: "uploaded",
          libraryRef: `upload/${upload.id}`,
          displayMode: "approved",
          approvalStatus: "uploaded",
          source: "upload",
        };
      }
    }
    if (sourceType === "ai" && assignment.aiRequestId) {
      const ai = resolveAiPath(doc, assignment.aiRequestId);
      if (ai?.resultPath && assetExists(ai.resultPath) && assignmentAssetAllowed(slot, ai.resultPath)) {
        return {
          imageKey: ai.id,
          imagePack: "pharmacy-ai",
          slot: pageSlot,
          alt: `${renderCtx.serviceName} at ${renderCtx.pharmacyName}`,
          caption: renderCtx.serviceName,
          assetPath: ai.resultPath,
          assetExists: true,
          schemaUsage: "ai-generated",
          libraryRef: `ai/${ai.id}`,
          displayMode: "approved",
          approvalStatus: "ai-complete",
          source: "ai",
        };
      }
    }
    if (sourceType === "image-platform") {
      const assetPath = String(assignment.filePath || "").trim();
      const assetId = String((assignment as SlotAssignment & { assetId?: string }).assetId || "");
      const libraryRef = String(assignment.libraryRef || "");
      // Locked blueprint: non-PF services may use neutral shared PF-platform photography only
      // (same path as Leeds signed-off pages). Pathway-specific / editorial PF assets stay blocked.
      const looksLikePharmacyFirstPlatform =
        /\/services\/pharmacy-first\//i.test(assetPath) ||
        /\bpf-/i.test(libraryRef) ||
        /\bpf-/i.test(assetId);
      let crossServicePharmacyFirstBlocked = false;
      if (serviceId !== "pharmacy-first" && looksLikePharmacyFirstPlatform) {
        const pfApproved = listApprovedProductionAssets("pharmacy-first");
        const meta =
          pfApproved.find((a) => a.filePath === assetPath) ||
          pfApproved.find((a) => a.assetId && (a.assetId === assetId || libraryRef.includes(a.assetId)));
        crossServicePharmacyFirstBlocked = !(
          meta &&
          isNeutralSharedPlatformFallbackAsset(meta) &&
          SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS.has(meta.assetId)
        );
      }
      if (
        assignment.serviceId &&
        assignment.serviceId !== serviceId &&
        sourceType === "image-platform"
      ) {
        crossServicePharmacyFirstBlocked = true;
      }
      if (
        assetPath &&
        !crossServicePharmacyFirstBlocked &&
        assetExists(assetPath) &&
        !isLegacyDemonstrationAssetPath(assetPath) &&
        assignmentAssetAllowed(slot, assetPath)
      ) {
        const resolvedAssetId =
          assetId || path.basename(assetPath, path.extname(assetPath));
        const alt =
          assignment.altText ||
          sanitizePharmacyImageAltText(`${renderCtx.serviceName} at ${renderCtx.pharmacyName}`, renderCtx, pageSlot);
        return {
          imageKey: resolvedAssetId,
          imagePack: "pharmacy-image-platform",
          slot: pageSlot,
          alt,
          caption: renderCtx.serviceName,
          assetPath,
          assetExists: true,
          schemaUsage: "image-platform-assignment",
          libraryRef: assignment.libraryRef || `image-platform/${resolvedAssetId}`,
          displayMode: "approved",
          approvalStatus: "approved",
          source: "image-platform",
        };
      }
    }
    if (sourceType === "library") {
      const assetPath = String(assignment.filePath || "").trim();
      if (assetPath && assetExists(assetPath) && assignmentAssetAllowed(slot, assetPath)) {
        const [packKey, imageKey] = String(assignment.libraryRef || "").split("/");
        const alt =
          assignment.altText ||
          sanitizePharmacyImageAltText(`${renderCtx.serviceName} at ${renderCtx.pharmacyName}`, renderCtx, pageSlot);
        return {
          imageKey: imageKey || path.basename(assetPath, path.extname(assetPath)),
          imagePack: packKey || "pharmacy-image-library",
          slot: pageSlot,
          alt,
          caption: renderCtx.serviceName,
          assetPath,
          assetExists: true,
          schemaUsage: "library-assignment",
          libraryRef: assignment.libraryRef || assetPath,
          displayMode: "approved",
          approvalStatus: "library",
          source: "library",
        };
      }
      if (assignment.libraryRef) {
        const lib = resolveFromLibraryRef(assignment.libraryRef, renderCtx, pageSlot);
        if (lib?.assetPath && lib.assetExists && assignmentAssetAllowed(slot, lib.assetPath)) {
          return {
            ...lib,
            alt: assignment.altText || lib.alt,
            source: "library",
          };
        }
      }
    }
    if (sourceType === "website-import" && shouldUseWebsiteImportAssignment(assignment, slot)) {
      const assetPath = String(assignment.filePath || "").trim();
      if (assetPath && assetExists(assetPath) && assignmentAssetAllowed(slot, assetPath)) {
        return {
          imageKey: path.basename(assetPath),
          imagePack: "website-import",
          slot: pageSlot,
          alt: `${renderCtx.serviceName} at ${renderCtx.pharmacyName} in ${renderCtx.location}`,
          caption: renderCtx.serviceName,
          assetPath,
          assetExists: true,
          schemaUsage: "website-import",
          libraryRef: `website-import/${path.basename(assetPath)}`,
          displayMode: "approved",
          approvalStatus: "imported",
          source: "website-import",
        };
      }
    }
  }

  if (options?.assignmentOnly) {
    return {
      imageKey: slot,
      imagePack: "core-pharmacy",
      slot: pageSlot,
      alt: `${renderCtx.serviceName} image`,
      caption: renderCtx.serviceName,
      assetPath: "",
      assetExists: false,
      schemaUsage: "",
      libraryRef: "",
      displayMode: "placeholder",
      approvalStatus: "missing",
      source: "missing",
    };
  }

  // Auto-resolve upload matching service+slot category
  const autoUpload = doc.uploads.find(
    (u) => u.category === slot && assetExists(u.path) && u.filename.includes(serviceId.replace(/-/g, "")),
  );
  if (autoUpload && assignmentAssetAllowed(slot, autoUpload.path)) {
    return {
      imageKey: autoUpload.filename,
      imagePack: "pharmacy-upload",
      slot: pageSlot,
      alt: `${renderCtx.serviceName} at ${renderCtx.pharmacyName}`,
      caption: autoUpload.label || renderCtx.serviceName,
      assetPath: autoUpload.path,
      assetExists: true,
      schemaUsage: "uploaded",
      libraryRef: `upload/${autoUpload.id}`,
      displayMode: "approved",
      approvalStatus: "uploaded",
      source: "upload",
    };
  }

  // Auto-resolve complete AI for this service+slot
  const autoAi = doc.aiRequests.find(
    (r) => r.serviceId === serviceId && r.slot === slot && r.status === "complete" && r.resultPath && assetExists(r.resultPath),
  );
  if (autoAi?.resultPath && assignmentAssetAllowed(slot, autoAi.resultPath)) {
    return {
      imageKey: autoAi.id,
      imagePack: "pharmacy-ai",
      slot: pageSlot,
      alt: `${renderCtx.serviceName} at ${renderCtx.pharmacyName}`,
      caption: renderCtx.serviceName,
      assetPath: autoAi.resultPath,
      assetExists: true,
      schemaUsage: "ai-generated",
      libraryRef: `ai/${autoAi.id}`,
      displayMode: "approved",
      approvalStatus: "ai-complete",
      source: "ai",
    };
  }

  // Shared Image Platform (locked blueprint path):
  // 1) approved service-specific assets
  // 2) neutral shared photographic fallback via selectDeterministicProductionAsset
  if (PAGE_IMAGE_SLOTS.includes(slot as PageImageSlot) && isPharmacyFirstProductionLibraryReady()) {
    const platformAsset = selectDeterministicProductionAsset(
      {
        serviceId,
        pageType: "service",
        slot: pageSlot,
        editorialUse: null,
        minWidth: pageSlot === "hero" ? 1200 : 800,
        minHeight: pageSlot === "hero" ? 675 : 600,
      },
      `${ctx?.pageSlug || serviceId}:${serviceId}:${slot}`,
      new Set(),
    );
    if (
      platformAsset?.filePath &&
      assetExists(platformAsset.filePath) &&
      assignmentAssetAllowed(slot, platformAsset.filePath) &&
      (platformAsset.serviceId === serviceId ||
        (isNeutralSharedPlatformFallbackAsset(platformAsset) &&
          SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS.has(platformAsset.assetId)))
    ) {
      const alt =
        sanitizePharmacyImageAltText(
          `${platformAsset.defaultAltText || renderCtx.serviceName} — ${renderCtx.pharmacyName}, ${renderCtx.location}`,
          renderCtx,
          pageSlot,
        ) || `${renderCtx.serviceName} at ${renderCtx.pharmacyName}`;
      return {
        imageKey: platformAsset.assetId,
        imagePack: "pharmacy-image-platform",
        slot: pageSlot,
        alt,
        caption: renderCtx.serviceName,
        assetPath: platformAsset.filePath,
        assetExists: true,
        schemaUsage:
          platformAsset.serviceId === serviceId ? "image-platform-service" : "image-platform-shared-fallback",
        libraryRef: `image-platform/${platformAsset.assetId}`,
        displayMode: "approved",
        approvalStatus: "approved",
        source: "image-platform",
      };
    }
  }

  // Shared pharmacy image library — skip legacy SVG demonstration masters.
  if (["hero", "support", "trust", "conversion"].includes(slot)) {
    const lib = resolvePharmacySlotImage(pageSlot, renderCtx);
    if (
      lib.assetExists &&
      lib.assetPath &&
      !isLegacyDemonstrationAssetPath(lib.assetPath) &&
      assignmentAssetAllowed(slot, lib.assetPath)
    ) {
      return { ...lib, source: "library" };
    }
    const sharedRef = defaultLibraryRefForSlot(serviceId, slot);
    if (sharedRef) {
      const fromRef = resolveFromLibraryRef(sharedRef, renderCtx, pageSlot);
      if (
        fromRef?.assetExists &&
        fromRef.assetPath &&
        !isLegacyDemonstrationAssetPath(fromRef.assetPath) &&
        assignmentAssetAllowed(slot, fromRef.assetPath)
      ) {
        return { ...fromRef, source: "library" };
      }
    }
  }

  const ref = defaultLibraryRefForSlot(serviceId, slot);
  if (ref) {
    const lib = resolveFromLibraryRef(ref, renderCtx, pageSlot);
    if (
      lib?.assetExists &&
      lib.assetPath &&
      !isLegacyDemonstrationAssetPath(lib.assetPath) &&
      assignmentAssetAllowed(slot, lib.assetPath)
    ) {
      return { ...lib, source: "library" };
    }
  }

  // Final locked-platform guarantee for page slots (neutral shared photos only via selector).
  if (PAGE_IMAGE_SLOTS.includes(slot as PageImageSlot) && isPharmacyFirstProductionLibraryReady()) {
    const guarantee = selectDeterministicProductionAsset(
      {
        serviceId,
        pageType: "service",
        slot: pageSlot,
        editorialUse: null,
        minWidth: pageSlot === "hero" ? 1200 : 800,
        minHeight: pageSlot === "hero" ? 675 : 600,
      },
      `shared-guarantee:${serviceId}:${slot}`,
      new Set(),
    );
    if (
      guarantee?.filePath &&
      assetExists(guarantee.filePath) &&
      assignmentAssetAllowed(slot, guarantee.filePath) &&
      (guarantee.serviceId === serviceId ||
        (isNeutralSharedPlatformFallbackAsset(guarantee) &&
          SHARED_NEUTRAL_PLATFORM_FALLBACK_ASSET_IDS.has(guarantee.assetId)))
    ) {
      const alt =
        sanitizePharmacyImageAltText(
          `${guarantee.defaultAltText || renderCtx.serviceName} — ${renderCtx.pharmacyName}, ${renderCtx.location}`,
          renderCtx,
          pageSlot,
        ) || `${renderCtx.serviceName} at ${renderCtx.pharmacyName}`;
      return {
        imageKey: guarantee.assetId,
        imagePack: "pharmacy-image-platform",
        slot: pageSlot,
        alt,
        caption: renderCtx.serviceName,
        assetPath: guarantee.filePath,
        assetExists: true,
        schemaUsage: "image-platform-shared-guarantee",
        libraryRef: `image-platform/${guarantee.assetId}`,
        displayMode: "approved",
        approvalStatus: "approved",
        source: "image-platform",
      };
    }
  }

  return {
    imageKey: slot,
    imagePack: "core-pharmacy",
    slot: pageSlot,
    alt: `${renderCtx.serviceName} image`,
    caption: renderCtx.serviceName,
    assetPath: "",
    assetExists: false,
    schemaUsage: "",
    libraryRef: ref || "",
    displayMode: "placeholder",
    approvalStatus: "missing",
    source: "missing",
  };
}

export function clearSlotAssignment(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  campaignId?: string,
): boolean {
  const doc = loadImageAssignments(slug);
  const key = campaignId ? campaignSlotKey(campaignId, serviceId, slot) : slotKey(serviceId, slot);
  if (!doc.assignments[key]) return false;
  delete doc.assignments[key];
  saveImageAssignments(slug, doc);
  return true;
}

export function assignSlotImage(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  payload: {
    source: AssignmentSourceType;
    libraryRef?: string;
    uploadId?: string;
    aiRequestId?: string;
    campaignId?: string;
    altText?: string;
    title?: string;
  },
): SlotAssignment {
  const doc = loadImageAssignments(slug);
  const now = new Date().toISOString();
  const base: SlotAssignment = {
    serviceId,
    slot,
    source: payload.source,
    sourceType: payload.source,
    campaignId: payload.campaignId,
    assetType: slot as ImageCategory,
    libraryRef: payload.libraryRef,
    uploadId: payload.uploadId,
    aiRequestId: payload.aiRequestId,
    altText: payload.altText,
    title: payload.title,
    assignedAt: now,
    createdAt: now,
    updatedAt: now,
    status: payload.source === "ai" ? "pending" : "assigned",
  };
  const assignment = enrichAssignmentFields(base, doc, {
    serviceKey: serviceId,
    serviceName: getServicePublishMeta(serviceId)?.serviceName || serviceId,
    pharmacyName: buildPharmacyServicePageProfile(slug).pharmacyName,
    location: buildPharmacyServicePageProfile(slug).town,
    templateFamilyKey: templateFamilyForService(serviceId),
  });
  const key = payload.campaignId
    ? campaignSlotKey(payload.campaignId, serviceId, slot)
    : slotKey(serviceId, slot);
  doc.assignments[key] = assignment;
  saveImageAssignments(slug, doc);
  return assignment;
}

export function registerUpload(
  slug: string,
  file: { filename: string; path: string; category: ImageCategory; mimeType: string; label?: string },
): PharmacyImageUpload {
  const doc = loadImageAssignments(slug);
  const entry: PharmacyImageUpload = {
    id: randomUUID(),
    filename: file.filename,
    path: file.path.replace(/^\/+/, ""),
    category: file.category,
    mimeType: file.mimeType,
    uploadedAt: new Date().toISOString(),
    label: file.label,
  };
  doc.uploads.push(entry);
  saveImageAssignments(slug, doc);
  return entry;
}

export function buildAiImagePrompt(slug: string, serviceId: string, slot: ImageMatrixSlot, category: ImageCategory): string {
  const profile = buildPharmacyServicePageProfile(slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;
  const pagePurpose =
    slot === "hero"
      ? "hero banner establishing trust and service clarity"
      : slot === "support"
        ? "supporting clinical consultation imagery"
        : slot === "trust"
          ? "credentials and community trust section"
          : "conversion call-to-action section";
  return [
    `Professional pharmacy marketing photograph for ${serviceName}.`,
    `Slot: ${slot}. Category: ${category}.`,
    `Pharmacy: ${profile.pharmacyName}, ${profile.town}.`,
    `Page purpose: ${pagePurpose}.`,
    `Visual style: clean, trustworthy, NHS-aligned community pharmacy.`,
    `No text overlays. Suitable for UK pharmacy website ${slot} section.`,
  ].join(" ");
}

export function buildPageSlotCards(
  slug: string,
  serviceId: string,
  campaignId?: string,
): PageSlotCard[] {
  const doc = loadImageAssignments(slug);
  const meta = getServicePublishMeta(serviceId);
  const profile = buildPharmacyServicePageProfile(slug);
  const ctx: Partial<PharmacyImageRenderContext> = {
    slug,
    serviceKey: serviceId,
    serviceName: meta?.serviceName || serviceId,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    templateFamilyKey: templateFamilyForService(serviceId),
  };

  return PAGE_IMAGE_SLOTS.map((slot) => {
    const stored = getStoredAssignment(doc, serviceId, slot, campaignId);
    const resolved = resolvePharmacyImageForSlot(slug, serviceId, slot, { ...ctx, campaignId });
    const sourceType = stored ? assignmentSourceType(stored) : null;
    let status: PageSlotCard["status"] = resolved.assetExists ? "assigned" : "missing";
    if (stored?.status === "pending") status = "pending";
    if (stored && sourceType === "ai" && !resolved.assetExists) status = "pending";

    return {
      serviceId,
      slot,
      assigned: resolved.assetExists || status === "pending",
      sourceType: stored ? sourceType : resolved.assetExists ? (resolved.source === "assignment" ? "library" : resolved.source) : "missing",
      previewUrl: resolved.assetExists ? publicUrl(resolved.assetPath) : stored?.previewUrl || null,
      filePath: resolved.assetPath || stored?.filePath || null,
      libraryRef: stored?.libraryRef || resolved.libraryRef || null,
      uploadId: stored?.uploadId || null,
      aiRequestId: stored?.aiRequestId || null,
      status,
      altText: stored?.altText || resolved.alt,
      title: stored?.title || resolved.caption || meta?.serviceName || serviceId,
    };
  });
}

export function getImageSourceBreakdown(slug: string, serviceId: string, campaignId?: string): ImageSourceBreakdown {
  const cards = buildPageSlotCards(slug, serviceId, campaignId);
  const breakdown: ImageSourceBreakdown = {
    library: 0,
    upload: 0,
    ai: 0,
    pending: 0,
    missing: 0,
    missingSlots: [],
  };
  for (const card of cards) {
    if (card.status === "pending") {
      breakdown.pending++;
    } else if (!card.assigned || card.sourceType === "missing") {
      breakdown.missing++;
      breakdown.missingSlots.push(card.slot);
    } else if (card.sourceType === "library") breakdown.library++;
    else if (card.sourceType === "upload") breakdown.upload++;
    else if (card.sourceType === "ai") breakdown.ai++;
  }
  return breakdown;
}

export function createAiImageRequest(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  category: ImageCategory,
  prompt?: string,
  options?: { assignToSlot?: boolean; campaignId?: string },
): PharmacyAiImageRequest {
  const doc = loadImageAssignments(slug);
  const entry: PharmacyAiImageRequest = {
    id: randomUUID(),
    serviceId,
    slot,
    category,
    prompt: prompt || buildAiImagePrompt(slug, serviceId, slot, category),
    status: "pending",
    resultPath: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  doc.aiRequests.push(entry);
  saveImageAssignments(slug, doc);
  if (options?.assignToSlot !== false) {
    assignSlotImage(slug, serviceId, slot, {
      source: "ai",
      aiRequestId: entry.id,
      campaignId: options?.campaignId,
    });
  }
  return entry;
}

export function updateAiRequestStatus(
  slug: string,
  requestId: string,
  status: AiRequestStatus,
  resultPath?: string | null,
  error?: string,
): PharmacyAiImageRequest | null {
  const doc = loadImageAssignments(slug);
  const req = doc.aiRequests.find((r) => r.id === requestId);
  if (!req) return null;
  req.status = status;
  req.updatedAt = new Date().toISOString();
  if (resultPath !== undefined) req.resultPath = resultPath;
  if (error) req.error = error;
  saveImageAssignments(slug, doc);
  return req;
}

export function buildMatrixStatus(slug: string): MatrixCellStatus[] {
  const cells: MatrixCellStatus[] = [];
  for (const serviceId of BENCHMARK_MASTER_SERVICE_IDS) {
    const meta = getServicePublishMeta(serviceId);
    for (const slot of IMAGE_MATRIX_SLOTS) {
      const resolved = resolvePharmacyImageForSlot(slug, serviceId, slot);
      cells.push({
        serviceId,
        serviceName: meta?.serviceName || serviceId,
        slot,
        assigned: resolved.assetExists,
        source: resolved.source,
        previewUrl: resolved.assetExists ? publicUrl(resolved.assetPath) : null,
        assetPath: resolved.assetExists ? resolved.assetPath : null,
        libraryRef: resolved.libraryRef || null,
      });
    }
  }
  return cells;
}

export function buildImageOperatingSystemDashboard(
  slug: string,
  options?: { serviceId?: string; campaignId?: string },
): ImageOperatingSystemDashboard {
  const s = safeSlug(slug);
  const profile = buildPharmacyServicePageProfile(s);
  const doc = loadImageAssignments(s);
  const matrix = buildMatrixStatus(s);
  const libraryImages = listLibraryImages();
  const serviceCatalog = buildServiceCatalog();
  const selectedServiceId = resolveImageLibraryServiceId(options?.serviceId);
  const pageSlots = buildPageSlotCards(s, selectedServiceId, options?.campaignId);
  const sourceBreakdown = getImageSourceBreakdown(s, selectedServiceId, options?.campaignId);

  const assigned = matrix.filter((c) => c.assigned).length;
  const aiComplete = doc.aiRequests.filter((r) => r.status === "complete").length;

  return {
    slug: s,
    pharmacyName: profile.pharmacyName,
    brandPrimaryColor: profile.brandPrimaryColor,
    overview: {
      totalSlots: matrix.length,
      assigned,
      missing: matrix.length - assigned,
      uploadCount: doc.uploads.length,
      aiImageCount: aiComplete,
      libraryImageCount: libraryImages.filter((l) => l.assetExists).length,
      aiPendingCount: doc.aiRequests.filter((r) => r.status === "pending" || r.status === "processing").length,
    },
    matrix,
    pageSlots,
    sourceBreakdown,
    libraryImages,
    uploads: doc.uploads,
    aiRequests: doc.aiRequests,
    benchmarkServices: [...BENCHMARK_MASTER_SERVICE_IDS],
    serviceCatalog,
    matrixSlots: [...IMAGE_MATRIX_SLOTS],
    selectedServiceId,
    selectedCampaignId: options?.campaignId || null,
  };
}

/** Library fallbacks for visual benchmark pages — hero / support / trust / conversion. */
export const VISUAL_PAGE_LIBRARY_ASSIGNMENTS: Record<
  string,
  Record<"hero" | "support" | "trust" | "conversion", string>
> = {
  "pharmacy-first": {
    hero: "clinical-nhs-services/pharmacy-first",
    support: "core-pharmacy/pharmacist-consultation",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
  },
  "blood-pressure-checks": {
    hero: "clinical-nhs-services/blood-pressure-check",
    support: "core-pharmacy/pharmacist-consultation",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
  },
  "travel-vaccinations": {
    hero: "travel-health-services/travel-vaccination",
    support: "travel-health-services/travel-consultation",
    trust: "travel-health-services/destination-advice",
    conversion: "travel-health-services/malaria-advice",
  },
  "emergency-contraception": {
    hero: "clinical-nhs-services/contraception-service",
    support: "core-pharmacy/pharmacist-consultation",
    trust: "core-pharmacy/community-pharmacy",
    conversion: "core-pharmacy/prescription-collection",
  },
};

export interface VisualPageImageAuditRow {
  serviceId: string;
  slot: PharmacyImageSlot;
  source: ImageSource;
  assetPath: string;
  assetExists: boolean;
  libraryRef: string;
  alt: string;
}

export function auditVisualPageImageSlots(slug: string): VisualPageImageAuditRow[] {
  const rows: VisualPageImageAuditRow[] = [];
  for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
    const meta = getServicePublishMeta(serviceId);
    const profile = buildPharmacyServicePageProfile(slug);
    const ctx: PharmacyImageRenderContext = {
      slug,
      templateFamilyKey: "clinical-nhs-services",
      serviceKey: serviceId,
      serviceName: meta?.serviceName || serviceId,
      pharmacyName: profile.pharmacyName,
      location: profile.town,
      previewBasePath: "/assets",
      visualDemoMode: true,
      previewMode: false,
    };
    for (const slot of ["hero", "support", "trust", "conversion"] as const) {
      const resolved = resolvePharmacyImageForSlot(slug, serviceId, slot, ctx);
      rows.push({
        serviceId,
        slot,
        source: resolved.source,
        assetPath: resolved.assetPath,
        assetExists: resolved.assetExists,
        libraryRef: resolved.libraryRef,
        alt: resolved.alt,
      });
    }
  }
  return rows;
}

/** Seed library assignments for all visual benchmark page slots (16 total). */
export function seedVisualPageImageAssignments(slug: string, force = false): number {
  const doc = loadImageAssignments(slug);
  let seeded = 0;
  const now = new Date().toISOString();

  for (const serviceId of VISUAL_EXPERIENCE_BENCHMARK_SERVICES) {
    const slots = VISUAL_PAGE_LIBRARY_ASSIGNMENTS[serviceId];
    if (!slots) continue;
    for (const slot of ["hero", "support", "trust", "conversion"] as const) {
      const libraryRef = slots[slot];
      const key = slotKey(serviceId, slot);
      if (!force && doc.assignments[key]?.source === "library" && doc.assignments[key]?.libraryRef === libraryRef) {
        continue;
      }
      doc.assignments[key] = {
        serviceId,
        slot,
        source: "library",
        sourceType: "library",
        libraryRef,
        assignedAt: now,
        createdAt: now,
        updatedAt: now,
        status: "assigned",
        assetType: slot,
      };
      seeded++;
    }
  }

  if (seeded > 0) saveImageAssignments(slug, doc);
  return seeded;
}
