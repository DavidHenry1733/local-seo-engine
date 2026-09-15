/**
 * Standalone server-rendered Image Prompts page — no dashboard tab JS dependency.
 */
import { Router, type Request, type Response } from "express";
import {
  exportPromptPack,
  exportSinglePrompt,
  getPrompts,
  listFeaturedHubServices,
  type PromptRow,
} from "../../../../src/image-intelligence/imagePromptDashboardService.ts";

const router = Router();

const DEFAULT_SERVICE = "pharmacy-first";
const DEFAULT_PACK = "clinical-nhs-services";

const PACK_OPTIONS = [
  { packKey: "core-pharmacy", packName: "Core Pharmacy" },
  { packKey: "clinical-nhs-services", packName: "Clinical NHS Services" },
  { packKey: "vaccination-services", packName: "Vaccination Services" },
  { packKey: "private-healthcare-services", packName: "Private Healthcare Services" },
  { packKey: "travel-health-services", packName: "Travel Health Services" },
  { packKey: "weight-management-services", packName: "Weight Management Services" },
] as const;

const DEFAULT_PROMPT_KEYS = [
  "pharmacy-first-consultation",
  "minor-illness-advice",
  "blood-pressure-check",
  "nhs-service-support",
];

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function q(req: Request, key: string): string | undefined {
  const val = req.query[key];
  return typeof val === "string" && val.trim() ? val.trim() : undefined;
}

function buildPageUrl(params: { slug?: string; token?: string; serviceKey?: string; packKey?: string }): string {
  const parts: string[] = [];
  if (params.slug) parts.push(`slug=${encodeURIComponent(params.slug)}`);
  if (params.token) parts.push(`_t=${encodeURIComponent(params.token)}`);
  if (params.serviceKey) parts.push(`serviceKey=${encodeURIComponent(params.serviceKey)}`);
  if (params.packKey) parts.push(`packKey=${encodeURIComponent(params.packKey)}`);
  return `/api/image-prompts${parts.length ? `?${parts.join("&")}` : ""}`;
}

function renderPromptCard(
  prompt: PromptRow,
  idx: number,
  ctx: { token: string; serviceKey: string; packKey: string },
): string {
  const pid = `sip-prompt-${idx}`;
  const nid = `sip-negative-${idx}`;
  const exportQs = [
    `_t=${encodeURIComponent(ctx.token)}`,
    "industry=pharmacy",
    `serviceKey=${encodeURIComponent(ctx.serviceKey)}`,
    `pack=${encodeURIComponent(prompt.imagePack || ctx.packKey)}`,
    `imageKey=${encodeURIComponent(prompt.imageKey)}`,
  ].join("&");

  return `<article class="sip-card" id="sip-card-${esc(prompt.imageKey)}">
  <header class="sip-card-head">
    <h2>${esc(prompt.imageKey)}</h2>
    <div class="sip-meta">Pack: <strong>${esc(prompt.imagePack)}</strong> · Slot: <strong>${esc(prompt.slot)}</strong> · Aspect: <strong>${esc(prompt.aspectRatio)}</strong> · Style: <strong>${esc(prompt.style)}</strong></div>
  </header>
  <div class="sip-actions">
    <button type="button" class="sip-btn" onclick="sipCopy('${pid}','Prompt copied')">Copy Prompt</button>
    <button type="button" class="sip-btn" onclick="sipCopy('${nid}','Negative prompt copied')">Copy Negative Prompt</button>
    <button type="button" class="sip-btn" onclick="sipCopyBoth('${pid}','${nid}')">Copy Both</button>
    <a class="sip-btn sip-btn-link" href="/api/image-prompt-dashboard/export-prompt?${exportQs}" download>Download JSON</a>
  </div>
  <p class="sip-hint">Prompts are visible below — select and copy manually if buttons fail.</p>
  <label class="sip-label" for="${pid}">Ideogram prompt</label>
  <textarea id="${pid}" class="sip-textarea" readonly spellcheck="false">${esc(prompt.prompt)}</textarea>
  <label class="sip-label" for="${nid}">Negative prompt</label>
  <textarea id="${nid}" class="sip-textarea" readonly spellcheck="false">${esc(prompt.negativePrompt)}</textarea>
</article>`;
}

