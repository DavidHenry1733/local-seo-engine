import { Router } from "express";
import fs from "node:fs";
import {
  sanitiseVisualExperienceServiceId,
  resolveMasterPublishBeforePath,
} from "../../../../src/pharmacy/pharmacyVisualExperience.ts";
import { resolveTenantProfileSlug, sendMissingTenantSlug } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { sanitizeReviewPreviewHtml } from "../../../../src/pharmacy/pharmacyContentEcosystemPreviewRoute.ts";
import { deliverApprovedCorePageJsonLd } from "../../../../src/pharmacy/pharmacyApprovedCorePageJsonLdDelivery.ts";
import { applyApprovedCorePagePresentationContractCss } from "../../../../src/pharmacy/pharmacyDesignSystemV1.ts";
import { applyTenantBrandPresentationOverlay } from "../../../../src/pharmacy/pharmacyTenantBrandPresentationOverlay.ts";
import { requireAdmin } from "../middlewares/requireAuth.ts";
import {
  handleCanonicalPreviewAssetRequest,
  resolveCanonicalPreviewRootStatic,
  sendCanonicalPreviewBytes,
  sendCanonicalPreviewPage,
} from "../../../../src/pharmacy/pharmacyCanonicalFinalRenderPreviewService.ts";
import {
  resolveVisualExperiencePreviewSource,
  resolveVisualExperiencePreviewTenant,
  type ResolvedVisualExperiencePreview,
} from "../../../../src/pharmacy/pharmacyVisualExperiencePreviewScopeService.ts";
import { isPublicBrookSalesDemoHubVisualExperienceGet } from "../../../../src/pharmacy/pharmacyAcceptedPageRouteResolverV1.ts";
import { renderCorporateServiceHubForTenant } from "../../../../src/pharmacy/pharmacyLocalClusterLocationPageRenderer.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function resolveSlug(req: import("express").Request, res?: import("express").Response): string | null {
  const fromQuery = typeof req.query.slug === "string" ? req.query.slug : "";
  const resolved = resolveTenantProfileSlug(fromQuery);
  if (!resolved && res) sendMissingTenantSlug(res);
  return resolved;
}

function resolvePreviewTenant(req: import("express").Request, res: import("express").Response): string | null {
  const fromQuery = typeof req.query.slug === "string" ? req.query.slug : "";
  const resolved = resolveVisualExperiencePreviewTenant(fromQuery);
  if (!resolved) {
    if (!resolveTenantProfileSlug(fromQuery)) {
      sendMissingTenantSlug(res);
      return null;
    }
    res.status(404).type("text/plain").send("Service page preview not found for this tenant.");
    return null;
  }
  return resolved;
}

function sendScopedPreviewPage(res: import("express").Response, preview: ResolvedVisualExperiencePreview): void {
  if (preview.scope === "full-ecosystem") {
    sendCanonicalPreviewPage(res, preview.slug, preview.pageSlug, preview.serviceId);
    return;
  }
  if (/pharmacy-first/i.test(String(preview.serviceId || ""))) {
    try {
      const html = renderCorporateServiceHubForTenant(preview.slug, preview.serviceId);
      res.status(200).type("html").send(html);
      return;
    } catch {
      /* Fall through to stored bytes only if live cluster hub render fails. */
    }
  }
  sendCanonicalPreviewBytes(res, preview.htmlPath);
}

function resolveScopedPreview(
  req: import("express").Request,
  res: import("express").Response,
  pageSlug: string,
): ResolvedVisualExperiencePreview | null {
  const fromQuery = typeof req.query.slug === "string" ? req.query.slug : "";
  const preview = resolveVisualExperiencePreviewSource(fromQuery, pageSlug);
  if (!preview) {
    if (!resolveTenantProfileSlug(fromQuery)) {
      sendMissingTenantSlug(res);
      return null;
    }
    res.status(404).type("text/plain").send("Service page preview not found for this tenant.");
    return null;
  }
  return preview;
}

function sendLegacyBeforePreview(
  res: import("express").Response,
  file: string,
  slug?: string,
  serviceId?: string,
): void {
  let html = fs.readFileSync(file, "utf8");
  html = sanitizeReviewPreviewHtml(html);
  html = applyApprovedCorePagePresentationContractCss(html);
  if (slug) html = applyTenantBrandPresentationOverlay(html, slug);
  if (slug && serviceId) {
    html = deliverApprovedCorePageJsonLd(html, { slug, serviceId });
  }
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(`<!-- PREVIEW_SOURCE: visual-experience -->\n${html}`);
}

/** Public legacy “before publish” previews — unchanged from RC1-R1. */
export const pharmacyVisualExperiencePublicRouter = Router();

