/**
 * Admin Client Creation V1 — Client Pharmacies admin page.
 */
import { Router, type Request, type Response } from "express";
import { requireAdmin } from "../middlewares/requireAuth.js";
import {
  listAdminClientPharmacies,
  type AdminClientListRow,
} from "../../../../src/pharmacy/adminClientCreationService.ts";

const router = Router();

function esc(s: unknown): string {
  return String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
  } catch {
    return iso;
  }
}

function statusBadgeClass(status: string): string {
  if (status === "setup_required") return "status-setup";
  if (status === "needs_attention") return "status-attention";
  if (status === "published") return "status-published";
  if (status === "growing") return "status-growing";
  if (status === "building") return "status-building";
  return "status-default";
}

function renderClientRow(row: AdminClientListRow): string {
  const townPostcode = [row.town, row.postcode].filter(Boolean).join(", ") || "—";
  const website = row.website
    ? `<a href="${esc(row.website)}" target="_blank" rel="noopener">${esc(row.website.replace(/^https?:\/\//, "").slice(0, 40))}</a>`
    : "—";
  return `<tr data-slug="${esc(row.slug)}">
  <td><strong>${esc(row.pharmacyName)}</strong></td>
  <td><code>${esc(row.slug)}</code></td>
  <td>${website}</td>
  <td>${esc(townPostcode)}</td>
  <td>${esc(formatDate(row.createdAt))}</td>
  <td>${esc(formatDate(row.updatedAt))}</td>
  <td><span class="status-badge ${statusBadgeClass(row.status)}">${esc(row.statusLabel)}</span></td>
  <td class="actions">
    <a class="btn btn-sm btn-primary" href="${esc(row.growthDashboardUrl)}">Growth Dashboard</a>
    <a class="btn btn-sm btn-ghost" href="${esc(row.profileWizardUrl)}">Profile Wizard</a>
  </td>
</tr>`;
}

