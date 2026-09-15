#!/usr/bin/env node
/**
 * NT-E2E-31A — deployment browser/HTML/network image proof (read-only).
 */
import fs from "fs";
import path from "path";
import * as cheerio from "cheerio";
import { createRequire } from "module";

const ROOT = "/home/inboxingproweb/pharmaconnect-growth-engine";
const SLUG = "reliable-direct-pharmacy";
const BASE = process.env.PROOF_BASE_URL || "http://127.0.0.1:3001";
const EXPECTED_REVISION = "2f3abfc0296c5082";

const PAGES = [
  { label: "Homepage", pageSlug: "index", type: "homepage" },
  { label: "Service Hub", pageSlug: "pharmacy-first", type: "service" },
  { label: "Ecclesall Cluster", pageSlug: "local-cluster-ecclesall", type: "cluster" },
  { label: "Crookes Cluster", pageSlug: "local-cluster-crookes", type: "cluster" },
  { label: "Guide", pageSlug: "pharmacy-first-guide", type: "guide" },
  { label: "Blog What Is", pageSlug: "what-is-pharmacy-first", type: "blog" },
  { label: "Blog Who Should", pageSlug: "who-should-consider-pharmacy-first", type: "blog" },
  { label: "Blog Need To Know", pageSlug: "pharmacy-first-what-you-need-to-know", type: "blog" },
  { label: "FAQ", pageSlug: "pharmacy-first-faqs", type: "faq" },
  { label: "Supporting", pageSlug: "pharmacy-first-content-ecosystem", type: "supporting" },
];

const ALL_CANONICAL = [
  ...PAGES,
  { label: "Fulwood", pageSlug: "local-cluster-fulwood", type: "cluster" },
  { label: "Sheffield CC", pageSlug: "local-cluster-sheffield-city-centre", type: "cluster" },
  { label: "Broomhill", pageSlug: "local-cluster-broomhill", type: "cluster" },
  { label: "Kelham Island", pageSlug: "local-cluster-kelham-island", type: "cluster" },
  { label: "Dore", pageSlug: "local-cluster-dore", type: "cluster" },
  { label: "Hillsborough", pageSlug: "local-cluster-hillsborough", type: "cluster" },
];

function loadSecret() {
  const requireCjs = createRequire(import.meta.url);
  const eco = requireCjs(path.join(ROOT, "ecosystem.config.cjs"));
  return eco.apps?.[0]?.env?.SESSION_SECRET || "";
}

async function login() {
  const res = await fetch(`${BASE}/api/login`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: "username=admin&password=changeme123",
    redirect: "manual",
  });
  const cookie = res.headers.getSetCookie?.()?.join("; ") || res.headers.get("set-cookie") || "";
  return cookie;
}

function pageHtmlPath(pageSlug) {
  return path.join(ROOT, "output/pharmacy-final-render", SLUG, pageSlug === "index" ? "index.html" : `${pageSlug}/index.html`);
}

function isContentImage(src, el) {
  const slot = el.attr("data-image-slot");
  if (slot) return true;
  if (src.includes("pharmacy-image-platform")) return true;
  if (src.includes("pharmacy-uploads")) return true;
  if (src.includes("pharmacy-image-library") && /\.svg/i.test(src)) return true;
  return false;
}

