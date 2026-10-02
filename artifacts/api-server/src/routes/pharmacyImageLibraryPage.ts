/**
 * PharmaConnect Image Library — campaign image selection workflow.
 * Adapted from Local SEO Engine cpLoadImageLibrary / imgLibLoad patterns.
 * Route: GET /api/pharmacy-image-library (mounted under /api in app.ts)
 */
import { Router, type Request, type Response } from "express";
import {
  buildImageOperatingSystemDashboard,
  IMAGE_MATRIX_SLOTS,
  PAGE_IMAGE_SLOTS,
  resolveImageLibraryServiceId,
  type ImageOperatingSystemDashboard,
  type LibraryImageOption,
  type MatrixCellStatus,
  type PageSlotCard,
} from "../../../../src/pharmacy/pharmacyImageOperatingSystem.ts";
import {
  platformPlatformNavCss,
  renderPharmacyPlatformNavBar,
  renderPlatformWorkflowBar,
} from "../../../../src/pharmacy/pharmacyPlatformNav.ts";
import { buildPlatformOperatingSystem } from "../../../../src/pharmacy/pharmacyPlatformOperatingSystemService.ts";
import { tenantSlugOrRespond } from "../../../../src/pharmacy/pharmacyTenantSlug.ts";
import { renderProductOwnerImageLibraryPage } from "../../../../src/pharmacy/growthEngineProductOwnerImageLibraryPage.ts";

const router = Router();
const IMAGE_LIBRARY_PATH = "/api/pharmacy-image-library";

function esc(v: unknown): string {
  return String(v ?? "").replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[m] || m));
}

function safeSlug(v: string): string {
  return String(v || "pharmaconnect")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "pharmaconnect";
}

function imageLibraryUrl(slug: string, serviceId: string, slot?: string, campaignId?: string): string {
  const params = new URLSearchParams({ slug, service: serviceId });
  if (slot) params.set("slot", slot);
  if (campaignId) params.set("campaignId", campaignId);
  return `${IMAGE_LIBRARY_PATH}?${params.toString()}`;
}

function renderSlotCard(card: PageSlotCard, slug: string, campaignId: string | null): string {
  const statusCls = card.status === "assigned" ? "ok" : card.status === "pending" ? "pending" : "missing";
  const thumb = card.previewUrl
    ? `<img src="${esc(card.previewUrl)}" alt="${esc(card.altText)}" loading="lazy"/>`
    : `<div class="thumb-empty">${card.status === "pending" ? "AI pending" : "No image"}</div>`;
  const sourceLabel = card.sourceType ? esc(String(card.sourceType)) : "missing";
  return `<article class="slot-card ${statusCls}" data-slot="${esc(card.slot)}">
  <header><strong>${esc(card.slot)}</strong><span class="badge badge-${statusCls}">${card.assigned ? esc(card.status) : "missing"}</span></header>
  <div class="slot-preview">${thumb}</div>
  <div class="slot-meta">
    <div><span class="label">Source</span> ${sourceLabel}</div>
    ${card.libraryRef ? `<div class="mono">${esc(card.libraryRef)}</div>` : ""}
  </div>
  <button type="button" class="btn btn-sm slot-change-btn" data-slot="${esc(card.slot)}">Change image</button>
</article>`;
}

function renderLibraryGrid(
  images: LibraryImageOption[],
  serviceId: string,
  slot: string,
): string {
  if (!images.length) return `<p class="muted">No library images match this filter.</p>`;
  return `<div class="library-grid">${images
    .map(
      (img) => `<div class="library-card" data-library-ref="${esc(img.libraryRef)}" data-image-pack="${esc(img.imagePack)}" data-service-id="${esc(serviceId)}" data-slot="${esc(slot)}">
  <div class="library-thumb">${img.assetExists ? `<img src="/${esc(img.assetPath)}" alt="" loading="lazy"/>` : "—"}</div>
  <div class="library-meta">
    <strong class="mono">${esc(img.libraryRef)}</strong>
    <span class="muted pack-label">pack: ${esc(img.imagePack)}</span>
  </div>
  <button type="button" class="btn btn-sm library-assign-btn" data-library-ref="${esc(img.libraryRef)}">Assign to slot</button>
</div>`,
    )
    .join("")}</div>`;
}