export function renderAdminClientPharmaciesHtml(clients: AdminClientListRow[]): string {
  const rows =
    clients.map(renderClientRow).join("") ||
    `<tr><td colspan="8" class="empty">No pharmacy clients yet. Create the first client below.</td></tr>`;

  return `<!DOCTYPE html>
<html lang="en-GB">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Client Pharmacies · Admin</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#eef2f7;color:#0f172a;min-height:100vh}
.topbar{background:#0f172a;color:#fff;padding:0 24px;display:flex;align-items:center;height:56px;gap:16px;box-shadow:0 2px 10px rgba(0,0,0,.2)}
.topbar-logo{font-size:1rem;font-weight:800}
.admin-pill{background:#f59e0b;color:#0f172a;font-size:.68rem;font-weight:900;text-transform:uppercase;padding:4px 10px;border-radius:999px;letter-spacing:.06em}
.topbar-nav{display:flex;gap:8px;margin-left:16px}
.topbar-nav a{color:#cbd5e1;text-decoration:none;font-size:.82rem;font-weight:600;padding:6px 12px;border-radius:8px}
.topbar-nav a.active,.topbar-nav a:hover{background:rgba(255,255,255,.12);color:#fff}
.topbar-back{margin-left:auto;color:#fff;text-decoration:none;font-size:.82rem;font-weight:600;background:rgba(255,255,255,.1);padding:6px 14px;border-radius:8px}
.page{max-width:1280px;margin:28px auto 60px;padding:0 20px}
.hero{margin-bottom:20px;display:flex;flex-wrap:wrap;align-items:flex-end;justify-content:space-between;gap:16px}
.hero h1{font-size:1.6rem;font-weight:800;margin-bottom:6px}
.hero p{color:#64748b;font-size:.95rem;max-width:680px}
.admin-note{background:#fff7ed;border:1px solid #fed7aa;color:#9a3412;padding:12px 16px;border-radius:12px;font-size:.88rem;margin-bottom:18px}
.toolbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:16px}
.toolbar input{padding:10px 14px;border:1.5px solid #dbeafe;border-radius:10px;font-size:.9rem;background:#fff;min-width:260px}
.table-wrap{background:#fff;border:1px solid #e2e8f0;border-radius:16px;overflow:auto}
table{width:100%;border-collapse:collapse;font-size:.86rem}
th,td{padding:12px 14px;text-align:left;border-bottom:1px solid #f1f5f9;vertical-align:middle}
th{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:#64748b;background:#f8fafc}
tr:last-child td{border-bottom:none}
code{font-size:.78rem;background:#f1f5f9;padding:2px 6px;border-radius:6px}
.actions{display:flex;flex-wrap:wrap;gap:6px;min-width:220px}
.btn{padding:9px 16px;border:none;border-radius:9px;font-size:.84rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn-sm{padding:6px 12px;font-size:.78rem}
.btn-primary{background:#005EB8;color:#fff}
.btn-ghost{background:#f8fafc;color:#475569;border:1px solid #e2e8f0}
.status-badge{display:inline-block;padding:3px 10px;border-radius:999px;font-size:.72rem;font-weight:700}
.status-setup{background:#fef3c7;color:#92400e}
.status-default{background:#e0f2fe;color:#0369a1}
.status-building{background:#fef3c7;color:#92400e}
.status-growing{background:#dcfce7;color:#15803d}
.status-published{background:#dbeafe;color:#1d4ed8}
.status-attention{background:#fee2e2;color:#b91c1c}
.empty{text-align:center;color:#64748b;padding:32px}
.overlay{position:fixed;inset:0;background:rgba(15,23,42,.55);display:none;align-items:center;justify-content:center;padding:20px;z-index:100}
.overlay.open{display:flex}
.modal{background:#fff;border-radius:18px;max-width:560px;width:100%;max-height:90vh;overflow:auto;padding:28px}
.modal h2{margin-bottom:4px;font-size:1.2rem}
.modal .lead{color:#64748b;font-size:.88rem;margin-bottom:18px}
.field{margin-bottom:14px}
.field label{display:block;font-size:.78rem;font-weight:600;margin-bottom:4px;color:#374151}
.field .hint{font-size:.72rem;color:#94a3b8;font-weight:500;margin-top:3px}
.field input,.field textarea{width:100%;padding:10px 12px;border:1.5px solid #e2e8f0;border-radius:9px;font-size:.9rem}
.field textarea{min-height:72px;resize:vertical}
.field-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.required::after{content:' *';color:#dc2626}
.modal-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:20px}
.msg-ok,.msg-err{border-radius:8px;padding:10px 14px;font-size:.85rem;margin-bottom:14px;display:none}
.msg-ok{background:#f0fdf4;border:1px solid #bbf7d0;color:#15803d}
.msg-err{background:#fef2f2;border:1px solid #fecaca;color:#dc2626}
.slug-preview{font-size:.82rem;color:#64748b;margin-top:6px}
@media(max-width:900px){.field-grid{grid-template-columns:1fr} th:nth-child(5),td:nth-child(5),th:nth-child(6),td:nth-child(6){display:none}}
</style>
</head>
<body>
<div class="topbar">
  <div class="topbar-logo">PharmaConnect</div>
  <span class="admin-pill">Admin only</span>
  <nav class="topbar-nav">
    <a href="/api/admin/pharmacies" class="active">Client Pharmacies</a>
    <a href="/api/admin/users">Team Members</a>
  </nav>
  <a href="/api/dashboard" class="topbar-back">← Platform</a>
</div>
<div class="page">
  <div class="admin-note"><strong>Admin only.</strong> Create empty pharmacy tenants here. The pharmacy then completes Google import, website import and profile setup in the normal onboarding flow.</div>
  <div id="msg-ok" class="msg-ok"></div>
  <div id="msg-err" class="msg-err"></div>
  <div class="hero">
    <div>
      <h1>Client Pharmacies</h1>
      <p>Manage pharmacy clients enrolled in PharmaConnect. Create a profile, then the pharmacy completes Business Intelligence setup.</p>
    </div>
    <button class="btn btn-primary" onclick="openCreateModal()">+ Create New Pharmacy</button>
  </div>
  <div class="toolbar">
    <input id="search" type="search" placeholder="Search by name, slug, town or postcode…" oninput="applySearch()"/>
    <span style="font-size:.82rem;color:#64748b">${clients.length} client${clients.length === 1 ? "" : "s"}</span>
  </div>
  <div class="table-wrap">
    <table>
      <thead>
        <tr>
          <th>Pharmacy name</th>
          <th>Slug</th>
          <th>Website</th>
          <th>Town / Postcode</th>
          <th>Created</th>
          <th>Last updated</th>
          <th>Status</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody id="client-rows">${rows}</tbody>
    </table>
  </div>
</div>

<div class="overlay" id="create-modal">
  <div class="modal">
    <h2>Create New Pharmacy</h2>
    <p class="lead">Creates a new empty tenant profile. Only pharmacy name is required; onboarding imports and profile completion happen next.</p>
    <div class="field"><label class="required">Pharmacy name</label><input id="f-name" placeholder="Example Pharmacy" oninput="previewSlug()"/><p class="slug-preview" id="slug-preview"></p></div>
    <div class="field"><label>Optional internal/reference name</label><input id="f-reference-name" placeholder="Optional internal label"/></div>
    <div class="field"><label>Website URL</label><input id="f-website" placeholder="https://example-pharmacy.co.uk"/></div>
    <div class="field"><label>Google Business Profile URL</label><input id="f-google-url" placeholder="https://maps.google.com/..."/></div>
    <div class="field-grid">
      <div class="field"><label>Primary town</label><input id="f-town" placeholder="Rotherham"/></div>
      <div class="field"><label>Postcode</label><input id="f-postcode" placeholder="S60 2DH"/></div>
    </div>
    <div class="field"><label>Contact name</label><input id="f-contact-name" placeholder="Optional"/></div>
    <div class="field-grid">
      <div class="field"><label>Contact email</label><input id="f-email" type="email" placeholder="Optional"/></div>
      <div class="field"><label>Phone</label><input id="f-phone" placeholder="Optional"/></div>
    </div>
    <div class="field"><label>Google Place ID</label><input id="f-place-id" placeholder="Optional — for a specific branch listing"/></div>
    <div class="field"><label>Notes</label><textarea id="f-notes" placeholder="Internal admin notes (optional)"></textarea><p class="hint">Not shown to the pharmacy customer.</p></div>
    <div class="modal-actions">
      <button class="btn btn-ghost" onclick="closeCreateModal()">Cancel</button>
      <button class="btn btn-primary" id="btn-create" onclick="submitCreate()">Create pharmacy</button>
    </div>
  </div>
</div>

<script>
function apiFetch(path, opts){
  const t='${process.env.SESSION_SECRET ? process.env.SESSION_SECRET.replace(/'/g, "\\'") : ""}';
  const h={...(opts?.headers||{}),'Content-Type':'application/json'};
  if(t){h['X-Internal-Token']=t;h['Authorization']='Bearer '+t;}
  return fetch(window.location.origin+path,{cache:'no-store',...opts,headers:h});
}

function showMsg(ok, text){
  const okEl=document.getElementById('msg-ok');
  const errEl=document.getElementById('msg-err');
  okEl.style.display='none'; errEl.style.display='none';
  if(ok){okEl.textContent=text; okEl.style.display='block';}
  else{errEl.textContent=text; errEl.style.display='block';}
}

function applySearch(){
  const q=document.getElementById('search').value.toLowerCase();
  document.querySelectorAll('#client-rows tr[data-slug]').forEach(row=>{
    row.style.display=!q||row.textContent.toLowerCase().includes(q)?'':'none';
  });
}

function openCreateModal(){
  ['f-name','f-reference-name','f-website','f-google-url','f-town','f-postcode','f-contact-name','f-email','f-phone','f-place-id','f-notes'].forEach(id=>{
    const el=document.getElementById(id); if(el) el.value='';
  });
  document.getElementById('slug-preview').textContent='';
  document.getElementById('create-modal').classList.add('open');
}

function closeCreateModal(){ document.getElementById('create-modal').classList.remove('open'); }

async function previewSlug(){
  const name=document.getElementById('f-name').value.trim();
  const el=document.getElementById('slug-preview');
  if(!name){ el.textContent=''; return; }
  try{
    const res=await apiFetch('/api/master-admin/clients/preview-slug',{method:'POST',body:JSON.stringify({pharmacyName:name})});
    const d=await res.json();
    el.textContent=d.ok?('Slug: '+d.slug+(d.available?'':' (will be suffixed if taken)')):'';
  }catch(_e){ el.textContent=''; }
}

async function submitCreate(){
  const payload={
    pharmacyName:document.getElementById('f-name').value.trim(),
    referenceName:document.getElementById('f-reference-name').value.trim(),
    website:document.getElementById('f-website').value.trim(),
    googleBusinessProfileUrl:document.getElementById('f-google-url').value.trim(),
    town:document.getElementById('f-town').value.trim(),
    postcode:document.getElementById('f-postcode').value.trim(),
    contactName:document.getElementById('f-contact-name').value.trim(),
    contactEmail:document.getElementById('f-email').value.trim(),
    phone:document.getElementById('f-phone').value.trim(),
    googlePlaceId:document.getElementById('f-place-id').value.trim(),
    notes:document.getElementById('f-notes').value.trim(),
  };
  if(!payload.pharmacyName){
    alert('Pharmacy name is required.');
    return;
  }
  const btn=document.getElementById('btn-create');
  btn.disabled=true;
  try{
    const res=await apiFetch('/api/master-admin/clients',{method:'POST',body:JSON.stringify(payload)});
    const d=await res.json();
    if(!d.ok) throw new Error(d.error||'Create failed');
    window.location.href=d.redirectUrl;
  }catch(e){
    alert(e.message||String(e));
  }finally{
    btn.disabled=false;
  }
}

if(new URLSearchParams(window.location.search).get('create')==='1'){
  openCreateModal();
}
</script>
</body>
</html>`;
}

/** @deprecated Use renderAdminClientPharmaciesHtml — kept for legacy validation imports. */
export function renderMasterAdminHtml(): string {
  return renderAdminClientPharmaciesHtml(listAdminClientPharmacies());
}

router.get("/admin/pharmacies", requireAdmin, (_req: Request, res: Response) => {
  res.redirect(302, "/api/admin/master");
});

export default router;
