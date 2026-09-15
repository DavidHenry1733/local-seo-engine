/**
 * Review Centre V2 — HTML route + campaign-builder review redirect.
 */
import { Router } from "express";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { loadCampaignBuilderSession } from "../../../../src/pharmacy/growthEngineCampaignBuilderService.ts";
import { renderReviewCentrePage } from "../../../../src/pharmacy/growthEngineReviewCentrePage.ts";
import { preserveAuthHandoffQuery } from "../../../../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";
import { reviewCentreUrl } from "../../../../src/pharmacy/growthEngineReviewCentreService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

/** Redirect legacy campaign-builder review step to Review Centre without modifying Campaign Builder. */
router.get("/growth-engine/campaign-builder", (req, res, next) => {
  if (String(req.query.step || "") !== "review") return next();
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const session = loadCampaignBuilderSession(slug);
  const campaign = String(req.query.campaign || session.selectedServiceId || "");
  if (!campaign) return next();
  res.redirect(302, preserveAuthHandoffQuery(req.query as Record<string, unknown>, reviewCentreUrl(slug, campaign)));
});

router.get("/growth-engine/review-centre", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const campaign = String(req.query.campaign || req.query.campaignId || "");
  const unmetCondition = String(req.query.unmet || req.query.approvalUnmet || "").trim();
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderReviewCentrePage(slug, campaign || null, unmetCondition ? { unmetCondition } : {}));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Review Centre error: ${esc(String(err))}</pre>`);
  }
});

export default router;