function renderUploadList(d: ImageOperatingSystemDashboard): string {
  if (!d.uploads.length) return `<p class="muted">No uploads yet.</p>`;
  return `<ul class="upload-list">${d.uploads
    .map(
      (u) => `<li>
  <img src="/${esc(u.path)}" alt="" class="upload-mini" loading="lazy"/>
  <span><code>${esc(u.filename)}</code> · ${esc(u.category)}</span>
  <button type="button" class="btn btn-sm upload-assign-btn" data-upload-id="${esc(u.id)}">Assign to selected slot</button>
</li>`,
    )
    .join("")}</ul>`;
}

function renderAiList(d: ImageOperatingSystemDashboard): string {
  if (!d.aiRequests.length) return `<p class="muted">No AI requests yet.</p>`;
  return `<ul class="ai-list">${d.aiRequests
    .map(
      (r) => `<li>
  <span class="badge badge-${esc(r.status)}">${esc(r.status)}</span>
  <strong>${esc(r.serviceId)} / ${esc(r.slot)}</strong>
  <em class="muted">${esc(r.prompt.slice(0, 100))}…</em>
</li>`,
    )
    .join("")}</ul>`;
}

function renderMatrix(d: ImageOperatingSystemDashboard): string {
  const pageSlots = new Set(PAGE_IMAGE_SLOTS);
  const activeIds = new Set(
    (d.serviceCatalog || []).filter((channel) => channel.status === "active").map((channel) => channel.serviceId),
  );
  const byService = new Map<string, MatrixCellStatus[]>();
  for (const cell of d.matrix) {
    if (!pageSlots.has(cell.slot as (typeof PAGE_IMAGE_SLOTS)[number])) continue;
    if (!activeIds.has(cell.serviceId)) continue;
    if (!byService.has(cell.serviceId)) byService.set(cell.serviceId, []);
    byService.get(cell.serviceId)!.push(cell);
  }
  const header = `<tr><th>Service</th>${PAGE_IMAGE_SLOTS.map((s) => `<th>${esc(s)}</th>`).join("")}</tr>`;
  const rows = [...byService.entries()]
    .map(([serviceId, cells]) => {
      const name = cells[0]?.serviceName || serviceId;
      const cols = PAGE_IMAGE_SLOTS.map((slot) => {
        const cell = cells.find((c) => c.slot === slot);
        if (!cell) return `<td class="cell-missing">—</td>`;
        return `<td class="${cell.assigned ? "cell-assigned" : "cell-missing"}">
<a class="cell-link" href="${esc(imageLibraryUrl(d.slug, serviceId, slot, d.selectedCampaignId || undefined))}" title="${esc(cell.source)}">${cell.assigned ? "✓" : "○"}</a>
</td>`;
      }).join("");
      return `<tr><td><strong>${esc(name)}</strong><br><code>${esc(serviceId)}</code></td>${cols}</tr>`;
    })
    .join("");
  return `<table class="matrix"><thead>${header}</thead><tbody>${rows}</tbody></table>`;
}

