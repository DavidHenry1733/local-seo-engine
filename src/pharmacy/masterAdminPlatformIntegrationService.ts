/**
 * CPR-COMMERCIAL-INTEGRATION-V1 — read-only wiring for Master Dashboard parity.
 * Does not modify import, generation, publishing, or Search Console engines.
 */
import { buildCommercialIndexingReviewDashboard } from "./masterAdminCommercialIndexingReviewService.ts";
import { buildCommercialPerformanceDashboard } from "./masterAdminCommercialPerformanceDashboardService.ts";
import { isBusinessProfileReviewApproved } from "./masterAdminBusinessProfileReviewService.ts";
import { isServicePageEvidenceReviewApproved } from "./masterAdminCoreProductRecoveryEvidenceReviewService.ts";
import { readServicePageGenerationRecord } from "./masterAdminCoreProductRecoveryService.ts";
import { readOnboardingBatch } from "./masterAdminOnboardingBatchService.ts";
import { buildMasterAdminCustomerListLite } from "./masterAdminDashboardLiteService.ts";
import type { MasterAdminCustomerListRow } from "./masterAdminPlatformService.ts";
import {
  buildPharmacySearchConsoleDashboard,
  buildPharmacySearchConsoleListMetrics,
  type PharmacySearchConsoleDashboardV1,
} from "./pharmacySearchConsoleDashboardService.ts";

export interface MasterAdminSearchConsoleIntegrationV1 {
  connectionStatus: string;
  indexStatus: string;
  indexedPages: number | null;
  submittedPages: number | null;
  impressions: number | null;
  clicks: number | null;
  averagePosition: number | null;
  coverage: string | null;
  lastCrawl: string | null;
  lastSync: string | null;
  property: string | null;
}

export interface MasterAdminCustomerPlatformStatusV1 {
  slug: string;
  generationStatus: string;
  publishingStatus: string;
  indexingStatus: string;
  rankingStatus: string;
  searchConsoleStatus: string;
  commercialReady: boolean;
  businessReviewApproved: boolean;
  googleImportState: string;
  websiteImportState: string;
  lastActivity: string | null;
}

export interface MasterAdminIntegratedGrowthDashboardV1 {
  version: 1;
  slug: string;
  searchConsole: MasterAdminSearchConsoleIntegrationV1;
  searchConsoleDashboard: PharmacySearchConsoleDashboardV1;
  indexing: ReturnType<typeof buildCommercialIndexingReviewDashboard>;
  performance: ReturnType<typeof buildCommercialPerformanceDashboard>;
  platformStatus: MasterAdminCustomerPlatformStatusV1;
}

/** Canonical Product Owner GSC badge — never treat "Not connected" as CONNECTED. */
export function gscStatusLabel(connectionStatus: string): string {
  const status = String(connectionStatus || "").trim();
  if (!status) return "NOT CONNECTED";
  if (/not\s*connected/i.test(status)) return "NOT CONNECTED";
  if (/^connected(\b|\s|\()/i.test(status)) return "CONNECTED";
  return status.toUpperCase();
}

export function readMasterAdminSearchConsoleIntegration(slug: string): MasterAdminSearchConsoleIntegrationV1 {
  const dash = buildPharmacySearchConsoleDashboard(slug);
  return {
    connectionStatus: dash.connectionStatus,
    indexStatus: dash.indexing.coverageSummary || dash.indexHealth,
    indexedPages: dash.indexing.indexedPages,
    submittedPages: dash.indexing.submittedPages,
    impressions: dash.performance.impressions,
    clicks: dash.performance.clicks,
    averagePosition: dash.performance.averagePosition ? Number(dash.performance.averagePosition) : null,
    coverage: dash.indexing.coverageSummary,
    lastCrawl: dash.indexing.lastCrawl,
    lastSync: dash.lastSync,
    property: dash.property,
  };
}

export function buildMasterAdminCustomerPlatformStatus(
  row: MasterAdminCustomerListRow,
): MasterAdminCustomerPlatformStatusV1 {
  const slug = row.slug;
  const batch = readOnboardingBatch(slug);
  // List-level commercial readiness remains Pharmacy First campaign identity.
  const gen = readServicePageGenerationRecord(slug, "pharmacy-first");
  const gsc = readMasterAdminSearchConsoleIntegration(slug);

  const commercialReady =
    row.publishingStatus === "PUBLISHED" &&
    gen?.status === "completed" &&
    isBusinessProfileReviewApproved(slug) &&
    isServicePageEvidenceReviewApproved(slug);

  return {
    slug,
    generationStatus: row.generationStatus,
    publishingStatus: row.publishingStatus,
    indexingStatus: row.indexingStatus,
    rankingStatus: row.rankingStatus,
    searchConsoleStatus: gscStatusLabel(gsc.connectionStatus),
    commercialReady,
    businessReviewApproved: isBusinessProfileReviewApproved(slug),
    googleImportState: batch?.google.importState || "unknown",
    websiteImportState: batch?.website.importState || "unknown",
    lastActivity: row.lastActivity || null,
  };
}

export function enrichMasterAdminCustomerListRow(row: MasterAdminCustomerListRow): MasterAdminCustomerListRow & {
  platformStatus: MasterAdminCustomerPlatformStatusV1;
  searchConsoleLabel: string;
  searchConsoleMetrics: ReturnType<typeof buildPharmacySearchConsoleListMetrics>;
} {
  const platformStatus = buildMasterAdminCustomerPlatformStatus(row);
  const gsc = readMasterAdminSearchConsoleIntegration(row.slug);
  const searchConsoleMetrics = buildPharmacySearchConsoleListMetrics(row.slug);
  return {
    ...row,
    platformStatus,
    searchConsoleLabel: gsc.indexStatus,
    searchConsoleMetrics,
  };
}

export function buildMasterAdminIntegratedGrowthDashboard(slug: string): MasterAdminIntegratedGrowthDashboardV1 {
  const indexing = buildCommercialIndexingReviewDashboard(slug);
  const performance = buildCommercialPerformanceDashboard(slug);
  const searchConsoleDashboard = buildPharmacySearchConsoleDashboard(slug);
  const searchConsole = readMasterAdminSearchConsoleIntegration(slug);
  const listRow =
    buildMasterAdminCustomerListLite().customers.find((c) => c.slug === slug) ||
    ({
      slug,
      businessName: slug,
      website: "",
      lifecycle: "new",
      lifecycleLabel: "New",
      currentStage: "create_customer",
      currentStageLabel: "Create Customer",
      nextAction: "",
      outstandingIssues: 0,
      completionPct: 0,
      workflowCompletionPct: 0,
      generationStatus: "NOT STARTED",
      publishingStatus: "NOT STARTED",
      indexingStatus: indexing.coverageLabel,
      rankingStatus: "NOT CONFIGURED",
      lastActivity: performance.lastUpdate || new Date(0).toISOString(),
      accountManager: "Unassigned",
      health: "warning",
      healthLabel: "Needs review",
      isDemo: false,
      archived: false,
      suspended: false,
    } satisfies MasterAdminCustomerListRow);

  return {
    version: 1,
    slug,
    searchConsole,
    searchConsoleDashboard,
    indexing,
    performance,
    platformStatus: buildMasterAdminCustomerPlatformStatus(listRow),
  };
}
