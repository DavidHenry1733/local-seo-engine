/**
 * Pharmacy Campaign Creation V1 — JSON API.
 */
import { Router } from "express";
import {
  archivePharmacyCampaign,
  buildCampaignCreationSummary,
  buildPharmacyCampaignDashboard,
  CAMPAIGN_GOALS,
  createPharmacyCampaign,
  getPharmacyCampaignStatus,
  readPharmacyCampaignStore,
  regeneratePharmacyCampaignPage,
  type CampaignGoal,
} from "../../../../../src/pharmacy/pharmacyCampaignService.ts";

const router = Router();

function safeSlug(v: string): string {
  return (
    String(v || "pharmaconnect")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") || "pharmaconnect"
  );
}

function parseGoal(v: unknown): CampaignGoal {
  const goal = String(v || "").trim() as CampaignGoal;
  if (!CAMPAIGN_GOALS.includes(goal)) {
    throw new Error(`Invalid campaign goal. Expected one of: ${CAMPAIGN_GOALS.join(", ")}`);
  }
  return goal;
}

router.get("/pharmacy-campaigns/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const dashboard = buildPharmacyCampaignDashboard(slug);
    const status = getPharmacyCampaignStatus(slug);
    res.json({
      ok: true,
      slug,
      dashboard,
      store: readPharmacyCampaignStore(slug),
      status,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pharmacy-campaigns/:slug/preview/:serviceId", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const serviceId = String(req.params.serviceId || "");
  const goal = req.query.goal ? parseGoal(req.query.goal) : null;
  try {
    const summary = buildCampaignCreationSummary(slug, serviceId, goal);
    res.json({ ok: true, slug, serviceId, summary });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-campaigns/:slug/create", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = String(req.body?.serviceId || req.query.serviceId || "");
    const campaignGoal = parseGoal(req.body?.campaignGoal ?? req.query.campaignGoal);
    const areaSource = req.body?.areaSource === "custom" ? "custom" : "profile";
    const campaignAreas = Array.isArray(req.body?.campaignAreas) ? req.body.campaignAreas : undefined;
    const result = createPharmacyCampaign(slug, { serviceId, campaignGoal, areaSource, campaignAreas });
    res.json({
      ok: true,
      slug,
      storePath: result.storePath,
      campaign: result.campaign,
      dashboard: buildPharmacyCampaignDashboard(slug),
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-campaigns/:slug/regenerate/:campaignId", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "");
  try {
    const result = regeneratePharmacyCampaignPage(slug, campaignId);
    res.json({
      ok: true,
      slug,
      campaignId,
      ...result,
      dashboard: buildPharmacyCampaignDashboard(slug),
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-campaigns/:slug/archive/:campaignId", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const campaignId = String(req.params.campaignId || "");
  try {
    const store = archivePharmacyCampaign(slug, campaignId);
    res.json({
      ok: true,
      slug,
      campaignId,
      store,
      dashboard: buildPharmacyCampaignDashboard(slug),
    });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

export default router;
