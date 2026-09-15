/**
 * Review Content Package & Approve — workflow steps 5–6 (review only, no generation).
 */
import { Router } from "express";
import {
  contentPackageApproved,
  contentPackageGenerated,
  contentPackageReviewed,
  getContentPackageReviewSections,
  loadContentPackage,
  loadGenerationReport,
} from "../../../../src/pharmacy/pharmacyContentPackageService.ts";
import { packageCanBeApproved } from "../../../../src/pharmacy/pharmacyGenerationIntegrityService.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPharmacyServicePageProfile } from "../../../../src/pharmacy/pharmacyServicePageProfileContext.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";

const router = Router();

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function statusLabel(status: string): string {
  if (status === "included") return "Included";
  if (status === "planned") return "Planned";
  if (status === "missing") return "Not yet created";
  return status;
}

function renderPage(slug: string, serviceId: string): string {
  const s = slug;
  const pkg = loadContentPackage(s, serviceId);
  const report = loadGenerationReport(s, serviceId);
  const generated = contentPackageGenerated(s, serviceId);
  const reviewed = contentPackageReviewed(s, serviceId);
  const approved = contentPackageApproved(s, serviceId);
  const pageProfile = buildPharmacyServicePageProfile(s);
  const sections = getContentPackageReviewSections(s, serviceId);
  const os = buildPlatformOperatingSystem(s, { primaryServiceId: serviceId });
  const createUrl = `/api/pharmacy-content-package?slug=${encodeURIComponent(s)}&service=${encodeURIComponent(serviceId)}`;
  const approvalCheck = packageCanBeApproved(report);
  const canApprove = approvalCheck.ok && pkg?.packageValidation?.ok !== false && pkg?.status !== "error";
  const techJson = esc(JSON.stringify(report || {}, null, 2));

  const headerBlock = generated
    ? pkg?.packageValidation?.ok === false || pkg?.status === "error"
      ? `<p style="color:#991b1b;font-weight:700">Content package needs fixing before approval.</p>
         <p class="lead">${esc(pageProfile.pharmacyName)} · ${esc(pkg?.serviceName || serviceId.replace(/-/g, " "))} · Generated ${pkg?.generatedAt ? new Date(pkg.generatedAt).toLocaleString("en-GB") : ""}</p>
         <p class="muted">${esc(pkg?.generationError || report?.packageValidation?.detail || "Validation failed")}</p>`
      : `<p class="status-ok">Your Content Package Is Ready</p>
       <p class="lead">${esc(pageProfile.pharmacyName)} · ${esc(pkg?.serviceName || serviceId.replace(/-/g, " "))} · Generated ${pkg?.generatedAt ? new Date(pkg.generatedAt).toLocaleString("en-GB") : ""}</p>`
    : `<p>Your content package has not been created yet.</p>
       <p style="margin-top:14px"><a class="btn" href="${esc(createUrl)}">Create Content Package</a></p>`;

  const includedSections = sections.filter((s) => s.included);
  const plannedSections = sections.filter((s) => !s.included);

  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Review Content Package — ${esc(pageProfile.pharmacyName)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f4f6f9;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,#005eb8);color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
main{max-width:960px;margin:24px auto 48px;padding:0 20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 24px;margin-bottom:18px}
.panel h2{margin:0 0 10px;font-size:18px}
.lead{color:#64748b;margin:8px 0 16px;font-size:14px}
.btn{display:inline-block;background:#005eb8;color:#fff;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;border:0;cursor:pointer}
.btn.secondary{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.btn.success{background:#059669}
.btn:disabled{opacity:.55;cursor:not-allowed}
.status-ok{color:#059669;font-weight:700}
table{width:100%;border-collapse:collapse;font-size:14px}
th,td{border-bottom:1px solid #e2e8f0;padding:10px 8px;text-align:left;vertical-align:top}
th{color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:.04em}
.muted{color:#64748b;font-size:12px}
#statusMsg{margin-top:12px;padding:10px 14px;border-radius:8px;display:none;font-size:13px}
#statusMsg.show{display:block}
#statusMsg.ok{background:#ecfdf5;color:#065f46}
#statusMsg.err{background:#fef2f2;color:#991b1b}
${platformPlatformNavCss()}
</style></head><body>
<header>
  <h1>Review Content Package</h1>
  <p>Review everything created for your service and areas before publishing.</p>
  ${renderPharmacyPlatformNavBar({ slug: s, serviceId, activeId: "authority" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug: s, nextStepUrl: os.nextStep?.url, dashboardLabel: "Return to Dashboard" })}
<div class="panel">
  <h2>Package status</h2>
  ${headerBlock}
</div>
${generated ? `<div class="panel">
  <h2>Included in this package</h2>
  <table>
    <thead><tr><th>Section</th><th>Count</th><th>Status</th><th>Preview</th><th>Notes</th></tr></thead>
    <tbody>${includedSections.map((sec) => {
      const preview = sec.previewUrl ? `<a href="${esc(sec.previewUrl)}" target="_blank" rel="noopener">Open</a>` : "—";
      return `<tr><td><strong>${esc(sec.title)}</strong></td><td>${sec.count}</td><td>${esc(statusLabel(sec.status))}</td><td>${preview}</td><td class="muted">${esc(sec.notes || "")}</td></tr>`;
    }).join("") || "<tr><td colspan=\"5\">No assets included yet</td></tr>"}</tbody>
  </table>
</div>
<div class="panel">
  <h2>Planned / not included</h2>
  <table>
    <thead><tr><th>Section</th><th>Status</th><th>Notes</th></tr></thead>
    <tbody>${plannedSections.map((sec) => `<tr><td>${esc(sec.title)}</td><td>${esc(statusLabel(sec.status))}</td><td class="muted">${esc(sec.notes || "")}</td></tr>`).join("") || "<tr><td colspan=\"3\">All supported assets included</td></tr>"}</tbody>
  </table>
</div>
<div class="panel" id="review-actions">
  <h2>Review &amp; approve</h2>
  <p class="lead">Review all sections above, then confirm you are happy with the content package.</p>
  ${!canApprove && generated ? `<p style="color:#991b1b;font-weight:700">${esc(approvalCheck.message)}</p>` : ""}
  ${reviewed ? `<p class="status-ok">✓ Content package reviewed ${pkg?.reviewedAt ? new Date(pkg.reviewedAt).toLocaleString("en-GB") : ""}</p>` : ""}
  ${approved ? `<p class="status-ok">✓ Content package approved ${pkg?.approvedAt ? new Date(pkg.approvedAt).toLocaleString("en-GB") : ""}</p>` : ""}
  <div style="margin-top:16px;display:flex;flex-wrap:wrap;gap:10px">
    <button type="button" class="btn secondary" id="btnMarkReviewed" ${reviewed ? "disabled" : ""}>I have reviewed this content package</button>
    <button type="button" class="btn success" id="btnApprove" ${!canApprove || approved ? "disabled" : ""}>I approve this content package for publishing</button>
  </div>
  <div id="statusMsg"></div>
  <details style="margin-top:14px"><summary style="cursor:pointer;font-size:13px;color:#64748b">Technical details (admin)</summary><pre style="white-space:pre-wrap;font-size:11px;margin:8px 0 0">${techJson}</pre></details>
</div>` : ""}
</main>
<script>
var SLUG = ${JSON.stringify(s)};
var SERVICE = ${JSON.stringify(serviceId)};
function setStatus(msg, ok){
  var el = document.getElementById('statusMsg');
  if (!el) return;
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'ok' : 'err');
}
async function postAction(path){
  var res = await fetch('/api/pharmacy/content-package/' + SLUG + '/' + SERVICE + '/' + path, {
    method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}
  });
  return res.json();
}
var btnReview = document.getElementById('btnMarkReviewed');
if (btnReview) btnReview.onclick = async function(){
  var json = await postAction('mark-reviewed');
  setStatus(json.ok ? 'Content package marked as reviewed.' : (json.error || 'Failed'), json.ok);
  if (json.ok) setTimeout(function(){ location.reload(); }, 600);
};
var btnApprove = document.getElementById('btnApprove');
if (btnApprove) btnApprove.onclick = async function(){
  var json = await postAction('approve');
  setStatus(json.ok ? 'Content package approved — you can now publish.' : (json.error || 'Failed'), json.ok);
  if (json.ok) setTimeout(function(){ location.reload(); }, 600);
};
</script>
</body></html>`;
}

router.get("/pharmacy-asset-review", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const serviceId = String(req.query.service || req.query.serviceId || "pharmacy-first");
  res.type("html").send(renderPage(slug, serviceId));
});

export default router;
