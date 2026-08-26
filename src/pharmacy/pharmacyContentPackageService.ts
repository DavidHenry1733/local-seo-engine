/**
 * Content Package workflow — orchestrates ecosystem generation and package manifest.
 */
import fs from "node:fs";
import path from "node:path";
import {
  buildBenchmarkServiceEcosystem,
  type GenerationStamp,
} from "./benchmarkServiceEcosystemBuilder.ts";
import { buildContentGenerationContext } from "./contentEngine/buildContentGenerationContext.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import type { CustomerCampaignGenerationContext } from "./contentEngine/customerCampaignGenerationContext.ts";
import { polishCommercialServicePublicHtml } from "./contentEngine/pharmacyCommercialNarrativePolishV1.ts";
import {
  buildTenantContextBinding,
  enrichContentGenerationContextWithTenantBinding,
  SERVICE_PAGE_GENERATION_SCOPE,
} from "./pharmacyServicePageTenantContextService.ts";
import { buildOutputs } from "./pharmacyCampaignService.ts";
import { loadPharmacyProfile } from "./pharmacyContentBlueprintService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import { getServicePublishingSettings } from "./pharmacyPublishingSettingsService.ts";
import { buildPharmacyServicePageProfile } from "./pharmacyServicePageProfileContext.ts";
import {
  approveServiceAsset,
  getServiceAssetWorkflow,
  markContentReviewed,
  validateVisualPageTenant,
} from "./pharmacyAssetWorkflowService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  buildVisualExperiencePage,
  resolveVisualExperienceHtmlPath,
  type VisualExperienceServiceId,
} from "./pharmacyVisualExperience.ts";
import {
  createGenerationReportBase,
  ensureServiceMasterPublish,
  finalizeDesignMapValidation,
  finalizeFullPackageValidation,
  finalizeEcosystemValidation,
  finalizePackageValidation,
  isBenchmarkVisualService,
  loadGenerationReport,
  packageCanBeApproved,
  saveGenerationReport,
  validateEcosystemTenant,
  validateLocalClusterPages,
  validateServiceBodyContent,
  type GenerationReport,
} from "./pharmacyGenerationIntegrityService.ts";
import {
  REVIEW_TRUST_PACK_ASSET_ID,
  reviewTrustPackExists,
  reviewTrustPackPath,
  writeReviewTrustPack,
} from "./pharmacyReviewTrustPackService.ts";

export { loadGenerationReport } from "./pharmacyGenerationIntegrityService.ts";

export const CONTENT_PACKAGE_GENERATOR_VERSION = "content-engine-lockdown-v1";

export type ContentPackageAssetStatus = "included" | "planned" | "missing" | "error";

export interface ContentPackageAsset {
  type: string;
  title: string;
  status: ContentPackageAssetStatus;
  previewUrl: string | null;
  outputPath: string | null;
  required: boolean;
  included: boolean;
  count: number;
  notes: string;
}

export interface ContentPackageManifest {
  version: 1;
  slug: string;
  serviceId: string;
  serviceName: string;
  generatedAt: string | null;
  generationStamp?: GenerationStamp;
  generatorVersion: string;
  profileUpdatedAt: string | null;
  selectedAreas: string[];
  assets: ContentPackageAsset[];
  previewUrls: string[];
  outputPaths: string[];
  status: "missing" | "generated" | "reviewed" | "approved" | "error";
  reviewedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalStatus: "pending" | "approved";
  generationError: string | null;
  adminDiagnostics: string[];
  generationReportPath: string | null;
  packageValidation: { ok: boolean; detail: string } | null;
  serviceValidation: { ok: boolean; detail: string } | null;
  tenantValidation: { ok: boolean; detail: string } | null;
}

function tenantKey(slug: string): string {
  return resolveTenantProfileSlug(slug) || slug;
}

function packageFile(slug: string, serviceId: string): string {
  const key = tenantKey(slug);
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", key, `${serviceId}.json`);
}

function ecosystemIndexFile(slug: string, serviceId: string): string {
  return path.join(ecosystemRoot(tenantKey(slug), serviceId), "_ecosystem-index.json");
}

export interface ContentPackageHandoffVerification {
  ok: boolean;
  tenant: string;
  serviceId: string;
  ecosystemRoot: string;
  ecosystemIndexPath: string;
  packageManifestPath: string;
  reviewPackageSource: string;
  assetCount: number;
  missing: string[];
  sourceErrors: string[];
  reason: string | null;
}

const FORBIDDEN_DEMO_OUTPUT = [
  { label: "Brook Pharmacy", pattern: /Brook Pharmacy/i },
  { label: "Rowlands Pharmacy", pattern: /Rowlands Pharmacy/i },
  { label: "DHM Digital", pattern: /DHM Digital/i },
  { label: "pharmacy.inboxingproweb.com", pattern: /pharmacy\.inboxingproweb\.com/i },
  { label: "demo pharmacy", pattern: /demo pharmacy/i },
];

function generationStamp(slug: string, serviceId: string, generatedAt: string): GenerationStamp {
  return {
    tenantSlug: tenantKey(slug),
    campaignId: serviceId,
    generatedAt,
    sourceContext: "customer-imported-profile",
  };
}

function isGeneratedOutputPath(filePath: string): boolean {
  return filePath.includes(`${path.sep}output${path.sep}pharmacy-`);
}

function collectSourceFiles(fileOrDir: string): string[] {
  if (!fs.existsSync(fileOrDir)) return [];
  const stat = fs.statSync(fileOrDir);
  if (stat.isFile()) return [fileOrDir];
  if (!stat.isDirectory()) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.(html|json|md)$/i.test(entry.name)) out.push(full);
    }
  };
  walk(fileOrDir);
  return out;
}