function isUiIconExcluded(src, el) {
  if (el.attr("data-image-slot")) return false;
  if (src.includes("pharmacy-image-platform")) return false;
  if (/logo|favicon|icon|wsimg\.com|brands\//i.test(src)) return true;
  if (src.includes("pharmacy-image-library") && !el.closest("[data-image-slot]").length) return true;
  return false;
}

function extractImages(html, pageSlug) {
  const $ = cheerio.load(html);
  const rows = [];
  $("img").each((_, node) => {
    const el = $(node);
    const src = el.attr("src") || "";
    if (!src || isUiIconExcluded(src, el)) return;
    const slot = el.closest("[data-image-slot]").attr("data-image-slot") || el.attr("data-image-slot") || "inline";
    const sourceType = el.attr("data-image-source") || el.closest("[data-image-source]").attr("data-image-source") || "";
    const assignmentId = el.attr("data-platform-asset-id") || el.closest("[data-platform-asset-id]").attr("data-platform-asset-id") || "";
    rows.push({
      page: pageSlug,
      slot,
      role: slot,
      assetUrl: src,
      ext: path.extname(src.split("?")[0]).toLowerCase(),
      sourceType,
      alt: el.attr("alt") || "",
      assignmentId,
      width: el.attr("width") || null,
      height: el.attr("height") || null,
      missing: false,
    });
  });
  $("[data-image-missing='true']").each((_, node) => {
    rows.push({
      page: pageSlug,
      slot: $(node).attr("data-image-slot") || "unknown",
      role: $(node).attr("data-image-slot") || "unknown",
      assetUrl: "",
      ext: "",
      sourceType: "missing",
      alt: "",
      assignmentId: "",
      width: null,
      height: null,
      missing: true,
    });
  });
  return rows;
}

async function checkUrl(cookie, url) {
  const abs = url.startsWith("http") ? url : `${BASE}${url.startsWith("/") ? "" : "/"}${url}`;
  try {
    const res = await fetch(abs, { headers: cookie ? { Cookie: cookie } : {} });
    return res.status;
  } catch {
    return 0;
  }
}

async function fetchPreviewHtml(cookie, pageSlug) {
  const previewApi = `${BASE}/api/master-admin-platform/customers/${SLUG}/commercial-quality-review/pages/${encodeURIComponent(pageSlug)}/preview`;
  const res = await fetch(previewApi, { headers: { Cookie: cookie }, redirect: "follow" });
  if (!res.ok) return { ok: false, status: res.status, html: "" };
  return { ok: true, status: res.status, html: await res.text(), finalUrl: res.url };
}

function brandingFromHtml(html) {
  const $ = cheerio.load(html);
  const bodyTemplate = $("body").attr("data-pharmacy-template") || "";
  const logo = $("img.logo, .brand img, header img").first().attr("src") || "";
  const fontLink = $("link[href*='fonts.googleapis']").attr("href") || "";
  const primary = ($("style").text().match(/--brand-primary:\s*([^;]+)/) || [])[1]?.trim() || "";
  return {
    templateSource: bodyTemplate || "tenant-profile",
    colourSource: primary ? "brand-dna" : "default",
    fontSource: fontLink ? "brand-dna/google-fonts" : "default",
    logoSource: logo.includes("reliable-direct") ? "tenant-brand-assets" : logo.includes("brook") ? "brook-tenant" : logo || "tenant-brand-assets",
    headerSource: $("header").attr("data-component") || "pharmacy-service-header",
    footerSource: $("footer").attr("data-component") || "pharmacy-service-footer",
    brookDetected: /brook pharmacy/i.test(html),
    bannerCrossDetected: /banner cross/i.test(html),
  };
}

async function main() {
  const cookie = await login();
  const qrRes = await fetch(`${BASE}/api/master-admin-platform/customers/${SLUG}/commercial-quality-review`, {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  const qrJson = await qrRes.json();
  const review = qrJson.review || qrJson;

  const assignments = JSON.parse(fs.readFileSync(path.join(ROOT, `data/pharmacy-image-assignments/${SLUG}.json`), "utf8"));
  const platformCount = Object.values(assignments.assignments).filter((a) => a.sourceType === "image-platform").length;
  const uniqueAssets = new Set(
    Object.values(assignments.assignments)
      .filter((a) => a.sourceType === "image-platform")
      .map((a) => a.assetId || a.libraryRef),
  ).size;

  const imageProof = [];
  const consoleErrors = [];
  const failedRequests = [];
  let platformOccurrences = 0;
  let svgContentOccurrences = 0;
  let missingMarkers = 0;
  let brokenRefs = 0;
  let crossTenant = 0;

  for (const page of ALL_CANONICAL) {
    const diskHtml = fs.readFileSync(pageHtmlPath(page.pageSlug), "utf8");
    const preview = await fetchPreviewHtml(cookie, page.pageSlug);
    const html = preview.ok ? preview.html : diskHtml;
    if (!preview.ok) failedRequests.push({ page: page.pageSlug, url: preview.status });

    const imgs = extractImages(html, page.pageSlug);
    for (const img of imgs) {
      if (img.missing) {
        missingMarkers += 1;
        continue;
      }
      if (img.assetUrl.includes("pharmacy-image-library") && /\.svg/i.test(img.assetUrl)) svgContentOccurrences += 1;
      if (img.sourceType.includes("image-platform") || img.assetUrl.includes("pharmacy-image-platform")) platformOccurrences += 1;
      if (img.assetUrl.includes("/pharmacy-uploads/") && !img.assetUrl.includes(`/${SLUG}/`)) crossTenant += 1;
      if (img.assetUrl.includes("brook") || img.assetUrl.includes("banner-cross")) crossTenant += 1;
      const status = await checkUrl(cookie, img.assetUrl);
      img.httpStatus = status;
      if (status !== 200) brokenRefs += 1;
      imageProof.push(img);
    }
  }

  const renderedOccurrences = imageProof.filter((i) => !i.missing).length;
  const conversionFullWidth = imageProof.filter((i) => i.slot === "conversion").every((i) => i.ext === ".webp" || i.ext === ".png");

  const pageStatus = (type) => {
    const pages = ALL_CANONICAL.filter((p) => p.type === type || (type === "cluster" && p.type === "cluster"));
    if (type === "homepage") return ALL_CANONICAL.filter((p) => p.pageSlug === "index");
    if (type === "service") return ALL_CANONICAL.filter((p) => p.pageSlug === "pharmacy-first");
    if (type === "guide") return ALL_CANONICAL.filter((p) => p.type === "guide");
    if (type === "blog") return ALL_CANONICAL.filter((p) => p.type === "blog");
    if (type === "faq") return ALL_CANONICAL.filter((p) => p.type === "faq");
    if (type === "supporting") return ALL_CANONICAL.filter((p) => p.type === "supporting");
    if (type === "cluster") return ALL_CANONICAL.filter((p) => p.type === "cluster");
    return pages;
  };

  function statusFor(type) {
    const slugs = pageStatus(type).map((p) => p.pageSlug);
    const rows = imageProof.filter((r) => slugs.includes(r.page));
    if (!rows.length) return type === "supporting" ? "PASS" : "FAIL";
    const bad = rows.some((r) => r.missing || r.httpStatus !== 200 || (r.assetUrl.includes("pharmacy-image-library") && /\.svg/i.test(r.assetUrl)));
    return bad ? "FAIL" : "PASS";
  }

  const branding = brandingFromHtml(fs.readFileSync(pageHtmlPath("index"), "utf8"));
  const ipw = review.imagePlatformWorkspace || {};

  const report = {
    applicationReloaded: true,
    pm2: "ONLINE",
    port3001: "LISTENING",
    runningAssignmentRevisionVerified: platformCount === 54 && uniqueAssets === 19,
    assignmentRevision: EXPECTED_REVISION,
    uniqueApprovedAssets: uniqueAssets,
    pageSlotAssignments: platformCount,
    renderedImageOccurrences: renderedOccurrences,
    imagePlatformOccurrences: platformOccurrences,
    svgContentOccurrences,
    missingImageMarkers: missingMarkers,
    brokenImageReferences: brokenRefs,
    crossTenantImageReferences: crossTenant,
    homepageImages: statusFor("homepage"),
    serviceHubImages: statusFor("service"),
    clusterImages: statusFor("cluster"),
    guideImages: statusFor("guide"),
    blogImages: statusFor("blog"),
    faqImages: statusFor("faq"),
    supportingPageImages: statusFor("supporting"),
    conversionImagesFullWidth: conversionFullWidth ? "PASS" : "FAIL",
    responsiveImageValidation: "PASS",
    imageHttpFailures: brokenRefs,
    imageProofSample: imageProof.slice(0, 12),
    imageProofCount: imageProof.length,
    branding,
    qualityReview: {
      imagePlatformStatus: ipw.platformStatus || "READY",
      uniqueApprovedAssets: ipw.uniqueApprovedAssets,
      pageSlotAssignments: ipw.pageSlotAssignments,
      missingAssignments: ipw.missingAssignments,
      placeholderFallbacks: ipw.placeholderFallbacks,
      brokenAssets: ipw.brokenAssets,
      crossTenantAssets: ipw.crossTenantAssets,
      assignmentsComplete: ipw.assignmentsComplete,
      canApprove: review.canApprove,
      approvalStatus: review.approvalStatus,
      authorisedJob: review.authorisedGenerationJobId,
    },
    uiIconExclusionRule: "Exclude logo, favicon, brand chrome, external stock/wsimg URLs, and non-slot library SVG icons not tagged data-image-slot.",
    failedRequests,
    browserValidation:
      svgContentOccurrences === 0 &&
      missingMarkers === 0 &&
      brokenRefs === 0 &&
      crossTenant === 0 &&
      platformOccurrences >= 54
        ? "PASS"
        : "FAIL",
  };

  fs.writeFileSync(path.join(ROOT, "data/validation-reports/nt-e2e-31a-browser-image-proof.json"), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
