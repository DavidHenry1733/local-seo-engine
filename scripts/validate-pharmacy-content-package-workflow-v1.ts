#!/usr/bin/env npx tsx
/**
 * PharmaConnect Content Package Workflow V1 — validation.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  approveContentPackage,
  contentPackageApproved,
  contentPackageGenerated,
  generateContentPackage,
  loadContentPackage,
  markContentPackageReviewed,
} from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  buildPlatformOperatingSystem,
  resolveNextOsStep,
} from "../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { resolveTenantProfileSlug } from "../src/pharmacy/pharmacyTenantSlug.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string) {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${id} — ${detail}`);
}

function readRoute(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), "utf8");
}

const slugArg = process.argv[2] || "pharmaconnect";
let serviceId = process.argv[3] || "";
const slug = resolveTenantProfileSlug(slugArg) || slugArg;
if (!serviceId) {
  serviceId = buildPlatformOperatingSystem(slug).currentCampaignServiceId;
}

console.log(`\nPharmaConnect Content Package Workflow V1 — ${slug} / ${serviceId}\n`);

const gen = await generateContentPackage(slug, serviceId);
record("package-generation", gen.ok, gen.ok ? "generated" : gen.error || "failed");

const manifest = loadContentPackage(slug, serviceId);
record("manifest-created", Boolean(manifest?.generatedAt), manifest?.generatedAt || "missing");
record("manifest-path", fs.existsSync(path.join(ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`)), `data/pharmacy-content-packages/${slug}/${serviceId}.json`);

const servicePage = manifest?.assets.find((a) => a.type === "service-page");
record("service-page-included", Boolean(servicePage?.included || servicePage?.status === "included"), `${servicePage?.status} count=${servicePage?.count}`);

const localAreas = manifest?.assets.find((a) => a.type === "local-area-pages");
record(
  "local-areas-listed",
  Boolean(localAreas),
  localAreas?.included ? `included ${localAreas.count}` : localAreas?.notes || "planned",
);

const faq = manifest?.assets.find((a) => a.type === "faq");
const blog = manifest?.assets.find((a) => a.type === "blog");
const gbp = manifest?.assets.find((a) => a.type === "gbp");
const social = manifest?.assets.find((a) => a.type === "social");
const email = manifest?.assets.find((a) => a.type === "email");
record("faq-listed", Boolean(faq), faq?.status || "missing");
record("blog-listed", Boolean(blog), blog?.status || "missing");
record("gbp-listed", Boolean(gbp), gbp?.status || "missing");
record("social-listed", Boolean(social), social?.status || "missing");
record("email-listed", Boolean(email), email?.status || "missing");

const reviewPage = readRoute("artifacts/api-server/src/routes/pharmacyAssetReviewPage.ts");
record("review-no-generate", !reviewPage.includes("rebuild=1") && !reviewPage.includes("/generate"), "review only");
record(
  "review-create-package-cta",
  reviewPage.includes("Create Content Package") && reviewPage.includes("has not been created yet"),
  "missing package CTA",
);

const createPage = readRoute("artifacts/api-server/src/routes/pharmacyContentPackagePage.ts");
record("create-page-label", createPage.includes("Create Content Package"), "step 4 page");

if (contentPackageGenerated(slug, serviceId)) {
  markContentPackageReviewed(slug, serviceId);
  const afterReview = loadContentPackage(slug, serviceId);
  record("review-stored", Boolean(afterReview?.reviewedAt), afterReview?.reviewedAt || "missing");

  approveContentPackage(slug, serviceId, "validation-script");
  const afterApprove = loadContentPackage(slug, serviceId);
  record("approval-stored", afterApprove?.approvalStatus === "approved", afterApprove?.approvalStatus || "missing");
  record("approved-at", Boolean(afterApprove?.approvedAt), afterApprove?.approvedAt || "missing");
}

const os = buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId });
const publishStep = os.steps.find((s) => s.id === "publish")!;
const indexStep = os.steps.find((s) => s.id === "submit-to-google")!;
const generateStep = os.steps.find((s) => s.id === "generate-asset")!;
const reviewStep = os.steps.find((s) => s.id === "review-content")!;

record("step4-title", generateStep.title === "Create Content Package", generateStep.title);
record("step5-title", reviewStep.title === "Review Content Package", reviewStep.title);
record(
  "publish-unlocked-after-approval",
  contentPackageApproved(slug, serviceId) ? !publishStep.locked || publishStep.status === "IN_PROGRESS" || publishStep.status === "COMPLETE" : publishStep.locked || publishStep.status === "BLOCKED",
  `publish locked=${publishStep.locked} status=${publishStep.status}`,
);

const campaignPublished = os.currentCampaign?.publishingStatus === "published";
record(
  "submit-locked-until-published",
  campaignPublished || publishStep.status === "COMPLETE"
    ? true
    : indexStep.locked || indexStep.status === "BLOCKED",
  campaignPublished ? "published tenant" : `index locked=${indexStep.locked}`,
);

if (slug !== "pharmaconnect" && manifest) {
  const visualPath = servicePage?.outputPath;
  if (visualPath && fs.existsSync(visualPath)) {
    const html = fs.readFileSync(visualPath, "utf8").slice(0, 120_000);
    record("tenant-no-brook", !/Brook Pharmacy/i.test(html), slug);
  } else {
    record("tenant-no-brook", true, "no visual file");
  }
}

record(
  "dashboard-create-url",
  generateStep.url.includes("/api/pharmacy-content-package"),
  generateStep.url,
);

const next = resolveNextOsStep(os.steps);
record(
  "continue-logic",
  !next
    ? os.steps.every((s) => s.status === "COMPLETE" || s.status === "WAITING")
    : contentPackageApproved(slug, serviceId)
      ? ["publish", "submit-to-google", "track-results"].includes(next.id)
      : contentPackageGenerated(slug, serviceId)
        ? ["review-content", "approve-asset"].includes(next.id)
        : next.id === "generate-asset",
  next ? `${next.stepNumber}. ${next.title}` : "workflow complete",
);

const passed = checks.filter((c) => c.pass).length;
const failed = checks.filter((c) => !c.pass).length;
console.log(`\n${passed}/${checks.length} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
