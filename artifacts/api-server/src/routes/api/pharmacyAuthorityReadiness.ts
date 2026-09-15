/**
 * PharmaConnect Authority & AI Readiness Engine V1 — JSON API.
 */
import { Router } from "express";
import {
  buildAuthorityReadinessDashboard,
  loadPharmacyAuthorityReadiness,
  refreshPharmacyAuthorityReadiness,
} from "../../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";

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

router.get("/pharmacy-authority-readiness/:slug", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = req.query.service ? String(req.query.service) : undefined;
    const doc = loadPharmacyAuthorityReadiness(slug) || refreshPharmacyAuthorityReadiness(slug);
    res.json({
      ok: true,
      doc,
      dashboard: buildAuthorityReadinessDashboard(slug, { serviceId }),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-authority-readiness/:slug/refresh", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const doc = refreshPharmacyAuthorityReadiness(slug);
    res.json({ ok: true, doc, refreshedAt: doc.updatedAt });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
