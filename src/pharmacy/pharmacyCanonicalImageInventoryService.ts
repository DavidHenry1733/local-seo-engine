/**
 * NT-E2E-31 — Persisted canonical image inventory (one record per page-slot assignment).
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { loadImageAssignments, type SlotAssignment } from "./pharmacyImageOperatingSystem.ts";
import {
  buildProductionPageSlotInventory,
  type ProductionImageSlotPlan,
} from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import {
  isLegacyDemonstrationAssetPath,
  loadProductionLibraryRevision,
} from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import type { CanonicalEcosystemGenerationPlan } from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export interface CanonicalImageInventoryRecord {
  imageInventoryId: string;
  slug: string;
  serviceId: string;
  canonicalPageInventoryId: string | null;
  pageSlug: string;
  pageType: string;
  slot: string;
  role: string;
  orientation: "landscape";
  requiredDimensions: string;
  approvedAssetId: string | null;
  sourceType: string | null;
  filePath: string | null;
  altText: string | null;
  assignmentStatus: "assigned" | "missing" | "failed";
  manifestRevision: string | null;
  assignedAt: string | null;
  checksum: string | null;
}

export interface CanonicalImageInventorySummary {
  version: 1;
  slug: string;
  serviceId: string;
  generatedAt: string;
  manifestRevision: string;
  /** A. Unique approved assets selected across all slots */
  uniqueApprovedAssets: string[];
  /** B. Page-slot assignment records */
  pageSlotAssignments: CanonicalImageInventoryRecord[];
  /** Counts for reconciliation */
  counts: {
    uniqueApprovedAssets: number;
    pageSlotAssignments: number;
    assigned: number;
    missing: number;
  };
}

function inventoryPath(slug: string): string {
  const dir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-canonical-image-inventory");
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, `${slug}.json`);
}

function assignmentKey(pageSlug: string, serviceId: string, slot: string): string {
  return `${pageSlug}:${serviceId}:${slot}`;
}

function fileChecksum(filePath: string): string | null {
  const full = path.join(PHARMACY_WORKSPACE_ROOT, filePath.replace(/^\/+/, ""));
  if (!fs.existsSync(full)) return null;
  return crypto.createHash("sha256").update(fs.readFileSync(full)).digest("hex").slice(0, 16);
}

function resolvePageInventoryId(
  plan: CanonicalEcosystemGenerationPlan | null | undefined,
  pageSlug: string,
): string | null {
  if (!plan) return null;
  const match = plan.pageInventory.find((p) => p.slug === pageSlug || `local-cluster-${p.slug.replace(/^cluster-/, "")}` === pageSlug);
  return match?.inventoryId || null;
}

export function buildCanonicalImageInventory(
  slug: string,
  serviceId: string,
  plan?: CanonicalEcosystemGenerationPlan | null,
): CanonicalImageInventorySummary {
  const slotPlans = buildProductionPageSlotInventory(slug, serviceId, plan);
  const doc = loadImageAssignments(slug);
  const manifestRevision = loadProductionLibraryRevision();
  const records: CanonicalImageInventoryRecord[] = [];
  const uniqueAssets = new Set<string>();

  for (const slot of slotPlans) {
    const key = assignmentKey(slot.pageSlug, slot.serviceId, slot.slot);
    const a = doc.assignments[key] as SlotAssignment & {
      assetId?: string;
      role?: string;
      platformRevision?: string;
      assignedAt?: string;
    };
    const assigned = Boolean(a?.filePath && a.sourceType === "image-platform");
    if (assigned && a.assetId) uniqueAssets.add(a.assetId);
    records.push({
      imageInventoryId: `img:${slot.pageSlug}:${slot.slot}`,
      slug,
      serviceId,
      canonicalPageInventoryId: resolvePageInventoryId(plan, slot.pageSlug),
      pageSlug: slot.pageSlug,
      pageType: slot.pageType,
      slot: slot.slot,
      role: a?.role || slot.role,
      orientation: "landscape",
      requiredDimensions: slot.slot === "hero" ? "1200x675" : "800x600",
      approvedAssetId: a?.assetId || null,
      sourceType: a?.sourceType || null,
      filePath: a?.filePath || null,
      altText: a?.altText || null,
      assignmentStatus: assigned ? "assigned" : a ? "failed" : "missing",
      manifestRevision: a?.platformRevision || manifestRevision,
      assignedAt: a?.assignedAt || null,
      checksum: a?.filePath ? fileChecksum(a.filePath) : null,
    });
  }

  return {
    version: 1,
    slug,
    serviceId,
    generatedAt: new Date().toISOString(),
    manifestRevision,
    uniqueApprovedAssets: [...uniqueAssets].sort(),
    pageSlotAssignments: records,
    counts: {
      uniqueApprovedAssets: uniqueAssets.size,
      pageSlotAssignments: records.length,
      assigned: records.filter((r) => r.assignmentStatus === "assigned").length,
      missing: records.filter((r) => r.assignmentStatus !== "assigned").length,
    },
  };
}

export function persistCanonicalImageInventory(
  slug: string,
  serviceId: string,
  plan?: CanonicalEcosystemGenerationPlan | null,
): CanonicalImageInventorySummary {
  const inventory = buildCanonicalImageInventory(slug, serviceId, plan);
  writeJsonAtomic(inventoryPath(slug), inventory);
  return inventory;
}

export function readCanonicalImageInventory(slug: string): CanonicalImageInventorySummary | null {
  const file = inventoryPath(slug);
  if (!fs.existsSync(file)) return null;
  return JSON.parse(fs.readFileSync(file, "utf8")) as CanonicalImageInventorySummary;
}

export function isApprovedProductionSourceType(sourceType: string | null | undefined, filePath: string | null | undefined): boolean {
  if (sourceType === "image-platform" || sourceType === "upload") {
    return Boolean(filePath && !isLegacyDemonstrationAssetPath(filePath));
  }
  return false;
}

export function countRenderedImageOccurrences(slug: string): number {
  const renderRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", slug);
  if (!fs.existsSync(renderRoot)) return 0;
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_") || entry.name === "404.html") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const html = fs.readFileSync(full, "utf8");
        count += (html.match(/<img[^>]+src=["'][^"']*pharmacy-image-platform[^"']*["']/gi) || []).length;
        count += (html.match(/<img[^>]+src=["'][^"']*pharmacy-uploads[^"']*["']/gi) || []).length;
      }
    }
  };
  walk(renderRoot);
  return count;
}
