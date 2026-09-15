/**
 * Token-free GET for the accepted Brook Pharmacy First service-page Preview.
 * Mounted before requireAuth so published demonstration links can open it.
 * Remains noindex and is not a clinical or campaign approval.
 */
import { Router } from "express";
import { isPublicAcceptedPharmacyFirstPreviewGet } from "../../../../src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts";
import { handleReviewCentrePreviewRequest } from "./api/growthEngineReviewCentre.ts";

const router = Router();

router.get("/growth-engine/brook-pharmacy-demo-derby/review-preview", (req, res, next) => {
  const raw = String(req.originalUrl || req.url || "");
  const params = raw.includes("?") ? new URLSearchParams(raw.slice(raw.indexOf("?") + 1)) : new URLSearchParams();
  const query = {
    ...(req.query as Record<string, unknown>),
    campaign: req.query.campaign || params.get("campaign") || params.get("campaignId"),
    asset: req.query.asset || params.get("asset") || params.get("assetKey"),
    area: req.query.area || params.get("area") || params.get("areaSlug"),
  };
  if (
    !isPublicAcceptedPharmacyFirstPreviewGet({
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      url: req.url,
      query,
    })
  ) {
    return next();
  }
  req.params = { ...req.params, slug: "brook-pharmacy-demo-derby" };
  return handleReviewCentrePreviewRequest(req, res);
});

export default router;
