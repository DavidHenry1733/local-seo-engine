#!/usr/bin/env npx tsx
/**
 * Review Centre Browser Source Mismatch V1.
 *
 * Validates the rendered Review Centre HTML and the browser preview URLs it emits.
 */
import fs from "node:fs";
import pathModule from "node:path";
import { URL } from "node:url";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { buildReviewCentreSourceDebug, getContentPackageReviewSections } from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  renderBenchmarkPagePreviewHtml,
  renderPackPreviewPage,
  resolveBenchmarkPackAsset,
  resolveBenchmarkPageHtmlPath,
  sanitizeReviewPreviewHtml,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const checks: Check[] = [];
const forbidden = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function read(filePath: string): string {
  return fs.readFileSync(filePath, "utf8");
}

function previewUrlsFromReviewHtml(html: string): string[] {
  const urls = [...html.matchAll(/<a[^>]+class="[^"]*\brc-btn-ghost\b[^"]*"[^>]+href="([^"]+)"/g)]
    .map((match) => match[1] || "")
    .map((url) => url.replace(/&amp;/g, "&"))
    .filter((url) => url.startsWith("/api/"));
  return [...new Set(urls)];
}

function firstHtmlInDirectory(dir: string): string | null {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const direct = pathModule.join(dir, "index.html");
  if (fs.existsSync(direct)) return direct;
  for (const name of fs.readdirSync(dir).sort()) {
    const candidate = pathModule.join(dir, name, "index.html");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function packIdForSourcePath(sourcePath: string): string | null {
  const base = pathModule.basename(sourcePath).replace(/\.(json|md)$/i, "");
  if (base === "gbp-posts") return "gbp-pack";
  if (base === "social-posts") return "social-pack";
  if (base === "email-sequence") return "email-sequence";
  if (base === "video-script") return "video-script";
  return null;
}

function previewSourceForUrl(previewUrl: string): { sourcePath: string | null; html: string; mapped: boolean } {
  const parsed = new URL(previewUrl, "http://local.test");
  const path = parsed.pathname;
  const reviewRoute = path.match(/^\/api\/growth-engine\/([^/]+)\/review-preview$/);
  if (reviewRoute) {
    const routeSlug = decodeURIComponent(reviewRoute[1] || "");
    const routeCampaign = parsed.searchParams.get("campaign") || campaignId;
    const assetKey = parsed.searchParams.get("asset") || "";
    if (routeSlug !== slug) return { sourcePath: null, html: "", mapped: false };
    if (assetKey === "service-page") {
      const file = resolveVisualExperienceHtmlPath(routeCampaign as any, routeSlug);
      return { sourcePath: file, html: file ? `<!-- PREVIEW_SOURCE: visual-experience -->\n${sanitizeReviewPreviewHtml(read(file))}` : "", mapped: Boolean(file) };
    }
    const section = getContentPackageReviewSections(routeSlug, routeCampaign).find((item) => item.type === assetKey);
    const sourcePath = section?.outputPath || null;
    if (!sourcePath) return { sourcePath: null, html: "", mapped: false };
    const htmlPath = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? firstHtmlInDirectory(sourcePath) : sourcePath;
    if (htmlPath && /\.html$/i.test(htmlPath)) {
      return { sourcePath: htmlPath, html: renderBenchmarkPagePreviewHtml(htmlPath, routeCampaign, routeSlug, pathModule.basename(pathModule.dirname(htmlPath))), mapped: true };
    }
    const packId = packIdForSourcePath(sourcePath);
    if (packId) {
      const asset = resolveBenchmarkPackAsset(routeCampaign, packId, routeSlug);
      return { sourcePath, html: asset ? renderPackPreviewPage(asset, routeCampaign, routeSlug) || "" : "", mapped: Boolean(asset) };
    }
    return { sourcePath, html: "", mapped: false };
  }
  const routeSlug = parsed.searchParams.get("slug") || "";
  if (routeSlug !== slug) return { sourcePath: null, html: "", mapped: false };

  const visual = path.match(/^\/api\/pharmacy-visual-experience\/([^/]+)\/?$/);
  if (visual) {
    const file = resolveVisualExperienceHtmlPath(visual[1] as any, routeSlug);
    return { sourcePath: file, html: file ? sanitizeReviewPreviewHtml(read(file)) : "", mapped: Boolean(file) };
  }

  const page = path.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/pages\/([^/]+)\/?$/);
  if (page) {
    const file = resolveBenchmarkPageHtmlPath(page[1]!, page[2]!, routeSlug);
    return { sourcePath: file, html: file ? read(file) : "", mapped: Boolean(file) };
  }

  const local = path.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/local\/([^/]+)\/?$/);
  if (local) {
    const file = resolveBenchmarkPageHtmlPath(local[1]!, local[2]!, routeSlug);
    return { sourcePath: file, html: file ? read(file) : "", mapped: Boolean(file) };
  }

  const pack = path.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/packs\/([^/]+)\/?$/);
  if (pack) {
    const asset = resolveBenchmarkPackAsset(pack[1]!, pack[2]!, routeSlug);
    return {
      sourcePath: asset?.outputPath || null,
      html: asset ? renderPackPreviewPage(asset, pack[1]!, routeSlug) || "" : "",
      mapped: Boolean(asset),
    };
  }

  return { sourcePath: null, html: "", mapped: false };
}