export function renderImageLibraryDashboardHtml(
  d: ImageOperatingSystemDashboard,
  initialSlot: string,
): string {
  const primary = d.brandPrimaryColor || "#1a5c42";
  const visualUrl = `/api/pharmacy-visual-experience/${esc(d.selectedServiceId)}/?slug=${esc(d.slug)}&rebuild=1`;
  const campaignUrl = `/api/pharmacy-campaigns?slug=${esc(d.slug)}`;
  const os = buildPlatformOperatingSystem(d.slug);
  const bd = d.sourceBreakdown;
  const assignedPage = d.pageSlots.filter((p) => p.status === "assigned").length;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Image Library — ${esc(d.pharmacyName)}</title>
<style>
:root{--primary:${esc(primary)};--ok:#059669;--warn:#d97706;--miss:#dc2626}
*{box-sizing:border-box}
body{font-family:Inter,Arial,sans-serif;margin:0;background:#f0f4f8;color:#0f172a;line-height:1.5}
header{background:linear-gradient(135deg,#0f172a,var(--primary));color:#fff;padding:24px 28px}
header h1{margin:0;font-size:24px;font-weight:800}
header p{margin:8px 0 0;color:#dbeafe;font-size:14px}
.toolbar{display:flex;flex-wrap:wrap;gap:8px;margin-top:14px}
.toolbar a{border:0;border-radius:8px;padding:9px 14px;font-weight:700;font-size:13px;text-decoration:none;background:rgba(255,255,255,.15);color:#fff}
main{max-width:1280px;margin:24px auto 48px;padding:0 20px}
section{background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:22px 24px;margin-bottom:20px;box-shadow:0 2px 12px rgba(15,23,42,.04)}
section h2{margin:0 0 8px;font-size:18px}
section .lead{margin:0 0 16px;font-size:13px;color:#64748b}
.stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:12px;margin-bottom:16px}
.stat{background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:12px;text-align:center}
.stat strong{display:block;font-size:22px;color:var(--primary)}
.stat span{font-size:11px;color:#64748b;text-transform:uppercase;font-weight:700}
.field{margin-bottom:12px}
.field label{display:block;font-size:13px;font-weight:600;margin-bottom:4px}
.field input,.field select,.field textarea{width:100%;padding:10px;border:1px solid #cbd5e1;border-radius:8px;font-size:14px}
.btn{display:inline-block;background:var(--primary);color:#fff;border:0;border-radius:8px;padding:10px 16px;font-weight:700;font-size:14px;cursor:pointer}
.btn-sm{padding:7px 12px;font-size:12px}
.btn-secondary{background:#64748b}
.btn-outline{background:#fff;color:var(--primary);border:1px solid var(--primary)}
.badge{display:inline-block;padding:3px 8px;border-radius:999px;font-size:10px;font-weight:700;text-transform:uppercase}
.badge-ok,.badge-assigned{background:#d1fae5;color:#065f46}
.badge-pending,.badge-pending{background:#fef3c7;color:#92400e}
.badge-missing{background:#fee2e2;color:#991b1b}
.slot-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:16px}
.slot-card{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fafbfc}
.slot-card.ok{border-color:#a7f3d0}
.slot-card.pending{border-color:#fde68a}
.slot-card.missing{border-color:#fecaca}
.slot-card header{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;text-transform:capitalize}
.slot-preview{min-height:100px;border-radius:8px;overflow:hidden;background:#f1f5f9;display:flex;align-items:center;justify-content:center;margin-bottom:10px}
.slot-preview img{max-width:100%;max-height:120px;object-fit:contain}
.thumb-empty{font-size:12px;color:#94a3b8;padding:20px;text-align:center}
.slot-meta{font-size:12px;color:#64748b;margin-bottom:10px}
.slot-meta .label{font-weight:700;color:#475569}
.panel-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px}
@media(max-width:900px){.panel-grid{grid-template-columns:1fr}}
.library-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:12px;max-height:420px;overflow-y:auto;padding:4px}
.library-card{border:1px solid #e2e8f0;border-radius:10px;padding:10px;background:#fff}
.library-thumb{height:80px;display:flex;align-items:center;justify-content:center;background:#f8fafc;border-radius:6px;margin-bottom:8px;overflow:hidden}
.library-thumb img{max-height:76px;max-width:100%;object-fit:contain}
.library-meta{font-size:11px;margin-bottom:8px}
.library-meta strong{display:block;font-size:10px;word-break:break-all}
.filter-bar{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:14px}
.filter-bar .field{margin:0;flex:1;min-width:140px}
.matrix{width:100%;border-collapse:collapse;font-size:12px}
.matrix th,.matrix td{border:1px solid #e2e8f0;padding:8px;text-align:center}
.matrix th{background:#f1f5f9;font-size:11px;text-transform:uppercase}
.cell-assigned{background:#ecfdf5}
.cell-missing{background:#fef2f2}
.cell-link{color:inherit;text-decoration:none;font-size:16px;display:block}
.upload-list,.ai-list{font-size:13px;padding:0;margin:0;list-style:none}
.upload-list li,.ai-list li{display:flex;flex-wrap:wrap;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid #f1f5f9}
.upload-mini{width:48px;height:48px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0}
.mono{font-family:ui-monospace,monospace;font-size:11px}
.muted{color:#64748b}
#statusMsg{margin-top:12px;padding:10px 14px;border-radius:8px;font-size:13px;display:none}
#statusMsg.show{display:block}
#statusMsg.ok{background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0}
#statusMsg.err{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
.preview-links{display:flex;flex-wrap:wrap;gap:10px;margin-top:12px}
.active-slot{outline:2px solid var(--primary);outline-offset:2px}
.library-card.library-selected{border-color:var(--primary);box-shadow:0 0 0 2px rgba(26,92,66,.15)}
.library-preview{margin-top:12px;padding:12px;border:1px solid #e2e8f0;border-radius:10px;background:#f8fafc;min-height:80px}
.library-preview img{max-height:160px;max-width:100%;object-fit:contain;display:block;margin:0 auto 8px}
${platformPlatformNavCss()}
</style>
</head>
<body>
<header>
  <h1>Pharmacy Image Library</h1>
  <p>${esc(d.pharmacyName)} · slug: <code>${esc(d.slug)}</code>${d.selectedCampaignId ? ` · campaign: <code>${esc(d.selectedCampaignId)}</code>` : ""}</p>
  <div class="toolbar"></div>
  ${renderPharmacyPlatformNavBar({ slug: d.slug, serviceId: d.selectedServiceId, activeId: "images" })}
</header>
<main>
${renderPlatformWorkflowBar({ slug: d.slug, nextStepUrl: os.nextStep?.url })}
<section id="master-stock">
  <h2>Master Stock Images</h2>
  <p class="lead">Upload a pool of stock images once, then auto-fill service slots. Existing explicit assignments are preserved unless you choose overwrite.</p>
  <div class="panel-grid">
    <div>
      <div class="field"><label>Upload multiple images</label><input type="file" id="masterStockFiles" accept=".jpg,.jpeg,.png,.webp,.svg,image/*" multiple/></div>
      <div class="field"><label>Image types (comma-separated)</label><input type="text" id="masterStockTypes" value="hero,support,trust,conversion" placeholder="hero,support,trust"/></div>
      <div class="field"><label>Subjects (comma-separated)</label><input type="text" id="masterStockSubjects" value="pharmacist,consultation,medicines" placeholder="pharmacist,patient-care"/></div>
      <button type="button" class="btn" id="masterStockUploadBtn">Upload master stock</button>
    </div>
    <div>
      <button type="button" class="btn btn-secondary" id="autoFillBtn">Auto-fill this service</button>
      <button type="button" class="btn btn-secondary" id="autoFillAllBtn" style="margin-left:8px">Auto-fill all services</button>
      <button type="button" class="btn btn-secondary" id="confirmBrandBtn" style="margin-left:8px">Confirm Brand &amp; Images</button>
      <p class="muted" style="margin-top:10px">Each slot still supports stock library, upload, AI, or master stock assignment individually below.</p>
      <div id="masterStockList" class="muted" style="margin-top:12px">Loading master stock…</div>
    </div>
  </div>
</section>
<section id="overview">
  <h2>Overview</h2>
  <p class="lead">Assign hero, support, trust and conversion images for each service campaign.</p>
  <div class="stats">
    <div class="stat"><strong>${assignedPage}/4</strong><span>Page slots</span></div>
    <div class="stat"><strong>${bd.library}</strong><span>Library</span></div>
    <div class="stat"><strong>${bd.upload}</strong><span>Uploads</span></div>
    <div class="stat"><strong>${bd.ai + bd.pending}</strong><span>AI</span></div>
    <div class="stat"><strong>${bd.missing}</strong><span>Missing</span></div>
    <div class="stat"><strong>${d.overview.libraryImageCount}</strong><span>In library</span></div>
  </div>
  <div class="preview-links">
    <a class="btn btn-outline" href="${visualUrl}" target="_blank" rel="noopener">View visual page</a>
    <a class="btn btn-outline" href="${campaignUrl}">View campaign</a>
    <a class="btn btn-outline" href="#matrix">View image matrix</a>
  </div>
</section>

<section id="service-selector">
  <h2>1. Service selector</h2>
  <input type="hidden" id="pageSlug" value="${esc(d.slug)}"/>
  <input type="hidden" id="pageServiceId" value="${esc(d.selectedServiceId)}"/>
  <input type="hidden" id="pageSlot" value="${esc(initialSlot || "hero")}"/>
  <div class="field">
    <label for="imageLibraryServiceSelect">Service</label>
    <select id="imageLibraryServiceSelect">${d.serviceCatalog
      .filter((s) => s.status === "active")
      .map(
        (s) =>
          `<option value="${esc(s.serviceId)}" ${s.serviceId === d.selectedServiceId ? "selected" : ""}>${esc(s.serviceName)}</option>`,
      )
      .join("")}</select>
  </div>
</section>

<section id="slot-grid">
  <h2>2. Slot grid</h2>
  <p class="lead">Required page slots — click Change to assign library, upload or AI images.</p>
  <div class="slot-grid" id="slotGrid">${d.pageSlots.map((c) => renderSlotCard(c, d.slug, d.selectedCampaignId)).join("")}</div>
</section>

<section id="assignment-panel">
  <h2>3. Assign image to slot</h2>
  <p class="lead">Selected slot: <strong id="selectedSlotLabel">${esc(initialSlot || "hero")}</strong></p>
  <input type="hidden" id="selectedSlot" value="${esc(initialSlot || "hero")}"/>
  <div class="panel-grid">
    <div>
      <h3>Library picker</h3>
      <div class="filter-bar">
        <div class="field"><label>Category</label><select id="filterCategory"><option value="">All</option>${PAGE_IMAGE_SLOTS.map((s) => `<option value="${esc(s)}">${esc(s)}</option>`).join("")}</select></div>
        <div class="field"><label>&nbsp;</label><button type="button" class="btn btn-secondary" id="reloadLibraryBtn">Filter</button></div>
      </div>
      <div id="libraryGrid">${renderLibraryGrid(d.libraryImages.filter((l) => l.assetExists), d.selectedServiceId, initialSlot || "hero")}</div>
      <div id="libraryImagePreview" class="library-preview muted">Click a library image to preview. Assign uses the selected service above — not the image pack.</div>
    </div>
    <div>
      <h3>Upload panel</h3>
      <div class="field"><label>Upload image (jpg, png, webp, svg)</label><input type="file" id="uploadFile" accept=".jpg,.jpeg,.png,.webp,.svg,image/*"/></div>
      <button type="button" class="btn" id="uploadBtn">Upload &amp; assign</button>
      <h3 style="margin-top:20px">AI image request</h3>
      <div class="field"><label>Prompt preview</label><textarea id="aiPrompt" rows="4"></textarea></div>
      <button type="button" class="btn btn-secondary" id="previewPromptBtn">Preview prompt</button>
      <button type="button" class="btn btn-secondary" id="aiBtn" style="margin-left:8px">Generate With AI</button>
      <p class="muted" style="font-size:12px;margin-top:8px">Saves request with status <code>pending</code>. External provider not called until configured.</p>
    </div>
  </div>
  <div id="statusMsg"></div>
</section>

<section id="uploads">
  <h2>4. Uploads (${d.uploads.length})</h2>
  ${renderUploadList(d)}
</section>

<section id="ai">
  <h2>5. AI requests (${d.aiRequests.length})</h2>
  ${renderAiList(d)}
</section>

<section id="matrix">
  <h2>6. Image matrix (page slots)</h2>
  <p class="lead">Click a cell to open assignment for that service and slot.</p>
  ${renderMatrix(d)}
</section>
</main>
<script>
var SLUG = ${JSON.stringify(d.slug)};
var CAMPAIGN_ID = ${JSON.stringify(d.selectedCampaignId)};
var SERVICE_ID = ${JSON.stringify(d.selectedServiceId)};
var SELECTED_SLOT = ${JSON.stringify(initialSlot || "hero")};
var IMAGE_LIBRARY_PATH = ${JSON.stringify(IMAGE_LIBRARY_PATH)};

function imageLibraryPageUrl(service, slot){
  var params = new URLSearchParams({ slug: SLUG, service: service || selectedService(), slot: slot || selectedSlot() });
  if (CAMPAIGN_ID) params.set('campaignId', CAMPAIGN_ID);
  return IMAGE_LIBRARY_PATH + '?' + params.toString();
}

function canonicalServiceId(){
  var pageSvc = document.getElementById('pageServiceId');
  if (pageSvc && pageSvc.value) return pageSvc.value;
  if (typeof SERVICE_ID === 'string' && SERVICE_ID) return SERVICE_ID;
  var sel = document.getElementById('imageLibraryServiceSelect');
  return sel && sel.value ? sel.value : SERVICE_ID;
}

function syncPageState(){
  var svc = document.getElementById('pageServiceId');
  var slotEl = document.getElementById('pageSlot');
  if (svc) svc.value = canonicalServiceId();
  if (slotEl) slotEl.value = selectedSlot();
}

function setStatus(msg, ok){
  var el = document.getElementById('statusMsg');
  el.textContent = msg;
  el.className = 'show ' + (ok ? 'ok' : 'err');
}

function selectedSlot(){ return document.getElementById('selectedSlot').value; }
function selectedService(){ return canonicalServiceId(); }

function highlightSlot(slot){
  document.getElementById('selectedSlot').value = slot;
  document.getElementById('selectedSlotLabel').textContent = slot;
  document.querySelectorAll('.slot-card').forEach(function(c){
    c.classList.toggle('active-slot', c.getAttribute('data-slot') === slot);
  });
  syncPageState();
  history.replaceState(null, '', imageLibraryPageUrl(canonicalServiceId(), slot));
  document.getElementById('assignment-panel').scrollIntoView({behavior:'smooth'});
}

function selectLibraryCard(card){
  if (!card) return;
  document.querySelectorAll('.library-card').forEach(function(c){ c.classList.remove('library-selected'); });
  card.classList.add('library-selected');
  var ref = card.getAttribute('data-library-ref') || '';
  var pack = card.getAttribute('data-image-pack') || '';
  var img = card.querySelector('img');
  var preview = document.getElementById('libraryImagePreview');
  if (preview) {
    preview.innerHTML = (img ? '<img src="' + img.src + '" alt=""/>' : '') +
      '<p class="mono">' + ref + '</p>' +
      '<p class="muted">serviceId: <code>' + canonicalServiceId() + '</code> · pack: <code>' + pack + '</code> · slot: <code>' + selectedSlot() + '</code></p>';
  }
}

function bindLibraryCards(){
  document.querySelectorAll('.library-card').forEach(function(card){
    card.onclick = function(ev){
      if (ev.target && ev.target.closest && ev.target.closest('.library-assign-btn')) return;
      selectLibraryCard(card);
    };
  });
  document.querySelectorAll('.library-assign-btn').forEach(function(btn){
    btn.onclick = function(ev){
      ev.stopPropagation();
      var card = btn.closest('.library-card');
      if (card) selectLibraryCard(card);
      assignLibrary(btn.getAttribute('data-library-ref'));
    };
  });
}

function applyDashboard(dashboard){
  if (!dashboard) return location.reload();
  var grid = document.getElementById('slotGrid');
  var slots = dashboard.pageSlots || [];
  grid.innerHTML = slots.map(function(card){
    var statusCls = card.status === 'assigned' ? 'ok' : card.status === 'pending' ? 'pending' : 'missing';
    var thumb = card.previewUrl
      ? '<img src="' + card.previewUrl + '" alt="" loading="lazy"/>'
      : '<div class="thumb-empty">' + (card.status === 'pending' ? 'AI pending' : 'No image') + '</div>';
    return '<article class="slot-card ' + statusCls + '" data-slot="' + card.slot + '"><header><strong>' + card.slot + '</strong><span class="badge badge-' + statusCls + '">' + (card.assigned ? card.status : 'missing') + '</span></header><div class="slot-preview">' + thumb + '</div><div class="slot-meta"><div><span class="label">Source</span> ' + (card.sourceType || 'missing') + '</div></div><button type="button" class="btn btn-sm slot-change-btn" data-slot="' + card.slot + '">Change image</button></article>';
  }).join('');
  bindSlotButtons();
  highlightSlot(selectedSlot());
}

function bindSlotButtons(){
  document.querySelectorAll('.slot-change-btn').forEach(function(btn){
    btn.onclick = function(){ highlightSlot(btn.getAttribute('data-slot')); loadLibrary(); };
  });
}

async function loadLibrary(){
  syncPageState();
  var slot = selectedSlot();
  var service = canonicalServiceId();
  var cat = document.getElementById('filterCategory').value;
  var url = '/api/pharmacy/image-library/' + SLUG + '/library?service=' + encodeURIComponent(service) + '&slot=' + encodeURIComponent(slot);
  if (cat) url += '&category=' + encodeURIComponent(cat);
  var res = await fetch(url, {credentials:'same-origin'});
  var json = await res.json();
  var grid = document.getElementById('libraryGrid');
  if (!json.ok || !json.images.length) {
    grid.innerHTML = '<p class="muted">No library images match this filter.</p>';
    return;
  }
  grid.innerHTML = '<div class="library-grid">' + json.images.map(function(img){
    return '<div class="library-card" data-library-ref="' + img.libraryRef + '" data-image-pack="' + img.imagePack + '" data-service-id="' + service + '" data-slot="' + slot + '"><div class="library-thumb"><img src="/' + img.assetPath + '" alt="" loading="lazy"/></div><div class="library-meta"><strong class="mono">' + img.libraryRef + '</strong><span class="muted pack-label">pack: ' + img.imagePack + '</span></div><button type="button" class="btn btn-sm library-assign-btn" data-library-ref="' + img.libraryRef + '">Assign to slot</button></div>';
  }).join('') + '</div>';
  bindLibraryCards();
}

async function assignLibrary(libraryRef){
  syncPageState();
  var serviceId = canonicalServiceId();
  var slot = selectedSlot();
  var body = { serviceId: serviceId, slot: slot, source: 'library', libraryRef: libraryRef };
  if (CAMPAIGN_ID) body.campaignId = CAMPAIGN_ID;
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/assign', {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(body)
  });
  var json = await res.json();
  setStatus(json.ok ? (json.message || 'Image assigned successfully.') : (json.error || 'Failed'), json.ok);
  if (json.ok) applyDashboard(json.dashboard);
}

async function uploadAndAssign(){
  syncPageState();
  var file = document.getElementById('uploadFile').files[0];
  if (!file) { setStatus('Choose a file first', false); return; }
  var fd = new FormData();
  fd.append('file', file);
  fd.append('serviceId', canonicalServiceId());
  fd.append('slot', selectedSlot());
  fd.append('category', selectedSlot());
  if (CAMPAIGN_ID) fd.append('campaignId', CAMPAIGN_ID);
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/upload', { method:'POST', credentials:'same-origin', body: fd });
  var json = await res.json();
  setStatus(json.ok ? (json.message || 'Image assigned successfully.') : (json.error || 'Upload failed'), json.ok);
  if (json.ok) location.reload();
}

async function previewPrompt(){
  syncPageState();
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/preview-prompt', {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin',
    body: JSON.stringify({ serviceId: canonicalServiceId(), slot: selectedSlot(), category: selectedSlot() })
  });
  var json = await res.json();
  if (json.ok) document.getElementById('aiPrompt').value = json.prompt;
  else setStatus(json.error || 'Failed', false);
}

async function createAiRequest(){
  syncPageState();
  var prompt = document.getElementById('aiPrompt').value.trim();
  var body = { serviceId: canonicalServiceId(), slot: selectedSlot(), category: selectedSlot(), assignToSlot: true };
  if (prompt) body.prompt = prompt;
  if (CAMPAIGN_ID) body.campaignId = CAMPAIGN_ID;
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/ai-request', {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(body)
  });
  var json = await res.json();
  setStatus(json.ok ? (json.message || 'AI request created.') : (json.error || 'Failed'), json.ok);
  if (json.ok) applyDashboard(json.dashboard);
}

document.getElementById('imageLibraryServiceSelect').addEventListener('change', function(){
  var svc = document.getElementById('imageLibraryServiceSelect').value;
  document.getElementById('pageServiceId').value = svc;
  location.href = imageLibraryPageUrl(svc, selectedSlot());
});

document.getElementById('reloadLibraryBtn').addEventListener('click', loadLibrary);
document.getElementById('uploadBtn').addEventListener('click', uploadAndAssign);
document.getElementById('previewPromptBtn').addEventListener('click', previewPrompt);
document.getElementById('aiBtn').addEventListener('click', createAiRequest);

document.querySelectorAll('.upload-assign-btn').forEach(function(btn){
  btn.onclick = function(){
    highlightSlot(selectedSlot());
    assignUpload(btn.getAttribute('data-upload-id'));
  };
});

async function assignUpload(uploadId){
  syncPageState();
  var body = { serviceId: canonicalServiceId(), slot: selectedSlot(), source: 'upload', uploadId: uploadId };
  if (CAMPAIGN_ID) body.campaignId = CAMPAIGN_ID;
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/assign', {
    method:'POST', headers:{'Content-Type':'application/json'}, credentials:'same-origin', body: JSON.stringify(body)
  });
  var json = await res.json();
  setStatus(json.ok ? 'Image assigned successfully.' : (json.error || 'Failed'), json.ok);
  if (json.ok) applyDashboard(json.dashboard);
}

bindSlotButtons();
bindLibraryCards();
highlightSlot(SELECTED_SLOT);
syncPageState();
previewPrompt();
loadLibrary();

async function loadMasterStock(){
  var el = document.getElementById('masterStockList');
  if (!el) return;
  try {
    var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/master-stock', { credentials: 'same-origin' });
    var json = await res.json();
    if (!json.ok || !json.store || !(json.store.images || []).length) {
      el.textContent = 'No master stock images yet. Upload above.';
      return;
    }
    el.innerHTML = json.store.images.map(function(img){
      var src = img.path ? (img.path.charAt(0) === '/' ? img.path : '/' + img.path) : '';
      return '<span style="display:inline-block;margin:4px;text-align:center;font-size:11px;vertical-align:top">' +
        (src ? '<img src="' + src + '" alt="" style="width:72px;height:54px;object-fit:cover;border-radius:6px;border:1px solid #e2e8f0"/>' : '') +
        '<div style="max-width:72px;overflow:hidden;text-overflow:ellipsis">' + (img.label || img.filename) + '</div></span>';
    }).join('');
  } catch (e) {
    el.textContent = 'Could not load master stock.';
  }
}

document.getElementById('masterStockUploadBtn').onclick = async function(){
  var input = document.getElementById('masterStockFiles');
  if (!input.files || !input.files.length) { setStatus('Choose one or more images.', false); return; }
  var fd = new FormData();
  for (var i = 0; i < input.files.length; i++) fd.append('files', input.files[i]);
  fd.append('types', document.getElementById('masterStockTypes').value);
  fd.append('subjects', document.getElementById('masterStockSubjects').value);
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/master-stock/upload', { method: 'POST', body: fd, credentials: 'same-origin' });
  var json = await res.json();
  setStatus(json.ok ? ('Uploaded ' + (json.created || []).length + ' master stock image(s).') : (json.error || 'Upload failed'), json.ok);
  if (json.ok) { input.value = ''; loadMasterStock(); }
};

async function runAutoFill(all){
  var res = await fetch('/api/pharmacy/image-library/' + SLUG + '/auto-fill', {
    method: 'POST', headers: {'Content-Type':'application/json'}, credentials: 'same-origin',
    body: JSON.stringify({ serviceId: all ? undefined : canonicalServiceId(), allServices: !!all })
  });
  var json = await res.json();
  setStatus(json.ok ? ('Auto-filled ' + json.assigned + ' slot(s), skipped ' + json.skipped + '.') : (json.error || 'Auto-fill failed'), json.ok);
  if (json.ok) location.reload();
}
document.getElementById('autoFillBtn').onclick = function(){ runAutoFill(false); };
document.getElementById('autoFillAllBtn').onclick = function(){ runAutoFill(true); };
document.getElementById('confirmBrandBtn').onclick = async function(){
  var res = await fetch('/api/pharmacy/asset-workflow/' + SLUG + '/' + canonicalServiceId() + '/confirm-brand', {
    method: 'POST', credentials: 'same-origin', headers: {'Content-Type':'application/json'}
  });
  var json = await res.json();
  setStatus(json.ok ? 'Brand and images confirmed — continue to Generate Asset.' : (json.error || 'Failed'), json.ok);
};
loadMasterStock();
</script>
</body>
</html>`;
}

function handleProductOwnerLibrary(req: Request, res: Response) {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  try {
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderProductOwnerImageLibraryPage(slug));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Image library error: ${esc(String(err))}</pre>`);
  }
}

function handleDashboard(req: Request, res: Response) {
  const slug = tenantSlugOrRespond(req, res);
  if (!slug) return;
  const rawService = req.query.service ?? req.query.serviceId;
  const serviceId = rawService ? resolveImageLibraryServiceId(String(rawService)) : undefined;
  const campaignId = req.query.campaignId ? String(req.query.campaignId) : undefined;
  const slot = req.query.slot ? String(req.query.slot) : "hero";
  try {
    const dashboard = buildImageOperatingSystemDashboard(slug, { serviceId, campaignId });
    res.setHeader("Cache-Control", "no-store");
    res.type("html").send(renderImageLibraryDashboardHtml(dashboard, slot));
  } catch (err) {
    res.status(500).type("html").send(`<pre>Image library error: ${esc(String(err))}</pre>`);
  }
}

router.get("/pharmacy-image-library/diagnostics", handleDashboard);
router.get("/master-admin/image-library", handleDashboard);
router.get("/pharmacy-image-library", handleProductOwnerLibrary);

export default router;
