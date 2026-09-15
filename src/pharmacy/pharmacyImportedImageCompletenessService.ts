/**
 * Imported image completeness audit — captured vs assigned vs rendered.
 */
import fs from "node:fs";
import type { WebsiteDesignEvidence } from "./growthEngineWebsiteDesignEvidenceModel.ts";
import { loadImportedDesignAssets } from "./pharmacyWebsiteDesignAssetImporter.ts";
import { loadImageAssignments, type PharmacyImageAssignmentsDoc } from "./pharmacyImageOperatingSystem.ts";
import { loadWebsiteDesignEvidence } from "./pharmacyWebsiteDesignCaptureService.ts";

export const IMPORTED_IMAGE_MIN_COMPLETENESS = 95;

const RENDER_SLOTS = ["hero", "support", "trust", "conversion"] as const;

export interface ImportedImageAuditRow {
  slot: string;
  captured: boolean;
  stored: boolean;
  availableToRenderer: boolean;
  rendered: boolean;
  missing: boolean;
  placeholderUsed: boolean;
  source: string;
}

export interface ImportedImageCompleteness {
  importedImagesFound: number;
  importedImagesRendered: number;
  placeholderImagesRemaining: number;
  completeness: number;
  pass: boolean;
  rows: ImportedImageAuditRow[];
}

function str(v: unknown): string {
  return String(v ?? "").trim();
}

function assignmentForSlot(doc: PharmacyImageAssignmentsDoc, serviceId: string, slot: string) {
  return (
    doc.assignments[`${serviceId}:${serviceId}:${slot}`] ||
    doc.assignments[`${serviceId}::${serviceId}::${slot}`] ||
    Object.values(doc.assignments).find((a) => a.slot === slot && a.serviceId === serviceId)
  );
}

export function auditImportedImageCompleteness(
  slug: string,
  html: string,
  serviceId = "pharmacy-first",
): ImportedImageCompleteness {
  const assets = loadImportedDesignAssets(slug).filter((a) => a.importStatus === "imported" && a.classification !== "favicon");
  const evidence = loadWebsiteDesignEvidence(slug);
  const imageryCount = evidence?.imagery?.filter((i) => i.role !== "header").length || 0;
  const importedImagesFound = Math.max(assets.length, imageryCount);
  const assignments = loadImageAssignments(slug);

  const rows: ImportedImageAuditRow[] = RENDER_SLOTS.map((slot) => {
    const assignment = assignmentForSlot(assignments, serviceId, slot);
    const stored = Boolean(assignment?.filePath || assignment?.libraryRef);
    const available = stored && (assignment?.source === "website-import" || assignment?.sourceType === "website-import");
    const slotRegex = new RegExp(`data-image-slot="${slot}"[^>]*data-image-source="([^"]+)"`, "i");
    const slotMatch = html.match(slotRegex);
    const placeholderUsed = new RegExp(`data-image-slot="${slot}"[^>]*data-image-missing="true"`, "i").test(html);
    const rendered = Boolean(slotMatch && !placeholderUsed);
    const source = slotMatch?.[1] || assignment?.source || "missing";
    const captured = assets.length > 0 || imageryCount > 0;

    return {
      slot,
      captured,
      stored,
      availableToRenderer: available || stored,
      rendered,
      missing: !rendered && !placeholderUsed,
      placeholderUsed,
      source,
    };
  });

  const importedImagesRendered = rows.filter((r) => r.rendered && r.source === "website-import").length;
  const placeholderImagesRemaining = rows.filter((r) => r.placeholderUsed || r.source === "library").length;
  const requiredSlots = RENDER_SLOTS.length;
  const earned = rows.filter((r) => r.rendered && r.source === "website-import").length;
  const completeness = Math.round((earned / requiredSlots) * 100);
  const pass = completeness >= IMPORTED_IMAGE_MIN_COMPLETENESS && placeholderImagesRemaining === 0;

  return {
    importedImagesFound,
    importedImagesRendered,
    placeholderImagesRemaining,
    completeness,
    pass,
    rows,
  };
}

export function countImportedAssetsOnDisk(slug: string): number {
  const manifestPath = loadImportedDesignAssets(slug);
  return manifestPath.filter((a) => a.importStatus === "imported").length;
}

export function htmlContainsLibrarySlotImages(html: string): boolean {
  return /data-image-source="library"/.test(html);
}
