/**
 * Authoritative campaign programme — read-only view over existing records.
 * Sources: content packages, approved-bank registry, campaign approvals, generated core-page inventory.
 * Does not create a second campaign-state store.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import { loadContentPackage } from "./pharmacyContentPackageService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { reviewCentreUrl } from "./growthEngineReviewCentreService.ts";
import { campaignApproveApiPath } from "./growthEngineCampaignApproveControl.ts";
import {
  GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE,
  GENERATE_NEXT_QUEUE_SELECTION_RULE,
  listTenantExistingCampaignServiceIds,
  readTenantEnabledServiceIds,
  resolveTenantGenerateNextQueue,
} from "./pharmacyGenerateNextCampaignAuthority.ts";

function loadRegistry(): { services?: Record<string, { approvedBankHash?: string; serviceId?: string }> } | null {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-approved-service-banks/registry.json");
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as {
      services?: Record<string, { approvedBankHash?: string; serviceId?: string }>;
    };
  } catch {
    return null;
  }
}

export interface AuthoritativeCampaignCard {
  serviceId: string;
  serviceName: string;
  status: string;
  statusLabel: string;
  approvalStatus: string;
  approvedLocked: boolean;
  pendingProductOwnerReview: boolean;
  approvedBankHash: string | null;
  servicePageCount: number;
  localityPageCount: number;
  corePageCount: number;
  reviewUrl: string;
  viewUrl: string;
  approveUrl: string;
  approveApiPath: string;
  controls: Array<{ label: string; href?: string; action?: "approve" }>;
}

export interface AuthoritativeNextCampaign {
  serviceId: string;
  serviceName: string;
  statusLabel: string;
  approvedBankHash: string | null;
  reason: string;
  selectionRule: string;
}

export interface AuthoritativeCampaignProgramme {
  slug: string;
  campaigns: AuthoritativeCampaignCard[];
  nextCampaign: AuthoritativeNextCampaign | null;
  hasGeneratedCampaigns: boolean;
  hasCampaignRecords: boolean;
  generateNextIntent: string;
  generateNextApiPath: string;
  enabledQueue: string[];
  exhausted: boolean;
  exhaustedMessage: string | null;
}

interface PackageLockFields {
  status?: string;
  approvalStatus?: string;
  generatedAt?: string | null;
  selectedAreas?: string[];
  campaignLock?: {
    lockedBankHash?: string;
    lockedPageCount?: number;
    lockedLocalityInventory?: string[];
  };
  assets?: Array<{ type?: string; included?: boolean; count?: number }>;
}

function packageDir(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug);
}

function approvalRecordPath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/campaign-approvals", slug, `${serviceId}.json`);
}

function visualPagePath(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html");
}

function localityRoot(slug: string, serviceId: string): string {
  return path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "local");
}

function serviceLabel(serviceId: string): string {
  return getServicePublishMeta(serviceId)?.serviceName || serviceId.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function countGeneratedLocalityPages(slug: string, serviceId: string): number {
  const dir = localityRoot(slug, serviceId);
  if (!fs.existsSync(dir)) return 0;
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name !== "locations" && name !== "revisions")
      .filter((name) => fs.existsSync(path.join(dir, name, "index.html"))).length;
  } catch {
    return 0;
  }
}

export function hasGeneratedServicePage(slug: string, serviceId: string): boolean {
  return fs.existsSync(visualPagePath(slug, serviceId));
}

function readApprovalRecord(slug: string, serviceId: string): { status?: string; lockedBankHash?: string } | null {
  const file = approvalRecordPath(slug, serviceId);
  if (!fs.existsSync(file)) return null;
  try {
    return JSON.parse(fs.readFileSync(file, "utf8")) as { status?: string; lockedBankHash?: string };
  } catch {
    return null;
  }
}

function listPackageServiceIds(slug: string): string[] {
  const dir = packageDir(slug);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .filter((name) => name.endsWith(".json"))
    .map((name) => name.replace(/\.json$/, ""));
}

/** Registered approved-bank services in locked commercial catalogue order. */
export function listApprovedRegisteredCampaignQueue(): string[] {
  const registry = loadRegistry();
  const registered = Object.keys(registry?.services || {});
  const catalogueFile = path.join(WORKSPACE_ROOT, "config/pharmacy/locked-commercial-service-catalogue.json");
  let catalogOrder: string[] = [];
  if (fs.existsSync(catalogueFile)) {
    try {
      const catalogue = JSON.parse(fs.readFileSync(catalogueFile, "utf8")) as {
        services?: Array<{ serviceId?: string }>;
      };
      catalogOrder = (catalogue.services || [])
        .map((s) => String(s.serviceId || "").trim())
        .filter((id) => registered.includes(id));
    } catch {
      catalogOrder = [];
    }
  }
  return [...catalogOrder, ...registered.filter((id) => !catalogOrder.includes(id))];
}

function isApprovedLocked(pkg: PackageLockFields | null, approval: { status?: string } | null): boolean {
  const status = String(pkg?.status || "");
  const approvalStatus = String(pkg?.approvalStatus || "");
  const recordStatus = String(approval?.status || "");
  return (
    status === "approved-locked" ||
    approvalStatus === "approved-locked" ||
    recordStatus === "approved-locked"
  );
}

function bankHashFor(serviceId: string, pkg: PackageLockFields | null, approval: { lockedBankHash?: string } | null): string | null {
  const locked = pkg?.campaignLock?.lockedBankHash || approval?.lockedBankHash;
  if (locked) return locked;
  const registry = loadRegistry();
  return registry?.services?.[serviceId]?.approvedBankHash || null;
}

