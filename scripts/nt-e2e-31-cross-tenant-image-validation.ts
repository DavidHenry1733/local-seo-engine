#!/usr/bin/env npx tsx
/**
 * NT-E2E-31 — Cross-tenant read-only production assignment validation.
 */
import { previewPharmacyProductionImageAssignments } from "../src/pharmacy/imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts";
import { loadImageAssignments } from "../src/pharmacy/pharmacyImageOperatingSystem.ts";

const TENANTS = ["reliable-direct-pharmacy", "banner-cross-pharmacy", "pharmaconnect"];

function validateTenant(slug: string) {
  const preview = previewPharmacyProductionImageAssignments(slug, "pharmacy-first");
  const keys = Object.keys(preview);
  const doc = loadImageAssignments(slug);
  const persistedPlatform = Object.values(doc.assignments).filter((a) => a.sourceType === "image-platform").length;
  const campaignSvg = Object.values(doc.assignments).filter(
    (a) => a.sourceType === "library" && String(a.filePath || "").includes("pharmacy-image-library"),
  ).length;
  const crossTenant = Object.values(doc.assignments).some(
    (a) => String(a.filePath || "").includes("/pharmacy-uploads/") && !String(a.filePath || "").includes(`/${slug}/`),
  );
  return {
    slug,
    previewSlotCount: keys.length,
    sampleKeys: keys.slice(0, 3),
    persistedPlatformAssignments: persistedPlatform,
    campaignSvgFallbacks: campaignSvg,
    crossTenantAssetRefs: crossTenant,
    genericServiceUsed: true,
  };
}

const results = TENANTS.map(validateTenant);
const pass = results.every((r) => r.previewSlotCount >= 14 && !r.crossTenantAssetRefs);
console.log(JSON.stringify({ crossTenantImageValidation: pass ? "PASS" : "FAIL", tenants: results }, null, 2));
process.exit(pass ? 0 : 1);
