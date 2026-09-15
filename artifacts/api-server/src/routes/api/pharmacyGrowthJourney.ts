/**
 * Pharmacy Growth Journey Dashboard V1 — JSON API.
 */
import { Router } from "express";
import {
  buildGrowthJourneyDashboard,
  writeGrowthJourneyDashboardJson,
} from "../../../../../src/pharmacy/pharmacyGrowthJourneyService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

router.get("/pharmacy-growth-journey/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const outputPath = writeGrowthJourneyDashboardJson(slug);
    const dash = buildGrowthJourneyDashboard(slug);
    res.json({ ok: true, outputPath, dashboard: dash });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pharmacy-growth-journey/:slug/summary", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const dash = buildGrowthJourneyDashboard(slug);
    res.json({
      ok: true,
      slug,
      growthScore: dash.growthScore,
      roadmap: dash.roadmap,
      executiveActions: dash.executiveSummary.actions,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
