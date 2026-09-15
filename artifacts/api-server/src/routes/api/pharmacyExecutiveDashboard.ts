import { Router } from "express";
import {
  buildExecutiveDashboard,
  writeExecutiveDashboardJson,
} from "../../../../../src/pharmacy/pharmacyExecutiveDashboardService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

router.get("/pharmacy-executive-dashboard/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const jsonPath = writeExecutiveDashboardJson(slug);
    const dashboard = buildExecutiveDashboard(slug);
    res.json({ ok: true, slug, jsonPath, dashboard });
  } catch (err) {
    res.status(500).json({ ok: false, slug, error: String(err) });
  }
});

router.get("/pharmacy-executive-dashboard/:slug/summary", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const dashboard = buildExecutiveDashboard(slug);
    res.json({
      ok: true,
      slug,
      executiveSummary: dashboard.executiveSummary,
      actionPlan: dashboard.actionPlan,
      growthScore: dashboard.growthScore.score,
      competitorPosition: dashboard.competitorPosition.label,
      growthPotential: dashboard.estimatedGrowthPotential.label,
    });
  } catch (err) {
    res.status(500).json({ ok: false, slug, error: String(err) });
  }
});

export default router;
