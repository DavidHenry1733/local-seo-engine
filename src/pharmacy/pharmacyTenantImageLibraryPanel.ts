/**
 * Product Owner Image Library panel — no slot assignment.
 */
import {
  buildTenantImageLibraryView,
  MAX_ACTIVE_TENANT_IMAGES,
  publicTenantImageUrl,
} from "./pharmacyTenantImageLibraryContract.ts";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

export function tenantImageLibraryPanelCss(): string {
  return `
.css-image-library .css-image-count{font-size:13px;font-weight:800;color:#334155}
.css-image-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:12px;margin-top:14px}
.css-image-card{background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:10px;font-size:12px}
.css-image-card img{width:100%;height:88px;object-fit:cover;border-radius:8px;background:#fff;border:1px solid #e2e8f0}
.css-image-card .css-colour-meta{margin-top:6px;word-break:break-word}
.css-image-actions{display:flex;flex-wrap:wrap;gap:6px;margin-top:8px}
.css-image-actions button{padding:6px 8px;border-radius:8px;border:1px solid #cbd5e1;background:#fff;font-size:11px;font-weight:800;cursor:pointer}
.css-image-upload{margin-top:12px;font-size:13px;color:#334155}
`;
}

export function renderTenantImageLibraryPanel(slug: string): string {
  const view = buildTenantImageLibraryView(slug);
  const cards = view.library.images
    .map((img) => {
      const preview = publicTenantImageUrl(img);
      const thumb = preview
        ? `<img src="${esc(preview)}" alt=""/>`
        : `<div style="height:88px;border-radius:8px;border:1px dashed #cbd5e1;display:flex;align-items:center;justify-content:center;color:#64748b">No preview</div>`;
      const approve =
        img.approvalStatus !== "approved"
          ? `<button type="button" data-approve-image="${esc(img.imageId)}">Approve</button>`
          : "";
      const deactivate = img.active
        ? `<button type="button" data-deactivate-image="${esc(img.imageId)}">Deactivate</button>`
        : "";
      return `<article class="css-image-card" data-image-id="${esc(img.imageId)}">
${thumb}
<strong>${esc(img.originalFilename || img.imageId)}</strong>
<div class="css-colour-meta">${esc(img.sourceType)} · ${esc(img.approvalStatus)} · ${esc(img.licenceProvenanceStatus)} · ${img.active ? "active" : "inactive"}</div>
<div class="css-image-actions">${approve}${deactivate}</div>
</article>`;
    })
    .join("");
  const pendingAi = view.pendingAi.length
    ? `<p class="css-colour-meta">AI requests recorded: ${esc(String(view.pendingAi.length))} pending. They are not generated here and are never selected until an approved AI asset exists.</p>`
    : `<p class="css-colour-meta">AI image requests are recorded only. This screen does not generate images.</p>`;
  return `<section class="css-section css-image-library" aria-labelledby="image-library-heading" data-image-library="v1">
<div class="css-section-head">
<h2 id="image-library-heading">Image Library</h2>
<span class="css-badge imported">${esc(String(view.activeCount))} / ${esc(String(MAX_ACTIVE_TENANT_IMAGES))} active</span>
</div>
<p style="margin:0 0 10px;font-size:13px;color:#64748b">Upload or approve images. The engine places suitable photos automatically. You do not assign hero, support, trust, conversion or locality slots.</p>
<div class="css-image-count">Active images: ${esc(String(view.activeCount))} of ${esc(String(MAX_ACTIVE_TENANT_IMAGES))}</div>
<div class="css-image-upload">
<label for="tenantLibraryFiles">Upload images</label>
<input type="file" id="tenantLibraryFiles" accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg" multiple/>
</div>
<div class="css-image-actions" style="margin-top:10px">
<button type="button" id="includeStockBtn">Include approved stock images</button>
</div>
${pendingAi}
<div class="css-image-grid" id="tenantImageGrid">${cards || `<p class="css-colour-meta">No tenant images yet. Upload photos or include approved stock.</p>`}</div>
</section>`;
}

export function tenantImageLibraryPanelScript(slug: string): string {
  return `
(function(){
  var SLUG = ${JSON.stringify(slug)};
  var BASE = '/api/pharmacy/image-library/' + encodeURIComponent(SLUG) + '/tenant-library';
  async function reloadLibrary(){ window.location.reload(); }
  var files = document.getElementById('tenantLibraryFiles');
  if (files) files.addEventListener('change', async function(){
    if (!this.files || !this.files.length) return;
    var data = new FormData();
    for (var i = 0; i < this.files.length; i++) data.append('files', this.files[i]);
    var res = await fetch(BASE + '/upload', { method: 'POST', credentials: 'same-origin', body: data });
    var json = await res.json();
    if (!json.ok && !json.library) { alert(json.error || 'Upload failed'); return; }
    reloadLibrary();
  });
  var stock = document.getElementById('includeStockBtn');
  if (stock) stock.addEventListener('click', async function(){
    var res = await fetch(BASE + '/include-stock', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    var json = await res.json();
    if (!json.ok) { alert(json.error || 'Could not include stock images'); return; }
    reloadLibrary();
  });
  document.querySelectorAll('[data-deactivate-image]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var id = btn.getAttribute('data-deactivate-image');
      var res = await fetch(BASE + '/' + encodeURIComponent(id) + '/deactivate', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      var json = await res.json();
      if (!json.ok) { alert(json.error || 'Could not deactivate'); return; }
      reloadLibrary();
    });
  });
  document.querySelectorAll('[data-approve-image]').forEach(function(btn){
    btn.addEventListener('click', async function(){
      var id = btn.getAttribute('data-approve-image');
      var res = await fetch(BASE + '/' + encodeURIComponent(id) + '/approve', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: '{}' });
      var json = await res.json();
      if (!json.ok) { alert(json.error || 'Could not approve'); return; }
      reloadLibrary();
    });
  });
})();
`;
}
