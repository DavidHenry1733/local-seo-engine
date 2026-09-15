/**
 * Publishing Settings JSON API.
 */
import { Router } from "express";
import {
  getServicePublishingSettings,
  loadPharmacyPublishingSettings,
  saveServicePublishingSettings,
} from "../../../../../src/pharmacy/pharmacyPublishingSettingsService.ts";
import { refreshPlatformAfterEnhancementComplete } from "../../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { getServiceAuthorityAudit } from "../../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";

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

router.get("/pharmacy/publishing-settings/:slug", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = req.query.service ? String(req.query.service) : undefined;
    const doc = loadPharmacyPublishingSettings(slug);
    if (serviceId) {
      res.json({ ok: true, slug, serviceId, settings: getServicePublishingSettings(slug, serviceId), doc });
      return;
    }
    res.json({ ok: true, slug, doc });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.get("/pharmacy/publishing-settings/:slug/:serviceId", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = String(req.params.serviceId);
    const settings = getServicePublishingSettings(slug, serviceId);
    const audit = getServiceAuthorityAudit(slug, serviceId);
    res.json({ ok: true, slug, serviceId, settings, audit });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy/publishing-settings/:slug/:serviceId", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const serviceId = String(req.params.serviceId);
    const body = req.body || {};
    const settings = saveServicePublishingSettings(slug, serviceId, {
      canonicalUrl: body.canonicalUrl !== undefined ? String(body.canonicalUrl) : undefined,
      noindex: typeof body.noindex === "boolean" ? body.noindex : body.noindex === "true" || body.noindex === true,
      structuredDataEnabled:
        typeof body.structuredDataEnabled === "boolean"
          ? body.structuredDataEnabled
          : body.structuredDataEnabled === "true",
    });
    const refresh = refreshPlatformAfterEnhancementComplete(slug);
    const audit = getServiceAuthorityAudit(slug, serviceId);
    res.json({ ok: true, slug, serviceId, settings, audit, refresh });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
