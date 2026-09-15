/**
 * Pharmacy Campaign Launch Queue V1 — JSON API.
 */
import { Router } from "express";
import {
  getPharmacyCampaignLaunchQueuePath,
  readPharmacyCampaignLaunchQueue,
  refreshPharmacyCampaignLaunchQueue,
  updateLaunchTaskStatus,
  type LaunchTaskStatus,
} from "../../../../../src/pharmacy/pharmacyCampaignLaunchQueueService.ts";

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

function parseStatus(v: unknown): LaunchTaskStatus {
  const s = String(v || "pending").toLowerCase();
  if (s === "pending" || s === "in_progress" || s === "complete" || s === "blocked") return s;
  throw new Error(`Invalid status: ${v}`);
}

router.get("/pharmacy-campaign-launch-queue/:slug", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const store = readPharmacyCampaignLaunchQueue(slug) || refreshPharmacyCampaignLaunchQueue(slug).store;
    res.json({
      ok: true,
      slug,
      store,
      storePath: getPharmacyCampaignLaunchQueuePath(slug),
    });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-campaign-launch-queue/:slug/refresh", (req, res) => {
  const slug = safeSlug(req.params.slug);
  try {
    const result = refreshPharmacyCampaignLaunchQueue(slug);
    res.json({ ok: true, slug, store: result.store, storePath: result.storePath });
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) });
  }
});

router.post("/pharmacy-campaign-launch-queue/:slug/:taskId/status", (req, res) => {
  const slug = safeSlug(req.params.slug);
  const taskId = String(req.params.taskId || "");
  try {
    const status = parseStatus(req.body?.status ?? req.query.status);
    const store = updateLaunchTaskStatus(slug, taskId, status);
    res.json({ ok: true, slug, taskId, status, store });
  } catch (err) {
    res.status(400).json({ ok: false, error: String(err) });
  }
});

export default router;
