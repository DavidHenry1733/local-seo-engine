/**
 * Assembles a complete static publish package from existing generated outputs.
 * Does not regenerate content — overlays visual experience, rewrites preview URLs, bundles assets.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { resolveActivePublishBaseUrl } from "./customerEcosystemUrlService.ts";
import {
  applyAuthoritativeCanonicalToHtml,
  applyAuthoritativeStructuredDataUrlsToHtml,
  publicPathFromPublishedRelativePath,
  resolveAuthoritativePublicationCanonical,
} from "./pharmacyPublicationCanonicalAuthority.ts";
import {
  applyAuthoritativeInternalLinksToHtml,
} from "./pharmacyPublicationInternalLinkAuthority.ts";
import {
  applyAuthoritativePublicationRobotsToHtml,
  inferTechnicalSeoPageTypeFromPublicPath,
} from "./pharmacyPublicationIndexabilityAuthority.ts";
import { VISUAL_EXPERIENCE_ROOT } from "./pharmacyVisualExperienceConfig.ts";
import { canonicalPageSlugForLocalUrlPath } from "./pharmacyLocalLocationGenerationService.ts";
import type { PublishIndexEntry } from "./pharmacyPublishOutputService.ts";
import {
  CANONICAL_RENDER_VERSION,
  FINAL_RENDER_MANIFEST_VERSION,
} from "./pharmacyCanonicalFinalRenderConfig.ts";
import type { FinalRenderManifest, FinalRenderPageEntry } from "./pharmacyCanonicalFinalRenderService.ts";
import { resolveCampaignReleasePackagePlan } from "./masterAdminCampaignReleasePackageComposer.ts";
import { readActiveServiceCampaignSelection } from "./masterAdminActiveServiceCampaignStore.ts";
import { renderReviewCentrePreviewAsset } from "./growthEngineReviewCentrePreviewService.ts";
import { AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET } from "./contentEngine/pharmacyAiLocalPageCandidatePaths.ts";
import { resolveApprovedCurrentRunCandidatePublishReadiness } from "./pharmacyCurrentRunApprovedCandidatePublishAdapter.ts";

const ASSET_ROOT = path.join(PHARMACY_WORKSPACE_ROOT, "assets");

export function resolvePublishWebsiteBase(slug: string): string {
  const managed = readManagedPublishingProfile(slug);
  const { baseUrl } = resolveActivePublishBaseUrl(managed, slug);
  return baseUrl.replace(/\/$/, "");
}

function visualExperienceHtmlPath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, VISUAL_EXPERIENCE_ROOT, slug, serviceId, "index.html");
}

export function rewritePublishHtmlForStaticHosting(
  html: string,
  slug: string,
  serviceId: string,
  publicPath?: string,
): string {
  const escapedSlug = slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const escapedService = serviceId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  let out = html;

  out = out.replace(
    new RegExp(`/api/pharmacy-visual-experience/${escapedService}/[^"'\\s>]*`, "gi"),
    `/${serviceId}/`,
  );
  out = out.replace(
    new RegExp(`/api/pharmacy-content-ecosystem-preview/${escapedService}/pages/([^/?"'\\s>]+)/[^"'\\s>]*`, "gi"),
    "/$1/",
  );
  out = out.replace(
    new RegExp(`/api/pharmacy-content-ecosystem-preview/${escapedService}/local/([^/?"'\\s>]+)/[^"'\\s>]*`, "gi"),
    (_match, segment: string) => {
      const pageSlug = canonicalPageSlugForLocalUrlPath(`/local/${segment}/`);
      return `/${pageSlug}/`;
    },
  );
  out = out.replace(
    new RegExp(`\\?slug=${escapedSlug}(?:&[^"'\\s>]*)?`, "gi"),
    "",
  );
  out = out.replace(/href="\/\/([^"]+)"/g, 'href="https://$1"');
  const pathForCanonical = publicPath || `/${serviceId}/`;
  const resolved = resolveAuthoritativePublicationCanonical({
    slug,
    serviceId,
    publicPath: pathForCanonical,
  });
  const withCanonical = applyAuthoritativeCanonicalToHtml(out, resolved.canonicalUrl, resolved.stalePageUrls);
  const withSchema = applyAuthoritativeStructuredDataUrlsToHtml(withCanonical, {
    slug,
    serviceId,
    publicPath: pathForCanonical,
  });
  const withLinks = applyAuthoritativeInternalLinksToHtml(withSchema, {
    slug,
    serviceId,
    publicPath: pathForCanonical,
  });
  return applyAuthoritativePublicationRobotsToHtml(withLinks, {
    pageType: inferTechnicalSeoPageTypeFromPublicPath(pathForCanonical, serviceId),
    publicationRole: "authoritative_indexable_publication",
    publicPath: pathForCanonical,
    serviceId,
  });
}

function collectAssetRefs(html: string): string[] {
  const refs = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)) {
    refs.add(match[1].split("?")[0] || match[1]);
  }
  return [...refs];
}

function copyAssetRef(assetRef: string, outputRoot: string): boolean {
  const rel = assetRef.replace(/^\/+/, "");
  const source = path.join(ASSET_ROOT, rel.replace(/^assets\//, ""));
  const dest = path.join(outputRoot, rel);
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return true;
}

export function copyPublishAssetDependencies(outputRoot: string): { copied: number; missing: string[] } {
  const refs = new Set<string>();
  for (const file of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!file.isDirectory()) continue;
    const html = path.join(outputRoot, file.name, "index.html");
    if (!fs.existsSync(html)) continue;
    for (const ref of collectAssetRefs(fs.readFileSync(html, "utf8"))) refs.add(ref);
  }
  const rootHtml = path.join(outputRoot, "index.html");
  if (fs.existsSync(rootHtml)) {
    for (const ref of collectAssetRefs(fs.readFileSync(rootHtml, "utf8"))) refs.add(ref);
  }

  let copied = 0;
  const missing: string[] = [];
  for (const ref of refs) {
    if (copyAssetRef(ref, outputRoot)) copied += 1;
    else missing.push(ref);
  }
  return { copied, missing };
}

function rewriteHtmlFiles(outputRoot: string, slug: string, serviceId: string): void {
  for (const entry of fs.readdirSync(outputRoot, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const htmlPath = path.join(outputRoot, entry.name, "index.html");
    if (!fs.existsSync(htmlPath)) continue;
    const rewritten = rewritePublishHtmlForStaticHosting(
      fs.readFileSync(htmlPath, "utf8"),
      slug,
      serviceId,
      publicPathFromPublishedRelativePath(`${entry.name}/index.html`, serviceId),
    );
    fs.writeFileSync(htmlPath, rewritten, "utf8");
  }
}

export function overlayVisualExperienceServicePage(slug: string, serviceId: string, outputRoot: string): boolean {
  const source = visualExperienceHtmlPath(slug, serviceId);
  if (!fs.existsSync(source)) return false;
  const dest = path.join(outputRoot, serviceId, "index.html");
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return true;
}

function stripReviewPreviewChrome(html: string): string {
  return String(html || "")
    .replace(/<style[^>]*data-preview-toolbar="[^"]*"[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<style[^>]*data-candidate-preview="[^"]*"[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<div class="pharmacy-review-preview-toolbar"[^>]*>[\s\S]*?<\/div>\s*/gi, "")
    .replace(/<div class="candidate-preview-toolbar"[^>]*>[\s\S]*?<\/div>\s*/gi, "");
}

function escapePublicPublicationHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Bind public live HTML to the existing publication record.
 * Does not invent clinical sign-off or write a second approval store.
 * After explicit publication, unpublished / pending-authorisation workflow labels
 * must not remain on public pages. Pending clinical-review labels are suppressed
 * unless an authorised clinical review line is already present.
 */
export function applyPublicLivePublicationStatusToHtml(html: string, publishedAt: string): string {
  const source = String(html || "");
  if (
    !source.includes("data-publication-status") &&
    !source.includes("data-clinical-review") &&
    !source.includes("data-publication-authorisation")
  ) {
    return source;
  }
  const day = String(publishedAt || "").trim().slice(0, 10);
  const publicationStatus = /^\d{4}-\d{2}-\d{2}$/.test(day) ? `First published ${day}` : "Published";
  let out = source.replace(
    /<p\b[^>]*\bdata-publication-status="[^"]*"[^>]*>[\s\S]*?<\/p>/gi,
    `<p data-publication-status="published">Publication status: ${escapePublicPublicationHtml(publicationStatus)}</p>`,
  );
  out = out.replace(/<p\b[^>]*\bdata-clinical-review="pending"[^>]*>[\s\S]*?<\/p>\s*/gi, "");
  out = out.replace(/<p\b[^>]*\bdata-publication-authorisation="pending"[^>]*>[\s\S]*?<\/p>\s*/gi, "");
  return out;
}

