/**
 * NT-E2E-31 — Generic Image Platform production assignment (tenant-agnostic).
 */
import crypto from "node:crypto";
import {
  loadImageAssignments,
  saveImageAssignments,
  type PharmacyImageAssignmentsDoc,
  type SlotAssignment,
} from "../pharmacyImageOperatingSystem.ts";
import { buildPharmacyServicePageProfile } from "../pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "../pharmacyMasterPublishConfig.ts";
import { sanitizePharmacyImageAltText } from "../templates/pharmacyImageLibrary.ts";
import type { ContentPageType } from "../pharmacyImageLibraryAssignmentService.ts";
import {
  buildProductionPageSlotInventory,
  mapSlotPageType,
  type ProductionImageSlotPlan,
} from "./pharmacyProductionImageSlotInventoryService.ts";
import {
  isPharmacyFirstProductionLibraryReady,
  isLegacyDemonstrationAssetPath,
  loadPharmacyFirstServiceManifestRevision,
  loadProductionLibraryRevision,
  selectDeterministicProductionAsset,
  type ProductionSlotCriteria,
} from "./pharmacyImagePlatformProductionResolver.ts";
import type { CanonicalEcosystemGenerationPlan } from "../masterAdminCanonicalEcosystemGenerationPlanService.ts";

export interface ProductionImageAssignmentContext {
  slug: string;
  serviceId: string;
  canonicalPlanId?: string | null;
  canonicalPlanChecksum?: string | null;
  authorisedGenerationJobId?: string | null;
  canonicalPlan?: CanonicalEcosystemGenerationPlan | null;
  platformManifestRevision?: string;
  persist?: boolean;
  /** CPR-01: assign images for the primary service page slots only. */
  assignmentScope?: "full" | "service-page-only";
}

function assignmentKey(pageSlug: string, serviceId: string, slot: string): string {
  return `${pageSlug}:${serviceId}:${slot}`;
}

function slotCriteria(plan: ProductionImageSlotPlan): ProductionSlotCriteria {
  const editorialUse =
    plan.role === "guide-editorial" || plan.role.includes("guide-editorial")
      ? ("guide" as const)
      : plan.role === "blog-editorial" || plan.role.includes("blog-editorial")
        ? ("blog" as const)
        : null;
  const minWidth = plan.slot === "hero" ? 1200 : 800;
  const minHeight = plan.slot === "hero" ? 675 : 600;
  const pageType = mapSlotPageType(plan.pageType, plan.role);
  return {
    serviceId: plan.serviceId,
    pageType: pageType as ProductionSlotCriteria["pageType"],
    slot: plan.slot as ProductionSlotCriteria["slot"],
    editorialUse,
    minWidth,
    minHeight,
  };
}

function buildAltText(plan: ProductionImageSlotPlan, slug: string, defaultAlt: string): string {
  const profile = buildPharmacyServicePageProfile(slug);
  const meta = getServicePublishMeta(plan.serviceId);
  const ctx = {
    serviceName: meta?.serviceName || plan.serviceId,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    serviceKey: plan.serviceId,
  };
  const merged = `${defaultAlt} — ${ctx.pharmacyName}, ${ctx.location}`;
  return sanitizePharmacyImageAltText(merged, ctx, plan.slot);
}

function isStaleCampaignLibraryAssignment(key: string, assignment: SlotAssignment): boolean {
  if (!key.match(/^[^:]+:[^:]+:(hero|support|trust|conversion|local)$/)) return false;
  if (assignment.sourceType === "image-platform" || assignment.sourceType === "upload") return false;
  const fp = String(assignment.filePath || "");
  return assignment.sourceType === "library" || isLegacyDemonstrationAssetPath(fp);
}

function purgeStaleCampaignLibraryAssignments(doc: PharmacyImageAssignmentsDoc, serviceId: string): void {
  for (const [key, assignment] of Object.entries(doc.assignments)) {
    if (key.startsWith(`${serviceId}:${serviceId}:`) && isStaleCampaignLibraryAssignment(key, assignment)) {
      delete doc.assignments[key];
    }
  }
}

export function computeProductionAssignmentRevision(
  doc: PharmacyImageAssignmentsDoc,
  slotPlans: ProductionImageSlotPlan[],
): string {
  const lines = slotPlans
    .map((p) => {
      const a = doc.assignments[assignmentKey(p.pageSlug, p.serviceId, p.slot)] as SlotAssignment & {
        assetId?: string;
      };
      return a ? `${p.pageSlug}:${p.slot}:${a.assetId}:${a.filePath}` : `${p.pageSlug}:${p.slot}:missing`;
    })
    .join("\n");
  return crypto.createHash("sha256").update(lines).digest("hex").slice(0, 16);
}

