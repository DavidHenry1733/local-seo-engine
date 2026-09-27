#!/usr/bin/env npx tsx
/**
 * Quality Review must adopt an existing locality campaign when a later
 * service-page-only package would otherwise hide it. Read-only.
 */
import { createHash } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { buildCommercialQualityReview } from "../src/pharmacy/masterAdminCommercialQualityReviewService.ts";
import { loadContentPackage } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveExistingCampaignEcosystemAuthority } from "../src/pharmacy/masterAdminQualityReviewCampaignEcosystemAuthority.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

const BROOK = "brook-pharmacy-demo-derby";
const LEEDS = "leeds-pharmacy";
const SERVICE = "pharmacy-first";

const failures: string[] = [];

function assert(condition: unknown, message: string): void {
  if (!condition) failures.push(message);
}

function hashFile(file: string): string {
  return createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function localityHtmlFiles(slug: string, serviceId: string): string[] {
  const dir = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "local");
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => fs.existsSync(path.join(dir, name, "index.html")))
    .sort()
    .map((name) => path.join(dir, name, "index.html"));
}

function snapshot(slug: string, serviceId: string): Record<string, string> {
  const files = [
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`),
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html"),
    path.join(
      PHARMACY_WORKSPACE_ROOT,
      "data/pharmacy-master-admin/service-page-review",
      slug,
      "by-campaign",
      "caf83fc0-9b8a-40a9-85f9-f79b99b094c5",
      "decision.json",
    ),
    ...localityHtmlFiles(slug, serviceId),
  ];
  const hashes: Record<string, string> = {};
  for (const file of files) {
    if (fs.existsSync(file)) hashes[file] = hashFile(file);
  }
  return hashes;
}

function indexLocationPages(slug: string, serviceId: string): number {
  const file = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "_ecosystem-index.json",
  );
  if (!fs.existsSync(file)) return 0;
  const index = JSON.parse(fs.readFileSync(file, "utf8")) as { assets?: Array<{ type?: string }> };
  return (index.assets || []).filter((asset) => /local/i.test(asset.type || "")).length;
}

function run(): void {
  const before = snapshot(BROOK, SERVICE);
  const authorisedPath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-master-admin/authorised-ecosystem-generation",
    BROOK,
    "latest.json",
  );
  assert(!fs.existsSync(authorisedPath), "Brook authorised ecosystem record was already present");

  const brookPackage = loadContentPackage(BROOK, SERVICE);
  const authority = resolveExistingCampaignEcosystemAuthority(BROOK, SERVICE, brookPackage);
  assert(authority, "Brook existing campaign authority did not resolve");
  assert(authority?.areaSlugs.length === 10, `Brook locality authority count ${authority?.areaSlugs.length}`);
  assert(authority?.servicePageApproved === true, "Brook service-page approval was not read from the campaign decision");
  assert(authority?.localityApprovedCount === 0, `Brook locality approvals were fabricated: ${authority?.localityApprovedCount}`);
  assert(authority?.localityExpectedCount === 10, `Brook expected localities ${authority?.localityExpectedCount}`);
  assert(authority?.registryAgrees === true, authority?.registryDetail || "Brook locality registry did not agree");

  const review = buildCommercialQualityReview(BROOK);
  const totals = review.contentTotals;
  assert(totals.websitePages === 11, `Brook website pages ${totals.websitePages}`);
  assert(totals.servicePages === 1, `Brook service pages ${totals.servicePages}`);
  assert(totals.locationPages === 10, `Brook location pages ${totals.locationPages}`);
  assert(review.locationBreakdown?.areaPageCount === 10, `Brook area page count ${review.locationBreakdown?.areaPageCount}`);
  assert(review.canApprove === false, "Brook Quality Review canApprove was enabled");
  assert(review.approvalStatus === "pending", `Brook Quality Review approvalStatus ${review.approvalStatus}`);
  assert(review.productOwnerAuthorised === false, "Brook productOwnerAuthorised was fabricated");
  assert(review.summary.publishingReadiness === "Blocked", `Brook publishing ${review.summary.publishingReadiness}`);
  assert(review.summary.overallStatus === "BLOCKED", `Brook overall ${review.summary.overallStatus}`);

  const classified = JSON.stringify({
    warnings: review.warnings,
    blockers: review.blockers,
    checks: review.checks,
  });
  assert(!classified.includes("service-page-only scope"), "Brook review still uses the service-page-only link stamp");
  assert(!classified.includes("Historical accidental package"), "Brook review still classifies the campaign as a historical package");
  assert(
    !classified.includes("Product Owner-authorised ecosystem generation required"),
    "Brook review still requires a missing authorised ecosystem generation",
  );
  assert(!classified.includes("Missing assignment: index:"), "Brook image parity still requires RC1 homepage slots");
  assert(!classified.includes("pharmacy-first-guide"), "Brook image parity still requires RC1 guide slots");
  assert(!classified.includes("what-is-pharmacy-first"), "Brook image parity still requires RC1 blog slots");
  assert(
    review.blockers.some((blocker) => /locality pages not approved|not approved/i.test(blocker)),
    `Brook publishing is not blocked by recorded locality approval: ${review.blockers.join(" | ")}`,
  );

  const decision = JSON.parse(
    fs.readFileSync(
      path.join(
        PHARMACY_WORKSPACE_ROOT,
        "data/pharmacy-master-admin/service-page-review",
        BROOK,
        "by-campaign",
        "caf83fc0-9b8a-40a9-85f9-f79b99b094c5",
        "decision.json",
      ),
      "utf8",
    ),
  ) as { decision?: string };
  assert(decision.decision === "approved", "Brook service-page decision is no longer approved");

  const after = snapshot(BROOK, SERVICE);
  for (const [file, hash] of Object.entries(before)) {
    assert(after[file] === hash, `Content hash changed: ${file}`);
  }
  assert(!fs.existsSync(authorisedPath), "Brook authorised ecosystem record was created");

  const leedsPackage = loadContentPackage(LEEDS, SERVICE);
  assert(
    resolveExistingCampaignEcosystemAuthority(LEEDS, SERVICE, leedsPackage) === null,
    "Leeds pharmacy-first was treated as an existing uk-local campaign",
  );
  const leeds = buildCommercialQualityReview(LEEDS);
  const expectedLeedsLocations = indexLocationPages(LEEDS, leeds.serviceId || SERVICE);
  assert(
    leeds.contentTotals.locationPages === expectedLeedsLocations,
    `Leeds location pages ${leeds.contentTotals.locationPages} != index ${expectedLeedsLocations}`,
  );
  assert(
    leeds.blockers.some((blocker) => /authorised ecosystem generation required/i.test(blocker)),
    `Leeds no longer requires authorised ecosystem generation: ${leeds.blockers.join(" | ")}`,
  );

  console.log(JSON.stringify({
    brook: {
      websitePages: totals.websitePages,
      servicePages: totals.servicePages,
      locationPages: totals.locationPages,
      areaPageCount: review.locationBreakdown?.areaPageCount,
      canApprove: review.canApprove,
      approvalStatus: review.approvalStatus,
      publishingReadiness: review.summary.publishingReadiness,
      blockers: review.blockers,
      warnings: review.warnings,
      checks: review.checks.map((check) => ({ id: check.id, status: check.status, detail: check.detail })),
    },
    leeds: {
      serviceId: leeds.serviceId,
      locationPages: leeds.contentTotals.locationPages,
      blockers: leeds.blockers,
    },
    failures,
  }, null, 2));

  if (failures.length) {
    process.exitCode = 1;
  }
}

run();
