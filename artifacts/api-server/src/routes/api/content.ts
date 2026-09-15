/**
 * content.ts — Content Engine Phase 2 workflow API
 *
 * GET  /api/content/campaigns?slug=
 * GET  /api/content/:campaignId?slug=
 * GET  /api/content/:campaignId/:assetId?slug=
 * POST /api/content/:campaignId/:assetId/review?slug=
 * POST /api/content/:campaignId/:assetId/approve?slug=
 * POST /api/content/:campaignId/:assetId/reject?slug=
 * POST /api/content/:campaignId/:assetId/publish?slug=
 * POST /api/content/:campaignId/:assetId/save?slug=
 */

import { Router, type Request, type Response } from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  approveAsset,
  buildAssetPreview,
  listCampaignAssets,
  listContentCampaigns,
  loadAsset,
  loadCampaignManifest,
  publishAsset,
  rejectAsset,
  reviewAsset,
  saveAsset,
} from "../../../../../src/content-engine/contentWorkflow.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

function projectSlug(req: Request): string {
  const slug = (req.query.slug as string) || (req.body?.slug as string) || "";
  if (!slug) throw new Error("Missing required query parameter: slug");
  return slug;
}

function editorId(req: Request): string {
  return req.session?.username ?? req.session?.userName ?? "dashboard-user";
}

function sendError(res: Response, err: unknown, status = 400): void {
  const message = err instanceof Error ? err.message : String(err);
  res.status(status).json({ ok: false, error: message });
}

router.get("/content/campaigns", (req, res) => {
  try {
    const slug = projectSlug(req);
    const campaigns = listContentCampaigns(slug);
    res.json({ ok: true, projectSlug: slug, campaigns });
  } catch (err) {
    sendError(res, err);
  }
});

router.get("/content/:campaignId/:assetId", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const { asset } = loadAsset(slug, campaignId, assetId);
    const preview = buildAssetPreview(asset);
    res.json({ ok: true, asset, preview });
  } catch (err) {
    sendError(res, err, 404);
  }
});

router.get("/content/:campaignId", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId } = req.params;
    const { manifest } = loadCampaignManifest(slug, campaignId);
    const assets = listCampaignAssets(slug, campaignId);
    res.json({ ok: true, manifest, assets });
  } catch (err) {
    sendError(res, err, 404);
  }
});

router.post("/content/:campaignId/:assetId/review", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const asset = reviewAsset(slug, campaignId, assetId);
    res.json({ ok: true, asset, preview: buildAssetPreview(asset) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/content/:campaignId/:assetId/approve", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const asset = approveAsset(slug, campaignId, assetId);
    res.json({ ok: true, asset, preview: buildAssetPreview(asset) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/content/:campaignId/:assetId/reject", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const asset = rejectAsset(slug, campaignId, assetId);
    res.json({ ok: true, asset, preview: buildAssetPreview(asset) });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/content/:campaignId/:assetId/publish", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const result = publishAsset(slug, campaignId, assetId);
    res.json({
      ok: true,
      asset: result.asset,
      exportPaths: result.exportPaths,
      preview: buildAssetPreview(result.asset),
    });
  } catch (err) {
    sendError(res, err);
  }
});

router.post("/content/:campaignId/:assetId/save", (req, res) => {
  try {
    const slug = projectSlug(req);
    const { campaignId, assetId } = req.params;
    const { payload } = req.body as { payload?: Record<string, unknown> };
    if (!payload || typeof payload !== "object") {
      res.status(400).json({ ok: false, error: "Missing payload object" });
      return;
    }
    const asset = saveAsset(slug, campaignId, assetId, {
      payload,
      editedBy: editorId(req),
    });
    res.json({ ok: true, asset, preview: buildAssetPreview(asset) });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
