/**
 * Master Admin Issue Centre V1 — list and detail UI (lazy-loaded via API).
 */
import { Router } from "express";
import { requireAdmin } from "../middlewares/requireAuth.js";
import {
  openMasterAdminCustomerDashboardAccess,
  renderMasterAdminCustomerAccessHtml,
} from "../../../../src/pharmacy/masterAdminCustomerAccessService.ts";

const router = Router();

const SHARED_STYLES = `
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0b1220;color:#e2e8f0;min-height:100vh}
.topbar{background:linear-gradient(90deg,#0f172a,#1e293b);padding:0 24px;display:flex;align-items:center;height:58px;gap:14px;border-bottom:1px solid #334155}
.topbar-logo{font-size:1.05rem;font-weight:800;color:#fff}
.admin-pill{background:#f59e0b;color:#0f172a;font-size:.65rem;font-weight:900;text-transform:uppercase;padding:4px 10px;border-radius:999px}
.topbar-nav{margin-left:auto;display:flex;gap:8px}
.topbar-nav a{color:#cbd5e1;text-decoration:none;font-size:.78rem;font-weight:600;padding:6px 12px;border-radius:8px;border:1px solid #475569}
.topbar-nav a:hover,.topbar-nav a.active{background:#1e293b;color:#fff}
.page{max-width:1280px;margin:20px auto;padding:0 18px 40px}
.panel{background:#111827;border:1px solid #334155;border-radius:14px;padding:16px 18px;margin-bottom:16px}
.panel h2{font-size:.95rem;font-weight:800;margin-bottom:12px}
.btn{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:8px 14px;font-size:.82rem;font-weight:700;cursor:pointer;text-decoration:none;display:inline-block}
.btn.secondary{background:#334155;color:#e2e8f0}
.btn.danger{background:#b91c1c}
table{width:100%;border-collapse:collapse;font-size:.78rem}
th,td{padding:10px;text-align:left;border-bottom:1px solid #1f2937}
th{color:#94a3b8;font-size:.68rem;text-transform:uppercase}
.issue-row{cursor:pointer}.issue-row:hover{background:#1e293b}
.pill{display:inline-block;padding:3px 8px;border-radius:999px;font-size:.68rem;font-weight:700;background:#334155}
.pill-Critical{background:#7f1d1d;color:#fecaca}.pill-High{background:#78350f;color:#fed7aa}
.pill-Medium{background:#1e3a8a;color:#dbeafe}.pill-Low{background:#334155}
.loading{padding:20px;text-align:center;color:#64748b}
.form-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.form-grid label{display:flex;flex-direction:column;gap:4px;font-size:.72rem;color:#94a3b8}
.form-grid input,.form-grid select,.form-grid textarea{background:#0f172a;border:1px solid #475569;color:#e2e8f0;border-radius:8px;padding:8px;font-size:.82rem}
.form-grid textarea{min-height:70px}.full{grid-column:1/-1}
pre{background:#0f172a;border:1px solid #334155;border-radius:8px;padding:12px;font-size:.72rem;overflow:auto;max-height:320px;white-space:pre-wrap}
.actions{display:flex;flex-wrap:wrap;gap:8px;margin-top:12px}
.toast{position:fixed;bottom:20px;right:20px;background:#1e293b;border:1px solid #475569;padding:12px 16px;border-radius:10px;display:none;z-index:200}
.toast.show{display:block}
`;

