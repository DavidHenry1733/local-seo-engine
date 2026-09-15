/**
 * CPR-PLATFORM-OPERATIONS-01 — live Platform Operations Dashboard aggregate.
 * Reads existing shared platform state only. Does not generate or mutate services.
 */
import fs from "node:fs";
import path from "node:path";
import { WORKSPACE_ROOT } from "./pharmacyExecutiveDashboardService.ts";
import { readMasterAdminRegistry } from "./pharmacyMasterAdminService.ts";
import {
  ensureMasterAdminHealthCache,
  getCachedMasterAdminSystemHealth,
} from "./masterAdminHealthCacheService.ts";
import { listLockedCommercialServiceRegistrations } from "./masterAdminServiceRegistrationFramework.ts";
import { buildMasterAdminServiceCampaignSummaries } from "./masterAdminServiceCampaignSummaryService.ts";
import { isPharmacyFirstProductionLibraryReady } from "./imagePlatform/pharmacyImagePlatformProductionResolver.ts";
import { buildCommercialIndexingReviewDashboard } from "./masterAdminCommercialIndexingReviewService.ts";
import { buildCommercialPerformanceDashboard } from "./masterAdminCommercialPerformanceDashboardService.ts";
import { getPharmacyLivePublishStatus } from "./pharmacyLivePublishService.ts";
import { isServicePageGeneratedForIdentity } from "./masterAdminCoreProductRecoveryService.ts";
import { readPharmacyCampaignStore } from "./pharmacyCampaignService.ts";
import { safeAdminSlug } from "./pharmacyMasterAdminService.ts";
import { resolveGrowthPlatform } from "./growthPlatformResolverService.ts";
import { resolveTenantServiceCatalogue } from "./growthEngineTenantServiceCatalogue.ts";

export type OpsCapabilityStatus = "PASS" | "WARNING" | "BLOCKED";
export type OpsHealthStatus = "Healthy" | "Warning" | "Error";

const RC1_POLISH_BACKLOG = [
  "Nearby areas beside maps",
  "Minor alignment",
  "Minor spacing",
  "Image library expansion",
  "CTA refinement",
  "Mobile polish",
] as const;

const CAPABILITY_IDS = [
  "Service Registration",
  "Campaign Manager",
  "Business Profile",
  "Evidence",
  "Generation",
  "Locality Generation",
  "Review",
  "Publishing",
  "Static Deployment",
  "Registry",
  "Sitemap",
  "Image Platform",
  "Structured Data",
  "Indexing",
  "Search Console",
  "Rank Tracking",
  "Dashboard Reporting",
] as const;

function exists(...parts: string[]): boolean {
  return fs.existsSync(path.join(WORKSPACE_ROOT, ...parts));
}

function countHtmlUnder(relDir: string): number {
  const root = path.join(WORKSPACE_ROOT, relDir);
  if (!fs.existsSync(root)) return 0;
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && e.name === "index.html") n += 1;
    }
  };
  walk(root);
  return n;
}

function countImagesUnder(relDir: string): number {
  const root = path.join(WORKSPACE_ROOT, relDir);
  if (!fs.existsSync(root)) return 0;
  let n = 0;
  const walk = (dir: string) => {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) walk(full);
      else if (e.isFile() && /\.(jpg|jpeg|png|webp|svg)$/i.test(e.name)) n += 1;
    }
  };
  walk(root);
  return n;
}

function activeClientSlugs(): string[] {
  const registry = readMasterAdminRegistry();
  return registry.clients.filter((c) => !c.archived).map((c) => safeAdminSlug(c.slug));
}

function auditMtime(): string | null {
  const p = path.join(WORKSPACE_ROOT, "docs/platform/PLATFORM-CAPABILITY-MATRIX-RC1.md");
  if (!fs.existsSync(p)) return null;
  return new Date(fs.statSync(p).mtimeMs).toISOString();
}

function capabilityStatus(
  implemented: boolean,
  operational: boolean,
  warning = false,
): OpsCapabilityStatus {
  if (!implemented) return "BLOCKED";
  if (warning || !operational) return "WARNING";
  return "PASS";
}

function healthFrom(status: OpsCapabilityStatus): OpsHealthStatus {
  if (status === "PASS") return "Healthy";
  if (status === "WARNING") return "Warning";
  return "Error";
}

