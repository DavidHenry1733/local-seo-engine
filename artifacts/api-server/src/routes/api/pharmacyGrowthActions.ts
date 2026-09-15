/**
 * Pharmacy Growth Action Plan V1 — JSON API.
 */
import { Router } from "express";
import {
  getPharmacyGrowthActionPlanStatus,
  readPharmacyGrowthActionPlan,
  refreshPharmacyGrowthActionPlan,
  updateGrowthActionStatus,
  type GrowthActionStatus,
} from "../../../../../src/pharmacy/pharmacyGrowthActionPlanService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function parseStatus(v: unknown): GrowthActionStatus {
  const s = String(v || "pending").toLowerCase();
  if (s === "in_progress" || s === "complete" || s === "deferred" || s === "pending") return s;
  throw new Error(`Invalid status: ${v}`);
}

router.get("/pharmacy-growth-actions/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const status = getPharmacyGrowthActionPlanStatus(slug);
    res.json({
      ok: true,
      slug,
      plan: status.plan,
      planPath: status.planPath,
      planExists: status.planExists,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-growth-actions/:slug/refresh", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = refreshPharmacyGrowthActionPlan(slug);
    res.json({
      ok: true,
      slug,
      planPath: result.planPath,
      plan: result.plan,
      summary: readPharmacyGrowthActionPlan(slug),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-growth-actions/:slug/:actionId/status", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const actionId = String(req.params.actionId || "");
  try {
    const status = parseStatus(req.body?.status ?? req.query.status);
    const plan = updateGrowthActionStatus(slug, actionId, status);
    res.json({ ok: true, slug, actionId, status, plan });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
