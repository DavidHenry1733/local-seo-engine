/**
 * Master Dashboard active service-campaign selection (per pharmacy).
 * Persists selected Campaign OS campaignId/serviceId for refresh-safe workflow context.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";

export interface MasterAdminActiveCampaignSelection {
  slug: string;
  campaignId: string;
  serviceId: string;
  selectedAt: string;
}

function selectionPath(slug: string): string {
  return path.join(
    WORKSPACE_ROOT,
    "data/pharmacy-master-admin/active-service-campaign",
    `${safeAdminSlug(slug)}.json`,
  );
}

function writeJsonAtomic(filePath: string, data: unknown): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
  fs.renameSync(tmp, filePath);
}

export function readActiveServiceCampaignSelection(slug: string): MasterAdminActiveCampaignSelection | null {
  const file = selectionPath(slug);
  if (!fs.existsSync(file)) return null;
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8")) as MasterAdminActiveCampaignSelection;
    if (!raw?.campaignId || !raw?.serviceId) return null;
    return {
      slug: safeAdminSlug(slug),
      campaignId: String(raw.campaignId),
      serviceId: String(raw.serviceId),
      selectedAt: String(raw.selectedAt || ""),
    };
  } catch {
    return null;
  }
}

export function clearActiveServiceCampaignSelection(slug: string): void {
  const file = selectionPath(slug);
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

export function writeActiveServiceCampaignSelection(
  slug: string,
  campaignId: string,
  serviceId: string,
): MasterAdminActiveCampaignSelection {
  const selection: MasterAdminActiveCampaignSelection = {
    slug: safeAdminSlug(slug),
    campaignId,
    serviceId,
    selectedAt: new Date().toISOString(),
  };
  writeJsonAtomic(selectionPath(slug), selection);
  return selection;
}