function campaignBucket(summary: {
  workflowState?: string;
  nextAction?: string;
  publishStatus?: string;
  servicePageStatus?: string;
  localPageStatus?: string;
}): string {
  const state = String(summary.workflowState || "");
  const next = String(summary.nextAction || "").toLowerCase();
  const publish = String(summary.publishStatus || "").toLowerCase();

  if (state === "LOCALITIES_GENERATED" || /review locality/i.test(next)) return "Locality Review";
  if (state === "SERVICE_GENERATED" || /open service preview|regenerate service|generate locality/i.test(next)) {
    return "Service Review";
  }
  if (state === "SERVICE_NOT_GENERATED") {
    if (/evidence/i.test(next)) return "Evidence Review";
    return "Draft";
  }
  if (publish === "published") return "Published";
  if (/approve/i.test(next)) return "Approved";
  if (/block/i.test(next)) return "Blocked";
  return "Draft";
}

export function buildPlatformOperationsDashboard(viewSlug?: string) {
  ensureMasterAdminHealthCache();
  const systemHealth = getCachedMasterAdminSystemHealth();
  const registrations = listLockedCommercialServiceRegistrations();
  const slugs = activeClientSlugs();
  const primarySlug = slugs.includes("leeds-pharmacy") ? "leeds-pharmacy" : slugs[0] || "leeds-pharmacy";

  const allCampaigns: Array<{
    slug: string;
    campaignId: string;
    serviceId: string;
    serviceName: string;
    bucket: string;
    openUrl: string;
    workflowState: string;
    publishStatus: string;
    serviceGenerated: boolean;
    localitiesGenerated: boolean;
  }> = [];

  for (const slug of slugs) {
    try {
      const summaries = buildMasterAdminServiceCampaignSummaries(slug);
      for (const s of summaries) {
        allCampaigns.push({
          slug,
          campaignId: s.campaignId,
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          bucket: campaignBucket(s),
          openUrl: s.openUrl,
          workflowState: s.workflowState,
          publishStatus: s.publishStatus,
          serviceGenerated: s.serviceGenerated,
          localitiesGenerated: s.localitiesGenerated,
        });
      }
    } catch {
      /* skip tenant load errors */
    }
  }

  const stageCounts: Record<string, number> = {
    Draft: 0,
    "Evidence Review": 0,
    "Service Review": 0,
    "Locality Review": 0,
    Approved: 0,
    Published: 0,
    Blocked: 0,
  };
  for (const c of allCampaigns) {
    stageCounts[c.bucket] = (stageCounts[c.bucket] || 0) + 1;
  }

  const visualPages = countHtmlUnder("output/pharmacy-visual-experience");
  const localityPages = countHtmlUnder("output/pharmacy-content-ecosystem");
  const generatedImages =
    countImagesUnder("output/pharmacy-visual-experience") +
    countImagesUnder("assets/pharmacy-image-platform");

  let approvedPages = 0;
  let publishedPages = 0;
  for (const slug of slugs) {
    try {
      const live = getPharmacyLivePublishStatus(slug);
      if (live.lastPublishedAt) publishedPages += 1;
      const store = readPharmacyCampaignStore(slug);
      for (const camp of store?.campaigns || []) {
        if (camp.status !== "active") continue;
        if (isServicePageGeneratedForIdentity(slug, camp.serviceId, camp.id)) approvedPages += 1;
      }
    } catch {
      /* ignore */
    }
  }

  // Search visibility from primary validation tenant + light rollup
  let indexed = 0;
  let notIndexed = 0;
  let submitted = 0;
  let pending = 0;
  let impressions: string | number = "Not available";
  let clicks: string | number = "Not available";
  let ctr: string | number = "Not available";
  let averagePosition: string | number = "Not available";
  let searchConsoleLabel = "Not connected";
  let searchConsoleWarning = true;
  let searchConsoleConnected = false;

  try {
    const idx = buildCommercialIndexingReviewDashboard(primarySlug);
    indexed = idx.pagesIndexed || 0;
    notIndexed = idx.pagesExcluded || 0;
    submitted = idx.pagesSubmitted || 0;
    pending = idx.pagesPending || 0;
    searchConsoleLabel = idx.searchConsoleStatus || searchConsoleLabel;
    // Canonical connection only — never treat "Not connected" as connected via substring match.
    searchConsoleConnected = Boolean(idx.searchConsoleConnected);
    searchConsoleWarning = !searchConsoleConnected;
  } catch {
    /* keep defaults */
  }

  if (searchConsoleConnected) {
    try {
      const perf = buildCommercialPerformanceDashboard(primarySlug);
      impressions = String(perf.impressions ?? "Not available");
      clicks = String(perf.clicks ?? "Not available");
      ctr = String(perf.ctr ?? "Not available");
      averagePosition = String(perf.averagePosition ?? "Not available");
    } catch {
      /* keep defaults */
    }
  } else {
    // Do not surface fabricated zero metrics when Search Console is disconnected.
    indexed = 0;
    notIndexed = 0;
    submitted = 0;
    pending = 0;
    impressions = "—";
    clicks = "—";
    ctr = "—";
    averagePosition = "—";
  }

  const registryOk = exists("data/pharmacy-master-admin/registry.json");
  const sitemapOk =
    exists("output/pharmacy-publish") ||
    fs.existsSync(path.join(WORKSPACE_ROOT, "output")) &&
      (() => {
        try {
          return [...fs.readdirSync(path.join(WORKSPACE_ROOT, "output"), { withFileTypes: true })]
            .filter((d) => d.isDirectory())
            .some((d) => fs.existsSync(path.join(WORKSPACE_ROOT, "output", d.name, "sitemap.xml")));
        } catch {
          return false;
        }
      })();
  const imageOk =
    exists("assets/pharmacy-image-platform/library-manifest.json") || isPharmacyFirstProductionLibraryReady();
  const structuredDataOk = exists("src/pharmacy/pharmacyVisualExperience.ts");
  const generationOk = exists("src/pharmacy/masterAdminProductOwnerGenerationControlService.ts");
  const localityOk = exists("src/pharmacy/masterAdminLocalClusterJobService.ts");
  const campaignOk = exists("src/pharmacy/pharmacyCampaignService.ts");
  const evidenceOk = exists("src/pharmacy/masterAdminCoreProductRecoveryEvidenceReviewService.ts");
  const publishOk = exists("src/pharmacy/masterAdminCommercialPublishReviewService.ts");
  const deployOk = exists("src/pharmacy/masterAdminCommercialDeploymentService.ts");
  const indexingOk = exists("src/pharmacy/masterAdminCommercialIndexingReviewService.ts");
  const rankingOk = exists("src/pharmacy/masterAdminCommercialPerformanceDashboardService.ts");

  const readyCount = registrations.filter((r) => r.generationReady).length;
  const setupCount = registrations.filter((r) => !r.generationReady).length;
  const generatedCampaigns = allCampaigns.filter((c) => c.serviceGenerated).length;
  const localityCampaigns = allCampaigns.filter((c) => c.localitiesGenerated).length;

  const capabilities = CAPABILITY_IDS.map((id) => {
    let status: OpsCapabilityStatus = "PASS";
    let detail = "Operational";
    switch (id) {
      case "Service Registration":
        status = capabilityStatus(true, readyCount > 0);
        detail = `${readyCount} Ready · ${setupCount} Setup Required`;
        break;
      case "Campaign Manager":
        status = capabilityStatus(campaignOk, allCampaigns.length >= 0);
        detail = `${allCampaigns.length} active campaign(s)`;
        break;
      case "Business Profile":
        status = capabilityStatus(exists("src/pharmacy/masterAdminBusinessProfileReviewService.ts"), true);
        detail = "Shared Business Profile review path";
        break;
      case "Evidence":
        status = capabilityStatus(evidenceOk, true);
        detail = "Evidence review / approval path";
        break;
      case "Generation":
        status = capabilityStatus(generationOk, generatedCampaigns > 0 || readyCount > 0);
        detail = `${generatedCampaigns} campaign(s) with service page`;
        break;
      case "Locality Generation":
        status = capabilityStatus(localityOk, localityCampaigns > 0 || readyCount > 0, localityCampaigns === 0);
        detail = `${localityCampaigns} campaign(s) with localities`;
        break;
      case "Review":
        status = capabilityStatus(true, generatedCampaigns > 0 || localityCampaigns > 0, generatedCampaigns === 0);
        detail = "Service + locality review workspaces";
        break;
      case "Publishing":
        status = capabilityStatus(publishOk, true, publishedPages === 0);
        detail = publishedPages > 0 ? `${publishedPages} published tenant(s)` : "Implemented · commercial release proof outstanding";
        break;
      case "Static Deployment":
        status = capabilityStatus(deployOk, true, true);
        detail = "Deployment configuration path available";
        break;
      case "Registry":
        status = capabilityStatus(registryOk, registryOk);
        detail = registryOk ? "Master Admin registry available" : "Registry missing";
        break;
      case "Sitemap":
        status = capabilityStatus(true, sitemapOk, !sitemapOk);
        detail = sitemapOk ? "Sitemap artefacts present" : "Sitemap publish verification outstanding";
        break;
      case "Image Platform":
        status = capabilityStatus(imageOk, imageOk);
        detail = imageOk ? "Shared image platform ready" : "Image platform not ready";
        break;
      case "Structured Data":
        status = capabilityStatus(structuredDataOk, true);
        detail = "Shared schema emission path";
        break;
      case "Indexing":
        status = capabilityStatus(indexingOk, true, submitted === 0 && indexed === 0);
        detail = `${indexed} indexed · ${submitted} submitted`;
        break;
      case "Search Console":
        status = capabilityStatus(true, !searchConsoleWarning, searchConsoleWarning);
        detail = searchConsoleLabel;
        break;
      case "Rank Tracking":
        status = capabilityStatus(rankingOk, true, /not available/i.test(averagePosition));
        detail = `Average position: ${averagePosition}`;
        break;
      case "Dashboard Reporting":
        status = capabilityStatus(true, true, searchConsoleWarning);
        detail = "Master Admin + performance panels";
        break;
    }
    return { id, status, detail };
  });

  const platformHealth = {
    Workflow: healthFrom(capabilities.find((c) => c.id === "Campaign Manager")!.status),
    Generation: healthFrom(capabilities.find((c) => c.id === "Generation")!.status),
    "Image Platform": healthFrom(capabilities.find((c) => c.id === "Image Platform")!.status),
    Registry: healthFrom(capabilities.find((c) => c.id === "Registry")!.status),
    Sitemap: healthFrom(capabilities.find((c) => c.id === "Sitemap")!.status),
    "Search Console": healthFrom(capabilities.find((c) => c.id === "Search Console")!.status),
    Deployment: healthFrom(capabilities.find((c) => c.id === "Static Deployment")!.status),
  };

  const serviceRows = registrations.map((reg) => {
    const serviceCampaigns = allCampaigns.filter((c) => c.serviceId === reg.serviceId);
    const anyPublished = serviceCampaigns.some((c) => /published/i.test(c.publishStatus));
    const anyGenerated = serviceCampaigns.some((c) => c.serviceGenerated);
    const anyLocalities = serviceCampaigns.some((c) => c.localitiesGenerated);
    let indexedFlag = false;
    // Indexed is tenant-level today; mark true only when primary has indexed pages and service has generated campaigns there
    if (indexed > 0 && serviceCampaigns.some((c) => c.slug === primarySlug && c.serviceGenerated)) {
      indexedFlag = true;
    }
    return {
      serviceId: reg.serviceId,
      serviceName: reg.serviceName,
      registrationStatus: reg.status,
      generationReady: reg.generationReady,
      missingRegistrations: reg.missingRegistrations,
      published: anyPublished,
      indexed: indexedFlag,
      campaigns: serviceCampaigns.length,
      servicePage: anyGenerated,
      localities: anyLocalities,
      approved: anyGenerated,
      createCampaignHref: reg.generationReady
        ? `/api/admin/master?customer=${encodeURIComponent(primarySlug)}#po-create-campaign`
        : null,
      openCampaignHref: serviceCampaigns[0]?.openUrl || null,
    };
  });

  const releaseReadiness = serviceRows
    .filter((s) => s.generationReady)
    .map((s) => ({
      service: s.serviceName,
      serviceId: s.serviceId,
      registration: s.registrationStatus,
      campaign: s.campaigns > 0 ? "Yes" : "No",
      servicePage: s.servicePage ? "Yes" : "No",
      localities: s.localities ? "Yes" : "No",
      approved: s.approved ? "Yes" : "No",
      published: s.published ? "Yes" : "No",
      indexed: s.indexed ? "Yes" : "No",
      href: s.openCampaignHref || s.createCampaignHref,
    }));

  const healthItems = systemHealth || [];
  const overallHealth =
    healthItems.some((h) => /fail|error/i.test(String((h as { status?: string }).status || "")))
      ? "Error"
      : healthItems.some((h) => /warn|not initialised|not initialized/i.test(String((h as { status?: string }).status || (h as { label?: string }).label || "")))
        ? "Warning"
        : "Healthy";

  const viewingSlug = viewSlug ? safeAdminSlug(viewSlug) : "";
  const viewingPlatform = viewingSlug ? resolveGrowthPlatform(viewingSlug).platform : "local";
  const tenantCatalogue = viewingSlug ? resolveTenantServiceCatalogue(viewingSlug) : null;
  const tenantCommercialServices =
    viewingPlatform === "national" && tenantCatalogue
      ? tenantCatalogue.services.map((s) => ({
          serviceId: s.serviceId,
          serviceName: s.serviceName,
          href: s.href || "",
          source: tenantCatalogue.source,
        }))
      : [];

  return {
    version: "RC1",
    generatedAt: new Date().toISOString(),
    primarySlug,
    viewingSlug: viewingSlug || null,
    viewingPlatform,
    tenantCommercialServices,
    pharmacyCustomerGenerationCapability: {
      label: "PHARMACY CUSTOMER GENERATION CAPABILITY",
      note: "Locked patient-service catalogue used to generate content for local pharmacy customers. This is not a national digital-growth provider's own service list.",
      services: serviceRows,
    },
    platformStatus: {
      platformVersion: "RC1",
      architectureStatus: "LOCKED",
      workflowStatus: "LOCKED",
      generationEngine: generationOk ? "Operational" : "Missing",
      imagePlatform: imageOk ? "Operational" : "Warning",
      staticDeployment: deployOk ? (publishedPages > 0 ? "Operational" : "Configured") : "Missing",
      registry: registryOk ? "Operational" : "Missing",
      sitemap: sitemapOk ? "Operational" : "Warning",
      searchConsole: searchConsoleLabel,
      platformHealth: overallHealth,
      lastPlatformAudit: auditMtime(),
    },
    capabilities,
    services: serviceRows,
    campaignOperations: {
      counts: stageCounts,
      items: allCampaigns.slice(0, 40).map((c) => ({
        stage: c.bucket,
        label: `${c.serviceName} · ${c.slug}`,
        href: c.openUrl,
      })),
    },
    contentStatus: {
      registeredServices: registrations.length,
      campaigns: allCampaigns.length,
      servicePages: visualPages,
      localityPages: localityPages,
      approvedPages,
      publishedPages,
      generatedImages,
    },
    searchVisibility: {
      indexedPages: searchConsoleConnected ? indexed : null,
      notIndexed: searchConsoleConnected ? notIndexed : null,
      submitted: searchConsoleConnected ? submitted : null,
      impressions: searchConsoleConnected ? impressions : null,
      clicks: searchConsoleConnected ? clicks : null,
      ctr: searchConsoleConnected ? ctr : null,
      averagePosition: searchConsoleConnected ? averagePosition : null,
      pendingRequests: searchConsoleConnected ? pending : null,
      searchConsoleStatus: searchConsoleLabel,
      searchConsoleConnected,
      connectUrl: "/api/gsc/auth/start",
      primarySlug,
    },
    platformHealth,
    polishBacklog: [...RC1_POLISH_BACKLOG],
    releaseReadiness,
    links: {
      createCampaign: `/api/admin/master?customer=${encodeURIComponent(primarySlug)}#po-create-campaign`,
      customers: "/api/admin/master",
      publishing: `/api/admin/master?customer=${encodeURIComponent(primarySlug)}`,
      indexing: "search-visibility",
      platformInfrastructure: "/api/admin/master",
    },
  };
}
