/**
 * Review Centre V2 — approve / improve JSON API.
 */
import { Router } from "express";
import {
  approveReviewCentreAsset,
  buildReviewCentreView,
  improveReviewCentreAsset,
} from "../../../../../src/pharmacy/growthEngineReviewCentreService.ts";
import { buildReviewCentreSourceDebug } from "../../../../../src/pharmacy/pharmacyContentPackageService.ts";
import { resolveTenantProfileSlug } from "../../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { renderReviewCentrePreviewAsset } from "../../../../../src/pharmacy/growthEngineReviewCentrePreviewService.ts";
import { findPreviewSourceMarker, renderMissingReviewPreview } from "../../../../../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { previewCacheHeaders } from "../../../../../src/pharmacy/pharmacyApprovedBankRunProvenance.ts";
import { applyAcceptedPharmacyFirstPreviewLinks } from "../../../../../src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts";
import {
  parseAcceptedCandidateDemonstrationPublishRequest,
  runAcceptedCandidateDemonstrationPublish,
} from "../../../../../src/pharmacy/pharmacyAcceptedCandidateDemonstrationPublishService.ts";

const router = Router();

function resolveSlug(raw: string): string | null {
  return (
    resolveTenantProfileSlug(raw) ||
    String(raw || "")
      .toLowerCase()
      .replace(/[^a-z0-9-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") ||
    null
  );
}

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

function htmlFlags(html: string) {
  return {
    sourceMarkerFound: findPreviewSourceMarker(html),
    headerPresent: /<header\b/i.test(html),
    footerPresent: /<footer\b/i.test(html),
    imagePresent: /<img\b/i.test(html),
    visibleImagePlaceholderPresent: /Image will be added before publishing|data-image-missing="true"/i.test(html),
    placeholderTextFound: /Professional review details available from the pharmacy|Trust & credentials|SOCIAL CONTENT LIBRARY/i.test(html),
    trustBlockSource: /trust-strip/i.test(html)
      ? "review-wrapper"
      : /pharmacy-trust-cards/i.test(html)
        ? "visual-experience"
        : /Professional review details available from the pharmacy/i.test(html)
          ? "placeholder-copy"
          : "missing",
  };
}

router.post("/growth-engine/:slug/review-centre/approve", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });

  const campaignId = String(req.body?.campaignId || req.body?.campaign || "");
  const assetKey = String(req.body?.assetKey || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });
  if (!assetKey) return res.status(400).json({ ok: false, error: "Section required" });

  try {
    approveReviewCentreAsset(slug, campaignId, assetKey);
    const view = buildReviewCentreView(slug, campaignId);
    return res.json({
      ok: true,
      canPublish: view?.canPublish ?? false,
      allApproved: view?.allApproved ?? false,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (/cannot be approved or published/i.test(message)) {
      return res.status(400).json({ ok: false, error: message });
    }
    return res.status(500).json({ ok: false, error: message });
  }
});