function campaignControls(card: {
  approvedLocked: boolean;
  pendingProductOwnerReview: boolean;
  reviewUrl: string;
  viewUrl: string;
}): Array<{ label: string; href?: string; action?: "approve" }> {
  if (card.approvedLocked) {
    return [
      { label: "Review", href: card.reviewUrl },
      { label: "View", href: card.viewUrl },
    ];
  }
  if (card.pendingProductOwnerReview) {
    return [
      { label: "Review", href: card.reviewUrl },
      { label: "Approve", action: "approve" },
    ];
  }
  return [
    { label: "Review", href: card.reviewUrl },
    { label: "View", href: card.viewUrl },
  ];
}

export function buildAuthoritativeCampaignCard(slug: string, serviceId: string): AuthoritativeCampaignCard | null {
  const pkg = loadContentPackage(slug, serviceId) as PackageLockFields | null;
  const approval = readApprovalRecord(slug, serviceId);
  const locked = isApprovedLocked(pkg, approval);
  const localityPageCount = countGeneratedLocalityPages(slug, serviceId);
  const serviceExists = hasGeneratedServicePage(slug, serviceId);
  const generated = Boolean(pkg?.generatedAt) || serviceExists || localityPageCount > 0;
  if (!generated && !locked) return null;

  const pendingProductOwnerReview = generated && !locked && String(pkg?.approvalStatus || "pending") !== "approved";
  const status = locked ? "approved-locked" : pendingProductOwnerReview ? "pending-product-owner-review" : String(pkg?.status || "generated");
  const statusLabel = locked
    ? "approved-locked"
    : pendingProductOwnerReview
      ? "pending Product Owner review"
      : String(pkg?.status || "generated");
  const reviewUrl = reviewCentreUrl(slug, serviceId);
  const viewUrl = `/api/pharmacy-visual-experience/${encodeURIComponent(serviceId)}/?slug=${encodeURIComponent(slug)}`;
  const approveApiPath = campaignApproveApiPath(slug);
  const card = {
    approvedLocked: locked,
    pendingProductOwnerReview,
    reviewUrl,
    viewUrl,
  };

  return {
    serviceId,
    serviceName: serviceLabel(serviceId),
    status,
    statusLabel,
    approvalStatus: String(pkg?.approvalStatus || approval?.status || (locked ? "approved-locked" : "pending")),
    approvedLocked: locked,
    pendingProductOwnerReview,
    approvedBankHash: bankHashFor(serviceId, pkg, approval),
    servicePageCount: serviceExists || Boolean(pkg?.assets?.some((a) => a.type === "service-page" && a.included)) ? 1 : 0,
    localityPageCount,
    corePageCount: (serviceExists ? 1 : 0) + localityPageCount,
    reviewUrl,
    viewUrl,
    approveUrl: approveApiPath,
    approveApiPath,
    controls: campaignControls(card),
  };
}

/**
 * First tenant-enabled registered-bank service, in locked commercial catalogue order,
 * that does not already have a generated or current campaign.
 */
export function listTenantEnabledRegisteredCampaignQueue(slug: string): string[] {
  return resolveTenantGenerateNextQueue({
    enabledServiceIds: readTenantEnabledServiceIds(slug),
    registeredQueue: listApprovedRegisteredCampaignQueue(),
    existingCampaignServiceIds: [],
  }).enabledQueue;
}

export function selectNextApprovedRegisteredCampaign(slug: string): AuthoritativeNextCampaign | null {
  const registeredQueue = listApprovedRegisteredCampaignQueue();
  const enabledServiceIds = readTenantEnabledServiceIds(slug);
  const existingCampaignServiceIds = listTenantExistingCampaignServiceIds(slug, registeredQueue);
  const resolved = resolveTenantGenerateNextQueue({
    enabledServiceIds,
    registeredQueue,
    existingCampaignServiceIds,
  });
  if (!resolved.nextServiceId) return null;
  const serviceId = resolved.nextServiceId;
  const registry = loadRegistry();
  return {
    serviceId,
    serviceName: serviceLabel(serviceId),
    statusLabel: "next approved registered-service campaign",
    approvedBankHash: registry?.services?.[serviceId]?.approvedBankHash || null,
    reason: "Next campaign from the tenant-enabled registered-service campaign queue.",
    selectionRule: GENERATE_NEXT_QUEUE_SELECTION_RULE,
  };
}

export function buildAuthoritativeCampaignProgramme(slug: string): AuthoritativeCampaignProgramme {
  const queue = listApprovedRegisteredCampaignQueue();
  const fromPackages = listPackageServiceIds(slug);
  const ids = [...new Set([...queue, ...fromPackages])];
  const preferred = ["flu-vaccinations", "travel-vaccinations"];
  const ordered = [
    ...preferred.filter((id) => ids.includes(id)),
    ...ids.filter((id) => !preferred.includes(id)),
  ];

  const campaigns = ordered
    .map((id) => buildAuthoritativeCampaignCard(slug, id))
    .filter((card): card is AuthoritativeCampaignCard => Boolean(card));

  const hasGeneratedCampaigns = campaigns.some((c) => c.corePageCount > 0 || c.status !== "missing");
  const nextCampaign = selectNextApprovedRegisteredCampaign(slug);
  const enabledQueue = listTenantEnabledRegisteredCampaignQueue(slug);
  const exhausted = !nextCampaign;

  return {
    slug,
    campaigns,
    nextCampaign,
    hasGeneratedCampaigns,
    hasCampaignRecords: campaigns.length > 0,
    generateNextIntent: "generate the next approved registered-service campaign",
    generateNextApiPath: `/api/growth-engine/${encodeURIComponent(slug)}/generate-next-campaign`,
    enabledQueue,
    exhausted,
    exhaustedMessage: exhausted ? GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE : null,
  };
}
