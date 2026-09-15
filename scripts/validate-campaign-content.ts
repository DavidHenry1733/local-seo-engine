import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

import type { AssetEnvelope, AssetType, CampaignContentManifest } from "../src/content-engine/types";

const EXPECTED_TOTAL = 29;
const EXPECTED_BY_TYPE: Record<AssetType, number> = {
  blog_post: 4,
  facebook_post: 4,
  linkedin_post: 4,
  gbp_post: 4,
  reddit_post: 4,
  youtube_script: 4,
  youtube_metadata: 4,
  email_sequence: 1,
};

function readJson<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function countSitemapUrls(sitemapPath: string): number {
  const xml = fs.readFileSync(sitemapPath, "utf8");
  return (xml.match(/<loc>/g) ?? []).length;
}

function countRegistryUrls(registryPath: string): number {
  const registry = readJson<{ pages?: unknown[] }>(registryPath);
  return Array.isArray(registry.pages) ? registry.pages.length : 0;
}

function hashFile(filePath: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(filePath)).digest("hex");
}

export interface ValidationReport {
  passed: boolean;
  campaignId: string;
  projectSlug: string;
  checks: Record<string, { passed: boolean; detail: string }>;
  assetCountsByType: Partial<Record<AssetType, number>>;
  registryUrlCount: number;
  sitemapUrlCount: number;
}

