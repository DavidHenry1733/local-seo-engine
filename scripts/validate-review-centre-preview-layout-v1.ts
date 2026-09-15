#!/usr/bin/env npx tsx
/**
 * Review Centre Preview Layout Fix V1.
 *
 * Checks that Review Centre preview buttons open full/wrapped customer-facing previews.
 */
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { getContentPackageReviewSections } from "../src/pharmacy/pharmacyContentPackageService.ts";
import {
  renderBenchmarkPagePreviewHtml,
  renderPackPreviewPage,
  resolveBenchmarkPackAsset,
  resolveBenchmarkPageHtmlPath,
  sanitizeReviewPreviewHtml,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";

type PreviewKind = "service" | "page" | "local" | "pack" | "other";

interface PreviewResult {
  url: string;
  kind: PreviewKind;
  sourcePath: string | null;
  html: string;
}

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const forbidden = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;
const checks: Check[] = [];

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
}

function read(filePath: string | null): string {
  return filePath ? fs.readFileSync(filePath, "utf8") : "";
}

function reviewPreviewUrls(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/<a[^>]+class="[^"]*\brc-btn-ghost\b[^"]*"[^>]+href="([^"]+)"/g)]
        .map((match) => match[1] || "")
        .map((url) => url.replace(/&amp;/g, "&"))
        .filter((url) => url.startsWith("/api/")),
    ),
  ];
}

function firstHtmlInDirectory(dir: string): string | null {
  if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return null;
  const direct = path.join(dir, "index.html");
  if (fs.existsSync(direct)) return direct;
  for (const name of fs.readdirSync(dir).sort()) {
    const candidate = path.join(dir, name, "index.html");
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
}

function packIdForSourcePath(sourcePath: string): string | null {
  const base = path.basename(sourcePath).replace(/\.(json|md)$/i, "");
  if (base === "gbp-posts") return "gbp-pack";
  if (base === "social-posts") return "social-pack";
  if (base === "email-sequence") return "email-sequence";
  if (base === "video-script") return "video-script";
  return null;
}

function renderPreview(url: string): PreviewResult {
  const parsed = new URL(url, "http://local.test");
  const reviewRoute = parsed.pathname.match(/^\/api\/growth-engine\/([^/]+)\/review-preview$/);
  if (reviewRoute) {
    const routeSlug = decodeURIComponent(reviewRoute[1] || "");
    const assetKey = parsed.searchParams.get("asset") || "";
    const routeCampaign = parsed.searchParams.get("campaign") || campaignId;
    if (assetKey === "service-page") {
      const sourcePath = resolveVisualExperienceHtmlPath(routeCampaign as any, routeSlug);
      return { url, kind: "service", sourcePath, html: sourcePath ? `<!-- PREVIEW_SOURCE: visual-experience -->\n${sanitizeReviewPreviewHtml(read(sourcePath))}` : "" };
    }
    const section = getContentPackageReviewSections(routeSlug, routeCampaign).find((item) => item.type === assetKey);
    const sourcePath = section?.outputPath || null;
    if (!sourcePath) return { url, kind: "other", sourcePath: null, html: "" };
    const htmlPath = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? firstHtmlInDirectory(sourcePath) : sourcePath;
    if (htmlPath && /\.html$/i.test(htmlPath)) {
      return { url, kind: assetKey === "local-area-pages" ? "local" : "page", sourcePath: htmlPath, html: renderBenchmarkPagePreviewHtml(htmlPath, routeCampaign, routeSlug, path.basename(path.dirname(htmlPath))) };
    }
    const packId = packIdForSourcePath(sourcePath);
    if (packId) {
      const asset = resolveBenchmarkPackAsset(routeCampaign, packId, routeSlug);
      return { url, kind: "pack", sourcePath, html: asset ? renderPackPreviewPage(asset, routeCampaign, routeSlug) || "" : "" };
    }
    return { url, kind: "other", sourcePath, html: "" };
  }

  const routeSlug = parsed.searchParams.get("slug") || "";
  const pathname = parsed.pathname;
  const service = pathname.match(/^\/api\/pharmacy-visual-experience\/([^/]+)\/?$/);
  if (service) {
    const sourcePath = resolveVisualExperienceHtmlPath(service[1] as any, routeSlug);
    return { url, kind: "service", sourcePath, html: read(sourcePath) };
  }

  const page = pathname.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/pages\/([^/]+)\/?$/);
  if (page) {
    const sourcePath = resolveBenchmarkPageHtmlPath(page[1]!, page[2]!, routeSlug);
    return {
      url,
      kind: "page",
      sourcePath,
      html: sourcePath ? renderBenchmarkPagePreviewHtml(sourcePath, page[1]!, routeSlug, page[2]!) : "",
    };
  }

  const local = pathname.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/local\/([^/]+)\/?$/);
  if (local) {
    const sourcePath = resolveBenchmarkPageHtmlPath(local[1]!, local[2]!, routeSlug);
    return {
      url,
      kind: "local",
      sourcePath,
      html: sourcePath ? renderBenchmarkPagePreviewHtml(sourcePath, local[1]!, routeSlug, local[2]!) : "",
    };
  }

  const pack = pathname.match(/^\/api\/pharmacy-content-ecosystem-preview\/([^/]+)\/packs\/([^/]+)\/?$/);
  if (pack) {
    const asset = resolveBenchmarkPackAsset(pack[1]!, pack[2]!, routeSlug);
    return {
      url,
      kind: "pack",
      sourcePath: asset?.outputPath || null,
      html: asset ? renderPackPreviewPage(asset, pack[1]!, routeSlug) || "" : "",
    };
  }

  return { url, kind: "other", sourcePath: null, html: "" };
}

