/**
 * Generate Next Campaign — tenant-enabled registered-service queue authority.
 * Existing generated/current campaigns are consumed. approved-locked is not the sole gate.
 * Does not write tenant records.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";

export const GENERATE_NEXT_NO_CAMPAIGN_AVAILABLE =
  "No next approved registered-service campaign is available";

export const GENERATE_NEXT_OVERWRITE_REFUSED =
  "Refusing to overwrite an existing campaign for this service. Use the regeneration workflow.";

export const GENERATE_NEXT_QUEUE_SELECTION_RULE =
  "first tenant-enabled registered-bank service in locked commercial catalogue order that does not already have a generated or current campaign";

export interface TenantGenerateNextQueueInput {
  enabledServiceIds: string[];
  registeredQueue: string[];
  existingCampaignServiceIds: string[];
}

export interface TenantGenerateNextQueueResult {
  enabledQueue: string[];
  nextServiceId: string | null;
  exhausted: boolean;
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

/** Catalogue order, restricted to services the tenant explicitly enabled. */
export function resolveTenantGenerateNextQueue(input: TenantGenerateNextQueueInput): TenantGenerateNextQueueResult {
  const enabled = new Set(uniqueServiceIds(input.enabledServiceIds));
  const registeredQueue = uniqueServiceIds(input.registeredQueue);
  const existing = new Set(uniqueServiceIds(input.existingCampaignServiceIds));
  const enabledQueue = registeredQueue.filter((id) => enabled.has(id));
  const nextServiceId = enabledQueue.find((id) => !existing.has(id)) || null;
  return {
    enabledQueue,
    nextServiceId,
    exhausted: !nextServiceId,
  };
}

export function readTenantEnabledServiceIds(slug: string): string[] {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-profiles", `${slug}.json`);
  if (!fs.existsSync(file)) return [];
  try {
    const doc = JSON.parse(fs.readFileSync(file, "utf8")) as { data?: { selectedServices?: unknown } };
    const selected = doc.data?.selectedServices;
    return uniqueServiceIds(Array.isArray(selected) ? selected : []);
  } catch {
    return [];
  }
}

function packageHasGeneratedCampaign(slug: string, serviceId: string): boolean {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-content-packages", slug, `${serviceId}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const pkg = JSON.parse(fs.readFileSync(file, "utf8")) as {
      generatedAt?: string | null;
      status?: string;
    };
    const status = String(pkg.status || "");
    if (status === "missing" || status === "error") return false;
    return Boolean(pkg.generatedAt) || status === "generated" || status === "approved" || status === "approved-locked";
  } catch {
    return false;
  }
}

function approvalRecordExists(slug: string, serviceId: string): boolean {
  const file = path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/campaign-approvals",
    slug,
    `${serviceId}.json`,
  );
  if (!fs.existsSync(file)) return false;
  try {
    const rec = JSON.parse(fs.readFileSync(file, "utf8")) as { status?: string };
    return Boolean(String(rec.status || "").trim());
  } catch {
    return false;
  }
}

function hasVisualServicePage(slug: string, serviceId: string): boolean {
  return fs.existsSync(
    path.join(WORKSPACE_ROOT, "output/pharmacy-visual-experience", slug, serviceId, "index.html"),
  );
}

function hasGeneratedLocalityPages(slug: string, serviceId: string): boolean {
  const dir = path.join(WORKSPACE_ROOT, "output/pharmacy-content-ecosystem", slug, serviceId, "local");
  if (!fs.existsSync(dir)) return false;
  try {
    return fs
      .readdirSync(dir)
      .filter((name) => name !== "locations" && name !== "revisions")
      .some((name) => fs.existsSync(path.join(dir, name, "index.html")));
  } catch {
    return false;
  }
}

function campaignStoreHasService(slug: string, serviceId: string): boolean {
  const file = path.join(WORKSPACE_ROOT, "data/pharmacy-campaigns", `${slug}.json`);
  if (!fs.existsSync(file)) return false;
  try {
    const store = JSON.parse(fs.readFileSync(file, "utf8")) as {
      campaigns?: Array<{ serviceId?: string; status?: string }>;
    };
    return (store.campaigns || []).some(
      (campaign) =>
        normalizeServiceId(campaign.serviceId) === serviceId && String(campaign.status || "") !== "archived",
    );
  } catch {
    return false;
  }
}

/** Generated, current, or locked presence — not approved-locked alone. */
export function tenantHasExistingCampaign(slug: string, serviceId: string): boolean {
  const id = normalizeServiceId(serviceId);
  if (!id) return false;
  return (
    packageHasGeneratedCampaign(slug, id) ||
    hasVisualServicePage(slug, id) ||
    hasGeneratedLocalityPages(slug, id) ||
    campaignStoreHasService(slug, id) ||
    approvalRecordExists(slug, id)
  );
}

export function listTenantExistingCampaignServiceIds(slug: string, candidateIds: string[]): string[] {
  return uniqueServiceIds(candidateIds).filter((id) => tenantHasExistingCampaign(slug, id));
}

export function refuseGenerateNextOverwriteIfCampaignExists(
  slug: string,
  serviceId: string,
): { ok: true } | { ok: false; error: string } {
  if (!tenantHasExistingCampaign(slug, serviceId)) return { ok: true };
  return { ok: false, error: GENERATE_NEXT_OVERWRITE_REFUSED };
}
