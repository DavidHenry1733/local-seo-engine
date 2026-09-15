#!/usr/bin/env npx tsx
/**
 * Campaign Generation Output Fix V1 — validates Campaign Builder to Review Centre handoff.
 */
import fs from "node:fs";
import {
  generateContentPackage,
  loadContentPackage,
  verifyContentPackageHandoff,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

async function main(): Promise<void> {
  const slug = resolveTenantProfileSlug(process.argv[2] || "pharmacy-delivered-4u-test") || "pharmacy-delivered-4u-test";
  const serviceId = process.argv[3] || "pharmacy-first";

  console.log(`\n=== Campaign Generation Output Fix V1: ${slug}/${serviceId} ===\n`);

  const generation = await generateContentPackage(slug, serviceId);
  record(
    "Generate pharmacy-first for pharmacy-delivered-4u-test",
    generation.ok,
    generation.ok ? "generation succeeded" : generation.error || "generation failed",
  );

  const handoff = verifyContentPackageHandoff(slug, serviceId);
  record("Ecosystem output path exists", fs.existsSync(handoff.ecosystemRoot), handoff.ecosystemRoot);
  record("Manifest/index exists", fs.existsSync(handoff.ecosystemIndexPath), handoff.ecosystemIndexPath);
  record("Review package source exists", fs.existsSync(handoff.reviewPackageSource), handoff.reviewPackageSource);
  record("Asset list exists", handoff.assetCount > 0, `${handoff.assetCount} reviewable asset(s)`);

  const pkg = loadContentPackage(slug, serviceId);
  const errors = [
    generation.error || "",
    pkg?.generationError || "",
    pkg?.packageValidation?.detail || "",
    handoff.reason || "",
  ].filter(Boolean);
  record(
    "No Ecosystem output missing error",
    !errors.some((msg) => msg.includes("Ecosystem output missing")),
    errors.join("; ") || "clean",
  );

  const review = buildReviewCentreView(slug, serviceId);
  record(
    "Review Centre can load generated assets",
    Boolean(review?.generated && review.totalAssets > 0 && review.groups.length > 0),
    review
      ? `generated=${review.generated}; totalAssets=${review.totalAssets}; groups=${review.groups.length}`
      : "review view missing",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
