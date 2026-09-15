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
import {
  assertCustomerCampaignGenerationPayloadReady,
  loadFrozenCustomerCampaignGenerationContext,
  toCustomerFacingGenerationError,
  type CustomerCampaignGenerationContext,
} from "./contentEngine/customerCampaignGenerationContext.ts";
import { preflightPharmacyLocalEvidenceForCampaign } from "./contentEngine/pharmacyLocalEvidencePackContractV1.ts";
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
import {
  detectForeignPharmacyIdentities,
  detectForeignPharmacyIdentitiesInImageAlts,
  foreignIdentityDetail,
} from "./pharmacyTenantIdentityIsolation.ts";
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
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "./pharmacyLocalLocationGenerationService.ts";
import {
  applyCampaignRunStampToHtml,
  applyCampaignRunStampToJson,
  applyCurrentRunHandoffOrKeepCampaignState,
  buildCurrentRunInventory,
  collectCurrentRunSourceFiles,
  createCampaignRunStamp,
  existingOutputsMustNotSkipFreshGeneration,
  fileHasRequiredGenerationStamp,
  isHistoricalOutputPath,
  listCurrentRunInventoryFiles,
  type CampaignRunStamp,
  type CurrentRunCampaignInventory,
} from "./pharmacyCurrentRunCampaignHandoff.ts";
import { refuseGenerateNextOverwriteIfCampaignExists } from "./pharmacyGenerateNextCampaignAuthority.ts";
import {
  REGISTERED_APPROVED_BANK_SERVICE_IDS,
  resolveApprovedServiceBank,
} from "./pharmacyServiceVariantLibrary.ts";
import {
  assertImprovementRunBankAlignment,
  withCurrentRunPreviewParams,
} from "./pharmacyApprovedBankRunProvenance.ts";
import {
  clearLiveCampaignImageInventory,
  prepareCampaignRunImageSelections,
} from "./pharmacyTenantAutomaticImageSelectionService.ts";

export { loadGenerationReport } from "./pharmacyGenerationIntegrityService.ts";

export const CONTENT_PACKAGE_GENERATOR_VERSION = "content-engine-lockdown-v1";

export type ContentPackageAssetStatus = "included" | "planned" | "missing" | "error";

export interface ContentPackageReviewItem {
  id: string;
  title: string;
  generated: boolean;
}

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
  /** Selected quantity for this type (may be higher than generated count). */
  selectedCount?: number;
  reviewItems?: ContentPackageReviewItem[];
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
  status: "missing" | "generated" | "reviewed" | "approved" | "approved-locked" | "error";
  reviewedAt: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  approvalStatus: "pending" | "approved" | "approved-locked";
  generationError: string | null;
  adminDiagnostics: string[];
  generationReportPath: string | null;
  packageValidation: { ok: boolean; detail: string } | null;
  serviceValidation: { ok: boolean; detail: string } | null;
  tenantValidation: { ok: boolean; detail: string } | null;
  currentRunInventory?: CurrentRunCampaignInventory;
  approvedBankHash?: string | null;
  campaignLock?: {
    task?: string;
    lockedAt?: string;
    lockedBankHash?: string;
    lockedLocalityInventory?: string[];
    lockedPageCount?: number;
    approvalRecordPath?: string;
  };
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

function canonicalPackagePharmacyName(slug: string): string {
  try {
    return String(buildPharmacyServicePageProfile(slug).pharmacyName || "").trim();
  } catch {
    return "";
  }
}

function demoContentLeakLabel(raw: string, canonicalName: string): string | null {
  const hits = detectForeignPharmacyIdentities(raw, canonicalName);
  if (hits.length) return foreignIdentityDetail(hits);
  const leftover = FORBIDDEN_DEMO_OUTPUT.filter(
    (item) => !/Brook Pharmacy|Rowlands Pharmacy|DHM Digital/i.test(item.label) && item.pattern.test(raw),
  );
  return leftover.length ? leftover[0].label : null;
}

function generationStamp(slug: string, serviceId: string, generatedAt: string, runId?: string): CampaignRunStamp {
  return createCampaignRunStamp(tenantKey(slug), serviceId, generatedAt, runId);
}

function isGeneratedOutputPath(filePath: string): boolean {
  return filePath.includes(`${path.sep}output${path.sep}pharmacy-`);
}

function collectSourceFiles(fileOrDir: string): string[] {
  return collectCurrentRunSourceFiles(fileOrDir);
}

function fileHasGenerationStamp(raw: string, slug: string, serviceId: string): boolean {
  return fileHasRequiredGenerationStamp(raw, slug, serviceId);
}

