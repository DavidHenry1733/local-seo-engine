import { Router } from "express";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const WORKSPACE_ROOT = path.resolve(__dirname, "../../..");
const PROJECTS_DIR   = path.join(WORKSPACE_ROOT, "config", "projects");

interface ProjectMeta { clientSlug: string; businessName: string; }

function loadProjectsMeta(): ProjectMeta[] {
  if (!fs.existsSync(PROJECTS_DIR)) return [];
  return fs.readdirSync(PROJECTS_DIR)
    .filter(f => f.endsWith(".json"))
    .flatMap(f => {
      try {
        const cfg = JSON.parse(fs.readFileSync(path.join(PROJECTS_DIR, f), "utf8"));
        return [{ clientSlug: cfg.clientSlug, businessName: cfg.businessName }];
      } catch { return []; }
    });
}

const router = Router();

function getDefaultSlug(_projects: ProjectMeta[]): string {
  // Prefer most-recently-modified non-demo project — mirrors dashboard.ts
  try {
    const files = fs.readdirSync(PROJECTS_DIR)
      .filter(f => f.endsWith(".json") && !f.startsWith("demo-"));
    if (!files.length) return "";
    const sorted = files.sort((a, b) =>
      fs.statSync(path.join(PROJECTS_DIR, b)).mtimeMs -
      fs.statSync(path.join(PROJECTS_DIR, a)).mtimeMs
    );
    return path.basename(sorted[0], ".json");
  } catch { return ""; }
}

router.get("/setup", (req, res) => {
  const projects = loadProjectsMeta();
  const slugFromUrl = typeof req.query.slug === "string" ? req.query.slug.trim() : "";

  // If no slug in URL, do a server-side redirect to the default project
  if (!slugFromUrl) {
    const fallback = getDefaultSlug(projects);
    if (fallback) {
      const stage = typeof req.query.stage === "string" ? req.query.stage : "1";
      const dest  = `/api/setup?slug=${encodeURIComponent(fallback)}&stage=${stage}`;
      return res.redirect(302, dest);
    }
  }

  // Load full project data server-side so form is pre-populated immediately (no async wait)
  let initialProject: Record<string, unknown> | null = null;
  if (slugFromUrl) {
    const projectPath = path.join(PROJECTS_DIR, `${slugFromUrl}.json`);
    if (fs.existsSync(projectPath)) {
      try { initialProject = JSON.parse(fs.readFileSync(projectPath, "utf8")); } catch (_) {}
    }
  }

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.send(wizardHtml(projects, slugFromUrl, initialProject, process.env.SESSION_SECRET ?? ""));
});

export default router;

function wizardHtml(projects: ProjectMeta[] = [], defaultSlug = "", initialProject: Record<string, unknown> | null = null, internalToken = ""): string {
  const projectOptions = projects.map(p =>
    `<option value="${p.clientSlug}">${p.businessName} (${p.clientSlug})</option>`
  ).join('\n        ');
  const projectTabs = projects.map(p =>
    `<button class="proj-tab" id="ptab-${p.clientSlug}" onclick="App.switchProject('${p.clientSlug}')">${p.businessName}</button>`
  ).join('\n      ');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Local SEO Page Builder — Setup</title>
<style>
:root {
  --brand: #005EB8;
  --brand-dark: #003f7f;
  --accent: #1CA9C9;
  --bg: #f1f5f9;
  --card: #ffffff;
  --border: #e2e8f0;
  --text: #1e293b;
  --muted: #64748b;
  --success: #16a34a;
  --warn: #d97706;
  --danger: #dc2626;
  --priority: #15803d;
  --secondary: #b45309;
  --tertiary: #6b7280;
  --radius: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,.1), 0 1px 2px rgba(0,0,0,.06);
}
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 15px; }
body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; }

