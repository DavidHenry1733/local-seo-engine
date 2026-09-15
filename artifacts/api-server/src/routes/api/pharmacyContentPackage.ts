/**
 * Content Package API — generate, review, approve.
 */
import { Router } from "express";
import {
  approveContentPackage,
  contentPackageGenerated,
  loadContentPackage,
  loadGenerationReport,
  markContentPackageReviewed,
} from "../../../../../src/pharmacy/pharmacyContentPackageService.ts";
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

router.get("/pharmacy/content-package/:slug/:serviceId", (req, res) => {
  const slug = tenantFromParams(req, res);
  if (!slug) return;
  const serviceId = String(req.params.serviceId || "pharmacy-first");
  const manifest = loadContentPackage(slug, serviceId);
  res.json({
    ok: true,
    exists: Boolean(manifest?.generatedAt),
    manifest,
    operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
  });
});

router.post("/pharmacy/content-package/:slug/:serviceId/generate", async (req, res) => {
  const slug = tenantFromParams(req, res);
  if (!slug) return;
  const serviceId = String(req.params.serviceId || "pharmacy-first");
  const builderUrl = `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=approval&campaign=${encodeURIComponent(serviceId)}`;
  const wantsJson = req.headers.accept?.includes("application/json");
  if (wantsJson) {
    res.status(409).json({
      ok: false,
      error: "Campaign generation must run through the Campaign Builder wizard.",
      redirectUrl: builderUrl,
    });
    return;
  }
  res.redirect(302, builderUrl);
});

router.post("/pharmacy/content-package/:slug/:serviceId/mark-reviewed", (req, res) => {
  const slug = tenantFromParams(req, res);
  if (!slug) return;
  const serviceId = String(req.params.serviceId || "pharmacy-first");
  try {
    if (!contentPackageGenerated(slug, serviceId)) {
      res.status(400).json({ ok: false, error: "Content package has not been created yet." });
      return;
    }
    const manifest = markContentPackageReviewed(slug, serviceId);
    refreshPlatformAfterEnhancementComplete(slug);
    res.json({
      ok: true,
      manifest,
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/content-package/:slug/:serviceId/approve", (req, res) => {
  const slug = tenantFromParams(req, res);
  if (!slug) return;
  const serviceId = String(req.params.serviceId || "pharmacy-first");
  try {
    if (!contentPackageGenerated(slug, serviceId)) {
      res.status(400).json({ ok: false, error: "Content package has not been created yet." });
      return;
    }
    const manifest = approveContentPackage(slug, serviceId, String(req.body?.approvedBy || "pharmacy-user"));
    refreshPlatformAfterEnhancementComplete(slug);
    res.json({
      ok: true,
      manifest,
      operatingSystem: buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId }),
    });
  } catch (err) {
    const msg = String(err);
    const friendly = msg.includes("needs fixing") ? msg : "We could not approve this content package.";
    res.status(400).json({ ok: false, error: friendly });
  }
});

export default router;
