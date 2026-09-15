/**
 * RC1-R2 — Serve existing Canonical Final Render bytes for authenticated Master Admin preview.
 * No rebuild, no HTML sanitisation, no PREVIEW_SOURCE markers.
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import type { Request, Response } from "express";
import {
  resolveCanonicalFinalRenderManifestPath,
  resolveCanonicalFinalRenderPagePath,
  resolveCanonicalFinalRenderRoot,
} from "./pharmacyCanonicalFinalRenderService.ts";
import { rewriteCanonicalHtmlLinksForAuthenticatedPreview } from "./pharmacyLocalPageUrlResolver.ts";
import { normalizeServiceId } from "./pharmacyServiceLibraryService.ts";
import { resolveTenantProfileSlug } from "./pharmacyTenantSlug.ts";

const MIME_BY_EXT: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".eot": "application/vnd.ms-fontobject",
  ".webmanifest": "application/manifest+json",
};

export const CANONICAL_PREVIEW_HOST = "https://app.pharmaconnect.uk";

export const CANONICAL_PREVIEW_PAGES = {
  homepage: { pageSlug: "index", pathSegment: "" },
  service: { pageSlug: "pharmacy-first", pathSegment: "pharmacy-first" },
  guide: { pageSlug: "pharmacy-first-guide", pathSegment: "pharmacy-first-guide" },
  blog: { pageSlug: "what-is-pharmacy-first", pathSegment: "what-is-pharmacy-first" },
} as const;

export type CanonicalPreviewPageKey = keyof typeof CANONICAL_PREVIEW_PAGES;

export function buildCanonicalPreviewUrl(
  slug: string,
  page: CanonicalPreviewPageKey,
  baseUrl: string = CANONICAL_PREVIEW_HOST,
): string {
  const host = baseUrl.replace(/\/+$/, "");
  const qs = `slug=${encodeURIComponent(slug)}`;
  if (page === "homepage") {
    return `${host}/api/pharmacy-visual-experience/?${qs}`;
  }
  const segment = CANONICAL_PREVIEW_PAGES[page].pathSegment;
  return `${host}/api/pharmacy-visual-experience/${segment}/?${qs}`;
}

/** Authenticated canonical preview for any Final Render page slug (including local-hub, local-cluster-*, local-*). */
export function buildCanonicalLocalPagePreviewUrl(
  slug: string,
  pageSlug: string,
  baseUrl: string = CANONICAL_PREVIEW_HOST,
): string {
  const host = baseUrl.replace(/\/+$/, "");
  const qs = `slug=${encodeURIComponent(slug)}`;
  const segment = String(pageSlug || "").replace(/^\/+|\/+$/g, "");
  if (!segment || segment === "index") {
    return `${host}/api/pharmacy-visual-experience/?${qs}`;
  }
  return `${host}/api/pharmacy-visual-experience/${encodeURIComponent(segment)}/?${qs}`;
}

export function tenantHasCanonicalFinalRender(rawSlug: unknown): boolean {
  const slug = resolveTenantProfileSlug(rawSlug);
  if (!slug) return false;
  return fs.existsSync(resolveCanonicalFinalRenderManifestPath(slug));
}

export function resolveCanonicalPreviewTenant(rawSlug: unknown): string | null {
  const slug = resolveTenantProfileSlug(rawSlug);
  if (!slug || !tenantHasCanonicalFinalRender(slug)) return null;
  return slug;
}

function assertWithinRoot(root: string, candidate: string): string | null {
  const resolvedRoot = path.resolve(root);
  const resolved = path.resolve(candidate);
  if (resolved !== resolvedRoot && !resolved.startsWith(resolvedRoot + path.sep)) {
    return null;
  }
  return resolved;
}

export function resolveCanonicalPreviewRelativeFile(slug: string, relativePath: string): string | null {
  const root = resolveCanonicalFinalRenderRoot(slug);
  const normalized = relativePath.replace(/^\/+/, "").replace(/\\/g, "/");
  if (!normalized || normalized.includes("..")) return null;
  const file = assertWithinRoot(root, path.join(root, normalized));
  if (!file || !fs.existsSync(file) || fs.statSync(file).isDirectory()) return null;
  return file;
}

const ROOT_STATIC_FILES = new Set([
  "sitemap.xml",
  "robots.txt",
  "FinalRenderManifest.json",
  "404.html",
]);

export function resolveCanonicalPreviewRootStatic(slug: string, filename: string): string | null {
  if (!ROOT_STATIC_FILES.has(filename)) return null;
  return resolveCanonicalPreviewRelativeFile(slug, filename);
}

export function resolveCanonicalPreviewAssetFromRequestPath(
  requestPath: string,
): { slug: string; file: string } | null {
  const match = requestPath.match(/^\/assets\/(website-import|brands)\/([a-z0-9_-]+)\/(.+)$/i);
  if (!match) return null;
  const [, kind, pathSlug, rest] = match;
  const slug = resolveCanonicalPreviewTenant(pathSlug);
  if (!slug) return null;
  const resolvedPathSlug = resolveTenantProfileSlug(pathSlug);
  if (!resolvedPathSlug || resolvedPathSlug !== slug) return null;
  const relative = `assets/${kind}/${slug}/${rest}`;
  const file = resolveCanonicalPreviewRelativeFile(slug, relative);
  if (!file) return null;
  return { slug, file };
}

export function sha256File(file: string): string {
  return crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
}

export function sendCanonicalPreviewBytes(res: Response, file: string): void {
  const ext = path.extname(file).toLowerCase();
  res.setHeader("Content-Type", MIME_BY_EXT[ext] || "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(fs.readFileSync(file));
}

export function sendCanonicalPreviewPage(
  res: Response,
  slug: string,
  pageSlug: string,
  serviceId = "pharmacy-first",
): boolean {
  const file = resolveCanonicalFinalRenderPagePath(slug, pageSlug);
  if (!file) {
    res.status(404).type("text/plain").send("Canonical final render page not found.");
    return false;
  }
  let html = fs.readFileSync(file, "utf8");
  if (/data-local-page-kind="location-(hub|cluster)"/.test(html) || /data-local-page-contract="local-/.test(html)) {
    html = rewriteCanonicalHtmlLinksForAuthenticatedPreview(html, slug, normalizeServiceId(serviceId));
  }
  const ext = path.extname(file).toLowerCase();
  res.setHeader("Content-Type", MIME_BY_EXT[ext] || "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.status(200).send(html);
  return true;
}

export function handleCanonicalPreviewAssetRequest(req: Request, res: Response): void {
  const match = resolveCanonicalPreviewAssetFromRequestPath(req.path);
  if (!match) {
    res.status(404).type("text/plain").send("Asset not found.");
    return;
  }
  sendCanonicalPreviewBytes(res, match.file);
}
