/**
 * Campaign Improvements — tenant current/existing campaign service authority.
 * Global catalogue membership cannot establish a tenant campaign.
 * Does not write tenant records.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  listTenantExistingCampaignServiceIds,
  readTenantEnabledServiceIds,
} from "./pharmacyGenerateNextCampaignAuthority.ts";

export type CampaignImprovementsServiceSource =
  | "requested-valid-campaign"
  | "current-campaign"
  | "single-existing-campaign"
  | "deterministic-existing"
  | "enabled-fallback"
  | "none";

export interface CampaignImprovementsServiceInput {
  enabledServiceIds: string[];
  existingCampaignServiceIds: string[];
  currentCampaignServiceId: string | null;
  requestedServiceId?: string | null;
}

export interface CampaignImprovementsServiceResult {
  requestedServiceId: string | null;
  resolvedServiceId: string | null;
  source: CampaignImprovementsServiceSource;
  enabledServiceIds: string[];
  existingCampaignServiceIds: string[];
  authoritativeServiceIds: string[];
  rejectedRequested: boolean;
}

function normalizeServiceId(value: unknown): string {
  return String(value || "").trim();
}

function uniqueServiceIds(values: unknown[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const id = normalizeServiceId(value);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

function pickDeterministicCurrent(
  enabledServiceIds: string[],
  existingCampaignServiceIds: string[],
  currentCampaignServiceId: string | null,
): { serviceId: string | null; source: CampaignImprovementsServiceSource } {
  const enabled = uniqueServiceIds(enabledServiceIds);
  const enabledSet = new Set(enabled);
  const existingSet = new Set(uniqueServiceIds(existingCampaignServiceIds));
  const pointer = normalizeServiceId(currentCampaignServiceId);
  const authoritative = uniqueServiceIds([
    ...enabled.filter((id) => existingSet.has(id)),
    ...(pointer && enabledSet.has(pointer) ? [pointer] : []),
  ]);
  const authoritativeSet = new Set(authoritative);

  if (pointer && authoritativeSet.has(pointer)) {
    return { serviceId: pointer, source: "current-campaign" };
  }
  const enabledExisting = enabled.filter((id) => existingSet.has(id));
  if (enabledExisting.length === 1) {
    return { serviceId: enabledExisting[0]!, source: "single-existing-campaign" };
  }
  if (enabledExisting.length > 1) {
    return { serviceId: enabledExisting[0]!, source: "deterministic-existing" };
  }
  if (enabled.length >= 1) {
    return { serviceId: enabled[0]!, source: "enabled-fallback" };
  }
  return { serviceId: null, source: "none" };
}

/**
 * Authoritative Campaign Improvements service:
 * tenant-enabled ∩ (existing campaigns ∪ current campaign pointer).
 * A requested service is honoured only when it is already in that set.
 */
export function resolveCampaignImprovementsService(
  input: CampaignImprovementsServiceInput,
): CampaignImprovementsServiceResult {
  const enabledServiceIds = uniqueServiceIds(input.enabledServiceIds);
  const enabledSet = new Set(enabledServiceIds);
  const existingCampaignServiceIds = uniqueServiceIds(input.existingCampaignServiceIds);
  const existingSet = new Set(existingCampaignServiceIds);
  const currentCampaignServiceId = normalizeServiceId(input.currentCampaignServiceId) || null;
  const requestedServiceId = normalizeServiceId(input.requestedServiceId) || null;

  const authoritativeServiceIds = uniqueServiceIds([
    ...enabledServiceIds.filter((id) => existingSet.has(id)),
    ...(currentCampaignServiceId && enabledSet.has(currentCampaignServiceId) ? [currentCampaignServiceId] : []),
  ]);
  const authoritativeSet = new Set(authoritativeServiceIds);

  const current = pickDeterministicCurrent(
    enabledServiceIds,
    existingCampaignServiceIds,
    currentCampaignServiceId,
  );

  if (requestedServiceId && authoritativeSet.has(requestedServiceId)) {
    return {
      requestedServiceId,
      resolvedServiceId: requestedServiceId,
      source: "requested-valid-campaign",
      enabledServiceIds,
      existingCampaignServiceIds,
      authoritativeServiceIds,
      rejectedRequested: false,
    };
  }

  return {
    requestedServiceId,
    resolvedServiceId: current.serviceId,
    source: current.source,
    enabledServiceIds,
    existingCampaignServiceIds,
    authoritativeServiceIds,
    rejectedRequested: Boolean(requestedServiceId),
  };
}

function readCampaignStoreServiceIds(slug: string): string[] {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const store = JSON.parse(fs.readFileSync(file, "utf8")) as {
      campaigns?: Array<{ serviceId?: string; status?: string }>;
    };
    return uniqueServiceIds(
      (store.campaigns || [])
        .filter((campaign) => String(campaign.status || "") !== "archived")
        .map((campaign) => campaign.serviceId),
    );
  } catch {
    return [];
  }
}

export function readTenantCurrentCampaignServiceId(slug: string): string | null {
  const pointerFile = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/active-service-campaign",
    `${slug}.json`,
  );
  if (fs.existsSync(pointerFile)) {
    try {
      const pointer = JSON.parse(fs.readFileSync(pointerFile, "utf8")) as { serviceId?: string };
      const id = normalizeServiceId(pointer.serviceId);
      if (id) return id;
    } catch {
      /* fall through to campaign store */
    }
  }
  const storeIds = readCampaignStoreServiceIds(slug);
  return storeIds[0] || null;
}

export function resolveCampaignImprovementsServiceForTenant(
  slug: string,
  requestedServiceId?: string | null,
): CampaignImprovementsServiceResult {
  const enabledServiceIds = readTenantEnabledServiceIds(slug);
  const storeIds = readCampaignStoreServiceIds(slug);
  const existingCampaignServiceIds = listTenantExistingCampaignServiceIds(
    slug,
    uniqueServiceIds([...enabledServiceIds, ...storeIds]),
  );
  return resolveCampaignImprovementsService({
    enabledServiceIds,
    existingCampaignServiceIds,
    currentCampaignServiceId: readTenantCurrentCampaignServiceId(slug),
    requestedServiceId,
  });
}

export function buildCampaignImprovementsLocation(
  slug: string,
  serviceId: string,
  query?: Record<string, unknown>,
): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (key === "service" || key === "slug") continue;
    if (value == null || typeof value === "object") continue;
    params.set(key, String(value));
  }
  params.set("slug", slug);
  params.set("service", serviceId);
  return `/api/pharmacy-enhancement-workspace?${params.toString()}`;
}

export function campaignImprovementsNeedsCanonicalRedirect(
  requestedServiceId: string | null,
  resolvedServiceId: string | null,
): boolean {
  if (!resolvedServiceId) return false;
  return normalizeServiceId(requestedServiceId) !== resolvedServiceId;
}
