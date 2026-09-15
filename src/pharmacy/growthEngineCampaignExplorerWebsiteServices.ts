/**
 * Campaign Explorer — Website Import customer-visible service list authority.
 * Uses websiteImportSnapshot.customerVisibleServices (strict evidence filter).
 */
import { buildCustomerSetupConfirmView } from "./growthEngineCustomerSetupConfirmService.ts";
import { readSetupProfile } from "./growthEngineCustomerSetupImportSplitService.ts";
import type { CustomerVisibleWebsiteService } from "./growthEngineWebsiteImportCustomerVisibleServices.ts";
import { resolveServiceIdFromName } from "./growthEngineCampaignBuilderFallbackService.ts";
import { collectExistingWebsiteServices } from "./growthEngineCampaignBuilderFallbackService.ts";
import { loadWebsiteIntelligenceSnapshot } from "./growthEngineWebsiteIntelligenceService.ts";
import { WORKSPACE_ROOT } from "./pharmacyCompetitorDiscovery.ts";
import fs from "node:fs";
import path from "node:path";

export const WEBSITE_IMPORT_SERVICE_SOURCE_FIELD = "websiteImportSnapshot.customerVisibleServices";
export const EXPLORER_EXISTING_SERVICES_PRODUCER =
  "growthEngineCampaignExplorerWebsiteServices.ts::collectWebsiteImportCanonicalServices";

export interface WebsiteImportCanonicalService {
  serviceId: string;
  serviceName: string;
  source: "website-import-customerVisibleServices";
}

export interface WebsiteImportServiceCountDebug {
  confirmPageServiceCount: number;
  campaignExplorerServiceCount: number;
  sourceField: string;
  serviceNames: string[];
}

export interface ConfirmPageWebsiteImportServices {
  confirmPageServiceList: string[];
  confirmPageServiceCount: number;
  confirmSourceField: string;
  confirmServicesDetectedRowValue: string;
}

export interface RawWebsiteServiceSourceDump {
  websiteImportSnapshotServicesDetected: string[];
  websiteImportCustomerVisibleServices: CustomerVisibleWebsiteService[];
  websiteImportIntelligenceServicesExists: Array<{ serviceId: string; serviceName: string }>;
  websiteImportIntelligenceServicesAll: number;
  detectedWebsiteServices: Array<{ serviceId: string; serviceName: string }>;
  websiteReportCoverageDetected: Array<{ serviceId: string; serviceName: string }>;
  profileSelectedServices: string[];
  fallbackCollectorMerged: Array<{ serviceId: string; serviceName: string; source: string }>;
  campaignBuilderSessionPath: string;
  campaignBuilderSessionHasServiceList: boolean;
}

function campaignBuilderSessionPath(slug: string): string {
  return path.join(WORKSPACE_ROOT, "data/growth-engine", `${slug}-campaign-builder.json`);
}

function customerVisibleFromSnapshot(slug: string): CustomerVisibleWebsiteService[] {
  return readSetupProfile(slug).websiteImportSnapshot?.customerVisibleServices || [];
}

/** Parse confirm page Website Import section — customerVisibleServices authority. */
export function resolveConfirmPageWebsiteImportServices(slug: string): ConfirmPageWebsiteImportServices {
  const snap = readSetupProfile(slug).websiteImportSnapshot;
  const view = buildCustomerSetupConfirmView(slug);
  const row = view.websiteSection.rows.find((r) => r.label === "Services detected");
  const rowValue = row?.value || "";
  const visible = customerVisibleFromSnapshot(slug);
  const confirmPageServiceList = visible.map((s) => s.serviceName);

  let confirmPageServiceCount = confirmPageServiceList.length;
  if (snap?.intelligence) {
    const parsed = parseInt(rowValue, 10);
    if (!Number.isNaN(parsed)) confirmPageServiceCount = parsed;
  } else if (rowValue) {
    const parsedNames = rowValue
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedNames.length) confirmPageServiceCount = parsedNames.length;
  }

  return {
    confirmPageServiceList,
    confirmPageServiceCount,
    confirmSourceField: WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
    confirmServicesDetectedRowValue: rowValue,
  };
}

function serviceIdForImportName(
  serviceName: string,
  intelByExactName: Map<string, string>,
  visible: CustomerVisibleWebsiteService[],
): string {
  const fromVisible = visible.find((s) => s.serviceName.toLowerCase() === serviceName.toLowerCase())?.serviceId;
  if (fromVisible) return fromVisible;
  const fromIntel = intelByExactName.get(serviceName);
  if (fromIntel) return fromIntel;
  return resolveServiceIdFromName(serviceName) || serviceName.toLowerCase().replace(/\s+/g, "-");
}

