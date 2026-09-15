/**
 * Structured Data Review placeholder — actionable destination for content review tasks.
 */
import { Router } from "express";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

router.get("/pharmacy-structured-data-review", (req, res) => {
  const slug = esc(String(req.query.slug || "pharmaconnect"));
  const service = esc(String(req.query.service || "blood-pressure-checks"));
  res.type("html").send(`<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Structured Data Review</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a}
header{background:#0f172a;color:#fff;padding:24px 28px}
header h1{margin:0;font-size:22px}
main{max-width:720px;margin:24px auto;padding:0 20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;margin-bottom:16px}
.badge{background:#dbeafe;color:#1e40af;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:12px}
.btn{display:inline-block;margin-top:12px;margin-right:8px;background:#005eb8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700;font-size:14px}
.btn.secondary{background:#64748b}
ul{font-size:14px;color:#475569;line-height:1.6}
${platformPlatformNavCss()}
</style></head><body>
<header>
  <h1>Structured Data Review</h1>
  <p style="margin:8px 0 0;color:#94a3b8;font-size:14px">Help search engines understand your page structure</p>
  ${renderPharmacyPlatformNavBar({ slug: String(req.query.slug || "pharmaconnect"), serviceId: String(req.query.service || "blood-pressure-checks"), activeId: "authority" })}
</header>
<main>
<div class="panel">
  <span class="badge">Guided review</span>
  <h2>What this means</h2>
  <p>Structured data tells Google how your page is organised — including breadcrumbs, your pharmacy details, and the service you offer.</p>
  <h3>What to check</h3>
  <ul>
    <li>Breadcrumb navigation is present on your live page</li>
    <li>Pharmacy name and location match your profile</li>
    <li>Service details reflect your current campaign</li>
  </ul>
  <p><strong>Next step:</strong> Open your live page preview and confirm publishing settings, then complete any remaining items in Content Review.</p>
  <a class="btn" href="/api/pharmacy-visual-experience/${service}/?slug=${slug}&rebuild=1">Preview Live Page</a>
  <a class="btn secondary" href="/api/pharmacy-publishing-settings?slug=${slug}&service=${service}">Ready To Publish</a>
  <a class="btn secondary" href="/api/pharmacy-authority-readiness?slug=${slug}&service=${service}">← Content Review</a>
</div>
</main></body></html>`);
});

export default router;
