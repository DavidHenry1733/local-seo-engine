/**
 * Campaign Builder image plan — orchestrates existing Image Operating System for wizard flow.
 */
import fs from "node:fs";
import path from "node:path";

import {
  assignSlotImage,
  buildAiImagePrompt,
  createAiImageRequest,
  loadImageAssignments,
  listLibraryImagesFiltered,
  VISUAL_PAGE_LIBRARY_ASSIGNMENTS,
  type ImageMatrixSlot,
  type PageImageSlot,
  type PharmacyImageUpload,
} from "./pharmacyImageOperatingSystem.ts";
import type {
  CampaignBuilderImagePlan,
  CampaignBuilderImageSlotPlan,
  CampaignBuilderImageStrategy,
  CampaignBuilderSession,
  CampaignImageLocalMode,
} from "./growthEngineCampaignBuilderModel.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";

export const CAMPAIGN_WIZARD_REQUIRED_SLOTS: Array<{
  slot: CampaignBuilderImageSlotPlan["slot"];
  label: string;
  hint: string;
}> = [
  { slot: "hero", label: "Hero", hint: "Main Pharmacy First campaign banner" },
  { slot: "support", label: "Support / patient consultation", hint: "Consultation and patient support imagery" },
  { slot: "trust", label: "Trust / pharmacy team", hint: "Team, credentials and community trust" },
  { slot: "conversion", label: "Conversion / call to action", hint: "Booking or contact call-to-action visual" },
  { slot: "local", label: "Local page image", hint: "Shared image for local cluster pages (one image for all areas in V1)" },
];

const FORBIDDEN_IMAGE_PATTERNS = [
  /brook/i,
  /pharmacy-delivered/i,
  /dhmdigital/i,
  /rowlands/i,
  /validation\/test/i,
  /seo-trade/i,
  /trade-pack/i,
  /demo-asset/i,
];

const FORBIDDEN_TENANT_SLUGS = [
  "pharmacy-delivered-4u-test",
  "dhmdigital",
  "brook-pharmacy",
  "rowlands",
];

