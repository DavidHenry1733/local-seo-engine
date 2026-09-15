/**
 * PharmaConnect Enhancement Workspace V1 — JSON API.
 */
import { Router } from "express";
import {
  buildEnhancementWorkspaceView,
  loadEnhancementWorkspaceStore,
  markEnhancementTaskComplete,
  updateEnhancementTaskStatus,
  EnhancementCompletionError,
  type EnhancementTaskStatus,
} from "../../../../../src/pharmacy/pharmacyEnhancementWorkspaceService.ts";
import { loadPharmacyAuthorityEnhancement } from "../../../../../src/pharmacy/pharmacyAuthorityEnhancementService.ts";
import { resolveCampaignImprovementsServiceForTenant } from "../../../../../src/pharmacy/pharmacyCampaignImprovementsServiceAuthority.ts";

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

router.get("/pharmacy-enhancement-workspace/:slug", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const requested = req.query.service ? String(req.query.service) : undefined;
    const serviceId = resolveCampaignImprovementsServiceForTenant(slug, requested).resolvedServiceId || undefined;
    const store = loadEnhancementWorkspaceStore(slug);
    const view = buildEnhancementWorkspaceView(slug, { serviceId });
    const doc = loadPharmacyAuthorityEnhancement(slug);
    res.json({ ok: true, store, view, enhancementDoc: doc });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-enhancement-workspace/:slug/tasks/:recommendationId/status", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const recommendationId = String(req.params.recommendationId);
    const status = String(req.body?.status || "ready") as EnhancementTaskStatus;
    const allowed: EnhancementTaskStatus[] = ["ready", "in_progress", "completed", "deferred"];
    if (!allowed.includes(status)) {
      res.status(400).json({ ok: false, error: "Invalid status" });
      return;
    }
    const result = updateEnhancementTaskStatus(slug, recommendationId, status, {
      completedBy: req.body?.completedBy ? String(req.body.completedBy) : undefined,
      notes: req.body?.notes ? String(req.body.notes) : undefined,
      serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
    });
    res.json({ ok: true, ...result, testMode: result.store.tasks.find((t) => t.recommendationId === recommendationId)?.testMode ?? false });
  } catch (err) {
    if (err instanceof EnhancementCompletionError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-enhancement-workspace/:slug/tasks/:recommendationId/complete", (req, res) => {
  try {
    const slug = safeSlug(req.params.slug);
    const recommendationId = String(req.params.recommendationId);
    const result = markEnhancementTaskComplete(slug, recommendationId, {
      completedBy: req.body?.completedBy ? String(req.body.completedBy) : "pharmacy-owner",
      notes: req.body?.notes ? String(req.body.notes) : undefined,
      serviceId: req.body?.serviceId ? String(req.body.serviceId) : undefined,
    });
    const task = result.store.tasks.find((t) => t.recommendationId === recommendationId);
    const testMode = task?.testMode ?? false;
    res.json({
      ok: true,
      ...result,
      testMode,
      message: testMode
        ? "Test mode — workspace updated, platform refreshed, no content modified."
        : "Real action verified — task completed and platform refreshed.",
    });
  } catch (err) {
    if (err instanceof EnhancementCompletionError) {
      res.status(400).json({ ok: false, error: err.message });
      return;
    }
    res.status(500).json({ ok: false, error: String(err) });
  }
});

export default router;