/** Exact customer-visible list from Website Import — customerVisibleServices only. */
export function collectWebsiteImportCanonicalServices(slug: string): WebsiteImportCanonicalService[] {
  const snap = readSetupProfile(slug).websiteImportSnapshot;
  const visible = customerVisibleFromSnapshot(slug);
  const items: WebsiteImportCanonicalService[] = [];

  const intelByExactName = new Map<string, string>();
  for (const row of snap?.intelligence?.services || []) {
    if (!row?.serviceName || !row?.serviceId) continue;
    const name = String(row.serviceName).trim();
    if (!intelByExactName.has(name)) intelByExactName.set(name, row.serviceId);
  }

  const seen = new Set<string>();
  for (const row of visible) {
    const serviceName = String(row.serviceName || "").trim();
    if (!serviceName) continue;
    const dedupeKey = serviceName.toLowerCase();
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    items.push({
      serviceId: serviceIdForImportName(serviceName, intelByExactName, visible),
      serviceName,
      source: "website-import-customerVisibleServices",
    });
  }

  return items;
}

export function confirmPageWebsiteImportServiceCount(slug: string): number {
  return resolveConfirmPageWebsiteImportServices(slug).confirmPageServiceCount;
}

export function countWebsiteImportDetectedServices(slug: string): number {
  return collectWebsiteImportCanonicalServices(slug).length;
}

export function countWebsiteImportServicesDetectedRaw(slug: string): number {
  const profile = readSetupProfile(slug);
  return (profile.websiteImportSnapshot?.servicesDetected || []).filter((n) => String(n || "").trim()).length;
}

export function websiteImportCanonicalServiceIds(slug: string): Set<string> {
  return new Set(collectWebsiteImportCanonicalServices(slug).map((s) => s.serviceId));
}

export function websiteImportCanonicalNames(slug: string): Set<string> {
  return new Set(collectWebsiteImportCanonicalServices(slug).map((s) => s.serviceName.toLowerCase()));
}

export function websiteImportCanonicalName(slug: string, serviceId: string): string | null {
  return collectWebsiteImportCanonicalServices(slug).find((s) => s.serviceId === serviceId)?.serviceName || null;
}

export function websiteImportServiceCountDebug(slug: string): WebsiteImportServiceCountDebug {
  const confirm = resolveConfirmPageWebsiteImportServices(slug);
  const services = collectWebsiteImportCanonicalServices(slug);
  return {
    confirmPageServiceCount: confirm.confirmPageServiceCount,
    campaignExplorerServiceCount: services.length,
    sourceField: WEBSITE_IMPORT_SERVICE_SOURCE_FIELD,
    serviceNames: services.map((s) => s.serviceName),
  };
}

export function isWebsiteImportDetectedService(slug: string, serviceId: string, serviceName?: string): boolean {
  const canonical = collectWebsiteImportCanonicalServices(slug);
  if (canonical.some((s) => s.serviceId === serviceId)) return true;
  if (serviceName && canonical.some((s) => s.serviceName.toLowerCase() === serviceName.toLowerCase())) return true;
  return false;
}

export function collectRawWebsiteServiceSources(slug: string): RawWebsiteServiceSourceDump {
  const profile = readSetupProfile(slug);
  const snap = profile.websiteImportSnapshot;
  const intel = snap?.intelligence;
  const report = loadWebsiteIntelligenceSnapshot(slug);
  const sessionPath = campaignBuilderSessionPath(slug);
  let sessionHasServiceList = false;
  if (fs.existsSync(sessionPath)) {
    try {
      const session = JSON.parse(fs.readFileSync(sessionPath, "utf8")) as Record<string, unknown>;
      sessionHasServiceList = Boolean(
        session.existingServices ||
          session.existingOnWebsite ||
          session.websiteServices ||
          session.cachedExistingServices,
      );
    } catch {
      sessionHasServiceList = false;
    }
  }

  return {
    websiteImportSnapshotServicesDetected: (snap?.servicesDetected || []).map(String),
    websiteImportCustomerVisibleServices: snap?.customerVisibleServices || [],
    websiteImportIntelligenceServicesExists: (intel?.services || [])
      .filter((s) => s.exists)
      .map((s) => ({ serviceId: s.serviceId, serviceName: s.serviceName })),
    websiteImportIntelligenceServicesAll: (intel?.services || []).length,
    detectedWebsiteServices: (profile.detectedWebsiteServices || []).map((s) => ({
      serviceId: s.serviceId,
      serviceName: s.serviceName,
    })),
    websiteReportCoverageDetected: (report?.analysis?.coverage || [])
      .filter((c) => c.websiteDetected)
      .map((c) => ({ serviceId: c.serviceId, serviceName: c.serviceName || c.serviceId })),
    profileSelectedServices: [...(profile.selectedServices || [])],
    fallbackCollectorMerged: collectExistingWebsiteServices(slug),
    campaignBuilderSessionPath: sessionPath,
    campaignBuilderSessionHasServiceList: sessionHasServiceList,
  };
}

export function bypassCampaignBuilderExistingServicesCache(slug: string): boolean {
  const file = campaignBuilderSessionPath(slug);
  if (!fs.existsSync(file)) return false;
  try {
    const session = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
    const next = { ...session, step: "choose", updatedAt: new Date().toISOString() };
    delete next.existingServices;
    delete next.existingOnWebsite;
    delete next.websiteServices;
    delete next.cachedExistingServices;
    fs.writeFileSync(file, JSON.stringify(next, null, 2));
    return true;
  } catch {
    return false;
  }
}