async function main(): Promise<void> {
  console.log(`\n=== Review Centre Browser Source V1: ${slug}/${campaignId} ===\n`);
  const reviewHtml = renderReviewCentrePage(slug, campaignId);
  const debug = buildReviewCentreSourceDebug(slug, campaignId);
  const previewUrls = previewUrlsFromReviewHtml(reviewHtml);
  const previewResults = previewUrls.map((url) => ({ url, ...previewSourceForUrl(url) }));

  for (const asset of debug.assets) {
    console.log(
      [
        `asset title=${asset.title}`,
        `group=${asset.group}`,
        `browserPreviewUrl=${asset.browserPreviewUrl || ""}`,
        `sourcePath=${asset.sourcePath || ""}`,
        `tenantSlug=${asset.tenantSlug}`,
        `campaignId=${asset.campaignId}`,
        `generatedStampFound=${asset.generatedStampFound ? "yes" : "no"}`,
        `containsBrook=${asset.containsBrook ? "yes" : "no"}`,
        `containsPharmacyDelivered=${asset.containsPharmacyDelivered ? "yes" : "no"}`,
      ].join(" | "),
    );
  }
  console.log("");

  record("Review Centre HTML contains source debug comment", reviewHtml.includes("<!-- review-source tenant="), "review-source comment");
  record("no demo strings in rendered Review Centre", !forbidden.test(reviewHtml), "rendered Review Centre HTML clean");
  record(
    "every preview URL maps to pharmacy-delivered-4u-test/pharmacy-first",
    previewResults.length > 0 &&
      previewResults.every((result) => result.mapped && result.sourcePath?.includes(`/${slug}/${campaignId}/`)),
    previewResults.map((result) => `${result.url} => ${result.sourcePath || "UNMAPPED"}`).join("; "),
  );

  const service = previewResults.find((result) => {
    const parsed = new URL(result.url, "http://local.test");
    return result.url.includes("/pharmacy-visual-experience/") || parsed.searchParams.get("asset") === "service-page";
  });
  record(
    "service page preview has header/footer/trust/images or unavailable markers",
    Boolean(
      service?.html &&
        /<header\b/i.test(service.html) &&
        /<footer\b/i.test(service.html) &&
        /Trust &amp; credentials|Trust & credentials|pharmacy-trust-cards/i.test(service.html) &&
        (/<img\b/i.test(service.html) || /data-image-missing="true"/i.test(service.html)),
    ),
    service?.sourcePath || "service preview missing",
  );

  const contentUrls = previewResults.filter((result) => {
    const parsed = new URL(result.url, "http://local.test");
    const asset = parsed.searchParams.get("asset") || "";
    return /\/(pages|local|packs)\//.test(parsed.pathname) || ["local-area-pages", "guides", "faq", "blog", "gbp", "social", "email"].includes(asset);
  });
  record(
    "guide/blog/email/social previews contain Pharmacy Delivered",
    contentUrls.every((result) => result.html.includes("Pharmacy Delivered")),
    contentUrls.map((result) => `${result.url} => ${result.sourcePath}`).join("; "),
  );
  record("no Brook/Rowlands/DHM strings in preview renders", previewResults.every((result) => !forbidden.test(result.html)), "preview renders clean");
  record("Review Centre reads same paths printed by generation-output audit", debug.ok, debug.sourceErrors.join("; ") || "source debug ok");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
