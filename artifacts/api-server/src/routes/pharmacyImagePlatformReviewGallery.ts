/**
 * Internal Master Admin review gallery — Image Platform (not customer-facing).
 */
import { Router, type Request, type Response } from "express";
import fs from "node:fs";
import path from "node:path";
import { requireAdmin } from "../middlewares/requireAuth.ts";
import { PHARMACY_WORKSPACE_ROOT } from "../../../../src/pharmacy/pharmacyWorkspacePaths.ts";
import { listPharmacyFirstMetadataV11 } from "../../../../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstPopulation.ts";
import { evaluatePharmacyFirstHealth } from "../../../../src/pharmacy/imagePlatform/pharmacyImagePlatformPharmacyFirstHealth.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export const pharmacyImagePlatformReviewRouter = Router();
pharmacyImagePlatformReviewRouter.use(requireAdmin);

pharmacyImagePlatformReviewRouter.get("/pharmacy-image-platform/media/:serviceId/:role/:file", (req, res) => {
  const serviceId = String(req.params.serviceId || "").replace(/[^a-z0-9-]/gi, "");
  const role = String(req.params.role || "").replace(/[^a-z0-9-]/gi, "");
  const file = path.basename(String(req.params.file || ""));
  const rel = path.join("assets/pharmacy-image-platform/services", serviceId, "roles", role, "approved", file);
  const abs = path.join(PHARMACY_WORKSPACE_ROOT, rel);
  if (!fs.existsSync(abs)) {
    res.status(404).type("text/plain").send("Not found");
    return;
  }
  const ext = path.extname(abs).toLowerCase();
  res.type(ext === ".webp" ? "image/webp" : ext === ".jpg" || ext === ".jpeg" ? "image/jpeg" : "application/octet-stream");
  res.setHeader("Cache-Control", "no-store");
  res.sendFile(abs);
});

pharmacyImagePlatformReviewRouter.get("/pharmacy-image-platform/review/:serviceId", (req: Request, res: Response) => {
  const serviceId = String(req.params.serviceId || "pharmacy-first");
  if (serviceId !== "pharmacy-first") {
    res.status(404).send("Review gallery available for pharmacy-first only in V1.1");
    return;
  }
  const health = evaluatePharmacyFirstHealth();
  const assets = listPharmacyFirstMetadataV11().filter((a) => a.approvalStatus === "approved");
  const byRole = new Map<string, typeof assets>();
  for (const a of assets) {
    const key = a.editorialUse ? `${a.role}-${a.editorialUse}` : a.role;
    if (!byRole.has(key)) byRole.set(key, []);
    byRole.get(key)!.push(a);
  }

  const cards = assets
    .map((a) => {
      const file = path.basename(a.filePath);
      const src = `/api/pharmacy-image-platform/media/${serviceId}/${a.role}/${file}`;
      return `<article class="card" data-asset-id="${esc(a.assetId)}">
<img src="${esc(src)}" alt="${esc(a.defaultAltText)}" loading="eager" decoding="async" width="${a.width}" height="${a.height}"/>
<dl>
<dt>Asset ID</dt><dd>${esc(a.assetId)}</dd>
<dt>Role</dt><dd>${esc(a.role)}${a.editorialUse ? ` (${esc(a.editorialUse)})` : ""}</dd>
<dt>Dimensions</dt><dd>${a.width}×${a.height}</dd>
<dt>Classification</dt><dd>${esc(a.classification)}</dd>
<dt>Alt text</dt><dd>${esc(a.defaultAltText)}</dd>
<dt>Approval</dt><dd>${esc(a.approvalStatus)}</dd>
</dl>
</article>`;
    })
    .join("\n");

  res.type("html").send(`<!DOCTYPE html>
<html lang="en"><head>
<meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Image Platform Review — ${esc(serviceId)}</title>
<style>
body{font-family:system-ui,sans-serif;margin:0;padding:24px;background:#f6f7f9;color:#111}
h1{margin:0 0 8px;font-size:1.4rem}
.meta{color:#555;margin-bottom:24px}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px}
.card{background:#fff;border:1px solid #ddd;border-radius:10px;padding:12px}
.card img{width:100%;height:auto;border-radius:6px;display:block;background:#eee}
dl{font-size:.85rem;margin:12px 0 0;display:grid;grid-template-columns:88px 1fr;gap:4px 8px}
dt{font-weight:600;color:#444}
</style></head>
<body>
<h1>PharmaConnect Image Platform — ${esc(serviceId)}</h1>
<p class="meta">Health: <strong>${esc(health.healthStatus)}</strong> · Approved: ${health.approvedAssets} · Internal review only (not published)</p>
<section class="grid">${cards || "<p>No approved assets yet.</p>"}</section>
</body></html>`);
});