function fileHasGenerationStamp(raw: string, slug: string, serviceId: string): boolean {
  const tenantNeedles = [
    `"tenantSlug": "${slug}"`,
    `name="tenantSlug" content="${slug}"`,
    `tenantSlug: ${slug}`,
  ];
  const campaignNeedles = [
    `"campaignId": "${serviceId}"`,
    `name="campaignId" content="${serviceId}"`,
    `campaignId: ${serviceId}`,
  ];
  return (
    tenantNeedles.some((needle) => raw.includes(needle)) &&
    campaignNeedles.some((needle) => raw.includes(needle)) &&
    raw.includes("customer-imported-profile")
  );
}

export function verifyContentPackageReviewSources(slug: string, serviceId: string): { ok: boolean; errors: string[] } {
  const key = tenantKey(slug);
  const errors: string[] = [];
  const manifestPath = packageFile(key, serviceId);
  if (!fs.existsSync(manifestPath)) {
    return { ok: false, errors: [`review package source missing: ${manifestPath}`] };
  }

  let manifest: ContentPackageManifest;
  try {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as ContentPackageManifest;
  } catch (err) {
    return { ok: false, errors: [`review package source unreadable: ${manifestPath} (${String(err)})`] };
  }

  if (manifest.slug !== key || manifest.serviceId !== serviceId) {
    errors.push(`review package source mismatch: ${manifestPath} has ${manifest.slug}/${manifest.serviceId}`);
  }
  if (manifest.generationStamp?.tenantSlug !== key || manifest.generationStamp?.campaignId !== serviceId) {
    errors.push(`review package source missing matching generation stamp: ${manifestPath}`);
  }

  for (const asset of manifest.assets || []) {
    if (!asset.outputPath || !asset.included || !isGeneratedOutputPath(asset.outputPath)) continue;
    const files = collectSourceFiles(asset.outputPath);
    if (!files.length) {
      errors.push(`review asset source missing: ${asset.outputPath}`);
      continue;
    }
    for (const file of files) {
      const raw = fs.readFileSync(file, "utf8");
      const leaked = FORBIDDEN_DEMO_OUTPUT.find((item) => item.pattern.test(raw));
      if (leaked) errors.push(`Demo content leakage detected: ${leaked.label} in ${file}`);
      if (!fileHasGenerationStamp(raw, key, serviceId)) {
        errors.push(`review asset source missing matching generation stamp: ${file}`);
      }
    }
  }

  return { ok: errors.length === 0, errors };
}

export interface ReviewCentreSourceDebugAsset {
  title: string;
  group: string;
  browserPreviewUrl: string | null;
  sourcePath: string | null;
  tenantSlug: string;
  campaignId: string;
  generatedStampFound: boolean;
  containsBrook: boolean;
  containsPharmacyDelivered: boolean;
  staleDemoStrings: string[];
}

export interface ReviewCentreSourceDebug {
  ok: boolean;
  slug: string;
  campaignId: string;
  packagePath: string;
  ecosystemIndexPath: string;
  ecosystemPath: string;
  assetSourcePaths: string[];
  previewUrls: string[];
  staleDemoStringScanResults: Array<{ path: string; matches: string[] }>;
  reviewCentreAssetMapMatchesGeneratedOutputPaths: boolean;
  sourceErrors: string[];
  assets: ReviewCentreSourceDebugAsset[];
}

function scanForbiddenStrings(raw: string): string[] {
  return FORBIDDEN_DEMO_OUTPUT.filter((item) => item.pattern.test(raw)).map((item) => item.label);
}

function readSourceRaw(sourcePath: string | null): string {
  if (!sourcePath || !fs.existsSync(sourcePath)) return "";
  if (fs.statSync(sourcePath).isDirectory()) {
    return collectSourceFiles(sourcePath)
      .map((file) => fs.readFileSync(file, "utf8"))
      .join("\n");
  }
  return fs.readFileSync(sourcePath, "utf8");
}

export function buildReviewCentreSourceDebug(slug: string, serviceId: string): ReviewCentreSourceDebug {
  const key = tenantKey(slug);
  const packagePath = packageFile(key, serviceId);
  const ecosystemPath = ecosystemRoot(key, serviceId);
  const ecosystemIndexPath = path.join(ecosystemPath, "_ecosystem-index.json");
  const manifest = loadContentPackage(key, serviceId);
  const sourceCheck = verifyContentPackageReviewSources(key, serviceId);
  const assets: ReviewCentreSourceDebugAsset[] = [];
  const staleDemoStringScanResults: Array<{ path: string; matches: string[] }> = [];

  for (const asset of manifest?.assets || []) {
    const raw = readSourceRaw(asset.outputPath);
    const matches = raw ? scanForbiddenStrings(raw) : [];
    if (matches.length && asset.outputPath) staleDemoStringScanResults.push({ path: asset.outputPath, matches });
    assets.push({
      title: asset.title,
      group: asset.type,
      browserPreviewUrl: asset.previewUrl,
      sourcePath: asset.outputPath,
      tenantSlug: key,
      campaignId: serviceId,
      generatedStampFound: raw ? fileHasGenerationStamp(raw, key, serviceId) : false,
      containsBrook: /Brook Pharmacy/i.test(raw),
      containsPharmacyDelivered: /Pharmacy Delivered/i.test(raw),
      staleDemoStrings: matches,
    });
  }

  const generatedRootNeedle = `${path.sep}output${path.sep}pharmacy-`;
  const sourcePaths = assets.map((asset) => asset.sourcePath).filter(Boolean) as string[];
  const previewUrls = assets.map((asset) => asset.browserPreviewUrl).filter(Boolean) as string[];
  const mappedPathsOk = assets
    .filter((asset) => asset.sourcePath?.includes(generatedRootNeedle))
    .every((asset) => asset.generatedStampFound && asset.tenantSlug === key && asset.campaignId === serviceId);

  return {
    ok: sourceCheck.ok && mappedPathsOk,
    slug: key,
    campaignId: serviceId,
    packagePath,
    ecosystemIndexPath,
    ecosystemPath,
    assetSourcePaths: sourcePaths,
    previewUrls,
    staleDemoStringScanResults,
    reviewCentreAssetMapMatchesGeneratedOutputPaths: mappedPathsOk,
    sourceErrors: sourceCheck.errors,
    assets,
  };
}