function renderPage(opts: {
  slug: string;
  token: string;
  serviceKey: string;
  packKey: string;
  prompts: PromptRow[];
  services: Array<{ serviceKey: string; serviceName: string }>;
  builtAt: string;
}): string {
  const { slug, token, serviceKey, packKey, prompts, services, builtAt } = opts;
  const packExportQs = [
    `_t=${encodeURIComponent(token)}`,
    "industry=pharmacy",
    `serviceKey=${encodeURIComponent(serviceKey)}`,
    `pack=${encodeURIComponent(packKey)}`,
  ].join("&");
  const dashboardUrl = slug
    ? `/api/dashboard?slug=${encodeURIComponent(slug)}${token ? `&_t=${encodeURIComponent(token)}` : ""}`
    : "/api/dashboard";

  const serviceOptions = services
    .map((s) => {
      const label =
        s.serviceKey === "private-ear-wax-removal" ? "Ear Wax Removal"
        : s.serviceKey === "pharmacy-weight-loss-programme" ? "Weight Loss Programme"
        : s.serviceName;
      return `<option value="${esc(s.serviceKey)}"${s.serviceKey === serviceKey ? " selected" : ""}>${esc(label)}</option>`;
    })
    .join("\n");

  const packOptions = PACK_OPTIONS.map(
    (p) => `<option value="${esc(p.packKey)}"${p.packKey === packKey ? " selected" : ""}>${esc(p.packName)}</option>`,
  ).join("\n");

  const cards = prompts.length
    ? prompts.map((p, i) => renderPromptCard(p, i, { token, serviceKey, packKey })).join("\n")
    : `<p class="sip-empty">No prompts found for this service/pack combination.</p>`;

  const defaultKeysPresent = DEFAULT_PROMPT_KEYS.filter((k) => prompts.some((p) => p.imageKey === k));
  const defaultViewActive = serviceKey === DEFAULT_SERVICE && packKey === DEFAULT_PACK;

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Pharmacy Image Prompts</title>
<style>
:root{--brand:#005EB8;--border:#e2e8f0;--muted:#64748b;--bg:#f8fafc;--card:#fff;--text:#0f172a}
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:var(--bg);color:var(--text);line-height:1.5}
.wrap{max-width:960px;margin:0 auto;padding:24px 20px 48px}
.topbar{display:flex;flex-wrap:wrap;gap:12px;align-items:center;margin-bottom:20px}
.topbar a{color:var(--brand);text-decoration:none;font-weight:600;font-size:.88rem}
.topbar a:hover{text-decoration:underline}
h1{font-size:1.35rem;margin-bottom:4px}
.sub{color:var(--muted);font-size:.88rem;margin-bottom:18px}
.panel{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:20px}
.panel form{display:flex;flex-wrap:wrap;gap:12px;align-items:flex-end}
.panel label{font-size:.82rem;color:var(--muted);display:flex;flex-direction:column;gap:4px}
.panel select{padding:8px 10px;border:1px solid #d1d5db;border-radius:6px;min-width:200px;font-size:.88rem}
.sip-btn{display:inline-block;padding:7px 14px;border:1px solid #cbd5e1;border-radius:6px;background:#fff;color:#0f172a;font-size:.82rem;font-weight:600;cursor:pointer;text-decoration:none}
.sip-btn:hover{background:#f1f5f9}
.sip-btn-primary{background:var(--brand);border-color:var(--brand);color:#fff}
.sip-btn-primary:hover{background:#004a94}
.sip-btn-link{display:inline-block}
.sip-status{font-size:.82rem;padding:8px 12px;border-radius:6px;background:#ecfdf5;color:#065f46;margin-bottom:16px;display:none}
.sip-status.show{display:block}
.sip-summary{font-size:.82rem;color:var(--muted);margin-bottom:16px}
.sip-card{background:var(--card);border:1px solid var(--border);border-radius:10px;padding:16px 18px;margin-bottom:16px}
.sip-card-head h2{font-size:1rem;margin-bottom:6px}
.sip-meta{font-size:.78rem;color:var(--muted)}
.sip-actions{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0}
.sip-hint{font-size:.72rem;color:var(--muted);margin-bottom:8px}
.sip-label{display:block;font-size:.78rem;font-weight:600;color:#475569;margin:8px 0 4px}
.sip-textarea{display:block;width:100%;min-height:140px;padding:10px;border:1px solid #d1d5db;border-radius:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:.78rem;line-height:1.45;resize:vertical;background:#fff;color:#0f172a;user-select:text;-webkit-user-select:text}
.sip-empty{padding:16px;color:#92400e;background:#fffbeb;border:1px solid #fcd34d;border-radius:8px}
.badge{display:inline-block;font-size:.72rem;padding:2px 8px;border-radius:999px;background:#eff6ff;color:#1d4ed8;margin-left:8px}
</style>
</head>
<body>
<div class="wrap">
  <div class="topbar">
    <a href="${esc(dashboardUrl)}">← Back to Dashboard</a>
    <span style="color:var(--muted);font-size:.78rem">Built ${esc(builtAt)}</span>
  </div>
  <h1>Pharmacy Image Prompts <span class="badge">Standalone</span></h1>
  <p class="sub">Server-rendered prompt library — Industry: Pharmacy · Service: ${esc(serviceKey)} · Pack: ${esc(packKey)} · ${prompts.length} prompt(s)</p>

  <div class="panel">
    <form method="GET" action="/api/image-prompts">
      ${slug ? `<input type="hidden" name="slug" value="${esc(slug)}"/>` : ""}
      ${token ? `<input type="hidden" name="_t" value="${esc(token)}"/>` : ""}
      <label>Service
        <select name="serviceKey">${serviceOptions}</select>
      </label>
      <label>Pack
        <select name="packKey">${packOptions}</select>
      </label>
      <button type="submit" class="sip-btn sip-btn-primary">Apply</button>
      <a class="sip-btn" href="${esc(buildPageUrl({ slug, token, serviceKey: DEFAULT_SERVICE, packKey: DEFAULT_PACK }))}">Reset to Pharmacy First</a>
      <a class="sip-btn sip-btn-link" href="/api/image-prompt-dashboard/export?${packExportQs}" download>Download Prompt Pack</a>
    </form>
  </div>

  <div id="sip-status" class="sip-status" role="status"></div>
  <div class="sip-summary">
    Default view: ${defaultViewActive ? "active" : "custom"} ·
    Expected default keys present: ${defaultKeysPresent.length}/${DEFAULT_PROMPT_KEYS.length}
    (${esc(defaultKeysPresent.join(", ") || "none")})
  </div>

  ${cards}
</div>
<script>
function sipFlash(msg){
  var el=document.getElementById('sip-status');
  if(!el)return;
  el.textContent=msg;
  el.classList.add('show');
  setTimeout(function(){el.classList.remove('show');},2200);
}
function sipCopy(id,msg){
  var el=document.getElementById(id);
  if(!el){sipFlash('Copy failed');return;}
  var text=el.value||el.textContent||'';
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){sipFlash(msg);}).catch(function(){sipCopyFallback(el,msg);});
  }else{sipCopyFallback(el,msg);}
}
function sipCopyFallback(el,msg){
  el.focus();el.select();
  try{document.execCommand('copy');sipFlash(msg);}catch(e){sipFlash('Select text and copy manually');}
}
function sipCopyBoth(pid,nid){
  var p=document.getElementById(pid),n=document.getElementById(nid);
  var text=(p?(p.value||p.textContent||''):'')+'\\n\\n---\\nNegative:\\n'+(n?(n.value||n.textContent||''):'');
  if(navigator.clipboard&&navigator.clipboard.writeText){
    navigator.clipboard.writeText(text).then(function(){sipFlash('Prompt and negative copied');}).catch(function(){sipFlash('Copy failed — select textareas manually');});
  }else{sipFlash('Select textareas and copy manually');}
}
</script>
</body>
</html>`;
}

router.get("/image-prompts", (req: Request, res: Response) => {
  try {
    const slug = q(req, "slug") ?? "";
    const token = q(req, "_t") ?? process.env.SESSION_SECRET ?? "";
    const serviceKey = q(req, "serviceKey") ?? DEFAULT_SERVICE;
    const packKey = q(req, "packKey") ?? DEFAULT_PACK;

    const prompts = getPrompts({
      industry: "pharmacy",
      serviceKey,
      packKey,
    });

    const services = listFeaturedHubServices("pharmacy");
    const builtAt = new Date().toISOString();

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.send(
      renderPage({
        slug,
        token,
        serviceKey,
        packKey,
        prompts,
        services,
        builtAt,
      }),
    );
  } catch (err) {
    res.status(500).send(`<pre>Failed to render image prompts: ${esc((err as Error).message)}</pre>`);
  }
});

/** Inline JSON download without relying on client-side dashboard JS. */
router.get("/image-prompts/download-single", (req: Request, res: Response) => {
  try {
    const imageKey = q(req, "imageKey");
    const packKey = q(req, "packKey") ?? DEFAULT_PACK;
    const serviceKey = q(req, "serviceKey") ?? DEFAULT_SERVICE;
    const payload = exportSinglePrompt({
      industry: "pharmacy",
      packKey,
      serviceKey,
      imageKey,
    });
    if (!payload) {
      res.status(404).json({ error: "Prompt not found" });
      return;
    }
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="prompt-${imageKey ?? "single"}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

router.get("/image-prompts/download-pack", (req: Request, res: Response) => {
  try {
    const packKey = q(req, "packKey") ?? DEFAULT_PACK;
    const serviceKey = q(req, "serviceKey") ?? DEFAULT_SERVICE;
    const payload = exportPromptPack({ industry: "pharmacy", packKey, serviceKey });
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Content-Disposition", `attachment; filename="prompt-pack-${packKey}.json"`);
    res.send(JSON.stringify(payload, null, 2));
  } catch (err) {
    res.status(500).json({ error: (err as Error).message });
  }
});

export default router;
