/**
 * PharmaConnect Authority Enhancement Engine V1 — JSON API.
 */
import { Router } from "express";
import {
  buildAuthorityEnhancementDashboard,
  loadPharmacyAuthorityEnhancement,
  refreshPharmacyAuthorityEnhancement,
} from "../../../../../src/pharmacy/pharmacyAuthorityEnhancementService.ts";

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

router.get("/pharmacy-authority-enhancements/:slug", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = req.query.service ? String(req.query.service) : undefined;
    const category = req.query.category ? String(req.query.category) : undefined;
    const difficulty = req.query.difficulty ? String(req.query.difficulty) : undefined;
    const impact = req.query.impact ? String(req.query.impact) : undefined;
    const doc = loadPharmacyAuthorityEnhancement(slug) || refreshPharmacyAuthorityEnhancement(slug);
    res.json({
      ok: true,
      doc,
      dashboard: buildAuthorityEnhancementDashboard(slug, { serviceId, category, difficulty, impact }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-authority-enhancements/:slug/refresh", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const doc = refreshPharmacyAuthorityEnhancement(slug);
    res.json({ ok: true, doc, refreshedAt: doc.updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
