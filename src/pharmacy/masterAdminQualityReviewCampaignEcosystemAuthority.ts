/**
 * Read-only Quality Review authority for an existing service campaign whose
 * locality pages were already generated. A later service-page-only content
 * package must not replace that campaign. Does not write packages, approvals,
 * or outputs.
 */
import fs from "node:fs";
import path from "node:path";
import { readAuthorisedEcosystemGenerationRecord } from "./masterAdminAuthorisedEcosystemGenerationService.ts";
import {
  isCampaignServicePageReviewApproved,
  readLocalityPageDecisionStore,
  readServicePageGenerationRecord,
} from "./masterAdminCoreProductRecoveryService.ts";
import { readPharmacyCampaignStore, type CampaignAreaEntry } from "./pharmacyCampaignService.ts";
import { loadUkLocalServicePagesCampaignRun } from "./growthEngineLocalPageUkServicePagesCampaignRunService.ts";
import { loadImageAssignments } from "./pharmacyImageOperatingSystem.ts";
import type { ContentPackageManifest } from "./pharmacyContentPackageService.ts";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const SERVICE_PAGE_ONLY_LINK_STAMP = "service-page-only scope — link map not required";

const SERVICE_PAGE_IMAGE_SLOTS = ["hero", "support", "trust", "conversion"] as const;

export interface ExistingCampaignEcosystemAuthority {
  campaignId: string;
  serviceId: string;
  areaSlugs: string[];
  missingOutputAreaSlugs: string[];
  registryAgrees: boolean;
  registryDetail: string;
  servicePageOutputPath: string | null;
  localityOutputPaths: string[];
  resolvedHtmlPaths: string[];
  servicePageApproved: boolean;
  localityApprovedCount: number;
  localityExpectedCount: number;
}

