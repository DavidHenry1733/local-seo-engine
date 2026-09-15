/**
 * RC1-IMG1 — Deterministic PharmaConnect image-library assignments (content slots).
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
  loadImageAssignments,
  saveImageAssignments,
  resolvePharmacyImageForSlot,
  type PharmacyImageAssignmentsDoc,
  type SlotAssignment,
} from "./pharmacyImageOperatingSystem.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  loadPharmacyImageLibrary,
  resolveLibraryAssetPath,
  sanitizePharmacyImageAltText,
  type PharmacyImageSlot,
} from "./templates/pharmacyImageLibrary.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  classifyLibraryAssetFile,
  isApprovedContentImage,
  placeholderReason,
} from "./pharmacyImageLibraryContentAssetClassifier.ts";

const LIBRARY_PATH = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-blueprint/pharmacy-image-library.json");

export type ContentPageType = "homepage" | "service" | "guide" | "blog";

export interface ContentPageSlotPlan {
  pageSlug: string;
  pageType: ContentPageType;
  serviceId: string;
  slot: PharmacyImageSlot;
  libraryRef: string;
  role: string;
}

export const RC1_IMG1_PAGE_SLOT_PLANS: ContentPageSlotPlan[] = [
  { pageSlug: "index", pageType: "homepage", serviceId: "pharmacy-first", slot: "hero", libraryRef: "clinical-nhs-services/pharmacy-first", role: "homepage-hero" },
  { pageSlug: "index", pageType: "homepage", serviceId: "pharmacy-first", slot: "support", libraryRef: "clinical-nhs-services/contraception-service", role: "homepage-supporting" },
  { pageSlug: "index", pageType: "homepage", serviceId: "pharmacy-first", slot: "trust", libraryRef: "core-pharmacy/community-pharmacy", role: "homepage-trust" },
  { pageSlug: "index", pageType: "homepage", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "core-pharmacy/prescription-collection", role: "homepage-conversion" },

  { pageSlug: "pharmacy-first", pageType: "service", serviceId: "pharmacy-first", slot: "hero", libraryRef: "clinical-nhs-services/pharmacy-first-consultation", role: "service-hero" },
  { pageSlug: "pharmacy-first", pageType: "service", serviceId: "pharmacy-first", slot: "support", libraryRef: "clinical-nhs-services/blood-pressure-check", role: "service-supporting" },
  { pageSlug: "pharmacy-first", pageType: "service", serviceId: "pharmacy-first", slot: "trust", libraryRef: "core-pharmacy/pharmacist-consultation", role: "service-trust" },
  { pageSlug: "pharmacy-first", pageType: "service", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "core-pharmacy/prescription-collection", role: "service-conversion" },

  { pageSlug: "pharmacy-first-guide", pageType: "guide", serviceId: "pharmacy-first", slot: "hero", libraryRef: "clinical-nhs-services/pharmacy-first", role: "guide-hero" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", serviceId: "pharmacy-first", slot: "support", libraryRef: "clinical-nhs-services/contraception-service", role: "guide-editorial" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "core-pharmacy/pharmacist-consultation", role: "guide-cta" },

  { pageSlug: "what-is-pharmacy-first", pageType: "blog", serviceId: "pharmacy-first", slot: "hero", libraryRef: "clinical-nhs-services/blood-pressure-check", role: "blog-hero" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", serviceId: "pharmacy-first", slot: "support", libraryRef: "core-pharmacy/community-pharmacy", role: "blog-editorial" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", serviceId: "pharmacy-first", slot: "conversion", libraryRef: "core-pharmacy/prescription-collection", role: "blog-cta" },
];

const CONSULTATION_OVERRIDE = "assets/pharmacy-image-library/clinical-nhs-services/pharmacy-first-consultation.webp";

export function computeImageLibraryRevision(): string {
  if (!fs.existsSync(LIBRARY_PATH)) return "missing";
  return crypto.createHash("sha256").update(fs.readFileSync(LIBRARY_PATH)).digest("hex").slice(0, 16);
}

function assignmentKey(pageSlug: string, serviceId: string, slot: string): string {
  return `${pageSlug}:${serviceId}:${slot}`;
}

function resolveLibraryFilePath(libraryRef: string): string | null {
  if (libraryRef === "clinical-nhs-services/pharmacy-first-consultation") {
    return fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, CONSULTATION_OVERRIDE))
      ? CONSULTATION_OVERRIDE
      : null;
  }
  const library = loadPharmacyImageLibrary();
  const [packKey, imageKey] = libraryRef.split("/");
  const pack = library.imagePacks[packKey];
  const meta = pack?.images.find((img) => img.imageKey === imageKey);
  if (!meta?.assetPath) return null;
  const resolved = resolveLibraryAssetPath(meta.assetPath);
  const full = path.join(PHARMACY_WORKSPACE_ROOT, resolved);
  return fs.existsSync(full) ? resolved : null;
}

function buildAltText(plan: ContentPageSlotPlan, slug: string): string {
  const profile = buildPharmacyServicePageProfile(slug);
  const meta = getServicePublishMeta(plan.serviceId);
  const serviceName = meta?.serviceName || plan.serviceId;
  const ctx = {
    serviceName,
    pharmacyName: profile.pharmacyName,
    location: profile.town,
    serviceKey: plan.serviceId,
  };
  const pagePurpose =
    plan.pageType === "guide"
      ? "patient guide"
      : plan.pageType === "blog"
        ? "information article"
        : plan.pageType === "homepage"
          ? "pharmacy homepage"
          : "service page";
  const subject =
    plan.role.includes("hero")
      ? "pharmacist consultation"
      : plan.role.includes("editorial") || plan.role.includes("supporting")
        ? "pharmacy care"
        : plan.role.includes("trust")
          ? "trusted pharmacy team"
          : "booking and next steps";
  return sanitizePharmacyImageAltText(
    `${serviceName} ${subject} — ${pagePurpose} at ${profile.pharmacyName} in ${profile.town}`,
    ctx,
    plan.slot,
  );
}

export function rebuildTenantLibraryContentImageAssignments(
  slug: string,
  serviceId = "pharmacy-first",
): {
  updated: boolean;
  revision: string;
  assignments: string[];
  blocked: string[];
} {
  const revision = computeImageLibraryRevision();
  const doc = loadImageAssignments(slug);
  const now = new Date().toISOString();
  const updated: string[] = [];
  const blocked: string[] = [];

  for (const plan of RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId)) {
    const filePath = resolveLibraryFilePath(plan.libraryRef);
    if (!filePath) {
      blocked.push(`${plan.pageSlug}:${plan.slot}:missing-file`);
      continue;
    }
    const classification = classifyLibraryAssetFile(filePath);
    if (!isApprovedContentImage(classification)) {
      blocked.push(`${plan.pageSlug}:${plan.slot}:${placeholderReason(classification, filePath)}`);
      continue;
    }
    const key = assignmentKey(plan.pageSlug, plan.serviceId, plan.slot);
    const altText = buildAltText(plan, slug);
    const assignment: SlotAssignment & {
      pageSlug: string;
      role: string;
      imageLibraryRevision: string;
      assignmentReason: string;
      assetId: string;
    } = {
      serviceId: plan.serviceId,
      slot: plan.slot,
      source: "library",
      sourceType: "library",
      libraryRef: plan.libraryRef,
      filePath,
      previewUrl: `/${filePath.replace(/^\/+/, "")}`,
      altText,
      title: plan.role,
      status: "assigned",
      assignedAt: now,
      createdAt: doc.assignments[key]?.createdAt || now,
      updatedAt: now,
      pageSlug: plan.pageSlug,
      role: plan.role,
      imageLibraryRevision: revision,
      assignmentReason: `rc1-img1-library-primary:${plan.pageType}:${plan.role}`,
      assetId: `${plan.libraryRef}@${revision}`,
    };
    doc.assignments[key] = assignment;
    updated.push(key);
  }

  if (blocked.length) {
    throw new Error(
      `Image library cannot supply required content slots for ${slug}: ${blocked.join(", ")}`,
    );
  }

  doc.updatedAt = now;
  saveImageAssignments(slug, doc);
  return { updated: updated.length > 0, revision, assignments: updated, blocked };
}

export function tracePageImageSlots(slug: string, serviceId = "pharmacy-first"): unknown[] {
  const doc = loadImageAssignments(slug);
  const traces: unknown[] = [];
  for (const plan of RC1_IMG1_PAGE_SLOT_PLANS.filter((p) => p.serviceId === serviceId)) {
    const resolved = resolvePharmacyImageForSlot(slug, plan.serviceId, plan.slot, {
      slug,
      serviceKey: plan.serviceId,
      pageSlug: plan.pageSlug,
      campaignId: plan.serviceId,
      serviceName: getServicePublishMeta(plan.serviceId)?.serviceName || plan.serviceId,
      pharmacyName: buildPharmacyServicePageProfile(slug).pharmacyName,
      location: buildPharmacyServicePageProfile(slug).town,
      templateFamilyKey: "clinical-nhs-services",
      previewBasePath: "/assets",
      visualDemoMode: true,
      previewMode: false,
    });
    const stored = doc.assignments[assignmentKey(plan.pageSlug, plan.serviceId, plan.slot)];
    traces.push({
      pageType: plan.pageType,
      pageSlug: plan.pageSlug,
      slotId: plan.slot,
      intendedRole: plan.role,
      currentSelectedAsset: resolved.assetPath,
      assetSource: resolved.source,
      assetLibrary: resolved.imagePack,
      localPath: resolved.assetPath,
      renderedUrl: resolved.assetPath ? `/${resolved.assetPath.replace(/^\/+/, "")}` : "",
      selectionFunction: "resolvePharmacyImageForSlot",
      selectionReason: (stored as { assignmentReason?: string })?.assignmentReason || "assignment-doc",
      fallbackReason: resolved.source === "missing" ? "no-approved-source" : "",
      duplicateStatus: "pending-validation",
      storedAssignment: stored,
    });
  }
  return traces;
}

export function loadAssignmentsDoc(slug: string): PharmacyImageAssignmentsDoc {
  return loadImageAssignments(slug);
}
