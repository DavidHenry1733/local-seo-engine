/**
 * Product Owner "Regenerate Improvements" workflow.
 * Resolves the campaign from authoritative Review Centre Needs Improvement
 * records — not campaign-builder selectedServiceId. Regenerates locality
 * pages only, with asset-level protection for Flu, Travel, and Blood Pressure.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  clearReviewCentreAssetImprovement,
  loadReviewCentreSession,
} from "./growthEngineReviewCentreService.ts";
import { resolveCampaignBuilderServiceName } from "./growthEngineCampaignBuilderService.ts";
import { loadFrozenCustomerCampaignGenerationContext } from "./contentEngine/customerCampaignGenerationContext.ts";
import type { ContentGenerationContext } from "./contentEngine/contentGenerationContextTypes.ts";
import { getEcosystemRoot } from "./contentEngine/contentEnginePaths.ts";
import {
  generateLocalLocationHierarchyPages,
  mergeLocalAssetsIntoEcosystemIndex,
} from "./pharmacyLocalLocationGenerationService.ts";
import { resolveApprovedServiceBank } from "./pharmacyServiceVariantLibrary.ts";
import { countGeneratedLocalityPages } from "./pharmacyAuthoritativeCampaignProgrammeService.ts";
import {
  applyCampaignRunStampToJson,
  createCampaignRunStamp,
  isHistoricalOutputPath,
  type CampaignRunStamp,
} from "./pharmacyCurrentRunCampaignHandoff.ts";
import {
  contentPackageGenerated,
  loadContentPackage,
  replaceLocalityReviewInventory,
  saveContentPackage,
} from "./pharmacyContentPackageService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { resolveLocalLocationHierarchy } from "./pharmacyLocalAreaResolver.ts";
import { resolveVisualExperienceHtmlPath } from "./pharmacyVisualExperience.ts";
import {
  REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT,
  type ReviewCentreSession,
} from "./growthEngineReviewCentreModel.ts";
import type { CurrentRunCampaignInventory } from "./pharmacyCurrentRunCampaignHandoff.ts";
import {
  assertImprovementRunBankAlignment,
  bindCurrentRegisteredApprovedBank,
  selectRegisteredApprovedBank,
} from "./pharmacyApprovedBankRunProvenance.ts";
import {
  clearLiveCampaignImageInventory,
  prepareCampaignRunImageSelections,
} from "./pharmacyTenantAutomaticImageSelectionService.ts";

type ProductOwnerNextCampaignInput = {
  tenantSlug: string;
  intent: string;
};

type ProductOwnerNextCampaignResult = {
  ok: boolean;
  error?: string;
  productOwnerInput: ProductOwnerNextCampaignInput;
  serviceId?: string;
  localCount?: number;
  reviewUrl?: string;
  runId?: string;
  currentRunInventory?: CurrentRunCampaignInventory;
};

export const PRODUCT_OWNER_REGENERATE_IMPROVEMENTS_INTENT =
  REVIEW_CENTRE_REGENERATE_IMPROVEMENTS_INTENT;

const LOCALITY_ASSET_KEY = "local-area-pages";
const BYTE_PROTECTED_ASSET_KEYS = new Set(["service-page", "images"]);
const FULLY_PROTECTED_CAMPAIGNS = new Set(["flu-vaccinations", "travel-vaccinations"]);
const OTHER_PRESERVED_CAMPAIGNS = ["pharmacy-first", "flu-vaccinations", "travel-vaccinations"] as const;
const ALL_CAMPAIGN_SERVICE_IDS = [
  "blood-pressure-checks",
  "pharmacy-first",
  "flu-vaccinations",
  "travel-vaccinations",
] as const;
export const CURRENT_RUN_LOCALITY_SIDECAR_BASENAMES = [
  "_internal-link-map.json",
  "_ecosystem-index.json",
] as const;

export type CurrentRunLocalitySidecarContext = {
  tenantSlug: string;
  serviceId: string;
  runId: string;
  storedLocalityNames: string[];
  storedLocalitySlugs: string[];
};

export type LocalityPageSnapshot = {
  stamp: string;
  files: Array<{ livePath: string; revisionPath: string }>;
};

type FileBytesSnapshot = Array<{ filePath: string; bytes: Buffer }>;

export type ProductOwnerRegenerateImprovementsPlan = {
  tenantSlug: string;
  serviceId: string;
  serviceName: string;
  approvedBankHash: string | null;
  assetKey: typeof LOCALITY_ASSET_KEY;
  niAssetKeys: string[];
  localityNames: string[];
  localitySlugs: string[];
  localityCount: number;
};

function improvementKeys(session: ReviewCentreSession, campaignId: string): string[] {
  const improvements = session.campaigns?.[campaignId]?.improvements || {};
  return Object.entries(improvements)
    .filter(([, stamped]) => Boolean(String(stamped || "").trim()))
    .map(([key]) => key)
    .sort();
}

function areaNameKey(name: string): string {
  return String(name || "").trim().toLowerCase();
}

function storedCampaignLocalityNames(
  frozenTargetAreas: string[] | undefined,
  packageAreas: string[] | undefined,
): string[] {
  const fromFrozen = (frozenTargetAreas || []).map((name) => String(name || "").trim()).filter(Boolean);
  if (fromFrozen.length) return fromFrozen;
  return (packageAreas || []).map((name) => String(name || "").trim()).filter(Boolean);
}

function constrainGenerationContextToStoredLocalities(
  ctx: ContentGenerationContext,
  localityNames: string[],
): ContentGenerationContext {
  const wanted = new Set(localityNames.map(areaNameKey));
  const selectedAreas = (ctx.selectedAreas || []).filter((area) => wanted.has(areaNameKey(area.areaName)));
  const rawProfile = ctx.rawProfile as { selectedAreas?: Array<{ areaName?: string; selected?: boolean }> };
  return {
    ...ctx,
    selectedAreas,
    rawProfile: {
      ...rawProfile,
      selectedAreas: (rawProfile.selectedAreas || []).map((area) => ({
        ...area,
        selected: wanted.has(areaNameKey(String(area.areaName || ""))),
      })),
    },
  };
}

function addExistingFile(paths: string[], filePath: string | null | undefined): void {
  const resolved = String(filePath || "").trim();
  if (!resolved || paths.includes(resolved)) return;
  if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) return;
  paths.push(resolved);
}

function addExistingTreeFiles(paths: string[], root: string, predicate?: (filePath: string) => boolean): void {
  if (!fs.existsSync(root)) return;
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (entry.isFile() && (!predicate || predicate(full))) addExistingFile(paths, full);
    }
  };
  const stat = fs.statSync(root);
  if (stat.isFile()) {
    if (!predicate || predicate(root)) addExistingFile(paths, root);
    return;
  }
  if (stat.isDirectory()) walk(root);
}

export function currentCampaignOutputRoot(slug: string, serviceId: string): string {
  return path.resolve(getEcosystemRoot(serviceId, slug));
}

export function currentCampaignPackagePath(slug: string, serviceId: string): string {
  return path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
}

function isPathInsideRoot(filePath: string, root: string): boolean {
  const resolved = path.resolve(filePath);
  const rootResolved = path.resolve(root);
  const relative = path.relative(rootResolved, resolved);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

export function isCurrentCampaignPackagePath(filePath: string, slug: string, serviceId: string): boolean {
  return path.resolve(filePath) === path.resolve(currentCampaignPackagePath(slug, serviceId));
}

export function isCurrentCampaignLocalitySidecarPath(
  filePath: string,
  slug: string,
  serviceId: string,
): boolean {
  const resolved = path.resolve(String(filePath || ""));
  if (!resolved || isHistoricalOutputPath(resolved)) return false;
  if (isCurrentCampaignPackagePath(resolved, slug, serviceId)) return true;
  const root = currentCampaignOutputRoot(slug, serviceId);
  const base = path.basename(resolved);
  return (
    CURRENT_RUN_LOCALITY_SIDECAR_BASENAMES.includes(base as (typeof CURRENT_RUN_LOCALITY_SIDECAR_BASENAMES)[number]) &&
    path.dirname(resolved) === root
  );
}

function isCurrentCampaignLocalityPagePath(
  filePath: string,
  ctx: CurrentRunLocalitySidecarContext,
): boolean {
  const resolved = path.resolve(String(filePath || ""));
  if (!resolved || isHistoricalOutputPath(resolved)) return false;
  const root = currentCampaignOutputRoot(ctx.tenantSlug, ctx.serviceId);
  if (!isPathInsideRoot(resolved, root)) return false;
  const relative = path.relative(root, resolved).replace(/\\/g, "/");
  const match = relative.match(/^local\/([^/]+)\/index\.html$/);
  if (!match) return false;
  return ctx.storedLocalitySlugs.includes(match[1]);
}

export function listLocalityTransactionSnapshotLivePaths(
  slug: string,
  serviceId: string,
  areaSlugs: string[],
): string[] {
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const paths: string[] = [];
  for (const areaSlug of areaSlugs) {
    addExistingFile(paths, path.join(ecosystemRoot, "local", areaSlug, "index.html"));
  }
  addExistingFile(paths, path.join(ecosystemRoot, "_internal-link-map.json"));
  addExistingFile(paths, path.join(ecosystemRoot, "_ecosystem-index.json"));
  addExistingFile(paths, currentCampaignPackagePath(slug, serviceId));
  return paths;
}

export function listCurrentRunLocalitySidecarPaths(slug: string, serviceId: string): string[] {
  const root = currentCampaignOutputRoot(slug, serviceId);
  const paths: string[] = [];
  addExistingFile(paths, path.join(root, "_internal-link-map.json"));
  addExistingFile(paths, path.join(root, "_ecosystem-index.json"));
  addExistingFile(paths, currentCampaignPackagePath(slug, serviceId));
  return paths;
}

function sidecarClassificationError(
  kind: "service" | "locality" | "runId" | "path",
  detail: string,
): string {
  if (kind === "service") return `Current-run locality sidecar contains another serviceId: ${detail}`;
  if (kind === "locality") return `Current-run locality sidecar contains an unstored locality: ${detail}`;
  if (kind === "runId") return `Current-run locality sidecar runId does not match the current run: ${detail}`;
  return `Current-run locality sidecar path is outside the current campaign output root: ${detail}`;
}

function readObject(raw: string): Record<string, unknown> | null {
  try {
    const data = JSON.parse(raw) as unknown;
    if (data && typeof data === "object" && !Array.isArray(data)) return data as Record<string, unknown>;
  } catch {
    /* not JSON */
  }
  return null;
}

