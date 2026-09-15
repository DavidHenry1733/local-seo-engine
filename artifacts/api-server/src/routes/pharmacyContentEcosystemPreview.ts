import { Router } from "express";
import { BENCHMARK_MASTER_SERVICE_IDS } from "../../../../src/pharmacy/pharmacyMasterPublishConfig.ts";
import {
  renderPackPreviewPage,
  renderBenchmarkEcosystemPreviewIndex,
  resolveBenchmarkPackAsset,
  resolveBenchmarkPageHtmlPath,
  renderBenchmarkPagePreviewHtml,
  sanitisePreviewPackId,
  sanitisePreviewPageSlug,
  resolvePreviewTenantSlug,
} from "../../../../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { loadContentPackage } from "../../../../src/pharmacy/pharmacyContentPackageService.ts";
import {
  isHistoricalOutputPath,
} from "../../../../src/pharmacy/pharmacyCurrentRunCampaignHandoff.ts";
import {
  previewCacheHeaders,
  resolveCurrentRunLocalityHtmlPath,
} from "../../../../src/pharmacy/pharmacyApprovedBankRunProvenance.ts";

const router = Router();

function sendHtml(
  res: import("express").Response,
  html: string,
  provenance?: { runId?: string | null; bankHash?: string | null },
): void {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  for (const [key, value] of Object.entries(previewCacheHeaders(provenance?.runId, provenance?.bankHash))) {
    res.setHeader(key, value);
  }
  res.status(200).send(html);
}

function queryParamString(raw: unknown): string | undefined {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return undefined;
}

function previewSlug(req: import("express").Request): string {
  const value =
    queryParamString(req.query.slug) ??
    queryParamString(req.query.tenant) ??
    queryParamString(req.query.customer);
  return resolvePreviewTenantSlug(value);
}

function sendIndex(res: import("express").Response, serviceId: string, slug: string): void {
  const html = renderBenchmarkEcosystemPreviewIndex(serviceId, slug);
  if (!html) {
    res.status(404).send(`Content ecosystem not found for ${serviceId} (${slug}). Run build script first.`);
    return;
  }
  sendHtml(res, html);
}

function registerServiceRoutes(serviceId: string): void {
  const base = `/pharmacy-content-ecosystem-preview/${serviceId}`;

  router.get(base, (req, res) => sendIndex(res, serviceId, previewSlug(req)));
  router.get(`${base}/`, (req, res) => sendIndex(res, serviceId, previewSlug(req)));

  router.get(`${base}/pages/:pageSlug`, (req, res) => {
    const slug = previewSlug(req);
    const pageSlug = sanitisePreviewPageSlug(req.params.pageSlug);
    if (!pageSlug) {
      res.status(400).send("Invalid page slug");
      return;
    }
    const file = resolveBenchmarkPageHtmlPath(serviceId, pageSlug, slug);
    if (!file) {
      res.status(404).send("Ecosystem page not found");
      return;
    }
    sendHtml(res, renderBenchmarkPagePreviewHtml(file, serviceId, slug, pageSlug));
  });

  router.get(`${base}/pages/:pageSlug/`, (req, res) => {
    const slug = previewSlug(req);
    const pageSlug = sanitisePreviewPageSlug(req.params.pageSlug);
    if (!pageSlug) {
      res.status(400).send("Invalid page slug");
      return;
    }
    const file = resolveBenchmarkPageHtmlPath(serviceId, pageSlug, slug);
    if (!file) {
      res.status(404).send("Ecosystem page not found");
      return;
    }
    sendHtml(res, renderBenchmarkPagePreviewHtml(file, serviceId, slug, pageSlug));
  });

  const sendLocalPage = (req: import("express").Request, res: import("express").Response): void => {
    const slug = previewSlug(req);
    const areaSlug = sanitisePreviewPageSlug(req.params.areaSlug);
    if (!areaSlug) {
      res.status(400).send("Invalid area slug");
      return;
    }
    const pkg = loadContentPackage(slug, serviceId);
    const inventoryFile = resolveCurrentRunLocalityHtmlPath(pkg?.currentRunInventory, areaSlug);
    const file =
      inventoryFile && !isHistoricalOutputPath(inventoryFile)
        ? inventoryFile
        : resolveBenchmarkPageHtmlPath(serviceId, areaSlug, slug);
    if (!file || isHistoricalOutputPath(file)) {
      res.status(404).send("Local cluster page not found");
      return;
    }
    sendHtml(res, renderBenchmarkPagePreviewHtml(file, serviceId, slug, areaSlug), {
      runId: pkg?.currentRunInventory?.runId || pkg?.generationStamp?.runId || null,
      bankHash: pkg?.currentRunInventory?.approvedBankHash || pkg?.approvedBankHash || null,
    });
  };

  router.get(`${base}/local/:areaSlug`, sendLocalPage);
  router.get(`${base}/local/:areaSlug/`, sendLocalPage);

  router.get(`${base}/packs/:packId`, (req, res) => {
    const slug = previewSlug(req);
    const packId = sanitisePreviewPackId(req.params.packId);
    if (!packId) {
      res.status(400).send("Invalid pack id");
      return;
    }
    const asset = resolveBenchmarkPackAsset(serviceId, packId, slug);
    if (!asset) {
      res.status(404).send("Content pack not found");
      return;
    }
    const html = renderPackPreviewPage(asset, serviceId, slug);
    if (!html) {
      res.status(500).send("Unable to render pack preview");
      return;
    }
    sendHtml(res, html);
  });

  router.get(`${base}/packs/:packId/`, (req, res) => {
    const slug = previewSlug(req);
    const packId = sanitisePreviewPackId(req.params.packId);
    if (!packId) {
      res.status(400).send("Invalid pack id");
      return;
    }
    const asset = resolveBenchmarkPackAsset(serviceId, packId, slug);
    if (!asset) {
      res.status(404).send("Content pack not found");
      return;
    }
    const html = renderPackPreviewPage(asset, serviceId, slug);
    if (!html) {
      res.status(500).send("Unable to render pack preview");
      return;
    }
    sendHtml(res, html);
  });
}

for (const serviceId of BENCHMARK_MASTER_SERVICE_IDS) {
  registerServiceRoutes(serviceId);
}

export default router;
