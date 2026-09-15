/**
 * Publishing Settings placeholder — destination for canonical, noindex and structured data enhancements.
 */
import { Router } from "express";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

router.get("/pharmacy-publishing-settings", (req, res) => {
  const slug = esc(String(req.query.slug || "pharmaconnect"));
  const service = esc(String(req.query.service || ""));
  res.type("html").send(`<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><title>Publishing Settings</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#0f172a}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px}
.badge{background:#fef3c7;color:#92400e;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:16px}
a.btn{display:inline-block;margin-top:16px;background:#005eb8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700}
</style></head><body>
<div class="panel">
  <span class="badge">Placeholder — V1</span>
  <h1>Publishing Settings</h1>
  <p>Future home for canonical URL, noindex removal, structured data and meta configuration per service.</p>
  <p>Use this destination from the Enhancement Workspace when completing technical publish tasks.</p>
  <p class="muted">Slug: ${slug}${service ? ` · Service: ${service}` : ""}</p>
  <a class="btn" href="/api/pharmacy-enhancement-workspace?slug=${slug}${service ? "&service=" + service : ""}">← Back to Campaign Improvements</a>
  <a class="btn" href="/api/pharmacy-executive-dashboard?slug=${slug}" style="background:#64748b;margin-left:8px">Executive Dashboard</a>
</div></body></html>`);
});

export default router;