function collectDeclaredLocalities(data: Record<string, unknown>): { names: string[]; slugs: string[] } {
  const names = new Set<string>();
  const slugs = new Set<string>();
  const addName = (value: unknown) => {
    const name = String(value || "").trim();
    if (name) names.add(name);
  };
  const addSlug = (value: unknown) => {
    const slug = String(value || "")
      .trim()
      .toLowerCase();
    if (slug && slug !== "hub" && slug !== "locations") slugs.add(slug);
  };

  for (const area of (data.selectedAreas as unknown[]) || []) addName(area);

  const pages = [
    ...(((data.localClusterPages as Array<Record<string, unknown>>) || [])),
    ...(((data.localLocationClusters as Array<Record<string, unknown>>) || [])),
  ];
  for (const page of pages) {
    addName(page.areaName);
    addSlug(page.areaSlug);
  }

  const hierarchy = data.localLocationHierarchy as
    | { clusters?: Array<{ name?: string; slug?: string }>; areas?: Array<{ name?: string; slug?: string }> }
    | undefined;
  for (const cluster of hierarchy?.clusters || []) {
    addName(cluster.name);
    addSlug(cluster.slug);
  }
  for (const area of hierarchy?.areas || []) {
    addName(area.name);
    addSlug(area.slug);
  }

  const inventory = data.currentRunInventory as { localityPagePaths?: string[] } | undefined;
  for (const filePath of inventory?.localityPagePaths || []) {
    const match = String(filePath || "")
      .replace(/\\/g, "/")
      .match(/\/local\/([^/]+)\//);
    if (match) addSlug(match[1]);
  }

  const nested = data.internalLinkMap;
  if (nested && typeof nested === "object" && !Array.isArray(nested)) {
    const inner = collectDeclaredLocalities(nested as Record<string, unknown>);
    for (const name of inner.names) names.add(name);
    for (const slug of inner.slugs) slugs.add(slug);
  }

  return { names: [...names], slugs: [...slugs] };
}

function sidecarDeclaredServiceId(data: Record<string, unknown>): string | null {
  if (typeof data.serviceId === "string" && data.serviceId.trim()) return data.serviceId.trim();
  const stamp = data.generationStamp as { campaignId?: string } | undefined;
  if (typeof stamp?.campaignId === "string" && stamp.campaignId.trim()) return stamp.campaignId.trim();
  return null;
}

function sidecarDeclaredRunId(data: Record<string, unknown>): string | null {
  const stamp = data.generationStamp as { runId?: string } | undefined;
  if (typeof stamp?.runId === "string" && stamp.runId.trim()) return stamp.runId.trim();
  const inventory = data.currentRunInventory as { runId?: string; generationStamp?: { runId?: string } } | undefined;
  if (typeof inventory?.runId === "string" && inventory.runId.trim()) return inventory.runId.trim();
  if (typeof inventory?.generationStamp?.runId === "string" && inventory.generationStamp.runId.trim()) {
    return inventory.generationStamp.runId.trim();
  }
  const nested = data.internalLinkMap as { generationStamp?: { runId?: string } } | undefined;
  if (typeof nested?.generationStamp?.runId === "string" && nested.generationStamp.runId.trim()) {
    return nested.generationStamp.runId.trim();
  }
  return null;
}

function foreignServiceIdInSidecar(data: Record<string, unknown>, currentServiceId: string): string | null {
  const foreign = ALL_CAMPAIGN_SERVICE_IDS.filter((id) => id !== currentServiceId);
  const visit = (node: unknown): string | null => {
    if (typeof node === "string") return foreign.includes(node as (typeof ALL_CAMPAIGN_SERVICE_IDS)[number]) ? node : null;
    if (Array.isArray(node)) {
      for (const item of node) {
        const hit = visit(item);
        if (hit) return hit;
      }
      return null;
    }
    if (node && typeof node === "object") {
      for (const value of Object.values(node)) {
        const hit = visit(value);
        if (hit) return hit;
      }
    }
    return null;
  };
  return visit(data);
}

export function assertCurrentRunLocalitySidecarContents(
  filePath: string,
  raw: string,
  ctx: CurrentRunLocalitySidecarContext,
): { ok: true } | { ok: false; error: string } {
  const resolved = path.resolve(filePath);
  if (
    isHistoricalOutputPath(resolved) ||
    !isCurrentCampaignLocalitySidecarPath(resolved, ctx.tenantSlug, ctx.serviceId)
  ) {
    return { ok: false, error: sidecarClassificationError("path", resolved) };
  }

  const data = readObject(raw);
  if (!data) return { ok: false, error: sidecarClassificationError("path", resolved) };

  const declaredService = sidecarDeclaredServiceId(data);
  if (declaredService && declaredService !== ctx.serviceId) {
    return { ok: false, error: sidecarClassificationError("service", declaredService) };
  }
  const foreign = foreignServiceIdInSidecar(data, ctx.serviceId);
  if (foreign) return { ok: false, error: sidecarClassificationError("service", foreign) };

  const runId = sidecarDeclaredRunId(data);
  if (!runId || runId !== ctx.runId) {
    return { ok: false, error: sidecarClassificationError("runId", runId || "missing") };
  }

  const storedNames = new Set(ctx.storedLocalityNames.map(areaNameKey));
  const storedSlugs = new Set(ctx.storedLocalitySlugs.map((slug) => slug.trim().toLowerCase()));
  const declared = collectDeclaredLocalities(data);
  const extraName = declared.names.find((name) => !storedNames.has(areaNameKey(name)));
  if (extraName) return { ok: false, error: sidecarClassificationError("locality", extraName) };
  const extraSlug = declared.slugs.find((slug) => !storedSlugs.has(slug));
  if (extraSlug) return { ok: false, error: sidecarClassificationError("locality", extraSlug) };

  const inventory = data.currentRunInventory as { localityPagePaths?: string[] } | undefined;
  for (const localityPath of inventory?.localityPagePaths || []) {
    if (
      isHistoricalOutputPath(localityPath) ||
      !isPathInsideRoot(localityPath, currentCampaignOutputRoot(ctx.tenantSlug, ctx.serviceId))
    ) {
      return { ok: false, error: sidecarClassificationError("path", localityPath) };
    }
  }

  return { ok: true };
}

export function assertReturnedCurrentRunLocalitySidecars(
  returnedPaths: string[],
  ctx: CurrentRunLocalitySidecarContext,
): { ok: true } | { ok: false; error: string } {
  const seen = new Set<string>();
  for (const filePath of returnedPaths) {
    const resolved = path.resolve(String(filePath || ""));
    if (!resolved || seen.has(resolved)) continue;
    seen.add(resolved);
    if (isCurrentCampaignLocalityPagePath(resolved, ctx)) continue;
    if (
      isHistoricalOutputPath(resolved) ||
      !isCurrentCampaignLocalitySidecarPath(resolved, ctx.tenantSlug, ctx.serviceId)
    ) {
      return { ok: false, error: sidecarClassificationError("path", resolved) };
    }
    if (!fs.existsSync(resolved) || !fs.statSync(resolved).isFile()) {
      return { ok: false, error: sidecarClassificationError("path", resolved) };
    }
    const check = assertCurrentRunLocalitySidecarContents(resolved, fs.readFileSync(resolved, "utf8"), ctx);
    if (!check.ok) return check;
  }
  return { ok: true };
}

export function listByteProtectedIntegrityPaths(slug: string, targetServiceId: string): string[] {
  const paths: string[] = [];
  addExistingFile(paths, resolveVisualExperienceHtmlPath(targetServiceId as never, slug));
  const targetPkg = loadContentPackage(slug, targetServiceId);
  for (const asset of targetPkg?.assets || []) {
    if (asset.type === LOCALITY_ASSET_KEY) continue;
    if (isCurrentCampaignLocalitySidecarPath(asset.outputPath || "", slug, targetServiceId)) continue;
    addExistingFile(paths, asset.outputPath);
  }
  addExistingFile(
    paths,
    path.join(PHARMACY_WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`),
  );
  addExistingTreeFiles(paths, path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-approved-service-banks"));
  for (const other of OTHER_PRESERVED_CAMPAIGNS) {
    if (other === targetServiceId) continue;
    addExistingFile(paths, resolveVisualExperienceHtmlPath(other as never, slug));
    addExistingFile(paths, currentCampaignPackagePath(slug, other));
    const otherRoot = currentCampaignOutputRoot(slug, other);
    addExistingFile(paths, path.join(otherRoot, "_internal-link-map.json"));
    addExistingFile(paths, path.join(otherRoot, "_ecosystem-index.json"));
  }
  addExistingTreeFiles(
    paths,
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug),
    (filePath) => isHistoricalOutputPath(filePath),
  );
  addExistingTreeFiles(
    paths,
    path.join(PHARMACY_WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug),
    (filePath) => isHistoricalOutputPath(filePath),
  );
  return paths;
}

function snapshotFileBytes(paths: string[]): FileBytesSnapshot {
  return paths.map((filePath) => ({ filePath, bytes: fs.readFileSync(filePath) }));
}

function restoreFileBytes(snapshot: FileBytesSnapshot): void {
  for (const file of snapshot) {
    fs.mkdirSync(path.dirname(file.filePath), { recursive: true });
    fs.writeFileSync(file.filePath, file.bytes);
  }
}

function fileBytesUnchanged(snapshot: FileBytesSnapshot): { ok: true } | { ok: false; error: string } {
  for (const file of snapshot) {
    if (!fs.existsSync(file.filePath)) {
      return { ok: false, error: `Protected file missing after regeneration: ${file.filePath}` };
    }
    const next = fs.readFileSync(file.filePath);
    if (crypto.createHash("sha256").update(next).digest("hex") !==
      crypto.createHash("sha256").update(file.bytes).digest("hex")) {
      return {
        ok: false,
        error: "Refusing to modify the Blood Pressure service page, images, or unrelated campaign assets",
      };
    }
  }
  return { ok: true };
}

export function isRegenerateImprovementsIntent(intent: string): boolean {
  return String(intent || "").trim().toLowerCase() === PRODUCT_OWNER_REGENERATE_IMPROVEMENTS_INTENT;
}

export function rejectProductOwnerManualFields(body: Record<string, unknown>): string | null {
  const forbidden = [
    "serviceId",
    "campaignId",
    "areas",
    "localities",
    "content",
    "bank",
    "bankHash",
    "approvedBankHash",
    "images",
    "assetPath",
    "assetPaths",
    "outputPath",
    "outputPaths",
    "localPaths",
    "areaSlugs",
    "areaSlug",
    "assetKey",
  ];
  const present = forbidden.filter((key) => body[key] != null && String(body[key]).trim() !== "");
  return present.length ? `Manual fields are not accepted: ${present.join(", ")}` : null;
}

export function listReviewCentreLocalityNeedsImprovementCampaigns(
  session: ReviewCentreSession,
): { eligible: string[]; fullyProtected: string[]; unsupported: Array<{ campaignId: string; assets: string[] }> } {
  const eligible: string[] = [];
  const fullyProtected: string[] = [];
  const unsupported: Array<{ campaignId: string; assets: string[] }> = [];
  for (const campaignId of Object.keys(session.campaigns || {}).sort()) {
    const niKeys = improvementKeys(session, campaignId);
    if (!niKeys.length) continue;
    if (FULLY_PROTECTED_CAMPAIGNS.has(campaignId)) {
      if (niKeys.includes(LOCALITY_ASSET_KEY)) fullyProtected.push(campaignId);
      continue;
    }
    if (!niKeys.includes(LOCALITY_ASSET_KEY)) continue;
    const extra = niKeys.filter((key) => key !== LOCALITY_ASSET_KEY && !BYTE_PROTECTED_ASSET_KEYS.has(key));
    if (extra.length) {
      unsupported.push({ campaignId, assets: extra });
      continue;
    }
    eligible.push(campaignId);
  }
  return { eligible, fullyProtected, unsupported };
}

export function resolveProductOwnerRegenerateImprovementsPlan(
  tenantSlug: string,
  reviewSession?: ReviewCentreSession,
): { ok: true; plan: ProductOwnerRegenerateImprovementsPlan } | { ok: false; error: string } {
  const slug = String(tenantSlug || "").trim();
  if (!slug) return { ok: false, error: "tenantSlug is required" };

  const session = reviewSession || loadReviewCentreSession(slug);
  const listed = listReviewCentreLocalityNeedsImprovementCampaigns(session);
  if (listed.unsupported.length) {
    const first = listed.unsupported[0];
    return {
      ok: false,
      error: `Regenerate Improvements only supports locality pages marked as needing improvement (${first.campaignId}: ${first.assets.join(", ")})`,
    };
  }
  if (listed.eligible.length === 0) {
    if (listed.fullyProtected.length) {
      return {
        ok: false,
        error: "Refusing to regenerate Flu or Travel from Regenerate Improvements",
      };
    }
    return { ok: false, error: "No locality pages are marked as needing improvement" };
  }
  if (listed.eligible.length > 1) {
    return {
      ok: false,
      error: `Multiple campaigns have locality pages marked as needing improvement (${listed.eligible.join(", ")})`,
    };
  }

  const serviceId = listed.eligible[0];
  const niAssetKeys = improvementKeys(session, serviceId);
  if (!niAssetKeys.includes(LOCALITY_ASSET_KEY)) {
    return { ok: false, error: "Requested asset is not marked as needing improvement" };
  }
  if (!contentPackageGenerated(slug, serviceId)) {
    return { ok: false, error: "Current campaign has no generated review inventory" };
  }

  const frozen = loadFrozenCustomerCampaignGenerationContext(slug, serviceId);
  if (!frozen || frozen.serviceId !== serviceId) {
    return { ok: false, error: "Stored campaign generation context is missing for the Review Centre campaign" };
  }

  const hierarchy = resolveLocalLocationHierarchy(
    slug,
    serviceId,
    frozen.generationContext.rawProfile,
  );
  if (!hierarchy.ok) {
    return { ok: false, error: hierarchy.blockedReason || "Stored campaign localities could not be resolved" };
  }

  const pkg = loadContentPackage(slug, serviceId);
  const storedNames = storedCampaignLocalityNames(frozen.targetAreas, pkg?.selectedAreas);
  if (!storedNames.length) {
    return { ok: false, error: "Stored campaign localities could not be resolved" };
  }
  const byName = new Map(hierarchy.clusters.map((cluster) => [areaNameKey(cluster.name), cluster]));
  const clusters: typeof hierarchy.clusters = [];
  for (const name of storedNames) {
    const cluster = byName.get(areaNameKey(name));
    if (!cluster) {
      return { ok: false, error: "Stored campaign localities could not be resolved" };
    }
    clusters.push(cluster);
  }

  const bank = resolveApprovedServiceBank(serviceId);
  const selected = selectRegisteredApprovedBank(serviceId);
  return {
    ok: true,
    plan: {
      tenantSlug: slug,
      serviceId,
      serviceName: frozen.campaignName || resolveCampaignBuilderServiceName(serviceId),
      approvedBankHash: selected.hash || bank?.hash || null,
      assetKey: LOCALITY_ASSET_KEY,
      niAssetKeys,
      localityNames: clusters.map((c) => c.name),
      localitySlugs: clusters.map((c) => c.slug),
      localityCount: clusters.length,
    },
  };
}

export function snapshotLocalityLivePages(
  slug: string,
  serviceId: string,
  areaSlugs: string[],
  stamp = new Date().toISOString().replace(/[:.]/g, "-"),
): LocalityPageSnapshot {
  const ecosystemRoot = getEcosystemRoot(serviceId, slug);
  const files: LocalityPageSnapshot["files"] = [];
  const copyTo = (livePath: string, revisionPath: string) => {
    if (!fs.existsSync(livePath) || !fs.statSync(livePath).isFile()) return;
    fs.mkdirSync(path.dirname(revisionPath), { recursive: true });
    fs.copyFileSync(livePath, revisionPath);
    files.push({ livePath, revisionPath });
  };
  for (const areaSlug of areaSlugs) {
    copyTo(
      path.join(ecosystemRoot, "local", areaSlug, "index.html"),
      path.join(ecosystemRoot, "local", areaSlug, "revisions", stamp, "index.html"),
    );
  }
  copyTo(
    path.join(ecosystemRoot, "_internal-link-map.json"),
    path.join(ecosystemRoot, "revisions", stamp, "_internal-link-map.json"),
  );
  copyTo(
    path.join(ecosystemRoot, "_ecosystem-index.json"),
    path.join(ecosystemRoot, "revisions", stamp, "_ecosystem-index.json"),
  );
  copyTo(
    path.join(PHARMACY_WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`),
    path.join(ecosystemRoot, "revisions", stamp, `${serviceId}.package.json`),
  );
  return { stamp, files };
}

export function restoreLocalityLivePages(snapshot: LocalityPageSnapshot): void {
  for (const file of snapshot.files) {
    if (!fs.existsSync(file.revisionPath)) continue;
    fs.mkdirSync(path.dirname(file.livePath), { recursive: true });
    fs.copyFileSync(file.revisionPath, file.livePath);
  }
}

export async function runProductOwnerRegenerateImprovementsWorkflow(
  input: ProductOwnerNextCampaignInput,
  extraBody: Record<string, unknown> = {},
): Promise<ProductOwnerNextCampaignResult> {
  const tenantSlug = String(input.tenantSlug || "").trim();
  const intent = String(input.intent || "").trim();
  const productOwnerInput = { tenantSlug, intent };

  if (!tenantSlug) {
    return { ok: false, error: "tenantSlug is required", productOwnerInput };
  }
  if (!isRegenerateImprovementsIntent(intent)) {
    return { ok: false, error: "Unsupported Product Owner intent", productOwnerInput };
  }
  const manual = rejectProductOwnerManualFields(extraBody);
  if (manual) {
    return { ok: false, error: manual, productOwnerInput };
  }

  const resolved = resolveProductOwnerRegenerateImprovementsPlan(tenantSlug);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error, productOwnerInput };
  }
  const plan = resolved.plan;
  if (plan.assetKey !== LOCALITY_ASSET_KEY || !plan.niAssetKeys.includes(LOCALITY_ASSET_KEY)) {
    return {
      ok: false,
      error: "Requested asset is not marked as needing improvement",
      productOwnerInput,
      serviceId: plan.serviceId,
    };
  }
  if (FULLY_PROTECTED_CAMPAIGNS.has(plan.serviceId)) {
    return {
      ok: false,
      error: "Refusing to regenerate Flu or Travel from Regenerate Improvements",
      productOwnerInput,
      serviceId: plan.serviceId,
    };
  }

  const reviewCentreFile = path.join(
    PHARMACY_WORKSPACE_ROOT,
    "data/growth-engine",
    `${tenantSlug}-review-centre.json`,
  );
  const reviewCentreBytes = fs.existsSync(reviewCentreFile) ? fs.readFileSync(reviewCentreFile) : null;
  const frozen = loadFrozenCustomerCampaignGenerationContext(tenantSlug, plan.serviceId);
  if (!frozen || frozen.serviceId !== plan.serviceId) {
    return {
      ok: false,
      error: "Stored campaign generation context is missing for the Review Centre campaign",
      productOwnerInput,
      serviceId: plan.serviceId,
    };
  }
  const boundCtx = constrainGenerationContextToStoredLocalities(
    bindCurrentRegisteredApprovedBank(frozen.generationContext),
    plan.localityNames,
  );
  const selectedBank = selectRegisteredApprovedBank(plan.serviceId);
  if (selectedBank.registered && (!boundCtx.approvedBankHash || boundCtx.approvedBankHash !== selectedBank.hash)) {
    return {
      ok: false,
      error: `Registered approved bank could not be bound at execution time (registry=${selectedBank.hash || "missing"})`,
      productOwnerInput,
      serviceId: plan.serviceId,
    };
  }

  const stamp: CampaignRunStamp = createCampaignRunStamp(
    tenantSlug,
    plan.serviceId,
    undefined,
    undefined,
    boundCtx.approvedBankHash,
  );
  const snapshot = snapshotLocalityLivePages(tenantSlug, plan.serviceId, plan.localitySlugs, stamp.runId);
  const protectedSnapshot = snapshotFileBytes(listByteProtectedIntegrityPaths(tenantSlug, plan.serviceId));

  const failClosed = (
    error: string,
    extra?: { localCount?: number; restorePackage?: boolean; previousManifest?: ReturnType<typeof loadContentPackage> },
  ): ProductOwnerNextCampaignResult => {
    restoreLocalityLivePages(snapshot);
    restoreFileBytes(protectedSnapshot);
    try {
      if (reviewCentreBytes) fs.writeFileSync(reviewCentreFile, reviewCentreBytes);
    } catch {
      /* review session restore best-effort */
    }
    if (extra?.restorePackage && extra.previousManifest) {
      saveContentPackage(extra.previousManifest);
    }
    return {
      ok: false,
      error,
      productOwnerInput,
      serviceId: plan.serviceId,
      localCount: extra?.localCount,
    };
  };

  try {
    prepareCampaignRunImageSelections({
      tenantSlug,
      serviceId: plan.serviceId,
      runId: stamp.runId,
      seed: stamp.runId,
      localitySlugs: plan.localitySlugs,
      explicitImprovement: true,
    });
    const locals = await generateLocalLocationHierarchyPages(boundCtx, {
      generationStamp: stamp,
    });
    if (!locals.ok) {
      return failClosed(locals.blockedReason || "Locality regeneration failed", { localCount: 0 });
    }

    const localityPaths = locals.clusterPaths.filter((p) => p && !isHistoricalOutputPath(p));
    if (localityPaths.length !== plan.localityCount) {
      return failClosed(`Expected ${plan.localityCount} locality pages, generated ${localityPaths.length}`, {
        localCount: localityPaths.length,
      });
    }

    mergeLocalAssetsIntoEcosystemIndex(tenantSlug, plan.serviceId, locals);
    const ecosystemRoot = currentCampaignOutputRoot(tenantSlug, plan.serviceId);
    const ecosystemIndexPath = path.join(ecosystemRoot, "_ecosystem-index.json");
    if (fs.existsSync(ecosystemIndexPath) && !isHistoricalOutputPath(ecosystemIndexPath)) {
      fs.writeFileSync(
        ecosystemIndexPath,
        applyCampaignRunStampToJson(fs.readFileSync(ecosystemIndexPath, "utf8"), stamp),
        "utf8",
      );
    }
    const replaced = replaceLocalityReviewInventory(tenantSlug, plan.serviceId, {
      localityPagePaths: localityPaths,
      generationStamp: stamp,
      approvedBankHash: boundCtx.approvedBankHash || null,
    });
    if (!replaced.ok) {
      return failClosed(replaced.error || "Failed to replace locality review inventory", {
        localCount: localityPaths.length,
        restorePackage: true,
        previousManifest: replaced.previousManifest,
      });
    }

    const alignment = assertImprovementRunBankAlignment({
      generatedBankHash: boundCtx.approvedBankHash,
      reviewBankHash: replaced.manifest?.currentRunInventory?.approvedBankHash || replaced.manifest?.approvedBankHash,
      registryBankHash: selectedBank.hash,
    });
    if (!alignment.ok) {
      return failClosed(alignment.error, {
        localCount: localityPaths.length,
        restorePackage: true,
        previousManifest: replaced.previousManifest,
      });
    }

    const sidecarCtx: CurrentRunLocalitySidecarContext = {
      tenantSlug,
      serviceId: plan.serviceId,
      runId: stamp.runId,
      storedLocalityNames: plan.localityNames,
      storedLocalitySlugs: plan.localitySlugs,
    };
    const returnedSidecars = [
      ...listCurrentRunLocalitySidecarPaths(tenantSlug, plan.serviceId),
      ...(replaced.manifest?.currentRunInventory?.reviewRecordPaths || []),
    ];
    const sidecarCheck = assertReturnedCurrentRunLocalitySidecars(returnedSidecars, sidecarCtx);
    if (!sidecarCheck.ok) {
      return failClosed(sidecarCheck.error, {
        localCount: localityPaths.length,
        restorePackage: true,
        previousManifest: replaced.previousManifest,
      });
    }

    const protectedCheck = fileBytesUnchanged(protectedSnapshot);
    if (!protectedCheck.ok) {
      return failClosed(protectedCheck.error, {
        localCount: localityPaths.length,
        restorePackage: true,
        previousManifest: replaced.previousManifest,
      });
    }

    clearReviewCentreAssetImprovement(tenantSlug, plan.serviceId, LOCALITY_ASSET_KEY);

    const counted = countGeneratedLocalityPages(tenantSlug, plan.serviceId);
    return {
      ok: true,
      productOwnerInput,
      serviceId: plan.serviceId,
      localCount: counted || localityPaths.length,
      runId: stamp.runId,
      currentRunInventory: replaced.manifest?.currentRunInventory,
      reviewUrl: `/api/growth-engine/review-centre?slug=${encodeURIComponent(tenantSlug)}&campaign=${encodeURIComponent(plan.serviceId)}`,
    };
  } catch (err) {
    return failClosed(err instanceof Error ? err.message : String(err));
  } finally {
    clearLiveCampaignImageInventory(tenantSlug, plan.serviceId, stamp.runId);
  }
}
