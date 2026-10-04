import { Router, Request, Response } from "express";
import { runEndToEndContentPipeline, releaseStaleGenerationWriteLocks } from "../../../../src/pharmacy/contentEngine/pipelineRunner.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../../../../src/pharmacy/pharmacyWorkspacePaths.ts";
import {
  buildGenerationHierarchy,
  buildPharmacyDashboardPayload,
  findPharmacyCustomer,
  isRejectedSandboxSlug,
  listPharmacyCustomerCards,
  loadPharmacyCustomerCatalog,
  mapsEmbedBaseUrl,
  resolveCoreServiceId,
} from "../../../../src/pharmacy/dashboardCustomerStore.ts";
import { approveAllRemainingLocalityPages } from "../../../../src/pharmacy/pharmacyDashboardOperationalPageStatus.ts";
import {
  layoutSlotAssetsForService,
  seedVisualPageImageAssignments,
} from "../../../../src/pharmacy/pharmacyImageOperatingSystem.ts";
import { autoFillServiceImagesFromMasterStock } from "../../../../src/pharmacy/pharmacyMasterStockImageService.ts";
import { NHS_PHARMACY_FIRST_CONDITION_TRACKS } from "../../../../src/pharmacy/pharmacyFirstConditionTracks.ts";
import { writeCorporateServiceHubPage, renderCorporateServiceHubForTenant } from "../../../../src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts";
import {
  activeServiceChannelPayload,
  activeServiceIdsList,
  activeServiceLabel,
  isActiveServiceStatus,
} from "../../../../src/pharmacy/pharmacyServiceRegistry.ts";

export const dashboardApiRouter = Router();

const CAMPAIGN_GENERATE_HTTP_TIMEOUT_MS = 120_000;

function extendCampaignGenerateHttpTimeout(req: Request, res: Response): void {
  req.setTimeout(120000);
  res.setTimeout(CAMPAIGN_GENERATE_HTTP_TIMEOUT_MS);
  req.socket?.setTimeout(CAMPAIGN_GENERATE_HTTP_TIMEOUT_MS);
}

function requestedServiceId(req: Request): string | undefined {
  const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
  const raw = body.serviceId ?? body.service ?? req.query.serviceId ?? req.query.service;
  return typeof raw === "string" ? raw : undefined;
}