function mountBeforeRoute(pathSuffix: string): void {
  pharmacyVisualExperiencePublicRouter.get(`/pharmacy-visual-experience/:serviceId/before${pathSuffix}`, (req, res) => {
    const serviceId = sanitiseVisualExperienceServiceId(req.params.serviceId);
    if (!serviceId) {
      res.status(400).send("Invalid service id");
      return;
    }
    const slug = resolveSlug(req, res);
    if (!slug) return;
    const file = resolveMasterPublishBeforePath(serviceId, slug);
    if (!file) {
      res.status(404).send("This preview page has not been generated yet.");
      return;
    }
    sendLegacyBeforePreview(res, file, slug, serviceId);
  });
}

mountBeforeRoute("");
mountBeforeRoute("/");

/** Token-free Brook Pharmacy First hub visual-experience preview for sales screenshots only. */
function handleBrookSalesDemoHubVisualExperience(
  req: import("express").Request,
  res: import("express").Response,
  next: import("express").NextFunction,
): void {
  if (
    !isPublicBrookSalesDemoHubVisualExperienceGet({
      method: req.method,
      path: req.path,
      originalUrl: req.originalUrl,
      url: req.url,
      query: req.query as Record<string, unknown>,
    })
  ) {
    return next();
  }
  const preview = resolveScopedPreview(req, res, "pharmacy-first");
  if (!preview) return;
  sendScopedPreviewPage(res, preview);
}

pharmacyVisualExperiencePublicRouter.get(
  "/pharmacy-visual-experience/pharmacy-first",
  handleBrookSalesDemoHubVisualExperience,
);
pharmacyVisualExperiencePublicRouter.get(
  "/pharmacy-visual-experience/pharmacy-first/",
  handleBrookSalesDemoHubVisualExperience,
);

/** Authenticated Master Admin canonical final render preview — raw file bytes only. */
export const pharmacyVisualExperienceAdminRouter = Router();
pharmacyVisualExperienceAdminRouter.use(requireAdmin);

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience", (req, res) => {
  const preview = resolveScopedPreview(req, res, "index");
  if (!preview) return;
  sendScopedPreviewPage(res, preview);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/", (req, res) => {
  const preview = resolveScopedPreview(req, res, "index");
  if (!preview) return;
  sendScopedPreviewPage(res, preview);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/sitemap.xml", (req, res) => {
  const slug = resolvePreviewTenant(req, res);
  if (!slug) return;
  const file = resolveCanonicalPreviewRootStatic(slug, "sitemap.xml");
  if (!file) {
    res.status(404).type("text/plain").send("Sitemap not found.");
    return;
  }
  sendCanonicalPreviewBytes(res, file);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/robots.txt", (req, res) => {
  const slug = resolvePreviewTenant(req, res);
  if (!slug) return;
  const file = resolveCanonicalPreviewRootStatic(slug, "robots.txt");
  if (!file) {
    res.status(404).type("text/plain").send("Robots file not found.");
    return;
  }
  sendCanonicalPreviewBytes(res, file);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/FinalRenderManifest.json", (req, res) => {
  const slug = resolvePreviewTenant(req, res);
  if (!slug) return;
  const file = resolveCanonicalPreviewRootStatic(slug, "FinalRenderManifest.json");
  if (!file) {
    res.status(404).type("text/plain").send("Manifest not found.");
    return;
  }
  sendCanonicalPreviewBytes(res, file);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/:serviceId", (req, res) => {
  const rawPageSlug = String(req.params.serviceId || "").replace(/\/+$/, "");
  if (!rawPageSlug || rawPageSlug.includes("..") || rawPageSlug.includes("/")) {
    res.status(400).type("text/plain").send("Invalid page path.");
    return;
  }
  const preview = resolveScopedPreview(req, res, rawPageSlug);
  if (!preview) return;
  sendScopedPreviewPage(res, preview);
});

pharmacyVisualExperienceAdminRouter.get("/pharmacy-visual-experience/:serviceId/", (req, res) => {
  const rawPageSlug = String(req.params.serviceId || "").replace(/\/+$/, "");
  if (!rawPageSlug || rawPageSlug.includes("..") || rawPageSlug.includes("/")) {
    res.status(400).type("text/plain").send("Invalid page path.");
    return;
  }
  const preview = resolveScopedPreview(req, res, rawPageSlug);
  if (!preview) return;
  sendScopedPreviewPage(res, preview);
});

export { handleCanonicalPreviewAssetRequest };

/** @deprecated Use pharmacyVisualExperiencePublicRouter + pharmacyVisualExperienceAdminRouter */
export default pharmacyVisualExperiencePublicRouter;
