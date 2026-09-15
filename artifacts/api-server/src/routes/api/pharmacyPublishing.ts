import { Router } from "express";
import {
  buildPharmacyPublishingFoundation,
  getPharmacyPublishingStatus,
} from "../../../../../src/pharmacy/pharmacyPublishingFoundationService.ts";
import {
  generatePharmacyPublishOutput,
  getPharmacyPublishOutputStatus,
} from "../../../../../src/pharmacy/pharmacyPublishOutputService.ts";
import {
  deployPharmacyPublishOutput,
  getPharmacyLivePublishStatus,
  preparePharmacyPublishOutput,
  resolvePreparePublishContext,
  safeFtpConnectionTest,
} from "../../../../../src/pharmacy/pharmacyLivePublishService.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { normalizeServiceId } from "../../../../../src/pharmacy/pharmacyServiceLibraryService.ts";

const router = Router();

function safeSlug(v: string) {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function resolveSlug(v: string): string {
  return resolveTenantProfileSlug(v) || safeSlug(v);
}

function resolveServiceId(v: string): string {
  return normalizeServiceId(String(v || "blood-pressure-checks"));
}

router.get("/pharmacy-publishing/status", (req, res) => {
  const slug = resolveSlug(String(req.query.slug || "pharmaconnect"));
  res.json(getPharmacyPublishingStatus(slug));
});

router.get("/pharmacy-publishing/:slug/live-status", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  res.json({ ok: true, status: getPharmacyLivePublishStatus(slug), output: getPharmacyPublishOutputStatus(slug) });
});

router.post("/pharmacy-publishing/:slug/build", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  try {
    const result = buildPharmacyPublishingFoundation(slug);
    res.json({
      ok: true,
      slug,
      registryPath: result.registryPath,
      sitemapPath: result.sitemapPath,
      manifestPath: result.manifestPath,
      sitemapUrlCount: result.sitemapUrlCount,
      summary: result.manifest.summary,
      status: getPharmacyPublishingStatus(slug),
    });
  } catch (err: any) {
    res.status(500).json({ ok: false, error: err?.message || "Publishing build failed" });
  }
});

router.post("/pharmacy-publishing/:slug/prepare", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  const serviceId = resolveServiceId(String(req.body?.serviceId || req.query.service || "blood-pressure-checks"));
  try {
    const result = await preparePharmacyPublishOutput(slug, serviceId);
    res.json({ ok: true, ...result });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/pharmacy-publishing/:slug/generate-output", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  try {
    const result = generatePharmacyPublishOutput(slug);
    res.json({ ok: true, result });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/pharmacy-publishing/:slug/ftp-test", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  try {
    const result = await safeFtpConnectionTest(slug);
    res.json({ ok: result.ok, result, status: getPharmacyLivePublishStatus(slug) });
  } catch (err: unknown) {
    res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/pharmacy-publishing/:slug/publish", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  const confirm = req.body?.confirm === true || req.query.confirm === "1";
  const serviceId = req.body?.serviceId ? resolveServiceId(String(req.body.serviceId)) : undefined;
  try {
    const result = await deployPharmacyPublishOutput(slug, { confirm, serviceId });
    res.json({ ok: true, result, status: getPharmacyLivePublishStatus(slug) });
  } catch (err: unknown) {
    res.status(400).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export default router;
