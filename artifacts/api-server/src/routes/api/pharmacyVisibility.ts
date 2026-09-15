/**
 * Pharmacy Visibility Tracking Bridge V1 — JSON API.
 */
import { Router } from "express";
import {
  getPharmacyVisibilityStatus,
  readPharmacyVisibilityReport,
  refreshPharmacyVisibility,
} from "../../../../../src/pharmacy/pharmacyVisibilityBridgeService.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

router.get("/pharmacy-visibility/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const status = getPharmacyVisibilityStatus(slug);
    res.json({
      ok: true,
      slug,
      report: status.report,
      reportPath: status.reportPath,
      reportExists: status.reportExists,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-visibility/:slug/refresh", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = refreshPharmacyVisibility(slug);
    res.json({
      ok: true,
      slug,
      reportPath: result.reportPath,
      report: result.report,
      summary: readPharmacyVisibilityReport(slug),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
