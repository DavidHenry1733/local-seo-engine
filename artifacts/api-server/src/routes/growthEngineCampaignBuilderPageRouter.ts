/**
 * Campaign Builder V1 — HTML routes (GET wizard).
 */
import { Router } from "express";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { renderCampaignBuilderPage } from "../../../../src/pharmacy/growthEngineCampaignBuilderPage.ts";
import { applyCampaignBuilderWizardQuery } from "../../../../src/pharmacy/growthEngineCampaignBuilderRoutingService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

router.get("/growth-engine/campaign-builder", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;

  const step = applyCampaignBuilderWizardQuery(slug, req.query as Record<string, unknown>);
  const area = String((req.query as Record<string, unknown>)?.area || "").trim();
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderCampaignBuilderPage(slug, step, { area }));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Campaign Builder error: ${esc(String(err))}</pre>`);
  }
});

export default router;