export function verifyContentPackageReviewSources(slug: string, serviceId: string): { ok: boolean; errors: string[] } {
  const key = tenantKey(slug);
  const canonicalName = canonicalPackagePharmacyName(key);
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

  const inventory = manifest.currentRunInventory;
  if (inventory) {
    const files = listCurrentRunInventoryFiles(inventory);
    if (!files.length) {
      errors.push("current-run inventory is empty");
    }
    for (const file of files) {
      if (isHistoricalOutputPath(file)) {
        errors.push(`historical output treated as current review asset: ${file}`);
        continue;
      }
      if (!fs.existsSync(file)) {
        errors.push(`review asset source missing: ${file}`);
        continue;
      }
      const raw = fs.readFileSync(file, "utf8");
      const leaked = demoContentLeakLabel(raw, canonicalName);
      if (leaked) errors.push(`Demo content leakage detected: ${leaked} in ${file}`);
      if (!fileHasGenerationStamp(raw, key, serviceId)) {
        errors.push(`review asset source missing matching generation stamp: ${file}`);
      }
      const servicePagePath = inventory.servicePagePath ? path.resolve(inventory.servicePagePath) : "";
      const isApprovedServicePage = Boolean(servicePagePath) && path.resolve(file) === servicePagePath;
      if (inventory.generationStamp?.runId && !isApprovedServicePage) {
        const runId = inventory.generationStamp.runId;
        const runNeedles = [`"runId": "${runId}"`, `name="runId" content="${runId}"`, `runId: ${runId}`];
        if (!runNeedles.some((needle) => raw.includes(needle))) {
          errors.push(`review asset source missing matching generation stamp: ${file}`);
        }
      }
    }
    return { ok: errors.length === 0, errors };
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
      const leaked = demoContentLeakLabel(raw, canonicalName);
      if (leaked) errors.push(`Demo content leakage detected: ${leaked} in ${file}`);
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

function scanForbiddenStrings(raw: string, canonicalName: string): string[] {
  const hits = detectForeignPharmacyIdentities(raw, canonicalName, { includeImageAlts: true });
  const labels = hits.map((h) => (h.inImageAlt ? `${h.name} (image alt)` : h.name));
  const leftover = FORBIDDEN_DEMO_OUTPUT.filter(
    (item) => !/Brook Pharmacy|Rowlands Pharmacy|DHM Digital/i.test(item.label) && item.pattern.test(raw),
  ).map((item) => item.label);
  return [...new Set([...labels, ...leftover])];
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
  const canonicalName = canonicalPackagePharmacyName(key);
  const sourceCheck = verifyContentPackageReviewSources(key, serviceId);
  const assets: ReviewCentreSourceDebugAsset[] = [];
  const staleDemoStringScanResults: Array<{ path: string; matches: string[] }> = [];

  for (const asset of manifest?.assets || []) {
    const raw = readSourceRaw(asset.outputPath);
    const matches = raw ? scanForbiddenStrings(raw, canonicalName) : [];
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
  options: { scope?: "full" | "service-page-only" | "mvp-core-pages" } = {},
): ContentPackageHandoffVerification {
  const key = tenantKey(slug);
  const ecoRoot = ecosystemRoot(key, serviceId);
  const ecosystemIndexPath = path.join(ecoRoot, "_ecosystem-index.json");
  const packageManifestPath = packageFile(key, serviceId);
  const coreOnly =
    options.scope === "service-page-only" || options.scope === "mvp-core-pages";
  const missing: string[] = [];
  const sourceErrors: string[] = [];
  let assetCount = 0;

  if (!coreOnly && !fs.existsSync(ecosystemIndexPath)) {
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

export function saveContentPackage(manifest: ContentPackageManifest): void {
  const file = packageFile(manifest.slug, manifest.serviceId);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(manifest, null, 2));
}

const STALE_REEVALUATION_ERROR_PREFIXES = [
  "Ecosystem tenant:",
  "Failed assets:",
  "Local cluster:",
  "Empty sections:",
  "Missing sections:",
];

function isStaleReevaluationError(message: string): boolean {
  return (
    STALE_REEVALUATION_ERROR_PREFIXES.some((prefix) => message.startsWith(prefix)) ||
    /Brook Pharmacy detected/i.test(message)
  );
}

function isStaleReevaluationWarning(message: string): boolean {
  return message.startsWith("Image alt foreign identity:") || message.startsWith("Layout checks:");
}

/** Rebuild package + generation-report metadata from existing HTML only. Does not generate pages. */
export function reevaluateContentPackageMetadataFromExistingOutputs(
  slug: string,
  serviceId: string,
): ContentPackageManifest {
  const key = tenantKey(slug);
  const existing = loadContentPackage(key, serviceId);
  if (!existing) {
    throw new Error(`Content package missing for ${key}/${serviceId}`);
  }
  const report = loadGenerationReport(key, serviceId);
  if (!report) {
    throw new Error(`Generation report missing for ${key}/${serviceId}`);
  }

  const profile = buildPharmacyServicePageProfile(key);
  const visualPath = resolveVisualExperienceHtmlPath(serviceId as VisualExperienceServiceId, key);
  const visualHtml = visualPath && fs.existsSync(visualPath) ? fs.readFileSync(visualPath, "utf8") : "";
  const ecoPath = ecosystemRoot(key, serviceId);
  if (fs.existsSync(ecoPath)) {
    report.contentEcosystemPath = ecoPath;
  }

  report.errors = (report.errors || []).filter((message) => !isStaleReevaluationError(message));
  report.warnings = (report.warnings || []).filter((message) => !isStaleReevaluationWarning(message));

  finalizeEcosystemValidation(report, key, profile.pharmacyName);
  if (visualHtml) {
    finalizePackageValidation(report, visualHtml, key);
  } else {
    report.packageValidation = { ok: false, detail: "Visual service page missing" };
  }
  const reportPathWritten = saveGenerationReport(report);

  const assets = buildPackageAssets(key, serviceId, report);
  const previewUrls = assets.map((asset) => asset.previewUrl).filter(Boolean) as string[];
  const outputPaths = assets.map((asset) => asset.outputPath).filter(Boolean) as string[];
  const servicePage = assets.find((asset) => asset.type === "service-page");
  const localPages = assets.find((asset) => asset.type === "local-area-pages");
  const hasRequired = Boolean(servicePage?.included);
  const localDiscrepancy = localPages?.status === "error";
  const packageOk = report.packageValidation?.ok === true;
  const generationReady = hasRequired && packageOk && !localDiscrepancy;
  const localError = (report.errors || []).find((message) => message.startsWith("Local cluster:"));

  const manifest: ContentPackageManifest = {
    ...existing,
    assets,
    previewUrls,
    outputPaths,
    generatedAt: existing.generatedAt,
    generationStamp: existing.generationStamp,
    reviewedAt: existing.reviewedAt,
    approvedAt: existing.approvedAt,
    approvedBy: existing.approvedBy,
    approvalStatus: existing.approvalStatus,
    status: generationReady ? "generated" : "error",
    generationError: generationReady
      ? null
      : toCustomerFacingGenerationError(
          localError || report.errors[0] || "This content package needs fixing before approval.",
        ),
    generationReportPath: reportPathWritten,
    packageValidation: report.packageValidation,
    serviceValidation: report.serviceValidation,
    tenantValidation: report.tenantValidation,
  };
  saveContentPackage(manifest);
  return manifest;
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
  const approvalStatus = String(pkg?.approvalStatus || "");
  const status = String(pkg?.status || "");
  if (approvalStatus === "approved" || approvalStatus === "approved-locked") return true;
  if (status === "approved" || status === "approved-locked") return true;
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
  runStamp?: CampaignRunStamp,
): string {
  existingOutputsMustNotSkipFreshGeneration();
  const masterPath = ensureMasterPublish(slug, selectedServiceId, localArea, report, skipCanonicalPublishCopy, contentContext);
  if (!isBenchmarkVisualService(selectedServiceId)) {
    if (runStamp) {
      throw new Error(
        "We could not create this content package because the selected service content is missing.",
      );
    }
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
  if (runStamp && fs.existsSync(result.outputPath)) {
    fs.writeFileSync(
      result.outputPath,
      applyCampaignRunStampToHtml(fs.readFileSync(result.outputPath, "utf8"), runStamp),
      "utf8",
    );
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

function imageAltRemnantNote(html: string, pharmacyName: string): string {
  const hits = detectForeignPharmacyIdentitiesInImageAlts(html, pharmacyName);
  if (!hits.length) return "";
  return `Image alt remnants: ${[...new Set(hits.map((h) => h.name))].join(", ")}`;
}

function joinNotes(...parts: string[]): string {
  return parts.filter(Boolean).join("; ");
}

function ecosystemAssetTenantOk(filePath: string, slug: string, pharmacyName: string): boolean {
  if (!fs.existsSync(filePath)) return false;
  const key = tenantKey(slug);
  const raw = fs.readFileSync(filePath, "utf8");
  if (key !== "pharmaconnect" && detectForeignPharmacyIdentities(raw, pharmacyName).length) return false;
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
  const serviceImageAltNote = imageAltRemnantNote(visualHtml, pageProfile.pharmacyName);
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
  let localImageAltNote = "";
  if (fs.existsSync(localClusterOutputDir)) {
    const firstLocal = fs.readdirSync(localClusterOutputDir, { withFileTypes: true }).find((d) => d.isDirectory());
    if (firstLocal) {
      const localHtmlPath = path.join(localClusterOutputDir, firstLocal.name, "index.html");
      if (fs.existsSync(localHtmlPath)) {
        localImageAltNote = imageAltRemnantNote(fs.readFileSync(localHtmlPath, "utf8"), pageProfile.pharmacyName);
      }
    }
  }

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
      previewUrl: visualExists ? previewBase : null,
      outputPath: visualPathResolved,
      required: true,
      included: visualOk,
      count: visualOk ? 1 : 0,
      notes: joinNotes(
        !visualExists
          ? "Service page not generated"
          : !serviceContentOk
            ? "Wrong service content detected"
            : visualCheck.reason === "wrong_tenant" || visualCheck.reason === "wrong_tenant_brook"
              ? visualCheck.detail || "Wrong tenant content detected"
              : "",
        serviceImageAltNote,
      ),
    },
    {
      type: "local-area-pages",
      title: `${serviceName} local page`,
      status: localIncluded ? "included" : localClusterCount > 0 ? "error" : "planned",
      previewUrl: localClusterCount > 0 ? localPreview : null,
      outputPath: localIncluded || localClusterCount > 0 ? localClusterOutputDir : null,
      required: false,
      included: localIncluded,
      count: localClusterCount,
      notes: joinNotes(
        localIncluded
          ? `${localClusterCount} local cluster pages`
          : selectedAreasExpected > 0
            ? `Expected ${selectedAreasExpected} local pages, generated ${localClusterCount}`
            : "Planned / Not included in this package",
        localImageAltNote,
      ),
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
      status:
        report?.internalLinkValidation?.ok && fs.existsSync(path.join(ecoDir, "_internal-link-map.json"))
          ? "included"
          : ecoExists
            ? "error"
            : "planned",
      previewUrl:
        report?.internalLinkValidation?.ok && fs.existsSync(path.join(ecoDir, "_internal-link-map.json"))
          ? ecoPreview
          : null,
      outputPath:
        report?.internalLinkValidation?.ok && fs.existsSync(path.join(ecoDir, "_internal-link-map.json"))
          ? path.join(ecoDir, "_internal-link-map.json")
          : ecoExists
            ? ecoIndex
            : null,
      required: false,
      included:
        Boolean(report?.internalLinkValidation?.ok) &&
        fs.existsSync(path.join(ecoDir, "_internal-link-map.json")),
      count: localClusterCount,
      notes: report?.internalLinkValidation?.detail || (ecoExists ? "Ecosystem linking map" : "Planned / Not included in this package"),
    },
  ];

  return assets;
}

export interface GenerateContentPackageOptions {
  customerContext?: CustomerCampaignGenerationContext;
  /** CPR-01: generate only the primary service page — no ecosystem, clusters, blogs, or area pages. */
  scope?: "full" | "service-page-only" | "mvp-core-pages";
  /** Generate Next must not overwrite an existing same-service campaign. Regeneration uses a separate workflow. */
  protectExistingCampaign?: boolean;
}

/**
 * MVP core-page workflow (CORE-PAGE-28):
 * - one service page
 * - localities generated separately via generateLocalLocationHierarchyPages
 * - minimum review/package records
 * Optional GBP/social/email/blogs/guides remain available but are not auto-run.
 */
export const MVP_CORE_PAGE_SCOPE = "mvp-core-pages" as const;
export type CampaignReviewScope = "mvp-core-pages" | "service-page-only" | "full";
export const MVP_CORE_REQUIRED_REVIEW_ASSET_TYPES = ["service-page", "local-area-pages", "images"] as const;
export const MVP_CORE_OPTIONAL_REVIEW_ASSET_TYPES = [
  "gbp",
  "social",
  "email",
  "blog",
  "guides",
  "faq",
  "video",
  "landing-page",
] as const;

export function isMvpCoreRequiredReviewAssetType(type: string): boolean {
  return (MVP_CORE_REQUIRED_REVIEW_ASSET_TYPES as readonly string[]).includes(type);
}

export function isMvpCoreOptionalReviewAssetType(type: string): boolean {
  if (isMvpCoreRequiredReviewAssetType(type)) return false;
  return (MVP_CORE_OPTIONAL_REVIEW_ASSET_TYPES as readonly string[]).includes(type) || Boolean(type);
}

export function resolveCampaignReviewScope(slug: string, serviceId: string): CampaignReviewScope {
  const pkg = loadContentPackage(slug, serviceId);
  const diagnostics = pkg?.adminDiagnostics || [];
  if (diagnostics.some((line) => line.includes("scope:mvp-core-pages") || line.includes("mvp-core-pages"))) {
    return MVP_CORE_PAGE_SCOPE;
  }
  if ((REGISTERED_APPROVED_BANK_SERVICE_IDS as readonly string[]).includes(serviceId)) {
    return MVP_CORE_PAGE_SCOPE;
  }
  if (diagnostics.some((line) => line.includes("scope:service-page-only"))) return "service-page-only";
  return "full";
}

export function isCampaignReviewAssetRequired(scope: CampaignReviewScope, assetType: string): boolean {
  if (scope !== MVP_CORE_PAGE_SCOPE) return true;
  return isMvpCoreRequiredReviewAssetType(assetType);
}

export async function generateContentPackage(
  slug: string,
  serviceId: string,
  options: GenerateContentPackageOptions = {},
): Promise<{
  ok: boolean;
  manifest?: ContentPackageManifest;
  error?: string;
  currentRunInventory?: CurrentRunCampaignInventory;
}> {
  if (options.customerContext) {
    assertCustomerCampaignGenerationPayloadReady(options.customerContext);
  }
  const key = tenantKey(slug);
  const selectedServiceId = serviceId;
  if (options.protectExistingCampaign) {
    const overwriteGuard = refuseGenerateNextOverwriteIfCampaignExists(key, selectedServiceId);
    if (!overwriteGuard.ok) {
      return { ok: false, error: overwriteGuard.error };
    }
  }
  if (options.scope !== "service-page-only") {
    const evidencePreflight = preflightPharmacyLocalEvidenceForCampaign(key, selectedServiceId);
    if (!evidencePreflight.ok) {
      return {
        ok: false,
        error: evidencePreflight.customerError || "Local pages cannot be generated yet because verified area evidence is missing or insufficient.",
      };
    }
  }
  const diagnostics: string[] = [];
  const report = createGenerationReportBase(slug, selectedServiceId);
  const customerContext = options.customerContext;
  const servicePageOnly =
    options.scope === "service-page-only" || options.scope === "mvp-core-pages";
  const mvpCorePages = options.scope === "mvp-core-pages";
  const previousPackage = loadContentPackage(key, selectedServiceId);
  const generatedAt = new Date().toISOString();
  const runStamp = generationStamp(key, selectedServiceId, generatedAt);
  let currentRunLocalityPaths: string[] = [];
  let currentRunReviewRecordPaths: string[] = [];

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
    const localitySlugs = selectedAreas
      .map((area) =>
        String(area || "")
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, ""),
      )
      .filter(Boolean);
    const imageSelectionInventory = prepareCampaignRunImageSelections({
      tenantSlug: key,
      serviceId: selectedServiceId,
      runId: runStamp.runId,
      seed: runStamp.runId,
      localitySlugs,
    });

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
        runStamp,
      );
    } catch (err) {
      const msg = toCustomerFacingGenerationError(err);
      diagnostics.push(`visual:${msg}`);
      report.errors.push(msg);
    }

    if (!servicePageOnly) {
      try {
        const contentCtx =
          customerContext?.generationContext ||
          buildContentGenerationContext(key, selectedServiceId, { localArea });
        const ecoResult = buildBenchmarkServiceEcosystem(contentCtx, { generationStamp: runStamp });
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
        currentRunLocalityPaths = (ecoResult.assets || [])
          .filter((a) => a.id.startsWith("local-cluster-") && a.outputPath)
          .map((a) => a.outputPath);
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
    } else if (mvpCorePages) {
      diagnostics.push("scope:mvp-core-pages");
      diagnostics.push("optional-assets:disconnected-gbp-social-email-blogs-guides");
      report.warnings.push(
        "MVP core-pages scope — service page + localities + review pack; optional GBP/social/email/blogs/guides disconnected",
      );
      try {
        const contentCtx =
          customerContext?.generationContext ||
          buildContentGenerationContext(key, selectedServiceId, { localArea });
        const locals = generateLocalLocationHierarchyPages(contentCtx, { generationStamp: runStamp });
        if (!locals.ok) {
          throw new Error(locals.blockedReason || "locality generation failed");
        }
        mergeLocalAssetsIntoEcosystemIndex(key, selectedServiceId, locals);
        currentRunLocalityPaths = locals.clusterPaths.filter((p) => !isHistoricalOutputPath(p));
        report.contentEcosystemPath = ecosystemRoot(key, selectedServiceId);
        report.localClusterPagesGenerated = locals.localClusterEntries.length;
        report.selectedAreasExpected = locals.hierarchy.clusters.length;
        report.assetsGenerated.push("local-location-hierarchy");
        report.internalLinkValidation = {
          ok: fs.existsSync(path.join(ecosystemRoot(key, selectedServiceId), "_internal-link-map.json")),
          detail: "mvp-core-pages locality link map",
        };
      } catch (err) {
        diagnostics.push(`mvp-localities:${String(err)}`);
        report.errors.push(`mvp-localities:${String(err)}`);
        report.internalLinkValidation = { ok: false, detail: String(err) };
      }
    } else {
      diagnostics.push("scope:service-page-only");
      report.warnings.push("CPR-01 service-page-only scope — ecosystem and area pages skipped");
      report.internalLinkValidation = { ok: false, detail: "service-page-only scope — link map not required" };
    }

    if (visualOutputPath && fs.existsSync(visualOutputPath)) {
      const visualHtml = fs.readFileSync(visualOutputPath, "utf8");
      if (servicePageOnly) {
        // CPR-01 / MVP: validate the service page + map only; do not require long-form ecosystem assets.
        finalizePackageValidation(report, visualHtml, key);
        finalizeDesignMapValidation(report, key, visualHtml);
        report.manifestAccuracyValidation = {
          ok: report.packageValidation.ok && report.designMapValidation.ok,
          detail:
            report.packageValidation.ok && report.designMapValidation.ok
              ? mvpCorePages
                ? "mvp-core-pages scope"
                : "service-page-only scope"
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
      const trustResult = writeReviewTrustPack(key, selectedServiceId, runStamp);
      if (trustResult.ok) {
        report.assetsGenerated.push("review-trust");
        if (trustResult.path) currentRunReviewRecordPaths.push(trustResult.path);
      } else {
        diagnostics.push(`review-trust:${trustResult.error || "not generated"}`);
        report.warnings.push(`review-trust:${trustResult.error || "not generated"}`);
      }
    } catch (err) {
      diagnostics.push(`review-trust:${String(err)}`);
      report.warnings.push(`review-trust:${String(err)}`);
    }

    const linkMapPath = path.join(ecosystemRoot(key, selectedServiceId), "_internal-link-map.json");
    if (fs.existsSync(linkMapPath) && !isHistoricalOutputPath(linkMapPath)) {
      const stampedLinkMap = applyCampaignRunStampToJson(
        fs.readFileSync(linkMapPath, "utf8"),
        runStamp,
      );
      fs.writeFileSync(linkMapPath, stampedLinkMap, "utf8");
      currentRunReviewRecordPaths.push(linkMapPath);
    }

    const reportPath = saveGenerationReport(report);
    const assets = buildPackageAssets(key, selectedServiceId, report);
    const previewUrls = assets.map((a) => a.previewUrl).filter(Boolean) as string[];
    const outputPaths = assets.map((a) => a.outputPath).filter(Boolean) as string[];
    const servicePage = assets.find((a) => a.type === "service-page");
    const hasRequired = Boolean(servicePage?.included);
    const generationReady = hasRequired;

    const currentRunInventory = buildCurrentRunInventory({
      stamp: runStamp,
      servicePagePath: visualOutputPath,
      localityPagePaths: currentRunLocalityPaths,
      reviewRecordPaths: currentRunReviewRecordPaths,
      imageSelections: imageSelectionInventory
        ? {
            version: imageSelectionInventory.version,
            seed: imageSelectionInventory.seed,
            pages: imageSelectionInventory.pages,
          }
        : undefined,
    });

    const manifest: ContentPackageManifest = {
      version: 1,
      slug: key,
      serviceId: selectedServiceId,
      serviceName,
      generatedAt,
      generationStamp: runStamp,
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
        : toCustomerFacingGenerationError(
            report.errors[0] ||
              "We could not create this content package because the selected service content is missing.",
          ),
      adminDiagnostics: diagnostics,
      generationReportPath: reportPath,
      packageValidation: report.packageValidation,
      serviceValidation: report.serviceValidation,
      tenantValidation: report.tenantValidation,
      currentRunInventory,
    };

    const expectedLocalityCount = mvpCorePages
      ? Math.max(report.selectedAreasExpected || currentRunLocalityPaths.length, 1)
      : undefined;
    const transaction = applyCurrentRunHandoffOrKeepCampaignState({
      previousCampaignState: previousPackage,
      proposedCampaignState: manifest,
      inventory: currentRunInventory,
      expectedLocalityCount,
    });
    if (!generationReady || !transaction.ok) {
      const error = !generationReady
        ? manifest.generationError || "Content package generation failed"
        : `Campaign output handoff failed: ${transaction.errors.join("; ")}`;
      return {
        ok: false,
        error,
        manifest: previousPackage || undefined,
        currentRunInventory,
      };
    }

    saveContentPackage(transaction.campaignState);
    const handoff = verifyContentPackageHandoff(key, selectedServiceId, {
      scope: mvpCorePages ? "mvp-core-pages" : servicePageOnly ? "service-page-only" : "full",
    });
    if (!handoff.ok) {
      const error = `Campaign output handoff failed: ${handoff.reason}`;
      if (previousPackage) saveContentPackage(previousPackage);
      else {
        const written = packageFile(key, selectedServiceId);
        if (fs.existsSync(written)) fs.unlinkSync(written);
      }
      return { ok: false, error, manifest: previousPackage || undefined, currentRunInventory };
    }
    return { ok: true, manifest: transaction.campaignState, currentRunInventory };
  } catch (err) {
    report.errors.push(toCustomerFacingGenerationError(err));
    report.packageValidation = { ok: false, detail: toCustomerFacingGenerationError(err) };
    saveGenerationReport(report);
    return {
      ok: false,
      error: toCustomerFacingGenerationError(err),
      manifest: previousPackage || loadContentPackage(key, selectedServiceId) || undefined,
    };
  } finally {
    clearLiveCampaignImageInventory(key, selectedServiceId, runStamp.runId);
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

function reviewAreaSlug(areaName: string): string {
  return String(areaName || "")
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function htmlDocumentTitle(filePath: string): string | null {
  if (!filePath || !fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const match = raw.match(/<title>([^<]+)<\/title>/i);
    if (!match?.[1]) return null;
    return match[1]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/\s*\|.*$/, "")
      .trim();
  } catch {
    return null;
  }
}

function packArrayCount(filePath: string, key: string): number {
  if (!filePath || !fs.existsSync(filePath)) return 0;
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8")) as Record<string, unknown>;
    const value = raw[key];
    if (Array.isArray(value)) return value.length;
    if (typeof raw.count === "number") return Number(raw.count) || 0;
  } catch {
    return 0;
  }
  return 0;
}

function currentLocalPageFile(slug: string, serviceId: string, areaSlug: string): string | null {
  const file = path.join(ecosystemRoot(slug, serviceId), "local", areaSlug, "index.html");
  if (!fs.existsSync(file) || isHistoricalOutputPath(file)) return null;
  return file;
}

export interface GeneratedReviewOutputDiscovery {
  selectedAreaNames: string[];
  localPages: Array<{ areaName: string; areaSlug: string; outputPath: string | null }>;
  faqPath: string | null;
  guidePath: string | null;
  blogPages: Array<{ id: string; title: string; outputPath: string }>;
  videoPath: string | null;
  landingPath: string | null;
  gbpCount: number;
  socialCount: number;
  emailCount: number;
  servicePagePath: string | null;
}

export function discoverGeneratedReviewOutputs(slug: string, serviceId: string): GeneratedReviewOutputDiscovery {
  const key = tenantKey(slug);
  const pkg = loadContentPackage(key, serviceId);
  const ecoDir = ecosystemRoot(key, serviceId);
  const ecoAssets = loadEcosystemIndexAssets(key, serviceId);
  const selectedAreaNames = (pkg?.selectedAreas || []).map((name) => String(name || "").trim()).filter(Boolean);

  const localPages = selectedAreaNames.map((areaName) => {
    const areaSlug = reviewAreaSlug(areaName);
    return { areaName, areaSlug, outputPath: currentLocalPageFile(key, serviceId, areaSlug) };
  });
  if (!localPages.length) {
    const localDir = path.join(ecoDir, "local");
    if (fs.existsSync(localDir)) {
      for (const entry of fs.readdirSync(localDir, { withFileTypes: true })) {
        if (!entry.isDirectory() || entry.name === "revisions" || entry.name === "quarantine") continue;
        const outputPath = currentLocalPageFile(key, serviceId, entry.name);
        if (!outputPath) continue;
        localPages.push({
          areaName: entry.name.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          areaSlug: entry.name,
          outputPath,
        });
      }
    }
  }

  const faqPage = ecoAssets.find((asset) => asset.id === "faq-page");
  const guidePage = ecoAssets.find((asset) => asset.id === "patient-guide");
  const landingPage = ecoAssets.find((asset) => asset.id === "root-service-page");
  const blogPages = ecoAssets
    .filter((asset) => asset.type === "Blog post" && asset.outputPath && fs.existsSync(asset.outputPath))
    .map((asset) => ({
      id: asset.id,
      title: htmlDocumentTitle(asset.outputPath) || asset.id.replace(/-/g, " "),
      outputPath: asset.outputPath,
    }));
  const videoFromIndex = ecoAssets.find((asset) => asset.id === "video-script");
  const videoFallback = path.join(ecoDir, "packs/video-script.md");
  const gbpFile = path.join(ecoDir, "packs/gbp-posts.json");
  const socialFile = path.join(ecoDir, "packs/social-posts.json");
  const emailFile = path.join(ecoDir, "packs/email-sequence.json");
  const visualPath = resolveVisualExperienceHtmlPath(serviceId as VisualExperienceServiceId, key);

  return {
    selectedAreaNames,
    localPages,
    faqPath: faqPage?.outputPath && fs.existsSync(faqPage.outputPath) ? faqPage.outputPath : null,
    guidePath: guidePage?.outputPath && fs.existsSync(guidePage.outputPath) ? guidePage.outputPath : null,
    blogPages,
    videoPath:
      videoFromIndex?.outputPath && fs.existsSync(videoFromIndex.outputPath)
        ? videoFromIndex.outputPath
        : fs.existsSync(videoFallback)
          ? videoFallback
          : null,
    landingPath:
      landingPage?.outputPath && fs.existsSync(landingPage.outputPath) && !isHistoricalOutputPath(landingPage.outputPath)
        ? landingPage.outputPath
        : null,
    gbpCount: packArrayCount(gbpFile, "posts"),
    socialCount: packArrayCount(socialFile, "posts"),
    emailCount: packArrayCount(emailFile, "emails"),
    servicePagePath: visualPath && fs.existsSync(visualPath) ? visualPath : null,
  };
}

function overlayReviewSection(
  existing: ContentPackageAsset | undefined,
  next: ContentPackageAsset,
): ContentPackageAsset {
  if (!existing) return next;
  return {
    ...existing,
    ...next,
    notes: next.notes,
  };
}

function overlayGeneratedPackageReviewSections(
  slug: string,
  serviceId: string,
  frozen: ContentPackageAsset[],
  pkg: ContentPackageManifest | null,
): ContentPackageAsset[] {
  const discovery = discoverGeneratedReviewOutputs(slug, serviceId);
  const serviceName = pkg?.serviceName || getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ");
  const byType = new Map(frozen.map((asset) => [asset.type, { ...asset }]));
  const generatedLocal = discovery.localPages.filter((page) => page.outputPath);
  const localDir = path.join(ecosystemRoot(slug, serviceId), "local");
  const localPreview =
    generatedLocal[0]?.outputPath
      ? ecosystemPagePreviewUrl(serviceId, slug, generatedLocal[0].outputPath)
      : null;

  if (generatedLocal.length > 0) {
    byType.set(
      "local-area-pages",
      overlayReviewSection(byType.get("local-area-pages"), {
        type: "local-area-pages",
        title: `${serviceName} local area pages`,
        status: "included",
        previewUrl: localPreview,
        outputPath: fs.existsSync(localDir) ? localDir : generatedLocal[0].outputPath,
        required: true,
        included: true,
        count: generatedLocal.length,
        selectedCount: discovery.localPages.length || generatedLocal.length,
        notes: "",
        reviewItems: discovery.localPages.map((page) => ({
          id: page.areaSlug,
          title: page.areaName,
          generated: Boolean(page.outputPath),
        })),
      }),
    );
  }

  if (discovery.faqPath) {
    byType.set(
      "faq",
      overlayReviewSection(byType.get("faq"), {
        type: "faq",
        title: `${serviceName} FAQs`,
        status: "included",
        previewUrl: ecosystemPagePreviewUrl(serviceId, slug, discovery.faqPath),
        outputPath: discovery.faqPath,
        required: false,
        included: true,
        count: 1,
        selectedCount: 1,
        notes: "",
      }),
    );
  }

  if (discovery.guidePath) {
    byType.set(
      "guides",
      overlayReviewSection(byType.get("guides"), {
        type: "guides",
        title: `${serviceName} patient guide`,
        status: "included",
        previewUrl: ecosystemPagePreviewUrl(serviceId, slug, discovery.guidePath),
        outputPath: discovery.guidePath,
        required: false,
        included: true,
        count: 1,
        selectedCount: 1,
        notes: "",
      }),
    );
  }

  if (discovery.blogPages.length > 0) {
    byType.set(
      "blog",
      overlayReviewSection(byType.get("blog"), {
        type: "blog",
        title: `${serviceName} blog articles`,
        status: "included",
        previewUrl: ecosystemPagePreviewUrl(serviceId, slug, discovery.blogPages[0].outputPath),
        outputPath: discovery.blogPages[0].outputPath,
        required: false,
        included: true,
        count: discovery.blogPages.length,
        selectedCount: discovery.blogPages.length,
        notes: "",
        reviewItems: discovery.blogPages.map((page) => ({
          id: page.id,
          title: page.title,
          generated: true,
        })),
      }),
    );
  }

  if (discovery.gbpCount > 0 && byType.get("gbp")?.included) {
    const gbp = byType.get("gbp")!;
    byType.set("gbp", { ...gbp, count: discovery.gbpCount, selectedCount: discovery.gbpCount, included: true, status: "included" });
  }

  if (discovery.socialCount > 0 && byType.get("social")?.included) {
    const social = byType.get("social")!;
    byType.set("social", {
      ...social,
      count: discovery.socialCount,
      selectedCount: discovery.socialCount,
      included: true,
      status: "included",
    });
  }

  if (discovery.emailCount > 0 && byType.get("email")?.included) {
    const email = byType.get("email")!;
    byType.set("email", {
      ...email,
      count: discovery.emailCount,
      selectedCount: discovery.emailCount,
      included: true,
      status: "included",
    });
  }

  if (discovery.videoPath) {
    byType.set(
      "video",
      overlayReviewSection(byType.get("video"), {
        type: "video",
        title: `${serviceName} video`,
        status: "included",
        previewUrl: ecosystemPackPreviewUrl(serviceId, slug, "video-script"),
        outputPath: discovery.videoPath,
        required: false,
        included: true,
        count: 1,
        selectedCount: 1,
        notes: "",
      }),
    );
  }

  if (discovery.landingPath) {
    byType.set(
      "landing-page",
      overlayReviewSection(byType.get("landing-page"), {
        type: "landing-page",
        title: `${serviceName} landing page`,
        status: "included",
        previewUrl: ecosystemPagePreviewUrl(serviceId, slug, discovery.landingPath),
        outputPath: discovery.landingPath,
        required: false,
        included: true,
        count: 1,
        selectedCount: 1,
        notes: "",
      }),
    );
  }

  const preferredOrder = [
    "service-page",
    "local-area-pages",
    "guides",
    "faq",
    "blog",
    "gbp",
    "social",
    "email",
    "video",
    "landing-page",
    "images",
  ];
  const ordered: ContentPackageAsset[] = [];
  for (const type of preferredOrder) {
    const asset = byType.get(type);
    if (asset) ordered.push(asset);
    byType.delete(type);
  }
  for (const asset of byType.values()) ordered.push(asset);
  return ordered;
}

export function getContentPackageReviewSections(slug: string, serviceId: string): ContentPackageAsset[] {
  const key = tenantKey(slug);
  const pkg = loadContentPackage(key, serviceId);
  const frozen = pkg?.assets?.length ? pkg.assets : buildPackageAssets(key, serviceId);
  return overlayGeneratedPackageReviewSections(key, serviceId, frozen, pkg);
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

/**
 * Replace only the locality review inventory after a locality-only regeneration.
 * Keeps the approved service page, images, and package approval state unchanged.
 */
export function replaceLocalityReviewInventory(
  slug: string,
  serviceId: string,
  input: {
    localityPagePaths: string[];
    generationStamp: CampaignRunStamp;
    approvedBankHash?: string | null;
  },
): { ok: boolean; error?: string; manifest?: ContentPackageManifest; previousManifest?: ContentPackageManifest } {
  const key = tenantKey(slug);
  const existing = loadContentPackage(key, serviceId);
  if (!existing?.generatedAt) {
    return { ok: false, error: "Content package has not been generated yet." };
  }

  const generatedBankHash = String(input.generationStamp.approvedBankHash || "").trim() || null;
  const requestedReviewHash =
    input.approvedBankHash === undefined
      ? generatedBankHash
      : String(input.approvedBankHash || "").trim() || null;
  const registryBankHash = resolveApprovedServiceBank(serviceId)?.hash || null;
  const alignment = assertImprovementRunBankAlignment({
    generatedBankHash,
    reviewBankHash: requestedReviewHash,
    registryBankHash,
  });
  if (!alignment.ok) {
    return { ok: false, error: alignment.error, previousManifest: existing };
  }
  const approvedBankHash = requestedReviewHash;

  const servicePagePath =
    existing.currentRunInventory?.servicePagePath ||
    existing.assets.find((a) => a.type === "service-page")?.outputPath ||
    null;
  const linkMapPath = path.join(ecosystemRoot(key, serviceId), "_internal-link-map.json");
  const report = loadGenerationReport(key, serviceId);
  const rebuilt = buildPackageAssets(key, serviceId, report);
  const rebuiltLocal = rebuilt.find((a) => a.type === "local-area-pages");
  if (!rebuiltLocal?.included || (rebuiltLocal.count || 0) < 1) {
    return { ok: false, error: "Fresh locality inventory was not available after regeneration.", previousManifest: existing };
  }

  const localityPagePaths = input.localityPagePaths.filter((p) => p && !isHistoricalOutputPath(p));
  const generationStamp: CampaignRunStamp = {
    ...input.generationStamp,
    approvedBankHash: approvedBankHash || generatedBankHash,
  };

  const localPreviewUrl = rebuiltLocal.previewUrl
    ? withCurrentRunPreviewParams(rebuiltLocal.previewUrl, generationStamp.runId, approvedBankHash)
    : rebuiltLocal.previewUrl;
  const localAsset = { ...rebuiltLocal, previewUrl: localPreviewUrl };

  const assets = existing.assets.map((asset) =>
    asset.type === "local-area-pages" ? { ...localAsset } : asset,
  );
  if (!assets.some((a) => a.type === "local-area-pages")) {
    const serviceIdx = assets.findIndex((a) => a.type === "service-page");
    assets.splice(serviceIdx >= 0 ? serviceIdx + 1 : assets.length, 0, localAsset);
  }

  const manifest: ContentPackageManifest = {
    ...existing,
    assets,
    previewUrls: assets.map((a) => a.previewUrl).filter(Boolean) as string[],
    outputPaths: assets.map((a) => a.outputPath).filter(Boolean) as string[],
    approvedBankHash,
    generationStamp,
    currentRunInventory: {
      runId: generationStamp.runId,
      generationStamp,
      servicePagePath,
      localityPagePaths,
      reviewRecordPaths: fs.existsSync(linkMapPath) && !isHistoricalOutputPath(linkMapPath) ? [linkMapPath] : [],
      approvedBankHash,
    },
    adminDiagnostics: [
      ...(existing.adminDiagnostics || []).filter((d) => !/^locality-improvements:/i.test(d)),
      `locality-improvements:regenerated:${localityPagePaths.length}`,
      approvedBankHash ? `locality-improvements:bank:${approvedBankHash}` : "locality-improvements:bank:unregistered",
    ],
  };
  saveContentPackage(manifest);
  return { ok: true, manifest, previousManifest: existing };
}

export interface MissingLocalPageReconciliationResult {
  ok: boolean;
  error?: string;
  skippedExistingPaths: string[];
  createdPaths: string[];
}

/**
 * Generate only missing local cluster pages for an already-generated campaign.
 * Detects existing local/{slug}/index.html first, refuses overwrite, and patches
 * locality inventory counts without regenerating the rest of the package.
 */
export function reconcileMissingLocalLocationPages(
  slug: string,
  serviceId: string,
): MissingLocalPageReconciliationResult {
  const key = tenantKey(slug);
  const frozen = loadFrozenCustomerCampaignGenerationContext(key, serviceId);
  if (!frozen?.generationContext) {
    return { ok: false, error: "Frozen campaign generation context is missing.", skippedExistingPaths: [], createdPaths: [] };
  }
  const existing = loadContentPackage(key, serviceId);
  if (!existing?.generatedAt) {
    return { ok: false, error: "Content package has not been generated yet.", skippedExistingPaths: [], createdPaths: [] };
  }

  const ecoDir = ecosystemRoot(key, serviceId);
  const expectedCreatedSlugs = frozen.generationContext.selectedAreas
    .filter((area) => area.selected !== false)
    .map((area) => reviewAreaSlug(area.areaName))
    .filter((areaSlug) => {
      const file = path.join(ecoDir, "local", areaSlug, "index.html");
      return !fs.existsSync(file) || isHistoricalOutputPath(file);
    });
  if (!expectedCreatedSlugs.length) {
    return { ok: false, error: "No missing local pages to reconcile.", skippedExistingPaths: [], createdPaths: [] };
  }
  for (const areaSlug of expectedCreatedSlugs) {
    const file = path.join(ecoDir, "local", areaSlug, "index.html");
    if (fs.existsSync(file) && !isHistoricalOutputPath(file)) {
      return {
        ok: false,
        error: `Refusing to overwrite an existing local page for ${areaSlug}.`,
        skippedExistingPaths: [],
        createdPaths: [],
      };
    }
  }

  const stamp = existing.generationStamp || existing.currentRunInventory?.generationStamp;
  if (!stamp?.runId) {
    return { ok: false, error: "Current package generation stamp is missing.", skippedExistingPaths: [], createdPaths: [] };
  }

  const result = generateLocalLocationHierarchyPages(frozen.generationContext, {
    generationStamp: stamp,
    skipExistingOutputs: true,
  });
  if (!result.ok) {
    return {
      ok: false,
      error: result.blockedReason || "Local area page generation failed",
      skippedExistingPaths: result.skippedExistingPaths || [],
      createdPaths: result.createdPaths || [],
    };
  }

  const createdSlugs = (result.createdPaths || []).map((filePath) => path.basename(path.dirname(filePath))).sort();
  const expected = [...expectedCreatedSlugs].sort();
  if (createdSlugs.join(",") !== expected.join(",")) {
    return {
      ok: false,
      error: `Reconciliation created unexpected local pages: ${createdSlugs.join(", ") || "(none)"}. Expected ${expected.join(", ")}.`,
      skippedExistingPaths: result.skippedExistingPaths || [],
      createdPaths: result.createdPaths || [],
    };
  }

  mergeLocalAssetsIntoEcosystemIndex(key, serviceId, result);

  const existingLocalityPaths = result.clusterPaths.filter((filePath) => filePath && !isHistoricalOutputPath(filePath));
  const currentRunLocalityPaths = (result.createdPaths || []).filter(
    (filePath) => filePath && !isHistoricalOutputPath(filePath),
  );
  const firstLocalPreview = ecosystemPagePreviewUrl(
    serviceId,
    key,
    existingLocalityPaths[0] || currentRunLocalityPaths[0] || null,
  );
  const selectedAreaNames = existing.selectedAreas.length ? existing.selectedAreas : frozen.targetAreas;
  const assets = existing.assets.map((asset) => {
    if (asset.type !== "local-area-pages") return asset;
    return {
      ...asset,
      status: "included" as const,
      included: true,
      count: existingLocalityPaths.length,
      selectedCount: selectedAreaNames.length || existingLocalityPaths.length,
      previewUrl: firstLocalPreview || asset.previewUrl,
      outputPath: path.join(ecoDir, "local"),
      notes: `${existingLocalityPaths.length} local cluster pages`,
      reviewItems: selectedAreaNames.map((name) => {
        const areaSlug = reviewAreaSlug(name);
        return {
          id: areaSlug,
          title: name,
          generated: Boolean(currentLocalPageFile(key, serviceId, areaSlug)),
        };
      }),
    };
  });

  saveContentPackage({
    ...existing,
    assets,
    previewUrls: assets.map((asset) => asset.previewUrl).filter(Boolean) as string[],
    outputPaths: assets.map((asset) => asset.outputPath).filter(Boolean) as string[],
    currentRunInventory: existing.currentRunInventory
      ? { ...existing.currentRunInventory, localityPagePaths: currentRunLocalityPaths }
      : existing.currentRunInventory,
  });

  const report = loadGenerationReport(key, serviceId);
  if (report) {
    const expectedCount = selectedAreaNames.length || existingLocalityPaths.length;
    report.localClusterOutputPaths = existingLocalityPaths;
    report.localClusterPagesGenerated = existingLocalityPaths.length;
    report.selectedAreasExpected = expectedCount;
    report.localClusterValidation = {
      ...report.localClusterValidation,
      ok: existingLocalityPaths.length === expectedCount,
      detail: `${existingLocalityPaths.length}/${expectedCount} local cluster pages`,
      selectedAreasExpected: expectedCount,
      localClusterPagesGenerated: existingLocalityPaths.length,
    };
    if (report.localClusterQualityValidation) {
      report.localClusterQualityValidation.localPagesExpected = expectedCount;
      report.localClusterQualityValidation.localPagesGenerated = existingLocalityPaths.length;
      report.localClusterQualityValidation.failedLocalPages = (
        report.localClusterQualityValidation.failedLocalPages || []
      ).filter((row) => !/:missing$/i.test(String(row)));
    }
    saveGenerationReport(report);
  }

  return {
    ok: true,
    skippedExistingPaths: result.skippedExistingPaths || [],
    createdPaths: result.createdPaths || [],
  };
}