/* ── Layout ── */
.shell { display: grid; grid-template-rows: auto 1fr auto; min-height: 100vh; }
.topbar { background: var(--brand); color: #fff; padding: 0 24px; height: 52px; display: flex; align-items: center; gap: 16px; position: sticky; top: 0; z-index: 30; }
.topbar-title { font-size: 1rem; font-weight: 600; letter-spacing: -.01em; }
.topbar-sub { font-size: .8rem; opacity: .7; }
.proj-tab { background: rgba(255,255,255,.15); color: rgba(255,255,255,.85); border: 1px solid rgba(255,255,255,.3); border-radius: 20px; padding: 4px 12px; font-size: .78rem; cursor: pointer; white-space: nowrap; transition: background .15s; }
.proj-tab:hover { background: rgba(255,255,255,.28); }
.proj-tab.active { background: #fff; color: var(--brand); font-weight: 600; border-color: #fff; }
@media (max-width: 600px) {
  .topbar { padding: 0 10px; gap: 6px; height: auto; min-height: 52px; flex-wrap: wrap; padding-top: 6px; padding-bottom: 6px; }
  .topbar-title { font-size: .85rem; }
  .topbar-sub { display: none; }
  .proj-tab { font-size: .72rem; padding: 3px 8px; }
  #session-indicator { display: none; }
}
.main { padding: 24px; max-width: 960px; margin: 0 auto; width: 100%; }
.footer-nav { border-top: 1px solid var(--border); background: var(--card); padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; gap: 12px; position: sticky; bottom: 0; }

/* ── Social Posts Panel ── */
#sp-panel { display:none;position:fixed;top:52px;left:0;right:0;bottom:0;background:var(--bg);z-index:100;overflow-y:auto; }
.sp-inner { max-width:980px;margin:0 auto;padding:24px; }
.sp-header { display:flex;align-items:center;justify-content:space-between;margin-bottom:20px; }
.sp-title { font-size:1.2rem;font-weight:700;color:var(--text); }
.sp-grid { display:grid;grid-template-columns:340px 1fr;gap:24px;align-items:start; }
@media(max-width:820px){.sp-grid{grid-template-columns:1fr}}
.sp-form-card { background:var(--card);border:1px solid var(--border);border-radius:10px;padding:20px;position:sticky;top:20px; }
.sp-form-title { font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:16px; }
.sp-field { margin-bottom:14px; }
.sp-field label { display:block;font-size:.82rem;font-weight:600;color:var(--text);margin-bottom:5px; }
.sp-field input,.sp-field select,.sp-field textarea { width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:.88rem;color:var(--text);background:var(--card);box-sizing:border-box; }
.sp-field input:focus,.sp-field select:focus,.sp-field textarea:focus { outline:none;border-color:var(--brand); }
.sp-platforms { display:flex;flex-wrap:wrap;gap:8px;margin-top:4px; }
.sp-platform-cb { display:flex;align-items:center;gap:5px;font-size:.83rem;font-weight:500;cursor:pointer; }
.sp-link-row { display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap; }
.sp-link-opt { display:flex;align-items:center;gap:4px;font-size:.82rem;cursor:pointer;font-weight:500; }
.sp-cards { display:flex;flex-direction:column;gap:16px; }
.sp-card { background:var(--card);border:1px solid var(--border);border-radius:10px;overflow:hidden; }
.sp-card-header { display:flex;align-items:center;justify-content:space-between;padding:12px 16px;border-bottom:1px solid var(--border);background:#f8fafc; }
.sp-card-platform { font-size:.85rem;font-weight:700;color:var(--text);display:flex;align-items:center;gap:7px; }
.sp-card-actions { display:flex;gap:6px; }
.sp-card-body { padding:14px 16px; }
.sp-card textarea { width:100%;border:1px solid var(--border);border-radius:6px;padding:10px;font-size:.87rem;line-height:1.6;color:var(--text);background:var(--bg);resize:vertical;min-height:120px;box-sizing:border-box;font-family:inherit; }
.sp-card textarea:focus { outline:none;border-color:var(--brand); }
.sp-empty { text-align:center;padding:60px 24px;color:var(--muted);font-size:.9rem; }
.sp-empty-icon { font-size:2.5rem;margin-bottom:12px; }
.sp-actions-bar { display:flex;align-items:center;gap:10px;margin-bottom:16px;flex-wrap:wrap; }
.sp-history { margin-top:28px; }
.sp-history-title { font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:12px; }
.sp-history-item { background:var(--card);border:1px solid var(--border);border-radius:8px;padding:12px 14px;margin-bottom:8px;display:flex;align-items:flex-start;gap:12px; }
.sp-history-meta { flex:1;min-width:0; }
.sp-history-topic { font-size:.88rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis; }
.sp-history-sub { font-size:.75rem;color:var(--muted);margin-top:2px; }
.sp-btn-link { background:none;border:none;color:var(--brand);cursor:pointer;font-size:.8rem;font-weight:600;padding:0;text-decoration:underline; }

/* ── Progress bar ── */
.progress-wrap { background: var(--card); border-bottom: 1px solid var(--border); padding: 16px 24px; position: sticky; top: 52px; z-index: 20; }
.progress-steps { display: flex; align-items: center; gap: 0; max-width: 960px; margin: 0 auto; }
.step-item { display: flex; align-items: center; flex: 1; }
.step-item:last-child { flex: 0; }
.step-circle { width: 32px; height: 32px; border-radius: 50%; border: 2px solid var(--border); background: var(--card); display: flex; align-items: center; justify-content: center; font-size: .75rem; font-weight: 700; color: var(--muted); transition: all .2s; flex-shrink: 0; cursor: pointer; }
.step-circle:hover { border-color: var(--brand); color: var(--brand); }
.step-circle.done { background: var(--brand); border-color: var(--brand); color: #fff; }
.step-circle.done:hover { opacity: .85; }
.step-circle.active { background: var(--card); border-color: var(--brand); color: var(--brand); }
.step-connector { flex: 1; height: 2px; background: var(--border); transition: background .2s; }
.step-connector.done { background: var(--brand); }
.step-label { font-size: .7rem; color: var(--muted); margin-top: 4px; white-space: nowrap; }
.step-wrap { display: flex; flex-direction: column; align-items: center; }
.campaign-bar { background: #eef2ff; border-bottom: 1px solid #c7d2fe; padding: 7px 24px; display: flex; align-items: center; gap: 10px; font-size: .82rem; }
.campaign-bar-pill { display: inline-flex; align-items: center; gap: 6px; background: #fff; border: 1px solid #c7d2fe; border-radius: 20px; padding: 3px 10px; font-weight: 600; color: #3730a3; }
.campaign-bar-status { font-size: .72rem; font-weight: 600; padding: 1px 7px; border-radius: 10px; background: #d1fae5; color: #065f46; }
.campaign-bar-status.in-progress { background: #fef3c7; color: #92400e; }
.campaign-bar-status.new { background: #e0e7ff; color: #3730a3; }
.campaign-bar-btn { background: none; border: 1px solid #818cf8; color: #4338ca; border-radius: 6px; padding: 3px 10px; font-size: .78rem; font-weight: 600; cursor: pointer; font-family: inherit; transition: background .15s; }
.campaign-bar-btn:hover { background: #e0e7ff; }
.campaign-bar-btn.primary { background: #4338ca; color: #fff; border-color: #4338ca; }
.campaign-bar-btn.primary:hover { background: #3730a3; }

/* ── Cards & Forms ── */
.card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); box-shadow: var(--shadow); padding: 24px; margin-bottom: 20px; }
.card-title { font-size: 1rem; font-weight: 600; margin-bottom: 4px; color: var(--text); }
.card-sub { font-size: .825rem; color: var(--muted); margin-bottom: 20px; }
.form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.form-grid.cols-3 { grid-template-columns: 1fr 1fr 1fr; }
.form-grid.cols-1 { grid-template-columns: 1fr; }
.field { display: flex; flex-direction: column; gap: 5px; }
.field.span2 { grid-column: span 2; }
.field label { font-size: .8rem; font-weight: 600; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.field input, .field select, .field textarea {
  border: 1px solid var(--border); border-radius: 6px; padding: 8px 10px; font-size: .9rem;
  background: #fff; color: var(--text); transition: border .15s; font-family: inherit;
}
.field input:focus, .field select:focus, .field textarea:focus { outline: none; border-color: var(--brand); }
.field textarea { resize: vertical; min-height: 72px; }
.field-hint { font-size: .75rem; color: var(--muted); }
.field-error { font-size: .75rem; color: var(--danger); display: none; }
.field.has-error input, .field.has-error select { border-color: var(--danger); }
.field.has-error .field-error { display: block; }

/* ── Buttons ── */
.btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 18px; border-radius: 6px; border: none; font-size: .875rem; font-weight: 600; cursor: pointer; transition: all .15s; font-family: inherit; }
.btn:disabled { opacity: .5; cursor: not-allowed; }
.btn-primary { background: var(--brand); color: #fff; }
.btn-primary:hover:not(:disabled) { background: var(--brand-dark); }
.btn-secondary { background: var(--card); color: var(--text); border: 1px solid var(--border); }
.btn-secondary:hover:not(:disabled) { background: var(--bg); }
.btn-accent { background: var(--accent); color: #fff; }
.btn-accent:hover:not(:disabled) { background: #158da8; }
.btn-danger { background: var(--danger); color: #fff; }
.btn-sm { padding: 5px 12px; font-size: .8rem; }
.btn-ghost { background: transparent; color: var(--brand); border: none; padding: 5px 8px; font-size: .85rem; }
.btn-ghost:hover { text-decoration: underline; }

/* ── Image Library ── */
.lib-filter-btn { font-size:.68rem; padding:2px 8px; border-radius:10px; border:1px solid var(--border); background:#f1f5f9; color:var(--muted); cursor:pointer; font-weight:600; transition:all .12s; }
.lib-filter-btn.active { background:var(--primary); color:#fff; border-color:var(--primary); }
.lib-filter-btn:hover:not(.active) { background:#e2e8f0; }
.lib-img-card { border:1px solid var(--border); border-radius:6px; overflow:hidden; cursor:pointer; transition:box-shadow .12s; background:#fff; }
.lib-img-card:hover { box-shadow:0 0 0 2px var(--primary); }
.lib-img-thumb { aspect-ratio:16/9; overflow:hidden; background:#f1f5f9; position:relative; }
.lib-img-thumb img { width:100%; height:100%; object-fit:cover; }
.lib-img-badge { position:absolute; top:4px; left:4px; font-size:.6rem; padding:2px 5px; border-radius:6px; font-weight:700; }
.lib-img-select { display:block; margin:4px 6px 5px; padding:3px 10px; font-size:.68rem; font-weight:600; border-radius:4px; border:1px solid var(--border); background:#f8fafc; color:var(--text); cursor:pointer; transition:all .12s; width:calc(100% - 12px); text-align:center; }
.lib-img-select:hover:not(:disabled) { background:#e2e8f0; border-color:var(--primary); color:var(--primary); }
.lib-img-select.selected { background:#fee2e2; color:#b91c1c; border-color:#fca5a5; font-weight:700; }
.lib-img-select.selected:hover { background:#fecaca; border-color:#ef4444; }
.lib-img-select.loading { background:#fef3c7; color:#92400e; border-color:#fde68a; cursor:wait; }
.lib-img-name { padding:4px 6px; font-size:.7rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; color:var(--text); }

/* ── Badges ── */
.badge { display: inline-flex; align-items: center; padding: 2px 8px; border-radius: 999px; font-size: .7rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.badge-priority { background: #dcfce7; color: var(--priority); }
.badge-secondary { background: #fef3c7; color: var(--secondary); }
.badge-tertiary { background: #f1f5f9; color: var(--tertiary); }
.badge-ready { background: #dcfce7; color: var(--priority); }
.badge-review { background: #fef3c7; color: var(--secondary); }
.badge-blocked { background: #fee2e2; color: var(--danger); }

/* ── Alert ── */
.alert { padding: 12px 16px; border-radius: 6px; font-size: .85rem; margin-bottom: 16px; border: 1px solid transparent; }
.alert-info { background: #e0f2fe; border-color: #7dd3fc; color: #075985; }
.alert-warn { background: #fef3c7; border-color: #fcd34d; color: #92400e; }
.alert-error { background: #fee2e2; border-color: #fca5a5; color: #991b1b; }
.alert-success { background: #dcfce7; border-color: #86efac; color: #166534; }

/* ── Table ── */
.table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: var(--radius); }
table { border-collapse: collapse; width: 100%; font-size: .85rem; }
thead th { background: #f8fafc; font-size: .72rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); font-weight: 700; padding: 10px 12px; border-bottom: 2px solid var(--border); text-align: left; white-space: nowrap; }
tbody td { padding: 10px 12px; border-bottom: 1px solid var(--border); vertical-align: middle; }
tbody tr:last-child td { border-bottom: none; }
tbody tr:hover { background: #f8fafc; }
.score-bar { height: 6px; border-radius: 3px; background: var(--border); overflow: hidden; min-width: 60px; }
.score-bar-fill { height: 100%; border-radius: 3px; background: var(--brand); }

/* ── Stage panels ── */
.stage { display: none; }
.stage.active { display: block; }

/* ── Stage 3 controls ── */
.area-controls { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; margin-bottom: 16px; }
.engine-summary { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 20px; }
.engine-stat { background: var(--card); border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; }
.engine-stat-value { font-size: 1.5rem; font-weight: 700; color: var(--brand); }
.engine-stat-label { font-size: .75rem; color: var(--muted); margin-top: 2px; }

/* ── Stage 4 keyword cards ── */
.kw-card { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); margin-bottom: 12px; overflow: hidden; }
.kw-card-header { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; user-select: none; background: #f8fafc; border-bottom: 1px solid var(--border); }
.kw-card-body { padding: 16px; display: none; }
.kw-card.open .kw-card-body { display: block; }
.kw-card-title { font-weight: 600; font-size: .9rem; flex: 1; }
.tag-editor { display: flex; flex-wrap: wrap; gap: 6px; padding: 8px 10px; border: 1px solid var(--border); border-radius: 6px; cursor: text; min-height: 42px; }
.tag { display: inline-flex; align-items: center; gap: 4px; background: #dbeafe; color: #1d4ed8; padding: 2px 8px; border-radius: 999px; font-size: .78rem; font-weight: 500; }
.tag-remove { background: none; border: none; cursor: pointer; color: inherit; font-size: .9rem; line-height: 1; padding: 0 2px; }
.tag-input { border: none; outline: none; font-size: .85rem; min-width: 140px; flex: 1; background: transparent; font-family: inherit; }
/* ── Keyword suggestion chips ── */
.kw-suggest-result { margin-top: 12px; padding: 12px 14px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; }
.kw-suggest-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 8px; }
.kw-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.kw-chip { padding: 4px 11px; border-radius: 999px; font-size: .78rem; font-weight: 600; cursor: pointer; background: #eff6ff; color: var(--brand); border: 1px solid #bfdbfe; font-family: inherit; transition: background .12s, color .12s; }
.kw-chip:hover:not(:disabled) { background: var(--brand); color: #fff; border-color: var(--brand); }
.kw-chip--added { background: #f1f5f9; color: var(--muted); border-color: #e2e8f0; cursor: default; }
.kw-suggest-loading { font-size: .82rem; color: var(--muted); padding: 6px 0; }
.kw-suggest-error { font-size: .82rem; color: var(--error); padding: 6px 0; }

/* ── Stage 5 ── */
.rollout-split { display: grid; grid-template-columns: 1fr 1.4fr; gap: 20px; }
.rollout-list { background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; }
.rollout-list-header { padding: 12px 16px; background: #f8fafc; border-bottom: 1px solid var(--border); font-size: .8rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
.rollout-list-body { padding: 0; }
.rollout-area { display: flex; align-items: center; gap: 10px; padding: 10px 16px; border-bottom: 1px solid var(--border); font-size: .85rem; }
.rollout-area:last-child { border-bottom: none; }
.rollout-area-num { font-size: .72rem; color: var(--muted); font-weight: 700; width: 20px; text-align: center; flex-shrink: 0; }
.rollout-area-name { flex: 1; font-weight: 500; }
.rollout-area-path { font-size: .75rem; color: var(--muted); font-family: monospace; }
.rollout-area.deferred { opacity: .5; }
.progress-log { background: #0f172a; border-radius: var(--radius); padding: 16px; font-family: monospace; font-size: .78rem; color: #94a3b8; min-height: 200px; max-height: 400px; overflow-y: auto; white-space: pre-wrap; }
.log-line-ok { color: #4ade80; }
.log-line-err { color: #f87171; }
.log-line-info { color: #94a3b8; }
.log-line-dim { color: #475569; }
.mode-toggle { display: flex; gap: 0; border: 1px solid var(--border); border-radius: 6px; overflow: hidden; margin-bottom: 16px; }
.mode-btn { flex: 1; padding: 9px 14px; font-size: .85rem; font-weight: 600; border: none; background: var(--card); cursor: pointer; transition: all .15s; font-family: inherit; color: var(--muted); }
.mode-btn.selected { background: var(--brand); color: #fff; }

/* ── Stage 6 ── */
.val-row-detail { display: none; background: #f8fafc; }
.val-row-detail.open { display: table-row; }
.val-categories { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; padding: 12px; }
.val-cat { font-size: .8rem; }
.val-cat-name { color: var(--muted); margin-bottom: 3px; }
.val-cat-score { font-weight: 700; }

/* ── Stage 7 ── */
.output-grid { display: grid; grid-template-columns: 1.2fr 1fr; gap: 20px; }
.file-list { font-family: monospace; font-size: .8rem; }
.file-item { display: flex; align-items: center; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid var(--border); gap: 12px; }
.file-item:last-child { border-bottom: none; }
.file-path { color: var(--text); }
.file-size { color: var(--muted); font-size: .72rem; white-space: nowrap; }
.file-status { color: var(--success); font-size: .75rem; white-space: nowrap; }

/* ── Stage 8 — Indexing ── */
.indexing-url-box { background: #f8fafc; border: 1px solid var(--border); border-radius: 6px; padding: 14px 16px; margin-bottom: 0; }
.indexing-url-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-bottom: 6px; }
.indexing-url-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.indexing-url-text { font-family: monospace; font-size: .85rem; color: var(--brand); word-break: break-all; flex: 1; }
.sc-status-row { display: flex; align-items: flex-start; gap: 10px; padding: 9px 0; border-bottom: 1px solid var(--border); }
.sc-status-row:last-child { border-bottom: none; }
.sc-step-num { width: 24px; height: 24px; border-radius: 50%; background: var(--brand); color: #fff; font-size: .72rem; font-weight: 700; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-top: 1px; }
.sc-step-text { flex: 1; font-size: .875rem; line-height: 1.4; }
.sc-status-badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; }
.sc-status-not-connected { background: #f1f5f9; color: var(--muted); }
.sc-status-checking { background: #fef3c7; color: #92400e; }
.sc-status-granted { background: #dcfce7; color: #166534; }
.sc-status-submitted { background: #dbeafe; color: #1d4ed8; }
.sc-manual-step { display: flex; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.sc-manual-step:last-child { border-bottom: none; }
.sc-manual-num { font-size: 1rem; font-weight: 700; color: var(--brand); width: 24px; flex-shrink: 0; }

/* ── Index Tracking Dashboard ── */
.it-stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.it-stat-box { flex: 1; min-width: 100px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; text-align: center; }
.it-stat-num { font-size: 1.75rem; font-weight: 800; line-height: 1; }
.it-stat-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-top: 4px; }
.it-stat-num.indexed { color: #16a34a; }
.it-stat-num.not-indexed { color: #dc2626; }
.it-stat-num.unknown { color: #92400e; }
.it-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.it-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.it-table th { background: #f8fafc; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.it-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; word-break: break-all; }
.it-table tr:last-child td { border-bottom: none; }
.it-badge { display: inline-flex; align-items: center; padding: 2px 9px; border-radius: 999px; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .04em; white-space: nowrap; }
.it-badge-indexed { background: #dcfce7; color: #166534; }
.it-badge-not-indexed { background: #fee2e2; color: #991b1b; }
.it-badge-unknown { background: #f1f5f9; color: var(--muted); }
.it-run-info { font-size: .8rem; color: var(--muted); margin-bottom: 14px; }

/* ── Keyword Tracking Dashboard ── */
.kt-stats-row { display: flex; gap: 12px; flex-wrap: wrap; margin-bottom: 20px; }
.kt-stat-box { flex: 1; min-width: 90px; background: #f8fafc; border: 1px solid var(--border); border-radius: 8px; padding: 14px 16px; text-align: center; }
.kt-stat-num { font-size: 1.75rem; font-weight: 800; line-height: 1; color: var(--brand); }
.kt-stat-num.kt-green { color: #16a34a; }
.kt-stat-num.kt-red { color: #dc2626; }
.kt-stat-num.kt-amber { color: #d97706; }
.kt-stat-label { font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); margin-top: 4px; }
.kt-table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: 8px; }
.kt-table { width: 100%; border-collapse: collapse; font-size: .85rem; }
.kt-table th { background: #f8fafc; font-size: .72rem; font-weight: 700; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); white-space: nowrap; }
.kt-table td { padding: 10px 14px; border-bottom: 1px solid var(--border); vertical-align: middle; }
.kt-table tr:last-child td { border-bottom: none; }
.kt-pos { display: inline-flex; align-items: center; justify-content: center; width: 42px; height: 28px; border-radius: 6px; font-weight: 700; font-size: .85rem; background: #f1f5f9; color: var(--text); }
.kt-pos.top3 { background: #fef9c3; color: #92400e; }
.kt-pos.top10 { background: #dcfce7; color: #166534; }
.kt-pos.top20 { background: #dbeafe; color: #1d4ed8; }
.kt-change { font-size: .8rem; font-weight: 700; }
.kt-change.up { color: #16a34a; }
.kt-change.down { color: #dc2626; }
.kt-change.new { color: var(--brand); }
.kt-run-info { font-size: .8rem; color: var(--muted); margin-bottom: 14px; }

/* ── Resume banner ── */
#resume-banner { display: none; }

/* ── Nav item rows ── */
.nav-items-list { display: flex; flex-direction: column; gap: 8px; }
.nav-item-row { display: flex; gap: 8px; align-items: center; }
.nav-item-row input { flex: 1; }
.nav-item-remove { background: none; border: none; cursor: pointer; color: var(--danger); font-size: 1.1rem; line-height: 1; padding: 4px; }

/* ── Utility ── */
.hidden { display: none !important; }
.flex { display: flex; }
.flex-col { flex-direction: column; }
.gap-2 { gap: 8px; }
.gap-3 { gap: 12px; }
.mt-2 { margin-top: 8px; }
.mt-3 { margin-top: 12px; }
.mt-4 { margin-top: 16px; }
.text-muted { color: var(--muted); font-size: .85rem; }
.text-sm { font-size: .82rem; }
.fw-600 { font-weight: 600; }
.mono { font-family: monospace; }
@keyframes spin { to { transform: rotate(360deg); } }
</style>
<script>
// Server-injected project data — form is pre-populated instantly, no async wait needed
window.__INITIAL_PROJECT__ = ${initialProject ? JSON.stringify(initialProject) : 'null'};
const INTERNAL_TOKEN = '${internalToken.replace(/'/g, "\\'")}';
</script>
</head>
<body>
<div class="shell">

<!-- Top bar -->
<header class="topbar">
  <div style="display:flex;align-items:center;gap:14px">
    <a href="/api/admin/master" target="_top" style="font-size:.8rem;font-weight:600;color:var(--muted);text-decoration:none;white-space:nowrap;padding:4px 10px;border:1px solid var(--border);border-radius:6px;background:var(--card);line-height:1.4" title="Back to pharmacy/client list">← Dashboard</a>
    <div>
      <div class="topbar-title">Local SEO Page Builder</div>
      <div class="topbar-sub">Setup Wizard</div>
    </div>
  </div>
  <div style="flex:1"></div>
  <div style="display:flex;align-items:center;gap:6px" id="project-tabs">
    ${projectTabs}
  </div>
  <button onclick="SP.open()" style="font-size:.8rem;font-weight:600;color:var(--brand);white-space:nowrap;padding:4px 10px;border:1px solid var(--brand);border-radius:6px;background:var(--card);cursor:pointer;line-height:1.4" title="Social Post Generator">✍ Social Posts</button>
  <div id="session-indicator" class="text-sm" style="opacity:.85;white-space:nowrap;display:none"></div>
</header>

<!-- Progress bar -->
<div class="progress-wrap">
  <div class="progress-steps" id="progress-steps">
    <!-- JS renders steps here -->
  </div>
</div>

<!-- Persistent campaign bar — shown on stages 2-8 when a campaign is active -->
<div id="campaign-bar" class="campaign-bar" style="display:none"></div>

<div id="resume-banner" class="alert alert-info" style="margin:16px 24px 0;border-radius:var(--radius)">
  <strong>Saved session found.</strong>
  <span id="resume-text"></span>
  <button class="btn btn-sm btn-secondary" style="margin-left:12px" onclick="App.resumeSession()">Resume</button>
  <button class="btn btn-sm btn-ghost" onclick="App.dismissResume()">Start fresh</button>
</div>

<!-- Main content -->
<main class="main">

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 1 — Business Setup -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-1" class="stage active">

  <!-- Profile Completion Widget -->
  <div id="completion-widget" style="display:none;background:#fff;border:1px solid var(--border);border-radius:10px;padding:16px 20px;margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
      <div style="font-weight:600;font-size:.95rem">Profile Completion</div>
      <div id="completion-score-label" style="font-size:.85rem;font-weight:700"></div>
    </div>
    <div style="background:#e2e8f0;border-radius:99px;height:8px;overflow:hidden;margin-bottom:10px">
      <div id="completion-bar" style="height:100%;border-radius:99px;transition:width .4s;width:0%"></div>
    </div>
    <div id="completion-items" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:4px 16px;font-size:.78rem"></div>
    <div id="completion-warning" style="display:none;margin-top:10px;padding:8px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:.82rem;color:#713f12">
      ⚠️ Complete your profile before generating pages.
    </div>
  </div>

  <div class="card">
    <div class="card-title">Business Profile</div>
    <div class="card-sub">Load an existing project or create a new one. All fields are saved to <code>config/projects/&lt;slug&gt;.json</code>.</div>

    <div id="project-loader" class="flex gap-2 mb-3" style="margin-bottom:16px">
      <select id="existing-project-select" style="flex:1;border:1px solid var(--border);border-radius:6px;padding:8px 10px;font-size:.9rem">
        <option value="">— Load an existing project —</option>
        ${projectOptions}
      </select>
      <button class="btn btn-secondary" onclick="App.loadExistingProject()">Load</button>
      <button class="btn btn-secondary" onclick="App.newProject()" title="Clear the form to create a new project">+ New</button>
    </div>

    <!-- keep quick-jump id so any existing refs still work -->
    <div id="quick-jump" style="display:none"></div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:12px">Identity</div>
    <div class="form-grid">
      <div class="field" id="f-businessName">
        <label>Business name *</label>
        <input type="text" id="businessName" placeholder="InboxingProWeb"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-clientSlug">
        <label>Client slug *</label>
        <input type="text" id="clientSlug" placeholder="inboxingproweb-local" pattern="[a-z0-9-]+" autocomplete="off"/>
        <span class="field-hint" id="clientSlug-hint">Lowercase letters, numbers and hyphens only.</span>
        <span class="field-error">Use lowercase letters, numbers and hyphens only</span>
      </div>
      <div class="field">
        <label>Legal / registered name</label>
        <input type="text" id="legalName" placeholder="DHM Digital Limited"/>
      </div>
      <div class="field">
        <label>Company number</label>
        <input type="text" id="companyNumber" placeholder="16953956"/>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">Contact &amp; Domain</div>
    <div class="form-grid">
      <div class="field" id="f-domain">
        <label>Domain (with https://) *</label>
        <input type="url" id="domain" placeholder="https://local.inboxingproweb.com"/>
        <span class="field-error">Must start with https://</span>
      </div>
      <div class="field" id="f-phone">
        <label>Phone *</label>
        <input type="text" id="phone" placeholder="0114 000 0000" autocomplete="off"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-email">
        <label>Email *</label>
        <input type="email" id="email" placeholder="info@inboxingproweb.com"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-businessAddress">
        <label>Business address *</label>
        <input type="text" id="businessAddress" placeholder="South Grove, Rotherham, S60 2DH"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-mapLatitude">
        <label>Map latitude</label>
        <input type="number" id="mapLatitude" step="any" placeholder="53.4262892"/>
        <span class="field-hint">Decimal latitude from Google Maps URL.</span>
      </div>
      <div class="field" id="f-mapLongitude">
        <label>Map longitude</label>
        <input type="number" id="mapLongitude" step="any" placeholder="-1.3551445"/>
        <span class="field-hint">Decimal longitude from Google Maps URL.</span>
      </div>
      <div class="field" id="f-mapZoom">
        <label>Map zoom level</label>
        <input type="number" id="mapZoom" min="1" max="21" placeholder="17"/>
        <span class="field-hint">1 (world) – 21 (street). 17 recommended for a business pin.</span>
      </div>
      <div class="field" id="f-googleMapUrl" style="grid-column:1/-1">
        <label>Google Maps business URL <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
        <input type="url" id="googleMapUrl" placeholder="https://www.google.com/maps/place/..."/>
        <span class="field-hint">The full Google Maps link to your business listing — used for "View on Google Maps ↗" links.</span>
      </div>
      <div class="field" id="f-mapEmbedUrl" style="grid-column:1/-1">
        <label>Custom map embed URL <span style="font-weight:400;color:var(--muted)">(optional — overrides coordinates)</span></label>
        <input type="text" id="mapEmbedUrl" placeholder="Leave blank to auto-build from coordinates above"/>
        <span class="field-hint">Only fill this if you need a custom embed (e.g. OpenStreetMap). If blank and coordinates are set, the map is auto-built from latitude/longitude.</span>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">Business Details</div>
    <div class="form-grid">
      <div class="field">
        <label>Business type / industry</label>
        <select id="businessType" onchange="App.suggestTemplate(this.value)">
          <option value="">— Select industry —</option>
          <option value="web_design">Web Design Agency</option>
          <option value="digital_marketing">Digital Marketing Agency</option>
          <option value="seo_agency">SEO Agency</option>
          <option value="plumbing">Plumbing &amp; Heating</option>
          <option value="electrical">Electrical Services</option>
          <option value="building_trades">Building &amp; Construction</option>
          <option value="cleaning">Cleaning Services</option>
          <option value="landscaping">Landscaping &amp; Gardening</option>
          <option value="accountancy">Accountancy &amp; Finance</option>
          <option value="legal">Legal Services</option>
          <option value="healthcare">Healthcare &amp; Wellbeing</option>
          <option value="beauty">Beauty &amp; Aesthetics</option>
          <option value="hair_salon">Hair Salon</option>
          <option value="retail">Retail</option>
          <option value="restaurant">Restaurant &amp; Hospitality</option>
          <option value="consulting">Consulting</option>
          <option value="financial_advice">Financial Advice</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div class="field">
        <label>Page template</label>
        <select id="templateId">
          <option value="inboxingproweb_default">InboxingProWeb Default — web design / digital agency</option>
          <option value="trades_home_services">Trades &amp; Home Services — plumbing, electrical, cleaning…</option>
          <option value="beauty_clinic">Beauty &amp; Clinic — hair salon, aesthetics, nail studio…</option>
          <option value="professional_services">Professional Services — accountants, solicitors, consultants…</option>
          <option value="retail_local_shop">Retail &amp; Local Shop — boutiques, independent retailers…</option>
        </select>
        <small style="color:var(--muted)">Controls the block layout and visual style used when generating pages. Choosing the right template for the industry gives AI content prompts the best structure.</small>
      </div>
      <div class="field">
        <label>Main service</label>
        <input type="text" id="mainService" placeholder="e.g. Web Design, Local SEO, Plumbing"/>
        <span class="field-hint">The primary service you want to promote</span>
      </div>
      <div class="field">
        <label>Additional services</label>
        <input type="text" id="additionalServices" placeholder="e.g. Hosting, SEO, Social Media (comma separated)"/>
        <span class="field-hint">Comma-separated list of secondary services</span>
      </div>
      <div class="field">
        <label>Primary location</label>
        <input type="text" id="primaryLocation" placeholder="e.g. Rotherham, Sheffield"/>
        <span class="field-hint">The main city or town you serve</span>
      </div>
      <div class="field">
        <label>Service areas</label>
        <input type="text" id="serviceAreas" placeholder="e.g. Rotherham, Sheffield, Barnsley, Doncaster"/>
        <span class="field-hint">Comma-separated list of all service areas</span>
      </div>
      <div class="field">
        <label>Tone of voice</label>
        <select id="toneOfVoice">
          <option value="professional">Professional &amp; authoritative</option>
          <option value="friendly">Friendly &amp; approachable</option>
          <option value="local_trades">Local trades / no-nonsense</option>
          <option value="premium">Premium &amp; polished</option>
          <option value="technical">Technical &amp; expert</option>
        </select>
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Short business description</label>
        <textarea id="description" rows="3" placeholder="A brief description of your business for use in content and meta data (40–120 words)…" style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
        <span class="field-hint">Used to inform AI content generation — be specific about what makes you different</span>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">CTA &amp; Assets</div>
    <div class="form-grid">
      <div class="field">
        <label>Primary CTA text</label>
        <input type="text" id="primaryCtaText" value="Request a Quote"/>
      </div>
      <div class="field">
        <label>Primary CTA URL</label>
        <input type="url" id="primaryCtaUrl" placeholder="https://…/contact/"/>
      </div>
      <div class="field" id="f-logoUrl">
        <label>Logo URL *</label>
        <input type="url" id="logoUrl" placeholder="https://…/logo.png"/>
        <label style="display:flex;align-items:center;gap:6px;margin-top:6px;font-weight:400;font-size:.82rem;cursor:pointer">
          <input type="checkbox" id="skipLogo" onchange="App.onSkipLogoChange()"/> Skip logo for now
        </label>
        <span class="field-error">Required — enter a URL or tick "Skip logo"</span>
      </div>
      <div class="field">
        <label>Strapline / tagline <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
        <input type="text" id="strapline" placeholder="e.g. Professional Web Design for Local Businesses"/>
        <span class="field-hint">Short tagline used in the header or hero of generated pages</span>
      </div>
      <div class="field" id="f-footerCompanyName">
        <label>Footer company name *</label>
        <input type="text" id="footerCompanyName" placeholder="DHM Digital Limited"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field">
        <label>Privacy policy URL</label>
        <input type="text" id="privacyUrl" value="/privacy-policy/"/>
      </div>
      <div class="field">
        <label>Terms URL</label>
        <input type="text" id="termsUrl" value="/terms/"/>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">Branding</div>
    <div class="form-grid cols-3">
      <div class="field">
        <label>Default brand colour</label>
        <input type="color" id="brandColour" value="#000000"/>
        <span class="field-hint">Used in generated page headers &amp; buttons. Default: black.</span>
      </div>
      <div class="field">
        <label>Primary colour</label>
        <input type="color" id="primaryColor" value="#005EB8"/>
      </div>
      <div class="field">
        <label>Accent colour</label>
        <input type="color" id="accentColor" value="#1CA9C9"/>
      </div>
    </div>

    <div style="margin-top:16px">
      <label style="font-size:.8rem;font-weight:600;color:var(--text);display:block;margin-bottom:10px;text-transform:uppercase;letter-spacing:.04em">Preferred Brand Style</label>
      <div style="display:flex;flex-wrap:wrap;gap:8px" id="brandStyle-options">
        ${[
          {val:"professional", label:"Professional"},
          {val:"modern",       label:"Modern"},
          {val:"friendly",     label:"Friendly"},
          {val:"premium",      label:"Premium"},
          {val:"local_trades", label:"Local / Trades"},
        ].map(o => `
        <label style="display:flex;align-items:center;gap:6px;padding:6px 14px;border:1px solid var(--border);border-radius:6px;cursor:pointer;font-size:.85rem;user-select:none" id="brandStyle-label-${o.val}">
          <input type="radio" name="brandStyle" value="${o.val}" id="brandStyle-${o.val}" onchange="App.onBrandStyleChange()" style="accent-color:var(--primary)"/>
          ${o.label}
        </label>`).join("")}
      </div>
    </div>

    <div class="form-grid" style="margin-top:16px">
      <div class="field">
        <label>Font preference</label>
        <select id="fontPreference">
          <option value="">— System default —</option>
          <option value="inter">Inter (clean, modern)</option>
          <option value="roboto">Roboto (professional)</option>
          <option value="open_sans">Open Sans (friendly)</option>
          <option value="montserrat">Montserrat (premium)</option>
          <option value="lato">Lato (balanced)</option>
          <option value="poppins">Poppins (modern &amp; rounded)</option>
          <option value="playfair">Playfair Display (editorial/premium)</option>
        </select>
      </div>
      <div class="field" style="grid-column:1/-1">
        <label>Brand notes <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
        <textarea id="brandNotes" rows="2" placeholder="Any additional brand guidelines, colours, or style notes for the AI content generator…" style="width:100%;box-sizing:border-box;resize:vertical"></textarea>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">Header Navigation</div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:10px">Add at least one navigation item. Example: Home / https://example.com/</div>
    <div id="nav-items-list" class="nav-items-list" id="f-navItems"></div>
    <div id="nav-items-error" style="display:none;font-size:.8rem;color:var(--danger);margin-top:4px">At least one navigation item is required</div>
    <button class="btn btn-secondary btn-sm mt-2" onclick="App.addNavItem()">+ Add nav item</button>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:28px 0 12px">Footer Details</div>
    <div style="font-size:.82rem;color:var(--muted);margin-bottom:12px">These values are used in the footer of all generated pages. Business name, address and phone are pulled from the Contact &amp; Domain section above — add a footer strapline below if needed.</div>
    <div class="form-grid">
      <div class="field" style="grid-column:1/-1">
        <label>Footer strapline <span style="font-weight:400;color:var(--muted)">(optional)</span></label>
        <input type="text" id="footerStrapline" placeholder="e.g. Helping South Yorkshire Businesses Grow Online"/>
        <span class="field-hint">Short tagline shown in the footer of generated pages</span>
      </div>
    </div>

    <div style="font-size:.8rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.04em;margin:16px 0 6px">Footer Links <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:.78rem;color:var(--muted)">(optional) — e.g. Privacy Policy, Terms, Contact</span></div>
    <div id="footer-links-list" class="nav-items-list"></div>
    <button class="btn btn-secondary btn-sm mt-2" onclick="App.addFooterLink()">+ Add footer link</button>

    <div style="font-size:.8rem;font-weight:700;color:var(--text);text-transform:uppercase;letter-spacing:.04em;margin:20px 0 6px">Footer Service / Useful Links <span style="font-weight:400;text-transform:none;letter-spacing:0;font-size:.78rem;color:var(--muted)">(optional) — e.g. Web Design, Local SEO</span></div>
    <div id="footer-service-links-list" class="nav-items-list"></div>
    <button class="btn btn-secondary btn-sm mt-2" onclick="App.addFooterServiceLink()">+ Add service link</button>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:28px 0 12px">FTP Deploy</div>
    <div class="form-grid cols-3">
      <div class="field span2" style="grid-column:span 2">
        <label>FTP host</label>
        <input type="text" id="ftpHost" placeholder="ftp.example.com"/>
      </div>
      <div class="field">
        <label>Port</label>
        <input type="number" id="ftpPort" value="21"/>
      </div>
      <div class="field span2" style="grid-column:span 2">
        <label>Remote root</label>
        <input type="text" id="ftpRemoteRoot" value="/"/>
      </div>
      <div class="field">
        <label>FTP username</label>
        <input type="text" id="ftpUsername" placeholder="Leave blank to use server default" autocomplete="off"/>
        <span class="field-hint">Per-project override — leave blank to use the server default</span>
      </div>
      <div class="field">
        <label>FTP password</label>
        <div style="position:relative">
          <input type="password" id="ftpPassword" placeholder="Leave blank to use server default" autocomplete="new-password"/>
          <button type="button" onclick="App.togglePwVis('ftpPassword',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:.8rem">Show</button>
        </div>
        <span class="field-hint">Stored in project config — use env vars for production</span>
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">Image Mode</div>
    <div style="font-size:.85rem;color:var(--muted);margin-bottom:10px">How would you like to handle images on your generated pages?</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px" id="imageMode-options">
      ${[
        {val:"ai",     label:"AI-generated images",    icon:"🤖", hint:"Ideogram generates images for each page automatically"},
        {val:"own",    label:"Upload my own images",   icon:"📁", hint:"You upload images — AI generation is disabled"},
        {val:"mixed",  label:"Mix of uploaded &amp; AI", icon:"⚡", hint:"Uploaded images take priority; AI fills any empty slots"},
        {val:"skip",   label:"Skip images for now",    icon:"⏭️", hint:"No images on generated pages"},
      ].map(o => `
      <label id="imageMode-card-${o.val}" style="display:flex;flex-direction:column;gap:4px;padding:12px 14px;border:2px solid var(--border);border-radius:8px;cursor:pointer;transition:border-color .15s">
        <div style="display:flex;align-items:center;gap:8px">
          <input type="radio" name="imageMode" value="${o.val}" onchange="App.onImageModeChange()" style="accent-color:var(--primary)"/>
          <span style="font-size:1rem">${o.icon}</span>
          <span style="font-weight:600;font-size:.88rem">${o.label}</span>
        </div>
        <div style="font-size:.76rem;color:var(--muted);padding-left:24px">${o.hint}</div>
      </label>`).join("")}
    </div>
    <div id="imageMode-ai-notice" style="display:none;margin-top:10px;padding:8px 12px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;font-size:.82rem;color:#1e40af">
      ℹ️ AI image mode requires a valid Ideogram API key — set it in API Connections below.
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:20px 0 12px">API Connections</div>
    <div style="display:grid;gap:12px">

      <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-weight:600;font-size:.9rem">OpenAI <span style="font-size:.78rem;color:var(--muted);font-weight:400">(content generation)</span></div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:2px">Used to write page content, meta descriptions and keyword targeting</div>
          </div>
          <span id="openai-status" style="font-size:.75rem;padding:3px 9px;border-radius:12px;background:#f1f5f9;color:var(--muted)">Not tested</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="position:relative;flex:1">
            <input type="password" id="openaiApiKey" placeholder="sk-… (leave blank to use server key)" autocomplete="new-password" style="width:100%;padding-right:52px"/>
            <button type="button" onclick="App.togglePwVis('openaiApiKey',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:.8rem">Show</button>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.testOpenAI()" id="btn-test-openai">Test</button>
        </div>
        <div id="openai-test-msg" style="font-size:.8rem;margin-top:6px"></div>
      </div>

      <div style="border:1px solid var(--border);border-radius:8px;padding:14px 16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
          <div>
            <div style="font-weight:600;font-size:.9rem">Ideogram AI <span style="font-size:.78rem;color:var(--muted);font-weight:400">(image generation)</span></div>
            <div style="font-size:.78rem;color:var(--muted);margin-top:2px">Used to generate hero, support &amp; conversion images during rollout</div>
          </div>
          <span id="ideogram-status" style="font-size:.75rem;padding:3px 9px;border-radius:12px;background:#f1f5f9;color:var(--muted)">Not tested</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center">
          <div style="position:relative;flex:1">
            <input type="password" id="ideogramApiKey" placeholder="sk-… (leave blank to use server key)" autocomplete="new-password" style="width:100%;padding-right:52px"/>
            <button type="button" onclick="App.togglePwVis('ideogramApiKey',this)" style="position:absolute;right:8px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--muted);font-size:.8rem">Show</button>
          </div>
          <button class="btn btn-secondary btn-sm" onclick="App.testIdeogram()" id="btn-test-ideogram">Test</button>
        </div>
        <div id="ideogram-test-msg" style="font-size:.8rem;margin-top:6px"></div>
      </div>

    </div>

    <!-- ── Server Key Usage Widget ─────────────────────────────────────── -->
    <div id="usage-widget" style="margin-top:16px;padding:14px 16px;border:1px solid var(--border);border-radius:8px;background:#f8fafc;display:none">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <div style="font-weight:600;font-size:.88rem">Ideogram Usage — This Month</div>
        <span id="usage-key-badge" style="font-size:.75rem;padding:3px 9px;border-radius:12px;background:#f1f5f9;color:var(--muted)">—</span>
      </div>
      <div id="usage-meter-wrap" style="background:#e2e8f0;border-radius:6px;height:8px;margin-bottom:10px;overflow:hidden">
        <div id="usage-meter-bar" style="height:8px;border-radius:6px;background:var(--primary);width:0%;transition:width .4s"></div>
      </div>
      <div style="display:flex;gap:24px;flex-wrap:wrap">
        <div style="font-size:.82rem">
          <span style="color:var(--muted)">Images generated:</span>
          <strong id="usage-count">—</strong> / <span id="usage-limit">—</span>
        </div>
        <div style="font-size:.82rem">
          <span style="color:var(--muted)">Est. cost this month:</span>
          <strong id="usage-cost">—</strong>
        </div>
        <div style="font-size:.82rem">
          <span style="color:var(--muted)">All time:</span>
          <strong id="usage-alltime">—</strong>
        </div>
      </div>
      <div id="usage-limit-warn" style="font-size:.8rem;color:#b45309;margin-top:8px;display:none">
        ⚠️ Monthly limit reached. Add a project API key to continue generating images.
      </div>
    </div>

    <div style="font-size:.85rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:28px 0 12px">Google Search Console</div>
    <div style="border:1px solid var(--border);border-radius:8px;overflow:hidden">
      <!-- Header -->
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px;padding:14px 16px;border-bottom:1px solid var(--border)">
        <div>
          <div style="font-weight:600;font-size:.9rem">GSC Connection</div>
          <div style="font-size:.78rem;color:var(--muted);margin-top:2px">Connect Google Search Console to submit sitemaps, track indexing and monitor keyword rankings</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          <span id="s1-gsc-status" style="font-size:.75rem;padding:3px 10px;border-radius:12px;background:#f1f5f9;color:var(--muted)">Not connected</span>
          <a href="https://search.google.com/search-console/" target="_blank" class="btn btn-sm btn-secondary">Open Console ↗</a>
        </div>
      </div>
      <!-- Connect / Disconnect UI -->
      <div id="it-connect-panel" style="padding:0 16px 16px">
        <div id="it-connect-needed" class="hidden" style="padding-top:14px">
          <!-- Subdomain warning -->
          <div style="margin-bottom:14px;padding:10px 12px;background:#fff8e1;border:1px solid #f59e0b;border-radius:6px;font-size:.82rem;color:#78350f">
            <strong style="color:#92400e">⚠ Subdomain must be added as a separate GSC property first</strong><br>
            <code id="sc-domain-hint" style="font-weight:700">local.inboxingproweb.com</code> is a subdomain — Google treats it as a completely separate property from the root domain. You must add and verify this subdomain independently before you can submit a sitemap or grant access.
            <div style="margin-top:8px">
              <a id="sc-add-property-link" href="https://search.google.com/search-console/welcome" target="_blank" class="btn btn-sm btn-secondary" style="font-size:.82rem">Open GSC → Add Property ↗</a>
            </div>
          </div>
          <!-- Steps -->
          <div style="margin-bottom:14px">
            <div class="sc-status-row"><div class="sc-step-num">1</div><div class="sc-step-text"><strong>Add the subdomain property</strong> in GSC — click "Open GSC → Add Property" above, choose <em>URL prefix</em>, enter <code id="sc-property-url" style="font-size:.85em;background:#f1f5f9;padding:1px 5px;border-radius:4px">https://local.inboxingproweb.com/</code></div></div>
            <div class="sc-status-row"><div class="sc-step-num">2</div><div class="sc-step-text"><strong>Verify ownership</strong> — Google will offer several methods. The easiest is the HTML file upload or adding a DNS TXT record via your hosting provider</div></div>
            <div class="sc-status-row"><div class="sc-step-num">3</div><div class="sc-step-text"><strong>Grant access to your account</strong> — in GSC Settings → Users and permissions → <strong>Add user</strong>, add <span id="sc-gsc-email" style="font-family:monospace;font-weight:600">—</span> with <em>Full</em> permission</div></div>
            <div class="sc-status-row"><div class="sc-step-num">4</div><div class="sc-step-text">Click <strong>Check Access</strong> below — verifies the sitemap URL is publicly reachable, then click <strong>Connect Google Account</strong> to link your account</div></div>
          </div>
          <!-- One-time OAuth setup (only shown if client ID/secret not yet configured) -->
          <div id="it-connect-setup-needed" class="hidden" style="font-size:.82rem;margin-bottom:10px;padding:10px;background:#fff3cd;border-radius:6px;border:1px solid #ffc107">
            <strong>One-time setup required first:</strong><br>
            In <a href="https://console.cloud.google.com/apis/credentials" target="_blank" style="color:inherit">Google Cloud Console → Credentials</a>, create an OAuth 2.0 Client ID (Web application). Add this as an Authorised redirect URI:<br>
            <code id="it-callback-url" style="font-size:.8rem;word-break:break-all;display:block;margin:6px 0;padding:4px;background:#f8f9fa;border-radius:4px"></code>
            Then save the Client ID and Client Secret as secrets named <code>GSC_OAUTH_CLIENT_ID</code> and <code>GSC_OAUTH_CLIENT_SECRET</code>.
          </div>
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
            <button class="btn btn-secondary btn-sm" id="btn-check-access" onclick="App.checkAccess()">Check Access</button>
            <a id="btn-gsc-connect" href="/api/gsc/auth/start" target="_top" class="btn btn-primary btn-sm" style="text-decoration:none;display:inline-block">Connect Google Account</a>
            <span id="sc-access-badge" class="sc-status-badge sc-status-not-connected">not connected</span>
          </div>
          <div id="sc-check-result" class="alert hidden" style="margin-top:8px"></div>
        </div>
        <div id="it-connect-ok" class="hidden" style="padding-top:14px">
          <span style="color:var(--success);font-weight:600">✓ Connected to Google Search Console</span>
          <span id="it-connect-method" style="font-size:.8rem;color:var(--muted);margin-left:8px"></span>
          <button class="btn btn-secondary" onclick="App.gscDisconnect()" style="margin-left:12px;font-size:.8rem;padding:4px 10px">Disconnect</button>
        </div>
      </div>
    </div>

    <!-- ── Profile Review Summary ──────────────────────────────────────── -->
    <div style="margin-top:28px;padding:16px 18px;background:#f8fafc;border:1px solid var(--border);border-radius:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
        <div style="font-weight:700;font-size:.9rem">Profile Status</div>
        <span id="s1-profile-score-badge" style="font-size:.8rem;font-weight:700;padding:3px 12px;border-radius:12px;background:#e2e8f0;color:var(--muted)">—</span>
      </div>
      <div id="s1-profile-review-items" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:4px 20px;font-size:.8rem;margin-bottom:10px"></div>
      <div id="s1-profile-review-warn" style="display:none;margin-top:8px;padding:8px 12px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:.81rem;color:#713f12">
        ⚠ Complete all required fields above then save before generating pages.
      </div>
      <div id="s1-profile-review-ok" style="display:none;margin-top:8px;padding:8px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:6px;font-size:.81rem;color:#166534">
        ✓ All required setup complete — you can now generate pages.
      </div>
    </div>

    <div style="margin-top:20px;display:flex;align-items:center;gap:12px;padding-top:16px;border-top:1px solid var(--border)">
      <button class="btn btn-primary" onclick="App.saveProjectOnly()" id="btn-save-project">💾 Save Project</button>
      <span id="stage1-save-msg" style="font-size:.85rem;color:var(--success);font-weight:500"></span>
    </div>
    <div id="stage1-error" class="alert alert-error mt-3 hidden"></div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 2 — Campaign Setup -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-2" class="stage">

  <!-- ── Campaign Hub ───────────────────────────────────────────── -->
  <div class="card" id="campaign-hub" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
      <div>
        <div class="card-title" style="margin-bottom:2px">Campaigns</div>
        <div class="card-sub">Pick an existing campaign to resume, or start a new one.</div>
      </div>
      <a href="#campaign-config-anchor" class="btn btn-primary btn-sm" id="btn-new-campaign" onclick="App.newCampaign(event)">+ New Campaign</a>
    </div>

    <div id="campaign-list" style="display:grid;gap:8px;margin-bottom:4px">
      <div style="color:var(--muted);font-size:.85rem;padding:8px 0">Loading campaigns…</div>
    </div>

    <!-- Quick actions shown once a campaign is active -->
    <div id="campaign-quick-actions" style="display:none;border-top:1px solid var(--border);padding-top:12px;margin-top:8px">
      <div style="font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:8px">Quick Actions</div>
      <div class="flex gap-2 flex-wrap">
        <button class="btn btn-secondary btn-sm" onclick="App.quickJump(5)">⚡ Run Rollout</button>
        <button class="btn btn-secondary btn-sm" onclick="App.quickJump(6)">✓ QA Check</button>
        <button class="btn btn-secondary btn-sm" onclick="App.quickJump(7)">📋 Review Output</button>
        <button class="btn btn-primary btn-sm" onclick="App.quickJump(8)">📊 Rankings &amp; Indexing</button>
        <button class="btn btn-accent btn-sm" id="btn-deploy-all-quick" onclick="App.deployAllPages('quick')">🚀 Deploy All Pages</button>
      </div>
    </div>
  </div>

  <!-- ── Campaign Config form ───────────────────────────────────── -->
  <a id="campaign-config-anchor" style="display:block;height:0;visibility:hidden"></a>
  <div class="card" id="campaign-config-card">
    <!-- hint shown when user clicks + New Campaign -->
    <div id="new-campaign-hint" style="display:none;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px;padding:10px 14px;margin-bottom:14px;font-size:.85rem;color:#1d4ed8">
      ✦ Fill in the fields below and click <strong>Next →</strong> to create your new campaign.
    </div>
    <div class="card-title">Campaign Setup</div>
    <div class="card-sub">Define the city, service and area count for this generation campaign.</div>
    <div class="form-grid">
      <div class="field" id="f-cityName">
        <label>City *</label>
        <select id="cityName">
          <option value="">— Loading cities… —</option>
        </select>
        <span class="field-hint">Cities are derived from available area data files.</span>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-serviceName">
        <label>Service name *</label>
        <input type="text" id="serviceName" placeholder="Web Design"/>
        <span class="field-error">Required</span>
      </div>
      <div class="field" id="f-serviceKey">
        <label>Service key *</label>
        <input type="text" id="serviceKey" placeholder="web_design"/>
        <span class="field-hint">Lowercase, underscores. E.g. <code>web_design</code></span>
        <span class="field-error">Required</span>
      </div>
      <div class="field">
        <label>Hub page URL</label>
        <input type="text" id="hubUrl" placeholder="auto-derived from domain"/>
        <span class="field-hint">Leave blank to auto-derive from domain/</span>
      </div>
      <div class="field">
        <label>Money page URL</label>
        <input type="text" id="moneyPageUrl" placeholder="https://inboxingproweb.com/web-design/"/>
        <span class="field-hint">The main commercial page this hub should link to (your "money page").</span>
      </div>
      <div class="field">
        <label>Focus keyword</label>
        <input type="text" id="focusKeyword" placeholder="web design Sheffield"/>
        <span class="field-hint">The anchor text used when linking to the money page from the hub.</span>
      </div>
    </div>
    <div class="form-grid cols-1 mt-3">
      <div class="field">
        <label>Max priority areas: <strong id="maxP-val">5</strong></label>
        <input type="range" id="maxPriorityAreas" min="1" max="15" value="5" oninput="document.getElementById('maxP-val').textContent=this.value"/>
        <span class="field-hint">Areas assigned to Stage 1 of the rollout (generated first).</span>
      </div>
      <div class="field">
        <label>Max secondary areas: <strong id="maxS-val">4</strong></label>
        <input type="range" id="maxSecondaryAreas" min="0" max="15" value="4" oninput="document.getElementById('maxS-val').textContent=this.value"/>
      </div>
      <div class="field">
        <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.9rem;text-transform:none;letter-spacing:0">
          <input type="checkbox" id="includeSecondary" style="width:16px;height:16px"/>
          Include secondary areas in this rollout run
        </label>
        <span class="field-hint">If unchecked, secondary areas will be written to the deferred queue.</span>
      </div>
    </div>
    <div id="stage2-error" class="alert alert-error mt-3 hidden"></div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 3 — Area Opportunity -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-3" class="stage">
  <div id="engine-loading" class="alert alert-info">Loading area intelligence engine…</div>
  <div id="engine-loaded" class="hidden">
    <div class="engine-summary" id="engine-summary"></div>
    <div class="card">
      <div class="card-title">Ranked Areas</div>
      <div class="card-sub">Select which areas to include in this campaign. Priority areas are pre-selected.</div>
      <div class="area-controls">
        <button class="btn btn-secondary btn-sm" onclick="App.selectAllPriority()">Select all priority</button>
        <button class="btn btn-secondary btn-sm" onclick="App.clearAllAreas()">Clear all</button>
        <span id="selection-count" class="text-muted text-sm"></span>
      </div>
      <div class="table-wrap">
        <table id="area-table">
          <thead>
            <tr>
              <th>Rank</th>
              <th>Area</th>
              <th>Score</th>
              <th>Tier</th>
              <th>Postcode</th>
              <th>Demand</th>
              <th>Competition</th>
              <th>Affluence</th>
              <th style="width:40px">✓</th>
            </tr>
          </thead>
          <tbody id="area-tbody"></tbody>
        </table>
      </div>
      <div id="stage3-error" class="alert alert-error mt-3 hidden"></div>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 4 — Keyword Configuration -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-4" class="stage">
  <div class="card">
    <div class="card-title">Keyword Configuration</div>
    <div class="card-sub">Review and optionally edit focus keywords and supporting keywords for each selected area. Defaults are pre-filled deterministically — no AI call is made here.</div>
    <div id="kw-cards"></div>
    <div id="stage4-error" class="alert alert-error mt-3 hidden"></div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 5 — Generation -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-5" class="stage">

  <!-- ── Hub Page Card ──────────────────────────────────────────────── -->
  <div id="hub-page-section" class="card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:10px">
      <div>
        <div class="card-title" style="margin:0">Hub Page</div>
        <div class="card-sub">The central authority page for this service + city combination.</div>
      </div>
      <span id="hub-status-badge" style="font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:12px;background:#f1f5f9;color:var(--muted)">Not created</span>
    </div>

    <div id="hub-details" style="display:none;background:#f8fafc;border:1px solid var(--border);border-radius:6px;padding:10px 14px;margin-bottom:12px">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:10px;font-size:.84rem">
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:2px">Service</div><strong id="hub-detail-service">—</strong></div>
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:2px">Primary Location</div><strong id="hub-detail-city">—</strong></div>
        <div><div style="font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:2px">Target Keyword</div><strong id="hub-detail-keyword">—</strong></div>
      </div>
    </div>

    <p id="hub-page-status" style="font-size:.88rem;color:var(--muted);margin:0 0 12px">
      Load a campaign to create a hub page.
    </p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
      <button class="btn btn-secondary" id="btn-create-hub" onclick="App.createHubPage()">✦ Create Hub Page</button>
    </div>
    <div id="hub-page-result" class="alert hidden" style="margin-top:10px"></div>
  </div>

  <!-- ── Image Setup Card ───────────────────────────────────────────── -->
  <div class="card" style="margin-bottom:16px">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px;margin-bottom:4px">
      <div class="card-title" style="margin:0">Page Images</div>
      <div id="stage5-imagemode-badge" style="font-size:.78rem;padding:3px 10px;border-radius:12px;background:#f1f5f9;color:var(--muted)">Image mode: not set</div>
    </div>
    <div class="card-sub" id="stage5-imagemode-desc">Configure images for your pages. Go to Stage 1 → Image Mode to set your preference.</div>

    <div id="stage5-gating-warn" style="display:none;padding:10px 14px;background:#fef9c3;border:1px solid #fde047;border-radius:6px;font-size:.83rem;color:#713f12;margin:12px 0">
      ⚠️ <strong>Profile incomplete</strong> — <span id="stage5-gating-msg">Some required setup is missing.</span>
      <button class="btn btn-secondary btn-sm" style="margin-left:8px" onclick="showStage(1);App.onStageEnter(1)">Go to Stage 1 →</button>
    </div>

    <div class="img-gen-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:16px;margin:16px 0">
      ${["hero","support","trust","conversion"].map(slot => `
      <div class="img-gen-slot" id="img-slot-${slot}" style="border:1px solid var(--border);border-radius:8px;padding:12px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:.78rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">${slot.charAt(0).toUpperCase()+slot.slice(1)} Image</div>
          <span id="img-approval-badge-${slot}" style="font-size:.7rem;padding:2px 7px;border-radius:10px;background:#f1f5f9;color:var(--muted)">Empty</span>
        </div>
        <div id="img-src-debug-${slot}" style="font-size:.62rem;font-family:monospace;color:#64748b;word-break:break-all;background:#f0f9ff;border:1px solid #bae6fd;border-radius:4px;padding:3px 6px;margin-bottom:4px;display:none"></div>
        <div class="img-gen-preview" id="img-preview-wrap-${slot}" style="background:#f1f5f9;border:1px solid var(--border);border-radius:6px;aspect-ratio:16/9;display:flex;align-items:center;justify-content:center;margin-bottom:8px;overflow:hidden;position:relative">
          <span id="img-preview-label-${slot}" style="font-size:.8rem;color:var(--muted);position:relative;z-index:1">No image</span>
        </div>
        <div id="img-open-link-wrap-${slot}" style="text-align:center;margin-top:-4px;margin-bottom:6px;display:none">
          <a id="img-open-link-${slot}" href="#" target="_blank" rel="noopener" style="font-size:.72rem;color:#0369a1;text-decoration:underline">Open preview ↗</a>
        </div>
        <details style="margin-bottom:8px">
          <summary style="font-size:.78rem;color:var(--muted);cursor:pointer">Custom AI prompt</summary>
          <textarea id="img-prompt-${slot}" rows="2" style="width:100%;box-sizing:border-box;margin-top:6px;font-size:.78rem;border:1px solid var(--border);border-radius:4px;padding:6px;resize:vertical" placeholder="Leave blank to use auto-generated prompt based on your profile…"></textarea>
        </details>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:5px;margin-bottom:6px">
          <button class="btn btn-secondary btn-sm" style="justify-content:center;font-size:.75rem" id="img-btn-${slot}" onclick="App.generateImage('${slot}')">🤖 Generate</button>
          <label class="btn btn-secondary btn-sm" style="justify-content:center;cursor:pointer;font-size:.75rem">
            📁 Upload
            <input type="file" accept="image/*" style="display:none" onchange="App.uploadImage('${slot}',this)"/>
          </label>
          <button class="btn btn-secondary btn-sm" style="justify-content:center;font-size:.75rem" onclick="App.toggleImageLibrary('${slot}')">📚 Library</button>
        </div>

        <!-- ── Image Library panel ── -->
        <div id="img-lib-${slot}" style="display:none;margin-bottom:8px;border:1px solid var(--border);border-radius:6px;padding:8px;background:#fafbfc">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:6px">
            <span style="font-size:.73rem;font-weight:700;color:var(--text)">📚 Image Library</span>
            <button onclick="App.toggleImageLibrary('${slot}')" style="background:none;border:none;cursor:pointer;color:var(--muted);font-size:.85rem;padding:0 2px;line-height:1">×</button>
          </div>
          <div id="img-lib-filter-${slot}" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:6px">
            <button class="lib-filter-btn active" data-filter="all" onclick="App.filterLibrary('${slot}','all',this)">All</button>
            <button class="lib-filter-btn" data-filter="uploaded" onclick="App.filterLibrary('${slot}','uploaded',this)">Uploaded</button>
            <button class="lib-filter-btn" data-filter="ai_generated" onclick="App.filterLibrary('${slot}','ai_generated',this)">AI</button>
            <button class="lib-filter-btn" data-filter="approved" onclick="App.filterLibrary('${slot}','approved',this)">Approved</button>
          </div>
          <div id="img-lib-grid-${slot}" style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px">
            <div style="grid-column:1/-1;color:var(--muted);font-size:.78rem;text-align:center;padding:8px">Loading…</div>
          </div>
        </div>

        <div id="img-approval-row-${slot}" style="display:none;grid-template-columns:1fr 1fr;gap:6px">
          <button class="btn btn-sm" style="background:#dcfce7;color:#166534;border:1px solid #86efac;justify-content:center" onclick="App.approveImage('${slot}','approved')">✓ Approve</button>
          <button class="btn btn-sm" style="background:#fee2e2;color:#991b1b;border:1px solid #fca5a5;justify-content:center" onclick="App.approveImage('${slot}','rejected')">✗ Reject</button>
        </div>
        <div id="img-status-${slot}" style="font-size:.75rem;color:var(--muted);text-align:center;margin-top:4px;min-height:16px"></div>
        <div id="img-diag-${slot}" style="margin-top:6px;padding:5px 6px;background:#fafafa;border:1px solid #e5e7eb;border-radius:4px;font-size:.68rem;font-family:monospace;color:#64748b;line-height:1.5;display:none"></div>
      </div>`).join("")}
    </div>

    <div class="flex gap-2" style="align-items:center;flex-wrap:wrap;margin-bottom:10px">
      <button class="btn btn-primary" id="btn-save-images" onclick="App.saveImageSelection()" style="background:#0369a1;border-color:#0369a1">
        💾 Save Image Selection
      </button>
      <span id="img-save-status" style="font-size:.82rem;color:var(--muted)"></span>
    </div>

    <!-- Slot diagnostics (auto-refreshes on save/upload/refresh) -->
    <div style="margin-bottom:14px;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:#f8fafc;border-bottom:1px solid #e5e7eb">
        <span style="font-size:.72rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.04em">Image Assignment Status</span>
        <button class="btn btn-secondary btn-sm" onclick="App.loadImageStatuses()" style="font-size:.72rem;padding:2px 8px">↻ Refresh</button>
      </div>
      <div id="img-diagnostics" style="padding:8px 10px;font-size:.75rem;color:var(--muted)">Loading…</div>
    </div>

    <div class="flex gap-2" style="align-items:center;flex-wrap:wrap">
      <button class="btn btn-primary" id="btn-generate-all" onclick="App.generateAllImages()">⚡ Generate All AI Images</button>
      <button class="btn btn-secondary" onclick="App.loadImageStatuses()">↻ Refresh Status</button>
      <span id="img-all-status" style="font-size:.82rem;color:var(--muted)"></span>
    </div>
  </div>

  <!-- ── Cluster Pages Section ─────────────────────────────────────── -->
  <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px">
    <div style="font-size:.82rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted)">Cluster Pages</div>
    <div style="flex:1;height:1px;background:var(--border)"></div>
    <span style="font-size:.78rem;padding:2px 9px;border-radius:10px;background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;font-weight:600">Hyper-local area pages</span>
  </div>

  <div id="stage5-hub-warn" class="alert alert-warn hidden" style="margin-bottom:12px">
    ⚠️ <strong>No hub page created yet.</strong> It's recommended to create the Hub Page first — cluster pages link back to it. You can still run clusters without it.
  </div>

  <div id="stage5-confirm" class="alert alert-warn" style="margin-bottom:16px">
    <strong>Review before running.</strong> Confirm the rollout order and mode below, then click <strong>Generate Pages</strong>.
  </div>
  <div class="rollout-split">
    <div>
      <div class="rollout-list" id="rollout-order-list">
        <div class="rollout-list-header">Rollout Order</div>
        <div class="rollout-list-body" id="rollout-order-body"></div>
      </div>
    </div>
    <div>
      <div class="card" style="margin-bottom:12px">
        <div id="gen-campaign-preview" style="display:none;margin-bottom:12px;padding:10px 12px;background:#f0fdf4;border:1px solid #86efac;border-radius:8px;font-size:.82rem">
          <div style="font-weight:700;color:#166534;margin-bottom:4px" id="gen-campaign-city">Campaign: —</div>
          <div style="color:#15803d;line-height:1.5" id="gen-campaign-areas">Areas: —</div>
        </div>
        <div class="field">
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;font-size:.9rem;text-transform:none;letter-spacing:0">
            <input type="checkbox" id="run-include-secondary" style="width:16px;height:16px"/>
            Include secondary areas in this run
          </label>
        </div>
        <div class="field" style="margin-top:10px">
          <label style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);display:block;margin-bottom:6px">Pages at once</label>
          <div style="display:flex;gap:6px">
            <label style="flex:1;text-align:center;cursor:pointer">
              <input type="radio" name="run-concurrency" value="1" checked style="display:none"/>
              <span id="conc-btn-1" style="display:block;padding:5px 0;border:1px solid #d1d5db;border-radius:5px;font-size:.85rem;font-weight:600;background:#f9fafb;transition:all .15s" onclick="App.setConcurrency(1)">1 — Safe</span>
            </label>
            <label style="flex:1;text-align:center;cursor:pointer">
              <input type="radio" name="run-concurrency" value="2" style="display:none"/>
              <span id="conc-btn-2" style="display:block;padding:5px 0;border:1px solid #d1d5db;border-radius:5px;font-size:.85rem;font-weight:600;background:#f9fafb;transition:all .15s" onclick="App.setConcurrency(2)">2 — Fast</span>
            </label>
            <label style="flex:1;text-align:center;cursor:pointer">
              <input type="radio" name="run-concurrency" value="3" style="display:none"/>
              <span id="conc-btn-3" style="display:block;padding:5px 0;border:1px solid #d1d5db;border-radius:5px;font-size:.85rem;font-weight:600;background:#f9fafb;transition:all .15s" onclick="App.setConcurrency(3)">3 — Turbo</span>
            </label>
          </div>
        </div>
        <button class="btn btn-primary mt-3" id="run-rollout-btn" onclick="App.startRollout()" style="width:100%;justify-content:center">
          Generate Pages →
        </button>
      </div>
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
          <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted)">Progress</div>
          <div style="display:flex;align-items:center;gap:8px">
            <div id="rollout-status-badge" style="display:none;align-items:center;gap:6px;font-size:.8rem;font-weight:600">
              <span id="rollout-spinner" style="display:inline-block;width:10px;height:10px;border:2px solid #bfdbfe;border-top-color:#3b82f6;border-radius:50%;animation:spin .8s linear infinite"></span>
              <span id="rollout-status-text">Running…</span>
            </div>
            <button id="rollout-cancel-btn" onclick="App.cancelRollout()" title="Cancel the current generation job" style="display:none;font-size:.8rem;padding:4px 12px;border:1px solid #dc2626;background:#dc2626;color:#fff;border-radius:5px;cursor:pointer;font-weight:700">✕ Cancel Job</button>
            <button id="rollout-unlock-btn" onclick="App.unlockWizard()" title="Force-unlock if the wizard is stuck" style="display:none;font-size:.72rem;padding:2px 8px;border:1px solid #ef4444;background:#fff;color:#ef4444;border-radius:4px;cursor:pointer">🔓 Unlock</button>
          </div>
        </div>
        <div id="rollout-progress-wrap" style="display:none;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:4px">
            <div style="flex:1;background:#e2e8f0;border-radius:99px;height:10px;overflow:hidden">
              <div id="rollout-progress-bar" style="height:100%;background:var(--primary);border-radius:99px;width:0%;transition:width .4s ease"></div>
            </div>
            <span id="rollout-progress-count" style="font-size:.82rem;font-weight:700;min-width:52px;text-align:right;color:var(--text)">0 / 0</span>
          </div>
          <div id="rollout-current-page" style="font-size:.75rem;color:var(--muted);font-family:monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;height:1.2em"></div>
        </div>
        <div class="progress-log" id="progress-log"><span class="log-line-dim">Waiting for rollout to start…</span></div>
        <div id="rollout-start-again" style="display:none;margin-top:10px;padding:10px 14px;background:#f0fdf4;border:1px solid #86efac;border-radius:7px;display:flex;align-items:center;justify-content:space-between;gap:12px">
          <span id="rollout-start-again-msg" style="font-size:.85rem;color:#166534;font-weight:600"></span>
          <button onclick="App.startFreshRun()" style="font-size:.85rem;padding:6px 16px;background:#16a34a;color:#fff;border:none;border-radius:5px;cursor:pointer;font-weight:700;white-space:nowrap">↺ Start Fresh Run</button>
        </div>
      </div>
    </div>
  </div>
  <!-- ── Full Campaign ─────────────────────────────────────────────── -->
  <div class="card mt-3" style="border:2px solid var(--primary)">
    <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">
      <div>
        <div class="card-title" style="margin:0">Full Campaign</div>
        <div class="card-sub">Generate Hub Page + all Cluster Pages together in one operation.</div>
      </div>
      <button class="btn btn-primary" id="btn-full-campaign" onclick="App.createFullCampaign()">⚡ Generate Full Campaign</button>
    </div>
    <div id="full-campaign-result" class="alert hidden" style="margin-top:10px"></div>
  </div>

  <div id="stage5-error" class="alert alert-error mt-3 hidden"></div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 6 — Validation -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-6" class="stage">
  <div class="card">
    <div class="card-title">Validation &amp; QA</div>
    <div class="card-sub">Run quality checks and content scoring against all generated pages.</div>
    <button class="btn btn-accent" id="run-validate-btn" onclick="App.runValidation()">Run Validation</button>
    <div id="val-loading" style="display:none;margin-top:12px;padding:12px 16px;background:#eff6ff;border:1px solid #bfdbfe;border-radius:6px">
      <div style="display:flex;align-items:center;gap:10px">
        <span style="display:inline-block;width:16px;height:16px;border:2px solid #bfdbfe;border-top-color:#3b82f6;border-radius:50%;animation:spin .8s linear infinite;flex-shrink:0"></span>
        <span style="color:#1d4ed8;font-size:.9rem">Running validation checks…</span>
      </div>
    </div>
    <div id="val-results" class="hidden mt-3">
      <div id="val-summary-cards" class="engine-summary" style="margin-bottom:20px"></div>
      <div class="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Area</th>
              <th style="min-width:100px">Type</th>
              <th>Score</th>
              <th>Readiness</th>
              <th>Issues</th>
              <th style="min-width:160px"></th>
            </tr>
          </thead>
          <tbody id="val-tbody"></tbody>
        </table>
      </div>

      <!-- Rerun progress panel — shown while rerun is active -->
      <div id="rerun-panel" style="display:none;margin-top:20px;padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px">
        <div style="font-weight:600;margin-bottom:8px;color:#1e293b" id="rerun-panel-title">Regenerating pages…</div>
        <div style="background:#e2e8f0;border-radius:6px;height:10px;overflow:hidden;margin-bottom:8px">
          <div id="rerun-progress-bar" style="height:100%;background:var(--accent);border-radius:6px;width:0%;transition:width 0.4s ease"></div>
        </div>
        <div style="font-size:.83rem;color:#64748b" id="rerun-panel-status">Starting…</div>
      </div>

      <!-- Rerun actions — shown after validation when there are issues -->
      <div id="rerun-actions" style="display:none;margin-top:16px;padding:14px 16px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;display:none">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
          <div style="font-size:.9rem;color:#92400e">
            <strong id="rerun-actions-count"></strong> — regenerate to fix QA issues
          </div>
          <button class="btn btn-secondary" id="rerun-all-btn" onclick="App.rerunAllIssues()">Rerun All Pages with Issues</button>
        </div>
      </div>
    </div>
    <div id="stage6-continue" class="mt-3" style="text-align:right">
      <button class="btn btn-primary" onclick="showStage(7);App.onStageEnter(7)">Continue to Results →</button>
    </div>
    <div id="stage6-error" class="alert alert-error mt-3 hidden"></div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 7 — Output -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-7" class="stage">
  <div class="card">
    <div class="card-title">Campaign Complete</div>
    <div class="card-sub">Your pages have been generated. Here's a summary of everything produced.</div>

    <div class="output-grid">
      <div>
        <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:12px">Generated Files</div>
        <div id="output-files" class="file-list"></div>
      </div>
      <div>
        <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:12px">Rollout Log</div>
        <div id="output-log" class="card" style="font-size:.8rem;background:#f8fafc"></div>
        <div style="font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin:16px 0 12px">Deferred Queue</div>
        <div id="output-deferred" class="text-muted text-sm">None</div>
      </div>
    </div>

    <div style="margin-top:24px;font-size:.8rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:12px">Next Actions</div>
    <div class="flex gap-2 flex-wrap">
      <button class="btn btn-primary" onclick="showStage(8);App.onStageEnter(8)">📊 Rankings &amp; Indexing →</button>
      <button class="btn btn-secondary" onclick="App.newCampaign()">+ New Campaign</button>
      <button class="btn btn-secondary" onclick="App.runDeferred()">Run Deferred Areas</button>
      <button class="btn btn-secondary" id="reupload-btn" onclick="App.reuploadPages()">Re-upload to FTP</button>
      <button class="btn btn-secondary" onclick="window.location='/api/preview'">View Generated Pages</button>
      <button class="btn btn-ghost" onclick="App.resetWizard()">Start over</button>
    </div>
  </div>
</div>

<!-- ════════════════════════════════════════════════ -->
<!-- STAGE 8 — Indexing Setup                        -->
<!-- ════════════════════════════════════════════════ -->
<div id="stage-8" class="stage">

  <!-- Run All banner -->
  <div class="flex gap-2 flex-wrap" style="margin-bottom:16px;align-items:center;background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:12px 16px">
    <div style="flex:1;min-width:200px">
      <div style="font-weight:700;font-size:.9rem">Rankings &amp; Indexing</div>
      <div style="font-size:.8rem;color:var(--muted)">Run both checks at once or use the individual panels below.</div>
    </div>
    <button class="btn btn-primary" onclick="App.runAllChecks()">⚡ Run All Checks</button>
    <span id="run-all-label" class="text-muted text-sm" style="font-size:.82rem;display:none">Running all checks…</span>
  </div>

  <!-- Regenerate & Deploy All Pages card (primary action) -->
  <div class="card" style="margin-bottom:16px;border-color:#2563eb">
    <div class="card-title">⚡ Regenerate &amp; Deploy All Pages</div>
    <div class="card-sub">Rebuild every page with the latest template and push to your live site in one step. Use this to fix content issues or apply template updates across the whole campaign.</div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-primary" id="btn-regen-deploy" onclick="App.regenerateAndDeployAllPages()">⚡ Regenerate &amp; Deploy All Pages</button>
      <span id="regen-deploy-status" style="font-size:.82rem;color:var(--muted)"></span>
    </div>
    <div id="regen-deploy-log" style="display:none;margin-top:12px;background:#0f172a;border:1px solid #1e293b;border-radius:6px;padding:10px 12px;max-height:200px;overflow-y:auto;font-family:monospace;font-size:.75rem;line-height:1.6"></div>
    <div id="regen-deploy-result" class="alert hidden" style="margin-top:10px"></div>
  </div>

  <!-- Deploy Only card (secondary — FTP upload without regeneration) -->
  <div class="card" style="margin-bottom:16px">
    <div class="card-title">Deploy Only (FTP Upload)</div>
    <div class="card-sub">Push already-generated pages to your live FTP server without rebuilding them. Use this if pages are already on disk and you just need to re-upload.</div>
    <div style="display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:12px">
      <button class="btn btn-accent" id="btn-deploy-all" onclick="App.deployAllPages()">🚀 Deploy Only</button>
      <span id="deploy-all-status" style="font-size:.82rem;color:var(--muted)"></span>
    </div>
    <div id="deploy-all-result" class="alert hidden" style="margin-top:10px"></div>
  </div>

  <div class="card">
    <div class="card-title">Indexing Setup</div>
    <div class="card-sub">Submit your sitemaps to Google Search Console so Google can crawl and index your pages.</div>

    <div class="indexing-url-box">
      <div class="indexing-url-label" style="display:flex;align-items:center;gap:8px">
        Campaign Sitemap
        <span style="font-size:.7rem;background:#ede9fe;color:#5b21b6;border-radius:4px;padding:1px 6px;font-weight:700">This campaign only</span>
      </div>
      <div class="indexing-url-row">
        <span id="sc-sitemap-url" class="indexing-url-text">—</span>
        <button class="btn btn-sm btn-secondary" onclick="App.copySitemapUrl(event)">Copy</button>
        <a id="sc-sitemap-link" href="#" target="_blank" class="btn btn-sm btn-secondary">Open ↗</a>
      </div>

      <div class="indexing-url-label" style="margin-top:12px;display:flex;align-items:center;gap:8px">
        Project Sitemap Index
        <span style="font-size:.7rem;background:#dcfce7;color:#166534;border-radius:4px;padding:1px 6px;font-weight:700">All campaigns</span>
      </div>
      <div class="indexing-url-row">
        <span id="sc-index-url" class="indexing-url-text">—</span>
        <button class="btn btn-sm btn-secondary" onclick="App.copyIndexUrl(event)">Copy</button>
        <a id="sc-index-link" href="#" target="_blank" class="btn btn-sm btn-secondary">Open ↗</a>
      </div>

      <div class="indexing-url-label" style="margin-top:12px">robots.txt URL</div>
      <div class="indexing-url-row">
        <span id="sc-robots-url" class="indexing-url-text">—</span>
        <a id="sc-robots-link" href="#" target="_blank" class="btn btn-sm btn-secondary">Open ↗</a>
      </div>
    </div>

    <div style="margin-top:14px;display:flex;align-items:center;gap:10px;flex-wrap:wrap">
      <button class="btn btn-secondary" id="btn-rebuild-sitemaps" onclick="App.rebuildSitemaps()">↻ Rebuild All Sitemaps</button>
      <span id="rebuild-status" style="font-size:.82rem;color:var(--muted)"></span>
    </div>
    <div id="rebuild-result" class="alert hidden" style="margin-top:8px"></div>

    <div style="margin-top:14px;padding:10px 12px;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px;font-size:.82rem;color:#166534">
      <strong>Submit the Project Sitemap Index</strong> to GSC — it references all campaign sitemaps in one go.<br>
      Use <em>Submit Sitemap</em> (below) for the active campaign, or <em>Submit Project Sitemap</em> for all campaigns at once.
    </div>
  </div>

  <div class="mode-toggle" style="margin-bottom:0;margin-top:-8px">
    <button class="mode-btn selected" id="sc-tab-a" onclick="App.switchScTab('a')">Submit Sitemaps</button>
    <button class="mode-btn" id="sc-tab-b" onclick="App.switchScTab('b')">Manual Setup</button>
  </div>

  <!-- Option A: Submit Sitemaps (GSC must be connected in Business Setup first) -->
  <div id="sc-panel-a" class="card" style="border-top-left-radius:0;border-top-right-radius:0;border-top:none;margin-top:0">
    <div class="card-title">Submit Sitemaps to Google</div>
    <div class="card-sub">Connect Google Search Console in <strong>Business Setup</strong> first, then submit your sitemaps here.</div>

    <div class="flex gap-2 flex-wrap" style="align-items:center;margin-bottom:12px;margin-top:4px">
      <button class="btn btn-primary" id="btn-submit-sitemap" onclick="App.submitSitemap()">Submit Campaign Sitemap</button>
      <button class="btn btn-accent" id="btn-submit-project-sitemap" onclick="App.submitProjectSitemap()" title="Submit the full project sitemap index (all campaigns)">Submit Project Sitemap</button>
      <a href="https://search.google.com/search-console/" target="_blank" class="btn btn-secondary">Open Search Console ↗</a>
      <span id="sc-submit-badge" class="sc-status-badge sc-status-submitted hidden">sitemap submitted</span>
      <span id="sc-project-submit-badge" class="sc-status-badge sc-status-submitted hidden">project sitemap submitted</span>
    </div>
    <div id="sc-submit-result" class="alert hidden"></div>
  </div>

  <!-- Option B: Manual Setup -->
  <div id="sc-panel-b" class="card hidden" style="border-top-left-radius:0;border-top-right-radius:0;border-top:none;margin-top:0">
    <div class="card-title">Manual Submission</div>
    <div class="card-sub">Follow these steps to submit the sitemap directly in Google Search Console.</div>
    <div id="sc-manual-steps"></div>
    <div class="flex gap-2" style="margin-top:16px;align-items:center">
      <button class="btn btn-secondary" onclick="App.copyManualInstructions()">Copy Instructions</button>
      <span id="sc-copy-confirm" class="hidden" style="font-size:.82rem;color:var(--success)">✓ Copied to clipboard</span>
    </div>
  </div>

  <!-- Index Tracking Dashboard -->
  <div class="card" style="margin-top:16px">
    <div class="card-title">Index Tracking</div>
    <div class="card-sub">Uses the Google Search Console URL Inspection API — gives a definitive, accurate answer for every URL.</div>

    <!-- GSC connection status (set up in Business Setup — Stage 1) -->
    <div id="it-gsc-status-bar" style="margin-bottom:12px;padding:8px 12px;background:#f8fafc;border:1px solid var(--border);border-radius:6px;font-size:.83rem;display:flex;align-items:center;gap:10px">
      <span id="it-gsc-status-text" style="color:var(--muted)">GSC not connected</span>
      <button class="btn btn-sm btn-secondary" onclick="App.quickJump(1)" style="font-size:.78rem;padding:3px 10px">Connect in Business Setup →</button>
    </div>

    <div id="it-run-info" class="it-run-info">No tracking data yet — click <strong>Run Check</strong> to start.</div>

    <div class="it-stats-row">
      <div class="it-stat-box">
        <div id="it-stat-indexed" class="it-stat-num indexed">—</div>
        <div class="it-stat-label">Indexed</div>
      </div>
      <div class="it-stat-box">
        <div id="it-stat-not-indexed" class="it-stat-num not-indexed">—</div>
        <div class="it-stat-label">Not Indexed</div>
      </div>
      <div class="it-stat-box">
        <div id="it-stat-unknown" class="it-stat-num unknown">—</div>
        <div class="it-stat-label">Unknown</div>
      </div>
      <div class="it-stat-box">
        <div id="it-stat-total" class="it-stat-num" style="color:var(--text)">—</div>
        <div class="it-stat-label">Total Pages</div>
      </div>
    </div>

    <div id="it-table-wrap" class="it-table-wrap hidden">
      <table class="it-table">
        <thead>
          <tr>
            <th>Page URL</th>
            <th>Status</th>
            <th>Last Checked</th>
            <th>First Indexed</th>
          </tr>
        </thead>
        <tbody id="it-table-body"></tbody>
      </table>
    </div>

    <div id="it-run-error" class="alert alert-error hidden" style="margin-top:12px"></div>

    <div class="flex gap-2 flex-wrap" style="margin-top:16px;align-items:center">
      <button class="btn btn-primary" id="btn-it-run" onclick="App.itRunCheck()">Run Check</button>
      <button class="btn btn-secondary" id="btn-it-refresh" onclick="App.itRefresh()">Refresh</button>
      <button class="btn btn-secondary" id="btn-it-copy-not-indexed" onclick="App.itCopyNotIndexed()">Copy Not Indexed URLs</button>
      <span id="it-running-label" class="hidden text-muted text-sm" style="font-size:.82rem">Running via Google Search Console API… checking all pages</span>
    </div>
  </div>

  <!-- Keyword Tracking Dashboard -->
  <div class="card" style="margin-top:16px">
    <div class="card-title">Keyword Rankings</div>
    <div class="card-sub">Track Google ranking positions for your target keywords. Checks the top 100 results for each keyword and records position over time.</div>

    <div id="kt-run-info" class="kt-run-info">No ranking data yet — click <strong>Run Check</strong> to start.</div>

    <div class="kt-stats-row">
      <div class="kt-stat-box">
        <div id="kt-stat-total" class="kt-stat-num">—</div>
        <div class="kt-stat-label">Keywords</div>
      </div>
      <div class="kt-stat-box">
        <div id="kt-stat-ranked" class="kt-stat-num kt-green">—</div>
        <div class="kt-stat-label">Ranked</div>
      </div>
      <div class="kt-stat-box">
        <div id="kt-stat-improved" class="kt-stat-num kt-green">—</div>
        <div class="kt-stat-label">Improved</div>
      </div>
      <div class="kt-stat-box">
        <div id="kt-stat-dropped" class="kt-stat-num kt-red">—</div>
        <div class="kt-stat-label">Dropped</div>
      </div>
      <div class="kt-stat-box">
        <div id="kt-stat-new" class="kt-stat-num kt-amber">—</div>
        <div class="kt-stat-label">New Rankings</div>
      </div>
    </div>

    <div id="kt-table-wrap" class="kt-table-wrap hidden">
      <table class="kt-table">
        <thead>
          <tr>
            <th>Keyword</th>
            <th>Position</th>
            <th>Change</th>
            <th>Target URL</th>
            <th>Last Checked</th>
          </tr>
        </thead>
        <tbody id="kt-table-body"></tbody>
      </table>
    </div>

    <div id="kt-run-error" class="alert alert-error hidden" style="margin-top:12px"></div>

    <div class="flex gap-2 flex-wrap" style="margin-top:16px;align-items:center">
      <button class="btn btn-primary" id="btn-kt-run" onclick="App.ktRunCheck()">Run Check</button>
      <button class="btn btn-secondary" id="btn-kt-refresh" onclick="App.ktRefresh()">Refresh</button>
      <button class="btn btn-secondary" id="btn-kt-copy" onclick="App.ktCopyKeywords()">Copy Keywords</button>
      <span id="kt-running-label" class="hidden" style="font-size:.82rem;color:var(--muted)">Running… ~3 s per keyword</span>
    </div>
  </div>
</div>

</main>

<!-- Footer navigation -->
<div class="footer-nav">
  <button class="btn btn-secondary" id="btn-back" onclick="App.prevStage()" disabled>← Back</button>
  <span id="nav-stage-label" class="text-muted text-sm"></span>
  <button class="btn btn-primary" id="btn-next" onclick="App.nextStage()">Next →</button>
</div>

</div><!-- .shell -->

<!-- ════════════════════════════════════════════════ -->
<!-- SOCIAL POSTS PANEL (full-screen overlay)        -->
<!-- ════════════════════════════════════════════════ -->
<div id="sp-panel">
  <div class="sp-inner">
    <div class="sp-header">
      <div class="sp-title">✍ Social Post Generator</div>
      <button onclick="SP.close()" class="btn btn-secondary">✕ Close</button>
    </div>
    <div class="sp-grid">
      <!-- LEFT: Form -->
      <div class="sp-form-card">
        <div class="sp-form-title">Post Details</div>

        <div class="sp-field">
          <label>Topic / Keyword</label>
          <input type="text" id="sp-topic" placeholder="e.g. emergency plumbing tips, winter boiler checks" />
        </div>

        <div class="sp-field">
          <label>Business Type</label>
          <input type="text" id="sp-biztype" placeholder="e.g. plumber, web designer, accountant" />
        </div>

        <div class="sp-field">
          <label>Location / Area</label>
          <input type="text" id="sp-location" placeholder="e.g. Sheffield, Rotherham" />
        </div>

        <div class="sp-field">
          <label>Post Objective</label>
          <select id="sp-objective">
            <option value="Educate">Educate</option>
            <option value="Promote service">Promote service</option>
            <option value="Generate enquiries" selected>Generate enquiries</option>
            <option value="Announce offer">Announce offer</option>
            <option value="Build trust">Build trust</option>
            <option value="Seasonal post">Seasonal post</option>
            <option value="Local awareness">Local awareness</option>
          </select>
        </div>

        <div class="sp-field">
          <label>Link Destination</label>
          <div class="sp-link-row">
            <label class="sp-link-opt"><input type="radio" name="sp-link-type" value="homepage" checked onchange="SP.onLinkTypeChange(this.value)"> Homepage</label>
            <label class="sp-link-opt"><input type="radio" name="sp-link-type" value="page" onchange="SP.onLinkTypeChange(this.value)"> Generated page</label>
            <label class="sp-link-opt"><input type="radio" name="sp-link-type" value="custom" onchange="SP.onLinkTypeChange(this.value)"> Custom URL</label>
          </div>
          <select id="sp-page-picker" style="display:none;margin-top:6px;width:100%;padding:8px 10px;border:1px solid var(--border);border-radius:6px;font-size:.88rem;color:var(--text);background:var(--card)"></select>
          <input type="url" id="sp-custom-url" placeholder="https://example.com/page" style="display:none;margin-top:6px" />
        </div>

        <div class="sp-field">
          <label>Platforms</label>
          <div class="sp-platforms">
            <label class="sp-platform-cb"><input type="checkbox" value="gbp" checked> 🗺 Google Business</label>
            <label class="sp-platform-cb"><input type="checkbox" value="facebook" checked> 📘 Facebook</label>
            <label class="sp-platform-cb"><input type="checkbox" value="instagram" checked> 📸 Instagram</label>
            <label class="sp-platform-cb"><input type="checkbox" value="linkedin"> 💼 LinkedIn</label>
          </div>
        </div>

        <div id="sp-gen-error" style="display:none;margin-bottom:10px;padding:8px 12px;background:#fef2f2;border:1px solid #fecaca;border-radius:6px;font-size:.82rem;color:#dc2626"></div>

        <button class="btn btn-accent" style="width:100%;justify-content:center" id="sp-gen-btn" onclick="SP.generate()">⚡ Generate Posts</button>
      </div>

      <!-- RIGHT: Output -->
      <div>
        <div id="sp-output-area">
          <div class="sp-empty" id="sp-empty-state">
            <div class="sp-empty-icon">✍</div>
            <div style="font-weight:600;margin-bottom:6px">No posts yet</div>
            <div>Fill in the form and click <strong>Generate Posts</strong> to create platform-specific social content.</div>
          </div>
          <div id="sp-loading" style="display:none;padding:40px;text-align:center;color:var(--muted)">
            <div style="display:inline-block;width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--brand);border-radius:50%;animation:spin .8s linear infinite;margin-bottom:12px"></div>
            <div style="font-size:.9rem">Generating posts…</div>
          </div>

          <div id="sp-results" style="display:none">
            <div class="sp-actions-bar">
              <button class="btn btn-secondary" onclick="SP.regenerateAll()">↻ Regenerate All</button>
              <button class="btn btn-primary" id="sp-save-btn" onclick="SP.save()">💾 Save Post Set</button>
              <span id="sp-save-msg" style="font-size:.82rem;color:var(--success);display:none">✓ Saved!</span>
            </div>
            <div class="sp-cards" id="sp-cards"></div>
          </div>
        </div>

        <!-- History -->
        <div class="sp-history" id="sp-history-wrap" style="display:none">
          <div class="sp-history-title">Saved Post Sets</div>
          <div id="sp-history-list"></div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
'use strict';

// Server-injected: the active slug (from URL param) or the first project slug
const SERVER_SETUP_SLUG = '${defaultSlug}';

// ═══════════════════════════════════════════════════════════════════
// State
// ═══════════════════════════════════════════════════════════════════

const STAGE_NAMES = [
  '', 'Business Setup', 'Campaign Setup', 'Area Opportunity',
  'Keyword Config', 'Generation', 'Validation', 'Output', 'Indexing'
];

const state = {
  stage: 1,
  isGenerating: false,
  activeJobId: null,  // tracks the currently running rollout job ID for cancellation
  project: null,
  campaign: null,
  campaignId: null,   // tracks the active campaign ID for session scoping
  engineOutput: null,
  selectedAreaDefs: [],
  keywordOverrides: {},
  kwSuggestions: {},  // area -> string[] — persists through re-renders
  rolloutLog: null,
  validation: null,
  navItems: [],
  footerLinks: [],
  footerServiceLinks: [],
  indexingStatus: null,
};

window.App = window.App || {};
const App = window.App;

// Always use origin-absolute URLs so the proxy never breaks relative paths
function apiFetch(path, opts) {
  const h = {};
  if (INTERNAL_TOKEN) {
    h['X-Internal-Token'] = INTERNAL_TOKEN;
    h['Authorization'] = 'Bearer ' + INTERNAL_TOKEN;
  }
  const merged = { cache: 'no-store', ...opts };
  merged.headers = Object.assign({}, h, opts?.headers || {});
  return fetch(window.location.origin + path, merged);
}

// ═══════════════════════════════════════════════════════════════════
// Initialisation
// ═══════════════════════════════════════════════════════════════════

App.init = async function() {
  // ── Step 1: Use server-injected project data immediately (synchronous, no fetch wait) ──
  if (window.__INITIAL_PROJECT__) {
    state.project = window.__INITIAL_PROJECT__;
    populateStage1Form(state.project);
    if (state.project.navItems) { state.navItems = state.project.navItems; renderNavItems(state.navItems); }
    if (state.project.footerLinks) { state.footerLinks = state.project.footerLinks; renderFooterLinks(state.footerLinks); }
    if (state.project.footerServiceLinks) { state.footerServiceLinks = state.project.footerServiceLinks; renderFooterServiceLinks(state.footerServiceLinks); }
  } else {
    renderNavItems([]);
    renderFooterLinks([]);
    renderFooterServiceLinks([]);
  }
  renderProgress();
  loadProjectList();

  // URL param auto-load: /api/setup?slug=rotherham-proof&stage=8[&campaign=ID]
  const urlParams   = new URLSearchParams(window.location.search);
  const urlSlug     = urlParams.get('slug');
  const urlStage    = Math.min(Math.max(parseInt(urlParams.get('stage') || '1', 10), 1), 8);
  const urlCampaign = urlParams.get('campaign');

  // Auto-redirect: if no slug in URL, use localStorage or server-injected default
  if (!urlSlug) {
    const savedSlug = localStorage.getItem('seo_wizard_slug') || SERVER_SETUP_SLUG;
    if (savedSlug) {
      window.location.replace('/api/setup?slug=' + encodeURIComponent(savedSlug));
      return;
    }
  }

  if (urlSlug) {
    try {
      localStorage.setItem('seo_wizard_slug', urlSlug);
      // ── Step 2: Refresh project data from API in background (updates form if changed) ──
      const pRes = await apiFetch(\`/api/projects/\${urlSlug}\`);
      if (pRes.ok) {
        const pd = await pRes.json();
        state.project = pd.project || state.project;
        if (state.project) populateStage1Form(state.project);
      }
      // If a specific campaign ID is requested, resume it (loads its session)
      if (urlCampaign) {
        state.campaignId = urlCampaign;
        const session = await loadSession(urlSlug, urlCampaign);
        if (session) {
          state.campaign         = session.campaign         || null;
          state.engineOutput     = session.engineOutput     || null;
          state.selectedAreaDefs = session.selectedAreaDefs || [];
          state.keywordOverrides = session.keywordOverrides || {};
          state.rolloutLog       = session.rolloutLog       || null;
          state.validation       = session.validation       || null;
        }
        // Seed campaign form data from campaign record if session had none
        if (!state.campaign?.cityName) {
          try {
            const cRes = await apiFetch('/api/campaigns/' + urlSlug);
            if (cRes.ok) {
              const cData = await cRes.json();
              const cRec = (cData.campaigns || []).find(x => x.id === urlCampaign);
              if (cRec) {
                state.campaign = Object.assign({
                  maxPriorityAreas: 5, maxSecondaryAreas: 4,
                  includeSecondary: false, hubUrl: '', moneyPageUrl: '', focusKeyword: '',
                }, state.campaign || {}, {
                  cityName: cRec.city, serviceName: cRec.serviceName, serviceKey: cRec.serviceKey,
                });
              }
            }
          } catch (_) { /* non-fatal */ }
        }
      } else {
        // Load session for any saved state
        const session = await loadSession(urlSlug);
        if (session) {
          state.campaign         = session.campaign         || state.campaign;
          state.engineOutput     = session.engineOutput     || null;
          state.selectedAreaDefs = session.selectedAreaDefs || [];
          state.keywordOverrides = session.keywordOverrides || {};
          state.rolloutLog       = session.rolloutLog       || null;
          state.validation       = session.validation       || null;
          if (!state.project && session.project) state.project = session.project;
        }
      }
      showStage(urlStage);
      App.onStageEnter(urlStage);
      App.updateCampaignBar();
      if (state.project) syncProjectSelectors(urlSlug, state.project.businessName);
      else document.getElementById('session-indicator').textContent = urlSlug;
      document.getElementById('resume-banner').style.display = 'none';
      // When a specific campaign is loaded at Stage 2, scroll past the campaigns list
      // to the Campaign Setup form so the user can see the pre-filled fields and Next →
      if (urlCampaign && Number(urlStage) === 2) {
        requestAnimationFrame(() => {
          const anchor = document.getElementById('campaign-config-anchor');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    } catch (e) {
      console.error('URL param auto-load failed:', e);
      try { showStage(urlStage || 1); App.onStageEnter(urlStage || 1); } catch (_) {}
      checkForSavedSession();
    }
    return;
  }

  App.onStageEnter(1);
  checkForSavedSession();
};

// ═══════════════════════════════════════════════════════════════════
// Progress bar
// ═══════════════════════════════════════════════════════════════════

function renderProgress() {
  const wrap = document.getElementById('progress-steps');
  if (!wrap) return;
  let html = '';
  for (let i = 1; i <= 8; i++) {
    const done = state.stage > i;
    const active = state.stage === i;
    const cls = done ? 'done' : (active ? 'active' : '');
    html += '<div class="step-wrap">';
    html += \`<div class="step-circle \${cls}" onclick="App.jumpToStage(\${i})" title="\${STAGE_NAMES[i]}">\${done ? '✓' : i}</div>\`;
    html += \`<div class="step-label">\${STAGE_NAMES[i]}</div>\`;
    html += '</div>';
    if (i < 8) {
      html += \`<div class="step-connector \${done ? 'done' : ''}"></div>\`;
    }
  }
  wrap.innerHTML = html;
  document.getElementById('nav-stage-label').textContent =
    \`Stage \${state.stage} of 8 — \${STAGE_NAMES[state.stage]}\`;
  document.getElementById('btn-back').disabled = state.stage === 1 || state.isGenerating;
  document.getElementById('btn-next').disabled = state.isGenerating;
  document.getElementById('btn-next').textContent =
    state.stage === 8 ? '✓ Done' : 'Next →';
  // Show unlock button whenever the wizard is stuck generating
  const unlockBtn = document.getElementById('rollout-unlock-btn');
  if (unlockBtn) unlockBtn.style.display = state.isGenerating ? 'inline-block' : 'none';
}

function showStage(n) {
  for (let i = 1; i <= 8; i++) {
    document.getElementById(\`stage-\${i}\`).classList.toggle('active', i === n);
  }
  state.stage = n;
  renderProgress();
  App.updateCampaignBar();
  try { window.parent.postMessage({ type: 'wizardStageChange', stage: n }, '*'); } catch(_){}
}

App.updateCampaignBar = function() {
  const bar = document.getElementById('campaign-bar');
  if (!bar) return;

  const cid = state.campaignId;
  const stage = state.stage || 1;

  // Only show on stages 2-8 when there's an active campaign
  if (!cid || stage < 2) {
    bar.style.display = 'none';
    return;
  }

  const c = state.campaign || {};
  const city = c.cityName || '—';
  const service = c.serviceName || 'Campaign';

  // Status from campaign hub data if available, else derive from stage
  let status = 'new';
  if (state._campaignMeta) {
    const meta = (state._campaignMeta || []).find(x => x.id === cid);
    if (meta) status = meta.status;
  }
  if (stage >= 7) status = 'generated';
  if (stage >= 8) status = 'deployed';

  const statusLabel = { new: 'New', in_progress: 'In Progress', generated: 'Generated', deployed: 'Deployed' }[status] || status;
  const statusCls = status === 'deployed' ? '' : status === 'new' ? 'new' : 'in-progress';

  const slug = state.project?.clientSlug || '';

  bar.style.display = 'flex';
  bar.innerHTML = \`
    <span style="color:var(--muted);font-size:.8rem">Active campaign:</span>
    <span class="campaign-bar-pill">
      \${city} — \${service}
      <span class="campaign-bar-status \${statusCls}">\${statusLabel}</span>
    </span>
    <span style="flex:1"></span>
    <button class="campaign-bar-btn" onclick="(window.frameElement?window.top:window).location.href='/api/dashboard?slug=\${slug}&tab=campaigns'" title="View all campaigns">All Campaigns</button>
    <button class="campaign-bar-btn primary" onclick="App.newCampaign()" title="Start a new campaign">+ New Campaign</button>
  \`;
};

// ═══════════════════════════════════════════════════════════════════
// Navigation
// ═══════════════════════════════════════════════════════════════════

App.nextStage = async function() {
  if (state.isGenerating) return;
  const ok = await App.validateAndSave(state.stage);
  if (!ok) return;
  if (state.stage < 8) {
    const next = state.stage + 1;
    showStage(next);
    App.onStageEnter(next);
    // Advance campaign's currentStage tracker
    if (state.campaignId && next > 2) {
      App.updateCampaignProgress({ currentStage: next, status: next >= 7 ? 'generated' : 'in_progress' });
    }
  } else {
    // Stage 8 is the final stage — mark campaign deployed then go to the overview dashboard
    if (state.campaignId) {
      await App.updateCampaignProgress({ currentStage: 8, status: 'deployed' });
    }
    window.location.href = '/dashboard';
  }
};

App.prevStage = function() {
  if (state.isGenerating) return;
  if (state.stage > 1) {
    showStage(state.stage - 1);
    App.onStageEnter(state.stage);
  }
};

App.jumpToStage = function(n) {
  if (state.isGenerating) return;
  if (n === state.stage) return;
  showStage(n);
  App.onStageEnter(n);
};

App.unlockWizard = function() {
  state.isGenerating = false;
  state.activeJobId = null;
  document.getElementById('rollout-spinner').style.display = 'none';
  document.getElementById('rollout-cancel-btn').style.display = 'none';
  document.getElementById('rollout-start-again').style.display = 'none';
  document.getElementById('run-rollout-btn').disabled = false;
  document.getElementById('run-rollout-btn').textContent = '↺ Re-generate Pages →';
  // Also clear any stuck validation spinner on stage 6
  const valLoading = document.getElementById('val-loading');
  const valBtn = document.getElementById('run-validate-btn');
  if (valLoading) valLoading.style.display = 'none';
  if (valBtn) valBtn.disabled = false;
  renderProgress();
};

App.setConcurrency = function(n) {
  App._concurrency = n;
  [1, 2, 3].forEach(function(v) {
    const btn = document.getElementById('conc-btn-' + v);
    if (!btn) return;
    if (v === n) {
      btn.style.background = '#2563eb';
      btn.style.color = '#fff';
      btn.style.borderColor = '#2563eb';
    } else {
      btn.style.background = '#f9fafb';
      btn.style.color = '';
      btn.style.borderColor = '#d1d5db';
    }
  });
};

App.startFreshRun = function() {
  // Hide the "Start Fresh Run" banner and reset everything so user can run again
  document.getElementById('rollout-start-again').style.display = 'none';
  document.getElementById('progress-log').innerHTML = '<span class="log-line-dim">Ready — click Generate Pages to start a new run.</span>';
  document.getElementById('rollout-progress-wrap').style.display = 'none';
  document.getElementById('rollout-status-badge').style.display = 'none';
  document.getElementById('rollout-cancel-btn').style.display = 'none';
  document.getElementById('run-rollout-btn').disabled = false;
  document.getElementById('run-rollout-btn').textContent = 'Generate Pages →';
  state.activeJobId = null;
  state.isGenerating = false;
  renderProgress();
  // Scroll run button into view
  document.getElementById('run-rollout-btn').scrollIntoView({ behavior: 'smooth', block: 'center' });
};

App.onStageEnter = async function(n) {
  clearErrors();
  // Relabel the Next button to make it clear it saves on Stage 1
  const btnNext = document.getElementById('btn-next');
  if (btnNext) btnNext.textContent = n === 1 ? 'Save & Continue →' : 'Next →';
  if (n === 1) {
    if (state.project) { populateStage1Form(state.project); }
    App.refreshGscStatus();
    // Handle OAuth return: show success message and clean URL
    const p1 = new URLSearchParams(window.location.search);
    if (p1.has('gsc_connected')) {
      window.history.replaceState({}, '', window.location.pathname);
      const msg = document.getElementById('stage1-save-msg');
      if (msg) { msg.textContent = '✓ Google Search Console connected'; setTimeout(() => { msg.textContent = ''; }, 5000); }
    }
  }
  if (n === 2) { loadCityList(); const s2slug = state.project?.clientSlug; if (s2slug) App.loadCampaignHub(s2slug); }
  if (n === 3) await App.runAreaEngine();
  if (n === 4) renderKeywordCards();
  if (n === 5) { renderRolloutOrder(); App.initStage5(); }  // initStage5 calls loadImageStatuses — no double-call
  if (n === 6) { if (state.project?.clientSlug) App.runValidation(); }
  if (n === 7) renderOutput();
  if (n === 8) App.loadIndexingStage();
};

// ═══════════════════════════════════════════════════════════════════
// Validate & save per stage
// ═══════════════════════════════════════════════════════════════════

App.validateAndSave = async function(stage) {
  switch (stage) {
    case 1: return await App.saveStage1();
    case 2: return await App.saveStage2();
    case 3: return App.saveStage3();
    case 4: return App.saveStage4();
    case 5: return true; // stage 5 advances only after rollout completes
    case 6: return true;
    case 7: return true;
    case 8: return true;
  }
  return true;
};

// ═══════════════════════════════════════════════════════════════════
// Stage 1 — Business Setup
// ═══════════════════════════════════════════════════════════════════

// Projects are rendered server-side into the select element — no fetch needed
function loadProjectList() { /* noop — options embedded in HTML */ }

App.loadExistingProject = async function() {
  const slug = document.getElementById('existing-project-select').value;
  const loadBtn = document.querySelector('button[onclick="App.loadExistingProject()"]');
  const errEl  = document.getElementById('stage1-error');
  const msgEl  = document.getElementById('stage1-save-msg');
  if (!slug) { alert('Please select a project from the dropdown first.'); return; }

  // Visual loading state
  if (loadBtn) { loadBtn.disabled = true; loadBtn.textContent = 'Loading…'; }
  if (errEl)  errEl.classList.add('hidden');
  if (msgEl)  msgEl.textContent = '';

  try {
    const url = window.location.origin + '/api/projects/' + slug;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    if (!data.project) throw new Error('No project data in response');

    // Populate form
    populateStage1Form(data.project);
    state.project = data.project;

    // Restore session state if available
    try {
      const session = await loadSession(slug);
      if (session) {
        state.campaign         = session.campaign         || state.campaign;
        state.engineOutput     = session.engineOutput     || null;
        state.selectedAreaDefs = session.selectedAreaDefs || [];
        state.keywordOverrides = session.keywordOverrides || {};
        state.rolloutLog       = session.rolloutLog       || null;
        state.validation       = session.validation       || null;
      }
    } catch (_) { /* session restore is non-fatal */ }

    syncProjectSelectors(slug, data.project.businessName);
    if (msgEl) {
      msgEl.textContent = \`✓ Loaded: \${data.project.businessName} (\${slug})\`;
      setTimeout(() => { msgEl.textContent = ''; }, 4000);
    }
    localStorage.setItem('seo_wizard_slug', slug);
  } catch (e) {
    console.error('loadExistingProject error:', e);
    alert('Failed to load project "' + slug + '": ' + e.message);
  } finally {
    if (loadBtn) { loadBtn.disabled = false; loadBtn.textContent = 'Load'; }
  }
};

// Sync project tab buttons + Stage 1 selector to the active project
function syncProjectSelectors(slug, businessName) {
  // Highlight the active tab button
  document.querySelectorAll('.proj-tab').forEach(btn => {
    btn.classList.toggle('active', btn.id === 'ptab-' + slug);
  });
  // Sync Stage 1 dropdown
  const s1Sel = document.getElementById('existing-project-select');
  if (s1Sel) s1Sel.value = slug;
  // noop — campaigns are managed on the dashboard
}

// ═══════════════════════════════════════════════════════════════════
// Campaign Hub
// ═══════════════════════════════════════════════════════════════════

function campaignStatusBadge(c) {
  const map = {
    new:         { label: 'New',         bg: '#f1f5f9', color: '#64748b' },
    in_progress: { label: 'In Progress', bg: '#dbeafe', color: '#1e40af' },
    generated:   { label: 'Generated',   bg: '#dcfce7', color: '#166534' },
    deployed:    { label: 'Deployed',    bg: '#d1fae5', color: '#065f46' },
  };
  const s = map[c.status] || map.new;
  return \`<span style="font-size:.7rem;padding:2px 8px;border-radius:10px;background:\${s.bg};color:\${s.color};font-weight:600">\${s.label}</span>\`;
}

function campaignProgressText(c) {
  const parts = [];
  if (c.areasSelected) parts.push(\`\${c.areasSelected} areas\`);
  if (c.pagesGenerated) parts.push(\`\${c.pagesGenerated} pages built\`);
  if (c.pagesDeployed) parts.push(\`\${c.pagesDeployed} deployed\`);
  return parts.length ? parts.join(' · ') : 'Not started';
}

App.loadCampaignHub = async function(slug) {
  const list = document.getElementById('campaign-list');
  if (!list) return;
  try {
    const res = await apiFetch('/api/campaigns/' + slug);
    if (!res.ok) { list.innerHTML = '<div style="color:var(--muted);font-size:.85rem">Could not load campaigns</div>'; return; }
    const data = await res.json();
    const campaigns = data.campaigns || [];
    state._campaignMeta = campaigns;

    if (!campaigns.length) {
      list.innerHTML = '<div style="color:var(--muted);font-size:.85rem;padding:8px 0">No campaigns yet — click <strong>+ New Campaign</strong> to start.</div>';
      document.getElementById('campaign-quick-actions').style.display = 'none';
      return;
    }

    list.innerHTML = campaigns.map(c => {
      const isActive = c.id === state.campaignId;
      return \`<div style="border:1px solid \${isActive ? 'var(--primary)' : 'var(--border)'};border-radius:8px;padding:12px 14px;background:\${isActive ? '#eff6ff' : 'var(--surface)'};display:flex;align-items:center;gap:12px">
        <div style="flex:1;min-width:0">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
            <span style="font-weight:600;font-size:.9rem">\${c.city} — \${c.serviceName}</span>
            \${campaignStatusBadge(c)}
            \${isActive ? '<span style="font-size:.7rem;color:var(--primary);font-weight:600">● Active</span>' : ''}
          </div>
          <div style="font-size:.78rem;color:var(--muted)">\${campaignProgressText(c)}</div>
          <div style="font-size:.72rem;color:#94a3b8;margin-top:2px">Stage \${c.currentStage} of 8 · Created \${new Date(c.createdAt).toLocaleDateString('en-GB')}</div>
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-primary btn-sm" onclick="App.resumeCampaign('\${c.id}')" title="Resume this campaign">Resume →</button>
          <button class="btn btn-secondary btn-sm" onclick="App.deleteCampaign('\${c.id}')" title="Delete this campaign" style="padding:4px 8px;color:#dc2626">✕</button>
        </div>
      </div>\`;
    }).join('');

    // Show quick actions if there is an active campaign
    const qa = document.getElementById('campaign-quick-actions');
    if (qa) qa.style.display = state.campaignId ? 'block' : 'none';
  } catch(e) {
    list.innerHTML = '<div style="color:var(--danger);font-size:.85rem">Error loading campaigns</div>';
  }
};

App.newCampaign = async function(evt) {
  const urlCampaign = new URLSearchParams(window.location.search).get('campaign') || '';

  const campaignSlug = (
    state.campaign?.slug ||
    state.campaign?.campaignSlug ||
    state.campaignId ||
    urlCampaign ||
    ''
  ).toString().trim();

  const slug = campaignSlug || state.project?.clientSlug;
  if (!slug) {
    if (evt) evt.preventDefault();
    alert('Please load a project first.');
    return;
  }

  // Reset stage 2-8 state only
  state.campaign         = {};
  state.campaignId       = null;
  state.engineOutput     = null;
  state.selectedAreaDefs = [];
  state.keywordOverrides = {};
  state.rolloutLog       = null;
  state.validation       = null;

  // Clear Stage 2 form fields
  const fields = ['cityName','serviceName','serviceKey','hubUrl','moneyPageUrl','focusKeyword'];
  fields.forEach(id => { const el = document.getElementById(id); if (el && el.tagName !== 'SELECT') el.value = ''; });

  // Ensure we are on Stage 2
  if (state.stage !== 2) {
    if (evt) evt.preventDefault(); // prevent href nav; we'll do it manually after stage switch
    showStage(2);
    App.onStageEnter(2);
    setTimeout(() => { window.location.hash = 'campaign-config-anchor'; }, 200);
  }
  // else: already on Stage 2 — the href="#campaign-config-anchor" on the button handles the scroll

  // Show the "fill in below" hint banner
  const hint = document.getElementById('new-campaign-hint');
  if (hint) hint.style.display = 'block';

  // Focus service name once the scroll lands
  setTimeout(() => { const sn = document.getElementById('serviceName'); if (sn) sn.focus(); }, 300);
};

App.resumeCampaign = async function(campaignId) {
  const slug = state.project?.clientSlug;
  if (!slug) return;

  state.campaignId = campaignId;
  const hintEl = document.getElementById('new-campaign-hint');
  if (hintEl) hintEl.style.display = 'none';

  // Always clear campaign-specific state first to prevent bleed from previous runs
  state.campaign         = null;
  state.engineOutput     = null;
  state.selectedAreaDefs = [];
  state.keywordOverrides = {};
  state.rolloutLog       = null;
  state.validation       = null;

  try {
    const session = await loadSession(slug, campaignId);
    if (session) {
      state.campaign         = session.campaign         || null;
      state.engineOutput     = session.engineOutput     || null;
      state.selectedAreaDefs = session.selectedAreaDefs || [];
      state.keywordOverrides = session.keywordOverrides || {};
      state.rolloutLog       = session.rolloutLog       || null;
      state.validation       = session.validation       || null;
    }
    // Fetch campaign metadata to get the right stage
    const res = await apiFetch('/api/campaigns/' + slug);
    if (res.ok) {
      const data = await res.json();
      state._campaignMeta = data.campaigns || [];
      const c = state._campaignMeta.find(x => x.id === campaignId);

      // If the session had no campaign form data, seed it from the campaign record
      // so Stage 2 form fields are pre-filled and Next → works immediately
      if (!state.campaign?.cityName && c) {
        state.campaign = Object.assign({
          maxPriorityAreas: 5,
          maxSecondaryAreas: 4,
          includeSecondary: false,
          hubUrl: '',
          moneyPageUrl: '',
          focusKeyword: '',
        }, state.campaign || {}, {
          cityName:    c.city,
          serviceName: c.serviceName,
          serviceKey:  c.serviceKey,
        });
      }

      const targetStage = c?.currentStage || 2;
      showStage(targetStage);
      App.onStageEnter(targetStage);
      // Scroll to the Campaign Setup form so the user can see the pre-filled fields and Next →
      if (targetStage === 2) {
        requestAnimationFrame(() => {
          const anchor = document.getElementById('campaign-config-anchor');
          if (anchor) anchor.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
      }
    }
    App.updateCampaignBar();
  } catch(e) {
    console.error('resumeCampaign error:', e);
    showStage(2);
    App.onStageEnter(2);
    App.updateCampaignBar();
  }

  // Refresh campaign hub to show active indicator + quick actions
  App.loadCampaignHub(slug);
};

App.deleteCampaign = async function(campaignId) {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  if (!confirm('Delete this campaign? This cannot be undone.')) return;
  try {
    const res = await apiFetch('/api/campaigns/' + slug + '/' + campaignId, { method: 'DELETE' });
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || 'Failed to delete campaign (HTTP ' + res.status + ')');
      return;
    }
    if (state.campaignId === campaignId) {
      state.campaignId = null;
      state.campaign = {};
    }
    App.loadCampaignHub(slug);
  } catch (e) {
    alert(e.message || 'Failed to delete campaign');
  }
};

// Updates campaign metadata after a stage completes
App.updateCampaignProgress = async function(updates) {
  const slug = state.project?.clientSlug;
  const cid  = state.campaignId;
  if (!slug || !cid) return;
  try {
    await apiFetch('/api/campaigns/' + slug + '/' + cid, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    });
    App.loadCampaignHub(slug);
  } catch(_) { /* non-fatal */ }
};

// Called when Stage 2 is saved (campaign is defined) — create campaign record
App.persistCampaignFromStage2 = async function() {
  const slug = state.project?.clientSlug;
  if (!slug || !state.campaign) return;
  const { cityName, serviceName, serviceKey } = state.campaign;
  if (!cityName || !serviceName || !serviceKey) return;

  // If already has a campaignId, only update stage/status — never overwrite identity fields
  // (city & service are locked when the campaign was created)
  if (state.campaignId) {
    await App.updateCampaignProgress({ currentStage: 3, status: 'in_progress' });
    return;
  }

  // Create new campaign record
  try {
    const res = await apiFetch('/api/campaigns/' + slug, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        city: cityName,
        citySlug: cityName.toLowerCase().replace(/\\s+/g, '-'),
        serviceName, serviceKey,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      state.campaignId = data.campaign.id;
    }
  } catch(_) { /* non-fatal */ }
};

// Called when user clicks a project tab button in the topbar
App.switchProject = async function(slug) {
  if (!slug) return;
  // Dim all tabs while loading
  document.querySelectorAll('.proj-tab').forEach(btn => { btn.style.opacity = '.5'; btn.disabled = true; });
  try {
    const url  = window.location.origin + '/api/projects/' + slug;
    const res  = await fetch(url, { cache: 'no-store' });
    if (!res.ok) throw new Error('Server returned ' + res.status);
    const data = await res.json();
    if (!data.project) throw new Error('No project data in response');

    populateStage1Form(data.project);
    state.project = data.project;

    try {
      const session = await loadSession(slug);
      if (session) {
        state.campaign         = session.campaign         || state.campaign;
        state.engineOutput     = session.engineOutput     || null;
        state.selectedAreaDefs = session.selectedAreaDefs || [];
        state.keywordOverrides = session.keywordOverrides || {};
        state.rolloutLog       = session.rolloutLog       || null;
        state.validation       = session.validation       || null;
      }
    } catch (_) { /* non-fatal */ }

    syncProjectSelectors(slug, data.project.businessName);
    localStorage.setItem('seo_wizard_slug', slug);

    // Jump to stage 1 so user sees the loaded project details
    showStage(1);
    App.onStageEnter(1);

    const msgEl = document.getElementById('stage1-save-msg');
    if (msgEl) {
      msgEl.textContent = \`✓ Switched to: \${data.project.businessName}\`;
      setTimeout(() => { msgEl.textContent = ''; }, 3500);
    }
  } catch (e) {
    alert('Failed to switch project: ' + e.message);
  } finally {
    document.querySelectorAll('.proj-tab').forEach(btn => { btn.style.opacity = ''; btn.disabled = false; });
  }
};

App.quickJump = function(n) {
  showStage(n);
  App.onStageEnter(n);
};

function setSlugLocked(locked) {
  const el = document.getElementById('clientSlug');
  const hint = document.getElementById('clientSlug-hint');
  const field = document.getElementById('f-clientSlug');
  if (!el) return;
  if (locked) {
    el.readOnly = true;
    el.style.cssText = 'background:var(--bg);color:var(--muted);cursor:default;border-color:var(--border)';
    if (hint) hint.textContent = 'Project identifier — locked after creation.';
    if (field) field.title = 'The slug is locked once a project is created';
  } else {
    el.readOnly = false;
    el.style.cssText = '';
    if (hint) hint.textContent = 'Lowercase letters, numbers and hyphens only.';
    if (field) field.title = '';
  }
}

function populateStage1Form(p) {
  setVal('businessName', p.businessName || '');
  setVal('clientSlug', p.clientSlug || '');
  setSlugLocked(true);
  setVal('legalName', p.legalName || '');
  setVal('companyNumber', p.companyNumber || '');
  setVal('domain', p.domain || '');
  setVal('phone', p.phone || '');
  setVal('email', p.email || '');
  setVal('businessAddress', p.businessAddress || '');
  setVal('mapLatitude', p.mapLatitude != null ? String(p.mapLatitude) : '');
  setVal('mapLongitude', p.mapLongitude != null ? String(p.mapLongitude) : '');
  setVal('mapZoom', p.mapZoom != null ? String(p.mapZoom) : '17');
  setVal('googleMapUrl', p.googleMapUrl || '');
  setVal('mapEmbedUrl', p.mapEmbedUrl || '');
  setVal('primaryCtaText', p.primaryCtaText || 'Request a Quote');
  setVal('primaryCtaUrl', p.primaryCtaUrl || '');
  setVal('logoUrl', p.logoUrl || '');
  setVal('strapline', p.strapline || '');
  setVal('footerCompanyName', p.footerCompanyName || '');
  setVal('privacyUrl', p.privacyUrl || '/privacy-policy/');
  setVal('termsUrl', p.termsUrl || '/terms/');
  setVal('footerStrapline', p.footerStrapline || '');
  setVal('brandColour', p.brandColour || '#000000');
  setVal('primaryColor', p.branding?.primaryColor || '#005EB8');
  setVal('accentColor', p.branding?.accentColor || '#1CA9C9');

  // Skip logo checkbox
  const skipLogoEl = document.getElementById('skipLogo');
  if (skipLogoEl) skipLogoEl.checked = p.skipLogo === true || (!p.logoUrl && p.skipLogo !== false && false);
  App.onSkipLogoChange();
  setVal('ftpHost', p.deploy?.host || '');
  setVal('ftpPort', p.deploy?.port || 21);
  setVal('ftpRemoteRoot', p.deploy?.remoteRoot || '/');
  setVal('ftpUsername', p.deploy?.username || '');
  setVal('ftpPassword', p.deploy?.password || '');

  // Extended business profile
  setVal('businessType', p.businessType || '');
  setVal('templateId', p.templateId || 'inboxingproweb_default');
  setVal('mainService', p.mainService || '');
  setVal('additionalServices', Array.isArray(p.additionalServices) ? p.additionalServices.join(', ') : (p.additionalServices || ''));
  setVal('primaryLocation', p.primaryLocation || '');
  setVal('serviceAreas', Array.isArray(p.serviceAreas) ? p.serviceAreas.join(', ') : (p.serviceAreas || ''));
  setVal('toneOfVoice', p.toneOfVoice || 'professional');
  setVal('description', p.description || '');

  // Brand profile
  setVal('fontPreference', p.fontPreference || '');
  setVal('brandNotes', p.brandNotes || '');
  if (p.brandStyle) {
    const radio = document.querySelector('input[name="brandStyle"][value="' + p.brandStyle + '"]');
    if (radio) radio.checked = true;
    App.onBrandStyleChange();
  }

  // Image mode
  if (p.imageMode) {
    const radio = document.querySelector('input[name="imageMode"][value="' + p.imageMode + '"]');
    if (radio) radio.checked = true;
    App.onImageModeChange();
  }

  // API keys — show masked version or blank
  setVal('ideogramApiKey', p.integrations?.ideogramApiKey || '');
  setVal('openaiApiKey', p.integrations?.openaiApiKey || '');

  // Ideogram status badge
  const ideoBadge = document.getElementById('ideogram-status');
  if (ideoBadge) {
    ideoBadge.textContent = p.integrations?.ideogramApiKey ? '✓ Key set' : 'Using server key';
    ideoBadge.style.background = p.integrations?.ideogramApiKey ? '#dcfce7' : '#f1f5f9';
    ideoBadge.style.color = p.integrations?.ideogramApiKey ? '#166534' : 'var(--muted)';
  }
  // OpenAI status badge
  const oaiBadge = document.getElementById('openai-status');
  if (oaiBadge) {
    oaiBadge.textContent = p.integrations?.openaiApiKey ? '✓ Key set' : 'Using server key';
    oaiBadge.style.background = p.integrations?.openaiApiKey ? '#dcfce7' : '#f1f5f9';
    oaiBadge.style.color = p.integrations?.openaiApiKey ? '#166534' : 'var(--muted)';
  }

  renderNavItems(p.navItems || []);
  renderFooterLinks(p.footerLinks || []);
  renderFooterServiceLinks(p.footerServiceLinks || []);
  state.project = p;
  App.refreshCompletion();
  App.loadUsageWidget(p.clientSlug);
}

App.saveStage1 = async function() {
  clearErrors();
  // If form looks empty but state.project exists, re-sync (guards against browser autofill clearing)
  if (state.project && !getVal('businessName') && !getVal('clientSlug')) {
    populateStage1Form(state.project);
  }
  // If no state.project but a project is selected in the dropdown, try loading it first
  if (!state.project && !getVal('businessName') && !getVal('clientSlug')) {
    const selectEl = document.getElementById('existing-project-select');
    if (selectEl && selectEl.value) {
      await App.loadExistingProject();
      if (state.project) {
        // form is now populated — wait a tick then re-run
        await new Promise(r => setTimeout(r, 50));
      }
    }
  }
  const errs = [];
  const slug    = getVal('clientSlug').trim();
  const bizName = getVal('businessName').trim();
  const domain  = getVal('domain').trim();
  const phone   = getVal('phone').trim();
  const email   = getVal('email').trim();

  const logoUrl      = getVal('logoUrl').trim();
  const skipLogo     = document.getElementById('skipLogo')?.checked;
  const footerBiz    = getVal('footerCompanyName').trim();
  const bizAddress   = getVal('businessAddress').trim();

  if (!bizName)                              errs.push(['f-businessName',      'Required']);
  if (!slug || !/^[a-z0-9-]+$/.test(slug))  errs.push(['f-clientSlug',        'Use lowercase letters, numbers and hyphens only']);
  if (!domain.startsWith('https://'))        errs.push(['f-domain',            'Must start with https://']);
  if (!phone)                                errs.push(['f-phone',             'Required']);
  if (!email)                                errs.push(['f-email',             'Required']);
  if (!bizAddress)                           errs.push(['f-businessAddress',   'Required']);
  if (!logoUrl && !skipLogo)                 errs.push(['f-logoUrl',           'Required — enter a URL or tick "Skip logo"']);
  if (!footerBiz)                            errs.push(['f-footerCompanyName', 'Required']);
  let navOk = state.navItems.length > 0;
  const navErrEl = document.getElementById('nav-items-error');
  if (!navOk) {
    if (navErrEl) navErrEl.style.display = 'block';
  } else {
    if (navErrEl) navErrEl.style.display = 'none';
  }

  if (errs.length || !navOk) {
    errs.forEach(([field, msg]) => { if (field) setFieldError(field, msg); });
    const missing = [
      ...errs.map(([f]) => f.replace('f-','').replace(/([A-Z])/g,' $1').toLowerCase()).filter(Boolean),
      ...(!navOk ? ['header navigation (at least 1 item required)'] : [])
    ].join(', ');
    showError('stage1-error', \`Please fix the highlighted fields below: \${missing}\`);
    const firstField = errs[0]?.[0];
    const scrollTarget = firstField ? document.getElementById(firstField) : document.getElementById('stage1-error');
    if (scrollTarget) scrollTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return false;
  }

  const body = {
    clientSlug: slug,
    businessName: bizName,
    legalName: getVal('legalName').trim(),
    companyNumber: getVal('companyNumber').trim(),
    domain: domain,
    phone: phone,
    email: email,
    businessAddress: getVal('businessAddress'),
    mapLatitude: getVal('mapLatitude') ? parseFloat(getVal('mapLatitude')) : undefined,
    mapLongitude: getVal('mapLongitude') ? parseFloat(getVal('mapLongitude')) : undefined,
    mapZoom: getVal('mapZoom') ? parseInt(getVal('mapZoom'), 10) : 17,
    googleMapUrl: getVal('googleMapUrl') || undefined,
    mapEmbedUrl: getVal('mapEmbedUrl') || undefined,
    primaryCtaText: getVal('primaryCtaText'),
    primaryCtaUrl: getVal('primaryCtaUrl'),
    logoUrl: getVal('logoUrl') || undefined,
    skipLogo: document.getElementById('skipLogo')?.checked || false,
    strapline: getVal('strapline') || undefined,
    brandColour: getVal('brandColour') || '#000000',
    footerCompanyName: getVal('footerCompanyName'),
    footerStrapline: getVal('footerStrapline') || undefined,
    footerLinks: state.footerLinks,
    footerServiceLinks: state.footerServiceLinks,
    privacyUrl: getVal('privacyUrl'),
    termsUrl: getVal('termsUrl'),
    branding: {
      primaryColor: getVal('primaryColor'),
      accentColor: getVal('accentColor'),
    },
    navItems: state.navItems,
    // Extended business profile
    templateId: getVal('templateId') || 'inboxingproweb_default',
    businessType: getVal('businessType') || undefined,
    mainService: getVal('mainService') || undefined,
    additionalServices: getVal('additionalServices') ? getVal('additionalServices').split(',').map(s => s.trim()).filter(Boolean) : [],
    primaryLocation: getVal('primaryLocation') || undefined,
    serviceAreas: getVal('serviceAreas') ? getVal('serviceAreas').split(',').map(s => s.trim()).filter(Boolean) : [],
    toneOfVoice: getVal('toneOfVoice') || 'professional',
    description: getVal('description') || undefined,
    // Brand profile
    brandStyle: document.querySelector('input[name="brandStyle"]:checked')?.value || undefined,
    fontPreference: getVal('fontPreference') || undefined,
    brandNotes: getVal('brandNotes') || undefined,
    // Image mode
    imageMode: document.querySelector('input[name="imageMode"]:checked')?.value || undefined,
    deploy: {
      host: getVal('ftpHost'),
      port: parseInt(getVal('ftpPort') || '21', 10),
      remoteRoot: getVal('ftpRemoteRoot') || '/',
      username: getVal('ftpUsername') || undefined,
      password: getVal('ftpPassword') || undefined,
    },
    integrations: {
      ideogramApiKey: getVal('ideogramApiKey') || undefined,
      openaiApiKey: getVal('openaiApiKey') || undefined,
    },
  };

  try {
    const res = await apiFetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { showError('stage1-error', data.error || 'Save failed'); return false; }
    state.project = data.project;
    // Re-populate the form from the server-returned object so the UI reflects exactly what was saved
    if (data.project) populateStage1Form(data.project);
    await saveSession();
    syncProjectSelectors(slug, data.project?.businessName || slug);
    App.refreshCompletion();
    return true;
  } catch (e) {
    showError('stage1-error', 'Network error: ' + e.message);
    return false;
  }
};

// ── Save project without advancing ──
App.saveProjectOnly = async function() {
  const btn = document.getElementById('btn-save-project');
  const msg = document.getElementById('stage1-save-msg');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  msg.textContent = '';
  const ok = await App.saveStage1();
  btn.disabled = false;
  btn.textContent = '💾 Save Project';
  if (ok) {
    const ts = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
    msg.innerHTML = '<strong style="color:#166534">✓ Business profile saved successfully.</strong> <span style="color:var(--muted);font-size:.82rem">Last saved: ' + ts + '</span>';
  } else {
    msg.innerHTML = '<span style="color:#dc2626">✗ Save failed — check errors above.</span>';
  }
};

// ── Show/hide password fields ──
App.togglePwVis = function(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  const isHidden = el.type === 'password';
  el.type = isHidden ? 'text' : 'password';
  btn.textContent = isHidden ? 'Hide' : 'Show';
};

// ── Brand style radio highlight ──
App.onBrandStyleChange = function() {
  document.querySelectorAll('input[name="brandStyle"]').forEach(el => {
    const label = el.closest('label');
    if (label) label.style.borderColor = el.checked ? 'var(--primary)' : 'var(--border)';
  });
};

// ── Image mode card highlight + AI notice ──
App.onImageModeChange = function() {
  const selected = document.querySelector('input[name="imageMode"]:checked')?.value;
  document.querySelectorAll('input[name="imageMode"]').forEach(el => {
    const card = el.closest('label');
    if (card) card.style.borderColor = el.checked ? 'var(--primary)' : 'var(--border)';
  });
  const notice = document.getElementById('imageMode-ai-notice');
  if (notice) notice.style.display = (selected === 'ai' || selected === 'mixed') ? 'block' : 'none';
};

// ── Profile Completion Score ──
App.refreshCompletion = async function() {
  const slug = getVal('clientSlug') || (state.project && state.project.clientSlug);
  if (!slug) return;
  try {
    const res = await apiFetch('/api/projects/' + slug + '/completion');
    if (!res.ok) return;
    const data = await res.json();

    // ── Top completion widget ──
    const widget = document.getElementById('completion-widget');
    const bar    = document.getElementById('completion-bar');
    const label  = document.getElementById('completion-score-label');
    const items  = document.getElementById('completion-items');
    const warn   = document.getElementById('completion-warning');
    if (widget) {
      widget.style.display = 'block';
      const pct = data.requiredScore ?? data.score;
      if (bar) { bar.style.width = pct + '%'; bar.style.background = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'; }
      if (label) { label.textContent = pct + '% required'; label.style.color = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444'; }
      if (items) {
        items.innerHTML = data.items.map(item =>
          '<div style="display:flex;align-items:center;gap:5px;padding:2px 0">' +
          '<span style="color:' + (item.done ? '#22c55e' : (item.required ? '#ef4444' : '#d1d5db')) + '">' + (item.done ? '✓' : '✗') + '</span>' +
          '<span style="color:' + (item.done ? 'var(--text)' : 'var(--muted)') + '">' + item.label +
          (item.required && !item.done ? ' <strong style="color:#ef4444;font-size:.7rem">required</strong>' : '') + '</span>' +
          '</div>'
        ).join('');
      }
      if (warn) warn.style.display = !data.requiredReady ? 'block' : 'none';
    }

    // ── Profile Status review card at bottom of Stage 1 ──
    const reviewItems  = document.getElementById('s1-profile-review-items');
    const reviewWarn   = document.getElementById('s1-profile-review-warn');
    const reviewOk     = document.getElementById('s1-profile-review-ok');
    const scoreBadge   = document.getElementById('s1-profile-score-badge');
    if (reviewItems && data.items) {
      const pct = data.requiredScore ?? data.score;
      const badgeColor = pct >= 100 ? '#22c55e' : pct >= 50 ? '#f59e0b' : '#ef4444';
      const badgeBg    = pct >= 100 ? '#dcfce7' : pct >= 50 ? '#fef9c3' : '#fee2e2';
      if (scoreBadge) {
        scoreBadge.textContent = pct + '%';
        scoreBadge.style.background = badgeBg;
        scoreBadge.style.color = badgeColor;
      }
      reviewItems.innerHTML = data.items.map(item =>
        '<div style="display:flex;align-items:center;gap:5px;padding:3px 0">' +
        '<span style="color:' + (item.done ? '#22c55e' : (item.required ? '#ef4444' : '#9ca3af')) + ';font-size:.9rem">' + (item.done ? '✓' : '○') + '</span>' +
        '<span style="color:' + (item.done ? 'var(--text)' : 'var(--muted)') + '">' + item.label + '</span>' +
        (item.required && !item.done ? '<span style="font-size:.68rem;background:#fee2e2;color:#dc2626;padding:1px 5px;border-radius:4px;margin-left:2px">required</span>' : '') +
        '</div>'
      ).join('');
      if (reviewWarn) reviewWarn.style.display = !data.requiredReady ? 'block' : 'none';
      if (reviewOk)   reviewOk.style.display   = data.requiredReady  ? 'block' : 'none';
    }
  } catch(e) { /* silently fail */ }
};

// ── GSC connection status for Stage 1 ──
App.refreshGscStatus = async function() {
  const badge = document.getElementById('s1-gsc-status');
  // Populate project-specific domain elements in Stage 1
  const base = (state.project?.domain || '').replace(/\\/+$/, '');
  if (base) {
    try {
      const hostname = new URL(base).hostname;
      const origin   = new URL(base).origin + '/';
      const hintEl   = document.getElementById('sc-domain-hint');
      const propEl   = document.getElementById('sc-property-url');
      if (hintEl) hintEl.textContent = hostname;
      if (propEl) propEl.textContent = origin;
    } catch (_) {}
  }
  const email = state.project?.email || '(your Google account email)';
  const emailEl = document.getElementById('sc-gsc-email');
  if (emailEl) emailEl.textContent = email;

  // Load full OAuth + creds status and update Stage 1 connect UI
  try {
    const [credsRes, statusRes] = await Promise.all([
      apiFetch('/api/index-tracking/credentials'),
      apiFetch('/api/gsc/auth/status'),
    ]);
    if (credsRes.ok && statusRes.ok) {
      const c = await credsRes.json();
      const s = await statusRes.json();
      itUpdateConnectionUI(c, s);
      // Update Stage 8 status bar
      const statusBar  = document.getElementById('it-gsc-status-text');
      const connectBtn = document.getElementById('it-gsc-status-bar')?.querySelector('button');
      if (statusBar) {
        if (s.connected) {
          statusBar.textContent = '✓ Connected to Google Search Console';
          statusBar.style.color = 'var(--success)';
          if (connectBtn) connectBtn.style.display = 'none';
        } else {
          statusBar.textContent = 'GSC not connected';
          statusBar.style.color = 'var(--muted)';
          if (connectBtn) connectBtn.style.display = '';
        }
      }
      // Update Stage 1 badge
      if (badge) {
        if (s.connected) {
          badge.textContent = '✓ Connected';
          badge.style.background = '#dcfce7';
          badge.style.color = '#166534';
        } else {
          badge.textContent = 'Not connected';
          badge.style.background = '#f1f5f9';
          badge.style.color = 'var(--muted)';
        }
      }
      return;
    }
  } catch (_) {}
  // Fallback: simple status check
  try {
    const res = await apiFetch('/api/gsc/auth/status');
    if (!res.ok) return;
    const d = await res.json();
    if (badge) {
      if (d.connected) {
        badge.textContent = '✓ Connected';
        badge.style.background = '#dcfce7';
        badge.style.color = '#166534';
      } else {
        badge.textContent = 'Not connected';
        badge.style.background = '#f1f5f9';
        badge.style.color = 'var(--muted)';
      }
    }
  } catch(_) { if (badge) badge.textContent = 'Not connected'; }
};

// ── Usage widget ──
App.loadUsageWidget = async function(slug) {
  if (!slug) return;
  const widget = document.getElementById('usage-widget');
  if (!widget) return;
  try {
    const res = await apiFetch('/api/usage/project/' + slug);
    if (!res.ok) return;
    const d = await res.json();

    widget.style.display = 'block';

    const badge = document.getElementById('usage-key-badge');
    if (badge) {
      const hasOwnKey = !!(state.project?.integrations?.ideogramApiKey);
      badge.textContent  = hasOwnKey ? 'Project key' : 'Server key';
      badge.style.background = hasOwnKey ? '#dbeafe' : '#f1f5f9';
      badge.style.color      = hasOwnKey ? '#1e40af' : 'var(--muted)';
    }

    const pct = Math.min(100, Math.round((d.serverKeyUsedThisMonth / d.monthlyLimit) * 100));
    const bar = document.getElementById('usage-meter-bar');
    if (bar) {
      bar.style.width = pct + '%';
      bar.style.background = pct >= 90 ? '#ef4444' : pct >= 70 ? '#f59e0b' : 'var(--primary)';
    }

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('usage-count', d.serverKeyUsedThisMonth);
    el('usage-limit', d.monthlyLimit);
    el('usage-cost', '$' + d.costThisMonth.toFixed(2));
    el('usage-alltime', d.allTimeCount + ' images ($' + d.allTimeCost.toFixed(2) + ')');

    const warn = document.getElementById('usage-limit-warn');
    if (warn) warn.style.display = d.serverKeyRemainingThisMonth === 0 ? 'block' : 'none';
  } catch(e) { /* non-fatal */ }
};

// ── OpenAI API test ──
App.testOpenAI = async function() {
  const btn = document.getElementById('btn-test-openai');
  const msg = document.getElementById('openai-test-msg');
  const badge = document.getElementById('openai-status');
  const key = getVal('openaiApiKey');
  btn.disabled = true;
  btn.textContent = 'Testing…';
  msg.textContent = '';
  try {
    const res = await apiFetch('/api/images/test-openai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key || null }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      badge.textContent = '✓ Connected';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
      msg.style.color = 'var(--success)';
      msg.textContent = '✓ OpenAI key is valid';
    } else {
      badge.textContent = '✗ Failed';
      badge.style.background = '#fee2e2';
      badge.style.color = '#991b1b';
      msg.style.color = 'var(--danger)';
      msg.textContent = '✗ ' + (data.error || 'Connection failed');
    }
  } catch(e) {
    msg.style.color = 'var(--danger)';
    msg.textContent = '✗ Network error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test';
  }
};

// ── Test Ideogram API connection ──
App.testIdeogram = async function() {
  const btn = document.getElementById('btn-test-ideogram');
  const msg = document.getElementById('ideogram-test-msg');
  const badge = document.getElementById('ideogram-status');
  const key = getVal('ideogramApiKey');
  btn.disabled = true;
  btn.textContent = 'Testing…';
  msg.textContent = '';
  try {
    const res = await fetch(window.location.origin + '/api/images/test-key', {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: key || null }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      badge.textContent = '✓ Connected';
      badge.style.background = '#dcfce7';
      badge.style.color = '#166534';
      msg.style.color = 'var(--success)';
      msg.textContent = '✓ API key is valid and working';
    } else {
      badge.textContent = '✗ Failed';
      badge.style.background = '#fee2e2';
      badge.style.color = '#991b1b';
      msg.style.color = 'var(--danger)';
      msg.textContent = '✗ ' + (data.error || 'Connection failed');
    }
  } catch (e) {
    msg.style.color = 'var(--danger)';
    msg.textContent = '✗ Network error: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Test';
  }
};

// ── Clear form for a new project ──
App.newProject = function() {
  if (!confirm('Clear the form to start a new project?')) return;
  state.project = null;
  state.campaign = {};
  setSlugLocked(false);
  state.engineOutput = null;
  state.selectedAreaDefs = [];
  state.keywordOverrides = {};
  const fields = ['businessName','clientSlug','legalName','companyNumber','domain','phone','email',
    'businessAddress','mapLatitude','mapLongitude','mapZoom','googleMapUrl','mapEmbedUrl','primaryCtaText','primaryCtaUrl','logoUrl','strapline','footerCompanyName',
    'footerStrapline','privacyUrl','termsUrl','brandColour','primaryColor','accentColor',
    'ftpHost','ftpPort','ftpRemoteRoot','ftpUsername','ftpPassword','ideogramApiKey','openaiApiKey',
    'businessType','templateId','mainService','additionalServices','primaryLocation','serviceAreas',
    'toneOfVoice','description','fontPreference','brandNotes'];
  fields.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      if (id === 'brandColour') { el.value = '#000000'; }
      else if (id === 'primaryColor') { el.value = '#005EB8'; }
      else if (id === 'accentColor') { el.value = '#1CA9C9'; }
      else el.value = '';
    }
  });
  const skipLogoEl = document.getElementById('skipLogo');
  if (skipLogoEl) skipLogoEl.checked = false;
  App.onSkipLogoChange();
  document.querySelectorAll('input[name="brandStyle"], input[name="imageMode"]').forEach(r => { r.checked = false; });
  App.onBrandStyleChange();
  App.onImageModeChange();
  const completionWidget = document.getElementById('completion-widget');
  if (completionWidget) completionWidget.style.display = 'none';
  state.campaignId = null;
  renderNavItems([]);
  renderFooterLinks([]);
  renderFooterServiceLinks([]);
  const navErrEl2 = document.getElementById('nav-items-error');
  if (navErrEl2) navErrEl2.style.display = 'none';
  document.getElementById('quick-jump').style.display = 'none';
  document.getElementById('session-indicator').textContent = '';
  document.getElementById('stage1-save-msg').textContent = '';
  document.getElementById('existing-project-select').value = '';
  clearErrors();
};

// ── Nav items ──

function renderNavItems(items) {
  state.navItems = [...items];
  const list = document.getElementById('nav-items-list');
  list.innerHTML = '';
  state.navItems.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'nav-item-row';
    row.innerHTML = \`
      <input type="text" placeholder="Label" value="\${esc(item.label)}" onchange="App.updateNavItem(\${i}, 'label', this.value)"/>
      <input type="text" placeholder="URL" value="\${esc(item.href)}" onchange="App.updateNavItem(\${i}, 'href', this.value)"/>
      <button class="nav-item-remove" onclick="App.removeNavItem(\${i})">×</button>\`;
    list.appendChild(row);
  });
}

App.addNavItem = function() {
  state.navItems.push({ label: '', href: '' });
  renderNavItems(state.navItems);
};
App.updateNavItem = function(i, key, val) {
  state.navItems[i][key] = val;
  // Clear nav error as soon as there is at least one item
  if (state.navItems.length > 0) {
    const navErrEl = document.getElementById('nav-items-error');
    if (navErrEl) navErrEl.style.display = 'none';
  }
};
App.removeNavItem = function(i) {
  state.navItems.splice(i, 1);
  renderNavItems(state.navItems);
};

// ── Footer Links ──

function renderFooterLinks(items) {
  state.footerLinks = [...items];
  const list = document.getElementById('footer-links-list');
  if (!list) return;
  list.innerHTML = '';
  state.footerLinks.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'nav-item-row';
    row.innerHTML = \`
      <input type="text" placeholder="Label (e.g. Privacy Policy)" value="\${esc(item.label)}" onchange="App.updateFooterLink(\${i}, 'label', this.value)"/>
      <input type="text" placeholder="URL (e.g. /privacy-policy/)" value="\${esc(item.href)}" onchange="App.updateFooterLink(\${i}, 'href', this.value)"/>
      <button class="nav-item-remove" onclick="App.removeFooterLink(\${i})">×</button>\`;
    list.appendChild(row);
  });
}

App.addFooterLink = function() {
  state.footerLinks.push({ label: '', href: '' });
  renderFooterLinks(state.footerLinks);
};
App.updateFooterLink = function(i, key, val) {
  state.footerLinks[i][key] = val;
};
App.removeFooterLink = function(i) {
  state.footerLinks.splice(i, 1);
  renderFooterLinks(state.footerLinks);
};

// ── Footer Service / Useful Links ──

function renderFooterServiceLinks(items) {
  state.footerServiceLinks = [...items];
  const list = document.getElementById('footer-service-links-list');
  if (!list) return;
  list.innerHTML = '';
  state.footerServiceLinks.forEach((item, i) => {
    const row = document.createElement('div');
    row.className = 'nav-item-row';
    row.innerHTML = \`
      <input type="text" placeholder="Label (e.g. Web Design)" value="\${esc(item.label)}" onchange="App.updateFooterServiceLink(\${i}, 'label', this.value)"/>
      <input type="text" placeholder="URL (e.g. /web-design/)" value="\${esc(item.href)}" onchange="App.updateFooterServiceLink(\${i}, 'href', this.value)"/>
      <button class="nav-item-remove" onclick="App.removeFooterServiceLink(\${i})">×</button>\`;
    list.appendChild(row);
  });
}

App.addFooterServiceLink = function() {
  state.footerServiceLinks.push({ label: '', href: '' });
  renderFooterServiceLinks(state.footerServiceLinks);
};
App.updateFooterServiceLink = function(i, key, val) {
  state.footerServiceLinks[i][key] = val;
};
App.removeFooterServiceLink = function(i) {
  state.footerServiceLinks.splice(i, 1);
  renderFooterServiceLinks(state.footerServiceLinks);
};

// ── Skip logo toggle ──

App.onSkipLogoChange = function() {
  const skip = document.getElementById('skipLogo')?.checked;
  const logoInput = document.getElementById('logoUrl');
  if (logoInput) {
    logoInput.disabled = !!skip;
    logoInput.style.opacity = skip ? '0.4' : '1';
  }
};

// ═══════════════════════════════════════════════════════════════════
// Stage 2 — Campaign Setup
// ═══════════════════════════════════════════════════════════════════

async function loadCityList() {
  try {
    const res = await apiFetch('/api/area-engine/cities');
    const data = await res.json();
    const sel = document.getElementById('cityName');
    sel.innerHTML = '<option value="">— Select a city —</option>';
    (data.cities || []).forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.name;
      opt.textContent = c.name;
      sel.appendChild(opt);
    });
    // Pre-fill all Stage 2 fields from session / campaign record
    if (state.campaign?.cityName)    setVal('cityName',    state.campaign.cityName);
    if (state.campaign?.serviceName) setVal('serviceName', state.campaign.serviceName);
    if (state.campaign?.serviceKey)  setVal('serviceKey',  state.campaign.serviceKey);
    if (state.campaign?.hubUrl)      setVal('hubUrl',      state.campaign.hubUrl);
    if (state.campaign?.moneyPageUrl) setVal('moneyPageUrl', state.campaign.moneyPageUrl);
    if (state.campaign?.focusKeyword) setVal('focusKeyword', state.campaign.focusKeyword);
    if (state.campaign?.maxPriorityAreas)   setVal('maxPriorityAreas',   String(state.campaign.maxPriorityAreas));
    if (state.campaign?.maxSecondaryAreas)  setVal('maxSecondaryAreas',  String(state.campaign.maxSecondaryAreas));
    if (typeof state.campaign?.includeSecondary === 'boolean') {
      const el = document.getElementById('includeSecondary');
      if (el) el.checked = state.campaign.includeSecondary;
    }
  } catch (e) { /* ignore */ }
}

// Auto-derive service key from service name, and auto-populate money page URL from serviceKey
document.addEventListener('DOMContentLoaded', () => {
  const svcName = document.getElementById('serviceName');
  const svcKey = document.getElementById('serviceKey');
  const moneyPageUrlEl = document.getElementById('moneyPageUrl');

  function autoFillMoneyPageUrl(key) {
    if (!moneyPageUrlEl || moneyPageUrlEl._touched) return;
    const canonical = key.toLowerCase().replace(/[\\s-]+/g, '_').replace(/[^a-z0-9_]/g, '');
    const map = (state.project && state.project.serviceMoneyPages) ? state.project.serviceMoneyPages : {};
    const url = map[canonical] || '';
    if (url) moneyPageUrlEl.value = url;
  }

  if (svcName && svcKey) {
    svcName.addEventListener('input', () => {
      if (!svcKey._touched) {
        svcKey.value = svcName.value.toLowerCase().replace(/[\s_]+/g, '-').replace(/[^a-z0-9-]/g, '').replace(/-+/g, '-').replace(/^-+|-+$/g, '');
        autoFillMoneyPageUrl(svcKey.value);
      }
    });
    svcKey.addEventListener('input', () => {
      svcKey._touched = true;
      autoFillMoneyPageUrl(svcKey.value);
    });
  }
  if (moneyPageUrlEl) {
    moneyPageUrlEl.addEventListener('input', () => { moneyPageUrlEl._touched = true; });
  }
});

App.saveStage2 = async function() {
  const errs = [];
  if (!getVal('cityName')) errs.push(['f-cityName', 'Required']);
  if (!getVal('serviceName')) errs.push(['f-serviceName', 'Required']);
  if (!getVal('serviceKey')) errs.push(['f-serviceKey', 'Required']);
  if (errs.length) { errs.forEach(([f, m]) => setFieldError(f, m)); return false; }

  // For NEW campaigns only: check for an existing campaign with the same city + service
  if (!state.campaignId) {
    const slug       = state.project?.clientSlug;
    const cityName   = getVal('cityName');
    const serviceKey = getVal('serviceKey');
    const serviceName = getVal('serviceName');
    const errEl = document.getElementById('stage2-error');
    if (slug) {
      try {
        const res = await apiFetch('/api/campaigns/' + slug);
        if (res.ok) {
          const data = await res.json();
          const existing = (data.campaigns || []).find(c =>
            c.city.trim().toLowerCase()       === cityName.trim().toLowerCase() &&
            c.serviceKey.trim().toLowerCase() === serviceKey.trim().toLowerCase()
          );
          if (existing) {
            if (errEl) {
              errEl.textContent = 'A campaign for "' + cityName + ' \u2014 ' + serviceName + '" already exists. Resume or delete it from the campaign list instead of creating a duplicate.';
              errEl.classList.remove('hidden');
            }
            return false;
          }
        }
      } catch(_) { /* non-fatal — server will also block it */ }
    }
    if (errEl) errEl.classList.add('hidden');
  }

  const domain = state.project?.domain?.replace(/\\/$/, '') || '';
  const canonicalServiceKey = String(getVal('serviceKey') || getVal('serviceName') || '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  state.campaign = {
    cityName: getVal('cityName'),
    serviceName: getVal('serviceName'),
    serviceKey: canonicalServiceKey,
    maxPriorityAreas: parseInt(getVal('maxPriorityAreas') || '5', 10),
    maxSecondaryAreas: parseInt(getVal('maxSecondaryAreas') || '4', 10),
    includeSecondary: document.getElementById('includeSecondary').checked,
    hubUrl: getVal('hubUrl') || domain + '/',
    moneyPageUrl: getVal('moneyPageUrl') || '',
    focusKeyword: getVal('focusKeyword') || '',
  };

  // Update include secondary toggle on stage 5 to match
  document.getElementById('run-include-secondary').checked = state.campaign.includeSecondary;
  saveSession();
  // Create or update campaign record in the backend
  App.persistCampaignFromStage2();
  return true;
};

// ═══════════════════════════════════════════════════════════════════
// Stage 3 — Area Opportunity
// ═══════════════════════════════════════════════════════════════════

App.runAreaEngine = async function() {
  if (!state.campaign) { showStage(2); return; }
  document.getElementById('engine-loading').classList.remove('hidden');
  document.getElementById('engine-loaded').classList.add('hidden');

  const { cityName, serviceName, maxPriorityAreas, maxSecondaryAreas } = state.campaign;
  const url = \`/api/area-engine?city=\${enc(cityName)}&service=\${enc(serviceName)}&maxP=\${maxPriorityAreas}&maxS=\${maxSecondaryAreas}\`;

  try {
    const res = await apiFetch(url);
    const data = await res.json();
    if (!res.ok) { showError('stage3-error', data.error || 'Engine failed'); return; }
    state.engineOutput = data;
    await saveSession();
    renderAreaTable(data);
    document.getElementById('engine-loading').classList.add('hidden');
    document.getElementById('engine-loaded').classList.remove('hidden');
  } catch (e) {
    showError('stage3-error', 'Network error: ' + e.message);
    document.getElementById('engine-loading').classList.add('hidden');
  }
};

function renderAreaTable(output) {
  const areas = output.rankedAreas || [];
  const priority = areas.filter(a => a.tier === 'priority').length;
  const secondary = areas.filter(a => a.tier === 'secondary').length;
  const tertiary = areas.filter(a => a.tier === 'tertiary').length;
  const topScore = areas[0]?.score || 0;

  document.getElementById('engine-summary').innerHTML = \`
    <div class="engine-stat"><div class="engine-stat-value">\${areas.length}</div><div class="engine-stat-label">Total areas</div></div>
    <div class="engine-stat"><div class="engine-stat-value" style="color:var(--priority)">\${priority}</div><div class="engine-stat-label">Priority</div></div>
    <div class="engine-stat"><div class="engine-stat-value" style="color:var(--secondary)">\${secondary}</div><div class="engine-stat-label">Secondary</div></div>
    <div class="engine-stat"><div class="engine-stat-value">\${topScore}</div><div class="engine-stat-label">Top score / 100</div></div>
  \`;

  const tbody = document.getElementById('area-tbody');
  tbody.innerHTML = '';
  areas.forEach(a => {
    const checked = a.tier === 'priority' ? 'checked' : '';
    const tierClass = 'badge-' + a.tier;
    const fillPct = Math.round(a.score);
    const tr = document.createElement('tr');
    tr.innerHTML = \`
      <td style="font-weight:700;color:var(--muted)">\${a.rank}</td>
      <td style="font-weight:600">\${esc(a.area)}</td>
      <td>
        <div class="flex gap-2" style="align-items:center">
          <span style="font-weight:700;min-width:28px">\${a.score}</span>
          <div class="score-bar"><div class="score-bar-fill" style="width:\${fillPct}%"></div></div>
        </div>
      </td>
      <td><span class="badge \${tierClass}">\${a.tier}</span></td>
      <td class="mono text-sm">\${esc(a.postcode)}</td>
      <td><span class="badge" style="background:\${demandColor(a.searchDemand)}">\${a.searchDemand}</span></td>
      <td><span class="badge" style="background:\${compColor(a.competition)}">\${a.competition}</span></td>
      <td><span class="badge" style="background:\${affColor(a.affluenceTier)}">\${a.affluenceTier}</span></td>
      <td><input type="checkbox" \${checked} data-area="\${esc(a.area)}" onchange="updateSelectionCount()"/></td>
    \`;
    tbody.appendChild(tr);
  });
  updateSelectionCount();
}

function demandColor(d) { return d==='high'?'#dcfce7':d==='medium'?'#fef3c7':'#f1f5f9'; }
function compColor(c) { return c==='low'?'#dcfce7':c==='medium'?'#fef3c7':'#fee2e2'; }
function affColor(a) { return a==='premium'?'#ede9fe':a==='professional'?'#dbeafe':a==='mixed'?'#fef3c7':'#f1f5f9'; }

function updateSelectionCount() {
  const n = document.querySelectorAll('#area-tbody input[type=checkbox]:checked').length;
  document.getElementById('selection-count').textContent = \`\${n} area\${n===1?'':'s'} selected\`;
}

App.selectAllPriority = function() {
  document.querySelectorAll('#area-tbody input[type=checkbox]').forEach(cb => {
    const area = cb.dataset.area;
    const ranked = state.engineOutput?.rankedAreas?.find(r => r.area === area);
    cb.checked = ranked?.tier === 'priority';
  });
  updateSelectionCount();
};

App.clearAllAreas = function() {
  document.querySelectorAll('#area-tbody input[type=checkbox]').forEach(cb => cb.checked = false);
  updateSelectionCount();
};

App.saveStage3 = async function() {
  const selected = Array.from(document.querySelectorAll('#area-tbody input[type=checkbox]:checked'))
    .map(cb => cb.dataset.area);

  if (!selected.length) {
    showError('stage3-error', 'Select at least one area before continuing.');
    return false;
  }

  const body = {
    cityName: state.campaign.cityName,
    serviceName: state.campaign.serviceName,
    serviceKey: state.campaign.serviceKey,
    selectedAreaNames: selected,
    projectDomain: state.project.domain,
    clientSlug: state.project.clientSlug,
    maxPriorityAreas: state.campaign.maxPriorityAreas,
    maxSecondaryAreas: state.campaign.maxSecondaryAreas,
    campaignId: state.campaignId || undefined,
  };

  try {
    const res = await apiFetch('/api/selected-areas', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) { showError('stage3-error', data.error || 'Failed to save areas'); return false; }
    state.selectedAreaDefs = data.defs;
    await saveSession();
    return true;
  } catch (e) {
    showError('stage3-error', 'Network error: ' + e.message);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════
// Stage 4 — Keyword Configuration
// ═══════════════════════════════════════════════════════════════════

function renderSuggestionPanelHtml(area, idx) {
  var suggestions = state.kwSuggestions && state.kwSuggestions[area];
  if (!suggestions || suggestions.length === 0) return '';
  var existing = new Set((state.keywordOverrides[area] && state.keywordOverrides[area].supportingKeywords || []).map(function(k) { return k.toLowerCase(); }));
  var chips = suggestions.map(function(kw) {
    var isAdded = existing.has(kw.toLowerCase());
    var onclick = isAdded ? '' : ' onclick="App.addSuggestedKeyword(this)"';
    return '<button type="button" class="kw-chip' + (isAdded ? ' kw-chip--added' : '') + '"'
      + ' data-idx="' + idx + '" data-kw="' + esc(kw) + '"'
      + onclick + (isAdded ? ' disabled' : '') + '>'
      + (isAdded ? '&#10003; ' : '+ ') + esc(kw) + '</button>';
  }).join('');
  return '<div class="kw-suggest-result">'
    + '<div class="kw-suggest-label">Suggested keywords — click to add</div>'
    + '<div class="kw-chips">' + chips + '</div>'
    + '</div>';
}

function renderKeywordCards() {
  const wrap = document.getElementById('kw-cards');
  if (!state.selectedAreaDefs?.length) {
    wrap.innerHTML = '<div class="alert alert-warn">No areas selected. Go back to Stage 3.</div>';
    return;
  }

  wrap.innerHTML = '';
  state.selectedAreaDefs.forEach((def, idx) => {
    const override = state.keywordOverrides[def.area] || {
      primaryKeyword: def.primaryKeyword,
      supportingKeywords: [...def.supportingKeywords],
      keywordsCustomised: false,
    };
    state.keywordOverrides[def.area] = override;

    const open = idx < state.campaign.maxPriorityAreas ? 'open' : '';
    const card = document.createElement('div');
    card.className = \`kw-card \${open}\`;
    card.id = \`kw-card-\${idx}\`;
    card.innerHTML = \`
      <div class="kw-card-header" onclick="toggleKwCard(\${idx})">
        <span class="kw-card-title">\${esc(def.area)}</span>
        <span class="badge badge-\${def.tier}">\${def.tier}</span>
        <span class="text-muted text-sm" style="font-weight:400">score \${def.score}</span>
        <span style="color:var(--muted);font-size:1rem;margin-left:auto" id="kw-chevron-\${idx}">\${open?'▲':'▼'}</span>
      </div>
      <div class="kw-card-body">
        <div class="field" style="margin-bottom:14px">
          <label>Focus keyword (H1 / title tag)</label>
          <input type="text" id="pk-\${idx}" value="\${esc(override.primaryKeyword)}"
            onchange="App.updatePrimaryKeyword(\${idx}, this.value)"
            onblur="App.warnCityInKeyword(\${idx})"/>
          <span class="field-hint">Do not append the parent city — clusters target the sub-area only.</span>
          <span class="field-error" id="pk-err-\${idx}"></span>
        </div>
        <div class="field">
          <label>Supporting keywords</label>
          <div class="tag-editor" id="tags-\${idx}" onclick="document.getElementById('tag-input-\${idx}').focus()">
            \${override.supportingKeywords.map((kw, ki) =>
              \`<span class="tag">\${esc(kw)}<button class="tag-remove" onclick="App.removeTag(\${idx},\${ki})" type="button">×</button></span>\`
            ).join('')}
            <input class="tag-input" id="tag-input-\${idx}" placeholder="Add keyword, press Enter"
              onkeydown="App.handleTagInput(event, \${idx})" type="text"/>
          </div>
          <span class="field-hint">1–5 keywords. Press Enter to add. Click × to remove.</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;margin-top:8px;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="App.resetKeywords(\${idx})" type="button">↺ Reset to defaults</button>
          <button class="btn btn-ghost btn-sm" id="kw-suggest-btn-\${idx}" onclick="App.suggestKeywords(\${idx})" type="button">✦ Suggest keywords</button>
        </div>
        <div id="kw-suggest-panel-\${idx}">\${renderSuggestionPanelHtml(def.area, idx)}</div>
      </div>
    \`;
    wrap.appendChild(card);
  });
}

function toggleKwCard(idx) {
  const card = document.getElementById(\`kw-card-\${idx}\`);
  card.classList.toggle('open');
  document.getElementById(\`kw-chevron-\${idx}\`).textContent = card.classList.contains('open') ? '▲' : '▼';
}

App.updatePrimaryKeyword = function(idx, val) {
  const area = state.selectedAreaDefs[idx].area;
  state.keywordOverrides[area].primaryKeyword = val;
  state.keywordOverrides[area].keywordsCustomised = true;
};

App.warnCityInKeyword = function(idx) {
  const area = state.selectedAreaDefs[idx].area;
  const city = state.campaign?.cityName || '';
  const kw = state.keywordOverrides[area]?.primaryKeyword || '';
  const errEl = document.getElementById(\`pk-err-\${idx}\`);
  const field = document.getElementById(\`pk-\${idx}\`).closest('.field');
  if (city && kw.toLowerCase().includes(city.toLowerCase())) {
    errEl.textContent = 'Including the parent city in a cluster keyword reduces topical focus. Are you sure?';
    errEl.style.display = 'block';
    field.classList.add('has-error');
  } else {
    errEl.style.display = 'none';
    field.classList.remove('has-error');
  }
};

App.removeTag = function(idx, ki) {
  const area = state.selectedAreaDefs[idx].area;
  state.keywordOverrides[area].supportingKeywords.splice(ki, 1);
  state.keywordOverrides[area].keywordsCustomised = true;
  renderKeywordCards();
};

App.handleTagInput = function(e, idx) {
  if (e.key !== 'Enter' && e.key !== ',') return;
  e.preventDefault();
  const input = document.getElementById(\`tag-input-\${idx}\`);
  const val = input.value.trim().replace(/,$/, '');
  if (!val) return;
  const area = state.selectedAreaDefs[idx].area;
  const kws = state.keywordOverrides[area].supportingKeywords;
  if (kws.length >= 5) { alert('Maximum 5 supporting keywords per area.'); return; }
  kws.push(val);
  state.keywordOverrides[area].keywordsCustomised = true;
  renderKeywordCards();
};

App.resetKeywords = function(idx) {
  const def = state.selectedAreaDefs[idx];
  state.keywordOverrides[def.area] = {
    primaryKeyword: def.primaryKeyword,
    supportingKeywords: [...def.supportingKeywords],
    keywordsCustomised: false,
  };
  delete state.kwSuggestions[def.area];
  renderKeywordCards();
};

App.suggestKeywords = async function(idx) {
  const def  = state.selectedAreaDefs[idx];
  const area = def.area;
  const ov   = state.keywordOverrides[area] || {};

  const btn   = document.getElementById('kw-suggest-btn-' + idx);
  const panel = document.getElementById('kw-suggest-panel-' + idx);

  if (btn) { btn.disabled = true; btn.textContent = '✦ Suggesting…'; }
  if (panel) { panel.innerHTML = '<div class="kw-suggest-loading">Generating keyword suggestions…</div>'; }

  try {
    const res  = await apiFetch('/api/suggest-keywords', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({
        service:          state.campaign?.serviceName || state.campaign?.serviceKey || '',
        location:         state.campaign?.cityName || '',
        area:             area,
        primaryKeyword:   ov.primaryKeyword || def.primaryKeyword || '',
        existingKeywords: ov.supportingKeywords || [],
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Request failed');

    const suggestions = data.suggestions || [];
    state.kwSuggestions = state.kwSuggestions || {};
    state.kwSuggestions[area] = suggestions;

    if (panel) {
      if (suggestions.length === 0) {
        panel.innerHTML = '<div class="kw-suggest-result"><div class="kw-suggest-label">No new suggestions available — try adjusting the focus keyword.</div></div>';
      } else {
        panel.innerHTML = renderSuggestionPanelHtml(area, idx);
      }
    }
  } catch(e) {
    if (panel) { panel.innerHTML = '<div class="kw-suggest-error">Could not load suggestions: ' + esc(e.message) + '</div>'; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '✦ Suggest keywords'; }
  }
};

App.addSuggestedKeyword = function(btn) {
  const idx  = parseInt(btn.dataset.idx, 10);
  const kw   = btn.dataset.kw;
  const area = state.selectedAreaDefs[idx].area;
  const ov   = state.keywordOverrides[area];
  if (!ov) return;
  if (ov.supportingKeywords.length >= 5) { alert('Maximum 5 supporting keywords per area.'); return; }

  ov.supportingKeywords.push(kw);
  ov.keywordsCustomised = true;

  // Insert tag into the editor without wiping the suggestion panel
  const tagsDiv = document.getElementById('tags-' + idx);
  const input   = document.getElementById('tag-input-' + idx);
  if (tagsDiv && input) {
    const ki     = ov.supportingKeywords.length - 1;
    const tag    = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = esc(kw) + '<button class="tag-remove" onclick="App.removeTag(' + idx + ',' + ki + ')" type="button">\xd7</button>';
    tagsDiv.insertBefore(tag, input);
  }

  // Re-render just the suggestion panel to mark this chip as added
  const panel = document.getElementById('kw-suggest-panel-' + idx);
  if (panel) { panel.innerHTML = renderSuggestionPanelHtml(area, idx); }
};

App.saveStage4 = function() {
  // Merge overrides back into defs
  state.selectedAreaDefs = state.selectedAreaDefs.map(def => {
    const ov = state.keywordOverrides[def.area];
    if (!ov) return def;
    return { ...def, primaryKeyword: ov.primaryKeyword, supportingKeywords: ov.supportingKeywords, keywordsCustomised: ov.keywordsCustomised };
  });
  saveSession();
  return true;
};

// ═══════════════════════════════════════════════════════════════════
// Stage 5 — Image Generation
// ═══════════════════════════════════════════════════════════════════

function getServiceKey() {
  // Active campaign must take priority over project default service.
  // Return canonical hyphen service keys used by image library folders.
  const raw = (
    state.campaign?.serviceKey ||
    state.campaign?.serviceName ||
    state.project?.services?.[0]?.key ||
    state.project?.serviceKey ||
    state.project?.serviceName ||
    'web-design'
  ).toString().trim().toLowerCase();

  const norm = raw
    .replace(/[^a-z0-9\s_-]+/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '');

  const fixes = {
    'web-de-ign': 'web-design',
    'web-ho-ting': 'web-hosting',
    'local--eo': 'local-seo',
    'local-eo': 'local-seo',
    'localseo': 'local-seo',
    'local_seo': 'local-seo',
    'emailmarketing': 'email-marketing',
    'email_marketing': 'email-marketing',
    'email marketing': 'email-marketing'
  };

  return fixes[norm] || norm;
}

function resolveActiveCampaignContext() {
  const clientSlug = state.project?.clientSlug || '';

  let campaignSlug =
    state.campaign?.slug ||
    state.campaign?.campaignSlug ||
    state.campaignId ||
    '';

  if (state.campaignId && Array.isArray(state._campaignMeta)) {
    const active = state._campaignMeta.find(x => x.id === state.campaignId);
    if (active?.slug) campaignSlug = active.slug;
  }

  const slug = campaignSlug || clientSlug;

  return {
    slug,
    campaignSlug,
    clientSlug,
    campaignId: state.campaignId || '',
    serviceKey: getServiceKey(),
    serviceName: state.campaign?.serviceName || state.project?.serviceName || '',
    cityName: state.campaign?.cityName || '',
    primaryKeyword: state.campaign?.primaryKeyword || state.campaign?.focusKeyword || state.project?.primaryKeyword || ''
  };
}

function getImageRole(slot) {
  // Maps the 4 wizard image slots to the most appropriate AI image role
  if (slot === 'hero')       return 'heroImage';
  if (slot === 'trust')      return 'trustImage';
  if (slot === 'conversion') return 'conversionImage';
  // support slot defaults to earlySupportImage (service-in-action)
  return 'earlySupportImage';
}

App.checkImageStatus = async function() {
  // Full refresh — delegates to loadImageStatuses which populates preview + diagnostics
  await App.loadImageStatuses();
};

function _updateSrcDebug(slot, img, caller) {
  const dbg = document.getElementById(\`img-src-debug-\${slot}\`);
  if (!dbg) return;
  const ts = new Date().toISOString();
  const actualSrc = img ? img.src : '—';
  dbg.style.display = 'block';
  dbg.innerHTML =
    '<strong>VISIBLE CARD SRC:</strong> ' + actualSrc + '<br>' +
    '<strong>LAST CARD RENDERED:</strong> ' + ts + ' (by ' + caller + ')';
  console.log('[IMG-PREVIEW] slot=' + slot + ' caller=' + caller + ' src=' + actualSrc + ' ts=' + ts);
}

function updateImagePreview(slot, src, statusText, caller) {
  const _caller = caller || 'updateImagePreview';
  const _ts     = new Date().toISOString();
  console.log('[updateImagePreview] ENTER slot=' + slot + ' src=' + src + ' caller=' + _caller + ' ts=' + _ts);

  const wrap     = document.getElementById(\`img-preview-wrap-\${slot}\`);
  const linkWrap = document.getElementById(\`img-open-link-wrap-\${slot}\`);
  const linkEl   = document.getElementById(\`img-open-link-\${slot}\`);

  if (!wrap) {
    console.warn('[updateImagePreview] wrap NOT FOUND for slot=' + slot);
    return;
  }

  if (src) {
    const imgId = \`img-preview-img-\${slot}\`;
    const errId = \`img-preview-err-\${slot}\`;

    // Build elements programmatically — attach onload/onerror BEFORE setting src
    // (innerHTML sets src at parse time, which can fire load events before handlers are attached)
    const errDiv = document.createElement('div');
    errDiv.id = errId;
    errDiv.style.cssText = 'display:none;position:absolute;inset:0;z-index:3;background:#fee2e2;flex-direction:column;align-items:center;justify-content:center;font-size:.75rem;color:#991b1b;padding:8px;text-align:center';

    const newImg = document.createElement('img');
    newImg.id  = imgId;
    newImg.alt = slot;
    newImg.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;position:absolute;inset:0;z-index:2;background:transparent';

    // Handlers attached BEFORE src is set — guaranteed to fire
    newImg.onload  = function() {
      console.log('[updateImagePreview] IMAGE LOADED slot=' + slot + ' src=' + newImg.src);
      _updateSrcDebug(slot, newImg, _caller + '→onload');
    };
    newImg.onerror = function() {
      console.error('[updateImagePreview] IMAGE FAILED slot=' + slot + ' src=' + newImg.src);
      newImg.style.display = 'none';
      errDiv.style.display = 'flex';
      errDiv.innerHTML = 'Preview failed to load<br><span style="font-size:.65rem;word-break:break-all;margin-top:4px;color:#7f1d1d">' + newImg.src + '</span>';
      _updateSrcDebug(slot, newImg, _caller + '→onerror');
    };

    // Set src now — triggers the load, handlers already in place
    newImg.src = src;

    // Swap into DOM
    wrap.innerHTML = '';
    wrap.appendChild(newImg);
    wrap.appendChild(errDiv);

    // Immediate readback (shows src before load completes)
    _updateSrcDebug(slot, newImg, _caller);

    if (linkWrap) linkWrap.style.display = 'block';
    if (linkEl)   linkEl.href = src;
  } else {
    // No image — restore placeholder
    wrap.innerHTML = \`<span id="img-preview-label-\${slot}" style="font-size:.8rem;color:var(--muted);position:relative;z-index:1">No image</span>\`;
    if (linkWrap) linkWrap.style.display = 'none';
    _updateSrcDebug(slot, null, _caller + '→cleared');
  }

  const statusEl = document.getElementById(\`img-status-\${slot}\`);
  if (statusEl && statusText !== null) {
    statusEl.textContent = statusText || '✓ Image ready';
    statusEl.style.color = 'var(--success)';
  }
}

// ── Image approval badge helper ──
function setApprovalBadge(slot, status, source) {
  const badge = document.getElementById(\`img-approval-badge-\${slot}\`);
  if (!badge) return;
  const map = {
    approved:     { text: '✓ Approved',   bg: '#dcfce7', color: '#166534' },
    rejected:     { text: '✗ Rejected',   bg: '#fee2e2', color: '#991b1b' },
    generated:    { text: '⏳ Review',     bg: '#fef9c3', color: '#713f12' },
    uploaded:     { text: '📁 Uploaded',  bg: '#eff6ff', color: '#1e40af' },
    needs_review: { text: '⚠ Review',     bg: '#fff7ed', color: '#9a3412' },
  };
  const s = map[status] || { text: 'Empty', bg: '#f1f5f9', color: 'var(--muted)' };
  badge.textContent = source === 'upload' ? '📁 Uploaded' : s.text;
  badge.style.background = source === 'upload' ? '#eff6ff' : s.bg;
  badge.style.color = source === 'upload' ? '#1e40af' : s.color;
  // Show/hide approval row
  const approvalRow = document.getElementById(\`img-approval-row-\${slot}\`);
  if (approvalRow) {
    approvalRow.style.display = (status === 'generated' || status === 'needs_review') ? 'grid' : 'none';
  }
}

App.generateImage = async function(slot) {
  let slug = state.campaignId || state.project?.clientSlug || '';

  if (state.campaignId && Array.isArray(state._campaignMeta)) {
    const active = state._campaignMeta.find(x => x.id === state.campaignId);
    if (active?.slug) slug = active.slug;
  }

  console.log('[generateImage] resolved slug=' + slug + ' campaignId=' + state.campaignId + ' serviceKey=' + getServiceKey());

  if (!slug) { alert('No active campaign or project loaded. Resume/create a campaign first.'); return; }

  const imageMode = state.project?.imageMode;
  if (imageMode === 'own' || imageMode === 'skip') {
    alert('AI image generation is disabled for this project.\\nChange the Image Mode in Stage 1 to "AI" or "Mixed".');
    return;
  }

  const btn    = document.getElementById(\`img-btn-\${slot}\`);
  const status = document.getElementById(\`img-status-\${slot}\`);
  const prompt = document.getElementById(\`img-prompt-\${slot}\`)?.value?.trim() || '';

  btn.disabled = true;
  btn.textContent = 'Generating…';
  status.textContent = 'Calling Ideogram AI…';
  status.style.color = 'var(--muted)';

  try {
    const res = await apiFetch('/api/images/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug,
        serviceKey:          getServiceKey(),
        slot,
        prompt:              prompt || undefined,
        imageRole:           getImageRole(slot),
        primaryKeyword:      state.project?.primaryKeyword || state.campaign?.primaryKeyword || undefined,
        shortPageDescription: state.campaign?.serviceName || undefined,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Generation failed');
    if (!data.ok || !data.serveUrl) {
      // Library mode with no stock image for this service type — leave slot blank, no error
      status.textContent = 'No stock image for this service type';
      status.style.color = 'var(--muted)';
      return;
    }
    console.log('[generateImage] success slot=' + slot + ' serveUrl=' + data.serveUrl);

    // Auto-assign to slot immediately (same as upload flow does).
    // This saves the file to the service-specific dir and records serviceKey in
    // image-meta.json so the rollout can locate the exact file without guessing.
    try {
      await apiFetch('/api/images/assign-to-slot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          slot,
          source:     'ai_generated',
          imageId:    'ai-' + slot,
          altText:    slot + ' image for ' + (state.project?.businessName || slug),
          serviceKey: getServiceKey(),
        }),
      });
      console.log('[generateImage] auto-assigned slot=' + slot + ' serviceKey=' + getServiceKey());
    } catch (ae) {
      console.warn('[generateImage] auto-assign failed (non-fatal):', ae.message);
    }

    updateImagePreview(slot, \`\${data.serveUrl}?ts=\${Date.now()}\`, null, 'generateImage');
    setApprovalBadge(slot, 'approved', 'ai');
    status.textContent = '✓ Saved — ready for rollout';
    status.style.color = 'var(--success)';
  } catch (e) {
    status.textContent = '✗ ' + e.message;
    status.style.color = 'var(--danger)';
  } finally {
    btn.disabled = false;
    btn.textContent = '🔄 Regenerate';
  }
};

App.uploadImage = async function(slot, input) {
  const ctx = resolveActiveCampaignContext();
  const slug = ctx.slug;
  if (!slug) { alert('No active campaign or project loaded.'); return; }
  const file = input.files[0];
  if (!file) return;
  console.log('[uploadImage] START slot=' + slot + ' file=' + file.name + ' size=' + file.size + ' ts=' + new Date().toISOString());
  const status = document.getElementById(\`img-status-\${slot}\`);

  // Client-side pre-validation
  var ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (file.type && !ALLOWED_IMAGE_TYPES.includes(file.type)) {
    status.textContent = '✗ Unsupported format. Please upload JPG, PNG, or WebP only.';
    status.style.color = 'var(--danger)';
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    status.textContent = '✗ Image exceeds 20MB limit. Please upload a smaller file.';
    status.style.color = 'var(--danger)';
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    status.textContent = 'Uploading large file and optimising…';
  } else {
    status.textContent = 'Uploading and optimising…';
  }
  status.style.color = 'var(--muted)';
  try {
    // Step 1: Upload to library (server processes all 4 sizes with Sharp)
    const fd = new FormData();
    fd.append('slug', slug);
    fd.append('file', file);
    fd.append('category', slot);
    fd.append('altText', slot + ' image for ' + (state.project?.businessName || slug));
    const res = await apiFetch('/api/images/upload', { method: 'POST', body: fd });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    // Step 2: Immediately assign to this slot (copies to assets/ and updates image-meta.json)
    status.textContent = 'Saving to slot…';
    const assignRes = await apiFetch('/api/images/assign-to-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        slug, slot,
        source: 'uploaded',
        imageId: data.image.filename,
        altText: data.image.altText || '',
        serviceKey: getServiceKey(),
      }),
    });
    const assignData = await assignRes.json();
    if (!assignRes.ok) throw new Error(assignData.error || 'Assign failed');

    // Step 3: Show server-side URL (not blob URL — persists on refresh)
    // loadImageStatuses will set the preview with correct cache-busting and update per-slot diagnostics
    var dimInfo = data.image?.width && data.image?.height ? ' (' + data.image.width + '×' + data.image.height + ')' : '';
    status.textContent = '✓ Optimised & saved: ' + file.name + dimInfo;
    status.style.color = 'var(--success)';
    await App.loadImageStatuses();
  } catch(e) {
    status.textContent = '✗ ' + e.message;
    status.style.color = 'var(--danger)';
  }
};

App.approveImage = async function(slot, status) {
  const slug = state.project?.clientSlug;
  console.log('[approveImage] slot=' + slot + ' status=' + status + ' ts=' + new Date().toISOString());
  if (!slug) return;
  try {
    const res = await apiFetch('/api/images/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, slot, status }),
    });
    const data = await res.json();
    if (res.ok && data.ok) {
      if (status === 'approved') {
        // Auto-assign on approval so image-meta.json gains a serviceKey and the
        // rollout can locate this image without fuzzy guessing.
        try {
          await apiFetch('/api/images/assign-to-slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug,
              slot,
              source:     'ai_generated',
              imageId:    'ai-' + slot,
              altText:    slot + ' image for ' + (state.project?.businessName || slug),
              serviceKey: getServiceKey(),
            }),
          });
        } catch (ae) {
          console.warn('[approveImage] auto-assign failed (non-fatal):', ae.message);
        }
      }
      setApprovalBadge(slot, status, 'ai');
      const st = document.getElementById(\`img-status-\${slot}\`);
      if (st) {
        st.textContent = status === 'approved' ? '✓ Saved — ready for rollout' : '✗ Rejected — regenerate or upload a replacement';
        st.style.color = status === 'approved' ? 'var(--success)' : 'var(--danger)';
      }
    }
  } catch(e) { /* silently fail */ }
};

// ── Image Library ──────────────────────────────────────────────────────────

App._libraryImages = {};
App._concurrency = 1;

App.toggleImageLibrary = async function(slot) {
  const panel = document.getElementById(\`img-lib-\${slot}\`);
  if (!panel) return;
  const isOpen = panel.style.display !== 'none';
  if (isOpen) {
    panel.style.display = 'none';
  } else {
    panel.style.display = 'block';
    await App.loadImageLibrary(slot);
  }
};

App.loadImageLibrary = async function(slot) {
  const ctx = resolveActiveCampaignContext();
  const slug = ctx.slug;
  if (!slug) { alert('No active campaign or project loaded.'); return; }
  const grid = document.getElementById(\`img-lib-grid-\${slot}\`);
  if (!grid) return;
  grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);font-size:.78rem;text-align:center;padding:8px">Loading…</div>';
  try {
    // Pass service filter so pack images matching this campaign\'s trade are included.
    // Prefer serviceKey from campaign state; fall back to cid so server can self-resolve.
    let libUrl = '/api/images/library/' + slug;
    const svcKey = getServiceKey();
    if (svcKey) {
      libUrl += '?service=' + encodeURIComponent(svcKey === 'web-de-ign' ? 'web-design' : svcKey);
    } else if (state.campaignId) {
      libUrl += '?cid=' + encodeURIComponent(state.campaignId);
    }
    console.log('[loadImageLibrary] slot=' + slot + ' slug=' + slug + ' libUrl=' + libUrl);
    const res = await apiFetch(libUrl);
    if (!res.ok) throw new Error('Could not load library');
    const data = await res.json();
    App._libraryImages[slot] = data.images || [];
    App.renderLibraryGrid(slot, 'all');
  } catch (e) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:var(--danger);font-size:.78rem;text-align:center;padding:8px">Failed to load library</div>';
  }
};

App.filterLibrary = function(slot, filter, btn) {
  // Update active filter button
  const filterBar = document.getElementById(\`img-lib-filter-\${slot}\`);
  if (filterBar) {
    filterBar.querySelectorAll('.lib-filter-btn').forEach(function(b) { b.classList.remove('active'); });
  }
  if (btn) btn.classList.add('active');
  App.renderLibraryGrid(slot, filter);
};

App.renderLibraryGrid = function(slot, filter) {
  const grid = document.getElementById(\`img-lib-grid-\${slot}\`);
  if (!grid) return;
  const all = App._libraryImages[slot] || [];
  let imgs = all;
  if (filter === 'uploaded')    imgs = all.filter(function(i) { return i.source === 'uploaded'; });
  if (filter === 'ai_generated') imgs = all.filter(function(i) { return i.source === 'ai_generated'; });
  if (filter === 'approved')    imgs = all.filter(function(i) { return i.approvalStatus === 'approved'; });

  if (!imgs.length) {
    grid.innerHTML = '<div style="grid-column:1/-1;color:var(--muted);font-size:.78rem;text-align:center;padding:16px">No images found. Generate or upload one above.</div>';
    return;
  }

  // Suitability thresholds per slot
  var SUIT_THRESHOLDS = { hero: { ideal: 1600, warn: 1200 }, support: { ideal: 1200, warn: 800 }, conversion: { ideal: 1200, warn: 800 } };

  imgs = imgs.slice(0, 9);

  grid.innerHTML = imgs.map(function(img) {
    const isAI      = img.source === 'ai_generated';
    const isPack    = img.source === 'image_pack';
    const badgeBg   = isPack ? '#ede9fe' : isAI ? '#dbeafe' : '#dcfce7';
    const badgeCol  = isPack ? '#6d28d9' : isAI ? '#1d4ed8' : '#166534';
    const badgeTxt  = isPack ? 'Pack' : isAI ? 'AI' : 'Upload';
    const label     = (img.originalName || img.fileName || img.category || 'image').replace(/'/g, '');
    const altTxt    = (img.altText || '').replace(/'/g, '');
    const viewUrl   = img.imageUrl || '';
    const thumbUrl  = img.thumbnailUrl || viewUrl;
    const safeId    = (img.imageId || '').replace(/'/g, '');
    const safeSrc   = (img.source || '').replace(/'/g, '');

    // Size info folded into badge so cards stay uniform height
    const sizeTxt = img.size ? (img.size >= 1048576 ? (img.size / 1048576).toFixed(1) + 'MB' : Math.round(img.size / 1024) + 'KB') : '';
    const metaHtml = '';

    // Suitability indicator (only for slots with thresholds, only for images with width data)
    var suitHtml = '';
    if (img.width && SUIT_THRESHOLDS[slot]) {
      var t = SUIT_THRESHOLDS[slot];
      if (img.width < t.warn) {
        suitHtml = '<div style="font-size:.62rem;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;border-radius:3px;padding:2px 6px;margin:2px 6px 3px;line-height:1.3">'
          + '⚠ Too small for this slot (' + img.width + 'px — min ' + t.warn + 'px)'
          + '</div>';
      } else if (img.width < t.ideal) {
        suitHtml = '<div style="font-size:.62rem;color:#b45309;background:#fffbeb;border:1px solid #fde68a;border-radius:3px;padding:2px 6px;margin:2px 6px 3px;line-height:1.3">'
          + '⚠ Below ideal for this slot (' + img.width + 'px — ideal ' + t.ideal + 'px)'
          + '</div>';
      }
    }

    const isSelected = (App._selectedLibImg[slot] === safeId);
    const btnCls  = isSelected ? 'lib-img-select selected' : 'lib-img-select';
    const btnTxt  = isSelected ? 'Remove' : 'Select';
    const btnClick = isSelected
      ? 'App.removeSlotImage(this,\\'' + slot + '\\')'
      : 'App.assignFromLibrary(this,\\'' + slot + '\\',\\'' + viewUrl + '\\',\\'' + altTxt + '\\',\\'' + safeSrc + '\\',\\'' + safeId + '\\')';

    return '<div class="lib-img-card" style="' + (isSelected ? 'box-shadow:0 0 0 2px #ef4444;' : '') + '">'
      + '<div class="lib-img-thumb" onclick="window.open(\\'' + viewUrl + '\\',\\'_blank\\')" title="View full image">'
      + '<img src="' + thumbUrl + '?ts=' + Date.now() + '" loading="lazy" onerror="this.style.opacity=.3"/>'
      + '<span class="lib-img-badge" style="background:' + badgeBg + ';color:' + badgeCol + '">' + badgeTxt + '</span>'
      + '</div>'
      + '<div class="lib-img-name" title="' + label + '">' + label + '</div>'
      + metaHtml
      + suitHtml
      + '<button class="' + btnCls + '" onclick="' + btnClick + '">' + btnTxt + '</button>'
      + '</div>';
  }).join('');
};

App._selectedLibImg = App._selectedLibImg || {};

App.assignFromLibrary = async function(btnEl, slot, imageUrl, altText, source, imageId) {
  const urlCampaign = new URLSearchParams(window.location.search).get('campaign') || '';

  const campaignSlug = (
    state.campaign?.slug ||
    state.campaign?.campaignSlug ||
    state.campaignId ||
    urlCampaign ||
    ''
  ).toString().trim();

  const slug = campaignSlug || state.project?.clientSlug;
  console.log('[assignFromLibrary] START slot=' + slot + ' source=' + source + ' imageId=' + imageId + ' ts=' + new Date().toISOString());
  if (!slug) return;
  const statusEl = document.getElementById(\`img-status-\${slot}\`);
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.className = 'lib-img-select loading';
    btnEl.textContent = '…';
  }
  if (statusEl) { statusEl.textContent = 'Assigning…'; statusEl.style.color = 'var(--muted)'; }
  try {
    const res = await apiFetch('/api/images/assign-to-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug, slot, source, imageId, altText, serviceKey: getServiceKey() }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Assign failed');
    // Track selection and re-render grid so this card shows Remove, others show Select
    App._selectedLibImg[slot] = imageId;
    const currentFilter = (document.querySelector(\`#img-lib-filter-\${slot} .lib-filter-btn.active\`) || {}).dataset?.filter || 'all';
    App.renderLibraryGrid(slot, currentFilter);
    if (statusEl) { statusEl.textContent = '✓ Image selected — click Remove to change it'; statusEl.style.color = 'var(--success)'; }
    // Refresh preview
    await App.loadImageStatuses();
  } catch (e) {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.className = 'lib-img-select';
      btnEl.textContent = 'Select';
    }
    if (statusEl) { statusEl.textContent = '✗ ' + e.message; statusEl.style.color = 'var(--danger)'; }
  }
};

App.removeSlotImage = async function(btnEl, slot) {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  const statusEl = document.getElementById(\`img-status-\${slot}\`);
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.className = 'lib-img-select loading';
    btnEl.textContent = '…';
  }
  if (statusEl) { statusEl.textContent = 'Removing…'; statusEl.style.color = 'var(--muted)'; }
  try {
    const res = await apiFetch(\`/api/images/\${slug}/\${slot}\`, { method: 'DELETE' });
    if (!res.ok) {
      const data = await res.json().catch(function() { return {}; });
      throw new Error(data.error || 'Remove failed');
    }
    delete App._selectedLibImg[slot];
    const currentFilter = (document.querySelector(\`#img-lib-filter-\${slot} .lib-filter-btn.active\`) || {}).dataset?.filter || 'all';
    App.renderLibraryGrid(slot, currentFilter);
    if (statusEl) { statusEl.textContent = 'Image removed — select another below'; statusEl.style.color = 'var(--muted)'; }
    await App.loadImageStatuses();
  } catch (e) {
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.className = 'lib-img-select selected';
      btnEl.textContent = 'Remove';
    }
    if (statusEl) { statusEl.textContent = '✗ ' + e.message; statusEl.style.color = 'var(--danger)'; }
  }
};

App.loadImageStatuses = async function() {
  const urlCampaign = new URLSearchParams(window.location.search).get('campaign') || '';

  const campaignSlug = (
    state.campaign?.slug ||
    state.campaign?.campaignSlug ||
    state.campaignId ||
    urlCampaign ||
    ''
  ).toString().trim();

  const slug = campaignSlug || state.project?.clientSlug;
  console.log('[loadImageStatuses] START slug=' + slug + ' ts=' + new Date().toISOString());
  if (!slug) return;
  try {
    // Build the status URL with service filter so slot previews only show images
    // that belong to the current campaign's service — mirrors loadImageLibrary.
    let statusUrl = '/api/images/status/' + slug;
    const svcKey = getServiceKey();
    if (svcKey) {
      statusUrl += '?service=' + encodeURIComponent(svcKey === 'web-de-ign' ? 'web-design' : svcKey);
    } else if (state.campaignId) {
      statusUrl += '?cid=' + encodeURIComponent(state.campaignId);
    }
    const res = await apiFetch(statusUrl);
    if (!res.ok) { console.warn('[loadImageStatuses] status endpoint failed', res.status); return; }
    const data = await res.json();
    console.log('[loadImageStatuses] STATUS DATA:', JSON.stringify(data.status));
    for (const [slot, info] of Object.entries(data.status || {})) {
      const st  = document.getElementById(\`img-status-\${slot}\`);
      // Cache-bust using assignedFrom filename + updatedAt — unique per assignment
      const ver = encodeURIComponent(
        (info.assignedFrom || '') + '@' + (info.assignedAt || info.generatedAt || Date.now())
      );
      const previewUrl = \`/api/images/serve/\${slug}/\${slot}?af=\${ver}\`;
      console.log('[loadImageStatuses] slot=' + slot + ' exists=' + info.exists + ' source=' + info.source + ' previewUrl=' + previewUrl);
      if (info.exists) {
        const statusLabel = info.status === 'approved'
          ? (info.source === 'uploaded' ? '✓ Uploaded & saved' : '✓ Approved')
          : info.status === 'rejected' ? '✗ Rejected'
          : 'Generated — pending review';
        updateImagePreview(slot, previewUrl, null, 'loadImageStatuses');
        setApprovalBadge(slot, info.status || 'generated', info.source || 'ai');
        if (st) {
          st.textContent = statusLabel;
          st.style.color = info.status === 'approved' ? 'var(--success)' : info.status === 'rejected' ? 'var(--danger)' : '#92400e';
        }
      } else if (info.status) {
        // Meta entry exists but file is missing — surface the error
        console.warn('[loadImageStatuses] slot=' + slot + ' — meta exists but FILE MISSING');
        const badge = document.getElementById(\`img-approval-badge-\${slot}\`);
        if (badge) { badge.textContent = '⚠ File missing'; badge.style.background = '#fee2e2'; badge.style.color = '#991b1b'; }
        if (st) { st.textContent = '⚠ Image path invalid or file missing'; st.style.color = 'var(--danger)'; }
        updateImagePreview(slot, null, null, 'loadImageStatuses→missing');
        const wrap = document.getElementById(\`img-preview-wrap-\${slot}\`);
        if (wrap) wrap.innerHTML = \`<span style="font-size:.78rem;color:#991b1b;text-align:center;padding:8px">⚠ File missing on server</span>\`;
      } else {
        console.log('[loadImageStatuses] slot=' + slot + ' — no meta, leaving placeholder');
      }
      // ── Per-slot diagnostic ──
      const diag = document.getElementById(\`img-diag-\${slot}\`);
      if (diag) {
        const resolvedFrom = info.exists
          ? (info.source === 'uploaded' ? 'saved assignment (uploaded)' : info.source === 'ai' ? 'saved assignment (ai)' : 'saved assignment')
          : (info.status ? 'missing — meta exists, file gone' : 'fallback / missing');
        diag.style.display = 'block';
        diag.innerHTML = [
          \`slot: \${slot}\`,
          \`source: \${info.source || '—'}\`,
          \`saved path: /api/images/serve/\${slug}/\${slot}\`,
          \`preview URL: \${info.exists ? previewUrl : '—'}\`,
          \`assignedFrom: \${info.assignedFrom || info.generatedAt || '—'}\`,
          \`file exists: \${info.exists ? '✓ yes' : '✗ no'}\`,
          \`updatedAt: \${info.assignedAt || info.generatedAt || info.reviewedAt || '—'}\`,
          \`resolved from: \${resolvedFrom}\`,
        ].join('<br>');
      }
    }
    console.log('[loadImageStatuses] DONE — all slots processed');
    App.renderImageDiagnostics();
  } catch(e) { console.error('[loadImageStatuses] ERROR', e); }
};

// ── Auto-load library images for empty slots when image mode is "library" ──
// Called on stage 5 entry. Silently shows stock images if found; leaves slot blank if not.
App.autoLoadLibraryImages = async function() {
  const p = state.project;
  if (!p || (p.imageMode !== 'library' && p.imageMode !== 'mixed')) return;
  const slug = p.clientSlug;
  if (!slug) return;

  const SLOTS = ['hero', 'support', 'conversion', 'trust'];
  for (const slot of SLOTS) {
    // Skip slots that already have an image loaded
    const wrap = document.getElementById(\`img-preview-wrap-\${slot}\`);
    if (wrap && wrap.querySelector('img[src]:not([src=""])')) continue;

    try {
      const res = await apiFetch('/api/images/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          serviceKey:  getServiceKey(),
          slot,
          imageRole:   getImageRole(slot),
          primaryKeyword:      state.project?.primaryKeyword || state.campaign?.primaryKeyword || undefined,
          shortPageDescription: state.campaign?.serviceName || undefined,
        }),
      });
      const data = await res.json();

      if (data.ok && data.serveUrl) {
        // Stock image found — show it and mark as approved
        updateImagePreview(slot, \`\${data.serveUrl}?ts=\${Date.now()}\`, null, 'autoLoadLibrary');
        setApprovalBadge(slot, 'approved', 'library');
        const st = document.getElementById(\`img-status-\${slot}\`);
        if (st) { st.textContent = '✓ Stock image loaded'; st.style.color = 'var(--success)'; }

        // Persist the assignment so it survives page refresh
        try {
          await apiFetch('/api/images/assign-to-slot', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slug, slot,
              source:     'library',
              imageId:    'library-' + slot,
              altText:    slot + ' image for ' + (p.businessName || slug),
              serviceKey: getServiceKey(),
            }),
          });
        } catch (_) { /* non-fatal */ }
      }
      // If !data.ok — leave slot blank, no error shown
    } catch (_) {
      // Network / parse error — leave slot blank silently
    }
  }
};

// ── Init Stage 5 — set image mode badge + gating check ──
App.initStage5 = async function() {
  console.log('[initStage5] START ts=' + new Date().toISOString());
  const p = state.project;
  const badge = document.getElementById('stage5-imagemode-badge');
  const desc  = document.getElementById('stage5-imagemode-desc');
  const gating = document.getElementById('stage5-gating-warn');
  const gatingMsg = document.getElementById('stage5-gating-msg');
  const genAllBtn = document.getElementById('btn-generate-all');

  const modeLabels = { ai:'AI-generated', own:'Uploaded images only', mixed:'Mix: upload + AI', skip:'No images' };
  const mode = p?.imageMode;

  if (badge) {
    badge.textContent = 'Image mode: ' + (modeLabels[mode] || 'Not set');
    badge.style.background = mode ? '#eff6ff' : '#fee2e2';
    badge.style.color = mode ? '#1e40af' : '#991b1b';
  }
  if (desc) {
    const descs = {
      ai:    'Ideogram AI will generate hero, support and conversion images. Review and approve each one before running the rollout.',
      own:   'Upload your own images for each slot below. AI generation is disabled.',
      mixed: 'Upload images where you have them — AI will fill any empty slots during rollout.',
      skip:  'Pages will be generated without images.',
    };
    desc.textContent = descs[mode] || 'Go to Stage 1 and set an Image Mode before continuing.';
  }

  // Hide "Generate All" button if mode is own/skip
  if (genAllBtn) genAllBtn.style.display = (mode === 'own' || mode === 'skip') ? 'none' : '';

  // Gating check
  if (p) {
    const issues = [];
    if (!p.businessName) issues.push('business name');
    if (!p.mainService)  issues.push('main service');
    if (!p.imageMode)    issues.push('image mode');
    if ((mode === 'ai' || mode === 'mixed') && !p.integrations?.ideogramApiKey && !window.__serverHasIdeogramKey) {
      // Check server key exists via a quick test
    }
    if (gating && gatingMsg) {
      if (issues.length) {
        gating.style.display = 'block';
        gatingMsg.textContent = 'Missing: ' + issues.join(', ') + '.';
      } else {
        gating.style.display = 'none';
      }
    }
  }

  // ── Campaign + area confirmation panel ────────────────────────────
  const genPreview = document.getElementById('gen-campaign-preview');
  const genCity    = document.getElementById('gen-campaign-city');
  const genAreas   = document.getElementById('gen-campaign-areas');
  if (genPreview && state.selectedAreaDefs && state.selectedAreaDefs.length > 0) {
    const city = state.campaign?.cityName || (state.selectedAreaDefs.find(d => d.tier === 'hub')?.area) || '?';
    const areaNames = state.selectedAreaDefs.map(d => d.area).join(', ');
    genCity.textContent  = 'Campaign: ' + city + ' (' + state.selectedAreaDefs.length + ' pages)';
    genAreas.textContent = 'Areas: ' + areaNames;
    genPreview.style.display = 'block';
  } else if (genPreview) {
    genPreview.style.display = 'none';
  }

  await App.loadImageStatuses();
  App.autoLoadLibraryImages();

  // Load image library for Stage 5 after status/auto-load so the visible library is populated last.
  // Run once immediately and once after the UI settles, because the Stage 5 pane can be re-rendered after init.
  try {
    if (typeof imgLibLoad === 'function') {
      await imgLibLoad();
      setTimeout(() => { try { imgLibLoad(); } catch(e) { console.error('[initStage5] delayed imgLibLoad failed', e); } }, 800);
    }
  } catch(e) {
    console.error('[initStage5] imgLibLoad failed', e);
  }

  // ── Zombie job recovery: if a job is already active when stage 5 loads ──────
  // This can happen when the dashboard opens the wizard while a previous job is
  // still running (or stuck). Show the cancel + start-fresh controls immediately.
  if (state.activeJobId && state.isGenerating) {
    document.getElementById('rollout-cancel-btn').style.display = 'inline-block';
    document.getElementById('rollout-status-badge').style.display = 'flex';
    document.getElementById('rollout-spinner').style.display = 'inline-block';
    document.getElementById('rollout-status-text').textContent = 'Job in progress…';
    document.getElementById('run-rollout-btn').disabled = true;
  } else if (state.activeJobId && !state.isGenerating) {
    // Stale activeJobId — check if it's actually done/cancelled on the server
    apiFetch('/api/rollout/status/' + state.activeJobId).then(r => r.ok ? r.json() : null).then(job => {
      if (!job || job.status === 'done' || job.status === 'cancelled' || job.status === 'error') {
        const saMsg = document.getElementById('rollout-start-again-msg');
        if (saMsg && job) {
          saMsg.textContent = 'Previous job ' + job.status + ' — click to start a fresh run.';
          document.getElementById('rollout-start-again').style.display = 'flex';
        }
        state.activeJobId = null;
      }
    }).catch(() => { state.activeJobId = null; });
  }

  // ── Hub Page section (always visible, populated from campaign) ─────
  const hubStatus   = document.getElementById('hub-page-status');
  const hubResult   = document.getElementById('hub-page-result');
  const hubDetails  = document.getElementById('hub-details');
  const hubBadge    = document.getElementById('hub-status-badge');
  const hubWarn     = document.getElementById('stage5-hub-warn');
  const cid         = state.campaignId;
  const campaign    = state.campaign || {};

  if (cid && campaign.cityName) {
    // Populate campaign detail strip
    if (hubDetails) hubDetails.style.display = 'block';
    const ds = document.getElementById('hub-detail-service');
    const dc = document.getElementById('hub-detail-city');
    const dk = document.getElementById('hub-detail-keyword');
    if (ds) ds.textContent = campaign.serviceName || '—';
    if (dc) dc.textContent = campaign.cityName    || '—';
    if (dk) dk.textContent = campaign.focusKeyword || \`\${(campaign.serviceName||'').toLowerCase()} \${(campaign.cityName||'').toLowerCase()}\`;

    // Hub existence check
    const defs   = state.selectedAreaDefs || [];
    const hasHub = defs.some(d => d.tier === 'hub');
    const btn    = document.getElementById('btn-create-hub');
    if (hasHub) {
      const hubDef        = defs.find(d => d.tier === 'hub');
      const deployEnabled = !!(state.project?.deploy?.enabled);
      const base          = (state.project?.domain || '').replace(/[/]+$/, '');
      const areaSlugH     = (hubDef?.remotePath || '').split('/').join('').trim();
      const hubUrl        = deployEnabled
        ? (hubDef?.remotePath ? base + hubDef.remotePath : '')
        : (areaSlugH ? \`/preview/\${state.project?.clientSlug}/\${areaSlugH}/\` : '');
      const hubLabel      = deployEnabled ? hubUrl : \`Preview: \${hubUrl}\`;
      if (hubStatus) hubStatus.innerHTML = hubUrl
        ? \`Hub page: <a href="\${esc(hubUrl)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(hubLabel)}</a>\`
        : 'Hub page: (path unknown)';
      if (hubBadge) { hubBadge.textContent = 'Created ✓'; hubBadge.style.cssText = 'font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:12px;background:#dcfce7;color:#166534'; }
      if (btn) btn.textContent = '↻ Recreate Hub Page';
      if (hubWarn) hubWarn.classList.add('hidden');
    } else {
      if (hubStatus) hubStatus.textContent = 'No hub page created for this campaign yet.';
      if (hubBadge) { hubBadge.textContent = 'Not created'; hubBadge.style.cssText = 'font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:12px;background:#fef9c3;color:#854d0e'; }
      if (btn) btn.textContent = '✦ Create Hub Page';
      if (hubWarn) hubWarn.classList.remove('hidden');
    }
  } else {
    if (hubDetails) hubDetails.style.display = 'none';
    if (hubStatus) hubStatus.textContent = 'Load a campaign first (Stage 2) to create a hub page.';
    if (hubBadge) { hubBadge.textContent = 'No campaign'; hubBadge.style.cssText = 'font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:12px;background:#f1f5f9;color:var(--muted)'; }
    if (hubWarn) hubWarn.classList.add('hidden');
  }
  if (hubResult) hubResult.className = 'alert hidden';
};

App.createHubPage = async function() {
  const slug = state.project?.clientSlug;
  const cid  = state.campaignId;
  if (!slug || !cid) { alert('Load a campaign first.'); return; }
  const btn    = document.getElementById('btn-create-hub');
  const result = document.getElementById('hub-page-result');
  btn.disabled    = true;
  btn.textContent = '✦ Generating hub page…';
  if (result) { result.className = 'alert hidden'; result.innerHTML = ''; }
  try {
    const res  = await apiFetch('/api/rollout/hub', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientSlug: slug, campaignId: cid }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Hub page creation failed');
    const hubViewUrl   = data.deployEnabled ? data.liveUrl : data.previewUrl;
    const hubViewLabel = data.deployEnabled ? data.liveUrl : \`Preview: \${data.previewUrl}\`;
    if (result) {
      result.className = 'alert alert-success';
      const deployNote = data.deployEnabled ? '' : \`<br><small style="opacity:.8">⚠ FTP not enabled — showing local preview. Enable deploy in Stage 1 to publish live.</small>\`;
      const sitemapLine = data.sitemapNote
        ? \`<br><small style="opacity:.8">📋 \${esc(data.sitemapNote)}</small>\`
        : '';
      result.innerHTML = \`<strong>✓ Hub page created</strong> — <a href="\${esc(hubViewUrl)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(hubViewLabel)}</a>\${deployNote}\${sitemapLine}\`;
    }
    // Refresh hub status in UI
    const hubStatus = document.getElementById('hub-page-status');
    if (hubStatus) {
      hubStatus.innerHTML = \`Hub page: <a href="\${esc(hubViewUrl)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(hubViewLabel)}</a>\`;
    }
    btn.textContent = '↻ Recreate Hub Page';
  } catch (e) {
    if (result) {
      result.className = 'alert alert-error';
      result.innerHTML = \`<strong>Failed:</strong> \${esc(e.message)}\`;
    }
    btn.textContent = '✦ Create Hub Page';
  } finally {
    btn.disabled = false;
  }
};

App.createFullCampaign = async function() {
  const slug = state.project?.clientSlug;
  const cid  = state.campaignId;
  if (!slug || !cid) { alert('Load a campaign first (Stage 2).'); return; }

  const btn = document.getElementById('btn-full-campaign');
  const out = document.getElementById('full-campaign-result');
  if (btn) { btn.disabled = true; btn.textContent = '⚡ Generating…'; }
  if (out) { out.className = 'alert alert-info'; out.innerHTML = 'Step 1/2: Creating hub page…'; }

  // Step 1: Create hub page
  try {
    const hubRes  = await apiFetch('/api/rollout/hub', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientSlug: slug, campaignId: cid }),
    });
    const hubData = await hubRes.json();
    if (!hubRes.ok) throw new Error(hubData.error || 'Hub page creation failed');
    const hubVUrl = hubData.deployEnabled ? hubData.liveUrl : hubData.previewUrl;
    if (out) out.innerHTML = \`Step 1/2 ✓ Hub page created: <a href="\${esc(hubVUrl)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(hubVUrl)}</a><br>Step 2/2: Starting cluster rollout…\`;
    // Refresh hub status in the hub card
    const hubStatus = document.getElementById('hub-page-status');
    if (hubStatus) hubStatus.innerHTML = \`Hub page: <a href="\${esc(hubVUrl)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(hubVUrl)}</a>\`;
    const hubBadge = document.getElementById('hub-status-badge');
    if (hubBadge) { hubBadge.textContent = 'Created ✓'; hubBadge.style.cssText = 'font-size:.78rem;font-weight:700;padding:3px 10px;border-radius:12px;background:#dcfce7;color:#166534'; }
    const hubWarn = document.getElementById('stage5-hub-warn');
    if (hubWarn) hubWarn.classList.add('hidden');
  } catch (e) {
    if (out) { out.className = 'alert alert-error'; out.innerHTML = \`<strong>Hub page failed:</strong> \${esc(e.message)}\`; }
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Generate Full Campaign'; }
    return;
  }

  // Step 2: Run cluster rollout
  try {
    await App.startRollout();
    if (out) { out.className = 'alert alert-success'; out.innerHTML = \`<strong>✓ Full campaign complete</strong> — Hub + Cluster pages generated.\`; }
  } catch (e) {
    if (out) { out.className = 'alert alert-error'; out.innerHTML = \`Hub page ✓ — Cluster rollout failed: \${esc(e.message)}\`; }
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '⚡ Generate Full Campaign'; }
  }
};

App.generateAllImages = async function() {
  const ctx = resolveActiveCampaignContext();
  const slug = ctx.slug;
  if (!slug) { alert('No active campaign or project loaded.'); return; }
  const imageMode = state.project?.imageMode;
  if (imageMode === 'own' || imageMode === 'skip') {
    alert('AI generation is disabled. Upload your own images instead.');
    return;
  }
  const allStatus = document.getElementById('img-all-status');
  allStatus.textContent = 'Generating all 3 images…';
  const slots = ['hero', 'support', 'trust', 'conversion'];
  let done = 0;
  for (const slot of slots) {
    allStatus.textContent = \`Generating \${slot} image (\${++done}/3)…\`;
    await App.generateImage(slot);
  }
  allStatus.textContent = 'All images generated — please review and approve each one';
  setTimeout(() => { allStatus.textContent = ''; }, 5000);
};

App.saveImageSelection = async function() {

  let slug =
    state.campaignId ||
    state.project?.clientSlug ||
    '';

  // If we have campaign metadata, prefer the active campaign slug
  if (state.campaignId && Array.isArray(state._campaignMeta)) {
    const active = state._campaignMeta.find(x => x.id === state.campaignId);
    if (active?.slug) slug = active.slug;
  }

  console.log('[saveImageSelection] START slug=' + slug + ' campaignId=' + state.campaignId + ' ts=' + new Date().toISOString());

  if (!slug) {
    alert('No active campaign or project loaded.');
    return;
  }
  const btn = document.getElementById('btn-save-images');
  const statusEl = document.getElementById('img-save-status');
  btn.disabled = true;
  btn.textContent = 'Saving…';
  statusEl.textContent = '';
  statusEl.style.color = 'var(--muted)';

  // Fetch current slot state from server to know what needs approving
  let serverStatus = {};
  try {
    const r = await apiFetch('/api/images/status/' + slug);
    if (r.ok) { const d = await r.json(); serverStatus = d.status || {}; }
  } catch(_) {}

  const slots = ['hero', 'support', 'trust', 'conversion'];
  let saved = 0, missing = 0;
  for (const slot of slots) {
    const info = serverStatus[slot] || {};
    if (!info.exists) { missing++; continue; }
    // Approve anything that has a file on disk (covers AI-generated + uploaded)
    try {
      const res = await apiFetch('/api/images/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, slot, status: 'approved' }),
      });
      if (res.ok) {
        setApprovalBadge(slot, 'approved', info.source || 'ai');
        const st = document.getElementById(\`img-status-\${slot}\`);
        if (st) {
          st.textContent = info.source === 'uploaded' ? '✓ Uploaded & saved' : '✓ Approved';
          st.style.color = 'var(--success)';
        }
        saved++;
      }
    } catch(e) { /* skip */ }
  }
  btn.disabled = false;
  btn.textContent = '💾 Save Image Selection';
  if (saved > 0) {
    statusEl.style.color = 'var(--success)';
    statusEl.textContent = '✓ Image selection saved (' + saved + ' slot' + (saved !== 1 ? 's' : '') + ')';
  } else if (missing === slots.length) {
    statusEl.style.color = '#d97706';
    statusEl.textContent = 'No images assigned — generate, upload, or pick from library first.';
  } else {
    statusEl.style.color = '#d97706';
    statusEl.textContent = 'Some slots could not be saved — check for missing image files.';
  }
  App.renderImageDiagnostics();
  setTimeout(() => { if (statusEl) statusEl.textContent = ''; }, 8000);
};

App.renderImageDiagnostics = async function() {
  const el = document.getElementById('img-diagnostics');
  if (!el) return;
  let slug = state.campaignId || state.project?.clientSlug || '';

  if (state.campaignId && Array.isArray(state._campaignMeta)) {
    const active = state._campaignMeta.find(x => x.id === state.campaignId);
    if (active?.slug) slug = active.slug;
  }

  if (!slug) { el.innerHTML = '<em>No active campaign or project loaded</em>'; return; }
  try {
    const r = await apiFetch('/api/images/status/' + slug);
    if (!r.ok) { el.innerHTML = '<em>Could not fetch status</em>'; return; }
    const d = await r.json();
    const rows = ['hero','support','trust','conversion'].map(slot => {
      const i = d.status[slot] || {};
      const exists = i.exists ? '<span style="color:green">✓ yes</span>' : '<span style="color:red">✗ no</span>';
      const status = i.status || '—';
      const source = i.source || '—';
      const path = i.exists ? \`/api/images/serve/\${slug}/\${slot}\` : '—';
      const from = i.assignedFrom || i.generatedAt || '—';
      return \`<tr style="border-bottom:1px solid #e5e7eb">
        <td style="padding:4px 8px;font-weight:700">\${slot}</td>
        <td style="padding:4px 8px">\${source}</td>
        <td style="padding:4px 8px;font-family:monospace;font-size:.72rem">\${path}</td>
        <td style="padding:4px 8px;font-family:monospace;font-size:.72rem">\${from}</td>
        <td style="padding:4px 8px">\${exists}</td>
        <td style="padding:4px 8px">\${status}</td>
      </tr>\`;
    });
    el.innerHTML = \`<table style="width:100%;border-collapse:collapse;font-size:.75rem">
      <thead><tr style="background:#f1f5f9">
        <th style="padding:4px 8px;text-align:left">Slot</th>
        <th style="padding:4px 8px;text-align:left">Source</th>
        <th style="padding:4px 8px;text-align:left">Serve path</th>
        <th style="padding:4px 8px;text-align:left">Assigned from</th>
        <th style="padding:4px 8px;text-align:left">File exists</th>
        <th style="padding:4px 8px;text-align:left">Status</th>
      </tr></thead>
      <tbody>\${rows.join('')}</tbody>
    </table>\`;
  } catch(e) { el.innerHTML = '<em>Error: ' + e.message + '</em>'; }
};

// ═══════════════════════════════════════════════════════════════════
// Stage 5 — Generation
// ═══════════════════════════════════════════════════════════════════


function renderRolloutOrder() {
  const body = document.getElementById('rollout-order-body');
  body.innerHTML = '';
  const defs = state.selectedAreaDefs || [];
  let idx = 1;

  const hubDef   = defs.find(d => d.tier === 'hub');
  const priority = defs.filter(d => d.tier === 'priority');
  const secondary = defs.filter(d => d.tier === 'secondary');
  const tertiary = defs.filter(d => d.tier === 'tertiary');

  function addSection(label, items, deferred, badgeOverride) {
    if (!items.length) return;
    const hdr = document.createElement('div');
    hdr.style.cssText = 'padding:6px 16px;font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);background:#f8fafc;border-bottom:1px solid var(--border);border-top:1px solid var(--border)';
    hdr.textContent = label;
    body.appendChild(hdr);
    items.forEach(d => {
      const tier = badgeOverride || d.tier;
      const row = document.createElement('div');
      row.className = 'rollout-area' + (deferred ? ' deferred' : '');
      row.innerHTML = \`
        <span class="rollout-area-num">\${deferred ? '—' : idx++}</span>
        <span class="rollout-area-name">\${esc(d.area)}</span>
        <span class="rollout-area-path">\${esc(d.remotePath || '')}</span>
        <span class="badge" style="font-size:.7rem;padding:2px 7px;border-radius:10px;\${tier==='hub'?'background:#eff6ff;color:#1d4ed8;border:1px solid #bfdbfe':tier==='priority'?'background:#f0fdf4;color:#166534;border:1px solid #bbf7d0':'background:#f1f5f9;color:#64748b;border:1px solid #e2e8f0'}">\${tier==='hub'?'Hub':'Cluster'}</span>
      \`;
      body.appendChild(row);
    });
  }

  if (hubDef) addSection('Hub Page (created separately)', [hubDef], false, 'hub');
  addSection('Priority Clusters', priority, false);
  addSection('Secondary Clusters', secondary, false);
  addSection('Deferred — Tertiary', tertiary, true);
}

App.startRollout = async function() {
  if (state.isGenerating) return;

  state.isGenerating = true;
  renderProgress();
  document.getElementById('run-rollout-btn').disabled = true;
  const log = document.getElementById('progress-log');
  log.innerHTML = '';

  const appendLog = (text, cls = 'log-line-info') =>
    (log.innerHTML += \`<span class="\${cls}">\${esc(text)}\\n</span>\`);

  // ── Progress bar setup ────────────────────────────────────────────
  const includeSecondaryForCount = document.getElementById('run-include-secondary').checked;
  const totalPages = (state.selectedAreaDefs || []).length || 1;
  let pagesProcessed = 0;
  const pbWrap   = document.getElementById('rollout-progress-wrap');
  const pbBar    = document.getElementById('rollout-progress-bar');
  const pbCount  = document.getElementById('rollout-progress-count');
  const pbPage   = document.getElementById('rollout-current-page');
  const sbBadge  = document.getElementById('rollout-status-badge');
  const sbText   = document.getElementById('rollout-status-text');
  const setProgress = (n, total, currentArea) => {
    const pct = Math.round((n / total) * 100);
    pbBar.style.width  = pct + '%';
    pbBar.style.background = pct === 100 ? '#22c55e' : 'var(--primary)';
    pbCount.textContent = \`\${n} / \${total}\`;
    if (currentArea) pbPage.textContent = currentArea;
  };
  pbWrap.style.display  = 'block';
  sbBadge.style.display = 'flex';
  sbText.textContent    = 'Generating pages…';
  setProgress(0, totalPages, '');
  // ─────────────────────────────────────────────────────────────────

  appendLog(\`[rollout] Starting rollout for \${state.project.clientSlug}… (\${totalPages} pages)\`);

  const includeSecondary = document.getElementById('run-include-secondary').checked;

  // ── Start background job ──────────────────────────────────────────────────
  let jobId;
  try {
    const startRes = await apiFetch('/api/rollout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        clientSlug: state.project.clientSlug,
        campaignId: state.campaignId || undefined,
        selectedAreaDefs: (state.selectedAreaDefs && state.selectedAreaDefs.length > 0)
          ? state.selectedAreaDefs : undefined,
        options: { includeSecondary, dryRun: false, deferTertiary: false, concurrency: App._concurrency || 1 },
      }),
    });
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      appendLog('[error] ' + (err.error || 'Rollout failed to start'), 'log-line-err');
      sbText.textContent = 'Failed';
      document.getElementById('rollout-spinner').style.display = 'none';
      pbBar.style.background = '#ef4444';
      state.isGenerating = false;
      renderProgress();
      document.getElementById('run-rollout-btn').disabled = false;
      return;
    }
    const startData = await startRes.json();
    jobId = startData.jobId;
  } catch (netErr) {
    appendLog('[error] Network error: ' + netErr.message, 'log-line-err');
    sbText.textContent = 'Failed';
    document.getElementById('rollout-spinner').style.display = 'none';
    state.isGenerating = false;
    renderProgress();
    document.getElementById('run-rollout-btn').disabled = false;
    return;
  }

  state.activeJobId = jobId;
  document.getElementById('rollout-cancel-btn').style.display = 'inline-block';
  appendLog(\`[rollout] Job started — polling for updates… (job \${jobId.slice(0,8)})\`);

  // ── Poll for progress every 2 s ────────────────────────────────────────────
  let lastEventIdx = 0;
  let jobDone = false;
  let consecutiveFails = 0;

  while (!jobDone) {
    await new Promise(resolve => setTimeout(resolve, 2000));

    let job;
    try {
      const pollRes = await apiFetch('/api/rollout/status/' + jobId);
      if (!pollRes.ok) {
        consecutiveFails++;
        if (consecutiveFails >= 3) {
          appendLog('[error] Lost connection to server — rollout status unavailable. Refresh to retry.', 'log-line-err');
          sbText.textContent = 'Connection lost — refresh page to retry';
          document.getElementById('rollout-spinner').style.display = 'none';
          jobDone = true;
        }
        continue;
      }
      consecutiveFails = 0;
      job = await pollRes.json();
    } catch (_) { consecutiveFails++; if (consecutiveFails >= 3) { jobDone = true; } continue; }

    // Process only new events since the last poll
    const newEvents = (job.events || []).slice(lastEventIdx);
    lastEventIdx = (job.events || []).length;

    for (const ev of newEvents) {
      if (ev.type === 'progress') {
        const tag = ev.status === 'success' ? 'log-line-ok' : 'log-line-err';
        appendLog(\`[\${ev.tier}] \${ev.area} — \${ev.step} (\${ev.durationMs}ms)\`, tag);
        log.scrollTop = log.scrollHeight;
        if (ev.tier !== 'hub') {
          pagesProcessed++;
          setProgress(pagesProcessed, totalPages, ev.area);
          sbText.textContent = \`\${pagesProcessed} of \${totalPages} pages done\`;
        }
      } else if (ev.type === 'done') {
        appendLog('', 'log-line-dim');
        const t = ev.log?.totals || {};
        const onDisk = t.totalOnDisk ?? t.succeeded ?? 0;
        appendLog(\`[done] Generated: \${t.succeeded ?? 0}, Failed: \${t.failed ?? 0}, Deferred: \${t.deferred ?? 0}, Total on disk: \${onDisk}\`, 'log-line-ok');
        appendLog(\`[run-id] \${ev.log?.runId}\`, 'log-line-dim');
        setProgress(totalPages, totalPages, '');
        sbText.textContent = (t.failed > 0)
          ? \`Done — \${t.succeeded} ok, \${t.failed} failed (\${onDisk} total on disk)\`
          : \`Complete — \${onDisk} pages ready\`;
        document.getElementById('rollout-spinner').style.display = 'none';
        state.rolloutLog = ev.log;
        await saveSession();
        if ((t.succeeded || 0) > 0) {
          App.updateCampaignProgress({
            pagesGenerated: onDisk,
            pagesDeployed:  onDisk,
            areasSelected:  (ev.log?.entries?.length ?? 0) + (t.deferred ?? 0),
            status:         'deployed',
            currentStage:   6,
          });
        }
        jobDone = true;
        break;
      } else if (ev.type === 'error') {
        appendLog('[error] ' + ev.message, 'log-line-err');
      }
    }

    if (!jobDone && (job.status === 'error' || job.status === 'failed')) {
      appendLog('[error] Job failed: ' + (job.error || 'unknown error'), 'log-line-err');
      sbText.textContent = 'Failed';
      document.getElementById('rollout-spinner').style.display = 'none';
      const saMsg = document.getElementById('rollout-start-again-msg');
      if (saMsg) saMsg.textContent = 'Job failed — start a fresh run when ready.';
      document.getElementById('rollout-start-again').style.display = 'flex';
      jobDone = true;
    }
    if (!jobDone && job.status === 'cancelled') {
      appendLog('[cancelled] Job was cancelled.', 'log-line-err');
      sbText.textContent = 'Cancelled';
      document.getElementById('rollout-spinner').style.display = 'none';
      const saMsg = document.getElementById('rollout-start-again-msg');
      if (saMsg) saMsg.textContent = 'Job cancelled — click to start a fresh run.';
      document.getElementById('rollout-start-again').style.display = 'flex';
      jobDone = true;
    }
    if (!jobDone && job.status === 'done') jobDone = true;
  }

  document.getElementById('rollout-cancel-btn').style.display = 'none';
  state.activeJobId = null;
  state.isGenerating = false;
  renderProgress();
  document.getElementById('run-rollout-btn').disabled = false;

  // Auto-advance to Stage 6 (QA) after rollout finishes
  if ((state.rolloutLog?.totals?.succeeded || 0) > 0) {
    appendLog('', 'log-line-dim');
    appendLog('[wizard] Advancing to QA check…', 'log-line-ok');
    await new Promise(r => setTimeout(r, 1200));
    showStage(6);
    App.onStageEnter(6);
  } else {
    // Unlock next button only if nothing was generated (dry run or error)
    document.getElementById('btn-next').disabled = false;
  }
};

App.cancelRollout = async function() {
  const jobId = state.activeJobId;
  if (!jobId) return;
  const btn = document.getElementById('rollout-cancel-btn');
  btn.disabled = true;
  btn.textContent = 'Cancelling…';
  try {
    await apiFetch('/api/rollout/cancel/' + jobId, { method: 'POST' });
  } catch (_) {}
  // UI will update when the polling loop sees the cancelled status
};

// ═══════════════════════════════════════════════════════════════════
// Stage 6 — Validation
// ═══════════════════════════════════════════════════════════════════

App.runValidation = async function() {
  if (!state.project?.clientSlug) return;
  document.getElementById('val-loading').style.display = 'block';
  document.getElementById('val-results').classList.add('hidden');
  document.getElementById('run-validate-btn').disabled = true;

  // Safety timeout — clear the spinner after 20 s if the request never returns
  const _valTimeout = setTimeout(() => {
    document.getElementById('val-loading').style.display = 'none';
    document.getElementById('run-validate-btn').disabled = false;
    showError('stage6-error', 'Validation timed out — click Run Validation to try again, or Continue to skip.');
  }, 20000);

  try {
    const campaignParam = state.campaignId ? \`?campaignId=\${encodeURIComponent(state.campaignId)}\` : '';
    const res = await apiFetch(\`/api/validate/\${state.project.clientSlug}\${campaignParam}\`);
    let data;
    try { data = await res.json(); } catch (_) { throw new Error('Server returned an unexpected response — you may need to log in again.'); }
    if (!res.ok) { showError('stage6-error', data.error || 'Validation failed'); return; }
    state.validation = data.summary;
    try { await saveSession(); } catch (_) { /* non-fatal */ }
    renderValidation(data.summary, data.results);
  } catch (e) {
    showError('stage6-error', 'Network error: ' + e.message + ' — click Run Validation to retry, or Continue to skip.');
  } finally {
    clearTimeout(_valTimeout);
    document.getElementById('val-loading').style.display = 'none';
    document.getElementById('run-validate-btn').disabled = false;
  }
};

function aiScoreColor(score, max) {
  const pct = max ? Math.round((score / max) * 100) : score;
  if (pct >= 88) return '#16a34a';  // green
  if (pct >= 70) return '#d97706';  // amber
  if (pct >= 50) return '#ca8a04';  // yellow
  return '#dc2626';                  // red
}

function aiMasterColor(score) {
  if (score >= 90) return { bg: '#dcfce7', text: '#166534', bar: '#16a34a', label: 'Excellent' };
  if (score >= 75) return { bg: '#dbeafe', text: '#1d4ed8', bar: '#3b82f6', label: 'Strong' };
  if (score >= 60) return { bg: '#fef9c3', text: '#854d0e', bar: '#eab308', label: 'Needs refinement' };
  return { bg: '#fee2e2', text: '#991b1b', bar: '#ef4444', label: 'High risk' };
}

function renderValidation(summary, results) {
  const total = results.length;
  document.getElementById('val-summary-cards').innerHTML = \`
    <div class="engine-stat"><div class="engine-stat-value">\${total}</div><div class="engine-stat-label">Pages validated</div></div>
    <div class="engine-stat"><div class="engine-stat-value" style="color:var(--success)">\${summary.ready.length}</div><div class="engine-stat-label">Ready</div></div>
    <div class="engine-stat"><div class="engine-stat-value" style="color:var(--warn)">\${summary.review.length}</div><div class="engine-stat-label">Review needed</div></div>
    <div class="engine-stat"><div class="engine-stat-value" style="color:var(--danger)">\${summary.blocked.length}</div><div class="engine-stat-label">Blocked</div></div>
  \`;

  const hubCount = results.filter(r => r.tier === 'hub').length;
  const hubIssueCount = results.filter(r => r.tier === 'hub' && r.qaIssues.length > 0).length;
  const hubIssueNote = hubIssueCount > 0
    ? ' <span style="color:var(--error);font-size:.72rem">(' + hubIssueCount + ' issue' + (hubIssueCount > 1 ? 's' : '') + ')</span>'
    : '';
  document.getElementById('val-summary-cards').innerHTML += \`
    <div class="engine-stat" style="border-left:3px solid #f59e0b">
      <div class="engine-stat-value" style="color:#92400e">\${hubCount}</div>
      <div class="engine-stat-label">Hub page\${hubCount!==1?'s':''}\${hubIssueNote}</div>
    </div>
  \`;

  const tbody = document.getElementById('val-tbody');
  tbody.innerHTML = '';

  const TIER_BADGE = {
    hub:       '<span style="background:#dbeafe;color:#1d4ed8;font-size:.7rem;font-weight:800;border-radius:4px;padding:2px 7px;letter-spacing:.04em;border:1px solid #bfdbfe">Hub</span>',
    priority:  '<span style="background:#f0fdf4;color:#166534;font-size:.7rem;font-weight:700;border-radius:4px;padding:2px 7px;letter-spacing:.04em;border:1px solid #bbf7d0">Cluster · P1</span>',
    secondary: '<span style="background:#f1f5f9;color:#64748b;font-size:.7rem;font-weight:600;border-radius:4px;padding:2px 7px;border:1px solid #e2e8f0">Cluster · P2</span>',
    tertiary:  '<span style="background:#f1f5f9;color:#94a3b8;font-size:.7rem;font-weight:600;border-radius:4px;padding:2px 7px;border:1px solid #e2e8f0">Cluster · P3</span>',
  };

  results.forEach((r, i) => {
    const ai = r.aiReadiness;
    const masterScore = ai ? ai.masterScore : r.overallScore;
    const masterColors = aiMasterColor(masterScore);
    const readinessColor = r.readiness==='ready' ? 'var(--success)' : r.readiness==='review' ? 'var(--warn)' : 'var(--danger)';
    const isHub = r.tier === 'hub';
    const tierBadge = TIER_BADGE[r.tier] || TIER_BADGE.secondary;

    const tr = document.createElement('tr');
    tr.id = \`val-row-\${i}\`;
    if (isHub) tr.style.cssText = 'border-left:4px solid #f59e0b;background:#fffbeb';
    tr.innerHTML = \`
      <td style="font-weight:700\${isHub?';color:#92400e':''}">\${esc(r.area)}</td>
      <td>\${tierBadge}</td>
      <td>
        <div style="display:flex;align-items:center;gap:8px">
          <div style="background:\${masterColors.bg};border-radius:8px;padding:3px 10px;display:inline-flex;align-items:center;gap:6px;min-width:100px">
            <span style="font-weight:800;font-size:1rem;color:\${masterColors.text}">\${masterScore}</span>
            <span style="font-size:.7rem;font-weight:600;color:\${masterColors.text};opacity:.8">/100</span>
            <span style="font-size:.68rem;color:\${masterColors.text};opacity:.7;margin-left:2px">\${masterColors.label}</span>
          </div>
        </div>
        <div style="margin-top:4px;background:#e2e8f0;border-radius:4px;height:5px;overflow:hidden;max-width:140px">
          <div style="height:100%;border-radius:4px;background:\${masterColors.bar};width:\${masterScore}%;transition:width .4s"></div>
        </div>
      </td>
      <td><span class="badge badge-\${r.readiness}">\${r.readiness}</span></td>
      <td id="val-issues-\${i}">\${r.qaIssues.length ? \`<span style="color:var(--warn);font-weight:600">\${r.qaIssues.length} issue\${r.qaIssues.length>1?'s':''}</span>\` : '<span style="color:var(--success)">✓ None</span>'}</td>
      <td style="white-space:nowrap">
        \${r.areaDir ? \`<a href="/preview/\${state.project?.clientSlug || ''}/\${r.areaDir}/" target="_blank" rel="noopener" class="btn btn-ghost btn-sm" style="margin-right:4px">Preview</a>\` : ''}
        <button class="btn btn-ghost btn-sm" onclick="toggleValDetail(\${i})" style="margin-right:4px">Details</button>
        \${r.qaIssues.length ? \`<button id="rerun-btn-\${i}" class="btn btn-secondary btn-sm" onclick="App.rerunPage('\${esc(state.project?.clientSlug||'')}','\${esc(r.areaDir)}',\${i})">Rerun</button>\` : ''}
      </td>
    \`;
    tbody.appendChild(tr);

    // ── Detail row ─────────────────────────────────────────────────────────
    const detailTr = document.createElement('tr');
    detailTr.className = 'val-row-detail';
    detailTr.id = \`val-detail-\${i}\`;
    if (isHub) detailTr.style.cssText = 'border-left:4px solid #f59e0b';

    let detailHtml = '<td colspan="6" style="padding:0">';

    if (isHub) {
      detailHtml += \`<div style="padding:10px 12px 4px;font-size:.8rem;background:#fef3c7;color:#92400e;border-bottom:1px solid #fcd34d">
        <strong>★ Hub page</strong> — this page must link to every cluster/money page in the campaign. Fix any issues here first.
      </div>\`;
    }

    // AI Search Readiness Score panel
    if (ai) {
      const dupWarnings = (ai.duplicateWarnings || []);
      const hasDupWarnings = dupWarnings.length > 0;

      detailHtml += \`
        <div style="padding:14px 16px;border-bottom:1px solid #e2e8f0">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;flex-wrap:wrap;gap:8px">
            <div style="font-weight:700;font-size:.9rem;color:#1e293b">AI Search Readiness Score</div>
            <div style="display:flex;align-items:center;gap:8px">
              <span style="font-size:1.6rem;font-weight:900;color:\${masterColors.text}">\${masterScore}<span style="font-size:.8rem;font-weight:600;opacity:.6">/100</span></span>
              <span style="background:\${masterColors.bg};color:\${masterColors.text};padding:3px 10px;border-radius:12px;font-size:.75rem;font-weight:700">\${ai.label}</span>
              \${hasDupWarnings ? '<span style="background:#fee2e2;color:#991b1b;padding:3px 8px;border-radius:12px;font-size:.7rem;font-weight:700">⚠ Duplicate risk</span>' : ''}
            </div>
          </div>

          <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px;margin-bottom:14px">
            \${(ai.subscores || []).map(sub => {
              const col = aiScoreColor(sub.score, sub.maxScore);
              const barPct = Math.round((sub.score / sub.maxScore) * 100);
              const icon = barPct >= 88 ? '✔' : barPct >= 70 ? '~' : barPct >= 50 ? '!' : '✗';
              const iconColor = barPct >= 88 ? '#16a34a' : barPct >= 70 ? '#d97706' : barPct >= 50 ? '#ca8a04' : '#dc2626';
              return \`<div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:8px 10px">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px">
                  <span style="font-size:.72rem;font-weight:600;color:#475569">\${sub.label}</span>
                  <span style="font-size:.78rem;font-weight:800;color:\${col}">\${sub.score}<span style="opacity:.5;font-weight:500">/\${sub.maxScore}</span></span>
                </div>
                <div style="background:#e2e8f0;border-radius:3px;height:5px;overflow:hidden">
                  <div style="height:100%;border-radius:3px;background:\${col};width:\${barPct}%"></div>
                </div>
              </div>\`;
            }).join('')}
          </div>

          \${ai.strengths && ai.strengths.length ? \`
            <div style="margin-bottom:8px">
              <div style="font-size:.72rem;font-weight:700;color:#16a34a;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Strengths</div>
              <ul style="margin:0;padding-left:16px;font-size:.78rem;color:#374151;line-height:1.6">
                \${ai.strengths.map(s => '<li>' + esc(s) + '</li>').join('')}
              </ul>
            </div>
          \` : ''}

          \${ai.suggestions && ai.suggestions.length ? \`
            <div style="margin-bottom:8px">
              <div style="font-size:.72rem;font-weight:700;color:#d97706;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Suggested improvements</div>
              <ul style="margin:0;padding-left:16px;font-size:.78rem;color:#374151;line-height:1.6">
                \${ai.suggestions.map(s => '<li>' + esc(s) + '</li>').join('')}
              </ul>
            </div>
          \` : ''}

          \${hasDupWarnings ? \`
            <div>
              <div style="font-size:.72rem;font-weight:700;color:#dc2626;text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Duplicate warnings</div>
              <ul style="margin:0;padding-left:16px;font-size:.78rem;color:#7f1d1d;line-height:1.6">
                \${dupWarnings.map(w => '<li>' + esc(w) + '</li>').join('')}
              </ul>
            </div>
          \` : ''}
        </div>
      \`;
    }

    // QA issues
    if (r.qaIssues.length) {
      detailHtml += \`<div style="padding:10px 16px 14px;font-size:.8rem;color:#92400e;background:#fffbeb;border-top:1px solid #fde68a">
        <strong style="display:block;margin-bottom:4px">QA Issues</strong>
        \${r.qaIssues.map(q => '<div style="margin-bottom:3px">⚠ ' + esc(q) + '</div>').join('')}
      </div>\`;
    }

    detailHtml += '</td>';
    detailTr.innerHTML = detailHtml;
    tbody.appendChild(detailTr);
  });

  window._valResults = results;

  const issueCount = results.filter(r => r.qaIssues && r.qaIssues.length > 0).length;
  const rerunActions = document.getElementById('rerun-actions');
  if (rerunActions) {
    if (issueCount > 0) {
      document.getElementById('rerun-actions-count').textContent =
        \`\${issueCount} page\${issueCount>1?'s':''} \${issueCount>1?'have':'has'} QA issues\`;
      rerunActions.style.display = 'block';
    } else {
      rerunActions.style.display = 'none';
    }
  }

  document.getElementById('val-results').classList.remove('hidden');
  document.getElementById('stage6-continue').classList.remove('hidden');
}

function toggleValDetail(i) {
  const row = document.getElementById(\`val-detail-\${i}\`);
  row.classList.toggle('open');
}

function camelToTitle(str) {
  return str.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

// ═══════════════════════════════════════════════════════════════════
// Stage 7 — Output
// ═══════════════════════════════════════════════════════════════════

function renderOutput() {
  const log = state.rolloutLog;
  const slug = state.project?.clientSlug || '';

  // Files panel
  const filesWrap = document.getElementById('output-files');
  filesWrap.innerHTML = '';

  if (log?.entries?.length) {
    // Show hub page entry first if it exists
    const hubDef = (state.selectedAreaDefs || []).find(d => d.tier === 'hub');
    if (hubDef?.remotePath) {
      const hubSlug = hubDef.remotePath.split('/').join('').trim();
      const hubRow = document.createElement('div');
      hubRow.className = 'file-item';
      hubRow.style.cssText = 'background:#eff6ff;border-radius:6px;margin-bottom:4px;padding:6px 10px';
      hubRow.innerHTML = \`
        <span class="file-path" style="flex:1">output/\${slug}/\${hubSlug}/index.html</span>
        <span style="font-size:.7rem;padding:1px 7px;border-radius:8px;background:#dbeafe;color:#1d4ed8;font-weight:700;margin-right:6px">Hub</span>
        <span class="file-status" style="color:#166534">✓ live</span>
      \`;
      filesWrap.appendChild(hubRow);
    }
    log.entries.forEach(e => {
      if (e.status === 'success') {
        const row = document.createElement('div');
        row.className = 'file-item';
        row.innerHTML = \`
          <span class="file-path" style="flex:1">output/\${slug}/\${e.area.toLowerCase()}/index.html</span>
          <span style="font-size:.7rem;padding:1px 7px;border-radius:8px;background:#f0fdf4;color:#166534;font-weight:700;border:1px solid #bbf7d0;margin-right:6px">Cluster</span>
          <span class="file-status">✓ generated</span>
        \`;
        filesWrap.appendChild(row);
      }
    });
    const cfgRow = document.createElement('div');
    cfgRow.className = 'file-item';
    cfgRow.innerHTML = \`<span class="file-path mono">output/\${slug}/rollout-log.json</span><span class="file-status">✓</span>\`;
    filesWrap.appendChild(cfgRow);
  } else {
    filesWrap.innerHTML = '<div class="text-muted text-sm" style="display:flex;align-items:center;gap:12px">No files generated yet. <button class="btn btn-primary btn-sm" onclick="showStage(5);App.onStageEnter(5)">← Go to Generation</button></div>';
  }

  // Log panel
  const logPanel = document.getElementById('output-log');
  if (log) {
    logPanel.innerHTML = \`
      <div class="flex" style="justify-content:space-between;margin-bottom:8px"><span class="fw-600">Run ID</span><span class="mono">\${(log.runId||'').slice(0,8)}…</span></div>
      <div class="flex" style="justify-content:space-between;margin-bottom:4px"><span>Generated</span><span style="color:var(--success);font-weight:700">\${log.totals?.succeeded ?? 0}</span></div>
      <div class="flex" style="justify-content:space-between;margin-bottom:4px"><span>Failed</span><span style="color:\${(log.totals?.failed||0)?'var(--danger)':'var(--muted)'};font-weight:700">\${log.totals?.failed ?? 0}</span></div>
      <div class="flex" style="justify-content:space-between"><span>Deferred</span><span style="font-weight:700">\${log.totals?.deferred ?? 0}</span></div>
    \`;
  } else {
    logPanel.textContent = 'No rollout log found.';
  }

  // Deferred panel
  const deferredWrap = document.getElementById('output-deferred');
  if ((log?.totals?.deferred || 0) > 0) {
    deferredWrap.innerHTML = \`
      <div class="text-sm" style="margin-bottom:8px">Run deferred areas via CLI:</div>
      <pre class="mono" style="background:#f1f5f9;padding:10px;border-radius:6px;font-size:.78rem;overflow-x:auto">pnpm exec tsx src/generator/runDeferredAreas.ts \\\\
  config/projects/\${slug}.json</pre>\`;
  } else {
    deferredWrap.textContent = 'No deferred areas.';
  }
}


App.runDeferred = function() {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  alert(\`Run in your terminal:\\n\\npnpm exec tsx src/generator/runDeferredAreas.ts config/projects/\${slug}.json\`);
};

App.reuploadPages = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  const btn = document.getElementById('reupload-btn');
  if (btn) { btn.disabled = true; btn.textContent = 'Uploading…'; }
  try {
    const res = await apiFetch('/api/reupload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) {
      alert('Re-upload failed: ' + (data.error || 'Unknown error'));
    } else {
      const msg = \`Re-upload complete: \${data.succeeded} succeeded, \${data.failed} failed.\`;
      const fails = (data.results || []).filter(r => r.status === 'failed').map(r => r.area + ': ' + r.error).join('\\n');
      alert(msg + (fails ? '\\n\\nErrors:\\n' + fails : ''));
    }
  } catch (e) {
    alert('Network error: ' + e.message);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = 'Re-upload to FTP'; }
  }
};

function showRerunPanel(title, status, pct) {
  const panel = document.getElementById('rerun-panel');
  if (!panel) return;
  panel.style.display = 'block';
  document.getElementById('rerun-panel-title').textContent = title;
  document.getElementById('rerun-panel-status').textContent = status;
  document.getElementById('rerun-progress-bar').style.width = pct + '%';
}
function hideRerunPanel() {
  const panel = document.getElementById('rerun-panel');
  if (panel) panel.style.display = 'none';
}
function setRowRerunning(rowIndex, isRunning) {
  const row = document.getElementById(\`val-row-\${rowIndex}\`);
  if (row) row.style.background = isRunning ? '#fffbeb' : '';
  const issuesCell = document.getElementById(\`val-issues-\${rowIndex}\`);
  if (issuesCell && isRunning) {
    issuesCell.innerHTML = \`<span style="display:inline-flex;align-items:center;gap:6px;color:#92400e"><span style="display:inline-block;width:12px;height:12px;border:2px solid #fde68a;border-top-color:#d97706;border-radius:50%;animation:spin .8s linear infinite"></span>Regenerating…</span>\`;
  }
}

App.rerunPage = async function(clientSlug, areaDir, rowIndex) {
  const btn = document.getElementById(\`rerun-btn-\${rowIndex}\`);
  if (btn) { btn.disabled = true; btn.textContent = 'Running…'; }
  setRowRerunning(rowIndex, true);
  showRerunPanel(\`Regenerating \${areaDir}…\`, 'Generating AI content — this takes about 30–60 seconds', 30);

  try {
    const res = await apiFetch('/api/rerun-page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ clientSlug, areaDir }),
    });
    const data = await res.json();
    if (!res.ok) {
      hideRerunPanel();
      setRowRerunning(rowIndex, false);
      if (btn) { btn.disabled = false; btn.textContent = 'Rerun'; }
      alert('Rerun failed: ' + (data.error || 'Unknown error'));
    } else {
      showRerunPanel(\`Regenerated \${areaDir}\`, 'Re-validating all pages…', 90);
      await App.runValidation();
      hideRerunPanel();
    }
  } catch (e) {
    hideRerunPanel();
    setRowRerunning(rowIndex, false);
    if (btn) { btn.disabled = false; btn.textContent = 'Rerun'; }
    alert('Network error: ' + e.message);
  }
};

App.rerunAllIssues = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  const results = window._valResults || [];
  const withIssues = results.filter(r => r.qaIssues && r.qaIssues.length > 0);
  if (!withIssues.length) { alert('No pages with issues found.'); return; }

  const allBtn = document.getElementById('rerun-all-btn');
  if (allBtn) { allBtn.disabled = true; }
  document.getElementById('rerun-actions').style.display = 'none';

  let succeeded = 0, failed = 0;
  const total = withIssues.length;

  for (let idx = 0; idx < withIssues.length; idx++) {
    const r = withIssues[idx];
    const pct = Math.round(((idx) / total) * 80);
    showRerunPanel(
      \`Rerunning pages with issues (\${idx + 1} / \${total})\`,
      \`Regenerating \${r.area} — generating AI content…\`,
      pct
    );
    try {
      const res = await apiFetch('/api/rerun-page', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientSlug: slug, areaDir: r.areaDir }),
      });
      if (res.ok) { succeeded++; } else { failed++; }
    } catch { failed++; }
  }

  showRerunPanel('Rerun complete — re-validating…', \`\${succeeded} regenerated\${failed ? ', ' + failed + ' failed' : ''}. Running validation…\`, 90);
  await App.runValidation();
  hideRerunPanel();
  if (allBtn) { allBtn.disabled = false; }
};

App.resetWizard = function() {
  if (!confirm('Start over? This will clear the current wizard state (saved files remain).')) return;
  Object.assign(state, {
    stage: 1, isGenerating: false, project: null, campaign: null,
    engineOutput: null, selectedAreaDefs: [], keywordOverrides: {},
    kwSuggestions: {},
    rolloutLog: null, validation: null, navItems: [],
  });
  localStorage.removeItem('seo_wizard_slug');
  showStage(1);
};

// ═══════════════════════════════════════════════════════════════════
// Stage 8 — Indexing Setup
// ═══════════════════════════════════════════════════════════════════

App.loadIndexingStage = async function() {
  const slug    = state.project?.clientSlug || '';
  const deploy  = state.project?.deploy;

  // Use project domain as the canonical web URL — deploy.host is the FTP hostname only
  const base = (state.project?.domain || '').replace(/\\/+$/, '');

  // Project-level sitemap index (all campaigns)
  const indexSitemapUrl = \`\${base}/sitemap-index.xml\`;
  const robotsUrl = \`\${base}/robots.txt\`;

  // Campaign-specific sitemap: prefer active campaign ID, else find newest campaign entry from registry
  const cid = state.campaignId;
  let campaignSitemapUrl = cid ? \`\${base}/sitemap-\${encodeURIComponent(cid)}.xml\` : '';
  if (!campaignSitemapUrl && slug) {
    try {
      const regRes = await apiFetch('/api/sitemap-registry');
      if (regRes.ok) {
        const regData = await regRes.json();
        const allEntries = regData.entries || [];
        const campaignEntries = allEntries
          .filter(e => !e.sitemapUrl.endsWith('/sitemap.xml') && !e.sitemapUrl.endsWith('/sitemap-index.xml'))
          .sort((a, b) => new Date(b.addedAt).getTime() - new Date(a.addedAt).getTime());
        if (campaignEntries.length) campaignSitemapUrl = campaignEntries[0].sitemapUrl;
      }
    } catch (_) { /* non-fatal */ }
  }
  if (!campaignSitemapUrl) campaignSitemapUrl = indexSitemapUrl;

  // Populate URL displays
  document.getElementById('sc-sitemap-url').textContent = campaignSitemapUrl;
  document.getElementById('sc-sitemap-link').href = campaignSitemapUrl;
  const indexEl   = document.getElementById('sc-index-url');
  const indexLink = document.getElementById('sc-index-link');
  if (indexEl)   indexEl.textContent = indexSitemapUrl;
  if (indexLink) indexLink.href = indexSitemapUrl;
  document.getElementById('sc-robots-url').textContent  = robotsUrl;
  document.getElementById('sc-robots-link').href  = robotsUrl;

  // Show project email as the GSC account to grant access
  const email = state.project?.email || '(your Google account email)';
  document.getElementById('sc-gsc-email').textContent = email;

  // Populate subdomain hint elements dynamically
  try {
    const hostname = new URL(base).hostname; // e.g. local.inboxingproweb.com
    const origin   = new URL(base).origin + '/';
    const hintEl   = document.getElementById('sc-domain-hint');
    const propEl   = document.getElementById('sc-property-url');
    const linkEl   = document.getElementById('sc-add-property-link');
    if (hintEl) hintEl.textContent = hostname;
    if (propEl) propEl.textContent = origin;
    if (linkEl) {
      // Pre-fill GSC welcome page with the URL-prefix property type
      linkEl.href = 'https://search.google.com/search-console/welcome';
    }
  } catch { /* no-op */ }

  // Render manual step-by-step instructions
  renderManualSteps(campaignSitemapUrl);

  // Load persisted indexing status from server
  if (slug) {
    try {
      const res = await apiFetch(\`/api/search-console/status?projectSlug=\${enc(slug)}\`);
      if (res.ok) {
        const data = await res.json();
        state.indexingStatus = data.status || null;
        updateScBadges();
      }
    } catch (_) { /* non-fatal */ }

    // Load existing index tracking report (non-fatal)
    try {
      const itRes  = await apiFetch(\`/api/index-tracking?projectSlug=\${enc(slug)}\`);
      if (itRes.ok) {
        const itData = await itRes.json();
        itRenderReport(itData.report || null);
      }
    } catch (_) { /* non-fatal */ }

    // Refresh GSC connection status (updates Stage 1 connect panel + Stage 8 status bar)
    try { await App.refreshGscStatus(); } catch (_) { /* non-fatal */ }

    // Handle gsc_error URL params
    const params = new URLSearchParams(window.location.search);
    if (params.has('gsc_error')) {
      const errEl = document.getElementById('it-run-error');
      if (errEl) {
        errEl.textContent = 'Google auth error: ' + decodeURIComponent(params.get('gsc_error') || '');
        errEl.classList.remove('hidden');
      }
      window.history.replaceState({}, '', window.location.pathname);
    }

    // Load existing keyword tracking report (non-fatal)
    try {
      const ktRes  = await apiFetch(\`/api/keyword-tracking?projectSlug=\${enc(slug)}\`);
      if (ktRes.ok) {
        const ktData = await ktRes.json();
        ktRenderReport(ktData.report || null);
      }
    } catch (_) { /* non-fatal */ }
  }
};

App.runAllChecks = async function() {
  const lbl = document.getElementById('run-all-label');
  lbl.style.display = 'inline';
  try {
    await App.itRunCheck();
    await App.ktRunCheck();
  } finally {
    lbl.style.display = 'none';
  }
};

function updateScBadges() {
  const st          = state.indexingStatus;
  const badge       = document.getElementById('sc-access-badge');
  const submitBadge = document.getElementById('sc-submit-badge');
  if (!st) {
    badge.textContent = 'not connected';
    badge.className   = 'sc-status-badge sc-status-not-connected';
    submitBadge.classList.add('hidden');
    return;
  }
  if (st.sitemapSubmittedAt) {
    badge.textContent = 'access granted';
    badge.className   = 'sc-status-badge sc-status-granted';
    submitBadge.classList.remove('hidden');
  } else if (st.sitemapAccessible) {
    badge.textContent = 'sitemap accessible';
    badge.className   = 'sc-status-badge sc-status-granted';
  } else {
    badge.textContent = 'not connected';
    badge.className   = 'sc-status-badge sc-status-not-connected';
  }
}

App.switchScTab = function(tab) {
  document.getElementById('sc-tab-a').classList.toggle('selected', tab === 'a');
  document.getElementById('sc-tab-b').classList.toggle('selected', tab === 'b');
  document.getElementById('sc-panel-a').classList.toggle('hidden', tab !== 'a');
  document.getElementById('sc-panel-b').classList.toggle('hidden', tab !== 'b');
};

// ── Template suggestion ───────────────────────────────────────────────────────
// Maps industry type values to the most suitable template.
const INDUSTRY_TEMPLATE_MAP = {
  web_design:       'inboxingproweb_default',
  digital_marketing:'inboxingproweb_default',
  seo_agency:       'inboxingproweb_default',
  plumbing:         'trades_home_services',
  electrical:       'trades_home_services',
  building_trades:  'trades_home_services',
  cleaning:         'trades_home_services',
  landscaping:      'trades_home_services',
  beauty:           'beauty_clinic',
  hair_salon:       'beauty_clinic',
  aesthetics:       'beauty_clinic',
  healthcare:       'beauty_clinic',
  accountancy:      'professional_services',
  legal:            'professional_services',
  financial_advice: 'professional_services',
  consulting:       'professional_services',
  retail:           'retail_local_shop',
  restaurant:       'retail_local_shop',
};

App.suggestTemplate = function(industryValue) {
  const suggested = INDUSTRY_TEMPLATE_MAP[industryValue];
  if (!suggested) return;
  const sel = document.getElementById('templateId');
  if (sel && !sel.dataset.userSelected) {
    sel.value = suggested;
  }
};

// Mark templateId as user-selected once changed manually so auto-suggest stops overriding it
(function() {
  document.addEventListener('DOMContentLoaded', function() {
    const sel = document.getElementById('templateId');
    if (sel) sel.addEventListener('change', function() { sel.dataset.userSelected = '1'; });
  });
})();

App.copySitemapUrl = async function(ev) {
  const url = document.getElementById('sc-sitemap-url').textContent || '';
  try {
    await navigator.clipboard.writeText(url);
    const btn = ev.target;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  } catch (_) { alert(url); }
};

App.copyIndexUrl = async function(ev) {
  const url = document.getElementById('sc-index-url').textContent || '';
  try {
    await navigator.clipboard.writeText(url);
    const btn = ev.target;
    btn.textContent = '✓ Copied';
    setTimeout(() => { btn.textContent = 'Copy'; }, 1800);
  } catch (_) { alert(url); }
};

App.rebuildSitemaps = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) { alert('No project loaded.'); return; }
  const btn    = document.getElementById('btn-rebuild-sitemaps');
  const status = document.getElementById('rebuild-status');
  const result = document.getElementById('rebuild-result');
  btn.disabled    = true;
  btn.textContent = '↻ Rebuilding…';
  status.textContent = '';
  result.className = 'alert hidden';
  try {
    const ctrl = new AbortController();
    const tid = setTimeout(() => ctrl.abort(), 120000); // 2 min timeout
    const res  = await apiFetch('/api/sitemap/rebuild', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientSlug: slug }),
      signal:  ctrl.signal,
    });
    clearTimeout(tid);
    const raw = await res.text();
    let data;
    try { data = JSON.parse(raw); } catch(_) { throw new Error('Server returned an unexpected response (HTTP ' + res.status + '). Check the server is running and try again.'); }
    if (!res.ok) throw new Error(data.error || 'Rebuild failed');
    // Update the displayed URLs
    const base = (state.project?.domain || '').replace(/\\/+$/, '');
    const cid  = state.campaignId;
    const campaignUrl = cid ? \`\${base}/sitemap-\${encodeURIComponent(cid)}.xml\` : data.projectSitemap;
    document.getElementById('sc-sitemap-url').textContent = campaignUrl;
    document.getElementById('sc-sitemap-link').href = campaignUrl;
    const indexEl   = document.getElementById('sc-index-url');
    const indexLink = document.getElementById('sc-index-link');
    if (indexEl)   { indexEl.textContent = data.indexSitemap; }
    if (indexLink) { indexLink.href = data.indexSitemap; }
    const ftpLine = data.ftpError
      ? \`<br><span style="color:#b45309">⚠ FTP upload failed: \${esc(data.ftpError)}</span>\`
      : data.ftpUploaded && data.ftpUploaded.length
        ? \`<br><span style="color:#15803d">↑ Uploaded to server: \${data.ftpUploaded.join(', ')}</span>\`
        : '';
    const lines = [
      \`<strong>✓ Sitemaps rebuilt</strong> — \${data.totalPages} pages across \${data.campaignSitemaps.length} campaign(s)\`,
      data.campaignSitemaps.map(c => \`&nbsp;&nbsp;• \${esc(c.label)}: <a href="\${esc(c.url)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(c.url)}</a>\`).join('<br>'),
      \`&nbsp;&nbsp;• Project index: <a href="\${esc(data.indexSitemap)}" target="_blank" style="color:var(--primary);text-decoration:underline">\${esc(data.indexSitemap)}</a>\`,
    ].filter(Boolean).join('<br>') + ftpLine;
    result.className = 'alert alert-success';
    result.innerHTML = lines;
    status.textContent = \`Last rebuilt: \${new Date().toLocaleTimeString()}\`;
  } catch (e) {
    result.className = 'alert alert-error';
    result.innerHTML = \`<strong>Rebuild failed:</strong> \${esc(e.message)}\`;
  } finally {
    btn.disabled    = false;
    btn.textContent = '↻ Rebuild All Sitemaps';
  }
};

App.regenerateAndDeployAllPages = async function() {
  const slug       = state.project?.clientSlug;
  const campaignId = state.campaignId;
  if (!slug) { alert('No project loaded.'); return; }
  if (!campaignId) { alert('No active campaign — resume a campaign first.'); return; }

  const btn    = document.getElementById('btn-regen-deploy');
  const status = document.getElementById('regen-deploy-status');
  const logEl  = document.getElementById('regen-deploy-log');
  const result = document.getElementById('regen-deploy-result');

  btn.disabled    = true;
  btn.textContent = '⚡ Starting…';
  if (status) status.textContent = 'Starting rollout…';
  if (result) result.className   = 'alert hidden';
  if (logEl)  { logEl.style.display = 'block'; logEl.innerHTML = ''; }

  function addLog(text, cls) {
    if (!logEl) return;
    const line = document.createElement('div');
    line.style.color = cls === 'ok' ? '#4ade80' : cls === 'err' ? '#f87171' : '#94a3b8';
    line.textContent = text;
    logEl.appendChild(line);
    logEl.scrollTop = logEl.scrollHeight;
  }

  let jobId;
  try {
    const startRes = await apiFetch('/api/rollout', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientSlug: slug, campaignId }),
    });
    if (!startRes.ok) {
      const err = await startRes.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to start rollout');
    }
    const startData = await startRes.json();
    jobId = startData.jobId;
    addLog(\`Job started (\${jobId.slice(0, 8)})…\`);
  } catch (e) {
    if (result) { result.className = 'alert alert-error'; result.innerHTML = \`<strong>Failed to start:</strong> \${esc(e.message)}\`; }
    if (status) status.textContent = '';
    if (logEl)  logEl.style.display = 'none';
    btn.disabled    = false;
    btn.textContent = '⚡ Regenerate & Deploy All Pages';
    return;
  }

  if (status) status.textContent = 'Regenerating pages…';

  let lastEventIdx    = 0;
  let jobDone         = false;
  let consecutiveFails = 0;
  let succeeded = 0, failed = 0;

  while (!jobDone) {
    await new Promise(r => setTimeout(r, 2000));
    let job;
    try {
      const pollRes = await apiFetch('/api/rollout/status/' + jobId);
      if (!pollRes.ok) { consecutiveFails++; if (consecutiveFails >= 3) jobDone = true; continue; }
      consecutiveFails = 0;
      job = await pollRes.json();
    } catch (_) { consecutiveFails++; if (consecutiveFails >= 3) jobDone = true; continue; }

    const newEvents = (job.events || []).slice(lastEventIdx);
    lastEventIdx = (job.events || []).length;

    for (const ev of newEvents) {
      if (ev.type === 'progress') {
        addLog(\`[\${ev.tier}] \${ev.area} — \${ev.step} (\${ev.durationMs}ms)\`, ev.status === 'success' ? 'ok' : 'err');
      } else if (ev.type === 'done') {
        const t = ev.log?.totals || {};
        succeeded = t.succeeded ?? 0;
        failed    = t.failed    ?? 0;
        const total = t.totalOnDisk ?? succeeded;
        addLog(\`Done — \${succeeded} generated, \${failed} failed, \${total} total on disk\`, 'ok');
        state.rolloutLog = ev.log;
        await saveSession().catch(() => {});
        jobDone = true;
        break;
      } else if (ev.type === 'error') {
        addLog('[error] ' + ev.message, 'err');
      }
    }

    if (job.status === 'done' || job.status === 'error' || job.status === 'cancelled') jobDone = true;
  }

  btn.disabled    = false;
  btn.textContent = '⚡ Regenerate & Deploy All Pages';

  if (succeeded > 0 && failed === 0) {
    if (result) { result.className = 'alert alert-success'; result.innerHTML = \`<strong>✓ \${succeeded} page(s) regenerated and deployed</strong> successfully.\`; }
    if (status) status.textContent = \`Last run: \${new Date().toLocaleTimeString()}\`;
  } else if (succeeded > 0) {
    if (result) { result.className = 'alert alert-success'; result.innerHTML = \`<strong>✓ \${succeeded} ok</strong>, \${failed} failed — FTP may be rate-limiting, try again in a moment.\`; }
    if (status) status.textContent = \`Last run: \${new Date().toLocaleTimeString()}\`;
  } else {
    if (result) { result.className = 'alert alert-error'; result.innerHTML = \`<strong>No pages generated.</strong> Check the rollout log above for errors.\`; }
    if (status) status.textContent = '';
  }
};

App.deployAllPages = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) { alert('No project loaded.'); return; }
  const btn    = document.getElementById('btn-deploy-all');
  const status = document.getElementById('deploy-all-status');
  const result = document.getElementById('deploy-all-result');
  btn.disabled    = true;
  btn.textContent = '🚀 Deploying…';
  if (status) status.textContent = 'Uploading pages to server…';
  if (result) result.className = 'alert hidden';
  try {
    const res  = await apiFetch('/api/pages/deploy', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ clientSlug: slug }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Deploy failed');
    const failNote = data.failedCount > 0
      ? \`<br><span style="color:#b45309">⚠ \${data.failedCount} page(s) failed — FTP may be rate-limiting, try again in a moment.</span>\`
      : '';
    if (result) {
      result.className = 'alert alert-success';
      result.innerHTML = \`<strong>✓ \${data.uploadedCount} page(s) deployed</strong> successfully.\${failNote}\`;
    }
    if (status) status.textContent = \`Last deployed: \${new Date().toLocaleTimeString()}\`;
  } catch (e) {
    if (result) {
      result.className = 'alert alert-error';
      result.innerHTML = \`<strong>Deploy failed:</strong> \${esc(e.message)}\`;
    }
    if (status) status.textContent = '';
  } finally {
    btn.disabled    = false;
    btn.textContent = '🚀 Deploy All Pages';
  }
};

App.submitProjectSitemap = async function() {
  const slug       = state.project?.clientSlug;
  const indexUrl   = document.getElementById('sc-index-url')?.textContent || '';
  const resultEl   = document.getElementById('sc-submit-result');
  const btn        = document.getElementById('btn-submit-project-sitemap');
  const badge      = document.getElementById('sc-project-submit-badge');
  if (!slug) { alert('No project loaded.'); return; }
  if (!indexUrl || indexUrl === '—') {
    alert('No project sitemap index found — click "Rebuild All Sitemaps" first.');
    return;
  }
  btn.disabled    = true;
  btn.textContent = 'Submitting…';
  try {
    const res  = await apiFetch('/api/search-console/submit-sitemap', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ projectSlug: slug, sitemapUrl: indexUrl }),
    });
    const data = await res.json();
    if (data.success) {
      badge.classList.remove('hidden');
      resultEl.className = 'alert alert-success';
      resultEl.innerHTML = \`<strong>✓ Project sitemap submitted</strong><br>
        <span style="font-size:.82rem">Open GSC Sitemaps to confirm: 
          <a href="\${esc(data.gscUrl)}" target="_blank" style="color:var(--primary)">Open GSC ↗</a>
        </span>\`;
      window.open(data.gscUrl, '_blank');
    } else {
      throw new Error(data.error || 'Submit failed');
    }
  } catch (e) {
    resultEl.className = 'alert alert-error';
    resultEl.innerHTML = \`<strong>Submit failed:</strong> \${esc(e.message)}\`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Project Sitemap';
  }
};

App.checkAccess = async function() {
  const slug       = state.project?.clientSlug || '';
  // sc-sitemap-url is in Stage 8; if not yet loaded, compute from project domain
  const raw        = document.getElementById('sc-sitemap-url')?.textContent || '';
  const base       = (state.project?.domain || '').replace(/\\/+$/, '');
  const sitemapUrl = (raw && raw !== '—') ? raw : (base ? base + '/sitemap-index.xml' : '');
  const resultEl   = document.getElementById('sc-check-result');
  const badge      = document.getElementById('sc-access-badge');
  const btn        = document.getElementById('btn-check-access');

  btn.disabled      = true;
  btn.textContent   = 'Checking…';
  badge.textContent = 'checking…';
  badge.className   = 'sc-status-badge sc-status-checking';
  resultEl.className = 'alert hidden';

  try {
    const params = new URLSearchParams({ projectSlug: slug, sitemapUrl });
    const res    = await apiFetch(\`/api/search-console/check-access?\${params}\`);
    const data   = await res.json();

    if (data.accessible) {
      badge.textContent = 'sitemap accessible';
      badge.className   = 'sc-status-badge sc-status-granted';
      resultEl.className = 'alert alert-success';
      resultEl.innerHTML = \`<strong>✓ Sitemap is publicly accessible</strong><br><span style="font-size:.82rem">Checked: \${data.checkedAt}</span>\`;
      if (!state.indexingStatus) state.indexingStatus = {};
      state.indexingStatus.sitemapAccessible = true;
    } else {
      badge.textContent = 'not accessible';
      badge.className   = 'sc-status-badge sc-status-not-connected';
      resultEl.className = 'alert alert-warn';
      resultEl.innerHTML = \`<strong>⚠ Sitemap not reachable</strong><br><span style="font-size:.82rem">\${esc(data.error || 'Could not fetch sitemap URL — check deployment.')}</span>\`;
    }
  } catch (e) {
    resultEl.className = 'alert alert-error';
    resultEl.innerHTML = \`<strong>Request failed:</strong> \${esc(e.message)}\`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Check Access';
  }
};

App.submitSitemap = async function() {
  const slug       = state.project?.clientSlug;
  const campaignId = state.campaignId;
  const sitemapUrl = document.getElementById('sc-sitemap-url').textContent || '';
  const resultEl   = document.getElementById('sc-submit-result');
  const btn        = document.getElementById('btn-submit-sitemap');
  const submitBadge = document.getElementById('sc-submit-badge');

  if (!slug) { alert('No project loaded.'); return; }

  btn.disabled    = true;
  btn.textContent = 'Submitting…';

  try {
    const res  = await apiFetch('/api/search-console/submit-sitemap', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ projectSlug: slug, sitemapUrl, campaignId }),
    });
    const data = await res.json();

    if (data.success) {
      if (!state.indexingStatus) state.indexingStatus = {};
      Object.assign(state.indexingStatus, { sitemapSubmittedAt: data.submittedAt, sitemapUrl });
      // Mark campaign as deployed in local state so the campaign bar updates immediately
      if (campaignId && state._campaignMeta) {
        const meta = state._campaignMeta.find(x => x.id === campaignId);
        if (meta) meta.status = 'deployed';
        App.updateCampaignBar();
      }
      submitBadge.classList.remove('hidden');
      document.getElementById('sc-access-badge').textContent = 'access granted';
      document.getElementById('sc-access-badge').className   = 'sc-status-badge sc-status-granted';
      resultEl.className = 'alert alert-success';
      resultEl.innerHTML = \`
        <strong>✓ Submission logged</strong> — logged at \${data.submittedAt}<br>
        <span style="font-size:.82rem">Now submit the sitemap in Google Search Console:<br>
        <a href="\${esc(data.gscUrl)}" target="_blank" style="color:var(--brand);font-weight:600">\${esc(data.gscUrl)}</a>
        </span>\`;
    } else {
      resultEl.className = 'alert alert-error';
      resultEl.innerHTML = \`<strong>Failed:</strong> \${esc(data.error || 'Unknown error')}\`;
    }
  } catch (e) {
    resultEl.className = 'alert alert-error';
    resultEl.innerHTML = \`<strong>Request failed:</strong> \${esc(e.message)}\`;
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Submit Sitemap';
  }
};

function sitemapOrigin(url) {
  try { return new URL(url).origin; } catch {
    const i = url.lastIndexOf('/sitemap');
    return i > 0 ? url.slice(0, i) : url;
  }
}

function renderManualSteps(sitemapUrl) {
  const origin = sitemapOrigin(sitemapUrl);
  const steps  = [
    { n: 1, html: \`Go to <a href="https://search.google.com/search-console/welcome" target="_blank" style="color:var(--brand)">Google Search Console → Add Property</a> and add <strong>\${esc(origin)}/</strong> as a <em>URL prefix</em> property (subdomains must be added separately from the root domain)\` },
    { n: 2, html: \`Complete <strong>ownership verification</strong> — Google will offer options such as HTML file upload, DNS TXT record, or Google Analytics. Complete any one of them\` },
    { n: 3, html: \`Once verified, go to <strong>Sitemaps</strong> in the left sidebar\` },
    { n: 4, html: \`In "Add a new sitemap", paste: <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px">\${esc(sitemapUrl)}</code>\` },
    { n: 5, html: \`Click <strong>Submit</strong>\` },
    { n: 6, html: \`Status should change to <em>Success</em> within a few minutes\` },
  ];
  const el = document.getElementById('sc-manual-steps');
  el.innerHTML = steps.map(s =>
    \`<div class="sc-manual-step">
      <div class="sc-manual-num">\${s.n}.</div>
      <div class="sc-step-text">\${s.html}</div>
    </div>\`
  ).join('');
}

App.copyManualInstructions = async function() {
  const sitemapUrl = document.getElementById('sc-sitemap-url').textContent || '';
  const origin     = sitemapOrigin(sitemapUrl);
  const text       = [
    'Google Search Console — Sitemap Submission',
    '',
    \`Sitemap URL: \${sitemapUrl}\`,
    '',
    \`IMPORTANT: \${origin} is a subdomain. It must be added and verified as a separate GSC property.\`,
    '',
    '1. Go to https://search.google.com/search-console/welcome',
    \`   Add "\${origin}/" as a URL prefix property\`,
    '2. Complete ownership verification (HTML file, DNS TXT record, or Google Analytics)',
    '3. Once verified, click Sitemaps in the left sidebar',
    \`4. Paste the sitemap URL: \${sitemapUrl}\`,
    '5. Click Submit',
    '6. Confirm status shows Success',
  ].join('\\n');

  try {
    await navigator.clipboard.writeText(text);
    const el = document.getElementById('sc-copy-confirm');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), 2200);
  } catch (_) { alert(text); }
};

// ═══════════════════════════════════════════════════════════════════
// Stage 8 — Index Tracking Dashboard
// ═══════════════════════════════════════════════════════════════════

function itUpdateConnectionUI(creds, status) {
  const neededEl  = document.getElementById('it-connect-needed');
  const okEl      = document.getElementById('it-connect-ok');
  const setupEl   = document.getElementById('it-connect-setup-needed');
  const callbackEl= document.getElementById('it-callback-url');
  const methodEl  = document.getElementById('it-connect-method');
  const runBtn    = document.getElementById('btn-it-run');

  if (status.connected) {
    // OAuth token present — fully connected
    neededEl.classList.add('hidden');
    okEl.classList.remove('hidden');
    if (methodEl) methodEl.textContent = '(Google account)';
  } else {
    // Not connected via OAuth — always show the Connect button
    neededEl.classList.remove('hidden');
    okEl.classList.add('hidden');
    // If service account is still present it acts as a limited fallback —
    // leave the Run button enabled so existing tracking still works
    if (!creds.configured) {
      if (runBtn) runBtn.disabled = true;
    }
    if (callbackEl && status.callbackUrl) callbackEl.textContent = status.callbackUrl;
    // Show one-time setup instructions only if client ID/secret not yet saved
    if (!status.clientConfigured && setupEl) {
      setupEl.classList.remove('hidden');
    }
  }
}

App.gscDisconnect = async function() {
  if (!confirm('Disconnect Google Search Console?')) return;
  try {
    await apiFetch('/api/gsc/auth/disconnect', { method: 'DELETE' });
    const neededEl = document.getElementById('it-connect-needed');
    const okEl     = document.getElementById('it-connect-ok');
    if (neededEl) neededEl.classList.remove('hidden');
    if (okEl)     okEl.classList.add('hidden');
    const runBtn = document.getElementById('btn-it-run');
    if (runBtn) runBtn.disabled = true;
    // Update Stage 1 badge
    const badge = document.getElementById('s1-gsc-status');
    if (badge) { badge.textContent = 'Not connected'; badge.style.background = '#f1f5f9'; badge.style.color = 'var(--muted)'; }
    // Update Stage 8 status bar
    const statusBar  = document.getElementById('it-gsc-status-text');
    const connectBtn = document.getElementById('it-gsc-status-bar')?.querySelector('button');
    if (statusBar) { statusBar.textContent = 'GSC not connected'; statusBar.style.color = 'var(--muted)'; }
    if (connectBtn) connectBtn.style.display = '';
  } catch (e) { alert('Disconnect failed: ' + e.message); }
};

function itRenderReport(report) {
  const info = document.getElementById('it-run-info');
  if (report) {
    const d = new Date(report.runAt);
    const fmt = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
              + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    info.innerHTML = \`Last run: <strong>\${fmt}</strong> &mdash; checked \${report.totalChecked} of \${report.records.length} URLs\`;
  } else {
    info.innerHTML = 'No tracking data yet &mdash; click <strong>Run Check</strong> to start.';
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (report) {
    set('it-stat-indexed',     report.indexedCount);
    set('it-stat-not-indexed', report.notIndexedCount);
    set('it-stat-unknown',     report.unknownCount);
    set('it-stat-total',       report.records.length);
  } else {
    ['it-stat-indexed','it-stat-not-indexed','it-stat-unknown','it-stat-total']
      .forEach(id => set(id, '—'));
  }

  const tbody = document.getElementById('it-table-body');
  const wrap  = document.getElementById('it-table-wrap');

  if (!report || !report.records.length) {
    wrap.classList.add('hidden');
    return;
  }

  wrap.classList.remove('hidden');

  const badgeClass = { indexed: 'it-badge-indexed', not_indexed: 'it-badge-not-indexed', unknown: 'it-badge-unknown' };
  const badgeLabel = { indexed: '✓ Indexed', not_indexed: '✗ Not Indexed', unknown: '? Unknown' };

  tbody.innerHTML = report.records.map(r => {
    const bc = badgeClass[r.status] || 'it-badge-unknown';
    const bl = badgeLabel[r.status] || r.status;
    const checked = r.lastCheckedAt
      ? new Date(r.lastCheckedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    const first = r.firstDetectedIndexedAt
      ? new Date(r.firstDetectedIndexedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    return \`<tr>
      <td><a href="\${esc(r.url)}" target="_blank" style="color:var(--brand);font-family:monospace;font-size:.82rem">\${esc(r.url)}</a></td>
      <td><span class="it-badge \${bc}">\${bl}</span></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.82rem">\${checked}</td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.82rem">\${first}</td>
    </tr>\`;
  }).join('');
}

App.itRefresh = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  const errEl = document.getElementById('it-run-error');
  errEl.classList.add('hidden');
  try {
    const res  = await apiFetch(\`/api/index-tracking?projectSlug=\${enc(slug)}\`);
    const data = await res.json();
    itRenderReport(data.report || null);
  } catch (e) {
    errEl.textContent = 'Refresh failed: ' + e.message;
    errEl.classList.remove('hidden');
  }
};

App.itRunCheck = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) { alert('No project loaded.'); return; }

  const btn      = document.getElementById('btn-it-run');
  const label    = document.getElementById('it-running-label');
  const errEl    = document.getElementById('it-run-error');

  btn.disabled    = true;
  btn.textContent = 'Running…';
  if (label) { label.textContent = 'Running via Google Search Console API… usually 30-60 seconds'; label.classList.remove('hidden'); }
  if (errEl) errEl.classList.add('hidden');

  try {
    // Start async job — returns immediately with a jobId
    const startRes = await apiFetch('/api/index-tracking/run', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ projectSlug: slug, limit: 200, delayMs: 300 }),
    });
    const { jobId, error: startErr } = await startRes.json();
    if (!jobId) {
      if (errEl) { errEl.textContent = startErr || 'Failed to start job'; errEl.classList.remove('hidden'); }
      return;
    }
    // Poll until done
    let done = false;
    while (!done) {
      await new Promise(r => setTimeout(r, 4000));
      const pollRes = await apiFetch('/api/index-tracking/job/' + jobId);
      const poll    = await pollRes.json();
      if (poll.status === 'done') {
        done = true;
        if (poll.report) itRenderReport(poll.report);
        else if (errEl) { errEl.textContent = 'Run completed but no report returned'; errEl.classList.remove('hidden'); }
      } else if (poll.status === 'error') {
        done = true;
        if (errEl) { errEl.textContent = poll.error || 'Run failed'; errEl.classList.remove('hidden'); }
      } else {
        if (label) label.textContent = 'Running\u2026 ' + (poll.elapsed || 0) + 's elapsed (checking all pages via GSC)';
      }
    }
  } catch (e) {
    if (errEl) { errEl.textContent = 'Request failed: ' + e.message; errEl.classList.remove('hidden'); }
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Run Check';
    if (label) label.classList.add('hidden');
  }
};

App.itCopyNotIndexed = async function() {
  const rows  = document.querySelectorAll('#it-table-body tr');
  const urls  = [];
  rows.forEach(row => {
    const badge = row.querySelector('.it-badge');
    if (badge && badge.textContent.trim().includes('Not Indexed')) {
      const link = row.querySelector('a');
      if (link) urls.push(link.href);
    }
  });
  if (!urls.length) { alert('No "Not Indexed" URLs found.'); return; }
  try {
    await navigator.clipboard.writeText(urls.join('\\n'));
    const btn = document.getElementById('btn-it-copy-not-indexed');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied ' + urls.length + ' URLs';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch (_) { alert(urls.join('\\n')); }
};

// ═══════════════════════════════════════════════════════════════════
// Stage 8 — Keyword Tracking Dashboard
// ═══════════════════════════════════════════════════════════════════

function ktPosCell(pos) {
  if (pos === null) return '<span style="color:var(--muted);font-size:.82rem">—</span>';
  let cls = '';
  if (pos <= 3)  cls = 'top3';
  else if (pos <= 10) cls = 'top10';
  else if (pos <= 20) cls = 'top20';
  return \`<span class="kt-pos \${cls}">#\${pos}</span>\`;
}

function ktChangeCell(r) {
  if (r.previousPosition === null && r.position !== null) {
    return '<span class="kt-change new">NEW</span>';
  }
  if (r.change === null) return '<span style="color:var(--muted)">—</span>';
  if (r.change > 0)  return \`<span class="kt-change up">↑\${r.change}</span>\`;
  if (r.change < 0)  return \`<span class="kt-change down">↓\${Math.abs(r.change)}</span>\`;
  return '<span style="color:var(--muted)">→</span>';
}

function ktRenderReport(report) {
  const info = document.getElementById('kt-run-info');
  if (report) {
    const d   = new Date(report.runAt);
    const fmt = d.toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
              + ' ' + d.toLocaleTimeString('en-GB', { hour:'2-digit', minute:'2-digit' });
    info.innerHTML = \`Last run: <strong>\${fmt}</strong> — \${report.totalKeywords} keywords checked\`;
  } else {
    info.innerHTML = 'No ranking data yet — click <strong>Run Check</strong> to start.';
  }

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  if (report) {
    set('kt-stat-total',    report.totalKeywords);
    set('kt-stat-ranked',   report.ranked);
    set('kt-stat-improved', report.improved);
    set('kt-stat-dropped',  report.dropped);
    set('kt-stat-new',      report.newRankings);
  } else {
    ['kt-stat-total','kt-stat-ranked','kt-stat-improved','kt-stat-dropped','kt-stat-new']
      .forEach(id => set(id, '—'));
  }

  const tbody = document.getElementById('kt-table-body');
  const wrap  = document.getElementById('kt-table-wrap');

  if (!report || !report.records.length) {
    wrap.classList.add('hidden');
    return;
  }

  // Sort: ranked first (ascending position), then unranked alphabetically
  const sorted = [...report.records].sort((a, b) => {
    if (a.position !== null && b.position !== null) return a.position - b.position;
    if (a.position !== null) return -1;
    if (b.position !== null) return  1;
    return a.keyword.localeCompare(b.keyword);
  });

  wrap.classList.remove('hidden');

  tbody.innerHTML = sorted.map(r => {
    const checked = r.lastCheckedAt
      ? new Date(r.lastCheckedAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' })
      : '—';
    const urlShort = r.targetUrl.replace(/^https?:\\/\\//, '');
    return \`<tr>
      <td style="font-weight:600">\${esc(r.keyword)}</td>
      <td>\${ktPosCell(r.position)}</td>
      <td>\${ktChangeCell(r)}</td>
      <td><a href="\${esc(r.targetUrl)}" target="_blank" style="color:var(--brand);font-family:monospace;font-size:.8rem">\${esc(urlShort)}</a></td>
      <td style="white-space:nowrap;color:var(--muted);font-size:.8rem">\${checked}</td>
    </tr>\`;
  }).join('');
}

App.ktRefresh = async function() {
  const slug  = state.project?.clientSlug;
  if (!slug) return;
  const errEl = document.getElementById('kt-run-error');
  errEl.classList.add('hidden');
  try {
    const res  = await apiFetch(\`/api/keyword-tracking?projectSlug=\${enc(slug)}\`);
    const data = await res.json();
    ktRenderReport(data.report || null);
  } catch (e) {
    errEl.textContent = 'Refresh failed: ' + e.message;
    errEl.classList.remove('hidden');
  }
};

App.ktRunCheck = async function() {
  const slug = state.project?.clientSlug;
  if (!slug) { alert('No project loaded.'); return; }

  const btn   = document.getElementById('btn-kt-run');
  const label = document.getElementById('kt-running-label');
  const errEl = document.getElementById('kt-run-error');

  btn.disabled    = true;
  btn.textContent = 'Running…';
  label.classList.remove('hidden');
  errEl.classList.add('hidden');

  try {
    const res  = await apiFetch('/api/keyword-tracking/run', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ projectSlug: slug, limit: 20, delayMs: 2500 }),
    });
    const data = await res.json();

    if (data.success && data.report) {
      ktRenderReport(data.report);
    } else {
      errEl.textContent = data.error || 'Run failed — check area defs exist for this project';
      errEl.classList.remove('hidden');
    }
  } catch (e) {
    errEl.textContent = 'Request failed: ' + e.message;
    errEl.classList.remove('hidden');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Run Check';
    label.classList.add('hidden');
  }
};

App.ktCopyKeywords = async function() {
  const rows     = document.querySelectorAll('#kt-table-body tr');
  const keywords = [];
  rows.forEach(row => {
    const kw = row.querySelector('td:first-child');
    if (kw) keywords.push(kw.textContent.trim());
  });
  if (!keywords.length) { alert('No keywords to copy.'); return; }
  try {
    await navigator.clipboard.writeText(keywords.join('\\n'));
    const btn = document.getElementById('btn-kt-copy');
    const orig = btn.textContent;
    btn.textContent = '✓ Copied ' + keywords.length + ' keywords';
    setTimeout(() => { btn.textContent = orig; }, 2000);
  } catch (_) { alert(keywords.join('\\n')); }
};

// ═══════════════════════════════════════════════════════════════════
// Session persistence
// ═══════════════════════════════════════════════════════════════════

async function saveSession() {
  const slug = state.project?.clientSlug;
  if (!slug) return;
  localStorage.setItem('seo_wizard_slug', slug);
  const cid = state.campaignId;
  const url = cid ? \`/api/session/\${slug}?campaign=\${encodeURIComponent(cid)}\` : \`/api/session/\${slug}\`;
  const body = JSON.stringify({
    stage: state.stage,
    clientSlug: slug,
    campaignId: cid,
    campaign: state.campaign,
    engineOutput: state.engineOutput,
    selectedAreaDefs: state.selectedAreaDefs,
    keywordOverrides: state.keywordOverrides,
    rolloutLog: state.rolloutLog,
    validation: state.validation,
  });
  try {
    const saves = [apiFetch(url, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body })];
    // When a campaign is active, also bookmark campaignId + stage in the generic session so
    // resumeSession can restore the full campaign context after a page refresh.
    if (cid) {
      saves.push(apiFetch(\`/api/session/\${slug}\`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId: cid, stage: state.stage, clientSlug: slug }),
      }));
    }
    await Promise.all(saves);
  } catch (_) { /* non-fatal */ }
}

async function loadSession(slug, campaignId) {
  const url = campaignId ? \`/api/session/\${slug}?campaign=\${encodeURIComponent(campaignId)}\` : \`/api/session/\${slug}\`;
  const res = await apiFetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  return data.session || null;
}

function checkForSavedSession() {
  const slug = localStorage.getItem('seo_wizard_slug');
  if (!slug) return;
  document.getElementById('resume-banner').style.display = 'block';
  document.getElementById('resume-text').textContent =
    \` Found a saved session for "\${slug}".\`;
}

App.resumeSession = async function() {
  const slug = localStorage.getItem('seo_wizard_slug');
  if (!slug) return;
  try {
    // Load the generic session first — it holds the project config and the campaignId bookmark
    // written by saveSession whenever a campaign is active.
    const genericSession = await loadSession(slug);
    if (!genericSession) { App.dismissResume(); return; }

    // Load project config from disk (or fall back to what's in the generic session)
    const pRes = await apiFetch(\`/api/projects/\${slug}\`);
    if (pRes.ok) { const pd = await pRes.json(); state.project = pd.project; }
    if (!state.project) state.project = genericSession.project || null;

    const savedCampaignId = genericSession.campaignId;
    let session = genericSession;

    if (savedCampaignId) {
      // Reload the full campaign-specific session (which has up-to-date stage, selectedAreaDefs, etc.)
      const campaignSession = await loadSession(slug, savedCampaignId);
      if (campaignSession) {
        session = campaignSession;
        state.campaignId = savedCampaignId;
      }
    }

    state.campaign         = session.campaign         || null;
    state.engineOutput     = session.engineOutput     || null;
    state.selectedAreaDefs = session.selectedAreaDefs || [];
    state.keywordOverrides = session.keywordOverrides || {};
    state.rolloutLog       = session.rolloutLog       || null;
    state.validation       = session.validation       || null;

    const targetStage = Math.min(session.stage || 1, 8);
    showStage(targetStage);
    App.onStageEnter(targetStage);

    if (state.project) {
      populateStage1Form(state.project);
      syncProjectSelectors(slug, state.project.businessName);
    }

    App.dismissResume();
  } catch (e) {
    alert('Failed to resume session: ' + e.message);
  }
};

App.dismissResume = function() {
  document.getElementById('resume-banner').style.display = 'none';
};

// ═══════════════════════════════════════════════════════════════════
// Utility helpers
// ═══════════════════════════════════════════════════════════════════

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value : '';
}

function setVal(id, val) {
  const el = document.getElementById(id);
  if (el) el.value = val;
}

function esc(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function enc(s) {
  return encodeURIComponent(s);
}

function showError(id, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}

function clearErrors() {
  document.querySelectorAll('.alert-error').forEach(el => el.classList.add('hidden'));
  document.querySelectorAll('.field.has-error').forEach(el => el.classList.remove('has-error'));
}

function setFieldError(fieldId, msg) {
  const field = document.getElementById(fieldId);
  if (!field) return;
  field.classList.add('has-error');
  const errEl = field.querySelector('.field-error');
  if (errEl && msg) errEl.textContent = msg;
}

// ═══════════════════════════════════════════════════════════════════
// Social Post Generator (SP)
// ═══════════════════════════════════════════════════════════════════

const SP = (() => {
  const PLATFORM_META = {
    gbp:       { label: 'Google Business Profile', icon: '🗺' },
    facebook:  { label: 'Facebook',                icon: '📘' },
    instagram: { label: 'Instagram',               icon: '📸' },
    linkedin:  { label: 'LinkedIn',                icon: '💼' },
  };

  let _lastParams = null;   // saved so we can regenerate individual platforms

  // ── open / close ────────────────────────────────────────────────
  function open() {
    document.getElementById('sp-panel').style.display = 'block';
    document.body.style.overflow = 'hidden';
    // Pre-fill from wizard state
    if (state.project) {
      const biz = document.getElementById('sp-biztype');
      if (!biz.value && state.project.businessType) biz.value = state.project.businessType;
      const loc = document.getElementById('sp-location');
      if (!loc.value && state.campaign?.cityName) loc.value = state.campaign.cityName;
    }
    loadPages();
    loadHistory();
  }

  function close() {
    document.getElementById('sp-panel').style.display = 'none';
    document.body.style.overflow = '';
  }

  // ── link type toggle ────────────────────────────────────────────
  function onLinkTypeChange(val) {
    document.getElementById('sp-page-picker').style.display = val === 'page' ? 'block' : 'none';
    document.getElementById('sp-custom-url').style.display  = val === 'custom' ? 'block' : 'none';
  }

  // ── load generated pages ────────────────────────────────────────
  async function loadPages() {
    const slug = state.project?.clientSlug;
    if (!slug) return;
    try {
      const r = await apiFetch(\`/api/social-posts/pages/\${slug}\`);
      if (!r.ok) return;
      const { pages } = await r.json();
      const sel = document.getElementById('sp-page-picker');
      sel.innerHTML = '<option value="">— select a page —</option>';
      (pages || []).forEach(p => {
        const o = document.createElement('option');
        o.value = p.url;
        o.textContent = p.label;
        sel.appendChild(o);
      });
    } catch { /* silently skip */ }
  }

  // ── resolve link URL ────────────────────────────────────────────
  function getLinkUrl() {
    const type = document.querySelector('input[name="sp-link-type"]:checked')?.value || 'homepage';
    if (type === 'homepage') return state.project?.domain || window.location.origin;
    if (type === 'page')     return document.getElementById('sp-page-picker').value || '#';
    if (type === 'custom')   return document.getElementById('sp-custom-url').value || '#';
    return '#';
  }

  // ── get selected platforms ──────────────────────────────────────
  function getSelectedPlatforms() {
    return [...document.querySelectorAll('.sp-platforms input[type=checkbox]:checked')].map(cb => cb.value);
  }

  // ── generate all posts ──────────────────────────────────────────
  async function generate(overridePlatforms) {
    const topic       = document.getElementById('sp-topic').value.trim();
    const businessType= document.getElementById('sp-biztype').value.trim();
    const location    = document.getElementById('sp-location').value.trim();
    const postObjective = document.getElementById('sp-objective').value;
    const linkUrl     = getLinkUrl();
    const platforms   = overridePlatforms || getSelectedPlatforms();

    const errEl = document.getElementById('sp-gen-error');
    errEl.style.display = 'none';

    if (!topic)        { errEl.textContent = 'Please enter a topic or keyword.'; errEl.style.display = 'block'; return; }
    if (!businessType) { errEl.textContent = 'Please enter the business type.'; errEl.style.display = 'block'; return; }
    if (!location)     { errEl.textContent = 'Please enter a location.'; errEl.style.display = 'block'; return; }
    if (!platforms.length){ errEl.textContent = 'Please select at least one platform.'; errEl.style.display = 'block'; return; }

    _lastParams = { topic, businessType, location, postObjective, linkUrl, platforms };

    const btn = document.getElementById('sp-gen-btn');
    btn.disabled = true;
    btn.textContent = 'Generating…';
    document.getElementById('sp-empty-state').style.display = 'none';
    document.getElementById('sp-loading').style.display = 'block';
    document.getElementById('sp-results').style.display = 'none';

    try {
      const res = await apiFetch('/api/social-posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, businessType, location, postObjective, linkUrl, platforms }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Generation failed');

      renderCards(data.posts, overridePlatforms != null);
    } catch (e) {
      errEl.textContent = e.message || 'Generation failed. Please try again.';
      errEl.style.display = 'block';
      document.getElementById('sp-empty-state').style.display = 'block';
    } finally {
      document.getElementById('sp-loading').style.display = 'none';
      btn.disabled = false;
      btn.textContent = '⚡ Generate Posts';
    }
  }

  // ── render output cards ─────────────────────────────────────────
  function renderCards(posts, merge) {
    const container = document.getElementById('sp-cards');

    if (merge) {
      // Only update the platforms that were just regenerated
      Object.entries(posts).forEach(([key, text]) => {
        const ta = document.getElementById(\`sp-ta-\${key}\`);
        if (ta) ta.value = text;
      });
    } else {
      // Full re-render
      container.innerHTML = '';
      const platformOrder = ['gbp','facebook','instagram','linkedin'];
      const keys = platformOrder.filter(k => posts[k] !== undefined);

      keys.forEach(key => {
        const meta = PLATFORM_META[key] || { label: key, icon: '📝' };
        const card = document.createElement('div');
        card.className = 'sp-card';
        card.innerHTML = \`
          <div class="sp-card-header">
            <div class="sp-card-platform">\${meta.icon} \${meta.label}</div>
            <div class="sp-card-actions">
              <button class="btn btn-secondary btn-sm" onclick="SP.regenerateSingle('\${key}')">↻ Regenerate</button>
              <button class="btn btn-ghost btn-sm" onclick="SP.copyPlatform('\${key}')">Copy</button>
            </div>
          </div>
          <div class="sp-card-body">
            <textarea id="sp-ta-\${key}">\${escHtml(posts[key] || '')}</textarea>
          </div>
        \`;
        container.appendChild(card);
      });
    }

    document.getElementById('sp-results').style.display = 'block';
    document.getElementById('sp-save-msg').style.display = 'none';
  }

  function escHtml(s) {
    return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  // ── regenerate all ──────────────────────────────────────────────
  async function regenerateAll() {
    if (!_lastParams) { generate(); return; }
    await generate(_lastParams.platforms);
  }

  // ── regenerate one platform ─────────────────────────────────────
  async function regenerateSingle(platformKey) {
    if (!_lastParams) return;
    const btn = document.querySelector(\`[onclick="SP.regenerateSingle('\${platformKey}')"]\`);
    if (btn) { btn.disabled = true; btn.textContent = '…'; }
    try {
      const res = await apiFetch('/api/social-posts/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ..._lastParams, platforms: [platformKey] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Regeneration failed');
      const ta = document.getElementById(\`sp-ta-\${platformKey}\`);
      if (ta && data.posts[platformKey]) ta.value = data.posts[platformKey];
    } catch (e) {
      alert('Regeneration failed: ' + e.message);
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = '↻ Regenerate'; }
    }
  }

  // ── copy platform text ──────────────────────────────────────────
  function copyPlatform(key) {
    const ta = document.getElementById(\`sp-ta-\${key}\`);
    if (!ta) return;
    navigator.clipboard.writeText(ta.value).then(() => {
      const btn = document.querySelector(\`[onclick="SP.copyPlatform('\${key}')"]\`);
      if (btn) { const orig = btn.textContent; btn.textContent = '✓ Copied'; setTimeout(() => btn.textContent = orig, 2000); }
    });
  }

  // ── save post set ───────────────────────────────────────────────
  async function save() {
    const slug = state.project?.clientSlug;
    if (!slug) { alert('Please load a project first.'); return; }
    if (!_lastParams) return;

    const posts = {};
    ['gbp','facebook','instagram','linkedin'].forEach(k => {
      const ta = document.getElementById(\`sp-ta-\${k}\`);
      if (ta) posts[k] = ta.value;
    });

    const btn = document.getElementById('sp-save-btn');
    btn.disabled = true;
    try {
      const res = await apiFetch(\`/api/social-posts/\${slug}/save\`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ..._lastParams, posts }),
      });
      if (!res.ok) throw new Error('Save failed');
      const msg = document.getElementById('sp-save-msg');
      msg.style.display = 'inline';
      setTimeout(() => msg.style.display = 'none', 3000);
      loadHistory();
    } catch (e) {
      alert('Save failed: ' + e.message);
    } finally {
      btn.disabled = false;
    }
  }

  // ── history ─────────────────────────────────────────────────────
  async function loadHistory() {
    const slug = state.project?.clientSlug;
    const wrap = document.getElementById('sp-history-wrap');
    const list = document.getElementById('sp-history-list');
    if (!slug) { wrap.style.display = 'none'; return; }
    try {
      const res = await apiFetch(\`/api/social-posts/\${slug}\`);
      if (!res.ok) return;
      const { sets } = await res.json();
      if (!sets || !sets.length) { wrap.style.display = 'none'; return; }
      wrap.style.display = 'block';
      list.innerHTML = sets.map(s => {
        const d = new Date(s.createdAt).toLocaleDateString('en-GB', { day:'numeric', month:'short', year:'numeric' });
        const platforms = (s.platforms || []).map(p => (PLATFORM_META[p]?.icon || '📝')).join(' ');
        return \`
          <div class="sp-history-item">
            <div class="sp-history-meta">
              <div class="sp-history-topic">\${escHtml(s.topic)}</div>
              <div class="sp-history-sub">\${escHtml(s.location || '')} · \${escHtml(s.postObjective || '')} · \${platforms} · \${d}</div>
            </div>
            <div style="display:flex;gap:6px;flex-shrink:0">
              <button class="btn btn-ghost btn-sm" onclick="SP.loadSet('\${s.id}')">Load</button>
              <button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="SP.deleteSet('\${s.id}')">✕</button>
            </div>
          </div>
        \`;
      }).join('');
    } catch { wrap.style.display = 'none'; }
  }

  async function loadSet(id) {
    const slug = state.project?.clientSlug;
    if (!slug) return;
    try {
      const res = await apiFetch(\`/api/social-posts/\${slug}\`);
      if (!res.ok) return;
      const { sets } = await res.json();
      const s = sets.find(x => x.id === id);
      if (!s) return;

      // Restore form fields
      document.getElementById('sp-topic').value    = s.topic || '';
      document.getElementById('sp-biztype').value  = s.businessType || '';
      document.getElementById('sp-location').value = s.location || '';
      document.getElementById('sp-objective').value = s.postObjective || 'Generate enquiries';

      // Restore platforms checkboxes
      document.querySelectorAll('.sp-platforms input[type=checkbox]').forEach(cb => {
        cb.checked = (s.platforms || []).includes(cb.value);
      });

      _lastParams = { topic: s.topic, businessType: s.businessType, location: s.location,
                      postObjective: s.postObjective, linkUrl: s.linkUrl, platforms: s.platforms };
      renderCards(s.posts, false);
    } catch (e) { alert('Could not load saved set: ' + e.message); }
  }

  async function deleteSet(id) {
    if (!confirm('Delete this saved post set?')) return;
    const slug = state.project?.clientSlug;
    if (!slug) return;
    try {
      await apiFetch(\`/api/social-posts/\${slug}/\${id}\`, { method: 'DELETE' });
      loadHistory();
    } catch (e) { alert('Delete failed: ' + e.message); }
  }

  return { open, close, onLinkTypeChange, generate, regenerateAll, regenerateSingle, copyPlatform, save, loadSet, deleteSet };
})();

// ═══════════════════════════════════════════════════════════════════
// Boot
// ═══════════════════════════════════════════════════════════════════

document.addEventListener('DOMContentLoaded', () => App.init());
</script>
</body>
</html>`;
}