export function campaignImagePlanPath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-image-plan-${serviceId}.json`);
}

export function assertTenantSafeImagePath(tenantSlug: string, imagePath: string): void {
  const normalizedTenant = tenantSlug.toLowerCase();
  const lower = String(imagePath || "").toLowerCase();
  if (!lower) return;

  for (const pattern of FORBIDDEN_IMAGE_PATTERNS) {
    if (pattern.test(lower)) {
      throw new Error(`Image path blocked for tenant isolation: ${imagePath}`);
    }
  }

  for (const forbidden of FORBIDDEN_TENANT_SLUGS) {
    if (normalizedTenant !== forbidden && lower.includes(forbidden)) {
      throw new Error(`Image path references another tenant: ${forbidden}`);
    }
  }

  if (lower.includes("/pharmacy-uploads/") && !lower.includes(`/pharmacy-uploads/${normalizedTenant}/`)) {
    throw new Error(`Upload image must belong to tenant ${tenantSlug}`);
  }

  if (normalizedTenant !== "pharmaconnect" && lower.includes("/pharmaconnect/") && !lower.includes(`/${normalizedTenant}/`)) {
    throw new Error("Demo tenant image path is not allowed for this pharmacy");
  }
}

function assignmentKey(campaignId: string, serviceId: string, slot: string): string {
  return `${campaignId}:${serviceId}:${slot}`;
}

function resolveSlotAssignment(
  slug: string,
  serviceId: string,
  campaignId: string,
  slot: string,
): CampaignBuilderImageSlotPlan["sourceType"] {
  const doc = loadImageAssignments(slug);
  const stored = doc.assignments[assignmentKey(campaignId, serviceId, slot)] || doc.assignments[`${serviceId}:${slot}`];
  if (!stored) return "missing";
  const source = stored.sourceType || stored.source;
  if (source === "library") return stored.libraryRef?.includes("master-stock") ? "shared-stock" : "library";
  return source;
}

function readImageDimensions(filePath: string): string | null {
  if (!filePath || !fs.existsSync(path.join(WORKSPACE_ROOT, filePath.replace(/^\//, "")))) return null;
  return null;
}

function assetExists(relativePath: string): boolean {
  const normalized = relativePath.replace(/^\//, "");
  const full = path.join(WORKSPACE_ROOT, normalized);
  if (fs.existsSync(full)) return true;
  const base = normalized.replace(/\.(webp|jpg|jpeg|png|svg)$/i, "");
  for (const ext of [".webp", ".svg", ".jpg", ".jpeg", ".png"]) {
    if (fs.existsSync(path.join(WORKSPACE_ROOT, base + ext))) return true;
  }
  return false;
}

function slotHasCampaignAssignment(
  slug: string,
  serviceId: string,
  campaignId: string,
  slot: string,
): boolean {
  const doc = loadImageAssignments(slug);
  const stored =
    doc.assignments[assignmentKey(campaignId, serviceId, slot)] ||
    doc.assignments[`${serviceId}:${slot}`];
  if (!stored) return false;

  if (stored.filePath && assetExists(stored.filePath)) {
    try {
      assertTenantSafeImagePath(slug, stored.filePath);
      return true;
    } catch {
      return false;
    }
  }

  if (stored.uploadId) {
    const upload = doc.uploads.find((u) => u.id === stored.uploadId);
    if (upload && assetExists(upload.path)) {
      try {
        assertTenantSafeImagePath(slug, upload.path);
        return true;
      } catch {
        return false;
      }
    }
  }

  if (stored.libraryRef) {
    const match = listLibraryImagesFiltered({ serviceId, slot }).find((img) => img.libraryRef === stored.libraryRef);
    if (match?.assetExists) return true;
  }

  if (stored.aiRequestId) {
    const ai = doc.aiRequests.find((r) => r.id === stored.aiRequestId);
    if (ai?.status === "complete" && ai.resultPath && assetExists(ai.resultPath)) return true;
    if (stored.status === "pending" || ai?.status === "pending" || ai?.status === "processing") return true;
  }

  return false;
}

function pickTenantUploadForSlot(
  slug: string,
  uploads: PharmacyImageUpload[],
  slot: CampaignBuilderImageSlotPlan["slot"],
  usedUploadIds: Set<string>,
): PharmacyImageUpload | null {
  const safe = uploads.filter((upload) => {
    if (usedUploadIds.has(upload.id)) return false;
    if (!assetExists(upload.path)) return false;
    try {
      assertTenantSafeImagePath(slug, upload.path);
      return true;
    } catch {
      return false;
    }
  });

  const categoryMatches = safe.filter(
    (upload) =>
      upload.category === slot ||
      (slot === "local" && ["local", "support", "hero", "trust"].includes(upload.category)),
  );
  const pool = categoryMatches.length ? categoryMatches : safe;
  return pool[0] || null;
}

function resolveSharedLibraryRef(serviceId: string, slot: CampaignBuilderImageSlotPlan["slot"]): string | null {
  if (slot === "local") {
    return "core-pharmacy/community-pharmacy";
  }
  const mapped = VISUAL_PAGE_LIBRARY_ASSIGNMENTS[serviceId]?.[slot as "hero" | "support" | "trust" | "conversion"];
  if (mapped) {
    const exists = listLibraryImagesFiltered({ serviceId, slot }).some((img) => img.libraryRef === mapped && img.assetExists);
    if (exists) return mapped;
  }
  const filtered = listLibraryImagesFiltered({ serviceId, slot }).filter((img) => img.assetExists);
  return filtered[0]?.libraryRef || null;
}

export interface CampaignWizardDefaultAssignmentResult {
  assigned: number;
  skipped: number;
  deferred: CampaignBuilderImageSlotPlan["slot"][];
  sources: Partial<Record<CampaignBuilderImageSlotPlan["slot"], "upload" | "library" | "deferred">>;
}

/** Populate empty campaign wizard slots: tenant uploads → shared library → deferred (never leave empty). */
export function ensureCampaignWizardDefaultImageAssignments(
  slug: string,
  serviceId: string,
  campaignId: string = serviceId,
  options?: { skipDeferred?: boolean; respectExisting?: boolean },
): CampaignWizardDefaultAssignmentResult {
  const respectExisting = options?.respectExisting !== false;
  const doc = loadImageAssignments(slug);
  const usedUploadIds = new Set<string>();
  for (const stored of Object.values(doc.assignments)) {
    if (stored.campaignId === campaignId && stored.uploadId) usedUploadIds.add(stored.uploadId);
  }

  let assigned = 0;
  let skipped = 0;
  const deferred: CampaignBuilderImageSlotPlan["slot"][] = [];
  const sources: CampaignWizardDefaultAssignmentResult["sources"] = {};

  for (const slotDef of CAMPAIGN_WIZARD_REQUIRED_SLOTS) {
    const slot = slotDef.slot;
    const matrixSlot = (slot === "local" ? "local" : slot) as ImageMatrixSlot;

    if (respectExisting && slotHasCampaignAssignment(slug, serviceId, campaignId, slot)) {
      skipped += 1;
      continue;
    }

    const tenantUpload = pickTenantUploadForSlot(slug, doc.uploads, slot, usedUploadIds);
    if (tenantUpload) {
      assignSlotImage(slug, serviceId, matrixSlot, {
        source: "upload",
        uploadId: tenantUpload.id,
        campaignId,
        title: tenantUpload.label || tenantUpload.filename,
      });
      usedUploadIds.add(tenantUpload.id);
      assigned += 1;
      sources[slot] = "upload";
      continue;
    }

    const libraryRef = resolveSharedLibraryRef(serviceId, slot);
    if (libraryRef) {
      assignCampaignLibraryImage(slug, serviceId, matrixSlot, libraryRef, campaignId);
      assigned += 1;
      sources[slot] = "library";
      continue;
    }

    if (!options?.skipDeferred) {
      deferred.push(slot);
      sources[slot] = "deferred";
    }
  }

  return { assigned, skipped, deferred, sources };
}

export function buildCampaignImageLibrarySections(slug: string, serviceId: string, slot?: string) {
  const doc = loadImageAssignments(slug);
  const shared = listLibraryImagesFiltered({ serviceId, slot }).filter((img) => img.assetExists);
  const tenantUploads = doc.uploads.filter((upload) => {
    if (!assetExists(upload.path)) return false;
    try {
      assertTenantSafeImagePath(slug, upload.path);
      return true;
    } catch {
      return false;
    }
  });
  const aiImages = doc.aiRequests.filter((req) => req.status === "complete" && req.resultPath && assetExists(req.resultPath));
  return { tenantUploads, sharedLibrary: shared, aiImages };
}

function buildSlotPlan(
  slug: string,
  serviceId: string,
  campaignId: string,
  slotDef: (typeof CAMPAIGN_WIZARD_REQUIRED_SLOTS)[number],
  deferredSlots: Record<string, boolean>,
): CampaignBuilderImageSlotPlan {
  const doc = loadImageAssignments(slug);
  const slot = slotDef.slot;
  const matrixSlot = (slot === "local" ? "local" : slot) as ImageMatrixSlot;
  const stored =
    doc.assignments[assignmentKey(campaignId, serviceId, slot)] ||
    doc.assignments[`${serviceId}:${slot}`] ||
    (slot !== "local" ? doc.assignments[`${serviceId}:${slot as PageImageSlot}`] : undefined);

  let previewUrl: string | null = stored?.previewUrl || null;
  let filePath: string | null = stored?.filePath || null;
  let sourceType: CampaignBuilderImageSlotPlan["sourceType"] = "missing";
  let approvalState: CampaignBuilderImageSlotPlan["approvalState"] = "missing";
  let tenantStatus: CampaignBuilderImageSlotPlan["tenantStatus"] = "tenant";

  if (stored) {
    const source = stored.sourceType || stored.source;
    if (source === "library") {
      sourceType = stored.libraryRef?.includes("master-stock") ? "shared-stock" : "library";
      tenantStatus = sourceType === "shared-stock" ? "shared" : "tenant";
    } else if (source === "upload") {
      sourceType = "upload";
    } else if (source === "ai") {
      sourceType = "ai";
    }

    if (filePath) {
      try {
        assertTenantSafeImagePath(slug, filePath);
      } catch {
        tenantStatus = "invalid";
        approvalState = "missing";
        sourceType = "missing";
      }
    }

    if (stored.status === "pending") {
      approvalState = "pending";
    } else if (previewUrl || filePath) {
      approvalState = "approved";
    }
  }

  if (deferredSlots[slot]) {
    approvalState = "deferred";
  }

  const upload = stored?.uploadId ? doc.uploads.find((u) => u.id === stored.uploadId) : undefined;

  return {
    slot,
    label: slotDef.label,
    hint: slotDef.hint,
    previewUrl,
    filePath,
    sourceType,
    approvalState,
    tenantStatus,
    libraryRef: stored?.libraryRef || null,
    uploadId: stored?.uploadId || null,
    aiRequestId: stored?.aiRequestId || null,
    mimeType: upload?.mimeType || null,
    dimensions: readImageDimensions(filePath || ""),
    assignedAt: stored?.assignedAt || null,
    deferPublishingNote: Boolean(deferredSlots[slot]),
  };
}

export function buildCampaignBuilderImagePlan(
  slug: string,
  session: CampaignBuilderSession,
): CampaignBuilderImagePlan | null {
  const serviceId = session.selectedServiceId;
  if (!serviceId) return null;
  const campaignId = serviceId;
  const deferredSlots = session.imageDeferredSlots || {};

  const slots = CAMPAIGN_WIZARD_REQUIRED_SLOTS.map((slotDef) =>
    buildSlotPlan(slug, serviceId, campaignId, slotDef, deferredSlots),
  );

  return {
    campaignId,
    serviceId,
    strategy: session.imageStrategy || "mixed",
    localImageMode: session.localImageMode || "shared",
    slots,
    updatedAt: new Date().toISOString(),
    confirmedAt: session.imagePlanConfirmedAt,
  };
}

export function saveCampaignImagePlanSnapshot(slug: string, plan: CampaignBuilderImagePlan): string {
  const file = campaignImagePlanPath(slug, plan.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify({ version: 1, slug, ...plan }, null, 2));
  return file;
}

export function loadCampaignImagePlan(slug: string, serviceId: string): CampaignBuilderImagePlan | null {
  const file = campaignImagePlanPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as CampaignBuilderImagePlan & { slots?: CampaignBuilderImagePlan["slots"] };
    if (!Array.isArray(raw?.slots) || !raw.slots.length) return null;
    return raw;
  } catch {
    return null;
  }
}

/**
 * Review Centre Images preview: use the persisted campaign-image-plan snapshot when present,
 * otherwise read the same stored tenant/service image assignments the service page already uses.
 * Read-only. Does not save a snapshot, assign slots, request AI images, or mutate assignment records.
 */
export function resolveCampaignImagePlanForReview(slug: string, serviceId: string): CampaignBuilderImagePlan | null {
  const snapshot = loadCampaignImagePlan(slug, serviceId);
  if (snapshot) return snapshot;
  if (!serviceId) return null;
  const slots = CAMPAIGN_WIZARD_REQUIRED_SLOTS.map((slotDef) =>
    buildSlotPlan(slug, serviceId, serviceId, slotDef, {}),
  );
  if (!slots.some((slot) => slot.previewUrl || slot.filePath)) return null;
  const doc = loadImageAssignments(slug);
  return {
    campaignId: serviceId,
    serviceId,
    strategy: "existing",
    localImageMode: "shared",
    slots,
    updatedAt: doc.updatedAt,
    confirmedAt: null,
  };
}

export function listCampaignWizardLibraryImages(serviceId: string, slot: string) {
  return listLibraryImagesFiltered({ serviceId, slot }).filter((img) => img.assetExists);
}

export function previewCampaignAiPrompt(slug: string, serviceId: string, slot: ImageMatrixSlot): string {
  return buildAiImagePrompt(slug, serviceId, slot, slot === "local" ? "local" : slot);
}

export function requestCampaignAiImage(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  campaignId: string,
): ReturnType<typeof createAiImageRequest> {
  return createAiImageRequest(slug, serviceId, slot, slot === "local" ? "local" : slot, undefined, {
    assignToSlot: true,
    campaignId,
  });
}

export function assignCampaignLibraryImage(
  slug: string,
  serviceId: string,
  slot: ImageMatrixSlot,
  libraryRef: string,
  campaignId: string,
) {
  const filePath = libraryRef.includes("/") ? `assets/pharmacy-image-library/${libraryRef.split("/")[0]}/${libraryRef.split("/")[1]}.webp` : "";
  if (filePath) assertTenantSafeImagePath(slug, filePath);
  return assignSlotImage(slug, serviceId, slot, {
    source: "library",
    libraryRef,
    campaignId,
    title: getServicePublishMeta(serviceId)?.serviceName || serviceId,
  });
}

export function imagePlanSummaryLines(plan: CampaignBuilderImagePlan | null): string[] {
  if (!plan) return ["Image plan not configured"];
  return plan.slots.map((slot) => {
    const status =
      slot.approvalState === "deferred"
        ? "Deferred until publishing"
        : slot.approvalState === "approved"
          ? "Approved"
          : slot.approvalState === "pending"
            ? "Pending approval"
            : "Missing";
    return `${slot.label}: ${status} (${slot.sourceType})`;
  });
}
