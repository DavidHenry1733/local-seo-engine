import { Router } from "express";

const router = Router();

router.get("/ranking", (_req, res) => {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.send(rankingHtml());
});

function rankingHtml(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Ranking Reports</title>
<style>
  :root {
    --brand:#005EB8; --success:#16a34a; --warn:#d97706; --error:#dc2626;
    --muted:#64748b; --border:#e2e8f0; --bg:#f8fafc; --card:#fff;
    --text:#1e293b; --radius:10px;
  }
  * { box-sizing:border-box; margin:0; padding:0; }
  body { font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;
    background:var(--bg); color:var(--text); min-height:100vh; }
  .header { background:var(--brand); color:#fff; padding:18px 24px;
    display:flex; align-items:center; gap:16px; }
  .header h1 { font-size:1.15rem; font-weight:700; }
  .header a { color:rgba(255,255,255,.75); font-size:.85rem; text-decoration:none;
    margin-left:auto; }
  .header a:hover { color:#fff; }
  .main { max-width:960px; margin:0 auto; padding:24px 16px; }
  .picker-bar { display:flex; align-items:center; gap:12px; background:var(--card);
    border:1px solid var(--border); border-radius:var(--radius); padding:14px 18px;
    margin-bottom:20px; }
  .picker-bar label { font-weight:600; font-size:.9rem; white-space:nowrap; }
  .picker-bar select { flex:1; border:1px solid var(--border); border-radius:6px;
    padding:8px 10px; font-size:.9rem; background:#fff; max-width:360px; }
  .card { background:var(--card); border:1px solid var(--border);
    border-radius:var(--radius); padding:20px; margin-bottom:16px; }
  .card-title { font-weight:700; font-size:1rem; margin-bottom:4px; }
  .card-sub { color:var(--muted); font-size:.85rem; margin-bottom:16px; }
  .stats-row { display:flex; gap:12px; flex-wrap:wrap; margin-bottom:16px; }
  .stat-box { flex:1; min-width:90px; background:var(--bg); border:1px solid var(--border);
    border-radius:8px; padding:12px; text-align:center; }
  .stat-num { font-size:1.6rem; font-weight:800; line-height:1; }
  .stat-label { font-size:.75rem; color:var(--muted); margin-top:4px; }
  .stat-num.ranked { color:var(--success); }
  .stat-num.improved { color:var(--brand); }
  .stat-num.dropped { color:var(--error); }
  .stat-num.indexed-col { color:var(--success); }
  .stat-num.not-indexed-col { color:var(--error); }
  .run-info { font-size:.85rem; color:var(--muted); margin-bottom:12px; }
  .btn { display:inline-flex; align-items:center; gap:6px; border:none; cursor:pointer;
    border-radius:6px; padding:8px 14px; font-size:.875rem; font-weight:600;
    transition:opacity .15s; }
  .btn:disabled { opacity:.5; cursor:not-allowed; }
  .btn-primary { background:var(--brand); color:#fff; }
  .btn-primary:hover:not(:disabled) { opacity:.88; }
  .btn-secondary { background:#f1f5f9; color:var(--text); border:1px solid var(--border); }
  .btn-secondary:hover:not(:disabled) { background:#e2e8f0; }
  .btn-sm { padding:5px 10px; font-size:.8rem; }
  .flex { display:flex; }
  .gap-2 { gap:8px; }
  .flex-wrap { flex-wrap:wrap; }
  .align-center { align-items:center; }
  .table-wrap { overflow-x:auto; margin-top:12px; }
  table { width:100%; border-collapse:collapse; font-size:.875rem; }
  th { text-align:left; padding:8px 10px; border-bottom:2px solid var(--border);
    font-size:.78rem; color:var(--muted); font-weight:600; white-space:nowrap; }
  td { padding:8px 10px; border-bottom:1px solid var(--border); vertical-align:middle; }
  tr:last-child td { border-bottom:none; }
  .kt-pos { display:inline-block; font-weight:700; border-radius:4px;
    padding:2px 6px; font-size:.82rem; background:#f1f5f9; }
  .kt-pos.top3 { background:#dcfce7; color:#16a34a; }
  .kt-pos.top10 { background:#dbeafe; color:#1d4ed8; }
  .kt-pos.top20 { background:#fef9c3; color:#854d0e; }
  .kt-change { font-size:.8rem; font-weight:700; }
  .kt-change.up { color:var(--success); }
  .kt-change.down { color:var(--error); }
  .kt-change.new { color:var(--brand); }
  .it-badge { display:inline-block; font-size:.75rem; font-weight:600; border-radius:4px;
    padding:2px 7px; }
  .it-badge.indexed { background:#dcfce7; color:#16a34a; }
  .it-badge.not_indexed { background:#fee2e2; color:#dc2626; }
  .it-badge.unknown { background:#f1f5f9; color:var(--muted); }
  .alert { border-radius:8px; padding:10px 14px; font-size:.875rem; margin-top:12px; }
  .alert-error { background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; }
  .alert-info  { background:#eff6ff; color:#1d4ed8; border:1px solid #bfdbfe; }
  .hidden { display:none !important; }
  .text-muted { color:var(--muted); font-size:.85rem; }
  .empty-state { text-align:center; padding:32px; color:var(--muted); font-size:.9rem; }
  @media(max-width:600px) { .stats-row { gap:8px; } .stat-num { font-size:1.2rem; } }
</style>
</head>
<body>
<div class="header">
  <h1>Ranking Reports</h1>
  <a href="/api/setup">← Back to Wizard</a>
</div>

<div class="main">

  <!-- Project Picker -->
  <div class="picker-bar">
    <label for="project-select">Project:</label>
    <select id="project-select">
      <option value="">— select project —</option>
    </select>
    <button class="btn btn-primary" onclick="loadProject()">Load</button>
  </div>

  <!-- Keyword Rankings -->
  <div class="card">
    <div class="card-title">Keyword Rankings</div>
    <div class="card-sub">Track Google positions for target keywords. Checks top 100 results per keyword.</div>

    <div id="kt-info" class="run-info">Select a project above to load ranking data.</div>

    <div class="stats-row">
      <div class="stat-box"><div id="kt-total" class="stat-num">—</div><div class="stat-label">Keywords</div></div>
      <div class="stat-box"><div id="kt-ranked" class="stat-num ranked">—</div><div class="stat-label">Ranked</div></div>
      <div class="stat-box"><div id="kt-improved" class="stat-num improved">—</div><div class="stat-label">Improved</div></div>
      <div class="stat-box"><div id="kt-dropped" class="stat-num dropped">—</div><div class="stat-label">Dropped</div></div>
      <div class="stat-box"><div id="kt-new" class="stat-num" style="color:var(--brand)">—</div><div class="stat-label">New</div></div>
    </div>

    <div id="kt-table-wrap" class="table-wrap hidden">
      <table>
        <thead><tr>
          <th>Keyword</th><th>Position</th><th>Change</th><th>Target URL</th><th>Last Checked</th>
        </tr></thead>
        <tbody id="kt-tbody"></tbody>
      </table>
    </div>

    <div id="kt-empty" class="empty-state hidden">No ranking data yet — click <strong>Run Check</strong> to start.</div>
    <div id="kt-error" class="alert alert-error hidden"></div>

    <div class="flex gap-2 flex-wrap align-center" style="margin-top:16px">
      <button class="btn btn-primary" id="btn-kt-run" onclick="ktRunCheck()" disabled>Run Check</button>
      <button class="btn btn-secondary" id="btn-kt-refresh" onclick="ktRefresh()" disabled>Refresh</button>
      <button class="btn btn-secondary btn-sm" id="btn-kt-copy" onclick="ktCopyKeywords()" disabled>Copy Keywords</button>
      <span id="kt-running" class="text-muted hidden">Running… this takes ~1 min per 10 keywords</span>
    </div>
  </div>

  <!-- Index Tracking -->
  <div class="card">
    <div class="card-title">Index Tracking</div>
    <div class="card-sub">Check which pages are indexed in Google using <code style="font-size:.82rem">site:</code> search — no API key needed.</div>

    <div id="it-info" class="run-info">Select a project above to load index data.</div>

    <div class="stats-row">
      <div class="stat-box"><div id="it-indexed" class="stat-num indexed-col">—</div><div class="stat-label">Indexed</div></div>
      <div class="stat-box"><div id="it-not-indexed" class="stat-num not-indexed-col">—</div><div class="stat-label">Not Indexed</div></div>
      <div class="stat-box"><div id="it-unknown" class="stat-num" style="color:var(--muted)">—</div><div class="stat-label">Unknown</div></div>
      <div class="stat-box"><div id="it-total" class="stat-num">—</div><div class="stat-label">Total</div></div>
    </div>

    <div id="it-table-wrap" class="table-wrap hidden">
      <table>
        <thead><tr>
          <th>Page URL</th><th>Status</th><th>Last Checked</th><th>First Indexed</th>
        </tr></thead>
        <tbody id="it-tbody"></tbody>
      </table>
    </div>

    <div id="it-empty" class="empty-state hidden">No index data yet — click <strong>Run Check</strong> to start.</div>
    <div id="it-error" class="alert alert-error hidden"></div>

    <div class="flex gap-2 flex-wrap align-center" style="margin-top:16px">
      <button class="btn btn-primary" id="btn-it-run" onclick="itRunCheck()" disabled>Run Check</button>
      <button class="btn btn-secondary" id="btn-it-refresh" onclick="itRefresh()" disabled>Refresh</button>
      <button class="btn btn-secondary btn-sm" id="btn-it-copy" onclick="itCopyNotIndexed()" disabled>Copy Not-Indexed URLs</button>
      <span id="it-running" class="text-muted hidden">Running… ~30 seconds per 10 pages</span>
    </div>
  </div>

</div>

<script>
const enc = encodeURIComponent;
let activeSlug = null;
function apiFetch(path, opts){ return fetch(window.location.origin+path,{cache:'no-store',...opts}); }

// ── Project list ──────────────────────────────────────────────────
async function init() {
  try {
    const res  = await apiFetch('/api/projects');
    const data = await res.json();
    const sel  = document.getElementById('project-select');
    (data.projects || []).forEach(p => {
      const opt = document.createElement('option');
      opt.value       = p.clientSlug;
      opt.textContent = \`\${p.businessName} (\${p.clientSlug})\`;
      sel.appendChild(opt);
    });

    // Auto-load from URL param or localStorage
    const params   = new URLSearchParams(window.location.search);
    const urlSlug  = params.get('slug');
    const lsSlug   = localStorage.getItem('ranking_project_slug');
    const autoSlug = urlSlug || lsSlug;

    if (autoSlug) {
      sel.value = autoSlug;
      if (sel.value === autoSlug) await loadProject();
    }
  } catch (e) {
    console.error('Failed to load projects:', e);
  }
}

async function loadProject() {
  const slug = document.getElementById('project-select').value;
  if (!slug) return;
  activeSlug = slug;
  localStorage.setItem('ranking_project_slug', slug);
  // Update URL without reload
  const url = new URL(window.location.href);
  url.searchParams.set('slug', slug);
  window.history.replaceState({}, '', url.toString());
  // Enable buttons
  ['btn-kt-run','btn-kt-refresh','btn-kt-copy',
   'btn-it-run','btn-it-refresh','btn-it-copy'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.disabled = false;
  });
  await Promise.all([ ktRefresh(), itRefresh() ]);
}

// ── Helpers ───────────────────────────────────────────────────────
function set(id, val) { const el = document.getElementById(id); if (el) el.textContent = val ?? '—'; }
function hide(id) { document.getElementById(id)?.classList.add('hidden'); }
function show(id) { document.getElementById(id)?.classList.remove('hidden'); }

function ktPosCell(pos) {
  if (pos === null) return '<span style="color:var(--muted)">—</span>';
  let cls = pos <= 3 ? 'top3' : pos <= 10 ? 'top10' : pos <= 20 ? 'top20' : '';
  return \`<span class="kt-pos \${cls}">#\${pos}</span>\`;
}
function ktChangeCell(r) {
  if (r.previousPosition === null && r.position !== null) return '<span class="kt-change new">NEW</span>';
  if (r.change === null) return '<span style="color:var(--muted)">—</span>';
  if (r.change > 0)  return \`<span class="kt-change up">↑\${r.change}</span>\`;
  if (r.change < 0)  return \`<span class="kt-change down">↓\${Math.abs(r.change)}</span>\`;
  return '<span style="color:var(--muted)">→</span>';
}
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function fmtDate(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'});
}
function fmtDateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
    + ' ' + d.toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit'});
}

// ── Keyword Tracking ──────────────────────────────────────────────
function ktRender(report) {
  if (report) {
    document.getElementById('kt-info').innerHTML =
      \`Last run: <strong>\${fmtDateTime(report.runAt)}</strong> · \${report.totalKeywords} keywords\`;
    set('kt-total',    report.totalKeywords);
    set('kt-ranked',   report.ranked);
    set('kt-improved', report.improved);
    set('kt-dropped',  report.dropped);
    set('kt-new',      report.newRankings);
  } else {
    document.getElementById('kt-info').textContent = 'No ranking data yet — click Run Check to start.';
    ['kt-total','kt-ranked','kt-improved','kt-dropped','kt-new'].forEach(id => set(id, '—'));
  }

  const tbody = document.getElementById('kt-tbody');
  if (!report || !report.records.length) {
    hide('kt-table-wrap'); show('kt-empty'); return;
  }
  hide('kt-empty'); show('kt-table-wrap');

  const sorted = [...report.records].sort((a,b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return 1;
    return a.keyword.localeCompare(b.keyword);
  });

  tbody.innerHTML = sorted.map(r => {
    const urlShort = r.targetUrl.replace(/^https?:\\/\\//, '');
    return \`<tr>
      <td style="font-weight:600">\${esc(r.keyword)}</td>
      <td>\${ktPosCell(r.position)}</td>
      <td>\${ktChangeCell(r)}</td>
      <td><a href="\${esc(r.targetUrl)}" target="_blank" style="color:var(--brand);font-family:monospace;font-size:.8rem">\${esc(urlShort)}</a></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.8rem">\${fmtDate(r.lastCheckedAt)}</td>
    </tr>\`;
  }).join('');
}

async function ktRefresh() {
  if (!activeSlug) return;
  hide('kt-error');
  try {
    const res  = await apiFetch(\`/api/keyword-tracking?projectSlug=\${enc(activeSlug)}\`);
    const data = await res.json();
    ktRender(data.report || null);
  } catch (e) {
    const el = document.getElementById('kt-error');
    el.textContent = 'Refresh failed: ' + e.message;
    show('kt-error');
  }
}

async function ktRunCheck() {
  if (!activeSlug) return;
  const btn   = document.getElementById('btn-kt-run');
  const label = document.getElementById('kt-running');
  btn.disabled = true; btn.textContent = 'Running…'; show('kt-running');
  hide('kt-error');
  try {
    const res  = await apiFetch('/api/keyword-tracking/run', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ projectSlug: activeSlug, limit: 20, delayMs: 2500 }),
    });
    const data = await res.json();
    if (data.success && data.report) {
      ktRender(data.report);
    } else {
      const el = document.getElementById('kt-error');
      el.textContent = data.error || 'Run failed';
      show('kt-error');
    }
  } catch (e) {
    const el = document.getElementById('kt-error');
    el.textContent = 'Request failed: ' + e.message;
    show('kt-error');
  } finally {
    btn.disabled = false; btn.textContent = 'Run Check'; hide('kt-running');
  }
}

async function ktCopyKeywords() {
  const rows = document.querySelectorAll('#kt-tbody tr');
  const kws  = [];
  rows.forEach(row => {
    const kw = row.querySelector('td:first-child');
    if (kw) kws.push(kw.textContent.trim());
  });
  if (!kws.length) { alert('No keywords loaded.'); return; }
  try {
    await navigator.clipboard.writeText(kws.join('\\n'));
    const btn = document.getElementById('btn-kt-copy');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied ' + kws.length;
    setTimeout(() => btn.textContent = orig, 2000);
  } catch (_) { alert(kws.join('\\n')); }
}

// ── Index Tracking ────────────────────────────────────────────────
function itRender(report) {
  if (report) {
    document.getElementById('it-info').innerHTML =
      \`Last run: <strong>\${fmtDateTime(report.runAt)}</strong> · \${report.totalChecked ?? report.records?.length ?? 0} pages checked\`;
    set('it-indexed',     report.indexedCount);
    set('it-not-indexed', report.notIndexedCount);
    set('it-unknown',     report.unknownCount);
    set('it-total',       (report.indexedCount||0) + (report.notIndexedCount||0) + (report.unknownCount||0));
  } else {
    document.getElementById('it-info').textContent = 'No index data yet — click Run Check to start.';
    ['it-indexed','it-not-indexed','it-unknown','it-total'].forEach(id => set(id, '—'));
  }

  const tbody = document.getElementById('it-tbody');
  if (!report || !report.records.length) {
    hide('it-table-wrap'); show('it-empty'); return;
  }
  hide('it-empty'); show('it-table-wrap');

  const order = { indexed:0, not_indexed:1, unknown:2 };
  const sorted = [...report.records].sort((a,b) => (order[a.status]||2) - (order[b.status]||2));

  tbody.innerHTML = sorted.map(r => {
    const badgeCls = r.status === 'indexed' ? 'indexed' : r.status === 'not_indexed' ? 'not_indexed' : 'unknown';
    const label    = r.status === 'not_indexed' ? 'Not Indexed' : r.status.charAt(0).toUpperCase() + r.status.slice(1);
    const urlShort = r.url.replace(/^https?:\\/\\//, '');
    return \`<tr>
      <td><a href="\${esc(r.url)}" target="_blank" style="color:var(--brand);font-family:monospace;font-size:.8rem">\${esc(urlShort)}</a></td>
      <td><span class="it-badge \${badgeCls}">\${label}</span></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.8rem">\${fmtDate(r.lastCheckedAt)}</td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.8rem">\${fmtDate(r.firstDetectedIndexedAt)}</td>
    </tr>\`;
  }).join('');
}

async function itRefresh() {
  if (!activeSlug) return;
  hide('it-error');
  try {
    const res  = await apiFetch(\`/api/index-tracking?projectSlug=\${enc(activeSlug)}\`);
    const data = await res.json();
    itRender(data.report || null);
  } catch (e) {
    const el = document.getElementById('it-error');
    el.textContent = 'Refresh failed: ' + e.message;
    show('it-error');
  }
}

async function itRunCheck() {
  if (!activeSlug) return;
  const btn   = document.getElementById('btn-it-run');
  const label = document.getElementById('it-running');
  btn.disabled = true; btn.textContent = 'Running…'; show('it-running');
  hide('it-error');
  try {
    const res  = await apiFetch('/api/index-tracking/run', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ projectSlug: activeSlug, limit: 200, delayMs: 300 }),
    });
    const data = await res.json();
    if (data.success && data.report) {
      itRender(data.report);
    } else {
      const el = document.getElementById('it-error');
      el.textContent = data.error || 'Run failed';
      show('it-error');
    }
  } catch (e) {
    const el = document.getElementById('it-error');
    el.textContent = 'Request failed: ' + e.message;
    show('it-error');
  } finally {
    btn.disabled = false; btn.textContent = 'Run Check'; hide('it-running');
  }
}

async function itCopyNotIndexed() {
  const rows = document.querySelectorAll('#it-tbody tr');
  const urls = [];
  rows.forEach(row => {
    const badge = row.querySelector('.it-badge');
    if (badge && badge.textContent.includes('Not Indexed')) {
      const a = row.querySelector('a');
      if (a) urls.push(a.href);
    }
  });
  if (!urls.length) { alert('No "Not Indexed" URLs found.'); return; }
  try {
    await navigator.clipboard.writeText(urls.join('\\n'));
    const btn = document.getElementById('btn-it-copy');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied ' + urls.length;
    setTimeout(() => btn.textContent = orig, 2000);
  } catch (_) { alert(urls.join('\\n')); }
}

document.addEventListener('DOMContentLoaded', init);
</script>
</body>
</html>`;
}

export default router;
