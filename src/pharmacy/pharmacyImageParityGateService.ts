/**
 * NT-E2E-31 — Mandatory post-generation image parity gate.
 */
import fs from "node:fs";
import path from "node:path";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import {
  buildCanonicalImageInventory,
  countRenderedImageOccurrences,
  isApprovedProductionSourceType,
  type CanonicalImageInventorySummary,
} from "./pharmacyCanonicalImageInventoryService.ts";
import { buildProductionPageSlotInventory } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import {
  isLegacyDemonstrationAssetPath,
  isPharmacyFirstProductionLibraryReady,
} from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { readFinalRenderManifest } from "./pharmacyCanonicalFinalRenderService.ts";
import type { CanonicalEcosystemGenerationPlan } from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";

export interface ImageParityGateResult {
  ok: boolean;
  imageCompletenessStatus: "COMPLETE" | "FAILED_IMAGE_COMPLETENESS";
  requiredAssignments: number;
  assignedAssignments: number;
  missingAssignments: number;
  staleSvgContentFallbacks: number;
  brokenAssets: number;
  crossTenantAssets: number;
  placeholderClassContentImages: number;
  failures: string[];
  inventory: CanonicalImageInventorySummary;
  renderedImageOccurrences: number;
}

function assetExists(relativePath: string): boolean {
  return fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, relativePath.replace(/^\/+/, "")));
}

function countStaleSvgInRender(slug: string): number {
  const renderRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-final-render", slug);
  if (!fs.existsSync(renderRoot)) return 0;
  let count = 0;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("_")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name === "index.html") {
        const html = fs.readFileSync(full, "utf8");
        const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]);
        for (const src of srcs) {
          if (src.includes("pharmacy-image-library") && /\.svg/i.test(src)) count += 1;
        }
      }
    }
  };
  walk(renderRoot);
  return count;
}

function countCrossTenantAssets(slug: string): number {
  const doc = loadImageAssignments(slug);
  let count = 0;
  for (const a of Object.values(doc.assignments)) {
    const fp = String(a.filePath || "");
    if (fp.includes("/pharmacy-uploads/") && !fp.includes(`/${slug}/`)) count += 1;
    if (fp.includes("/brands/") && !fp.includes(`/${slug}/`) && fp.includes("pharmacy-image")) count += 1;
  }
  return count;
}

export function runImageParityGate(
  slug: string,
  serviceId: string,
  plan?: CanonicalEcosystemGenerationPlan | null,
): ImageParityGateResult {
  const slotPlans = buildProductionPageSlotInventory(slug, serviceId, plan);
  const inventory = buildCanonicalImageInventory(slug, serviceId, plan);
  const doc = loadImageAssignments(slug);
  const failures: string[] = [];
  let missing = 0;
  let broken = 0;

  for (const slot of slotPlans) {
    const key = `${slot.pageSlug}:${slot.serviceId}:${slot.slot}`;
    const a = doc.assignments[key];
    if (!a) {
      missing += 1;
      failures.push(`Missing assignment: ${key}`);
      continue;
    }
    if (!isApprovedProductionSourceType(a.sourceType, a.filePath)) {
      missing += 1;
      failures.push(`Disallowed source for ${key}: ${a.sourceType} ${a.filePath || ""}`);
      continue;
    }
    if (!a.filePath || !assetExists(a.filePath)) {
      broken += 1;
      failures.push(`Broken asset for ${key}: ${a.filePath || "empty"}`);
    }
  }

  const staleSvg = countStaleSvgInRender(slug);
  const crossTenant = countCrossTenantAssets(slug);
  const renderedOccurrences = countRenderedImageOccurrences(slug);
  const manifest = readFinalRenderManifest(slug);
  const manifestMappings = manifest?.imagePlatformSlotMappings || [];
  const manifestEmpty = manifestMappings.filter((m) => !m.filePath).length;

  if (staleSvg > 0) failures.push(`${staleSvg} stale SVG content images in final render`);
  if (crossTenant > 0) failures.push(`${crossTenant} cross-tenant asset references`);
  if (manifestEmpty > 0) failures.push(`${manifestEmpty} manifest slot mappings with empty filePath`);

  const productionReady = serviceId === "pharmacy-first" && isPharmacyFirstProductionLibraryReady();
  const assigned = inventory.counts.assigned;
  const required = slotPlans.length;
  const ok =
    productionReady &&
    missing === 0 &&
    broken === 0 &&
    staleSvg === 0 &&
    crossTenant === 0 &&
    assigned === required;

  return {
    ok,
    imageCompletenessStatus: ok ? "COMPLETE" : "FAILED_IMAGE_COMPLETENESS",
    requiredAssignments: required,
    assignedAssignments: assigned,
    missingAssignments: missing,
    staleSvgContentFallbacks: staleSvg,
    brokenAssets: broken,
    crossTenantAssets: crossTenant,
    placeholderClassContentImages: staleSvg,
    failures,
    inventory,
    renderedImageOccurrences: renderedOccurrences,
  };
}

export function pageTypeImageStatus(
  slug: string,
  pageType: string,
  plan?: CanonicalEcosystemGenerationPlan | null,
  serviceId = "pharmacy-first",
): "PASS" | "FAIL" | "NOT_REQUIRED" {
  const inventory = buildCanonicalImageInventory(slug, serviceId, plan);
  const slots = inventory.pageSlotAssignments.filter((r) => {
    if (pageType === "homepage") return r.pageSlug === "index";
    if (pageType === "service") return r.pageType === "service";
    if (pageType === "cluster-page") return r.pageSlug.startsWith("local-cluster-");
    if (pageType === "guide") return r.pageType === "guide";
    if (pageType === "blog") return r.pageType === "blog";
    if (pageType === "faq") return r.pageSlug.includes("faq");
    if (pageType === "supporting") return r.pageType === "guide" && r.role.startsWith("supporting");
    return false;
  });
  if (!slots.length) return pageType === "supporting" ? "NOT_REQUIRED" : "FAIL";
  return slots.every((s) => s.assignmentStatus === "assigned") ? "PASS" : "FAIL";
}
