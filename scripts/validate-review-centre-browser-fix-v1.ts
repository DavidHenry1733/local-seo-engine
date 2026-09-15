#!/usr/bin/env npx tsx
/**
 * Review Centre Browser Fix V1 validation.
 */
import fs from "node:fs";
import path from "node:path";
import { getContentPackageReviewSections } from "../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveVisualExperienceHtmlPath } from "../src/pharmacy/pharmacyVisualExperience.ts";
import {
  renderBenchmarkPagePreviewHtml,
  renderMissingReviewPreview,
  renderPackPreviewPage,
  resolveBenchmarkPackAsset,
} from "../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";

interface Check {
  id: string;
  pass: boolean;
  detail: string;
}

const slug = process.argv[2] || "pharmacy-delivered-4u-test";
const campaignId = process.argv[3] || "pharmacy-first";
const checks: Check[] = [];
const forbidden = /Brook Pharmacy|Rowlands Pharmacy|DHM Digital|pharmacy\.inboxingproweb\.com|demo pharmacy/i;
const missingMessage = "This content needs to be regenerated before review.";
const unfinishedTrustLeak =
  /Pharmacist and registration details can be added before publishing|GPhC registration details available before publishing|Professional registration details can be added before publishing|Reviewed by the pharmacy team\. Pharmacist and registration details can be added before publishing/i;

function record(id: string, pass: boolean, detail: string): void {
  checks.push({ id, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"} ${id} - ${detail}`);
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

function renderPreview(assetKey: string): { html: string; error: string | null } {
  try {
    if (assetKey === "service-page") {
      const file = resolveVisualExperienceHtmlPath(campaignId as never, slug);
      if (!file) throw new Error("Service page preview source missing");
      return { html: renderBenchmarkPagePreviewHtml(file, campaignId, slug, "service-page"), error: null };
    }

    const section = getContentPackageReviewSections(slug, campaignId).find((sec) => sec.type === assetKey);
    const sourcePath = section?.outputPath || null;
    if (!sourcePath) throw new Error(`Review preview source missing for ${assetKey}`);

    const htmlFile = fs.existsSync(sourcePath) && fs.statSync(sourcePath).isDirectory() ? firstHtmlInDirectory(sourcePath) : sourcePath;
    if (htmlFile && /\.html$/i.test(htmlFile)) {
      return {
        html: renderBenchmarkPagePreviewHtml(htmlFile, campaignId, slug, path.basename(path.dirname(htmlFile))),
        error: null,
      };
    }

    const packId = packIdForSourcePath(sourcePath);
    if (packId) {
      const asset = resolveBenchmarkPackAsset(campaignId, packId, slug);
      if (!asset) throw new Error(`Review pack preview source missing for ${assetKey}`);
      return { html: renderPackPreviewPage(asset, campaignId, slug) || renderMissingReviewPreview(slug, campaignId), error: null };
    }

    return { html: renderMissingReviewPreview(slug, campaignId), error: null };
  } catch (err) {
    return { html: renderMissingReviewPreview(slug, campaignId), error: err instanceof Error ? err.message : String(err) };
  }
}

function hasHeaderFooter(html: string): boolean {
  return /data-component="review-preview-header"/i.test(html) && /data-component="review-preview-footer"/i.test(html);
}

function hasImageState(html: string): boolean {
  return /<img\b/i.test(html) || /data-image-missing="true"/i.test(html);
}

function hasCleanTrustCopy(html: string): boolean {
  return !unfinishedTrustLeak.test(html) && !/Professional review details available from the pharmacy/i.test(html);
}

function textOnly(html: string): string {
  return html.replace(/<script[\s\S]*?<\/script>/gi, " ").replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function main(): void {
  console.log(`\n=== Review Centre Browser Fix V1: ${slug}/${campaignId} ===\n`);
  const previews = {
    service: renderPreview("service-page"),
    local: renderPreview("local-area-pages"),
    blog: renderPreview("blog"),
    guide: renderPreview("guides"),
    faq: renderPreview("faq"),
    social: renderPreview("social"),
    gbp: renderPreview("gbp"),
    email: renderPreview("email"),
  };

  for (const key of ["faq", "social", "gbp", "email"] as const) {
    record(`${key} preview does not throw`, !previews[key].error && !/Review preview error|Cannot read properties/i.test(previews[key].html), previews[key].error || "clean");
  }

  record("service page preview has visible header/footer", hasHeaderFooter(previews.service.html), "review wrapper header/footer");
  record("service page has image or visible placeholder", hasImageState(previews.service.html), "image state present");
  record("local pages have image or visible placeholder", hasImageState(previews.local.html), "image state present");
  record("blog has no Conversion content", !/Conversion content/i.test(previews.blog.html), "customer-facing wording");
  record(
    "guide has headings/section formatting",
    (previews.guide.html.match(/<h2\b/gi) || []).length >= 4 && textOnly(previews.guide.html).length > 500,
    `${(previews.guide.html.match(/<h2\b/gi) || []).length} h2 headings`,
  );
  record("trust block omits unfinished missing-data copy", ["service", "local", "guide"].every((key) => hasCleanTrustCopy(previews[key as keyof typeof previews].html)), "no registration/before-publishing leakage");
  record("no Brook/Rowlands/DHM strings", Object.values(previews).every((preview) => !forbidden.test(preview.html)), "demo content absent");

  const failed = checks.filter((check) => !check.pass);
  console.log(`\n${checks.length - failed.length}/${checks.length} passed\n`);
  if (failed.length) process.exit(1);
}

main();
