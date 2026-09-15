/**
 * Pharmacy Indexing Bridge V1 — JSON API.
 * REGISTER is internal registry only. SUBMIT is a separate explicit action.
 * Neither endpoint is invoked against Google from this route automatically.
 */
import { Router } from "express";
import {
  getPharmacyIndexingBridgeStatus,
  readIndexingWorkflowState,
  readPharmacyIndexingSummary,
  readPharmacyRegistry,
  refreshPharmacyIndexingStatus,
  registerPharmacyPages,
} from "../../../../../src/pharmacy/pharmacyIndexingBridgeService.ts";
import { readActiveServiceCampaignSelection } from "../../../../../src/pharmacy/masterAdminActiveServiceCampaignStore.ts";

const router = Router();

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function resolveServiceId(slug: string, req: { body?: { serviceId?: string }; query?: { service?: string; serviceId?: string } }): string {
  const selection = readActiveServiceCampaignSelection(slug);
  return String(req.body?.serviceId || req.query?.serviceId || req.query?.service || selection?.serviceId || "").trim();
}

router.get("/pharmacy-indexing/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = resolveServiceId(slug, req);
    const status = getPharmacyIndexingBridgeStatus(slug, serviceId);
    const workflow = readIndexingWorkflowState(slug, serviceId);
    res.json({
      ok: true,
      slug,
      serviceId: workflow.serviceId,
      workflow,
      registry: status.registry,
      summary: status.summary,
      sitemapExists: status.sitemapExists,
      sitemapPath: status.sitemapPath,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-indexing/:slug/register", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = resolveServiceId(slug, req);
    if (!serviceId) {
      res.status(400).json({ ok: false, error: "serviceId required for indexing registration" });
      return;
    }
    const result = await registerPharmacyPages(slug, { serviceId, fetchLive: true });
    res.json({
      ok: true,
      slug,
      serviceId,
      registered: result.registered,
      registerable: result.workflow.registerableCount,
      skipped: result.skipped,
      registryPath: result.registryPath,
      sitemapPath: result.sitemapPath,
      summaryPath: result.summaryPath,
      summary: readPharmacyIndexingSummary(slug, serviceId),
      pages: result.pages,
      workflow: result.workflow,
      externalIndexingRequested: false,
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err), externalIndexingRequested: false });
  }
});

router.post("/pharmacy-indexing/:slug/submit", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = resolveServiceId(slug, req);
    if (!serviceId) {
      res.status(400).json({ ok: false, error: "serviceId required for technical SEO index gate" });
      return;
    }
    const { runPharmacyExternalIndexingSubmission } = await import(
      "../../../../../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts"
    );
    const mode = String(req.body?.mode || "dry-run") === "live" ? "live" : "dry-run";
    const confirmExternal = req.body?.confirmExternal === true;
    const result = await runPharmacyExternalIndexingSubmission({
      slug,
      serviceId,
      mode,
      confirmExternal,
      fetchLive: true,
      persist: false,
    });
    res.json({
      ok: result.ok,
      slug,
      submitted: result.submittedCount,
      mode: result.mode,
      confirmExternal: result.confirmExternal,
      requiresConfirmation: result.mode !== "live" || result.confirmExternal !== true,
      googleRequests: result.googleRequests,
      externalIndexingRequested: result.externalIndexingRequested,
      persisted: result.persisted,
      preflight: result.preflight,
      summary: readPharmacyIndexingSummary(slug, serviceId),
      registry: readPharmacyRegistry(slug),
      workflow: readIndexingWorkflowState(slug, serviceId),
      error: result.error,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message, indexingSubmitted: false, externalIndexingRequested: false, googleRequests: 0 });
  }
});

router.post("/pharmacy-indexing/:slug/search-console-authority", async (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = resolveServiceId(slug, req);
    if (!serviceId) {
      res.status(400).json({ ok: false, error: "serviceId required for Search Console property verification" });
      return;
    }
    const { resolvePharmacySearchConsoleProperty } = await import(
      "../../../../../src/pharmacy/pharmacyExternalIndexingSubmissionService.ts"
    );
    const { verifyPharmacySearchConsoleWriteAuthority } = await import(
      "../../../../../src/pharmacy/pharmacySearchConsoleWriteAuthorityService.ts"
    );
    const property = resolvePharmacySearchConsoleProperty(slug, serviceId);
    const authority = await verifyPharmacySearchConsoleWriteAuthority({
      slug,
      requestedProperty: property.property,
      customerWebsite: property.rejectedCustomerWebsite,
      liveGoogle: req.body?.liveGoogle !== false,
      persist: true,
    });
    res.json({
      ok: true,
      slug,
      serviceId,
      sitemapSubmitted: false,
      urlsSubmitted: 0,
      indexingApiUsed: false,
      googleCalls: authority.liveGoogleCalls,
      authority,
      summary: readPharmacyIndexingSummary(slug, serviceId),
      workflow: readIndexingWorkflowState(slug, serviceId),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message, sitemapSubmitted: false, urlsSubmitted: 0, indexingApiUsed: false });
  }
});

router.post("/pharmacy-indexing/:slug/refresh", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const serviceId = resolveServiceId(slug, req);
    const result = refreshPharmacyIndexingStatus(slug, { serviceId });
    res.json({
      ok: true,
      slug,
      checked: result.checked,
      summary: result.summary,
      registry: readPharmacyRegistry(slug),
      workflow: readIndexingWorkflowState(slug, serviceId),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
