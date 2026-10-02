import { Router, Request, Response } from "express";
import { runEndToEndContentPipeline } from "./contentEngine/pipelineRunner.js";
import { PHARMACY_WORKSPACE_ROOT } from "./pharmacyWorkspacePaths.ts";
import {
  buildGenerationHierarchy,
  buildPharmacyDashboardPayload,
  findPharmacyCustomer,
  isRejectedSandboxSlug,
  listPharmacyCustomerCards,
  loadPharmacyCustomerCatalog,
  mapsEmbedBaseUrl,
  resolveCoreServiceId,
} from "./dashboardCustomerStore.ts";
import {
  activeServiceChannelPayload,
  activeServiceIdsList,
  activeServiceLabel,
  isActiveServiceStatus,
} from "./pharmacyServiceRegistry.ts";
import {
  layoutSlotAssetsForService,
  seedVisualPageImageAssignments,
} from "./pharmacyImageOperatingSystem.ts";
import { autoFillServiceImagesFromMasterStock } from "./pharmacyMasterStockImageService.ts";

export const dashboardApiRouter = Router();

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

    return res.status(200).json({
      success: true,
      slug: customer.slug,
      serviceId,
      rankingAreas: customer.googleCatchment.rankingAreas,
      slotAssets: layoutImages.length,
      primedGemini: true,
      message: `Catchment generation primed for ${customer.pharmacyName} (${coreLabel(serviceId)}) across ${customer.googleCatchment.rankingAreas.length} ranking areas.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Generation failed.";
    return res.status(500).json({ success: false, error: message });
  }
});

function coreLabel(serviceId: string): string {
  return activeServiceLabel(serviceId);
}