dashboardApiRouter.get("/api/dashboard/customers", (_req: Request, res: Response) => {
  try {
    const catalog = loadPharmacyCustomerCatalog();
    return res.status(200).json({
      success: true,
      count: catalog.pharmacies.length,
      coreServiceChannels: catalog.coreServiceChannels,
      pharmacies: listPharmacyCustomerCards(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not load pharmacy customers.";
    return res.status(500).json({ success: false, error: message });
  }
});

dashboardApiRouter.get("/api/dashboard/:tenantSlug/services", (req: Request, res: Response) => {
  const tenantSlug = String(req.params.tenantSlug || "");
  if (isRejectedSandboxSlug(tenantSlug) || !findPharmacyCustomer(tenantSlug)) {
    return res.status(404).json({ success: false, error: "Production pharmacy not found." });
  }
  return res.status(200).json({
    success: true,
    slug: tenantSlug,
    serviceChannels: activeServiceChannelPayload().filter((channel) => isActiveServiceStatus(channel.status)),
  });
});

dashboardApiRouter.get("/api/dashboard/:tenantSlug/catchment", (req: Request, res: Response) => {
  const customer = findPharmacyCustomer(String(req.params.tenantSlug || ""));
  if (!customer) {
    return res.status(404).json({ success: false, error: "Production pharmacy not found." });
  }
  return res.status(200).json({
    success: true,
    slug: customer.slug,
    pharmacyName: customer.pharmacyName,
    googleCatchment: customer.googleCatchment,
  });
});

dashboardApiRouter.get("/api/dashboard/:tenantSlug", (req: Request, res: Response) => {
  try {
    const tenantSlug = String(req.params.tenantSlug || "");
    if (isRejectedSandboxSlug(tenantSlug)) {
      return res.status(404).json({ success: false, error: "Sandbox tenant is not available." });
    }
    const payload = buildPharmacyDashboardPayload(tenantSlug, requestedServiceId(req));
    if (!payload) {
      return res.status(404).json({ success: false, error: "Production pharmacy not found." });
    }
    return res.status(200).json(payload);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not load pharmacy dashboard.";
    return res.status(500).json({ success: false, error: message });
  }
});

dashboardApiRouter.post("/api/dashboard/:tenantSlug/generate", async (req: Request, res: Response) => {
  extendCampaignGenerateHttpTimeout(req, res);
  try {
    const tenantSlug = String(req.params.tenantSlug || "");
    if (isRejectedSandboxSlug(tenantSlug)) {
      return res.status(404).json({ success: false, error: "Sandbox tenant is not available." });
    }
    const customer = findPharmacyCustomer(tenantSlug);
    if (!customer) {
      return res.status(404).json({ success: false, error: "Production pharmacy not found." });
    }
    const requested = requestedServiceId(req);
    const serviceId = requested ? resolveCoreServiceId(requested) : "pharmacy-first";
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: `Service must be one of ${activeServiceIdsList()}.`,
      });
    }

    seedVisualPageImageAssignments(customer.slug, false);
    autoFillServiceImagesFromMasterStock(customer.slug, { serviceId, overwrite: false });
    releaseStaleGenerationWriteLocks(customer.slug, serviceId);
    const layoutImages = layoutSlotAssetsForService(customer.slug, serviceId).map((slot) => ({
      url: slot.url,
      altText: slot.altText,
    }));

    const hierarchyData = buildGenerationHierarchy(customer, serviceId);
    const brandStyle = {
      primaryColor: customer.brandPrimaryColor,
      fontFamily: "sans-serif",
      headerHtml: "",
      footerHtml: "",
    };

    await runEndToEndContentPipeline(
      hierarchyData as never,
      brandStyle,
      { profilesDirectoryBase: PHARMACY_WORKSPACE_ROOT, tenantSlug: customer.slug },
      customer.googleCatchment.googleMapsEmbedUrl || mapsEmbedBaseUrl(),
      { serviceId, layoutImages },
    );

    const serviceHubPath = writeCorporateServiceHubPage(customer.slug, serviceId);

    return res.status(200).json({
      success: true,
      slug: customer.slug,
      serviceId,
      rankingAreas: customer.googleCatchment.rankingAreas,
      slotAssets: layoutImages.length,
      primedGemini: true,
      servicePageStatus: "APPROVED FOR REVISION",
      serviceHub: {
        title: "Conditions Covered Under NHS Pharmacy First",
        conditionTracks: [...NHS_PHARMACY_FIRST_CONDITION_TRACKS],
        layout: "authority-7",
        renderer: "pharmacyLocalClusterLocationPageRenderer",
        outputPath: serviceHubPath,
        previewUrl: `/api/dashboard/${encodeURIComponent(customer.slug)}/service-hub?serviceId=${encodeURIComponent(serviceId)}`,
      },
      message: `Catchment generation primed for ${customer.pharmacyName} (${coreLabel(serviceId)}) across ${customer.googleCatchment.rankingAreas.length} ranking areas.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return res.status(500).json({ success: false, error: message });
  }
});

dashboardApiRouter.post("/api/dashboard/:tenantSlug/approve-remaining-locality-pages", (req: Request, res: Response) => {
  try {
    const tenantSlug = String(req.params.tenantSlug || "");
    if (isRejectedSandboxSlug(tenantSlug) || !findPharmacyCustomer(tenantSlug)) {
      return res.status(404).json({ success: false, error: "Production pharmacy not found." });
    }
    const customer = findPharmacyCustomer(tenantSlug)!;
    const body = req.body && typeof req.body === "object" ? (req.body as Record<string, unknown>) : {};
    const requested = typeof body.serviceId === "string" ? body.serviceId : requestedServiceId(req);
    const serviceId = requested ? resolveCoreServiceId(requested) : "pharmacy-first";
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: `Service must be one of ${activeServiceIdsList()}.`,
      });
    }
    const campaignId = typeof body.campaignId === "string" ? body.campaignId : undefined;
    const result = approveAllRemainingLocalityPages({
      slug: customer.slug,
      serviceId,
      campaignId,
      operator: "dashboard-approve-remaining",
      areaNames: customer.googleCatchment.rankingAreas.map((name) => ({ name })),
    });
    return res.status(200).json({
      success: true,
      slug: customer.slug,
      serviceId,
      campaignId: result.store.campaignId,
      approvedCount: result.approvedSlugs.length,
      approvedSlugs: result.approvedSlugs,
      localityStatus: "APPROVED",
      servicePageStatus: result.store.servicePage.status,
      dashboard: buildPharmacyDashboardPayload(customer.slug, serviceId),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not approve remaining locality pages.";
    return res.status(500).json({ success: false, error: message });
  }
});

dashboardApiRouter.get("/api/dashboard/:tenantSlug/service-hub", (req: Request, res: Response) => {
  try {
    const tenantSlug = String(req.params.tenantSlug || "");
    if (isRejectedSandboxSlug(tenantSlug) || !findPharmacyCustomer(tenantSlug)) {
      return res.status(404).json({ success: false, error: "Production pharmacy not found." });
    }
    const requested = requestedServiceId(req);
    const serviceId = requested ? resolveCoreServiceId(requested) : "pharmacy-first";
    if (!serviceId) {
      return res.status(400).json({
        success: false,
        error: `Service must be one of ${activeServiceIdsList()}.`,
      });
    }
    const html = renderCorporateServiceHubForTenant(tenantSlug, serviceId);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(200).send(html);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Could not render service hub.";
    return res.status(500).json({ success: false, error: message });
  }
});

function coreLabel(serviceId: string): string {
  return activeServiceLabel(serviceId);
}