router.get("/growth-engine/:slug/review-centre-debug", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });
  const campaignId = String(req.query.campaign || req.query.campaignId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });

  try {
    return res.json(buildReviewCentreSourceDebug(slug, campaignId));
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

export function handleReviewCentrePreviewRequest(
  req: import("express").Request,
  res: import("express").Response,
): void {
  const slug = resolveSlug(String(req.params.slug || ""));
  if (!slug) {
    res.status(400).send("Invalid pharmacy");
    return;
  }
  const merged = mergePreviewQuery(req);
  const campaignId = String(merged.campaign || merged.campaignId || "");
  const assetKey = String(merged.asset || merged.assetKey || "");
  const areaSlug = String(merged.area || merged.areaSlug || "").trim();
  const pageSlug = String(merged.page || merged.pageSlug || "").trim();
  const itemId = String(merged.item || merged.itemId || "").trim();
  const slot = String(merged.slot || "").trim();
  const revision = String(merged.revision || "").trim();
  if (!campaignId) {
    res.status(400).send("Campaign required");
    return;
  }
  if (!assetKey) {
    res.status(400).send("Asset required");
    return;
  }

  try {
    const rendered = renderReviewCentrePreviewAsset(slug, campaignId, assetKey, {
      areaSlug: areaSlug || undefined,
      pageSlug: pageSlug || undefined,
      itemId: itemId || undefined,
      slot: slot || undefined,
      revision: revision || undefined,
    });
    sendHtml(
      res,
      applyAcceptedPharmacyFirstPreviewLinks(rendered.html, {
        slug,
        campaignId,
        asset: assetKey,
      }),
      {
        runId: rendered.runId,
        bankHash: rendered.approvedBankHash,
      },
    );
  } catch (err: unknown) {
    if (assetKey === "canonical-main-page-candidate") {
      const message = err instanceof Error ? err.message : String(err);
      res.setHeader("Content-Type", "text/plain; charset=utf-8");
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
      res.status(500).send(message);
      return;
    }
    sendHtml(res, renderMissingReviewPreview(slug, campaignId, "Campaign content"));
  }
}

function mergePreviewQuery(req: import("express").Request): Record<string, string> {
  const out: Record<string, string> = {};
  const assign = (key: string, value: unknown) => {
    if (out[key]) return;
    if (Array.isArray(value)) out[key] = String(value[0] ?? "");
    else if (value != null) out[key] = String(value);
  };
  for (const [key, value] of Object.entries(req.query || {})) assign(key, value);
  const raw = String(req.originalUrl || req.url || "");
  const q = raw.indexOf("?");
  if (q >= 0) {
    for (const [key, value] of new URLSearchParams(raw.slice(q + 1)).entries()) assign(key, value);
  }
  return out;
}

router.get("/growth-engine/:slug/review-preview", handleReviewCentrePreviewRequest);

router.get("/growth-engine/:slug/review-preview-debug", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });
  const campaignId = String(req.query.campaign || req.query.campaignId || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });

  try {
    const view = buildReviewCentreView(slug, campaignId);
    const sourceDebug = buildReviewCentreSourceDebug(slug, campaignId);
    const previewAssets = (view?.groups || []).flatMap((group) => group.assets);
    const previews = previewAssets
      .filter((asset) => asset.previewUrl)
      .map((asset) => {
        const rendered = asset.previewUrl?.includes("/review-preview?")
          ? renderReviewCentrePreviewAsset(slug, campaignId, asset.key)
          : { html: "", sourcePath: sourceDebug.assets.find((a) => a.group === asset.key)?.sourcePath || null, sourceRoute: "external-preview" };
        const flags = rendered.html ? htmlFlags(rendered.html) : {
          sourceMarkerFound: null,
          headerPresent: false,
          footerPresent: false,
          imagePresent: false,
          visibleImagePlaceholderPresent: false,
          placeholderTextFound: false,
          trustBlockSource: "not-rendered",
        };
        return {
          assetKey: asset.key,
          assetTitle: asset.title,
          previewUrl: asset.previewUrl,
          sourceFilePath: rendered.sourcePath,
          sourceRoute: rendered.sourceRoute,
          ...flags,
        };
      });
    return res.json({
      ok: true,
      slug,
      campaignId,
      previewUrls: previews.map((preview) => preview.previewUrl),
      previews,
    });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/review-centre/improve", (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });

  const campaignId = String(req.body?.campaignId || req.body?.campaign || "");
  const assetKey = String(req.body?.assetKey || "");
  if (!campaignId) return res.status(400).json({ ok: false, error: "Campaign required" });
  if (!assetKey) return res.status(400).json({ ok: false, error: "Section required" });

  try {
    const result = improveReviewCentreAsset(slug, campaignId, assetKey);
    const view = buildReviewCentreView(slug, campaignId);
    if (!result.improved) {
      return res.status(400).json({
        ok: false,
        improved: false,
        error: result.message,
        canPublish: view?.canPublish ?? false,
      });
    }
    return res.json({
      ok: true,
      improved: result.improved,
      message: result.message,
      canPublish: view?.canPublish ?? false,
    });
  } catch (err: unknown) {
    return res.status(500).json({ ok: false, error: err instanceof Error ? err.message : String(err) });
  }
});

router.post("/growth-engine/:slug/review-centre/publish-demonstration", async (req, res) => {
  const slug = resolveSlug(req.params.slug);
  if (!slug) return res.status(400).json({ ok: false, error: "Invalid pharmacy" });
  const parsed = parseAcceptedCandidateDemonstrationPublishRequest(slug, req.body);
  if (!parsed.ok) {
    return res.status(400).json({
      ok: false,
      published: false,
      indexed: false,
      searchConsoleSubmitted: false,
      indexingRegistrySubmitted: false,
      clinicalApproval: false,
      campaignApproval: false,
      unmetCondition: parsed.unmetCondition,
      error: parsed.unmetCondition,
    });
  }
  try {
    const result = await runAcceptedCandidateDemonstrationPublish(parsed.request);
    return res.status(result.ok ? 200 : 400).json(result);
  } catch (err: unknown) {
    return res.status(500).json({
      ok: false,
      published: false,
      indexed: false,
      searchConsoleSubmitted: false,
      indexingRegistrySubmitted: false,
      clinicalApproval: false,
      campaignApproval: false,
      error: err instanceof Error ? err.message : String(err),
    });
  }
});

export default router;