export function verifyContentPackageHandoff(
  slug: string,
  serviceId: string,
  options: { scope?: "full" | "service-page-only" } = {},
): ContentPackageHandoffVerification {
  const key = tenantKey(slug);
  const ecoRoot = ecosystemRoot(key, serviceId);
  const ecosystemIndexPath = path.join(ecoRoot, "_ecosystem-index.json");
  const packageManifestPath = packageFile(key, serviceId);
  const servicePageOnly = options.scope === "service-page-only";
  const missing: string[] = [];
  const sourceErrors: string[] = [];
  let assetCount = 0;

  if (!servicePageOnly && !fs.existsSync(ecosystemIndexPath)) {
    missing.push(`ecosystem index missing: ${ecosystemIndexPath}`);
  }
  if (!fs.existsSync(packageManifestPath)) {
    missing.push(`content package manifest missing: ${packageManifestPath}`);
  } else {
    try {
      const manifest = JSON.parse(fs.readFileSync(packageManifestPath, "utf8")) as ContentPackageManifest;
      assetCount = (manifest.assets || []).filter((asset) => asset.included || asset.required).length;
      if (!Array.isArray(manifest.assets) || manifest.assets.length === 0) {
        missing.push(`asset list missing or empty in manifest: ${packageManifestPath}`);
      }
      if (assetCount === 0) {
        missing.push(`review asset list has no included or required assets: ${packageManifestPath}`);
      }
    } catch (err) {
      missing.push(`content package manifest unreadable: ${packageManifestPath} (${String(err)})`);
    }
  }
  sourceErrors.push(...verifyContentPackageReviewSources(key, serviceId).errors);

  return {
    ok: missing.length === 0 && sourceErrors.length === 0,
    tenant: key,
    serviceId,
    ecosystemRoot: ecoRoot,
    ecosystemIndexPath,
    packageManifestPath,
    reviewPackageSource: packageManifestPath,
    assetCount,
    missing,
    sourceErrors,
    reason: [...missing, ...sourceErrors].length ? [...missing, ...sourceErrors].join("; ") : null,
  };
}

export function loadContentPackage(slug: string, serviceId: string): ContentPackageManifest | null {
  const file = packageFile(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as ContentPackageManifest;
  } catch {
    return null;
  }
}

function saveContentPackage(manifest: ContentPackageManifest): void {
  const file = packageFile(manifest.slug, manifest.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
}

export function contentPackageGenerated(slug: string, serviceId: string): boolean {
  const pkg = loadContentPackage(slug, serviceId);
  return Boolean(pkg && pkg.status !== "missing" && pkg.status !== "error" && pkg.generatedAt);
}

export function contentPackageReviewed(slug: string, serviceId: string): boolean {
  const pkg = loadContentPackage(slug, serviceId);
  if (pkg?.reviewedAt) return true;
  return Boolean(getServiceAssetWorkflow(slug, serviceId).contentReviewedAt);
}

export function contentPackageApproved(slug: string, serviceId: string): boolean {
  const pkg = loadContentPackage(slug, serviceId);
  if (pkg?.approvalStatus === "approved") return true;
  return Boolean(getServiceAssetWorkflow(slug, serviceId).assetApprovedAt);
}

function ensureMasterPublish(
  slug: string,
  selectedServiceId: string,
  localArea: string,
  report: GenerationReport,
  skipCanonicalPublishCopy = false,
  contentContext?: ContentGenerationContext,
): string {
  return ensureServiceMasterPublish(slug, selectedServiceId, localArea, report, true, {
    skipCanonicalPublishCopy,
    contentContext,
  });
}

function ensureVisualPreview(
  slug: string,
  selectedServiceId: string,
  localArea: string,
  report: GenerationReport,
  skipCanonicalPublishCopy = false,
  contentContext?: ContentGenerationContext,
): string {
  const masterPath = ensureMasterPublish(slug, selectedServiceId, localArea, report, skipCanonicalPublishCopy, contentContext);
  if (!isBenchmarkVisualService(selectedServiceId)) {
    const existing = resolveVisualExperienceHtmlPath(selectedServiceId as VisualExperienceServiceId, slug);
    if (existing) return existing;
    throw new Error(
      "We could not create this content package because the selected service content is missing.",
    );
  }
  const result = buildVisualExperiencePage(slug, selectedServiceId, {
    selectedServiceId,
    generationReport: report,
    sourcePathOverride: masterPath,
    contentContextOverride: contentContext,
  });
  // Content-planner polish: strip duplicate intros / planner labels from public HTML.
  try {
    const profile = buildPharmacyServicePageProfile(slug);
    const meta = getServicePublishMeta(selectedServiceId);
    const polished = polishCommercialServicePublicHtml(fs.readFileSync(result.outputPath, "utf8"), {
      pharmacyName: profile.pharmacyName,
      town: profile.town || localArea,
      serviceName: meta?.serviceName || selectedServiceId,
      phone: profile.displayPhone || profile.phone,
      nearbyAreaNames: contentContext?.selectedAreas?.map((a) => a.areaName) || [],
    });
    fs.writeFileSync(result.outputPath, polished, "utf8");
  } catch {
    /* keep rendered page if polish fails */
  }
  return result.outputPath;
}

function ecosystemRoot(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId);
}