export function validateCampaignContent(opts: {
  projectSlug: string;
  campaignId: string;
  outputDir?: string;
  registryHashBefore?: string;
  sitemapHashBefore?: string;
}): ValidationReport {
  const outputDir = opts.outputDir ?? "output";
  const clientDir = path.join(process.cwd(), outputDir, opts.projectSlug);
  const campaignDir = path.join(clientDir, "campaign-content", opts.campaignId);
  const manifestPath = path.join(campaignDir, "campaignContent.json");
  const assetsDir = path.join(campaignDir, "assets");
  const registryPath = path.join(clientDir, "page-registry.json");
  const sitemapPath = path.join(clientDir, "sitemap.xml");

  const checks: ValidationReport["checks"] = {};
  const assetCountsByType: Partial<Record<AssetType, number>> = {};

  checks.manifestExists = {
    passed: fs.existsSync(manifestPath),
    detail: manifestPath,
  };

  let manifest: CampaignContentManifest | null = null;
  if (checks.manifestExists.passed) {
    manifest = readJson(manifestPath);
  }

  const assetFiles = fs.existsSync(assetsDir)
    ? fs.readdirSync(assetsDir).filter((f) => f.endsWith(".json"))
    : [];

  checks.assetFileCount = {
    passed: assetFiles.length === EXPECTED_TOTAL,
    detail: `found ${assetFiles.length}, expected ${EXPECTED_TOTAL}`,
  };

  checks.manifestAssetIndexMatch = {
    passed: !!manifest && manifest.assetIndex.length === assetFiles.length,
    detail: manifest
      ? `index ${manifest.assetIndex.length} vs files ${assetFiles.length}`
      : "manifest missing",
  };

  let allGenerated = true;
  let noneApprovedOrPublished = true;
  let blogValid = true;
  let socialLinked = true;
  let youtubeValid = true;
  let emailValid = true;

  for (const file of assetFiles) {
    const asset = readJson<AssetEnvelope>(path.join(assetsDir, file));
    assetCountsByType[asset.assetType] = (assetCountsByType[asset.assetType] ?? 0) + 1;

    if (asset.status !== "generated") allGenerated = false;
    if (asset.status === "approved" || asset.status === "published") noneApprovedOrPublished = false;

    if (asset.assetType === "blog_post") {
      const p = asset.payload;
      const required = [
        "title",
        "slug",
        "metaTitle",
        "metaDescription",
        "h1",
        "bodyMarkdown",
        "internalLinks",
        "anchorTextSuggestions",
        "articleSchema",
        "faqSchema",
        "linkedHubUrl",
        "linkedClusterUrls",
      ];
      if (required.some((k) => !(k in p))) blogValid = false;
      const links = p.internalLinks as { href: string }[] | undefined;
      const clusters = p.linkedClusterUrls as string[] | undefined;
      if (!links || links.length < 3 || !clusters || clusters.length < 2) blogValid = false;
    }

    if (["facebook_post", "linkedin_post", "gbp_post"].includes(asset.assetType)) {
      if (!asset.payload.linkedUrl) socialLinked = false;
    }

    if (asset.assetType === "youtube_script") {
      if (!asset.payload.script || !asset.payload.title) youtubeValid = false;
    }
    if (asset.assetType === "youtube_metadata") {
      if (!asset.payload.title || !asset.payload.description || !asset.payload.tags) youtubeValid = false;
    }

    if (asset.assetType === "email_sequence") {
      const emails = asset.payload.emails as unknown[] | undefined;
      if (!emails || emails.length !== 4) emailValid = false;
    }
  }

  checks.allStatusesGenerated = { passed: allGenerated, detail: allGenerated ? "ok" : "non-generated status found" };
  checks.noApprovedOrPublished = {
    passed: noneApprovedOrPublished,
    detail: noneApprovedOrPublished ? "ok" : "approved/published found",
  };
  checks.blogFields = { passed: blogValid, detail: blogValid ? "ok" : "blog validation failed" };
  checks.socialLinkedUrls = { passed: socialLinked, detail: socialLinked ? "ok" : "missing linkedUrl" };
  checks.youtubeAssets = { passed: youtubeValid, detail: youtubeValid ? "ok" : "youtube validation failed" };
  checks.emailSequence = { passed: emailValid, detail: emailValid ? "ok" : "email sequence must have 4 emails" };

  for (const [type, expected] of Object.entries(EXPECTED_BY_TYPE) as [AssetType, number][]) {
    const actual = assetCountsByType[type] ?? 0;
    checks[`count_${type}`] = {
      passed: actual === expected,
      detail: `${actual}/${expected}`,
    };
  }

  const registryUrlCount = fs.existsSync(registryPath) ? countRegistryUrls(registryPath) : 0;
  const sitemapUrlCount = fs.existsSync(sitemapPath) ? countSitemapUrls(sitemapPath) : 0;

  if (opts.registryHashBefore && fs.existsSync(registryPath)) {
    checks.registryUnchanged = {
      passed: hashFile(registryPath) === opts.registryHashBefore,
      detail: "sha256 compare",
    };
  } else {
    checks.registryUnchanged = { passed: true, detail: "no before hash supplied; count-only check" };
  }

  if (opts.sitemapHashBefore && fs.existsSync(sitemapPath)) {
    checks.sitemapUnchanged = {
      passed: hashFile(sitemapPath) === opts.sitemapHashBefore,
      detail: "sha256 compare",
    };
  } else {
    checks.sitemapUnchanged = { passed: true, detail: "no before hash supplied; count-only check" };
  }

  checks.registryCount = {
    passed: registryUrlCount === 169,
    detail: `${registryUrlCount} URLs (expected 169)`,
  };
  checks.sitemapCount = {
    passed: sitemapUrlCount === 169,
    detail: `${sitemapUrlCount} URLs (expected 169)`,
  };

  const passed = Object.values(checks).every((c) => c.passed);

  return {
    passed,
    campaignId: opts.campaignId,
    projectSlug: opts.projectSlug,
    checks,
    assetCountsByType,
    registryUrlCount,
    sitemapUrlCount,
  };
}

const projectSlug = process.argv[2] ?? "inboxingproweb";
const campaignId = process.argv[3] ?? "rotherham-webho-ting-5b9958";
const registryHashBefore = process.env.REGISTRY_HASH_BEFORE;
const sitemapHashBefore = process.env.SITEMAP_HASH_BEFORE;
const report = validateCampaignContent({
  projectSlug,
  campaignId,
  registryHashBefore,
  sitemapHashBefore,
});
console.log(report.passed ? "PASS: Campaign content validation" : "FAIL: Campaign content validation");
console.log(JSON.stringify(report, null, 2));
if (!report.passed) process.exitCode = 1;