function toAreaSlug(area: CampaignAreaEntry): string {
  const explicit = String(area.areaSlug || area.areaId || "").trim().toLowerCase();
  if (explicit) return explicit;
  return String(area.areaName || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sameSet(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const rightSet = new Set(right);
  return left.every((value) => rightSet.has(value));
}

function isServicePageOnlyPackage(manifest: ContentPackageManifest): boolean {
  const extra = manifest as ContentPackageManifest & { generationType?: string };
  const diagnostics = manifest.adminDiagnostics || [];
  const flagged =
    extra.generationType === "service-page" ||
    diagnostics.some((line) => line.includes("scope:service-page-only"));
  if (!flagged) return false;
  const local = (manifest.assets || []).find((asset) => asset.type === "local-area-pages");
  const hasLocalInventory = (manifest.selectedAreas?.length || 0) > 0 || (local?.count || 0) > 0;
  return !hasLocalInventory;
}

function localityOutputPath(slug: string, serviceId: string, areaSlug: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-content-ecosystem",
    slug,
    serviceId,
    "local",
    areaSlug,
    "index.html",
  );
}

function visualOutputPath(slug: string, serviceId: string): string {
  return path.join(
    PHARMACY_WORKSPACE_ROOT,
    "output/pharmacy-visual-experience",
    slug,
    serviceId,
    "index.html",
  );
}

function workspaceFileExists(srcOrPath: string): boolean {
  const rel = srcOrPath.replace(/^\//, "").split("?")[0].split("#")[0];
  if (!rel || rel.includes("..")) return false;
  return fs.existsSync(path.join(PHARMACY_WORKSPACE_ROOT, rel));
}

/**
 * Returns the existing campaign ecosystem when a service-page-only package
 * would otherwise hide it. Completed authorised ecosystem generation stays
 * the review authority, and HTML that is not in both campaign records is ignored.
 */
export function resolveExistingCampaignEcosystemAuthority(
  slug: string,
  serviceId: string,
  manifest: ContentPackageManifest | null,
): ExistingCampaignEcosystemAuthority | null {
  if (!manifest?.generatedAt) return null;
  const authorised = readAuthorisedEcosystemGenerationRecord(slug);
  if (authorised?.status === "completed") return null;
  if (!isServicePageOnlyPackage(manifest)) return null;

  const extra = manifest as ContentPackageManifest & { campaignId?: string; serviceCampaignId?: string };
  const packageCampaignId = String(extra.campaignId || extra.serviceCampaignId || "").trim();
  const matches = (readPharmacyCampaignStore(slug)?.campaigns || []).filter((campaign) => campaign.serviceId === serviceId);
  const campaign = packageCampaignId
    ? matches.find((row) => row.id === packageCampaignId) || null
    : matches.find((row) => row.status === "active") || null;
  if (!campaign) return null;

  const run = loadUkLocalServicePagesCampaignRun(slug, serviceId);
  if (!run) return null;

  const selected = [
    ...new Set(
      (campaign.campaignAreas || [])
        .filter((area) => area.selected !== false)
        .map((area) => toAreaSlug(area))
        .filter(Boolean),
    ),
  ].sort();
  const completed = [
    ...new Set(
      (run.areas || [])
        .filter((area) => area.status === "completed" && area.areaSlug)
        .map((area) => String(area.areaSlug).trim().toLowerCase())
        .filter(Boolean),
    ),
  ].sort();
  const recorded = selected.filter((area) => completed.includes(area));
  const withOutput = recorded.filter((area) => fs.existsSync(localityOutputPath(slug, serviceId, area)));
  const missingOutputAreaSlugs = recorded.filter((area) => !withOutput.includes(area));
  if (!withOutput.length) return null;

  const registryAgrees = sameSet(selected, completed) && missingOutputAreaSlugs.length === 0;
  const registryDetail = registryAgrees
    ? `Campaign areas, completed locality run, and existing outputs agree (${withOutput.length})`
    : `Locality registry mismatch: selected ${selected.length}, completed ${completed.length}, outputs ${withOutput.length}, missing outputs ${missingOutputAreaSlugs.join(", ") || "none"}`;

  const servicePageOutputPath = fs.existsSync(visualOutputPath(slug, serviceId)) ? visualOutputPath(slug, serviceId) : null;
  const localityOutputPaths = withOutput.map((area) => localityOutputPath(slug, serviceId, area));
  const resolvedHtmlPaths = [...(servicePageOutputPath ? [servicePageOutputPath] : []), ...localityOutputPaths];
  const generationRevision = readServicePageGenerationRecord(slug, serviceId, campaign.id)?.imageAssignmentRevision || null;
  const localityStore = readLocalityPageDecisionStore(slug, { campaignId: campaign.id, serviceId });
  const localityApprovedCount = selected.filter((area) => localityStore?.decisions?.[area]?.decision === "approved").length;

  return {
    campaignId: campaign.id,
    serviceId,
    areaSlugs: withOutput,
    missingOutputAreaSlugs,
    registryAgrees,
    registryDetail,
    servicePageOutputPath,
    localityOutputPaths,
    resolvedHtmlPaths,
    servicePageApproved: isCampaignServicePageReviewApproved(slug, campaign.id, serviceId, generationRevision),
    localityApprovedCount,
    localityExpectedCount: selected.length,
  };
}

export function evaluateExistingCampaignEcosystemLinks(authority: ExistingCampaignEcosystemAuthority): {
  ok: boolean;
  detail: string;
  linkedCount: number;
} {
  const servicePath = `/${authority.serviceId}`;
  const missing: string[] = [];
  let linkedCount = 0;
  for (const file of authority.localityOutputPaths) {
    const area = path.basename(path.dirname(file));
    let html = "";
    try {
      html = fs.readFileSync(file, "utf8");
    } catch {
      missing.push(area);
      continue;
    }
    const hrefs = [...html.matchAll(/href=["']([^"']+)["']/gi)].map((match) => match[1]);
    const linked = hrefs.some((href) => {
      const raw = href.split("?")[0].split("#")[0];
      return raw === servicePath || raw === `${servicePath}/` || raw.endsWith(`${servicePath}/index.html`);
    });
    if (linked) linkedCount += 1;
    else missing.push(area);
  }
  if (missing.length) {
    return {
      ok: false,
      detail: `Locality pages missing an internal link to the service page: ${missing.join(", ")}`,
      linkedCount,
    };
  }
  return {
    ok: true,
    detail: `${linkedCount} locality page(s) link to the service page`,
    linkedCount,
  };
}

export function evaluateExistingCampaignEcosystemImages(
  slug: string,
  authority: ExistingCampaignEcosystemAuthority,
): { ok: boolean; failures: string[]; assignedAssignments: number; requiredAssignments: number } {
  const failures: string[] = [];
  const doc = loadImageAssignments(slug);
  const serviceAssignments = SERVICE_PAGE_IMAGE_SLOTS.map((slot) => {
    const key = `${authority.serviceId}:${authority.serviceId}:${slot}`;
    return { slot, assignment: doc.assignments[key] };
  });
  let assigned = 0;
  for (const row of serviceAssignments) {
    const filePath = row.assignment?.filePath || "";
    if (!row.assignment || row.assignment.status === "missing" || !filePath) {
      failures.push(`Missing service page image assignment: ${authority.serviceId}:${row.slot}`);
      continue;
    }
    if (!workspaceFileExists(filePath)) {
      failures.push(`Broken service page image: ${filePath}`);
      continue;
    }
    assigned += 1;
  }

  for (const file of authority.resolvedHtmlPaths) {
    let html = "";
    try {
      html = fs.readFileSync(file, "utf8");
    } catch {
      failures.push(`Unreadable page for image check: ${file}`);
      continue;
    }
    const srcs = [...html.matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((match) => match[1]);
    for (const src of srcs) {
      if (!src || src.startsWith("data:")) {
        failures.push(`Empty image on ${path.basename(path.dirname(file))}`);
        continue;
      }
      if (/^https?:\/\//i.test(src)) continue;
      if (!workspaceFileExists(src)) failures.push(`Missing rendered image ${src}`);
    }
  }

  return {
    ok: failures.length === 0,
    failures,
    assignedAssignments: assigned,
    requiredAssignments: SERVICE_PAGE_IMAGE_SLOTS.length,
  };
}
