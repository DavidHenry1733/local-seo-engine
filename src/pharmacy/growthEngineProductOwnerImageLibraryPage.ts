/**
 * PRODUCT-OWNER-IMAGE-LIBRARY-UI-CONNECTION-43C
 *
 * Customer-facing Image Library page. Uses the Task-43B tenant library
 * contract and APIs. Product Owner manages the pool; the engine places images.
 */
import {
  commercialBlueChromeGradientCss,
  commercialBlueUiBaselineCss,
  withCommercialBlueUiBaseline,
} from "./pharmacyCommercialBlueUiBaseline.ts";
import {
  buildTenantImageLibraryView,
  MAX_ACTIVE_TENANT_IMAGES,
  publicTenantImageUrl,
  type TenantImageLibraryRecord,
  type TenantImageSourceType,
} from "./pharmacyTenantImageLibraryContract.ts";
import { tenantImageLibraryPanelCss, tenantImageLibraryPanelScript } from "./pharmacyTenantImageLibraryPanel.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

const SOURCE_LABEL: Record<TenantImageSourceType, string> = {
  "customer-upload": "Your photo",
  "website-import": "Website import",
  "approved-stock": "Approved stock",
  "approved-ai": "Approved AI",
};

function customerStatusLabel(img: TenantImageLibraryRecord): string {
  if (img.approvalStatus !== "approved") return "Needs approval";
  return img.active ? "Approved · In use" : "Approved · Not in use";
}

function renderCards(images: TenantImageLibraryRecord[]): string {
  if (!images.length) {
    return `<p class="css-colour-meta">No photographs yet. Upload photos or add approved stock images.</p>`;
  }
  return images
    .map((img) => {
      const preview = publicTenantImageUrl(img);
      const thumb = preview
        ? `<img src="${esc(preview)}" alt=""/>`
        : `<div style="height:88px;border-radius:8px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b">No preview</div>`;
      const approve =
        img.approvalStatus !== "approved"
          ? `<button type="button" data-approve-image="${esc(img.imageId)}">Approve</button>`
          : "";
      const toggle = img.active
        ? `<button type="button" data-deactivate-image="${esc(img.imageId)}">Deactivate</button>`
        : img.approvalStatus === "approved"
          ? `<button type="button" data-activate-image="${esc(img.imageId)}">Activate</button>`
          : "";
      return `<article class="css-image-card" data-image-id="${esc(img.imageId)}">
${thumb}
<strong>${esc(img.originalFilename || "Photograph")}</strong>
<div class="css-colour-meta">${esc(SOURCE_LABEL[img.sourceType] || img.sourceType)}</div>
<div class="css-colour-meta">${esc(customerStatusLabel(img))}</div>
<div class="css-image-actions">${approve}${toggle}</div>
</article>`;
    })
    .join("");
}

export function renderProductOwnerImageLibraryPage(slug: string): string {
  const view = buildTenantImageLibraryView(slug);
  const dashboardUrl = `/api/growth-engine/dashboard?slug=${encodeURIComponent(slug)}`;
  const pendingWebsite = view.pendingWebsite;
  const approvedStock = view.library.images.filter((img) => img.sourceType === "approved-stock");
  return withCommercialBlueUiBaseline(`<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Your Image Library · PharmaConnect</title>
<style>
*{box-sizing:border-box}
body{font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;margin:0;background:linear-gradient(180deg,#f0f7ff 0%,#f0f4f8 40%);color:#0f172a;line-height:1.5;min-height:100vh}
${commercialBlueUiBaselineCss()}
${tenantImageLibraryPanelCss()}
.poil-shell{max-width:760px;margin:0 auto;padding:32px 24px 64px}
.poil-header{background:${commercialBlueChromeGradientCss()};border-radius:20px;padding:28px 32px;color:#fff;margin-bottom:24px;box-shadow:0 12px 40px rgba(0,94,184,.18)}
.poil-header h1{margin:0 0 10px;font-size:28px;font-weight:900;letter-spacing:-.02em}
.poil-header p{margin:0;font-size:15px;color:#dbeafe;line-height:1.55}
.poil-count{font-size:15px;font-weight:800;color:#0f172a;margin:0 0 14px}
.poil-actions{display:flex;flex-wrap:wrap;gap:10px;margin-top:22px}
.poil-btn{display:inline-flex;align-items:center;justify-content:center;padding:12px 18px;border-radius:10px;font-weight:800;font-size:14px;text-decoration:none;cursor:pointer;border:1px solid #005eb8;background:#005eb8;color:#fff}
.poil-btn.secondary{background:#fff;color:#005eb8}
.poil-note{margin:12px 0 0;font-size:13px;color:#64748b}
</style>
</head>
<body data-page="product-owner-image-library" data-image-library="v1" data-slug="${esc(slug)}">
<div class="poil-shell">
<header class="poil-header">
<h1>Your Image Library</h1>
<p>Add photographs for your pharmacy website. PharmaConnect will automatically choose suitable images for each service and local page.</p>
</header>
<section class="css-section css-image-library" aria-labelledby="image-library-heading">
<div class="css-section-head">
<h2 id="image-library-heading">Photographs</h2>
</div>
<p class="poil-count">${esc(String(view.activeCount))} of ${esc(String(MAX_ACTIVE_TENANT_IMAGES))}</p>
<p class="poil-note">Placement is automatic. You add photographs here; PharmaConnect chooses where they appear.</p>
<div class="css-image-upload">
<label for="tenantLibraryFiles">Upload photographs</label>
<input type="file" id="tenantLibraryFiles" accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg" multiple/>
</div>
<div class="css-image-actions" style="margin-top:10px">
<button type="button" id="includeStockBtn">Add approved stock images</button>
</div>
${
  pendingWebsite.length
    ? `<p class="poil-note">Website photographs waiting for your approval: ${esc(String(pendingWebsite.length))}.</p>`
    : ""
}
${
  approvedStock.length
    ? `<p class="poil-note">Approved stock images in your library: ${esc(String(approvedStock.length))}.</p>`
    : `<p class="poil-note">Approved stock images are available. Use Add approved stock images to include them.</p>`
}
<p class="poil-note">AI image generation is coming soon</p>
<div class="css-image-grid" id="tenantImageGrid">${renderCards(view.library.images)}</div>
<div class="poil-actions">
<button type="button" class="poil-btn" id="confirmImagesBtn">Save/Confirm Images</button>
<a class="poil-btn secondary" id="returnDashboardLink" href="${esc(dashboardUrl)}">Return to Dashboard</a>
</div>
</section>
</div>
<script>
${tenantImageLibraryPanelScript(slug)}
(function(){
  var dashboard = ${JSON.stringify(dashboardUrl)};
  var confirmBtn = document.getElementById('confirmImagesBtn');
  if (confirmBtn) confirmBtn.addEventListener('click', function(){ window.location.href = dashboard; });
  document.querySelectorAll('[data-activate-image]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var id = btn.getAttribute('data-activate-image');
      var res = await fetch('/api/pharmacy/image-library/' + encodeURIComponent(${JSON.stringify(slug)}) + '/tenant-library/' + encodeURIComponent(id) + '/activate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      var json = await res.json();
      if (!json.ok) { alert(json.error || 'Could not activate'); return; }
      window.location.reload();
    });
  });
})();
</script>
</body></html>`);
}
