/**
 * PharmaConnect Content Review — publish-readiness review with actionable tasks.
 * Route: /api/pharmacy-authority-readiness?slug={slug}&service={serviceId}
 */
import { Router, type Request, type Response } from "express";
import {
  buildAuthorityReadinessDashboard,
  type AuthorityReadinessDashboard,
  type ServiceAuthorityAudit,
} from "../../../../src/pharmacy/pharmacyAuthorityReadinessService.ts";
import {
  buildContentReviewPanels,
  type ContentReviewTask,
} from "../../../../src/pharmacy/pharmacyContentReviewUi.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function renderReviewTask(task: ContentReviewTask): string {
  const tierCls = task.tier === "required" ? "tier-required" : task.tier === "recommended" ? "tier-recommended" : "tier-ready";
  return `<article class="review-task ${tierCls}">
  <div class="task-head">
    <strong>${esc(task.title)}</strong>
    <span class="task-status">${task.status === "done" ? "✓ Complete" : "To do"}</span>
  </div>
  <p class="why"><span class="why-label">Why this matters</span> ${esc(task.why)}</p>
  <a class="btn-action" href="${esc(task.url)}">${esc(task.buttonLabel)}</a>
</article>`;
}

function renderReviewSection(title: string, tasks: ContentReviewTask[], emptyMsg: string, cls: string): string {
  if (!tasks.length) {
    return `<section class="review-section ${cls}"><h2>${esc(title)}</h2><p class="muted">${esc(emptyMsg)}</p></section>`;
  }
  return `<section class="review-section ${cls}"><h2>${esc(title)}</h2><div class="task-grid">${tasks.map(renderReviewTask).join("")}</div></section>`;
}

export function renderAuthorityReadinessDashboardHtml(d: AuthorityReadinessDashboard): string {
  const audit = d.selectedAudit;
  const primary = d.brandPrimaryColor || "#1a5c42";
  const panels = audit ? buildContentReviewPanels(audit, d.slug) : null;
  const os = buildPlatformOperatingSystem(d.slug);

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Content Review — ${esc(d.pharmacyName)}</title>
<style>
:root{--primary:${esc(primary)}}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
main{max-width:1100px;margin:24px auto 48px;padding:0 20px}
section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 24px;margin-bottom:18px}
section h2{margin:0 0 12px;font-size:18px;font-weight:800}
.lead{margin:0 0 16px;font-size:14px;color:#64748b}
.field select{width:100%;max-width:420px;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
.status-banner{border-radius:12px;padding:16px 18px;margin-bottom:16px;font-size:15px;font-weight:700}
.status-banner.ready{background:#d1fae5;color:#065f46;border:1px solid #a7f3d0}
.status-banner.recommended{background:#dbeafe;color:#1e40af;border:1px solid #93c5fd}
.status-banner.required{background:#fef3c7;color:#92400e;border:1px solid #fcd34d}
.task-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:14px}
.review-task{border:1px solid #e2e8f0;border-radius:12px;padding:16px;background:#fafbfc}
.review-task.tier-required{border-color:#fecaca;background:#fffbfb}
.review-task.tier-recommended{border-color:#bfdbfe;background:#f8fbff}
.review-task.tier-ready{border-color:#a7f3d0;background:#f0fdf4}
.task-head{display:flex;flex-wrap:wrap;gap:8px;justify-content:space-between;margin-bottom:8px}
.task-status{font-size:11px;font-weight:800;text-transform:uppercase;color:#64748b}
.why{font-size:13px;color:#475569;margin:0 0 12px}
.why-label{display:block;font-size:10px;text-transform:uppercase;font-weight:700;color:#64748b;margin-bottom:2px}
.btn-action{display:inline-block;background:var(--primary);color:#fff;border-radius:8px;padding:8px 14px;font-weight:700;font-size:13px;text-decoration:none}
.btn{display:inline-block;background:var(--primary);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none}
.muted{color:#64748b;font-size:13px}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Content Review</h1>
  <p>${esc(d.pharmacyName)} · check your page is ready before publishing</p>
  ${renderPharmacyPlatformNavBar({ slug: d.slug, serviceId: d.selectedServiceId, activeId: "authority" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug: d.slug, nextStepUrl: os.nextStep?.url })}
<section>
  <h2>Overview</h2>
  <p class="lead">Review your page readiness before going live. Every item includes a button so you always know what to do next.</p>
  ${
    panels
      ? `<div class="status-banner ${panels.requiredBeforePublishing.length ? "required" : panels.hasRecommended ? "recommended" : "ready"}">
    ${panels.publishReady ? "✓ Ready for publishing" : "Required items need attention"}
    ${panels.hasRecommended && panels.publishReady ? " · Recommended improvements available" : ""}
  </div>
  <p><strong>Overall Review Status:</strong> ${esc(panels.overallReviewStatus)}</p>`
      : ""
  }
  <div class="field" style="margin-top:14px">
    <label for="serviceSelect">Service</label>
    <select id="serviceSelect">${d.doc.services
      .map(
        (s) =>
          `<option value="${esc(s.serviceId)}" ${s.serviceId === d.selectedServiceId ? "selected" : ""}>${esc(s.serviceName)}</option>`,
      )
      .join("")}</select>
  </div>
  <button type="button" class="btn" id="refreshBtn" style="margin-top:12px">Refresh review</button>
  <p class="muted" style="margin-top:10px">Last updated: ${esc(d.doc.updatedAt.slice(0, 19).replace("T", " "))}</p>
</section>

${
  audit && panels
    ? `${renderReviewSection("Ready For Publishing", panels.readyForPublishing, "Complete required items to unlock publishing.", "section-ready")}
${renderReviewSection("Required Before Publishing", panels.requiredBeforePublishing, "No required blockers — great work.", "section-required")}
${renderReviewSection("Recommended Improvements", panels.recommendedImprovements, "No optional improvements suggested.", "section-recommended")}`
    : `<section><p class="muted">Select a service to review.</p></section>`
}
</main>
<script>
var SLUG = ${JSON.stringify(d.slug)};
document.getElementById('serviceSelect').addEventListener('change', function(){
  location.href = '/api/pharmacy-authority-readiness?slug=' + encodeURIComponent(SLUG) + '&service=' + encodeURIComponent(this.value);
});
document.getElementById('refreshBtn').addEventListener('click', async function(){
  var btn = this; btn.disabled = true; btn.textContent = 'Refreshing…';
  await fetch('/api/pharmacy-authority-readiness/' + SLUG + '/refresh', { method:'POST', credentials:'same-origin' });
  location.reload();
});
</script>
</body>
</html>`;
}

function handleDashboard(req: Request, res: Response) {
  const slug = String(req.query.slug || "pharmaconnect");
  const serviceId = req.query.service ? String(req.query.service) : undefined;
  try {
    const dashboard = buildAuthorityReadinessDashboard(slug, { serviceId });
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderAuthorityReadinessDashboardHtml(dashboard));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Content review error: ${esc(String(err))}</pre>`);
  }
}

router.get("/pharmacy-authority-readiness", handleDashboard);

export default router;