interface EcosystemIndexAsset {
  id: string;
  type: string;
  outputPath: string;
}

function loadEcosystemIndexAssets(slug: string, serviceId: string): EcosystemIndexAsset[] {
  const ecoIndex = path.join(ecosystemRoot(slug, serviceId), "_ecosystem-index.json");
  if (!fs.existsSync(ecoIndex)) return [];
  try {
    const index = JSON.parse(fs.readFileSync(ecoIndex, "utf8")) as { assets?: EcosystemIndexAsset[] };
    return (index.assets || []).filter((a) => a.outputPath && fs.existsSync(a.outputPath));
  } catch {
    return [];
  }
}

function pageSlugFromOutputPath(outputPath: string): string | null {
  const normalized = outputPath.replace(/\\/g, "/");
  return normalized.match(/\/pages\/([^/]+)\/index\.html$/)?.[1] ?? null;
}

function areaSlugFromOutputPath(outputPath: string): string | null {
  const normalized = outputPath.replace(/\\/g, "/");
  return normalized.match(/\/local\/([^/]+)\/index\.html$/)?.[1] ?? null;
}

function ecosystemPreviewBase(serviceId: string, slug: string): string {
  return `/api/pharmacy-content-ecosystem-preview/${encodeURIComponent(serviceId)}`;
}

function ecosystemPagePreviewUrl(serviceId: string, slug: string, outputPath?: string | null): string | null {
  if (!outputPath) return null;
  const pageSlug = pageSlugFromOutputPath(outputPath);
  if (pageSlug) {
    return `${ecosystemPreviewBase(serviceId, slug)}/pages/${encodeURIComponent(pageSlug)}/?slug=${encodeURIComponent(slug)}`;
  }
  const areaSlug = areaSlugFromOutputPath(outputPath);
  if (areaSlug) {
    return `${ecosystemPreviewBase(serviceId, slug)}/local/${encodeURIComponent(areaSlug)}/?slug=${encodeURIComponent(slug)}`;
  }
  return null;
}

function ecosystemPackPreviewUrl(serviceId: string, slug: string, packId: string): string {
  return `${ecosystemPreviewBase(serviceId, slug)}/packs/${encodeURIComponent(packId)}/?slug=${encodeURIComponent(slug)}`;
}

function ecosystemLocalClusterCount(slug: string, serviceId: string): number {
  const ecoDir = ecosystemRoot(slug, serviceId);
  const localDir = path.join(ecoDir, "local");
  if (fs.existsSync(localDir)) {
    return fs.readdirSync(localDir, { withFileTypes: true }).filter((d) => d.isDirectory()).length;
  }
  const indexPath = path.join(ecoDir, "_ecosystem-index.json");
  if (!fs.existsSync(indexPath)) return 0;
  try {
    const index = JSON.parse(fs.readFileSync(indexPath, "utf8")) as {
      localClusterPagesGenerated?: number;
      assets?: Array<{ id: string }>;
    };
    return (
      index.localClusterPagesGenerated ??
      (index.assets || []).filter((a) => a.id.startsWith("local-cluster-")).length
    );
  } catch {
    return 0;
  }
}

function ecosystemAssetTenantOk(filePath: string, slug: string, pharmacyName: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const key = tenantKey(slug);
  const raw = fs.readFileSync(filePath, "utf8");
  if (key !== "pharmaconnect" && /Brook Pharmacy/i.test(raw)) return false;
  if (key !== "pharmaconnect" && raw.includes("/pharmacy-content-ecosystem/pharmaconnect/")) return false;
  if (pharmacyName && key !== "pharmaconnect" && filePath.endsWith(".html") && !raw.includes(pharmacyName)) {
    return false;
  }
  return true;
}

function areaPageCount(slug: string, serviceId: string): number {
  const dir = path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-generated-service-area-pages", slug);
  if (!fs.existsSync(dir)) return 0;
  return fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".json") && f !== "_index.json" && f.startsWith(`${serviceId}-`)).length;
}

