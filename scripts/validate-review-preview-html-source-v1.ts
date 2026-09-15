#!/usr/bin/env npx tsx
/**
 * Review Preview HTML Source Audit V1.
 *
 * Confirms Review Centre preview buttons use the dedicated review-preview route and
 * that the rendered HTML source is either visual-experience or review-wrapper.
 */
import fs from "node:fs";
import path from "node:path";
import { URL } from "node:url";
import { renderReviewCentrePage } from "../src/pharmacy/growthEngineReviewCentrePage.ts";
import { getContentPackageReviewSections } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import {
  findPreviewSourceMarker,
  renderBenchmarkPagePreviewHtml,
  renderPackPreviewPage,
  resolveBenchmarkPackAsset,
  sanitizeReviewPreviewHtml,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";

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

function reviewPreviewUrls(html: string): string[] {
  return [
    ...new Set(
      [...html.matchAll(/href="([^"]+)"/g)]
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

function renderReviewPreview(assetKey: string): { html: string; sourcePath: string | null } {
  if (assetKey === "service-page") {
    const sourcePath = resolveVisualExperienceHtmlPath(campaignId as any, slug);
    return { html: sourcePath ? `<!-- PREVIEW_SOURCE: visual-experience -->\n${sanitizeReviewPreviewHtml(fs.readFileSync(sourcePath, "utf8"))}` : "", sourcePath };
  }
  const section = getContentPackageReviewSections(slug, campaignId).find((item) => item.type === assetKey);
  const sourcePath = section?.outputPath || null;
  if (!sourcePath) return { html: "", sourcePath: null };
  const htmlPath = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? firstHtmlInDirectory(sourcePath) : sourcePath;
  if (htmlPath && /\.html$/i.test(htmlPath)) {
    return {
      html: renderBenchmarkPagePreviewHtml(htmlPath, campaignId, slug, path.basename(path.dirname(htmlPath))),
      sourcePath: htmlPath,
    };
  }
  const packId = packIdForSourcePath(sourcePath);
  if (packId) {
    const asset = resolveBenchmarkPackAsset(campaignId, packId, slug);
    return { html: asset ? renderPackPreviewPage(asset, campaignId, slug) || "" : "", sourcePath };
  }
  return { html: "", sourcePath };
}

function hasHeader(html: string): boolean {
  return /<header\b/i.test(html);
}

function hasFooter(html: string): boolean {
  return /<footer\b/i.test(html);
}

function hasImageState(html: string): boolean {
  return /<img\b/i.test(html) || /data-image-missing="true"|Image will be added before publishing/i.test(html);
}

function hasPlaceholderTrustCopy(html: string): boolean {
  return /Professional review details available from the pharmacy|Trust & credentials/i.test(html);
}

async function main(): Promise<void> {
  console.log(`\n=== Review Preview HTML Source Audit V1: ${slug}/${campaignId} ===\n`);
  const reviewHtml = renderReviewCentrePage(slug, campaignId);
  const urls = reviewPreviewUrls(reviewHtml);
  const previews = urls
    .map((previewUrl) => {
      const parsed = new URL(previewUrl, "http://local.test");
      const assetKey = parsed.searchParams.get("asset") || "";
      const rendered = renderReviewPreview(assetKey);
      const marker = findPreviewSourceMarker(rendered.html);
      return {
        previewUrl,
        assetKey,
        sourcePath: rendered.sourcePath,
        marker,
        header: hasHeader(rendered.html),
        footer: hasFooter(rendered.html),
        imageState: hasImageState(rendered.html),
        placeholderTrust: hasPlaceholderTrustCopy(rendered.html),
        rawSocialHeading: /SOCIAL CONTENT LIBRARY/i.test(rendered.html),
        pharmacyDelivered: /Pharmacy Delivered/i.test(rendered.html),
        forbidden: forbidden.test(rendered.html),
      };
    })
    .filter((preview) => preview.assetKey);

  for (const preview of previews) {
    console.log(
      [
        `asset=${preview.assetKey}`,
        `url=${preview.previewUrl}`,
        `source=${preview.sourcePath || "UNMAPPED"}`,
        `marker=${preview.marker || "none"}`,
        `header=${preview.header ? "yes" : "no"}`,
        `footer=${preview.footer ? "yes" : "no"}`,
        `imageState=${preview.imageState ? "yes" : "no"}`,
        `placeholderTrust=${preview.placeholderTrust ? "yes" : "no"}`,
      ].join(" | "),
    );
  }
  console.log("");

  record("preview buttons use review-preview route", previews.length >= 8 && previews.every((p) => p.previewUrl.includes(`/${slug}/review-preview?`)), `${previews.length} preview button(s)`);
  record("source marker is review-wrapper or visual-experience", previews.every((p) => p.marker === "review-wrapper" || p.marker === "visual-experience"), previews.map((p) => `${p.assetKey}:${p.marker}`).join("; "));
  record("header exists", previews.every((p) => p.header), "all rendered previews");
  record("footer exists", previews.every((p) => p.footer), "all rendered previews");
  record("image exists or visible placeholder exists", previews.every((p) => p.imageState), "all rendered previews");
  record("no raw heading SOCIAL CONTENT LIBRARY appears", previews.every((p) => !p.rawSocialHeading), "raw social heading absent");
  record("no placeholder trust copy appears", previews.every((p) => !p.placeholderTrust), "trust placeholder copy absent");
  record("Pharmacy Delivered appears", previews.every((p) => p.pharmacyDelivered), "tenant content present");
  record("Brook/Rowlands/DHM do not appear", previews.every((p) => !p.forbidden), "demo content absent");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
