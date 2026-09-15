/**
 * Seed image assignments from imported website design assets.
 */
import path from "node:path";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadImportedDesignAssets } from "./pharmacyWebsiteDesignAssetImporter.ts";
import {
  loadImageAssignments,
  saveImageAssignments,
  type PharmacyImageAssignmentsDoc,
  type SlotAssignment,
} from "./pharmacyImageOperatingSystem.ts";
import { isPhotographicContentImageAsset } from "./pharmacyBusinessFieldSanitizer.ts";

function str(v: unknown): string {
  return String(v ?? "").trim();
}

type PageSlotPlan = {
  pageId: string;
  serviceId: string;
  slots: Array<"hero" | "support" | "trust" | "conversion">;
};

const DEFAULT_PAGE_PLANS: PageSlotPlan[] = [
  { pageId: "pharmacy-first", serviceId: "pharmacy-first", slots: ["hero", "support", "trust", "conversion"] },
  { pageId: "pharmacy-first-guide", serviceId: "pharmacy-first", slots: ["hero", "support", "conversion"] },
  { pageId: "what-is-pharmacy-first", serviceId: "pharmacy-first", slots: ["hero", "support", "conversion"] },
];

function usableAssets(slug: string) {
  return loadImportedDesignAssets(slug).filter(
    (a) =>
      a.importStatus === "imported" &&
      a.classification !== "favicon" &&
      a.classification !== "logo" &&
      a.classification !== "icon" &&
      a.classification !== "social" &&
      a.classification !== "decorative" &&
      isPhotographicContentImageAsset(a.localPath, a.originalUrl) &&
      !/googleusercontent|gmblogo|review|avatar/i.test(a.originalUrl || ""),
  );
}

function assignSlot(
  doc: PharmacyImageAssignmentsDoc,
  pageId: string,
  serviceId: string,
  slot: "hero" | "support" | "trust" | "conversion",
  assetPath: string,
  now: string,
) {
  const key = `${pageId}:${serviceId}:${slot}`;
  doc.assignments[key] = {
    serviceId,
    slot,
    source: "website-import",
    sourceType: "website-import",
    filePath: assetPath.replace(/^\/+/, ""),
    libraryRef: `website-import/${path.basename(assetPath)}`,
    altText: `${pageId} ${slot} image`,
    title: slot,
    assignedAt: now,
    createdAt: doc.assignments[key]?.createdAt || now,
    updatedAt: now,
    status: "assigned",
  };
}

export function rebuildTenantImageAssignmentsFromImport(
  slug: string,
  pagePlans: PageSlotPlan[] = DEFAULT_PAGE_PLANS,
): { updated: boolean; assignments: string[]; reasons: Record<string, string> } {
  const assets = usableAssets(slug);
  const doc = loadImageAssignments(slug);
  const now = new Date().toISOString();
  const updatedSlots: string[] = [];
  const reasons: Record<string, string> = {};
  let assetIndex = 0;

  const nextAsset = () => {
    if (!assets.length) return null;
    const asset = assets[assetIndex % assets.length];
    assetIndex += 1;
    return asset.localPath;
  };

  for (const plan of pagePlans) {
    for (const slot of plan.slots) {
      const assetPath = nextAsset();
      if (!assetPath) continue;
      assignSlot(doc, plan.pageId, plan.serviceId, slot, assetPath, now);
      updatedSlots.push(`${plan.pageId}:${slot}`);
      reasons[`${plan.pageId}:${slot}`] = assetPath;
    }
  }

  if (!updatedSlots.length) return { updated: false, assignments: [], reasons: {} };
  saveImageAssignments(slug, doc);
  return { updated: true, assignments: updatedSlots, reasons };
}

export function seedImageAssignmentsFromDesignImport(
  slug: string,
  _evidence: WebsiteDesignEvidence,
  serviceId = "pharmacy-first",
): { updated: boolean; assignments: string[] } {
  const result = rebuildTenantImageAssignmentsFromImport(slug, [
    { pageId: serviceId, serviceId, slots: ["hero", "support", "trust", "conversion"] },
  ]);
  return { updated: result.updated, assignments: result.assignments };
}

/** Re-seed website-import slot assignments from on-disk assets (no re-import). */
export function refreshWebsiteImportImageAssignments(slug: string, serviceId = "pharmacy-first"): { updated: boolean; assignments: string[] } {
  return seedImageAssignmentsFromDesignImport(slug, {} as WebsiteDesignEvidence, serviceId);
}

export function readImageAssignmentsDoc(slug: string): PharmacyImageAssignmentsDoc {
  return loadImageAssignments(slug);
}

export function imageAssignmentsExist(slug: string): boolean {
  const doc = loadImageAssignments(slug);
  return Object.keys(doc.assignments).length > 0;
}
