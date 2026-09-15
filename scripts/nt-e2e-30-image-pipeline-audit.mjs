#!/usr/bin/env node
/**
 * NT-E2E-30 read-only image pipeline audit — Reliable Direct Pharmacy
 */
import fs from "fs";
import path from "path";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "reliable-direct-pharmacy";
const SERVICE = "pharmacy-first";

const RC1_SLOTS = [
  { pageSlug: "index", pageType: "homepage", slot: "hero" },
  { pageSlug: "index", pageType: "homepage", slot: "support" },
  { pageSlug: "index", pageType: "homepage", slot: "trust" },
  { pageSlug: "index", pageType: "homepage", slot: "conversion" },
  { pageSlug: "pharmacy-first", pageType: "service", slot: "hero" },
  { pageSlug: "pharmacy-first", pageType: "service", slot: "support" },
  { pageSlug: "pharmacy-first", pageType: "service", slot: "trust" },
  { pageSlug: "pharmacy-first", pageType: "service", slot: "conversion" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", slot: "hero" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", slot: "support" },
  { pageSlug: "pharmacy-first-guide", pageType: "guide", slot: "conversion" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", slot: "hero" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", slot: "support" },
  { pageSlug: "what-is-pharmacy-first", pageType: "blog", slot: "conversion" },
];

const CANONICAL_PAGES = [
  { pageSlug: "index", file: "index.html", type: "homepage" },
  { pageSlug: "pharmacy-first", file: "pharmacy-first/index.html", type: "service" },
  { pageSlug: "pharmacy-first-guide", file: "pharmacy-first-guide/index.html", type: "guide" },
  { pageSlug: "what-is-pharmacy-first", file: "what-is-pharmacy-first/index.html", type: "blog" },
  { pageSlug: "who-should-consider-pharmacy-first", file: "who-should-consider-pharmacy-first/index.html", type: "blog" },
  { pageSlug: "pharmacy-first-what-you-need-to-know", file: "pharmacy-first-what-you-need-to-know/index.html", type: "blog" },
  { pageSlug: "pharmacy-first-faqs", file: "pharmacy-first-faqs/index.html", type: "faq" },
  { pageSlug: "pharmacy-first-content-ecosystem", file: "pharmacy-first-content-ecosystem/index.html", type: "supporting" },
  { pageSlug: "local-cluster-ecclesall", file: "local-cluster-ecclesall/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-fulwood", file: "local-cluster-fulwood/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-sheffield-city-centre", file: "local-cluster-sheffield-city-centre/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-broomhill", file: "local-cluster-broomhill/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-kelham-island", file: "local-cluster-kelham-island/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-dore", file: "local-cluster-dore/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-hillsborough", file: "local-cluster-hillsborough/index.html", type: "local-cluster" },
  { pageSlug: "local-cluster-crookes", file: "local-cluster-crookes/index.html", type: "local-cluster" },
];

function readJson(rel) {
  return JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));
}

function assignmentKey(pageSlug, serviceId, slot) {
  return `${pageSlug}:${serviceId}:${slot}`;
}

function getStoredAssignment(doc, pageSlug, serviceId, slot) {
  const pageKey = assignmentKey(pageSlug, serviceId, slot);
  if (doc.assignments[pageKey]) return { key: pageKey, assignment: doc.assignments[pageKey], tier: "page-scoped" };
  const campaignKey = `${serviceId}:${serviceId}:${slot}`;
  if (doc.assignments[campaignKey]) return { key: campaignKey, assignment: doc.assignments[campaignKey], tier: "campaign-scoped" };
  return { key: pageKey, assignment: null, tier: "missing" };
}

function collectRealPharmacyUploadImages(dir, baseDir = dir) {
  if (!fs.existsSync(dir)) return [];
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...collectRealPharmacyUploadImages(fullPath, baseDir));
      continue;
    }
    const relativePath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
    const normalized = relativePath.toLowerCase();
    if (!/\.(png|jpe?g|webp)$/.test(normalized)) continue;
    if (/(validate|test|placeholder|mock|svg)/i.test(normalized)) continue;
    results.push(`assets/pharmacy-uploads/${relativePath}`);
  }
  return results.sort((a, b) => {
    const aP = a.includes("/pharmaconnect/") ? 0 : a.includes("/dhmdigital/") ? 1 : 2;
    const bP = b.includes("/pharmaconnect/") ? 0 : b.includes("/dhmdigital/") ? 1 : 2;
    return aP - bP || a.localeCompare(b);
  });
}