function materializeApprovedCurrentRunPreviewPages(
  slug: string,
  serviceId: string,
  outputRoot: string,
  plan: ReturnType<typeof resolveCampaignReleasePackagePlan>,
): void {
  const pages = [
    plan.servicePage,
    ...plan.localityPages,
  ].filter((page): page is NonNullable<typeof plan.servicePage> => Boolean(page));
  for (const page of pages) {
    const asset =
      page.previewAsset ||
      (page.pageType === "service" ? "service-page" : AI_LOCAL_AREA_PAGE_PILOT_V3_ASSET);
    const preview = renderReviewCentrePreviewAsset(slug, serviceId, asset, {
      areaSlug: page.areaSlug || undefined,
    });
    if (!preview.html) {
      throw new Error(`Review preview renderer returned no HTML for ${asset}${page.areaSlug ? `:${page.areaSlug}` : ""}`);
    }
    const dest = path.join(outputRoot, page.relativePath);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(
      dest,
      rewritePublishHtmlForStaticHosting(
        stripReviewPreviewChrome(preview.html),
        slug,
        serviceId,
        publicPathFromPublishedRelativePath(page.relativePath, serviceId),
      ),
      "utf8",
    );
  }
}

function buildPublishSitemapXml(urlSlugs: string[], baseUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const body = urlSlugs
    .map((slugPart) => {
      const loc = `${baseUrl.replace(/\/$/, "")}/${slugPart.replace(/^\/+|\/+$/g, "")}/`;
      return `  <url>\n    <loc>${loc.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

/**
 * Materialize the shared campaign publish package from approved Product Owner content.
 * Includes the approved service page plus every approved selected locality page for the
 * active (or provided) campaign identity. Does not regenerate content.
 */
export function materializeServicePagePublishFromVisual(
  slug: string,
  serviceId: string,
  outputRoot: string,
): FinalRenderManifest {
  const selection = readActiveServiceCampaignSelection(slug);
  const candidates = resolveApprovedCurrentRunCandidatePublishReadiness(slug, serviceId);
  const plan = resolveCampaignReleasePackagePlan(slug, {
    campaignId: candidates?.active ? serviceId : selection?.campaignId,
    serviceId: candidates?.active ? serviceId : selection?.serviceId || serviceId,
  });
  if (plan.serviceId && plan.serviceId !== serviceId) {
    throw new Error(
      `Campaign release package service mismatch: expected ${serviceId}, plan resolved ${plan.serviceId}`,
    );
  }
  if (plan.blockers.length || !plan.servicePage) {
    throw new Error(
      `Campaign release package incomplete for ${slug}/${serviceId}: ${plan.blockers.join("; ") || "service page missing"}`,
    );
  }

  if (fs.existsSync(outputRoot)) {
    for (const entry of fs.readdirSync(outputRoot)) {
      if (entry.startsWith("_")) continue;
      fs.rmSync(path.join(outputRoot, entry), { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(outputRoot, { recursive: true });
  }

  const fromApprovedCandidates = plan.servicePage?.sourceRenderer === "review-preview";
  if (fromApprovedCandidates) {
    materializeApprovedCurrentRunPreviewPages(slug, serviceId, outputRoot, plan);
  } else {
    if (!overlayVisualExperienceServicePage(slug, serviceId, outputRoot)) {
      throw new Error(
        `Visual service page missing for ${slug}/${serviceId} — generate the service page before publish.`,
      );
    }

    const serviceHtmlPath = path.join(outputRoot, serviceId, "index.html");
    const rewritten = rewritePublishHtmlForStaticHosting(
      fs.readFileSync(serviceHtmlPath, "utf8"),
      slug,
      serviceId,
      `/${serviceId}/`,
    );
    fs.writeFileSync(serviceHtmlPath, rewritten, "utf8");

    // Copy approved locality pages from campaign-scoped ecosystem output (no regeneration).
    for (const locality of plan.localityPages) {
      const dest = path.join(outputRoot, locality.relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      const localityHtml = rewritePublishHtmlForStaticHosting(
        fs.readFileSync(locality.sourcePath, "utf8"),
        slug,
        serviceId,
        publicPathFromPublishedRelativePath(locality.relativePath, serviceId),
      );
      fs.writeFileSync(dest, localityHtml, "utf8");
    }
  }

  const serviceHtmlPath = path.join(outputRoot, serviceId, "index.html");

  writePublishRootIndex(outputRoot, serviceId, slug);
  writePublish404Page(outputRoot, serviceId);
  copyPublishAssetDependencies(outputRoot);

  const baseUrl = resolvePublishWebsiteBase(slug);
  const now = new Date().toISOString();
  const pages: FinalRenderPageEntry[] = [];

  const rootIndexPath = path.join(outputRoot, "index.html");
  pages.push({
    pageSlug: "index",
    pageType: "homepage",
    relativePath: "index.html",
    checksumSha256: crypto.createHash("sha256").update(fs.readFileSync(rootIndexPath, "utf8")).digest("hex"),
    byteSize: fs.statSync(rootIndexPath).size,
    sourcePipeline: "homepage-copy",
  });

  pages.push({
    pageSlug: serviceId,
    pageType: "service",
    relativePath: `${serviceId}/index.html`,
    checksumSha256: crypto.createHash("sha256").update(fs.readFileSync(serviceHtmlPath, "utf8")).digest("hex"),
    byteSize: fs.statSync(serviceHtmlPath).size,
      sourcePipeline: fromApprovedCandidates ? "review-preview" : "visual-experience",
  });

  for (const locality of plan.localityPages) {
    const dest = path.join(outputRoot, locality.relativePath);
    pages.push({
      pageSlug: locality.pageSlug,
      pageType: "location-area",
      relativePath: locality.relativePath,
      checksumSha256: crypto.createHash("sha256").update(fs.readFileSync(dest, "utf8")).digest("hex"),
      byteSize: fs.statSync(dest).size,
      sourcePipeline: fromApprovedCandidates ? "review-preview" : "local-location-engine",
    });
  }

  const sitemapSlugs = pages.filter((p) => p.pageSlug !== "index").map((p) => p.pageSlug);
  const manifest: FinalRenderManifest = {
    version: FINAL_RENDER_MANIFEST_VERSION,
    tenant: slug,
    serviceId,
    renderVersion: CANONICAL_RENDER_VERSION,
    generatedAt: now,
    sourceProfileRevision: 0,
    brandDnaRevision: "visual-publish",
    componentDnaRevision: "visual-publish",
    websiteImportRevision: "visual-publish",
    websiteIntelligenceRevision: "visual-publish",
    canonicalRenderRevision:
      plan.localityPages.length > 0 ? "campaign-approved-content-v1" : "service-page-visual-v1",
    revisionChainComplete: true,
    fallbackFlags: [],
    fallbackReasons: [],
    defaultTemplateUsed: false,
    contentManifestRevision: plan.contentManifestRevision,
    canonicalRenderRoot: outputRoot,
    managedWebsiteBase: baseUrl,
    customerEcosystemBase: null,
    activePublishBaseUrl: baseUrl,
    publishBaseMode: resolveActivePublishBaseUrl(readManagedPublishingProfile(slug), slug).mode,
    pages,
    assets: [],
    robots: "robots.txt",
    notFoundPage: "404.html",
  };

  fs.writeFileSync(path.join(outputRoot, "FinalRenderManifest.json"), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(outputRoot, "sitemap.xml"), buildPublishSitemapXml(sitemapSlugs, baseUrl));
  fs.writeFileSync(
    path.join(outputRoot, "robots.txt"),
    "User-agent: *\nAllow: /\nSitemap: sitemap.xml\n",
  );

  return manifest;
}

export function writePublishRootIndex(outputRoot: string, serviceId: string, slug?: string): void {
  const target = `/${serviceId}/`;
  const canonical = slug
    ? resolveAuthoritativePublicationCanonical({ slug, serviceId, publicPath: `/${serviceId}/` }).canonicalUrl
    : target;
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta http-equiv="refresh" content="0;url=${target}"/>
<link rel="canonical" href="${canonical}"/>
<title>Redirecting…</title>
</head>
<body>
<p><a href="${target}">Continue to pharmacy website</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputRoot, "index.html"), html, "utf8");
}

export function writePublish404Page(outputRoot: string, serviceId: string): void {
  const html = `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Page not found</title>
</head>
<body>
<h1>Page not found</h1>
<p><a href="/${serviceId}/">Return to homepage</a></p>
</body>
</html>
`;
  fs.writeFileSync(path.join(outputRoot, "404.html"), html, "utf8");
}

export interface FinalizePublishPackageResult {
  visualExperienceApplied: boolean;
  assetsCopied: number;
  missingAssets: string[];
  rootIndexWritten: boolean;
  rewritten: boolean;
  checksumVerified: boolean;
}

export function finalizePharmacyPublishPackage(
  slug: string,
  serviceId: string,
  outputRoot: string,
  _entries: PublishIndexEntry[],
): FinalizePublishPackageResult {
  const manifestPath = path.join(outputRoot, "FinalRenderManifest.json");
  const manifest = fs.existsSync(manifestPath)
    ? (JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
        assets: Array<{ relativePath: string }>;
        pages: Array<{ pageSlug: string; checksumSha256: string }>;
      })
    : null;

  const rootIndex = path.join(outputRoot, "index.html");
  const servicePage = path.join(outputRoot, serviceId, "index.html");
  const hasRoot = fs.existsSync(rootIndex);
  const hasService = fs.existsSync(servicePage);
  const missingAssets: string[] = [];

  if (manifest) {
    for (const asset of manifest.assets) {
      const file = path.join(outputRoot, asset.relativePath);
      if (!fs.existsSync(file)) missingAssets.push(asset.relativePath);
    }
  }

  let checksumVerified = false;
  let pagesVerified = 0;
  if (manifest) {
    for (const page of manifest.pages) {
      const publishFile = path.join(outputRoot, page.relativePath);
      if (!fs.existsSync(publishFile)) continue;
      const publishHash = crypto.createHash("sha256").update(fs.readFileSync(publishFile, "utf8")).digest("hex");
      if (page.checksumSha256 === publishHash) pagesVerified += 1;
    }
    checksumVerified = pagesVerified === manifest.pages.length;
  }

  if (!fs.existsSync(path.join(outputRoot, "404.html"))) {
    writePublish404Page(outputRoot, serviceId);
  }

  return {
    visualExperienceApplied: hasService,
    assetsCopied: manifest?.assets.length || 0,
    missingAssets,
    rootIndexWritten: hasRoot,
    rewritten: false,
    checksumVerified,
  };
}
