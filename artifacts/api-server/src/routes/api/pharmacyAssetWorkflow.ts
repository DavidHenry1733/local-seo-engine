/**
 * Asset workflow actions — confirm brand/images, review content, approve asset.
 */
import { Router } from "express";
import {
  approveServiceAsset,
  confirmBrandAndImages,
  getServiceAssetWorkflow,
  markContentReviewed,
} from "../../../../../src/pharmacy/pharmacyAssetWorkflowService.ts";
import { buildPlatformOperatingSystem } from "../../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { refreshPlatformAfterEnhancementComplete } from "../../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();

function tenantFromParams(req: import("express").Request, res: import("express").Response): string | null {
  const slug = resolveTenantProfileSlug(req.params.slug);
  if (!slug) {
    res.status(400).json({ ok: false, error: "Unknown pharmacy slug" });
    return null;
  }
  return slug;
}

router.get("/pharmacy/asset-workflow/:slug/:serviceId", (req, res) => {
  try {
    const slug = tenantFromParams(req, res);
    if (!slug) return;
    const serviceId = String(req.params.serviceId || "pharmacy-first");
    res.json({
      ok: true,
      workflow: getServiceAssetWorkflow(slug, serviceId),
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/asset-workflow/:slug/:serviceId/confirm-brand", (req, res) => {
  try {
    const slug = tenantFromParams(req, res);
    if (!slug) return;
    const serviceId = String(req.params.serviceId || "pharmacy-first");
    const workflow = confirmBrandAndImages(slug, serviceId);
    refreshPlatformAfterEnhancementComplete(slug);
    res.json({
      ok: true,
      workflow,
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/asset-workflow/:slug/:serviceId/mark-reviewed", (req, res) => {
  try {
    const slug = tenantFromParams(req, res);
    if (!slug) return;
    const serviceId = String(req.params.serviceId || "pharmacy-first");
    const workflow = markContentReviewed(slug, serviceId);
    refreshPlatformAfterEnhancementComplete(slug);
    res.json({
      ok: true,
      workflow,
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/asset-workflow/:slug/:serviceId/approve", (req, res) => {
  try {
    const slug = tenantFromParams(req, res);
    if (!slug) return;
    const serviceId = String(req.params.serviceId || "pharmacy-first");
    const workflow = approveServiceAsset(slug, serviceId);
    refreshPlatformAfterEnhancementComplete(slug);
    res.json({
      ok: true,
      workflow,
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