const SLOT_INDEX = { hero: 0, support: 1, trust: 2, conversion: 3 };
function reviewPreviewImageSlot(pageSlug) {
  const slug = String(pageSlug || "").toLowerCase();
  if (slug.includes("blog") || slug.includes("what-is") || slug.includes("pharmacist-help") || slug.includes("gp-appointment")) return "conversion";
  if (slug.includes("guide") || slug.includes("faq")) return "trust";
  if (slug.includes("local") || slug.includes("rotherham")) return "support";
  return "hero";
}

function previewWouldUsePlaceholder(pageSlug) {
  const slot = reviewPreviewImageSlot(pageSlug);
  const uploads = collectRealPharmacyUploadImages(path.join(ROOT, "assets/pharmacy-uploads"));
  const tenantUploads = uploads.filter((p) => p.includes(`/${SLUG}/`));
  if (tenantUploads.length) return { placeholder: false, reason: "tenant-upload", image: tenantUploads[0] };
  if (uploads.length) return { placeholder: false, reason: "cross-tenant-upload-fallback", image: uploads[SLOT_INDEX[slot] % uploads.length] };
  return { placeholder: true, reason: "no-uploads", image: null };
}

function isLocalClusterGeneratedPage(html) {
  return /data-publish-source=["'](?:local-cluster-design-system|local-area-v1|local-cluster-v1|local-hub-v1)["']/i.test(html);
}

function scanHtmlImages(html) {
  const imgs = [...html.matchAll(/<img[^>]+>/gi)].map((m) => m[0]);
  const placeholders = (html.match(/data-image-missing="true"/gi) || []).length;
  const placeholderText = (html.match(/Campaign image will be added before publishing/gi) || []).length;
  const reviewPlaceholder = (html.match(/review-preview-image--placeholder/gi) || []).length;
  const srcs = imgs.map((tag) => tag.match(/src=["']([^"']+)["']/i)?.[1] || "").filter(Boolean);
  return { imgCount: imgs.length, srcs, placeholders, placeholderText, reviewPlaceholder };
}

// --- Data loads ---
const assignments = readJson(`data/pharmacy-image-assignments/${SLUG}.json`);
const manifest = readJson("assets/pharmacy-image-platform/library-manifest.json");
const finalManifest = readJson(`output/pharmacy-final-render/${SLUG}/FinalRenderManifest.json`);
const canonical = readJson(`data/pharmacy-master-admin/canonical-ecosystem-plans/${SLUG}/latest.json`);
const campaignCtx = readJson(`data/growth-engine/${SLUG}-campaign-generation-context-pharmacy-first.json`);

console.log("=== 1. IMAGE GENERATION PLAN ===");
console.log(JSON.stringify({
  campaignSlots: campaignCtx.campaignImagePlan.slots.length,
  slotTypes: campaignCtx.campaignImagePlan.slots.map((s) => s.slot),
  sourceTypes: [...new Set(campaignCtx.campaignImagePlan.slots.map((s) => s.sourceType))],
  aiRequests: assignments.aiRequests.length,
  imageStrategy: campaignCtx.imageStrategy,
  canonicalRequiredRoles: canonical.coreEcosystem?.requiredImageRoles,
  canonicalImageInventory: canonical.imageInventory?.length,
}, null, 2));

console.log("\n=== 2. IMAGE MANIFEST ===");
console.log(JSON.stringify({
  platformManifestAssets: manifest.assets?.length ?? manifest.totalAssets ?? 0,
  platformApproved: manifest.approvedAssets ?? 0,
  assignmentKeys: Object.keys(assignments.assignments).length,
  assignmentKeyPattern: Object.keys(assignments.assignments).every((k) => k.startsWith("pharmacy-first:pharmacy-first:")) ? "campaign-scoped-only" : "mixed",
  tenantUploads: assignments.uploads.length,
  tenantUploadDirExists: fs.existsSync(path.join(ROOT, `assets/pharmacy-uploads/${SLUG}`)),
  tenantUploadFiles: fs.existsSync(path.join(ROOT, `assets/pharmacy-uploads/${SLUG}`))
    ? fs.readdirSync(path.join(ROOT, `assets/pharmacy-uploads/${SLUG}`)).length
    : 0,
}, null, 2));

console.log("\n=== 3. RC1 SLOT ASSIGNMENT TRACE ===");
const slotTraces = RC1_SLOTS.map((plan) => {
  const stored = getStoredAssignment(assignments, plan.pageSlug, SERVICE, plan.slot);
  const manifestEntry = finalManifest.imageSlots?.find(
    (s) => s.pageSlug === plan.pageSlug && s.slot === plan.slot,
  );
  const fileExists = stored.assignment?.filePath
    ? fs.existsSync(path.join(ROOT, stored.assignment.filePath))
    : false;
  return {
    pageSlug: plan.pageSlug,
    pageType: plan.pageType,
    slot: plan.slot,
    expectedImage: manifestEntry?.filePath || "(page-scoped assignment expected)",
    assignedImage: stored.assignment?.filePath || null,
    assignmentTier: stored.tier,
    assetExists: fileExists,
    manifestFilePath: manifestEntry?.filePath || "",
  };
});
console.log(JSON.stringify(slotTraces, null, 2));

console.log("\n=== 4. CANONICAL PAGE AUDIT (stored HTML + preview simulation) ===");
const renderRoot = path.join(ROOT, `output/pharmacy-final-render/${SLUG}`);
const pageAudits = [];
let totalPlaceholdersStored = 0;
let totalPlaceholdersPreview = 0;
let totalExpectedImages = 0;
let totalAssignedImages = 0;

for (const page of CANONICAL_PAGES) {
  const filePath = path.join(renderRoot, page.file);
  const exists = fs.existsSync(filePath);
  const html = exists ? fs.readFileSync(filePath, "utf8") : "";
  const scan = exists ? scanHtmlImages(html) : { imgCount: 0, srcs: [], placeholders: 0, placeholderText: 0, reviewPlaceholder: 0 };
  const isLocalCluster = exists && isLocalClusterGeneratedPage(html);
  const previewSim = isLocalCluster
    ? { route: "passthrough-local-cluster", placeholder: scan.placeholders > 0 || scan.placeholderText > 0, reason: "generated-html-passthrough" }
    : { route: "renderReviewPreviewChrome", ...previewWouldUsePlaceholder(page.pageSlug) };

  const pageSlots = RC1_SLOTS.filter((s) => s.pageSlug === page.pageSlug || (page.pageSlug === "index" && s.pageSlug === "index"));
  const localSlot = page.type === "local-cluster" ? [{ slot: "local" }] : pageSlots;
  const expectedForPage = page.type === "local-cluster" ? 1 : pageSlots.length || 1;
  const assignedForPage = localSlot.filter((s) => {
    const slot = s.slot || "hero";
    const pg = page.type === "local-cluster" ? "local-cluster" : page.pageSlug === "index" ? "index" : page.pageSlug;
    const a = getStoredAssignment(assignments, pg === "local-cluster" ? page.pageSlug : pg, SERVICE, slot);
    return a.assignment?.filePath;
  }).length;

  totalExpectedImages += expectedForPage;
  totalAssignedImages += assignedForPage;
  if (scan.placeholders || scan.placeholderText || scan.reviewPlaceholder) totalPlaceholdersStored += 1;
  if (previewSim.placeholder) totalPlaceholdersPreview += 1;

  pageAudits.push({
    pageSlug: page.pageSlug,
    pageType: page.type,
    fileExists: exists,
    storedImgCount: scan.imgCount,
    storedPlaceholders: scan.placeholders + scan.placeholderText + scan.reviewPlaceholder,
    storedImageSrcs: scan.srcs.slice(0, 3),
    previewRoute: previewSim.route || "renderReviewPreviewChrome",
    previewPlaceholder: previewSim.placeholder ? "YES" : "NO",
    previewReason: previewSim.reason,
    isLocalClusterPassthrough: isLocalCluster,
    expectedImages: expectedForPage,
    assignedImages: assignedForPage,
  });
}
console.log(JSON.stringify(pageAudits, null, 2));

console.log("\n=== 5. SUMMARY ===");
const missingPageScoped = RC1_SLOTS.filter((p) => !assignments.assignments[assignmentKey(p.pageSlug, SERVICE, p.slot)]).length;
const manifestEmpty = finalManifest.imageSlots?.filter((s) => !s.filePath).length ?? 0;
console.log(JSON.stringify({
  expectedRc1Slots: RC1_SLOTS.length,
  campaignScopedAssignments: Object.keys(assignments.assignments).length,
  missingPageScopedAssignments: missingPageScoped,
  finalManifestEmptyPaths: manifestEmpty,
  platformAiAssets: 0,
  storedHtmlPagesWithPlaceholders: pageAudits.filter((p) => p.storedPlaceholders > 0).length,
  previewPagesWithPlaceholders: pageAudits.filter((p) => p.previewPlaceholder === "YES").length,
  totalExpectedImages,
  totalAssignedImages,
  crossTenantUploadFallbackAvailable: collectRealPharmacyUploadImages(path.join(ROOT, "assets/pharmacy-uploads")).length > 0,
}, null, 2));
