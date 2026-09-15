/**
 * CPR-02A — Future cluster-link plan (persisted, not rendered until destination exists).
 */
import fs from "node:fs";
import path from "node:path";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import { getServicePublishMeta } from "./pharmacyMasterPublishConfig.ts";
import { resolveConfirmedProfileAreas } from "./masterAdminCanonicalEcosystemGenerationPlanService.ts";
import { resolveClusterPageSlug, resolveClusterPageUrlPath } from "./pharmacyClusterPageUrlResolver.ts";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import type { ServicePageFutureLinkEntry, ServicePageFutureLinkPlan } from "./masterAdminCoreProductRecoveryModel.ts";

const PLAN_DIR = path.join(WORKSPACE_ROOT, "data/pharmacy-master-admin/service-page-future-links");

function planPath(slug: string): string {
  return path.join(PLAN_DIR, slug, "plan.json");
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

function slugifyArea(areaName: string): string {
  return resolveClusterPageSlug(areaName);
}

function composeFutureClusterLinkPlan(slug: string, serviceId: string): ServicePageFutureLinkPlan {
  const profile = readSetupProfile(slug);
  const meta = getServicePublishMeta(serviceId);
  const serviceName = meta?.serviceName || serviceId;
  const serviceHubUrl = meta?.urlPath || `/${serviceId}/`;
  const website = (profile.website || "").replace(/\/+$/, "");
  const parentCanonical = website ? `${website}${serviceHubUrl}` : serviceHubUrl;

  const confirmedAreas = resolveConfirmedProfileAreas(profile).filter(
    (a) => a.selected !== false && (a as { generationEligible?: boolean }).generationEligible !== false,
  );

  const seenAreas = new Set<string>();
  const seenUrls = new Set<string>();
  const entries: ServicePageFutureLinkEntry[] = [];

  for (const area of confirmedAreas) {
    const areaId = slugifyArea(area.areaName);
    if (seenAreas.has(areaId)) continue;
    seenAreas.add(areaId);
    const areaSlug = areaId;
    const urlPath = resolveClusterPageUrlPath(area.areaName);
    const futureCanonicalUrl = website ? `${website}${urlPath}` : urlPath;
    if (seenUrls.has(futureCanonicalUrl)) continue;
    seenUrls.add(futureCanonicalUrl);
    entries.push({
      areaId,
      areaName: area.areaName,
      areaSlug,
      serviceId,
      futurePageTitle: `${serviceName} in ${area.areaName}`,
      futureCanonicalUrl,
      plannedAnchorText: `${serviceName} in ${area.areaName}`,
      parentServicePage: parentCanonical,
      status: "pending_generation",
    });
  }

  return {
    serviceHubUrl,
    entries,
    note: "Future cluster links are planned only — they will not render on the service page until the destination page exists.",
    persistedAt: new Date().toISOString(),
  };
}

function readFutureClusterLinkPlanRecord(
  slug: string,
): { serviceId: string | null; plan: ServicePageFutureLinkPlan } | null {
  const file = planPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as {
      serviceId?: string;
      plan?: ServicePageFutureLinkPlan;
    };
    if (!raw.plan) return null;
    return { serviceId: raw.serviceId || null, plan: raw.plan };
  } catch {
    return null;
  }
}

export function buildFutureClusterLinkPlan(slug: string, serviceId: string): ServicePageFutureLinkPlan {
  const plan = composeFutureClusterLinkPlan(slug, serviceId);
  writeJsonAtomic(planPath(slug), { slug, serviceId, plan });
  return plan;
}

export function readFutureClusterLinkPlan(slug: string): ServicePageFutureLinkPlan | null {
  return readFutureClusterLinkPlanRecord(slug)?.plan || null;
}

export function validateFutureClusterLinkPlan(slug: string, serviceId: string): {
  passed: boolean;
  errors: string[];
  plan: ServicePageFutureLinkPlan | null;
} {
  const stored = readFutureClusterLinkPlanRecord(slug);
  // Tenant-level plan files are currently single-service. Never treat another
  // service's persisted plan as authoritative for the active campaign service.
  let plan: ServicePageFutureLinkPlan;
  if (!stored) {
    plan = buildFutureClusterLinkPlan(slug, serviceId);
  } else if (
    stored.serviceId === serviceId ||
    stored.plan.entries.every((entry) => entry.serviceId === serviceId)
  ) {
    plan = stored.plan;
  } else {
    plan = composeFutureClusterLinkPlan(slug, serviceId);
  }

  const errors: string[] = [];
  const areaIds = new Set<string>();
  const urls = new Set<string>();

  for (const entry of plan.entries) {
    if (areaIds.has(entry.areaId)) errors.push(`Duplicate area ID: ${entry.areaId}`);
    areaIds.add(entry.areaId);
    if (urls.has(entry.futureCanonicalUrl)) errors.push(`Duplicate future URL: ${entry.futureCanonicalUrl}`);
    urls.add(entry.futureCanonicalUrl);
    if (entry.status !== "pending_generation") errors.push(`Invalid status for ${entry.areaId}: ${entry.status}`);
    if (entry.serviceId !== serviceId) errors.push(`Service ID mismatch for area ${entry.areaId}`);
  }

  return { passed: errors.length === 0, errors, plan };
}
