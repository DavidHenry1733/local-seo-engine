/**
 * FAQ Workspace placeholder — destination for FAQ enhancement tasks.
 */
import { Router } from "express";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

router.get("/pharmacy-faq-workspace", (req, res) => {
  const slug = esc(String(req.query.slug || "pharmaconnect"));
  const service = esc(String(req.query.service || "pharmacy-first"));
  res.type("html").send(`<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><title>FAQ Workspace</title>
<style>body{font-family:Inter,Arial,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#0f172a}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px}
.badge{background:#fef3c7;color:#92400e;padding:6px 12px;border-radius:8px;font-size:12px;font-weight:700;display:inline-block;margin-bottom:16px}
a.btn{display:inline-block;margin-top:16px;background:#005eb8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:700}
</style></head><body>
<div class="panel">
  <span class="badge">Placeholder — V1</span>
  <h1>FAQ Workspace</h1>
  <p>Future home for reviewing and enhancing service FAQs, town-specific questions and AI citation blocks.</p>
  <p>For now, review FAQ content in the content ecosystem preview.</p>
  <p class="muted">Slug: ${slug} · Service: ${service}</p>
  <a class="btn" href="/api/pharmacy-content-ecosystem-preview/${service}/">Open Content Ecosystem</a>
  <a class="btn" href="/api/pharmacy-enhancement-workspace?slug=${slug}&service=${service}" style="background:#64748b;margin-left:8px">← Campaign Improvements</a>
</div></body></html>`);
});

export default router;
