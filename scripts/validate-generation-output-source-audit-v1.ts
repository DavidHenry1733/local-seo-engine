#!/usr/bin/env npx tsx
/**
 * Generation Output Emergency Source Audit V1.
 */
import fs from "node:fs";
import path from "node:path";
import { buildReviewCentreView } from "../src/pharmacy/growthEngineReviewCentreService.ts";
import {
  loadContentPackage,
  verifyContentPackageReviewSources,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../src/pharmacy/pharmacyWorkspacePaths.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const checks: Check[] = [];
const forbidden = [
  /Brook Pharmacy/i,
  /Rowlands Pharmacy/i,
  /DHM Digital/i,
  /pharmacy\.inboxingproweb\.com/i,
  /demo pharmacy/i,
];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function exists(filePath: string): boolean {
  return fs.existsSync(filePath);
}

function walkFiles(dir: string): string[] {
  if (!exists(dir)) return [];
  const out: string[] = [];
  const walk = (current: string) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|json|md)$/i.test(entry.name)) out.push(full);
    }
  };
  walk(dir);
  return out;
}

function containsAll(filePath: string, needles: string[]): boolean {
  if (!exists(filePath)) return false;
  const raw = read(filePath);
  return needles.every((needle) => raw.includes(needle));
}

function hasForbidden(filePath: string): string | null {
  const raw = read(filePath);
  const match = forbidden.find((pattern) => pattern.test(raw));
  return match ? `${match}` : null;
}

async function main(): Promise<void> {
  const packagePath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/pharmacy-content-packages",
    slug,
    `${campaignId}.json`,
  );
  const ecosystemRoot = path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, campaignId);
  const ecosystemIndexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
  const servicePagePath = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-visual-experience",
    slug,
    campaignId,
    "index.html",
  );
  const socialPath = path.join(ecosystemRoot, "packs/social-posts.json");
  const emailPath = path.join(ecosystemRoot, "packs/email-sequence.json");
  const gbpPath = path.join(ecosystemRoot, "packs/gbp-posts.json");
  const guidePath = path.join(ecosystemRoot, "pages/pharmacy-first-guide/index.html");
  const blogPath = path.join(ecosystemRoot, "pages/what-is-pharmacy-first/index.html");
  const archiveRoot = path.join(PHARMACY_WORKSPACE_ROOT, "_archive/generation-output-source-audit");

  console.log(`\n=== Generation Output Emergency Source Audit V1: ${slug}/${campaignId} ===\n`);
  console.log(`review centre asset source path: ${packagePath}`);
  console.log(`ecosystem index path: ${ecosystemIndexPath}`);
  console.log(`service page file path: ${servicePagePath}`);
  console.log(`social content path: ${socialPath}`);
  console.log(`email content path: ${emailPath}`);
  console.log(`guide path: ${guidePath}`);
  console.log(`blog path: ${blogPath}`);
  console.log(`gbp content path: ${gbpPath}\n`);

  const pkg = loadContentPackage(slug, campaignId);
  record("old output removed", exists(archiveRoot), archiveRoot);
  record("new output created", exists(ecosystemIndexPath) && exists(servicePagePath) && exists(packagePath), ecosystemRoot);
  record(
    "generation stamps match",
    containsAll(packagePath, [`"tenantSlug": "${slug}"`, `"campaignId": "${campaignId}"`, "customer-imported-profile"]) &&
      containsAll(ecosystemIndexPath, [`"tenantSlug": "${slug}"`, `"campaignId": "${campaignId}"`, "customer-imported-profile"]) &&
      containsAll(servicePagePath, [`name="tenantSlug" content="${slug}"`, `name="campaignId" content="${campaignId}"`, "customer-imported-profile"]),
    "tenantSlug/campaignId/sourceContext stamps",
  );

  const files = [servicePagePath, ...walkFiles(ecosystemRoot)];
  const leaked = files.map((file) => ({ file, leaked: hasForbidden(file) })).filter((item) => item.leaked);
  record("no demo strings exist", leaked.length === 0, leaked.map((item) => `${item.file}: ${item.leaked}`).join("; ") || "clean");

  const serviceHtml = exists(servicePagePath) ? read(servicePagePath) : "";
  record(
    "service page contains Pharmacy Delivered / Rotherham / Pharmacy First",
    ["Pharmacy Delivered", "Rotherham", "Pharmacy First"].every((needle) => serviceHtml.includes(needle)),
    servicePagePath,
  );
  record("service page has header/footer", /<header\b/i.test(serviceHtml) && /<footer\b/i.test(serviceHtml), servicePagePath);
  record("service page has trust block", /Trust &amp; credentials|Trust & credentials|pharmacy-trust-cards/i.test(serviceHtml), servicePagePath);
  record("service page has images or unavailable markers", /<img\b/i.test(serviceHtml) || /data-image-missing="true"/i.test(serviceHtml), servicePagePath);

  record("social content uses Pharmacy Delivered context", containsAll(socialPath, ["Pharmacy Delivered", "Rotherham"]), socialPath);
  record("email content uses Pharmacy Delivered context", containsAll(emailPath, ["Pharmacy Delivered"]), emailPath);
  record("guide content uses Pharmacy Delivered context", containsAll(guidePath, ["Pharmacy Delivered", "Rotherham"]), guidePath);
  record("blog content uses Pharmacy Delivered context", containsAll(blogPath, ["Pharmacy Delivered", "Rotherham"]), blogPath);
  record("ecosystem output at correct tenant/campaign path", exists(ecosystemIndexPath), ecosystemIndexPath);

  const sourceCheck = verifyContentPackageReviewSources(slug, campaignId);
  record("Review Centre reads stamped generated output", sourceCheck.ok, sourceCheck.errors.join("; ") || "source stamps ok");
  const review = buildReviewCentreView(slug, campaignId);
  record(
    "Review Centre loads generated assets from correct path",
    Boolean(review?.generated && review.totalAssets > 0 && pkg?.generationStamp?.tenantSlug === slug && pkg.generationStamp.campaignId === campaignId),
    review ? `generated=${review.generated}; totalAssets=${review.totalAssets}; groups=${review.groups.length}` : "review missing",
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
