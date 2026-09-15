/**
 * Canonical Final Render — single artifact for preview, QA, publish and live delivery.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { buildVisualExperiencePage } from "./pharmacyVisualExperience.ts";
import { wrapEcosystemPageWithSiteChrome } from "./pharmacyEcosystemPageChromeWrapper.ts";
import {
  CANONICAL_RENDER_VERSION,
  FINAL_RENDER_MANIFEST_VERSION,
  FINAL_RENDER_ROOT,
} from "./pharmacyCanonicalFinalRenderConfig.ts";
import {
  PHARMACY_WORKSPACE_ROOT,
  getContentEcosystemDir,
  resolveContentEcosystemIndexPath,
} from "./pharmacyWorkspacePaths.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { rewritePublishHtmlForStaticHosting } from "./pharmacyPublishPackageAssembler.ts";
import { resolvePublishWebsiteBase } from "./pharmacyPublishPackageAssembler.ts";
import { readManagedPublishingProfile } from "./masterAdminManagedPublishingService.ts";
import { resolveActivePublishBaseUrl, resolveCustomerEcosystemUrlState } from "./customerEcosystemUrlService.ts";
import { resolveCurrentPharmacyPresentationProfile } from "./pharmacyPresentationProfileResolver.ts";
import { resolveBrandDnaForRender } from "./pharmacyBrandDnaEngine.ts";
import { resolveComponentDnaForRender } from "./pharmacyComponentDnaResolver.ts";
import { assertDesignLineageReadyForRender } from "./pharmacyDesignLineageRevisionService.ts";
import type { VisualExperienceServiceId } from "./pharmacyVisualExperienceConfig.ts";
import {
  validateLocalPageTypeContractHtml,
} from "./pharmacyLocalPageContractValidation.ts";
import {
  LOCAL_HUB_V1_CONTRACT,
  LOCAL_CLUSTER_V1_CONTRACT,
} from "./pharmacyLocalPageTypeContracts.ts";
import {
  auditRenderedHtmlFallbacks,
  forbiddenRenderFallbackFlags,
  getRenderFallbacks,
  resetRenderFallbacks,
  resolveLayoutDnaRevision,
  resolveServicePageTemplateId,
  TENANT_DNA_RENDERER_REVISION,
} from "./pharmacyTenantDnaRenderActivation.ts";
import { computeImageLibraryRevision } from "./pharmacyImageLibraryAssignmentService.ts";
import { buildProductionPageSlotInventory } from "./imagePlatform/pharmacyProductionImageSlotInventoryService.ts";
import { computeProductionAssignmentRevision } from "./imagePlatform/pharmacyImagePlatformProductionAssignmentService.ts";
import {
  IMAGE_PLATFORM_SCHEMA_VERSION,
  isPharmacyFirstProductionLibraryReady,
  loadPharmacyFirstServiceManifestRevision,
  loadProductionLibraryRevision,
} from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { loadImageAssignments, type SlotAssignment } from "./pharmacyImageOperatingSystem.ts";
import {
  getDesignIntelligenceManifestSources,
  printDesignIntelligenceSummary,
  requireDesignIntelligence,
} from "./pharmacyDesignIntelligenceResolver.ts";
import {
  canonicalPageSlugForLocalUrlPath,
} from "./pharmacyLocalLocationGenerationService.ts";
import { applyProductionImageAssignmentsToHtml } from "./pharmacyProductionImageHtmlReplacementService.ts";
import { applyProductionImageAssignmentsToHtml } from "./pharmacyProductionImageHtmlReplacementService.ts";

const ASSET_ROOT = path.join(PHARMACY_WORKSPACE_ROOT, "assets");

export interface FinalRenderPageEntry {
  pageSlug: string;
  pageType:
    | "homepage"
    | "service"
    | "guide"
    | "blog"
    | "faq"
    | "hub"
    | "support"
    | "location-hub"
    | "location-cluster"
    | "location-area";
  relativePath: string;
  checksumSha256: string;
  byteSize: number;
  sourcePipeline: "visual-experience" | "ecosystem-chrome-wrap" | "homepage-copy" | "local-location-engine";
}

export interface FinalRenderAssetEntry {
  relativePath: string;
  checksumSha256: string;
  byteSize: number;
  sourceUrl?: string;
}

export interface FinalRenderManifest {
  version: typeof FINAL_RENDER_MANIFEST_VERSION;
  tenant: string;
  serviceId: string;
  renderVersion: typeof CANONICAL_RENDER_VERSION;
  generatedAt: string;
  sourceProfileRevision: number;
  brandDnaRevision: string;
  componentDnaRevision: string;
  websiteImportRevision: string;
  websiteIntelligenceRevision: string;
  layoutDnaRevision?: string;
  designIntelligenceRevision?: string;
  designIntelligencePath?: string;
  navigationSource?: string;
  headerSource?: string;
  footerSource?: string;
  colourSource?: string;
  imageRoleSource?: string;
  fallbackAttempts?: string[];
  fallbackBlocks?: string[];
  rendererRevision?: string;
  canonicalRenderRevision: string;
  revisionChainComplete: boolean;
  fallbackFlags: string[];
  fallbackReasons: string[];
  defaultTemplateUsed: boolean;
  contentManifestRevision: string;
  canonicalRenderRoot: string;
  managedWebsiteBase: string;
  customerEcosystemBase: string | null;
  activePublishBaseUrl: string;
  publishBaseMode: "internal_managed" | "customer_canonical";
  pages: FinalRenderPageEntry[];
  assets: FinalRenderAssetEntry[];
  pageInventory: string[];
  assetInventory: string[];
  sharedCss: string[];
  sharedJs: string[];
  fonts: string[];
  logoFiles: string[];
  imageFiles: string[];
  headerComponent: string;
  footerComponent: string;
  navigationComponent: string;
  mapConfiguration: { embedPresent: boolean; latitude: string; longitude: string };
  schemaInventory: number;
  sitemap: string;
  registry: string;
  robots: string;
  notFoundPage: string;
  imageLibraryRevision?: string;
  imageAssignmentRevision?: string;
  imagePlatformSchemaVersion?: string;
  productionLibraryRevision?: string;
  pharmacyFirstServiceManifestRevision?: string;
  imagePlatformSlotMappings?: Array<{
    pageSlug: string;
    pageType: string;
    slot: string;
    assetId: string;
    filePath: string;
    assignmentReason: string;
    fallbackAttempts: number;
  }>;
}

export interface BuildCanonicalFinalRenderResult {
  slug: string;
  serviceId: string;
  renderRoot: string;
  manifestPath: string;
  manifest: FinalRenderManifest;
  pageCount: number;
  assetCount: number;
}

function sha256(content: string | Buffer): string {
  return crypto.createHash("sha256").update(content).digest("hex");
}

function sha256File(file: string): string {
  return sha256(fs.readFileSync(file));
}

function writeFileEnsured(file: string, content: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, "utf8");
}

function copyFileEnsured(source: string, dest: string): void {
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
}

function urlPathToPageSlug(urlPath: string): string | null {
  const cleaned = String(urlPath || "").trim();
  if (!cleaned || cleaned === "(pack)") return null;
  return cleaned.replace(/^\/+|\/+$/g, "");
}

function resolveHtmlSource(source: string, ecoDir: string): string | null {
  const trimmed = String(source || "").trim();
  if (!trimmed) return null;
  if (path.isAbsolute(trimmed) && fs.existsSync(trimmed)) return trimmed;
  const fromEco = path.join(ecoDir, trimmed);
  if (fs.existsSync(fromEco)) return fromEco;
  const fromRoot = path.join(PHARMACY_WORKSPACE_ROOT, trimmed.replace(/^\/+/, ""));
  if (fs.existsSync(fromRoot)) return fromRoot;
  return null;
}

function isLocalLocationEcosystemAsset(asset: { urlPath?: string; type?: string; id?: string }): boolean {
  const url = String(asset.urlPath || "");
  return url.startsWith("/local/") || (asset.type || "").toLowerCase().includes("location");
}

function prepareLocalLocationCanonicalHtml(sourceHtml: string, slug: string, serviceId: string, pageSlug: string): string {
  let html = rewritePublishHtmlForStaticHosting(sourceHtml, slug, serviceId, `/${pageSlug}/`);
  html = applyProductionImageAssignmentsToHtml(html, slug, pageSlug, serviceId);
  return html;
}

function writeLocalLocationCanonicalPage(
  renderRoot: string,
  slug: string,
  serviceId: string,
  urlPath: string,
  sourcePath: string,
): FinalRenderPageEntry {
  const canonicalSlug = canonicalPageSlugForLocalUrlPath(urlPath);
  let html = fs.readFileSync(sourcePath, "utf8");
  html = prepareLocalLocationCanonicalHtml(html, slug, serviceId, canonicalSlug);
  const pageType = inferPageType(canonicalSlug, serviceId);
  if (pageType === "location-hub") {
    const check = validateLocalPageTypeContractHtml(html, LOCAL_HUB_V1_CONTRACT);
    if (!check.ok) throw new Error(`Canonical render blocked for ${canonicalSlug}: ${check.blockedReason}`);
  }
  if (pageType === "location-cluster") {
    const check = validateLocalPageTypeContractHtml(html, LOCAL_CLUSTER_V1_CONTRACT);
    if (!check.ok) throw new Error(`Canonical render blocked for ${canonicalSlug}: ${check.blockedReason}`);
  }
  const dest = path.join(renderRoot, canonicalSlug, "index.html");
  writeFileEnsured(dest, html);
  const stat = fs.statSync(dest);
  return {
    pageSlug: canonicalSlug,
    pageType: inferPageType(canonicalSlug, serviceId),
    relativePath: path.relative(renderRoot, dest),
    checksumSha256: sha256File(dest),
    byteSize: stat.size,
    sourcePipeline: "local-location-engine",
  };
}

function inferPageType(pageSlug: string, serviceId: string): FinalRenderPageEntry["pageType"] {
  if (pageSlug === serviceId) return "service";
  if (pageSlug === "local-hub") return "location-hub";
  if (pageSlug.startsWith("local-cluster-")) return "location-cluster";
  if (pageSlug.startsWith("local-") && pageSlug !== "local-hub") return "location-area";
  if (pageSlug.endsWith("-guide")) return "guide";
  if (pageSlug.endsWith("-faqs")) return "faq";
  if (pageSlug.includes("what-is") || pageSlug.includes("who-should")) return "blog";
  if (pageSlug.endsWith("-content-ecosystem")) return "hub";
  return "support";
}

function collectAssetRefs(html: string): string[] {
  const refs = new Set<string>();
  for (const match of html.matchAll(/(?:src|href)=["'](\/assets\/[^"']+)["']/gi)) {
    refs.add(match[1].split("?")[0] || match[1]);
  }
  return [...refs];
}

function copyAssetRef(assetRef: string, outputRoot: string): string | null {
  const rel = assetRef.replace(/^\/+/, "");
  const source = path.join(ASSET_ROOT, rel.replace(/^assets\//, ""));
  const dest = path.join(outputRoot, rel);
  if (!fs.existsSync(source)) return null;
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(source, dest);
  return rel;
}

async function mirrorRemoteBrandAsset(url: string, outputRoot: string, slug: string): Promise<string | null> {
  const trimmed = String(url || "").trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("/assets/") || trimmed.startsWith("assets/")) {
    const rel = trimmed.replace(/^\/+/, "");
    const source = path.join(ASSET_ROOT, rel.replace(/^assets\//, ""));
    if (!fs.existsSync(source)) return null;
    const ext = path.extname(source) || ".png";
    const brandRel = `assets/brands/${slug}/logo${ext}`;
    const dest = path.join(outputRoot, brandRel);
    const assetRootDest = path.join(ASSET_ROOT, brandRel.replace(/^assets\//, ""));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.mkdirSync(path.dirname(assetRootDest), { recursive: true });
    fs.copyFileSync(source, dest);
    fs.copyFileSync(source, assetRootDest);
    return `/${brandRel}`;
  }

  if (trimmed.startsWith("/")) return null;
  try {
    const secureUrl = trimmed.replace(/^http:\/\//i, "https://");
    const res = await fetch(secureUrl, { redirect: "follow" });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const ext = path.extname(new URL(secureUrl).pathname) || ".png";
    const rel = `assets/brands/${slug}/logo${ext}`;
    const dest = path.join(outputRoot, rel);
    const assetRootDest = path.join(ASSET_ROOT, rel.replace(/^assets\//, ""));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.mkdirSync(path.dirname(assetRootDest), { recursive: true });
    fs.writeFileSync(dest, buf);
    fs.writeFileSync(assetRootDest, buf);
    return `/${rel}`;
  } catch {
    return null;
  }
}

function rewriteBrandLogoReferences(html: string, remoteUrl: string, localRef: string): string {
  if (!remoteUrl || !localRef) return html;
  const escaped = remoteUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const httpVariant = remoteUrl.replace(/^https:\/\//i, "http://").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return html
    .replace(new RegExp(escaped, "gi"), localRef)
    .replace(new RegExp(httpVariant, "gi"), localRef);
}

function rewriteInternalNavigation(html: string, pageInventory: string[], managedBase: string): string {
  let out = html;
  const base = managedBase.replace(/\/$/, "");
  for (const slug of pageInventory) {
    if (!slug || slug === "index.html") continue;
    out = out.replace(
      new RegExp(`href="https?://[^"]*/${slug.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}/?"`, "gi"),
      `href="/${slug}/"`,
    );
  }
  out = out.replace(/href="\/\/([^"]+)"/g, 'href="https://$1"');
  out = out.replace(new RegExp(base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"), "");
  return out;
}

function buildSitemapXml(urls: string[], baseUrl: string): string {
  const today = new Date().toISOString().slice(0, 10);
  const body = urls
    .map((u) => {
      const loc = u.startsWith("http") ? u : `${baseUrl.replace(/\/$/, "")}/${u.replace(/^\/+|\/+$/g, "")}/`;
      return `  <url>\n    <loc>${loc.replace(/&/g, "&amp;")}</loc>\n    <lastmod>${today}</lastmod>\n  </url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobotsTxt(baseUrl: string): string {
  return `User-agent: *\nAllow: /\nSitemap: ${baseUrl.replace(/\/$/, "")}/sitemap.xml\n`;
}

function build404Page(serviceId: string): string {
  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Page not found</title>
</head>
<body>
<h1>Page not found</h1>
<p><a href="/">Return to homepage</a></p>
<p><a href="/${serviceId}/">Return to ${serviceId}</a></p>
</body>
</html>`;
}

export function resolveCanonicalFinalRenderRoot(slug: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, FINAL_RENDER_ROOT, slug);
}

export function resolveCanonicalFinalRenderManifestPath(slug: string): string {
  return path.join(resolveCanonicalFinalRenderRoot(slug), "FinalRenderManifest.json");
}

export function resolveCanonicalFinalRenderPagePath(slug: string, pageSlug: string): string | null {
  const file =
    pageSlug === "" || pageSlug === "index"
      ? path.join(resolveCanonicalFinalRenderRoot(slug), "index.html")
      : path.join(resolveCanonicalFinalRenderRoot(slug), pageSlug, "index.html");
  return fs.existsSync(file) ? file : null;
}

export function readFinalRenderManifest(slug: string): FinalRenderManifest | null {
  const file = resolveCanonicalFinalRenderManifestPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as FinalRenderManifest;
  } catch {
    return null;
  }
}

export async function buildCanonicalFinalRender(
  rawSlug: string,
  rawServiceId: string,
): Promise<BuildCanonicalFinalRenderResult> {
  const serviceId = normalizeServiceId(rawServiceId) as VisualExperienceServiceId;
  const slug = resolveTenantProfileSlug(rawSlug) || rawSlug;
  const ecoIndexFile = resolveContentEcosystemIndexPath(rawSlug, serviceId, resolveTenantProfileSlug);
  if (!ecoIndexFile) {
    throw new Error(`Content ecosystem index not found for ${slug}/${serviceId}`);
  }

  const presentation = resolveCurrentPharmacyPresentationProfile(slug);
  const lineage = assertDesignLineageReadyForRender(slug);
  resetRenderFallbacks();
  const designIntelligence = (() => {
    try {
      return requireDesignIntelligence(slug);
    } catch {
      return null;
    }
  })();
  if (designIntelligence) printDesignIntelligenceSummary(designIntelligence);
  const brandDna = resolveBrandDnaForRender(slug);
  const componentDna = resolveComponentDnaForRender(slug, brandDna);
  const eco = JSON.parse(fs.readFileSync(ecoIndexFile, "utf8")) as {
    generatedAt?: string;
    assets?: Array<{ urlPath?: string; outputPath?: string; type?: string }>;
  };
  const ecoDir = getContentEcosystemDir(slug, serviceId);
  const managedProfile = readManagedPublishingProfile(slug);
  const managedBase = (managedProfile?.managedUrl || `https://${slug}.sites.pharmaconnect.uk/`).replace(/\/$/, "");
  const { baseUrl: activeBase, mode: publishBaseMode } = resolveActivePublishBaseUrl(managedProfile, slug);
  const urlState = managedProfile ? resolveCustomerEcosystemUrlState(managedProfile) : null;
  const customerEcosystemBase =
    urlState?.canonicalEcosystemBaseUrl?.replace(/\/$/, "") ||
    (urlState?.fullExpectedHostname ? `https://${urlState.fullExpectedHostname}` : null);
  const renderBase = activeBase.replace(/\/$/, "");
  const renderRoot = resolveCanonicalFinalRenderRoot(slug);
  const auditRoot = path.join(renderRoot, "_audit", `failed-${new Date().toISOString().replace(/[:.]/g, "-")}`);
  if (fs.existsSync(renderRoot)) {
    fs.mkdirSync(auditRoot, { recursive: true });
    for (const entry of fs.readdirSync(renderRoot)) {
      if (entry === "_audit") continue;
      const src = path.join(renderRoot, entry);
      const dest = path.join(auditRoot, entry);
      fs.cpSync(src, dest, { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(renderRoot, { recursive: true });
  }

  for (const entry of fs.readdirSync(renderRoot)) {
    if (entry === "_audit") continue;
    const target = path.join(renderRoot, entry);
    fs.rmSync(target, { recursive: true, force: true });
  }

  const visual = buildVisualExperiencePage(slug, serviceId);
  let serviceHtml = fs.readFileSync(visual.outputPath, "utf8");
  serviceHtml = rewritePublishHtmlForStaticHosting(serviceHtml, slug, serviceId, `/${serviceId}/`);
  serviceHtml = applyProductionImageAssignmentsToHtml(serviceHtml, slug, serviceId, serviceId);

  const homeVisual = buildVisualExperiencePage(slug, serviceId, { pageSlug: "index" });
  let homeHtml = fs.readFileSync(homeVisual.outputPath, "utf8");
  homeHtml = rewritePublishHtmlForStaticHosting(homeHtml, slug, serviceId, "/");
  homeHtml = applyProductionImageAssignmentsToHtml(homeHtml, slug, "index", serviceId);

  const localLogoRef = await mirrorRemoteBrandAsset(brandDna.logoUrl, renderRoot, slug);
  if (lineage.verifiedDesignEvidence && brandDna.logoUrl && !localLogoRef) {
    throw new Error(`Design lineage blocked for ${slug}: verified logo could not be mirrored from import evidence`);
  }
  if (localLogoRef) {
    serviceHtml = rewriteBrandLogoReferences(serviceHtml, brandDna.logoUrl, localLogoRef);
  }

  const serviceDest = path.join(renderRoot, serviceId, "index.html");
  writeFileEnsured(serviceDest, serviceHtml);

  const homepageDest = path.join(renderRoot, "index.html");
  writeFileEnsured(homepageDest, homeHtml.replace(/<link rel="canonical"[^>]*>/i, `<link rel="canonical" href="/"/>`));

  const pages: FinalRenderPageEntry[] = [];
  const pageInventory: string[] = [];

  for (const file of [homepageDest, serviceDest]) {
    const pageSlug = file.endsWith(`${serviceId}/index.html`) ? serviceId : "";
    const stat = fs.statSync(file);
    pages.push({
      pageSlug: pageSlug || "index",
      pageType: pageSlug ? "service" : "homepage",
      relativePath: path.relative(renderRoot, file),
      checksumSha256: sha256File(file),
      byteSize: stat.size,
      sourcePipeline: pageSlug ? "visual-experience" : "homepage-copy",
    });
    pageInventory.push(pageSlug || "index");
  }

  for (const asset of eco.assets || []) {
    const source = resolveHtmlSource(asset.outputPath || "", ecoDir);
    if (!source) continue;

    if (isLocalLocationEcosystemAsset(asset)) {
      const page = writeLocalLocationCanonicalPage(renderRoot, slug, serviceId, asset.urlPath || "", source);
      pages.push(page);
      pageInventory.push(page.pageSlug);
      continue;
    }

    const pageSlug = urlPathToPageSlug(asset.urlPath || "");
    if (!pageSlug || pageSlug === serviceId) continue;

    let html = fs.readFileSync(source, "utf8");
    html = wrapEcosystemPageWithSiteChrome({ slug, serviceId, sourceHtml: html, pageSlug });
    html = applyProductionImageAssignmentsToHtml(html, slug, pageSlug, serviceId);
    html = rewritePublishHtmlForStaticHosting(html, slug, serviceId, `/${pageSlug}/`);
    if (localLogoRef) {
      html = rewriteBrandLogoReferences(html, brandDna.logoUrl, localLogoRef);
    }

    const dest = path.join(renderRoot, pageSlug, "index.html");
    writeFileEnsured(dest, html);
    const stat = fs.statSync(dest);
    pages.push({
      pageSlug,
      pageType: inferPageType(pageSlug, serviceId),
      relativePath: path.relative(renderRoot, dest),
      checksumSha256: sha256File(dest),
      byteSize: stat.size,
      sourcePipeline: "ecosystem-chrome-wrap",
    });
    pageInventory.push(pageSlug);
  }

  const assetEntries: FinalRenderAssetEntry[] = [];
  const assetInventory: string[] = [];
  const refs = new Set<string>();
  for (const page of pages) {
    const html = fs.readFileSync(path.join(renderRoot, page.relativePath), "utf8");
    for (const ref of collectAssetRefs(html)) refs.add(ref);
  }
  if (localLogoRef) refs.add(localLogoRef);

  for (const ref of refs) {
    const copied = copyAssetRef(ref, renderRoot);
    if (!copied) continue;
    const full = path.join(renderRoot, copied);
    const stat = fs.statSync(full);
    assetEntries.push({
      relativePath: copied,
      checksumSha256: sha256File(full),
      byteSize: stat.size,
      sourceUrl: ref.includes("brands/") ? brandDna.logoUrl : undefined,
    });
    assetInventory.push(copied);
  }

  for (const page of pages) {
    const file = path.join(renderRoot, page.relativePath);
    let html = fs.readFileSync(file, "utf8");
    html = rewriteInternalNavigation(html, pageInventory, managedBase);
    fs.writeFileSync(file, html, "utf8");
    const stat = fs.statSync(file);
    page.checksumSha256 = sha256File(file);
    page.byteSize = stat.size;
  }

  const sitemapPath = path.join(renderRoot, "sitemap.xml");
  const sitemapUrls = pages
    .filter((p) => p.pageSlug !== "index")
    .map((p) => p.pageSlug)
    .concat(["index"]);
  fs.writeFileSync(sitemapPath, buildSitemapXml(sitemapUrls.filter((p) => p !== "index"), renderBase), "utf8");

  const robotsPath = path.join(renderRoot, "robots.txt");
  fs.writeFileSync(robotsPath, buildRobotsTxt(renderBase), "utf8");

  const notFoundPath = path.join(renderRoot, "404.html");
  fs.writeFileSync(notFoundPath, build404Page(serviceId), "utf8");

  const schemaCount = pages.reduce((count, page) => {
    const html = fs.readFileSync(path.join(renderRoot, page.relativePath), "utf8");
    return count + (html.match(/application\/ld\+json/g) || []).length;
  }, 0);

  const generatedAt = new Date().toISOString();
  const canonicalRenderRevision = sha256(`${generatedAt}:${pages.length}:${assetEntries.length}:${slug}`);
  const renderFallbackFlags = [
    ...lineage.fallbackFlags,
    ...forbiddenRenderFallbackFlags(slug, serviceHtml),
    ...pages.flatMap((page) =>
      forbiddenRenderFallbackFlags(slug, fs.readFileSync(path.join(renderRoot, page.relativePath), "utf8")),
    ),
  ];
  const uniqueFallbackFlags = [...new Set(renderFallbackFlags)];
  const fallbackReasons = uniqueFallbackFlags.slice();
  const defaultTemplateUsed = resolveServicePageTemplateId(slug) === "lockdown-v1";
  const layoutDnaRevision = resolveLayoutDnaRevision(slug);
  const diSources = designIntelligence ? getDesignIntelligenceManifestSources() : null;
  const fallbackAttempts = getRenderFallbacks().map((f) => `${f.component}:${f.reason}`);
  const fallbackBlocks = getRenderFallbacks().filter((f) => f.forbidden).map((f) => f.component);

  const productionReady =
    serviceId === "pharmacy-first" && isPharmacyFirstProductionLibraryReady();
  const assignmentDoc = loadImageAssignments(slug);
  const imagePlatformSlotMappings = productionReady
    ? buildProductionPageSlotInventory(slug, serviceId).map((plan) => {
        const key = `${plan.pageSlug}:${plan.serviceId}:${plan.slot}`;
        const a = assignmentDoc.assignments[key] as SlotAssignment & {
          assetId?: string;
          assignmentReason?: string;
          fallbackAttempts?: number;
        };
        return {
          pageSlug: plan.pageSlug,
          pageType: plan.pageType,
          slot: plan.slot,
          assetId: a?.assetId || "",
          filePath: a?.filePath || "",
          assignmentReason: a?.assignmentReason || "",
          fallbackAttempts: a?.fallbackAttempts ?? 0,
        };
      })
    : undefined;

  const manifest: FinalRenderManifest = {
    version: FINAL_RENDER_MANIFEST_VERSION,
    tenant: slug,
    serviceId,
    renderVersion: CANONICAL_RENDER_VERSION,
    generatedAt,
    sourceProfileRevision: presentation.profileRevision,
    brandDnaRevision: lineage.brandDnaRevision,
    componentDnaRevision: lineage.componentDnaRevision,
    websiteImportRevision: lineage.websiteImportRevision,
    websiteIntelligenceRevision: lineage.websiteIntelligenceRevision,
    layoutDnaRevision,
    designIntelligenceRevision: designIntelligence?.sourceRevision,
    designIntelligencePath: designIntelligence
      ? path.relative(PHARMACY_WORKSPACE_ROOT, path.join(PHARMACY_WORKSPACE_ROOT, "data/website-design-evidence", slug, "design-intelligence.json"))
      : undefined,
    navigationSource: diSources?.navigationSource,
    headerSource: diSources?.headerSource,
    footerSource: diSources?.footerSource,
    colourSource: diSources?.colourSource,
    imageRoleSource: diSources?.imageRoleSource,
    fallbackAttempts,
    fallbackBlocks,
    rendererRevision: TENANT_DNA_RENDERER_REVISION,
    canonicalRenderRevision,
    revisionChainComplete: lineage.revisionChainComplete,
    fallbackFlags: uniqueFallbackFlags,
    fallbackReasons,
    defaultTemplateUsed,
    contentManifestRevision: eco.generatedAt || generatedAt,
    canonicalRenderRoot: path.relative(PHARMACY_WORKSPACE_ROOT, renderRoot),
    managedWebsiteBase: managedBase,
    customerEcosystemBase,
    activePublishBaseUrl: renderBase,
    publishBaseMode,
    pages,
    assets: assetEntries,
    pageInventory,
    assetInventory,
    sharedCss: ["inline-brand-dna"],
    sharedJs: [],
    fonts: [brandDna.typography.headingFont, brandDna.typography.bodyFont].filter(Boolean),
    logoFiles: localLogoRef ? [localLogoRef.replace(/^\//, "")] : [],
    imageFiles: assetInventory.filter((a) => /\.(png|jpe?g|webp|svg)$/i.test(a)),
    headerComponent: componentDna.variants.headerVariant,
    footerComponent: componentDna.variants.footerVariant,
    navigationComponent: componentDna.variants.navigationVariant,
    mapConfiguration: {
      embedPresent: serviceHtml.includes("google.com/maps") || serviceHtml.includes("iframe"),
      latitude: String(presentation.data.latitude ?? ""),
      longitude: String(presentation.data.longitude ?? ""),
    },
    schemaInventory: schemaCount,
    sitemap: "sitemap.xml",
    registry: "FinalRenderManifest.json",
    robots: "robots.txt",
    notFoundPage: "404.html",
    imageLibraryRevision: productionReady ? undefined : computeImageLibraryRevision(),
    imageAssignmentRevision: productionReady
      ? computeProductionAssignmentRevision(assignmentDoc, buildProductionPageSlotInventory(slug, serviceId))
      : computeImageLibraryRevision(),
    imagePlatformSchemaVersion: productionReady ? IMAGE_PLATFORM_SCHEMA_VERSION : undefined,
    productionLibraryRevision: productionReady ? loadProductionLibraryRevision() : undefined,
    pharmacyFirstServiceManifestRevision: productionReady ? loadPharmacyFirstServiceManifestRevision() : undefined,
    imagePlatformSlotMappings,
  };

  const manifestPath = resolveCanonicalFinalRenderManifestPath(slug);
  writeFileEnsured(manifestPath, JSON.stringify(manifest, null, 2));

  const renderBlockers = uniqueFallbackFlags.filter(
    (flag) => flag.startsWith("forbidden-") || flag.startsWith("image-") || flag === "design-fallback-threshold-exceeded",
  );
  if (renderBlockers.length) {
    throw new Error(`Tenant DNA render contract blocked for ${slug}: ${renderBlockers.join("; ")}`);
  }

  return {
    slug,
    serviceId,
    renderRoot,
    manifestPath,
    manifest,
    pageCount: pages.length,
    assetCount: assetEntries.length,
  };
}

/** Rebuild canonical HTML for local location pages only — preserves homepage, service, and ecosystem articles. */
export async function rebuildCanonicalLocalPagesOnly(
  rawSlug: string,
  rawServiceId: string,
): Promise<{ pagesAdded: number; manifest: FinalRenderManifest }> {
  const serviceId = normalizeServiceId(rawServiceId) as VisualExperienceServiceId;
  const slug = resolveTenantProfileSlug(rawSlug) || rawSlug;
  const manifest = readFinalRenderManifest(slug);
  if (!manifest) throw new Error(`Final render manifest missing for ${slug}`);

  const ecoIndexFile = resolveContentEcosystemIndexPath(rawSlug, serviceId, resolveTenantProfileSlug);
  if (!ecoIndexFile) throw new Error(`Content ecosystem index not found for ${slug}/${serviceId}`);

  const eco = JSON.parse(fs.readFileSync(ecoIndexFile, "utf8")) as {
    assets?: Array<{ urlPath?: string; outputPath?: string; type?: string; id?: string }>;
  };
  const ecoDir = getContentEcosystemDir(slug, serviceId);
  const renderRoot = resolveCanonicalFinalRenderRoot(slug);
  const managedProfile = readManagedPublishingProfile(slug);
  const { baseUrl: activeBase } = resolveActivePublishBaseUrl(managedProfile, slug);
  const renderBase = activeBase.replace(/\/$/, "");

  const localAssetFilter = isLocalLocationEcosystemAsset;

  const isLocalManifestPage = (p: FinalRenderPageEntry) =>
    p.pageType === "location-hub" ||
    p.pageType === "location-cluster" ||
    p.pageType === "location-area" ||
    p.pageSlug.startsWith("local-");

  for (const old of manifest.pages.filter(isLocalManifestPage)) {
    const file = path.join(renderRoot, old.relativePath);
    if (fs.existsSync(file)) {
      fs.rmSync(path.dirname(file), { recursive: true, force: true });
    }
  }

  let pages = manifest.pages.filter((p) => !isLocalManifestPage(p));

  const pageInventory = pages.map((p) => p.pageSlug);
  const added: FinalRenderPageEntry[] = [];

  for (const asset of eco.assets || []) {
    if (!localAssetFilter(asset)) continue;
    const urlPath = asset.urlPath || "";
    const source = resolveHtmlSource(asset.outputPath || "", ecoDir);
    if (!source) continue;

    const page = writeLocalLocationCanonicalPage(renderRoot, slug, serviceId, urlPath, source);
    added.push(page);
    pageInventory.push(page.pageSlug);
  }

  pages = [...pages, ...added];

  for (const page of added) {
    const file = path.join(renderRoot, page.relativePath);
    let html = fs.readFileSync(file, "utf8");
    html = rewriteInternalNavigation(html, pageInventory, renderBase.replace(/\/$/, ""));
    fs.writeFileSync(file, html, "utf8");
    page.checksumSha256 = sha256File(file);
    page.byteSize = fs.statSync(file).size;
  }

  const sitemapUrls = pages.filter((p) => p.pageSlug !== "index").map((p) => p.pageSlug);
  fs.writeFileSync(path.join(renderRoot, "sitemap.xml"), buildSitemapXml(sitemapUrls, renderBase), "utf8");

  const updatedManifest: FinalRenderManifest = {
    ...manifest,
    pages,
    generatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(renderRoot, "FinalRenderManifest.json"), JSON.stringify(updatedManifest, null, 2), "utf8");

  return { pagesAdded: added.length, manifest: updatedManifest };
}

export function copyCanonicalFinalRenderToPublishOutput(slug: string, publishRoot: string): {
  copiedPages: number;
  copiedAssets: number;
  manifest: FinalRenderManifest;
} {
  const manifest = readFinalRenderManifest(slug);
  if (!manifest) throw new Error(`Final render manifest missing for ${slug}`);

  const sourceRoot = resolveCanonicalFinalRenderRoot(slug);
  if (fs.existsSync(publishRoot)) {
    for (const entry of fs.readdirSync(publishRoot)) {
      if (entry.startsWith("_")) continue;
      fs.rmSync(path.join(publishRoot, entry), { recursive: true, force: true });
    }
  } else {
    fs.mkdirSync(publishRoot, { recursive: true });
  }

  let copiedPages = 0;
  let copiedAssets = 0;
  for (const page of manifest.pages) {
    const src = path.join(sourceRoot, page.relativePath);
    const dest = path.join(publishRoot, page.relativePath);
    copyFileEnsured(src, dest);
    copiedPages += 1;
  }
  for (const asset of manifest.assets) {
    const src = path.join(sourceRoot, asset.relativePath);
    const dest = path.join(publishRoot, asset.relativePath);
    if (fs.existsSync(src)) {
      copyFileEnsured(src, dest);
      copiedAssets += 1;
    }
  }
  for (const extra of ["sitemap.xml", "robots.txt", "404.html", "FinalRenderManifest.json"]) {
    const src = path.join(sourceRoot, extra);
    if (fs.existsSync(src)) copyFileEnsured(src, path.join(publishRoot, extra));
  }

  return { copiedPages, copiedAssets, manifest };
}

export function validateCanonicalPublishChecksumParity(
  slug: string,
  publishRoot: string,
  manifest: FinalRenderManifest,
): { ok: boolean; mismatches: string[] } {
  const sourceRoot = resolveCanonicalFinalRenderRoot(slug);
  const mismatches: string[] = [];

  for (const page of manifest.pages) {
    const src = path.join(sourceRoot, page.relativePath);
    const dest = path.join(publishRoot, page.relativePath);
    if (!fs.existsSync(src)) {
      mismatches.push(`Missing canonical page: ${page.relativePath}`);
      continue;
    }
    if (!fs.existsSync(dest)) {
      mismatches.push(`Missing published page: ${page.relativePath}`);
      continue;
    }
    const srcHash = sha256File(src);
    const destHash = sha256File(dest);
    if (srcHash !== destHash) {
      mismatches.push(`Checksum mismatch ${page.relativePath}: canonical ${srcHash.slice(0, 12)} ≠ publish ${destHash.slice(0, 12)}`);
    }
    if (page.checksumSha256 && srcHash !== page.checksumSha256) {
      mismatches.push(`Manifest checksum stale for ${page.relativePath}`);
    }
  }

  for (const asset of manifest.assets) {
    const src = path.join(sourceRoot, asset.relativePath);
    const dest = path.join(publishRoot, asset.relativePath);
    if (!fs.existsSync(src) || !fs.existsSync(dest)) continue;
    if (sha256File(src) !== sha256File(dest)) {
      mismatches.push(`Asset checksum mismatch: ${asset.relativePath}`);
    }
  }

  for (const extra of ["sitemap.xml", "robots.txt", "404.html", "FinalRenderManifest.json"]) {
    const src = path.join(sourceRoot, extra);
    const dest = path.join(publishRoot, extra);
    if (fs.existsSync(src) && fs.existsSync(dest) && sha256File(src) !== sha256File(dest)) {
      mismatches.push(`Checksum mismatch: ${extra}`);
    }
  }

  return { ok: mismatches.length === 0, mismatches };
}
