import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

function resolveWorkspaceRoot(): string {
  const candidates = [
    path.resolve(__dirname, "../../.."),
    path.resolve(__dirname, "../../../.."),
    process.cwd(),
  ];
  for (const root of candidates) {
    if (fs.existsSync(path.join(root, "output", "pharmacy-preview"))) return root;
  }
  return path.resolve(__dirname, "../../..");
}

const WORKSPACE_ROOT = resolveWorkspaceRoot();
const PHARMACY_PREVIEW_DIR = path.join(WORKSPACE_ROOT, "output", "pharmacy-preview");

function sanitisePageSlug(raw: string): string | null {
  const clean = path.basename(raw.replace(/\/index\.html$/i, ""));
  return SLUG_RE.test(clean) ? clean : null;
}

function preparePharmacyPreviewHtml(html: string): string {
  const noindexMeta = '<meta name="robots" content="noindex, nofollow">';
  if (!/name=["']robots["']/i.test(html)) {
    html = html.replace(/<head[^>]*>/i, (m) => `${m}\n${noindexMeta}`);
  }
  // Rewrite relative preview folder links to app route paths
  html = html.replace(/href="\.\.\/([a-z0-9][a-z0-9-]*)\/index\.html"/g, 'href="/pharmacy-preview/$1/"');
  html = html.replace(/href="\.\.\/([a-z0-9][a-z0-9-]*)\/"/g, 'href="/pharmacy-preview/$1/"');
  return html;
}

function sendPreviewHtml(res: import("express").Response, filePath: string): void {
  let html = fs.readFileSync(filePath, "utf8");
  html = preparePharmacyPreviewHtml(html);
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.send(html);
}

const router = Router();

router.get("/pharmacy-preview/", (_req, res) => {
  const indexPath = path.join(PHARMACY_PREVIEW_DIR, "index.html");
  if (!fs.existsSync(indexPath)) {
    res.status(404).send("<h2>Pharmacy preview index not found.</h2>");
    return;
  }
  sendPreviewHtml(res, indexPath);
});

router.get("/pharmacy-preview", (_req, res) => {
  res.redirect(301, "/pharmacy-preview/");
});

router.get("/pharmacy-preview/:pageSlug/", (req, res) => {
  const pageSlug = sanitisePageSlug(req.params.pageSlug);
  if (!pageSlug) {
    res.status(400).send("Invalid page slug");
    return;
  }

  const filePath = path.join(PHARMACY_PREVIEW_DIR, pageSlug, "index.html");
  if (!fs.existsSync(filePath)) {
    res.status(404).send(`<h2>Pharmacy preview not found: ${pageSlug}</h2>`);
    return;
  }

  sendPreviewHtml(res, filePath);
});

router.get("/pharmacy-preview/:pageSlug/index.html", (req, res) => {
  res.redirect(301, `/pharmacy-preview/${req.params.pageSlug}/`);
});

router.get("/pharmacy-preview/:pageSlug", (req, res) => {
  res.redirect(301, `/pharmacy-preview/${req.params.pageSlug}/`);
});

export default router;