function buildPackageAssets(slug: string, serviceId: string, report?: GenerationReport | null): ContentPackageAsset[] {
  const outputs = buildOutputs(slug, serviceId);
  const serviceName = getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ");
  const pageProfile = buildPharmacyServicePageProfile(slug);
  const visualPath = resolveVisualExperienceHtmlPath(serviceId as VisualExperienceServiceId, slug);
  const visualExists = Boolean(visualPath && fs.existsSync(visualPath));
  const visualHtml = visualExists ? fs.readFileSync(visualPath!, "utf8") : "";
  const serviceContentOk = visualExists ? validateServiceBodyContent(visualHtml, serviceId).ok : false;
  const visualCheck = validateVisualPageTenant(slug, serviceId, pageProfile.pharmacyName);
  const visualOk = visualExists && serviceContentOk && visualCheck.ok && (report?.serviceValidation.ok ?? true);
  const imageDoc = loadImageAssignments(slug);
  const imageCount = Object.keys(imageDoc.assignments || {}).filter((k) => k.startsWith(`${serviceId}:`)).length;
  const publishing = getServicePublishingSettings(slug, serviceId);
  const ecoDir = ecosystemRoot(slug, serviceId);
  const ecoIndex = path.join(ecoDir, "_ecosystem-index.json");
  const ecoExists = fs.existsSync(ecoIndex);
  const ecoAssets = loadEcosystemIndexAssets(slug, serviceId);
  const faqPage = ecoAssets.find((a) => a.id === "faq-page");
  const guidePage = ecoAssets.find((a) => a.id === "patient-guide");
  const blogPages = ecoAssets.filter((a) => a.type === "Blog post");
  const faqFile = faqPage?.outputPath || path.join(ecoDir, "packs/faq-page.json");
  const guideFile = guidePage?.outputPath || path.join(ecoDir, "packs/patient-guide.json");
  const blogFile = blogPages[0]?.outputPath || path.join(ecoDir, "packs/blog-posts.json");
  const gbpFile = path.join(ecoDir, "packs/gbp-posts.json");
  const socialFile = path.join(ecoDir, "packs/social-posts.json");
  const emailFile = path.join(ecoDir, "packs/email-sequence.json");
  const faqExists = Boolean(faqPage);
  const guideExists = Boolean(guidePage);
  const blogExists = blogPages.length > 0;
  const gbpExists = fs.existsSync(gbpFile);
  const socialExists = fs.existsSync(socialFile);
  const emailExists = fs.existsSync(emailFile);
  const localClusterPages = ecoAssets.filter((a) => a.id.startsWith("local-cluster-"));
  const selectedAreasExpected = report?.selectedAreasExpected ?? report?.selectedAreas?.length ?? 0;
  const localClusterCount = ecosystemLocalClusterCount(slug, serviceId);
  const localClusterOk =
    selectedAreasExpected === 0
      ? localClusterCount >= 0
      : localClusterCount === selectedAreasExpected && (report?.localClusterValidation?.ok ?? true);
  const faqTenantOk = faqPage ? ecosystemAssetTenantOk(faqPage.outputPath, slug, pageProfile.pharmacyName) : false;
  const guideTenantOk = guidePage ? ecosystemAssetTenantOk(guidePage.outputPath, slug, pageProfile.pharmacyName) : false;
  const blogTenantOk =
    blogPages.length > 0 &&
    blogPages.every((p) => ecosystemAssetTenantOk(p.outputPath, slug, pageProfile.pharmacyName));
  const gbpTenantOk = gbpExists ? ecosystemAssetTenantOk(gbpFile, slug, pageProfile.pharmacyName) : false;
  const socialTenantOk = socialExists ? ecosystemAssetTenantOk(socialFile, slug, pageProfile.pharmacyName) : false;
  const emailTenantOk = emailExists ? ecosystemAssetTenantOk(emailFile, slug, pageProfile.pharmacyName) : false;
  const faqIncluded = faqExists && faqTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const guideIncluded = guideExists && guideTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const blogIncluded = blogExists && blogTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const gbpIncluded = gbpExists && gbpTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const socialIncluded = socialExists && socialTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const emailIncluded = emailExists && emailTenantOk && (report?.ecosystemTenantValidation?.ok ?? true);
  const localIncluded = localClusterOk && localClusterCount > 0;
  const localClusterOutputDir = path.join(ecoDir, "local");

  const out = outputs.find((o) => o.id === "service-page");
  const local = outputs.find((o) => o.id === "local-service-page");
  const faq = outputs.find((o) => o.id === "faq-page");
  const guide = outputs.find((o) => o.id === "patient-guide");
  const blog = outputs.find((o) => o.id === "blog-posts");
  const gbp = outputs.find((o) => o.id === "gbp-posts");
  const social = outputs.find((o) => o.id === "social-posts");
  const email = outputs.find((o) => o.id === "email-sequence");

  const visualPathResolved = visualPath || null;
  const previewBase = `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`;
  const ecoPreview = `${ecosystemPreviewBase(serviceId, slug)}/?slug=${encodeURIComponent(slug)}`;
  const localPreview =
    localClusterPages.length > 0
      ? ecosystemPagePreviewUrl(serviceId, slug, localClusterPages[0]?.outputPath) || ecoPreview
      : ecoPreview;
  const faqPreview = ecosystemPagePreviewUrl(serviceId, slug, faqFile);
  const guidePreview = ecosystemPagePreviewUrl(serviceId, slug, guideFile);
  const blogPreview = ecosystemPagePreviewUrl(serviceId, slug, blogFile);

  const assets: ContentPackageAsset[] = [
    {
      type: "service-page",
      title: `${serviceName} service page`,
      status: visualOk ? "included" : visualExists ? "error" : "missing",
      previewUrl: visualOk ? previewBase : null,
      outputPath: visualPathResolved,
      required: true,
      included: visualOk,
      count: visualOk ? 1 : 0,
      notes: !visualExists
        ? "Service page not generated"
        : !serviceContentOk
          ? "Wrong service content detected"
          : visualCheck.reason === "wrong_tenant_brook"
            ? "Wrong tenant content detected"
            : "",
    },
    {
      type: "local-area-pages",
      title: `${serviceName} local page`,
      status: localIncluded ? "included" : localClusterCount > 0 ? "error" : "planned",
      previewUrl: localIncluded ? localPreview : null,
      outputPath: localIncluded || localClusterCount > 0 ? localClusterOutputDir : null,
      required: false,
      included: localIncluded,
      count: localClusterCount,
      notes: localIncluded
        ? `${localClusterCount} local cluster pages`
        : selectedAreasExpected > 0
          ? `Expected ${selectedAreasExpected} local pages, generated ${localClusterCount}`
          : "Planned / Not included in this package",
    },
    {
      type: "faq",
      title: `${serviceName} FAQs`,
      status: faqIncluded ? "included" : faqExists ? "error" : "planned",
      previewUrl: faqIncluded ? faqPreview : null,
      outputPath: faqIncluded ? faqFile : null,
      required: false,
      included: faqIncluded,
      count: faqIncluded ? 1 : 0,
      notes: faqIncluded ? "" : faqExists && !faqTenantOk ? "Tenant validation failed" : "Planned / Not included in this package",
    },
    {
      type: "guides",
      title: `${serviceName} patient guide`,
      status: guideIncluded ? "included" : guideExists ? "error" : "planned",
      previewUrl: guideIncluded ? guidePreview : null,
      outputPath: guideIncluded ? guideFile : null,
      required: false,
      included: guideIncluded,
      count: guideIncluded ? 1 : 0,
      notes: guideIncluded ? "" : guideExists && !guideTenantOk ? "Tenant validation failed" : "Planned / Not included in this package",
    },
    {
      type: "blog",
      title: `${serviceName} blog articles`,
      status: blogIncluded ? "included" : blogExists ? "error" : "planned",
      previewUrl: blogIncluded ? blogPreview : null,
      outputPath: blogIncluded ? blogFile : null,
      required: false,
      included: blogIncluded,
      count: blogIncluded ? blogPages.length : 0,
      notes: blogIncluded
        ? `${blogPages.length} article previews`
        : blogExists && !blogTenantOk
          ? "Tenant validation failed"
          : "Planned / Not included in this package",
    },
    {
      type: "gbp",
      title: `${serviceName} Google posts`,
      status: gbpIncluded ? "included" : gbpExists ? "error" : "planned",
      previewUrl: gbpIncluded ? ecosystemPackPreviewUrl(serviceId, slug, "gbp-pack") : null,
      outputPath: gbpIncluded ? gbpFile : null,
      required: false,
      included: gbpIncluded,
      count: gbpIncluded ? (JSON.parse(fs.readFileSync(gbpFile, "utf8")) as { posts?: unknown[] }).posts?.length || 1 : 0,
      notes: gbpIncluded ? "" : gbpExists && !gbpTenantOk ? "Tenant validation failed" : "Planned / Not included in this package",
    },
    {
      type: "social",
      title: `${serviceName} social posts`,
      status: socialIncluded ? "included" : socialExists ? "error" : "planned",
      previewUrl: socialIncluded ? ecosystemPackPreviewUrl(serviceId, slug, "social-pack") : null,
      outputPath: socialIncluded ? socialFile : null,
      required: false,
      included: socialIncluded,
      count: socialIncluded ? (JSON.parse(fs.readFileSync(socialFile, "utf8")) as { posts?: unknown[] }).posts?.length || 1 : 0,
      notes: socialIncluded ? "" : socialExists && !socialTenantOk ? "Tenant validation failed" : "Planned / Not included in this package",
    },
    {
      type: "email",
      title: `${serviceName} email sequence`,
      status: emailIncluded ? "included" : emailExists ? "error" : "planned",
      previewUrl: emailIncluded ? ecosystemPackPreviewUrl(serviceId, slug, "email-sequence") : null,
      outputPath: emailIncluded ? emailFile : null,
      required: false,
      included: emailIncluded,
      count: emailIncluded ? (JSON.parse(fs.readFileSync(emailFile, "utf8")) as { emails?: unknown[] }).emails?.length || 1 : 0,
      notes: emailIncluded ? "" : emailExists && !emailTenantOk ? "Tenant validation failed" : "Planned / Not included in this package",
    },
    {
      type: "images",
      title: `${serviceName} images`,
      status: imageCount > 0 ? "included" : "planned",
      previewUrl: `/api/pharmacy-image-library?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
      outputPath: path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-image-assignments", `${slug}.json`),
      required: true,
      included: imageCount > 0,
      count: imageCount,
      notes: imageCount > 0 ? "" : "Assign images in Image Library",
    },
    (() => {
      const trustPath = reviewTrustPackPath(slug, serviceId);
      const trustPresent = reviewTrustPackExists(slug, serviceId) && fs.existsSync(trustPath);
      const trustTenantOk = trustPresent
        ? ecosystemAssetTenantOk(trustPath, slug, pageProfile.pharmacyName)
        : false;
      const trustIncluded = trustPresent && trustTenantOk && Boolean(pageProfile.pharmacyName);
      const reviewerNote = pageProfile.reviewerName
        ? `Reviewer: ${pageProfile.reviewerName}`
        : "Reviewer details unavailable — omitted from pack";
      return {
        type: "review-trust" as const,
        title: "Review & Trust",
        status: (trustIncluded ? "included" : trustPresent ? "error" : "planned") as ContentPackageAssetStatus,
        previewUrl: trustIncluded
          ? ecosystemPackPreviewUrl(serviceId, slug, REVIEW_TRUST_PACK_ASSET_ID)
          : `/api/pharmacy-profile-dashboard?slug=${encodeURIComponent(slug)}`,
        outputPath: trustIncluded ? trustPath : null,
        required: true,
        included: trustIncluded,
        count: trustIncluded ? 1 : 0,
        notes: trustIncluded
          ? reviewerNote
          : trustPresent && !trustTenantOk
            ? "Tenant validation failed"
            : "Review & Trust pack not generated",
      };
    })(),
    {
      type: "publishing-readiness",
      title: "Publishing Readiness",
      status: publishing ? "included" : "planned",
      previewUrl: `/api/pharmacy-publishing-settings?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`,
      outputPath: path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-publishing-settings", `${slug}.json`),
      required: false,
      included: Boolean(publishing),
      count: publishing ? 1 : 0,
      notes: publishing ? "Draft preview settings ready" : "Planned / Not included in this package",
    },
    {
      type: "internal-linking",
      title: "Internal Linking Plan",
      status: report?.internalLinkValidation?.ok ? "included" : ecoExists ? "error" : "planned",
      previewUrl: report?.internalLinkValidation?.ok ? ecoPreview : null,
      outputPath: report?.internalLinkValidation?.ok
        ? path.join(ecoDir, "_internal-link-map.json")
        : ecoExists
          ? ecoIndex
          : null,
      required: false,
      included: Boolean(report?.internalLinkValidation?.ok),
      count: localClusterCount,
      notes: report?.internalLinkValidation?.detail || (ecoExists ? "Ecosystem linking map" : "Planned / Not included in this package"),
    },
  ];

  return assets;
}

export interface GenerateContentPackageOptions {
  customerContext?: CustomerCampaignGenerationContext;
  /** CPR-01: generate only the primary service page — no ecosystem, clusters, blogs, or area pages. */
  scope?: "full" | "service-page-only";
}

export async function generateContentPackage(
  slug: string,
  serviceId: string,
  options: GenerateContentPackageOptions = {},
): Promise<{ ok: boolean; manifest?: ContentPackageManifest; error?: string }> {
  const key = tenantKey(slug);
  const selectedServiceId = serviceId;
  const diagnostics: string[] = [];
  const report = createGenerationReportBase(slug, selectedServiceId);
  const customerContext = options.customerContext;
  const servicePageOnly = options.scope === "service-page-only";

  try {
    const profileDoc = loadPharmacyProfile(key);
    const profile = profileDoc.data;
    const meta = getServicePublishMeta(selectedServiceId);
    if (!meta) {
      throw new Error(
        "We could not create this content package because the selected service content is missing.",
      );
    }
    const serviceName = meta.serviceName;
    const localArea =
      customerContext?.targetAreas[0] ||
      customerContext?.generationContext.localArea ||
      profile.primaryTown ||
      profile.townCity ||
      "";
    const selectedAreas =
      customerContext?.targetAreas ||
      (profile.selectedAreas || []).filter((a) => a.selected !== false).map((a) => a.areaName);
    report.selectedAreas = selectedAreas;
    report.profileName = profile.pharmacyName || report.profileName;

    let boundContext: ContentGenerationContext =
      customerContext?.generationContext ||
      buildContentGenerationContext(key, selectedServiceId, { localArea });
    if (servicePageOnly) {
      const binding = buildTenantContextBinding(key, selectedServiceId, {
        scope: SERVICE_PAGE_GENERATION_SCOPE.SERVICE_PAGE_ONLY,
        contentContext: boundContext,
      });
      boundContext = enrichContentGenerationContextWithTenantBinding(boundContext, binding);
    }

    let visualOutputPath: string | null = null;
    try {
      visualOutputPath = ensureVisualPreview(
        key,
        selectedServiceId,
        localArea,
        report,
        servicePageOnly,
        boundContext,
      );
    } catch (err) {
      const msg = String(err);
      diagnostics.push(`visual:${msg}`);
      report.errors.push(msg);
    }

    if (!servicePageOnly) {
      try {
        const contentCtx =
          customerContext?.generationContext ||
          buildContentGenerationContext(key, selectedServiceId, { localArea });
        const ecoResult = buildBenchmarkServiceEcosystem(contentCtx);
        const ecoIndexPath = path.join(ecoResult.ecosystemRoot, "_ecosystem-index.json");
        if (!fs.existsSync(ecoIndexPath)) {
          throw new Error(
            `Ecosystem output missing after generation: ${ecoIndexPath} (ecosystem builder returned without writing index)`,
          );
        }
        report.contentEcosystemPath = ecoResult.ecosystemRoot;
        report.localClusterPagesGenerated = ecoResult.localClusterPagesGenerated;
        report.selectedAreasExpected = ecoResult.selectedAreas.length;
        report.assetsGenerated.push("content-ecosystem");
      } catch (err) {
        diagnostics.push(`ecosystem:${String(err)}`);
        report.warnings.push(`ecosystem:${String(err)}`);
      }

      // CPR-PLATFORM-RECOVERY-02: legacy service-area generator quarantined.
      // Production locality pages come from generateLocalLocationHierarchyPages via the ecosystem builder.
      diagnostics.push("area-pages:legacy-quarantined");
      report.warnings.push(
        "Legacy generatePharmacyServiceAreaPages quarantined — Content Engine V1 uses local location hierarchy only",
      );
    } else {
      diagnostics.push("scope:service-page-only");
      report.warnings.push("CPR-01 service-page-only scope — ecosystem and area pages skipped");
    }

    if (visualOutputPath && fs.existsSync(visualOutputPath)) {
      const visualHtml = fs.readFileSync(visualOutputPath, "utf8");
      if (servicePageOnly) {
        // CPR-01: validate the service page + map only; do not require local/long-form ecosystem assets.
        finalizePackageValidation(report, visualHtml, key);
        finalizeDesignMapValidation(report, key, visualHtml);
        report.manifestAccuracyValidation = {
          ok: report.packageValidation.ok && report.designMapValidation.ok,
          detail:
            report.packageValidation.ok && report.designMapValidation.ok
              ? "service-page-only scope"
              : "service-page validation failed",
        };
      } else {
        finalizeFullPackageValidation(report, visualHtml, key, profile.pharmacyName || report.profileName);
      }
    } else {
      report.packageValidation = { ok: false, detail: "Visual service page missing" };
      report.serviceValidation = { ok: false, detail: "Visual service page missing" };
      finalizeEcosystemValidation(report, key, profile.pharmacyName || report.profileName);
    }

    try {
      const trustResult = writeReviewTrustPack(key, selectedServiceId);
      if (trustResult.ok) {
        report.assetsGenerated.push("review-trust");
      } else {
        diagnostics.push(`review-trust:${trustResult.error || "not generated"}`);
        report.warnings.push(`review-trust:${trustResult.error || "not generated"}`);
      }
    } catch (err) {
      diagnostics.push(`review-trust:${String(err)}`);
      report.warnings.push(`review-trust:${String(err)}`);
    }

    const reportPath = saveGenerationReport(report);
    const assets = buildPackageAssets(key, selectedServiceId, report);
    const previewUrls = assets.map((a) => a.previewUrl).filter(Boolean) as string[];
    const outputPaths = assets.map((a) => a.outputPath).filter(Boolean) as string[];
    const servicePage = assets.find((a) => a.type === "service-page");
    const hasRequired = Boolean(servicePage?.included);
    const generationReady = hasRequired;

    const generatedAt = new Date().toISOString();
    const manifest: ContentPackageManifest = {
      version: 1,
      slug: key,
      serviceId: selectedServiceId,
      serviceName,
      generatedAt,
      generationStamp: generationStamp(key, selectedServiceId, generatedAt),
      generatorVersion: CONTENT_PACKAGE_GENERATOR_VERSION,
      profileUpdatedAt: profileDoc.updatedAt || null,
      selectedAreas,
      assets,
      previewUrls,
      outputPaths,
      status: generationReady ? "generated" : "error",
      reviewedAt: null,
      approvedAt: null,
      approvedBy: null,
      approvalStatus: "pending",
      generationError: generationReady
        ? null
        : report.errors[0] ||
          "We could not create this content package because the selected service content is missing.",
      adminDiagnostics: diagnostics,
      generationReportPath: reportPath,
      packageValidation: report.packageValidation,
      serviceValidation: report.serviceValidation,
      tenantValidation: report.tenantValidation,
    };

    saveContentPackage(manifest);
    const handoff = verifyContentPackageHandoff(key, selectedServiceId, {
      scope: servicePageOnly ? "service-page-only" : "full",
    });
    if (!handoff.ok) {
      const error = `Campaign output handoff failed: ${handoff.reason}`;
      const failedManifest: ContentPackageManifest = {
        ...manifest,
        status: "error",
        generationError: error,
        adminDiagnostics: [...manifest.adminDiagnostics, ...handoff.missing],
      };
      saveContentPackage(failedManifest);
      return { ok: false, manifest: failedManifest, error };
    }
    return { ok: generationReady, manifest, error: manifest.generationError || undefined };
  } catch (err) {
    report.errors.push(String(err));
    report.packageValidation = { ok: false, detail: String(err) };
    saveGenerationReport(report);
    return { ok: false, error: String(err), manifest: loadContentPackage(key, selectedServiceId) || undefined };
  }
}

export function markContentPackageReviewed(slug: string, serviceId: string): ContentPackageManifest {
  const key = tenantKey(slug);
  let manifest = loadContentPackage(key, serviceId);
  if (!manifest?.generatedAt) {
    throw new Error("Content package has not been generated yet.");
  }
  markContentReviewed(key, serviceId);
  manifest = {
    ...manifest,
    status: "reviewed",
    reviewedAt: new Date().toISOString(),
  };
  saveContentPackage(manifest);
  return manifest;
}

export function approveContentPackage(slug: string, serviceId: string, approvedBy?: string): ContentPackageManifest {
  const key = tenantKey(slug);
  let manifest = loadContentPackage(key, serviceId);
  if (!manifest?.generatedAt) {
    throw new Error("Content package has not been generated yet.");
  }
  const report = loadGenerationReport(key, serviceId);
  const approvalCheck = packageCanBeApproved(report);
  if (!approvalCheck.ok || manifest.packageValidation?.ok === false) {
    const paths = approvalCheck.failedPaths?.length ? ` (${approvalCheck.failedPaths.join("; ")})` : "";
    throw new Error(`${approvalCheck.message}${paths}`);
  }
  if (manifest.serviceValidation?.ok === false || manifest.tenantValidation?.ok === false) {
    throw new Error("This content package needs fixing before it can be approved.");
  }
  approveServiceAsset(key, serviceId);
  manifest = {
    ...manifest,
    status: "approved",
    reviewedAt: manifest.reviewedAt || new Date().toISOString(),
    approvedAt: new Date().toISOString(),
    approvedBy: approvedBy || "pharmacy-user",
    approvalStatus: "approved",
  };
  saveContentPackage(manifest);
  return manifest;
}

export function getContentPackageReviewSections(slug: string, serviceId: string): ContentPackageAsset[] {
  const pkg = loadContentPackage(slug, serviceId);
  if (pkg?.assets?.length) return pkg.assets;
  return buildPackageAssets(tenantKey(slug), serviceId);
}

/**
 * Generate or refresh only the Review & Trust pack for an existing content package.
 * Preserves approval/publishing state and other generated assets.
 */
export function completeReviewTrustAssetForPackage(
  slug: string,
  serviceId: string,
): { ok: boolean; manifest?: ContentPackageManifest; path?: string; error?: string } {
  const key = tenantKey(slug);
  const existing = loadContentPackage(key, serviceId);
  if (!existing?.generatedAt) {
    return { ok: false, error: "Content package has not been generated yet." };
  }

  const trustResult = writeReviewTrustPack(key, serviceId);
  if (!trustResult.ok) {
    return { ok: false, error: trustResult.error || "Review & Trust pack not generated", manifest: existing };
  }

  const report = loadGenerationReport(key, serviceId);
  const assets = buildPackageAssets(key, serviceId, report);
  const previewUrls = assets.map((a) => a.previewUrl).filter(Boolean) as string[];
  const outputPaths = assets.map((a) => a.outputPath).filter(Boolean) as string[];
  const manifest: ContentPackageManifest = {
    ...existing,
    assets,
    previewUrls,
    outputPaths,
    status: existing.status === "missing" || existing.status === "error" ? "generated" : existing.status,
    approvalStatus: existing.approvalStatus || "pending",
    adminDiagnostics: [
      ...(existing.adminDiagnostics || []).filter((d) => !/^review-trust:/i.test(d)),
      "review-trust:completed-from-confirmed-profile-evidence",
    ],
  };
  saveContentPackage(manifest);
  return { ok: true, manifest, path: trustResult.path };
}
