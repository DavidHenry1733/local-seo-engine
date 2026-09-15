/**
 * Create Content Package — workflow step 4 (generation only).
 */
import { Router } from "express";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import {
  contentPackageGenerated,
  loadContentPackage,
  loadGenerationReport,
} from "../../../../src/pharmacy/pharmacyContentPackageService.ts";
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

function renderPage(slug: string, serviceId: string): string {
  const pkg = loadContentPackage(slug, serviceId);
  const report = loadGenerationReport(slug, serviceId);
  const generated = contentPackageGenerated(slug, serviceId);
  const pageProfile = buildPharmacyServicePageProfile(slug);
  const os = buildPlatformOperatingSystem(slug, { primaryServiceId: serviceId });
  const reviewUrl = `/api/pharmacy-asset-review?slug=${encodeURIComponent(slug)}&service=${encodeURIComponent(serviceId)}`;
  const techJson = esc(JSON.stringify(report || pkg?.adminDiagnostics || {}, null, 2));
  const validationBanner =
    pkg?.packageValidation?.ok === false
      ? `<p style="color:#991b1b;font-weight:700;margin-top:10px">Package validation failed — review technical details before regenerating.</p>`
      : "";
  const areas = (pkg?.selectedAreas || []).slice(0, 6).join(", ");

  return `<!DOCTYPE html>
<html lang="en-GB"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Create Content Package — ${esc(pageProfile.pharmacyName)}</title>
<style>
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f4f6f9;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,#005eb8);color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
main{max-width:900px;margin:24px auto 48px;padding:0 20px}
.panel{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 24px;margin-bottom:18px}
.panel h2{margin:0 0 10px;font-size:18px}
.lead{color:#64748b;margin:0 0 16px;font-size:14px}
.btn{display:inline-block;background:#005eb8;color:#fff;padding:11px 18px;border-radius:9px;font-weight:800;font-size:14px;text-decoration:none;border:0;cursor:pointer}
.btn.secondary{background:#f1f5f9;color:#475569;border:1px solid #e2e8f0}
.btn:disabled{opacity:.55;cursor:not-allowed}
.status-ok{color:#059669;font-weight:700}
#statusMsg{margin-top:12px;padding:10px 14px;border-radius:8px;display:none;font-size:13px}
#statusMsg.show{display:block}
#statusMsg.ok{background:#ecfdf5;color:#065f46}
#statusMsg.err{background:#fef2f2;color:#991b1b}
#techDetails{display:none;margin-top:12px;font-size:12px;color:#64748b;background:#f8fafc;padding:10px;border-radius:8px}
ul{margin:0;padding-left:20px;font-size:14px}
${platformPlatformNavCss()}
</style></head><body>
<header>
  <h1>Create Content Package</h1>
  <p>Generate your full content package for ${esc(pageProfile.pharmacyName)}</p>
  ${renderPharmacyPlatformNavBar({ slug, serviceId, activeId: "authority" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug, nextStepUrl: generated ? reviewUrl : undefined, dashboardLabel: "Return to Dashboard" })}
<div class="panel">
  <h2>What will be created</h2>
  <p class="lead">${esc(pageProfile.pharmacyName)} · ${esc(serviceId.replace(/-/g, " "))}${areas ? ` · Areas: ${esc(areas)}` : ""}</p>
  <ul>
    <li>Main service page preview</li>
    <li>Local area / cluster pages (where supported)</li>
    <li>FAQs, guides, blog, GBP, social and email assets (where available)</li>
    <li>Image assignments, review data and publishing readiness</li>
  </ul>
  ${generated ? `<p class="status-ok">✓ Content package generated ${pkg?.generatedAt ? new Date(pkg.generatedAt).toLocaleString("en-GB") : ""}</p>${validationBanner}
  <p style="margin-top:14px"><a class="btn" href="${esc(reviewUrl)}">Review Content Package</a></p>` : `<p style="margin-top:16px"><button type="button" class="btn" id="btnCreate">Create Content Package</button></p>`}
  <div id="statusMsg"></div>
  <details style="margin-top:12px"><summary style="cursor:pointer;font-size:13px;color:#64748b">Technical details (admin)</summary><pre id="techDetails" style="white-space:pre-wrap;font-size:11px;margin:8px 0 0">${techJson}</pre></details>
</div>
</main>
<script>
var SLUG = ${JSON.stringify(slug)};
var SERVICE = ${JSON.stringify(serviceId)};
function setStatus(msg, ok){
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'ok' : 'err');
}
document.getElementById('btnCreate') && (document.getElementById('btnCreate').onclick = async function(){
  var btn = document.getElementById('btnCreate');
  btn.disabled = true;
  setStatus('Creating your content package…', true);
  var res = await fetch('/api/pharmacy/content-package/' + SLUG + '/' + SERVICE + '/generate', {
    method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}
  });
  var json = await res.json();
  if (json.generationReport || json.adminDiagnostics) {
    var pre = document.getElementById('techDetails');
    if (pre) pre.textContent = JSON.stringify(json.generationReport || json.adminDiagnostics, null, 2);
  }
  if (json.ok) {
    setStatus('Content package created. Opening review…', true);
    setTimeout(function(){ location.href = json.reviewUrl || '/api/pharmacy-asset-review?slug=' + encodeURIComponent(SLUG) + '&service=' + encodeURIComponent(SERVICE); }, 800);
  } else {
    setStatus(json.error || 'We could not create your content package. Please contact support.', false);
    btn.disabled = false;
  }
});
</script>
</body></html>`;
}

router.get("/pharmacy-content-package", (req, res) => {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const serviceId = String(req.query.service || req.query.serviceId || "pharmacy-first");
  res.redirect(
    302,
    `/api/growth-engine/campaign-builder?slug=${encodeURIComponent(slug)}&step=choose&campaign=${encodeURIComponent(serviceId)}`,
  );
});

export default router;
