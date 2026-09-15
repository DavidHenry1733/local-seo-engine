/**
 * Growth Engine Framework V1 — HTML routes.
 */
import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { normalizeProfileDoc } from "../../../../src/pharmacy/pharmacyProfileSchema.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { loadCompetitorSnapshot } from "../../../../src/pharmacy/growthEngineLocalMarketService.ts";
import { buildGrowthPlanRecommendation } from "../../../../src/pharmacy/growthEngineFrameworkService.ts";
import { saveAuthoritativeCampaignPriority } from "../../../../src/pharmacy/growthEngineGrowthPlanResolver.ts";
import {
  renderGrowthEngineHubPage,
  renderBusinessIntelligencePage,
  renderLocalMarketPage,
  renderWebsiteIntelligencePage,
  renderGrowthIntelligencePage,
  renderGrowthPlanPage,
  renderGeneratePage,
  renderGrowthEngineDashboardPage,
  renderSearchIntelligencePage,
} from "../../../../src/pharmacy/growthEnginePageRenderers.ts";
import { renderLiveIntegrationProofPage } from "../../../../src/pharmacy/growthEngineLiveIntegrationProofPage.ts";
import {
  buildLiveIntegrationProofReport,
  runLiveIntegrationProof,
} from "../../../../src/pharmacy/growthEngineLiveIntegrationProofService.ts";
import { renderCustomerSetupStartPage } from "../../../../src/pharmacy/growthEngineCustomerSetupStartPage.ts";
import { renderCustomerSetupConfirmPage } from "../../../../src/pharmacy/growthEngineCustomerSetupConfirmPage.ts";
import { renderCustomerBrandReviewPage } from "../../../../src/pharmacy/growthEngineCustomerBrandReviewPage.ts";

const router = Router();
const ROOT = process.env.WORKSPACE_ROOT ?? "/home/inboxingproweb/pharmaconnect-growth-engine";
const PROFILE_DIR = path.join(ROOT, "data/pharmacy-profiles");

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function loadProfile(slug: string) {
  const file = path.join(PROFILE_DIR, `${slug}.json`);
  if (!fs.existsSync(file)) return normalizeProfileDoc(slug, { data: {} }).data;
  return normalizeProfileDoc(slug, JSON.parse(fs.readFileSync(file, "utf8"))).data;
}

router.get("/growth-engine", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderGrowthEngineHubPage(slug));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Growth Engine error: ${esc(String(err))}</pre>`);
  }
});

router.get("/growth-engine/business-intelligence", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.type("html").send(renderBusinessIntelligencePage(slug, loadProfile(slug)));
});

router.get("/growth-engine/local-market", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderLocalMarketPage(slug, loadCompetitorSnapshot(slug)));
});

router.get("/growth-engine/search-intelligence", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderSearchIntelligencePage(slug));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Search Intelligence error: ${esc(String(err))}</pre>`);
  }
});

router.get("/growth-engine/website-intelligence", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.type("html").send(renderWebsiteIntelligencePage(slug));
});

router.get("/growth-engine/growth-intelligence", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.type("html").send(renderGrowthIntelligencePage(slug, loadCompetitorSnapshot(slug)));
});

router.get("/growth-engine/growth-plan", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.type("html").send(renderGrowthPlanPage(slug, buildGrowthPlanRecommendation(slug)));
});

router.post("/growth-engine/growth-plan", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const serviceId = String((req.body as { serviceId?: string } | undefined)?.serviceId || "");
  const saved = saveAuthoritativeCampaignPriority(slug, serviceId);
  if (!saved.ok) {
    res.status(400).type("html").send(renderGrowthPlanPage(slug, buildGrowthPlanRecommendation(slug), { selectionError: saved.error }));
    return;
  }
  res.redirect(303, `/api/growth-engine/growth-plan?slug=${encodeURIComponent(slug)}`);
});

router.get("/growth-engine/generate", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.type("html").send(renderGeneratePage(slug, buildGrowthPlanRecommendation(slug)));
});

router.get("/growth-engine/start", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderCustomerSetupStartPage(slug));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Setup start error: ${esc(String(err))}</pre>`);
  }
});

router.get("/growth-engine/confirm-pharmacy", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderCustomerSetupConfirmPage(slug));
});

router.get("/growth-engine/brand-review", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  res.setHeader("Cache-Control", "no-store");
  res.type("html").send(renderCustomerBrandReviewPage(slug));
});

router.get("/growth-engine/dashboard", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const section = String(req.query.section || "overview");
  const approvedCampaignId = String(req.query.approved || req.query.campaignApproved || "").trim();
  res.type("html").send(
    renderGrowthEngineDashboardPage(slug, section, approvedCampaignId ? { approvedCampaignId } : {}),
  );
});

router.get("/growth-engine/live-integration-proof", async (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    const report = await buildLiveIntegrationProofReport(slug);
    res.type("html").send(renderLiveIntegrationProofPage(slug, report));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Live integration proof error: ${esc(String(err))}</pre>`);
  }
});

export default router;
