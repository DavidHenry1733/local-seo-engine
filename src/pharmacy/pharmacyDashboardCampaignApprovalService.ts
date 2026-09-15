/**
 * Dashboard campaign Approve — independent lock after Review Centre is complete.
 * Re-reads Review Centre, approved-bank registry/hash, current-run inventory, and package.
 * Does not publish, index, generate, or change Review Centre group approvals.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  loadContentPackage,
  saveContentPackage,
  verifyContentPackageReviewSources,
  type ContentPackageManifest,
} from "./pharmacyContentPackageService.ts";
import { resolveApprovedServiceBank } from "./pharmacyServiceVariantLibrary.ts";
import { buildReviewCentreView, reviewCentreUrl } from "./growthEngineReviewCentreService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import {
  fileHasRequiredGenerationStamp,
  fileMatchesCurrentRunStamp,
  isHistoricalOutputPath,
} from "./pharmacyCurrentRunCampaignHandoff.ts";
import { campaignApproveApiPath } from "./growthEngineCampaignApproveControl.ts";

export const DASHBOARD_CAMPAIGN_APPROVAL_TASK = "DASHBOARD-CAMPAIGN-APPROVAL-ACTION-36";
export const EXPECTED_CAMPAIGN_LOCALITY_COUNT = 8;

export interface DashboardCampaignApprovalRequest {
  tenantSlug: string;
  campaignId: string;
}

export interface DashboardCampaignApprovalEvaluation {
  ok: boolean;
  unmetCondition: string | null;
  alreadyLocked: boolean;
  tenantSlug: string;
  campaignId: string;
  serviceName: string;
  registryHash: string | null;
  lockedBankHash: string | null;
  servicePagePath: string | null;
  localityPagePaths: string[];
  imageInventoryPath: string | null;
  packagePath: string;
  approvalRecordPath: string;
  dashboardRedirect: string;
  reviewCentreRedirect: string;
}

export interface DashboardCampaignApprovalResult {
  ok: boolean;
  unmetCondition: string | null;
  alreadyLocked: boolean;
  applied: boolean;
  status: "approved-locked" | null;
  message: string | null;
  redirect: string;
  tenantSlug: string;
  campaignId: string;
  published: false;
  indexed: false;
}

export interface DashboardCampaignApprovalWriter {
  writePackage(manifest: ContentPackageManifest): void;
  writeApprovalRecord(filePath: string, record: Record<string, unknown>): void;
}

function tenantKey(slug: string): string {
  return String(slug || "")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function packagePathFor(slug: string, campaignId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", tenantKey(slug), `${campaignId}.json`);
}

function approvalRecordPathFor(slug: string, campaignId: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/campaign-approvals",
    tenantKey(slug),
    `${campaignId}.json`,
  );
}

function dashboardUrl(slug: string, approvedCampaignId?: string): string {
  const base = `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`;
  if (!approvedCampaignId) return base;
  return `${base}&approved=${encodeURIComponent(approvedCampaignId)}`;
}

function reviewCentreUnmetUrl(slug: string, campaignId: string, unmet: string): string {
  return `${reviewCentreUrl(slug, campaignId)}&unmet=${encodeURIComponent(unmet)}`;
}

function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

function areaSlugFromLocalityPath(file: string): string {
  const parts = String(file || "")
    .replace(/\\/g, "/")
    .split("/");
  const idx = parts.lastIndexOf("index.html");
  return idx > 0 ? parts[idx - 1] : "";
}

function areaNameFromSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function isApprovedLockedPackage(pkg: ContentPackageManifest | null): boolean {
  if (!pkg) return false;
  return (
    pkg.status === "approved-locked" ||
    pkg.approvalStatus === "approved-locked" ||
    Boolean(pkg.campaignLock?.lockedBankHash)
  );
}

function isApprovedLockedRecord(file: string): boolean {
  if (!fs.existsSync(file)) return false;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as { status?: string };
    return raw.status === "approved-locked";
  } catch {
    return false;
  }
}

export function liveDashboardCampaignApprovalWriter(): DashboardCampaignApprovalWriter {
  return {
    writePackage(manifest) {
      saveContentPackage(manifest);
    },
    writeApprovalRecord(filePath, record) {
      fs.mkdirSync(path.dirname(filePath), { recursive: true });
      fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
    },
  };
}

export function parseDashboardCampaignApproveRequest(
  routeSlug: string,
  body: unknown,
): { ok: true; tenantSlug: string; campaignId: string } | { ok: false; unmetCondition: string } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, unmetCondition: "Approve request may only include tenantSlug and campaignId" };
  }
  const rec = body as Record<string, unknown>;
  const extra = Object.keys(rec).filter((key) => key !== "tenantSlug" && key !== "campaignId");
  if (extra.length) {
    return { ok: false, unmetCondition: "Approve request may only include tenantSlug and campaignId" };
  }
  const tenantSlug = String(rec.tenantSlug || "").trim();
  const campaignId = String(rec.campaignId || "").trim();
  const expected = tenantKey(routeSlug);
  if (!tenantSlug || tenantKey(tenantSlug) !== expected) {
    return { ok: false, unmetCondition: "tenantSlug must match the Product Owner tenant" };
  }
  if (!campaignId) {
    return { ok: false, unmetCondition: "campaignId is required" };
  }
  return { ok: true, tenantSlug: expected, campaignId };
}

export function evaluateDashboardCampaignApproval(
  tenantSlug: string,
  campaignId: string,
): DashboardCampaignApprovalEvaluation {
  const slug = tenantKey(tenantSlug);
  const serviceId = String(campaignId || "").trim();
  const serviceName = getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const pkgPath = packagePathFor(slug, serviceId);
  const approvalPath = approvalRecordPathFor(slug, serviceId);
  const base: DashboardCampaignApprovalEvaluation = {
    ok: false,
    unmetCondition: null,
    alreadyLocked: false,
    tenantSlug: slug,
    campaignId: serviceId,
    serviceName,
    registryHash: null,
    lockedBankHash: null,
    servicePagePath: null,
    localityPagePaths: [],
    imageInventoryPath: null,
    packagePath: pkgPath,
    approvalRecordPath: approvalPath,
    dashboardRedirect: dashboardUrl(slug, serviceId),
    reviewCentreRedirect: reviewCentreUrl(slug, serviceId),
  };

  const fail = (unmetCondition: string): DashboardCampaignApprovalEvaluation => ({
    ...base,
    ok: false,
    unmetCondition,
    reviewCentreRedirect: reviewCentreUnmetUrl(slug, serviceId, unmetCondition),
  });

  if (!serviceId) return fail("campaignId is required");

  const pkg = loadContentPackage(slug, serviceId);
  if (isApprovedLockedPackage(pkg) || isApprovedLockedRecord(approvalPath)) {
    return {
      ...base,
      ok: true,
      alreadyLocked: true,
      lockedBankHash: pkg?.campaignLock?.lockedBankHash || pkg?.approvedBankHash || null,
      registryHash: resolveApprovedServiceBank(serviceId)?.hash || null,
      servicePagePath: pkg?.currentRunInventory?.servicePagePath || null,
      localityPagePaths: pkg?.currentRunInventory?.localityPagePaths || [],
    };
  }

  if (!pkg) return fail("Campaign package is missing");

  let view;
  try {
    view = buildReviewCentreView(slug, serviceId);
  } catch (err) {
    return fail(`Current-run provenance is not valid: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (!view || !view.groups.length) {
    return fail("Not every Review Centre group is approved");
  }
  const groupsApproved =
    view.groups.length > 0 &&
    view.groups.every(
      (group) => group.required && group.assets.length > 0 && group.assets.every((a) => a.status === "approved"),
    );
  if (!groupsApproved || !view.allApproved || !view.campaignLockReady || view.readyCount > 0) {
    return fail("Not every required Review Centre group is approved");
  }
  if (view.needsImprovementCount > 0) {
    return fail("Review Centre has groups that need improvement");
  }

  const inventory = pkg.currentRunInventory;
  const servicePagePath = inventory?.servicePagePath || pkg.assets.find((a) => a.type === "service-page")?.outputPath || null;
  if (!servicePagePath || !fs.existsSync(servicePagePath) || !fs.statSync(servicePagePath).isFile()) {
    return fail("Service page does not exist");
  }

  const localityPagePaths = (inventory?.localityPagePaths || []).filter((p) => p && !isHistoricalOutputPath(p));
  const existingLocalities = localityPagePaths.filter((p) => fs.existsSync(p) && fs.statSync(p).isFile());
  if (existingLocalities.length !== EXPECTED_CAMPAIGN_LOCALITY_COUNT) {
    return fail(
      `All eight locality pages must exist (found ${existingLocalities.length})`,
    );
  }

  const resolved = resolveApprovedServiceBank(serviceId);
  const registryHash = resolved?.hash || null;
  const packageHash = String(pkg.approvedBankHash || "").trim() || null;
  const inventoryHash = String(inventory?.approvedBankHash || inventory?.generationStamp?.approvedBankHash || "").trim() || null;
  if (!registryHash || !packageHash || packageHash !== registryHash || inventoryHash !== registryHash) {
    return fail("Current bank hash does not match the approved-bank registry");
  }

  if (!inventory?.runId || !inventory.generationStamp) {
    return fail("Current-run provenance is not valid: current-run inventory is missing");
  }
  const sourceCheck = verifyContentPackageReviewSources(slug, serviceId);
  if (!sourceCheck.ok) {
    return fail(`Current-run provenance is not valid: ${sourceCheck.errors[0] || "review sources failed"}`);
  }
  if (inventory.runId !== inventory.generationStamp.runId) {
    return fail("Current-run provenance is not valid: inventory runId does not match generation stamp");
  }
  if (
    inventory.generationStamp.tenantSlug !== slug ||
    inventory.generationStamp.campaignId !== serviceId ||
    inventory.generationStamp.sourceContext !== "customer-imported-profile"
  ) {
    return fail("Current-run provenance is not valid: generation stamp is incomplete");
  }
  const serviceRaw = fs.readFileSync(servicePagePath, "utf8");
  if (!fileHasRequiredGenerationStamp(serviceRaw, slug, serviceId)) {
    return fail("Current-run provenance is not valid: service page is missing generation stamp");
  }
  for (const file of existingLocalities) {
    if (isHistoricalOutputPath(file)) {
      return fail("Current-run provenance is not valid: historical locality output is not current-run");
    }
    const raw = fs.readFileSync(file, "utf8");
    if (!fileMatchesCurrentRunStamp(raw, inventory.generationStamp)) {
      return fail(`Current-run provenance is not valid: locality page missing matching generation stamp (${areaSlugFromLocalityPath(file)})`);
    }
    if (registryHash && !raw.includes(registryHash)) {
      return fail(`Current-run provenance is not valid: locality page bank hash mismatch (${areaSlugFromLocalityPath(file)})`);
    }
  }

  const images = pkg.assets.find((a) => a.type === "images");
  const imagePath = images?.outputPath || null;
  if (!images?.included || images.count <= 0 || !imagePath || !fs.existsSync(imagePath)) {
    return fail("Current-run image inventory is missing");
  }

  return {
    ...base,
    ok: true,
    unmetCondition: null,
    alreadyLocked: false,
    registryHash,
    lockedBankHash: registryHash,
    servicePagePath,
    localityPagePaths: existingLocalities,
    imageInventoryPath: imagePath,
  };
}

function buildApprovalRecord(
  evaluation: DashboardCampaignApprovalEvaluation,
  approvedAt: string,
  pkg: ContentPackageManifest,
): Record<string, unknown> {
  const localities = evaluation.localityPagePaths.map((file) => {
    const areaSlug = areaSlugFromLocalityPath(file);
    return {
      areaSlug,
      areaName: areaNameFromSlug(areaSlug),
      path: file,
      sha256: sha256File(file),
      decision: "approved",
    };
  });
  const servicePage = {
    path: evaluation.servicePagePath,
    sha256: evaluation.servicePagePath ? sha256File(evaluation.servicePagePath) : null,
    decision: "approved",
  };
  return {
    version: 1,
    task: DASHBOARD_CAMPAIGN_APPROVAL_TASK,
    slug: evaluation.tenantSlug,
    campaignId: evaluation.campaignId,
    serviceId: evaluation.campaignId,
    serviceName: evaluation.serviceName,
    status: "approved-locked",
    approvedAt,
    approvedBy: "product-owner",
    operator: "product-owner",
    productOwnerApproval: {
      reviewCentreGroups: "PASS",
      servicePage: "PASS",
      eightLocalities: "PASS",
      bankHash: "PASS",
      currentRunProvenance: "PASS",
    },
    lockedBankHash: evaluation.lockedBankHash,
    bankRegistryReference: {
      registryPath: path.join(WORKSPACE_ROOT, "data/pharmacy-approved-service-banks/registry.json"),
      approvedBankHash: evaluation.registryHash,
    },
    lockedLocalityInventory: localities,
    lockedCorePageInventory: {
      servicePage,
      localities,
    },
    lockedPageCount: 1 + localities.length,
    packagePath: evaluation.packagePath,
    currentRunInventory: pkg.currentRunInventory || null,
    published: false,
    indexed: false,
  };
}

export function commitDashboardCampaignApproval(
  evaluation: DashboardCampaignApprovalEvaluation,
  writer: DashboardCampaignApprovalWriter = liveDashboardCampaignApprovalWriter(),
): DashboardCampaignApprovalResult {
  const redirectFail = evaluation.reviewCentreRedirect;
  const fail = (unmetCondition: string): DashboardCampaignApprovalResult => ({
    ok: false,
    unmetCondition,
    alreadyLocked: false,
    applied: false,
    status: null,
    message: null,
    redirect: reviewCentreUnmetUrl(evaluation.tenantSlug, evaluation.campaignId, unmetCondition),
    tenantSlug: evaluation.tenantSlug,
    campaignId: evaluation.campaignId,
    published: false,
    indexed: false,
  });

  if (!evaluation.ok || evaluation.unmetCondition) {
    return fail(evaluation.unmetCondition || "Approval prerequisites were not met");
  }

  const success = (applied: boolean, alreadyLocked: boolean): DashboardCampaignApprovalResult => ({
    ok: true,
    unmetCondition: null,
    alreadyLocked,
    applied,
    status: "approved-locked",
    message: `${evaluation.serviceName} is now approved-locked.`,
    redirect: evaluation.dashboardRedirect,
    tenantSlug: evaluation.tenantSlug,
    campaignId: evaluation.campaignId,
    published: false,
    indexed: false,
  });

  if (evaluation.alreadyLocked) {
    return success(false, true);
  }

  const pkg = loadContentPackage(evaluation.tenantSlug, evaluation.campaignId);
  if (!pkg) return fail("Campaign package is missing");

  const approvedAt = new Date().toISOString();
  const record = buildApprovalRecord(evaluation, approvedAt, pkg);
  const locked: ContentPackageManifest = {
    ...pkg,
    status: "approved-locked",
    approvalStatus: "approved-locked",
    reviewedAt: pkg.reviewedAt || approvedAt,
    approvedAt,
    approvedBy: "product-owner",
    approvedBankHash: evaluation.lockedBankHash,
    campaignLock: {
      task: DASHBOARD_CAMPAIGN_APPROVAL_TASK,
      lockedAt: approvedAt,
      lockedBankHash: evaluation.lockedBankHash || undefined,
      lockedLocalityInventory: evaluation.localityPagePaths.map(areaSlugFromLocalityPath),
      lockedPageCount: 1 + evaluation.localityPagePaths.length,
      approvalRecordPath: evaluation.approvalRecordPath,
    },
  };

  writer.writeApprovalRecord(evaluation.approvalRecordPath, record);
  writer.writePackage(locked);
  return success(true, false);
}

export function runDashboardCampaignApproval(
  input: DashboardCampaignApprovalRequest,
  options: { apply?: boolean; writer?: DashboardCampaignApprovalWriter } = {},
): DashboardCampaignApprovalResult {
  const evaluation = evaluateDashboardCampaignApproval(input.tenantSlug, input.campaignId);
  if (!evaluation.ok) {
    return {
      ok: false,
      unmetCondition: evaluation.unmetCondition,
      alreadyLocked: false,
      applied: false,
      status: null,
      message: null,
      redirect: evaluation.reviewCentreRedirect,
      tenantSlug: evaluation.tenantSlug,
      campaignId: evaluation.campaignId,
      published: false,
      indexed: false,
    };
  }
  if (options.apply === false) {
    return {
      ok: true,
      unmetCondition: null,
      alreadyLocked: evaluation.alreadyLocked,
      applied: false,
      status: "approved-locked",
      message: `${evaluation.serviceName} is now approved-locked.`,
      redirect: evaluation.dashboardRedirect,
      tenantSlug: evaluation.tenantSlug,
      campaignId: evaluation.campaignId,
      published: false,
      indexed: false,
    };
  }
  return commitDashboardCampaignApproval(evaluation, options.writer || liveDashboardCampaignApprovalWriter());
}

export function dashboardCampaignApproveApiPath(slug: string): string {
  return campaignApproveApiPath(slug);
}