function issueListShell(): string {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"/><title>Issue Centre · Master Admin</title><style>${SHARED_STYLES}</style></head><body>
<header class="topbar"><div class="topbar-logo">PharmaConnect</div><span class="admin-pill">Issue Centre</span>
<nav class="topbar-nav"><a href="/api/admin/master">Master Admin</a><a href="/api/admin/master/issues" class="active">Issues</a></nav></header>
<div class="page">
<div class="panel"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px"><h2>Support Issues</h2><a class="btn" href="/api/admin/master/issues/new">+ Report Issue</a></div>
<div id="listLoading" class="loading">Loading issue summaries…</div><div class="table-wrap" id="listWrap" style="display:none"><table><thead><tr><th>ID</th><th>Customer</th><th>Title</th><th>Category</th><th>Severity</th><th>Status</th><th>Updated</th></tr></thead><tbody id="issueTbody"></tbody></table></div></div>
</div><div class="toast" id="toast"></div>
<script>
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
function fmt(d){try{return new Date(d).toLocaleString('en-GB',{dateStyle:'medium',timeStyle:'short'})}catch{return d}}
function esc(s){return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;')}
async function load(){const r=await fetch('/api/master-admin-platform/issues',{credentials:'same-origin',headers:{Accept:'application/json'}});const d=await r.json();if(!r.ok)throw new Error(d.error||'Load failed');const rows=(d.issues||[]).map(i=>'<tr class="issue-row" onclick="location.href=\\'/api/admin/master/issues/'+esc(i.issueId)+'\\'"><td><code>'+esc(i.issueId)+'</code></td><td>'+esc(i.businessName)+'<div style="font-size:.65rem;color:#64748b">'+esc(i.tenantSlug)+'</div></td><td>'+esc(i.title)+'</td><td>'+esc(i.category)+'</td><td><span class="pill pill-'+esc(i.severity)+'">'+esc(i.severity)+'</span></td><td>'+esc(i.status)+'</td><td>'+fmt(i.updatedAt)+'</td></tr>').join('');document.getElementById('issueTbody').innerHTML=rows||'<tr><td colspan="7" style="text-align:center;padding:20px;color:#64748b">No issues yet</td></tr>';document.getElementById('listLoading').style.display='none';document.getElementById('listWrap').style.display='block'}
load().catch(e=>toast(e.message));
</script></body></html>`;
}

function issueCreateShell(): string {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"/><title>Report Issue · Master Admin</title><style>${SHARED_STYLES}</style></head><body>
<header class="topbar"><div class="topbar-logo">PharmaConnect</div><span class="admin-pill">Report Issue</span>
<nav class="topbar-nav"><a href="/api/admin/master/issues">← Issues</a></nav></header>
<div class="page"><div class="panel"><h2>Create Issue</h2>
<form id="createForm" class="form-grid">
<label class="full">Customer *<select id="tenantSlug" required></select></label>
<label>Campaign ID<input id="campaignId"/></label><label>Service ID<input id="serviceId" placeholder="pharmacy-first"/></label>
<label class="full">Affected page / module<input id="affectedPageOrModule"/></label>
<label>Category *<select id="category" required></select></label><label>Severity *<select id="severity" required></select></label>
<label class="full">Title *<input id="title" required/></label>
<label class="full">Browser-visible description *<textarea id="description" required></textarea></label>
<label class="full">Expected behaviour *<textarea id="expectedBehaviour" required></textarea></label>
<label class="full">Actual behaviour *<textarea id="actualBehaviour" required></textarea></label>
<label class="full">Browser URL<input id="affectedUrl" placeholder="https://"/></label>
<label>Screenshot reference<input id="screenshotReference"/></label>
<label class="full">Steps to reproduce<textarea id="reproductionSteps"></textarea></label>
</form>
<div class="actions"><button class="btn secondary" type="button" onclick="location.href='/api/admin/master/issues'">Cancel</button><button class="btn" type="button" onclick="submitIssue()">Create Issue & Collect Diagnostics</button></div>
</div></div><div class="toast" id="toast"></div>
<script>
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
const p=new URLSearchParams(location.search);
async function init(){const r=await fetch('/api/master-admin-platform/issues/meta',{credentials:'same-origin'});const d=await r.json();document.getElementById('tenantSlug').innerHTML=(d.customers||[]).map(c=>'<option value="'+c.slug+'"'+(c.slug===p.get('slug')?' selected':'')+'>'+c.businessName+' ('+c.slug+')</option>').join('');document.getElementById('category').innerHTML=(d.categories||[]).map(c=>'<option'+(c==='Local Page'&&p.get('category')==='Local Page'?' selected':'')+'>'+c+'</option>').join('');document.getElementById('severity').innerHTML=(d.severities||[]).map(s=>'<option>'+s+'</option>').join('');if(p.get('title'))document.getElementById('title').value=p.get('title')}
async function submitIssue(){const body={tenantSlug:document.getElementById('tenantSlug').value,campaignId:document.getElementById('campaignId').value,serviceId:document.getElementById('serviceId').value,affectedPageOrModule:document.getElementById('affectedPageOrModule').value,category:document.getElementById('category').value,severity:document.getElementById('severity').value,title:document.getElementById('title').value,description:document.getElementById('description').value,expectedBehaviour:document.getElementById('expectedBehaviour').value,actualBehaviour:document.getElementById('actualBehaviour').value,affectedUrl:document.getElementById('affectedUrl').value,screenshotReference:document.getElementById('screenshotReference').value,reproductionSteps:document.getElementById('reproductionSteps').value};const r=await fetch('/api/master-admin-platform/issues',{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json',Accept:'application/json'},body:JSON.stringify(body)});const d=await r.json();if(!r.ok){toast(d.error||'Create failed');return}location.href='/api/admin/master/issues/'+d.issue.issueId}
init().catch(e=>toast(e.message));
</script></body></html>`;
}

function issueDetailShell(issueId: string): string {
  return `<!DOCTYPE html><html lang="en-GB"><head><meta charset="UTF-8"/><title>Issue ${issueId} · Master Admin</title><style>${SHARED_STYLES}.grid2{display:grid;grid-template-columns:1fr 1fr;gap:16px}@media(max-width:900px){.grid2{grid-template-columns:1fr}}</style></head><body>
<header class="topbar"><div class="topbar-logo">PharmaConnect</div><span class="admin-pill">Issue Detail</span>
<nav class="topbar-nav"><a href="/api/admin/master/issues">← Issues</a><a href="/api/admin/master">Master Admin</a></nav></header>
<div class="page"><div id="loading" class="loading">Loading issue…</div><div id="content" style="display:none">
<div class="panel"><h2 id="issueTitle"></h2><div id="issueMeta" style="font-size:.78rem;color:#94a3b8;margin-bottom:10px"></div>
<div class="grid2"><div><strong>Expected</strong><p id="expected" style="margin-top:6px;font-size:.82rem"></p></div><div><strong>Actual</strong><p id="actual" style="margin-top:6px;font-size:.82rem"></p></div></div>
<p style="margin-top:10px;font-size:.82rem"><strong>Steps:</strong> <span id="steps"></span></p>
<p style="margin-top:6px;font-size:.82rem"><strong>URL:</strong> <span id="url"></span></p>
</div>
<div class="panel"><h2>Actions</h2><div class="actions">
<button class="btn secondary" onclick="refreshDiag()">Re-run Diagnostics</button>
<button class="btn" onclick="genPrompt()">Generate Cursor Prompt</button>
<button class="btn secondary" onclick="copyPrompt()">Copy Prompt</button>
<button class="btn secondary" onclick="viewReport()">Diagnostic Report</button>
<button class="btn secondary" onclick="exportJson()">JSON Export</button>
<button class="btn secondary" onclick="exportText()">Plain-text Export</button>
<button class="btn secondary" onclick="setStatus('Investigating')">Mark Investigating</button>
<button class="btn secondary" onclick="setStatus('Fix Ready')">Mark Fix Ready</button>
<button class="btn secondary" onclick="setStatus('Awaiting Product Owner Test')">Awaiting PO Test</button>
<button class="btn secondary" onclick="setStatus('Passed')">Mark Passed</button>
<button class="btn secondary" onclick="setStatus('Reopened')">Reopen</button>
<button class="btn danger" onclick="setStatus('Closed')">Close</button>
</div></div>
<div class="panel"><h2>Cursor Defect Brief</h2><pre id="cursorPrompt">Not generated yet</pre></div>
<div class="panel"><h2>Diagnostics Snapshot</h2><pre id="diagnostics"></pre></div>
<div class="panel"><h2>Resolution History</h2><pre id="history"></pre></div>
</div></div><div class="toast" id="toast"></div>
<script>
const ISSUE_ID=${JSON.stringify(issueId)};
let issue=null;
function toast(m){const t=document.getElementById('toast');t.textContent=m;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),3500)}
function fmt(d){try{return new Date(d).toLocaleString('en-GB')})}catch{return d}}
async function api(path,opts){const r=await fetch(path,{credentials:'same-origin',headers:{Accept:'application/json','Content-Type':'application/json'},...opts});const d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||r.statusText);return d}
function render(){document.getElementById('issueTitle').textContent=issue.title;document.getElementById('issueMeta').textContent=issue.issueId+' · '+issue.severity+' · '+issue.status+' · '+issue.tenantSlug+' · '+issue.category;document.getElementById('expected').textContent=issue.expectedBehaviour;document.getElementById('actual').textContent=issue.actualBehaviour;document.getElementById('steps').textContent=issue.reproductionSteps||'—';document.getElementById('url').textContent=issue.affectedUrl||'—';document.getElementById('cursorPrompt').textContent=issue.cursorPrompt||'Not generated yet';document.getElementById('diagnostics').textContent=JSON.stringify(issue.diagnosticSnapshot,null,2);document.getElementById('history').textContent=JSON.stringify(issue.resolutionHistory,null,2);document.getElementById('loading').style.display='none';document.getElementById('content').style.display='block'}
async function load(){const d=await api('/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID));issue=d.issue;render()}
async function refreshDiag(){issue=(await api('/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/diagnostics/refresh',{method:'POST',body:'{}'})).issue;render();toast('Diagnostics refreshed')}
async function genPrompt(){const d=await api('/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/cursor-prompt',{method:'POST',body:'{}'});issue=d.issue;render();toast('Cursor prompt generated')}
async function copyPrompt(){if(!issue?.cursorPrompt){await genPrompt()}await navigator.clipboard.writeText(issue.cursorPrompt||'');toast('Copied to clipboard')}
function viewReport(){window.open('/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/diagnostic-report','_blank')}
function exportJson(){location.href='/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/diagnostic-report?format=download-json'}
function exportText(){location.href='/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/diagnostic-report?format=text'}
async function setStatus(s){issue=(await api('/api/master-admin-platform/issues/'+encodeURIComponent(ISSUE_ID)+'/status',{method:'POST',body:JSON.stringify({status:s})})).issue;render();toast('Status: '+s)}
load().catch(e=>toast(e.message));
</script></body></html>`;
}

router.get("/admin/master/issues", requireAdmin, (_req, res) => {
  res.type("html").send(issueListShell());
});

router.get("/admin/master/issues/new", requireAdmin, (_req, res) => {
  res.type("html").send(issueCreateShell());
});

router.get("/admin/master/issues/:issueId", requireAdmin, (req, res) => {
  const issueId = String(req.params.issueId);
  if (issueId === "new") return res.redirect("/api/admin/master/issues/new");
  res.type("html").send(issueDetailShell(issueId));
});

router.get("/admin/master/customer-access/:slug", requireAdmin, (req, res) => {
  const session = req.session as { username?: string; name?: string } | undefined;
  const user = session?.name || session?.username || "admin";
  try {
    const access = openMasterAdminCustomerDashboardAccess(String(req.params.slug), user);
    res.type("html").send(renderMasterAdminCustomerAccessHtml(access));
  } catch (err) {
    res.status(400).type("text/plain").send(err instanceof Error ? err.message : String(err));
  }
});

export default router;