export function rebuildPharmacyProductionImageAssignments(
  context: ProductionImageAssignmentContext,
): {
  revision: string;
  platformRevision: string;
  serviceManifestRevision: string;
  assignments: Record<string, unknown>;
  blocked: string[];
  slotCount: number;
} {
  const { slug, serviceId, persist = true } = context;
  if (serviceId === "pharmacy-first" && !isPharmacyFirstProductionLibraryReady()) {
    throw new Error("Pharmacy First production image library is not READY — cannot rebuild assignments");
  }

  let slotPlans = buildProductionPageSlotInventory(slug, serviceId, context.canonicalPlan);
  if (context.assignmentScope === "service-page-only") {
    slotPlans = slotPlans.filter((p) => p.pageSlug === serviceId && p.pageType === "service");
  }
  const platformRevision = context.platformManifestRevision || loadProductionLibraryRevision();
  const serviceManifestRevision = loadPharmacyFirstServiceManifestRevision();
  const doc = loadImageAssignments(slug);
  const now = new Date().toISOString();
  const usedAssetIds = new Set<string>();
  const blocked: string[] = [];
  const assignmentRecords: Record<string, unknown> = {};

  purgeStaleCampaignLibraryAssignments(doc, serviceId);

  for (const plan of slotPlans) {
    const key = assignmentKey(plan.pageSlug, plan.serviceId, plan.slot);
    const criteria = slotCriteria(plan);
    const asset = selectDeterministicProductionAsset(criteria, key, usedAssetIds);
    if (!asset) {
      blocked.push(key);
      continue;
    }
    usedAssetIds.add(asset.assetId);

    const assignment: SlotAssignment & {
      pageSlug: string;
      role: string;
      assetId: string;
      platformRevision: string;
      serviceManifestRevision: string;
      assignmentReason: string;
      fallbackAttempts: number;
      canonicalPlanId?: string;
      canonicalPlanChecksum?: string;
      authorisedGenerationJobId?: string;
    } = {
      serviceId: plan.serviceId,
      slot: plan.slot,
      source: "image-platform",
      sourceType: "image-platform",
      filePath: asset.filePath,
      previewUrl: `/${asset.filePath.replace(/^\/+/, "")}`,
      libraryRef: `image-platform/${asset.assetId}`,
      altText: buildAltText(plan, slug, asset.defaultAltText),
      title: plan.role,
      status: "assigned",
      assignedAt: now,
      createdAt: doc.assignments[key]?.createdAt || now,
      updatedAt: now,
      pageSlug: plan.pageSlug,
      role: plan.role,
      assetId: asset.assetId,
      platformRevision,
      serviceManifestRevision,
      assignmentReason:
        asset.serviceId === plan.serviceId
          ? `image-platform-v1.2:deterministic:${plan.pageType}:${plan.role}:${asset.assetId}`
          : `image-platform-v1.2:platform-fallback:${plan.serviceId}:${plan.pageType}:${plan.role}:${asset.assetId}`,
      fallbackAttempts: asset.serviceId === plan.serviceId ? 0 : 1,
      canonicalPlanId: context.canonicalPlanId || undefined,
      canonicalPlanChecksum: context.canonicalPlanChecksum || undefined,
      authorisedGenerationJobId: context.authorisedGenerationJobId || undefined,
    };
    doc.assignments[key] = assignment;
    assignmentRecords[key] = {
      pageType: plan.pageType,
      pageSlug: plan.pageSlug,
      slot: plan.slot,
      assetId: asset.assetId,
      filePath: asset.filePath,
      reason: assignment.assignmentReason,
    };
  }

  if (blocked.length) {
    throw new Error(`Production assignment blocked for ${slug}: ${blocked.join(", ")}`);
  }

  const revision = computeProductionAssignmentRevision(doc, slotPlans);
  if (persist !== false) {
    doc.updatedAt = now;
    saveImageAssignments(slug, doc);
  }

  return {
    revision,
    platformRevision,
    serviceManifestRevision,
    assignments: assignmentRecords,
    blocked,
    slotCount: slotPlans.length,
  };
}

/** Alias requested by NT-E2E-31 spec. */
export const rebuildTenantProductionImageAssignments = rebuildPharmacyProductionImageAssignments;

export function previewPharmacyProductionImageAssignments(
  slug: string,
  serviceId = "pharmacy-first",
): Record<string, string> {
  const result = rebuildPharmacyProductionImageAssignments({ slug, serviceId, persist: false });
  const assetByKey: Record<string, string> = {};
  for (const [key, val] of Object.entries(result.assignments)) {
    assetByKey[key] = (val as { assetId: string }).assetId;
  }
  return assetByKey;
}