function hasHeaderFooter(html: string): boolean {
  return /<header\b/i.test(html) && /<footer\b/i.test(html);
}

function hasImageOrMarker(html: string): boolean {
  return /<img\b/i.test(html) || /data-image-missing="true"/i.test(html) || /Image will be added before publishing/i.test(html);
}

async function main(): Promise<void> {
  console.log(`\n=== Review Centre Preview Layout V1: ${slug}/${campaignId} ===\n`);
  const reviewHtml = renderReviewCentrePage(slug, campaignId);
  const urls = reviewPreviewUrls(reviewHtml);
  const previews = urls.map(renderPreview).filter((preview) => preview.kind !== "other");

  for (const preview of previews) {
    const state = hasHeaderFooter(preview.html)
      ? hasImageOrMarker(preview.html)
        ? "full/wrapped layout with image state"
        : "layout missing image state"
      : "raw/partial content";
    console.log(`${preview.kind} | ${preview.url} | ${state} | ${preview.sourcePath || "UNMAPPED"}`);
  }
  console.log("");

  const servicePreview = previews.find((preview) => preview.kind === "service");
  const wrappedPages = previews.filter((preview) => preview.kind === "page" || preview.kind === "local");
  const packPreviews = previews.filter((preview) => preview.kind === "pack");

  record(
    "service page preview contains header/footer",
    Boolean(servicePreview?.html && hasHeaderFooter(servicePreview.html)),
    servicePreview?.sourcePath || "service preview missing",
  );
  record(
    "service page preview contains image or unavailable marker",
    Boolean(servicePreview?.html && hasImageOrMarker(servicePreview.html)),
    servicePreview?.sourcePath || "service preview missing",
  );
  record(
    "guide/blog/local previews contain header/footer/wrapper",
    wrappedPages.length >= 3 &&
      wrappedPages.every((preview) => hasHeaderFooter(preview.html) && /review-preview-layout|data-review-preview-wrapper|data-component="pharmacy-page-header"/i.test(preview.html)),
    wrappedPages.map((preview) => `${preview.url} => ${preview.sourcePath}`).join("; "),
  );
  record(
    "guide/blog/local previews contain image or unavailable marker",
    wrappedPages.length >= 3 && wrappedPages.every((preview) => hasImageOrMarker(preview.html)),
    wrappedPages.map((preview) => `${preview.url} => ${hasImageOrMarker(preview.html) ? "image-state" : "missing-image-state"}`).join("; "),
  );
  record(
    "social/email previews contain customer-facing wrapper",
    packPreviews.length >= 2 && packPreviews.every((preview) => hasHeaderFooter(preview.html) && /data-review-preview-wrapper="customer-wrapper-v1"/i.test(preview.html)),
    packPreviews.map((preview) => `${preview.url} => ${preview.sourcePath}`).join("; "),
  );
  record(
    "preview URLs point to current tenant/campaign",
    previews.every(
      (preview) =>
        (preview.url.includes(`/${encodeURIComponent(slug)}/review-preview?`) ||
          preview.url.includes(`slug=${encodeURIComponent(slug)}`)) &&
        preview.url.includes(`campaign=${encodeURIComponent(campaignId)}`) &&
        preview.sourcePath?.includes(`/${slug}/${campaignId}/`),
    ),
    previews.map((preview) => `${preview.url} => ${preview.sourcePath || "UNMAPPED"}`).join("; "),
  );
  record("no Brook/Rowlands/DHM strings", previews.every((preview) => !forbidden.test(preview.html)), "preview HTML clean");
  record(
    "Review Centre preview buttons open wrapped/full previews",
    previews.length >= 6 && previews.every((preview) => hasHeaderFooter(preview.html) && hasImageOrMarker(preview.html)),
    `${previews.length} rendered preview button(s) checked`,
  );

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
